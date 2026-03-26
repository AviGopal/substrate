# Model Selection Optimization System

## Overview

This document describes the system for automatically determining when smaller/faster models (like Haiku) can replace larger models (like Sonnet) for specific activity tasks, validated through A/B testing and cost-quality analysis.

## Problem Statement

**Question**: How can we know if Haiku would work instead of Sonnet?

**Core Challenges**:
1. Different tasks have different complexity requirements
2. Model cost varies significantly (Haiku ~10x cheaper than Sonnet)
3. Quality degradation isn't always apparent without validation
4. Manual testing is time-consuming and not scalable

## Solution Architecture

### 1. **Model Variant Testing Framework** (A/B Testing for AI)

#### Concept
- Run the same activity task with multiple model variants
- Compare quality, cost, and latency
- Build confidence intervals for each model per task type

#### Components

```typescript
interface ModelVariant {
  providerID: string
  modelID: string
  tier: "nano" | "small" | "medium" | "large"  // e.g., haiku=small, sonnet=large
  costMultiplier: number  // relative to baseline
}

interface VariantTest {
  taskID: string
  taskType: string  // e.g., "implement-feature", "fix-bug", "refactor"
  baselineVariant: ModelVariant  // current model (Sonnet)
  testVariants: ModelVariant[]   // alternatives (Haiku, etc.)
  samplingRate: number           // % of executions to test (10-30%)
}

interface VariantResult {
  variantID: string
  success: boolean
  cost: number
  duration: number
  qualityScore: number  // 0-1, computed from validation
  validationErrors: string[]
}
```

#### Quality Metrics

Quality score computed from:
1. **Validation Pass Rate**: Did tests pass?
2. **Code Quality**: Static analysis issues introduced
3. **Completeness**: Did it address all requirements? (LLM-as-judge)
4. **Human Feedback**: Optional thumbs up/down on results

```typescript
function computeQualityScore(result: {
  validationPassed: boolean
  staticAnalysisIssues: number
  requirementsCoverage: number  // 0-1
  humanFeedback?: "positive" | "negative"
}): number {
  let score = 0
  
  // Validation is critical (40% weight)
  if (result.validationPassed) score += 0.4
  
  // Static analysis quality (20% weight)
  const issuesPenalty = Math.min(result.staticAnalysisIssues * 0.05, 0.2)
  score += 0.2 - issuesPenalty
  
  // Requirements coverage (30% weight)
  score += result.requirementsCoverage * 0.3
  
  // Human feedback (10% weight)
  if (result.humanFeedback === "positive") score += 0.1
  if (result.humanFeedback === "negative") score -= 0.1
  
  return Math.max(0, Math.min(1, score))
}
```

### 2. **Thompson Sampling for Model Selection**

Use Thompson Sampling (Bayesian MAB) to balance exploration vs exploitation:

```typescript
interface ModelArm {
  modelID: string
  alpha: number  // successes + 1 (prior)
  beta: number   // failures + 1 (prior)
  totalCost: number
  totalExecutions: number
}

class ThompsonSampler {
  private arms: Map<string, ModelArm> = new Map()
  
  /**
   * Select a model variant for execution
   * 
   * Higher success rate models are selected more often,
   * but we still explore alternatives to discover better options
   */
  selectModel(taskType: string): string {
    const arms = this.getArmsForTask(taskType)
    
    // Sample from Beta distribution for each arm
    const samples = arms.map(arm => ({
      modelID: arm.modelID,
      sample: betaDistribution(arm.alpha, arm.beta)
    }))
    
    // Select model with highest sample
    return samples.reduce((best, curr) => 
      curr.sample > best.sample ? curr : best
    ).modelID
  }
  
  /**
   * Update model statistics after execution
   */
  updateArm(modelID: string, success: boolean, cost: number) {
    const arm = this.arms.get(modelID)
    if (!arm) return
    
    if (success) {
      arm.alpha += 1
    } else {
      arm.beta += 1
    }
    
    arm.totalCost += cost
    arm.totalExecutions += 1
  }
}
```

**Why Thompson Sampling?**
- Bayesian approach with uncertainty quantification
- Automatically balances exploration (trying new models) vs exploitation (using best known model)
- Works well with limited data (cold start problem)
- Simple to implement and interpret

### 3. **Cost-Quality Tradeoff Analysis**

#### Pareto Frontier
Identify models that are non-dominated in cost-quality space:

```typescript
interface ModelPerformance {
  modelID: string
  avgCost: number
  avgQuality: number
  successRate: number
  sampleSize: number
}

function computeParetoFrontier(
  models: ModelPerformance[]
): ModelPerformance[] {
  const frontier: ModelPerformance[] = []
  
  for (const model of models.sort((a, b) => a.avgCost - b.avgCost)) {
    // Model is on frontier if no other model has both:
    // - Lower cost AND higher quality
    const dominated = models.some(other => 
      other.avgCost <= model.avgCost && 
      other.avgQuality > model.avgQuality
    )
    
    if (!dominated) {
      frontier.push(model)
    }
  }
  
  return frontier
}
```

#### Recommendation Engine

```typescript
interface ModelRecommendation {
  recommendedModel: string
  confidence: "high" | "medium" | "low"
  costSavings: number  // $ saved vs baseline
  qualityDelta: number  // quality difference vs baseline
  reason: string
}

function recommendModel(
  taskType: string,
  baseline: ModelPerformance,
  alternatives: ModelPerformance[],
  riskTolerance: "conservative" | "balanced" | "aggressive"
): ModelRecommendation {
  const frontier = computeParetoFrontier([baseline, ...alternatives])
  
  // Find best alternative based on risk tolerance
  for (const model of frontier.filter(m => m.modelID !== baseline.modelID)) {
    const qualityDelta = model.avgQuality - baseline.avgQuality
    const costSavings = baseline.avgCost - model.avgCost
    
    // Conservative: only recommend if quality is equal or better
    if (riskTolerance === "conservative" && qualityDelta < 0) continue
    
    // Balanced: accept small quality loss for significant cost savings
    if (riskTolerance === "balanced" && qualityDelta < -0.05) continue
    
    // Aggressive: accept larger quality loss for cost savings
    if (riskTolerance === "aggressive" && qualityDelta < -0.15) continue
    
    // Require significant cost savings (at least 30%)
    if (costSavings < baseline.avgCost * 0.3) continue
    
    // Require minimum sample size for confidence
    const minSamples = 10
    const confidence = 
      model.sampleSize >= minSamples * 3 ? "high" :
      model.sampleSize >= minSamples ? "medium" : "low"
    
    return {
      recommendedModel: model.modelID,
      confidence,
      costSavings,
      qualityDelta,
      reason: buildRecommendationReason(model, baseline, costSavings, qualityDelta)
    }
  }
  
  return {
    recommendedModel: baseline.modelID,
    confidence: "high",
    costSavings: 0,
    qualityDelta: 0,
    reason: "No better alternative found with acceptable quality-cost tradeoff"
  }
}

function buildRecommendationReason(
  model: ModelPerformance,
  baseline: ModelPerformance,
  savings: number,
  qualityDelta: number
): string {
  const parts: string[] = []
  
  parts.push(`${model.modelID} costs $${savings.toFixed(4)} less per execution`)
  
  if (qualityDelta >= 0) {
    parts.push(`with equal or better quality (+${(qualityDelta * 100).toFixed(1)}%)`)
  } else {
    parts.push(`with slightly lower quality (${(qualityDelta * 100).toFixed(1)}%)`)
  }
  
  parts.push(`based on ${model.sampleSize} executions`)
  
  return parts.join(" ")
}
```

### 4. **Integration with Activity System**

#### Task-Level Model Override

Extend activity task schema to support model variants:

```typescript
interface ActivityTask {
  id: string
  subagent: string
  description: string
  prompt: TaskPrompt
  
  // NEW: Model variant testing
  modelVariants?: {
    enabled: boolean
    baseline: ModelVariant
    alternatives: ModelVariant[]
    samplingRate: number  // % of executions to test alternatives
  }
}
```

#### Execution Flow

```typescript
async function executeActivityTask(
  task: ActivityTask,
  context: ExecutionContext
): Promise<TaskResult> {
  // 1. Select model variant
  let selectedModel: ModelVariant
  
  if (task.modelVariants?.enabled) {
    // Use Thompson sampling to select variant
    const sampler = await ThompsonSampler.forTask(task.id)
    const shouldTest = Math.random() < task.modelVariants.samplingRate
    
    if (shouldTest) {
      // Explore: try alternative models
      selectedModel = sampler.selectModel(task.id)
    } else {
      // Exploit: use best known model
      selectedModel = task.modelVariants.baseline
    }
  } else {
    // Use agent's default model
    selectedModel = await Agent.getModel(task.subagent)
  }
  
  // 2. Execute with selected model
  const result = await executeWithModel(task, selectedModel, context)
  
  // 3. Compute quality score
  const qualityScore = await computeQualityScore({
    validationPassed: result.validation.passed,
    staticAnalysisIssues: result.staticAnalysis?.issues.length ?? 0,
    requirementsCoverage: await assessRequirementsCoverage(task, result)
  })
  
  // 4. Update Thompson sampling statistics
  if (task.modelVariants?.enabled) {
    await sampler.updateArm(
      selectedModel.modelID,
      qualityScore >= 0.7,  // success threshold
      result.cost
    )
  }
  
  // 5. Store metrics for analysis
  await storeVariantMetrics({
    taskID: task.id,
    modelID: selectedModel.modelID,
    cost: result.cost,
    duration: result.duration,
    qualityScore,
    success: result.validation.passed
  })
  
  return result
}
```

### 5. **Validation & Reporting**

#### Command-Line Tools

```bash
# List model recommendations for activity templates
opencode model recommend --template add-feature-complete

# Compare model performance for a task type
opencode model compare --task-type "implement-feature" --models haiku,sonnet

# View cost savings report
opencode model report --period "last-30-days"

# Enable variant testing for a template
opencode model test --template add-feature-complete --alternatives haiku --rate 20%

# View Thompson sampling statistics
opencode model stats --task-type "implement-feature"
```

#### Dashboard Visualization

Track in OpenCode dashboard:
- **Cost Savings**: Total $ saved by using optimized models
- **Quality Score Trends**: Quality over time per model
- **Model Selection Distribution**: Which models are being chosen
- **Pareto Frontier**: Visual cost-quality tradeoff chart
- **Confidence Intervals**: Statistical significance of results

### 6. **Gradual Rollout Strategy**

#### Phase 1: Data Collection (Weeks 1-2)
- Enable variant testing on 10% of activity executions
- Collect baseline metrics (cost, quality, latency)
- No automatic model switching

#### Phase 2: Validation (Weeks 3-4)
- Analyze results: identify tasks where Haiku performs well
- Generate recommendations with confidence scores
- Manual review and approval of model changes

#### Phase 3: Gradual Adoption (Weeks 5-8)
- Automatically apply "high confidence" recommendations
- Monitor quality metrics closely
- Rollback if quality degrades

#### Phase 4: Full Automation (Week 9+)
- Thompson sampling runs continuously
- System automatically explores new models
- Adapts to model updates and pricing changes

## Implementation Plan

### Step 1: Core Infrastructure
- [ ] Create `model-variant-testing.ts` module
- [ ] Implement Thompson sampling algorithm
- [ ] Add variant metrics storage (extend activity metrics schema)

### Step 2: Activity Template Integration
- [ ] Extend ActivityTask schema with `modelVariants` field
- [ ] Modify task executor to support model selection
- [ ] Add quality scoring pipeline

### Step 3: Analysis & Recommendations
- [ ] Implement Pareto frontier computation
- [ ] Build recommendation engine
- [ ] Create CLI commands for model analysis

### Step 4: Dashboard & Monitoring
- [ ] Add model performance charts to dashboard
- [ ] Implement cost savings tracking
- [ ] Create alerts for quality degradation

### Step 5: Validation & Rollout
- [ ] Run pilot study on selected activity templates
- [ ] Validate recommendations with manual review
- [ ] Document learnings and best practices

## Expected Outcomes

### Cost Savings
- **Conservative estimate**: 20-30% reduction in LLM costs
  - Simple tasks (title generation, formatting): Haiku 100% effective
  - Medium tasks (bug fixes, small features): Haiku 60-80% effective
  - Complex tasks (large refactors): Haiku 20-40% effective

### Quality Impact
- **Target**: ≤5% quality degradation vs baseline
- **Mitigation**: Automatic rollback if quality drops below threshold
- **Validation**: Continuous monitoring with statistical tests

### Performance
- **Latency improvement**: 2-3x faster for tasks using Haiku
- **Throughput**: More tasks can run concurrently with cheaper models

## Related Work

### Industry Approaches
1. **OpenAI**: Dynamic model routing based on task complexity
2. **Anthropic**: Tiered models (Opus, Sonnet, Haiku) for different use cases
3. **Langchain**: LLM routing and fallback strategies

### Academic Research
- Multi-Armed Bandits for hyperparameter optimization
- Pareto frontier analysis in ML model selection
- Cost-aware model ensemble methods

## References

- [Thompson Sampling Tutorial](https://web.stanford.edu/~bvr/pubs/TS_Tutorial.pdf)
- [Anthropic Model Pricing](https://www.anthropic.com/pricing)
- [Multi-Armed Bandit Algorithms](https://arxiv.org/abs/1402.6028)

---

**Document Status**: Design Proposal  
**Last Updated**: 2026-02-25  
**Authors**: Activity Mode Agent  
**Review Status**: Awaiting Feedback
