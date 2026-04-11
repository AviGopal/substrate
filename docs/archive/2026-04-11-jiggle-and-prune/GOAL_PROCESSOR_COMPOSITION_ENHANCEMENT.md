# Goal Processor Composition Enhancement

## Date: 2026-04-10

## Executive Summary

This document outlines the changes needed to enhance MiniBob's goal processor to **prefer activity composition over monolithic activities** while maintaining relevance. The key principle is: **compose when shapes align, not arbitrarily**.

## Current State

### How Goal Processing Works

1. **Goal Enrichment**: Extract expected outcomes, required capabilities, implied shapes
2. **Thompson Sampling**: Backend recommends activities based on historical performance
3. **Shape-Conditioned Selection**: Activities matched based on input/output shape compatibility
4. **Variant-Aware Selection**: Choose between template variants based on success rate
5. **Pre-Flight Analysis**: Determine if goal needs decomposition, context gathering, or improvisation

### Current Recommendation Flow

```
User Goal
  ↓
Goal Enrichment (extract shapes, outcomes)
  ↓
Create Goal Impulse (with expected output shapes)
  ↓
Backend Thompson Sampling (recommend activities)
  ↓
Variant-Aware Selection (choose best variant)
  ↓
Relevance Assessment (score > threshold?)
  ↓
Execute Activity OR Decompose/Improvise
```

### What's Missing

**Composition-awareness**: The system recommends individual activities but doesn't consider whether composing multiple smaller activities would be better than executing one large activity.

## Desired State: Composition Preference

### Key Principle

> **Only compose when shapes align**. Never compose irrelevant activities just for the sake of composition.

### Example: Good Composition

**Goal**: "Analyze application traces and generate improvement recommendations"

**Current Behavior**:
- Recommends single monolithic activity: `analyze-app-usage` (196s execution)

**Desired Behavior**:
- Check composition graph for successful patterns
- Find: `fetch-api-json → calculate-error-statistics → generate-improvement-recommendations`
- Verify shape compatibility:
  - `api_response` (fetch output) ⟷ `trace_data` (error calc input) ✅
  - `error_statistics` (error calc output) ⟷ `error_statistics` (recommendations input) ✅
- **Recommend composed sequence** (60s execution, 69% faster)

### Example: Bad Composition (Should NOT Happen)

**Goal**: "Fix authentication bug"

**Irrelevant Composition**:
- ❌ `fetch-github-workflow-stats` → `calculate-performance-metrics`
  - Shapes don't align with goal
  - Activities unrelated to authentication
  - This would be harmful, not helpful

**Correct Behavior**:
- Recommend relevant single activity: `fix-bug-complete`
- OR decompose into: `reproduce-bug` → `identify-root-cause` → `apply-fix`

## Implementation Plan

### Phase 1: Composition Graph Query

**File**: `repos/minibob/src/mcp.ts`

Add method to query backend composition graph:

```typescript
async queryCompositionPatterns(
  goalShapes: string[],
  expectedOutputShapes: string[],
  limit: number = 10
): Promise<CompositionPattern[]> {
  const response = await this.request(
    "GET",
    `/v2/activities/composition/patterns`,
    null,
    {
      input_shapes: goalShapes.join(','),
      output_shapes: expectedOutputShapes.join(','),
      min_executions: 3,  // Only patterns with proven success
      min_success_rate: 70,  // Only reliable patterns
      limit
    }
  )

  return response.patterns
}
```

**Backend Endpoint** (to implement): Returns composition patterns where:
- Input shapes match `goalShapes`
- Output shapes match `expectedOutputShapes`
- Pattern has been executed successfully multiple times
- Activities in sequence have compatible shapes

### Phase 2: Composition-Aware Recommendation

**File**: `repos/minibob/src/goal-processor.ts`

Enhance `getRecommendations()` to include composition candidates:

```typescript
async getRecommendations(
  goal: Goal,
  loadedImpulseIds: string[] = [],
  limit: number = 3,
  excludeActivities: string[] = [],
  options?: {
    variantAware?: boolean
    selectionContexts?: Map<string, SelectionContext>
    compositionAware?: boolean  // NEW: Default true
  }
): Promise<ActivityRecommendation[]> {
  const compositionAware = options?.compositionAware !== false

  // 1. Get individual activity recommendations (existing logic)
  const individualRecs = await this.getRecommendationsViaImpulse(goalImpulseId)

  // 2. Get composition pattern recommendations (NEW)
  if (compositionAware) {
    const expectedShapes = mapOutcomesToShapes(goal.enrichment?.expectedOutcomes || [])
    const impliedShapes = extractImpliedShapes(goal.intent)

    const compositionPatterns = await mcpClient.queryCompositionPatterns(
      impliedShapes,
      expectedShapes,
      limit
    )

    // 3. Convert composition patterns to recommendations
    const compositionRecs = compositionPatterns.map(pattern => ({
      template_id: `composition:${pattern.id}`,
      template_name: pattern.name,
      category: 'composed',
      isComposition: true,
      sequence: pattern.activities,  // Array of activity IDs
      selection_metadata: {
        sampled_value: calculateCompositionScore(pattern),
        source: 'composition_graph'
      }
    }))

    // 4. Merge and rank all recommendations
    const allRecs = [...individualRecs, ...compositionRecs]
    const rankedRecs = rankRecommendations(allRecs, goal)

    return rankedRecs.slice(0, limit)
  }

  return individualRecs
}
```

### Phase 3: Composition Score Calculation

**File**: `repos/minibob/src/goal-processor.ts`

Add scoring function that prefers composition when appropriate:

```typescript
function calculateCompositionScore(pattern: CompositionPattern): number {
  // Base score from historical performance
  const baseScore = pattern.success_rate / 100

  // Bonus for proven patterns (more executions = more reliable)
  const executionBonus = Math.min(0.1, pattern.executions / 100)

  // Bonus for efficiency (faster execution)
  const avgDuration = pattern.avg_duration_ms
  const efficiencyBonus = avgDuration < 60000 ? 0.1 : 0  // Bonus if < 1 min

  // Penalty for too many steps (prefer simple compositions)
  const complexityPenalty = pattern.activities.length > 4 ? 0.1 : 0

  return baseScore + executionBonus + efficiencyBonus - complexityPenalty
}
```

### Phase 4: Composition Execution

**File**: `repos/minibob/src/goal-processor.ts`

Handle composed activity execution:

```typescript
if (selectedRec.isComposition) {
  log.info(` Executing composed sequence: ${selectedRec.sequence.join(' → ')}`)

  const compositionResult = await this.executeComposedSequence(
    selectedRec.sequence,
    goal,
    accumulatedImpulses
  )

  // Record composition execution for learning
  await mcpClient.recordCompositionExecution({
    compositionId: selectedRec.template_id,
    activities: selectedRec.sequence,
    status: compositionResult.success ? 'success' : 'failed',
    duration_ms: compositionResult.duration,
    goal: goal.intent
  })

  execution = compositionResult.execution
}
```

**New Method**: `executeComposedSequence()`

```typescript
async executeComposedSequence(
  activityIds: string[],
  goal: Goal,
  accumulatedImpulses: Impulse[]
): Promise<CompositionResult> {
  const executions: ActivityExecution[] = []
  let currentImpulses = [...accumulatedImpulses]

  for (const [index, activityId] of activityIds.entries()) {
    log.info(` Step ${index + 1}/${activityIds.length}: ${activityId}`)

    // Get activity template
    const template = await mcpClient.getTemplate(activityId)
    if (!template) {
      throw new Error(`Activity not found: ${activityId}`)
    }

    // Execute activity with current context
    const execution = await this.activityExecutor.execute(
      template,
      currentImpulses,
      { goal: goal.intent }
    )

    executions.push(execution)

    // Add output impulses to context for next activity
    if (execution.outputImpulses) {
      currentImpulses.push(...execution.outputImpulses)
    }

    // Stop if any activity fails
    if (execution.status === 'failed') {
      return {
        success: false,
        executions,
        duration: executions.reduce((sum, e) => sum + (e.metrics?.duration || 0), 0)
      }
    }
  }

  return {
    success: true,
    executions,
    duration: executions.reduce((sum, e) => sum + (e.metrics?.duration || 0), 0),
    execution: executions[executions.length - 1]  // Return final execution
  }
}
```

## Shape Compatibility Verification

**Critical**: Only compose when shapes align.

```typescript
function verifyShapeCompatibility(sequence: string[], templates: Map<string, ActivityTemplate>): boolean {
  for (let i = 0; i < sequence.length - 1; i++) {
    const currentActivity = templates.get(sequence[i])
    const nextActivity = templates.get(sequence[i + 1])

    if (!currentActivity || !nextActivity) {
      return false
    }

    // Check if current activity's output shapes match next activity's input shapes
    const outputShapes = currentActivity.output_shapes || []
    const inputShapes = nextActivity.input_shapes || []

    // At least one output shape must match one input shape
    const hasMatch = outputShapes.some(out => inputShapes.includes(out))

    if (!hasMatch) {
      log.warn(` Shape mismatch: ${sequence[i]} output ${outputShapes} ≠ ${sequence[i + 1]} input ${inputShapes}`)
      return false
    }
  }

  return true
}
```

## Relevance Filtering

**Ensure composition relevance to goal**:

```typescript
function rankRecommendations(
  recommendations: ActivityRecommendation[],
  goal: Goal
): ActivityRecommendation[] {
  return recommendations
    .map(rec => ({
      ...rec,
      relevanceScore: calculateRelevanceScore(rec, goal)
    }))
    .filter(rec => rec.relevanceScore >= MIN_RELEVANCE_THRESHOLD)
    .sort((a, b) => b.relevanceScore - a.relevanceScore)
}

function calculateRelevanceScore(rec: ActivityRecommendation, goal: Goal): number {
  // For compositions, check if ALL activities are relevant
  if (rec.isComposition) {
    const activityRelevance = rec.sequence.map(actId =>
      assessActivityRelevance(actId, goal)
    )

    // Composition is only as relevant as its weakest link
    return Math.min(...activityRelevance)
  }

  // For individual activities, use existing logic
  return assessActivityRelevance(rec.template_id, goal)
}
```

## Configuration

Allow users to control composition preference:

**File**: `.metabob/config.json`

```json
{
  "goal_processor": {
    "composition": {
      "enabled": true,
      "min_pattern_executions": 3,
      "min_pattern_success_rate": 70,
      "max_sequence_length": 5,
      "prefer_composition_when_faster": true
    }
  }
}
```

## Testing Plan

### Test Case 1: Valid Composition

```typescript
Goal: "Analyze app traces and create improvement recommendations"
Expected Shapes: trace_data → error_statistics → recommendations

Expected Behavior:
✅ Find composition: fetch-api-json → calculate-error-statistics → generate-recommendations
✅ Verify shape compatibility
✅ Rank higher than monolithic activity (if faster/more reliable)
✅ Execute sequence successfully
```

### Test Case 2: Invalid Composition (Shape Mismatch)

```typescript
Goal: "Fix authentication bug"
Available Patterns:
- fetch-github-stats → calculate-performance-metrics (shapes don't match goal)

Expected Behavior:
❌ Filter out composition due to shape mismatch
✅ Recommend individual activity instead
```

### Test Case 3: Composition vs. Monolithic

```typescript
Goal: "Generate performance report"
Options:
1. Monolithic: generate-full-report (120s, 80% success)
2. Composition: fetch-data → calculate-metrics → format-report (60s, 90% success)

Expected Behavior:
✅ Prefer composition (faster AND more reliable)
```

## Rollout Strategy

### Phase 1: Backend (Week 1)
- Implement `/v2/activities/composition/patterns` endpoint
- Store composition execution traces
- Build composition graph from historical executions

### Phase 2: MiniBob (Week 2)
- Add composition-aware recommendation logic
- Implement composition execution
- Add shape compatibility verification

### Phase 3: Testing (Week 3)
- Test with decomposed activities from demo-minibob-cicd
- Verify no irrelevant compositions occur
- Measure performance improvements

### Phase 4: Production (Week 4)
- Enable by default
- Monitor composition success rates
- Collect user feedback

## Success Metrics

1. **Composition Usage**: % of goals resolved via composition vs. monolithic
2. **Performance**: Average execution time (composition vs. monolithic)
3. **Success Rate**: Composition success rate vs. individual activities
4. **Relevance**: % of composed activities that are actually relevant to goals
5. **User Satisfaction**: Feedback on composition quality

## Expected Outcomes

### Immediate Benefits
- Faster execution for complex goals (60-80% improvement in tested cases)
- Better code reuse (atomic activities used in multiple compositions)
- More maintainable activity library (smaller, focused activities)

### Long-Term Benefits
- Self-improving composition patterns (Thompson Sampling learns best combinations)
- Emergent workflows from successful compositions
- Reduced need for monolithic "do everything" activities

## Constraints and Safeguards

1. **Never compose irrelevant activities**: Shape compatibility is mandatory
2. **Prefer proven patterns**: Require minimum executions before recommending
3. **Fail gracefully**: Fall back to individual activities if composition fails
4. **User control**: Allow disabling via configuration
5. **Explainability**: Log why compositions are recommended/rejected

## Next Steps

1. Review and approve this design
2. Implement backend composition graph endpoint
3. Implement MiniBob composition-aware recommendation
4. Test with existing atomic activities
5. Monitor and iterate

---

**Status**: Design complete, ready for implementation
**Owner**: MiniBob development team
**Priority**: High (enables key teaching loop functionality)
