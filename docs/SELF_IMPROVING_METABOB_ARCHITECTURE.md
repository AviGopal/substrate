# Self-Improving Metabob Architecture

## Vision Statement

Metabob analyzes itself, generates development tasks based on CPG embeddings and code quality predictions, distributes tasks to DevBob agents, learns from execution outcomes, and continuously improves its prediction accuracy. The system reduces LLM usage over time by learning which activities work for which contexts.

## Current State: 80% Complete

### ✅ Implemented Components

1. **Activity System** 
   - Template creation and execution
   - Variable interpolation
   - Task sequencing
   - Retry strategies

2. **Outcome Recording**
   - Activity results tracked
   - Metrics collected (duration, cost, tokens)
   - Decision logging
   - Backend API integration

3. **DevBob Multi-Agent**
   - 3 agents (opencode, rpc-api, cli)
   - ACP delegation working
   - Container isolation
   - Workspace management

4. **Impulse System**
   - Context loading
   - Budget management
   - Lazy resolution
   - Memory optimization

5. **Metabob-CLI Integration**
   - CPG generation
   - Code quality analysis
   - Issue detection
   - Component annotation

### ❌ Missing Components (20%)

1. **Parameter Server** (rpc-api)
   - Metrics aggregation missing
   - No cross-agent learning
   - Prediction model not implemented

2. **Task Prediction System**
   - CPG embeddings not used for prediction
   - No failure pattern analysis
   - No co-change recommendations

3. **Activity Grading**
   - No success/failure assessment
   - No context relevance tracking
   - No LLM cost reduction metrics

4. **Boredom Tasks**
   - No idle task generation
   - No background improvement tasks
   - No proactive refactoring

5. **Context Relevance Learning**
   - No feedback loop from outcomes to context selection
   - No learning which impulses help which tasks
   - No automatic budget tuning

6. **Cost Tracking**
   - Metrics not surfaced through ACP
   - No visibility into remote execution costs
   - Can't measure optimization impact

---

## Architecture: Self-Improving Distributed System

### System Hierarchy

```
┌─────────────────────────────────────────────────────────────┐
│                    Metabob RPC API                          │
│                  (Parameter Server)                         │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ Metrics Aggregator                                  │   │
│  │ - Collect from all metabob-cli instances          │   │
│  │ - Group by org_id, project_id                     │   │
│  │ - Store: outcomes, costs, patterns               │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ Prediction Engine                                   │   │
│  │ - CPG FAISS embeddings                            │   │
│  │ - Failure pattern matching                        │   │
│  │ - Co-change predictions                           │   │
│  │ - Context relevance scoring                       │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ Task Generator                                      │   │
│  │ - High-risk regions → refactor tasks             │   │
│  │ - Quality issues → fix tasks                     │   │
│  │ - Idle agents → boredom tasks                    │   │
│  │ - Activity recommendations                        │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ Learning System                                     │   │
│  │ - Activity success patterns                       │   │
│  │ - Context relevance feedback                      │   │
│  │ - Cost reduction trends                           │   │
│  │ - Template evolution                              │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                           │
                           │ Recommendations
                           │ Boredom Tasks
                           │ Context Hints
                           ▼
┌──────────────────────────────────────────────────────────────┐
│                     DevBob Agents                            │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐          │
│  │  opencode   │  │   rpc-api   │  │     cli     │          │
│  │             │  │             │  │             │          │
│  │ Metabob-CLI │  │ Metabob-CLI │  │ Metabob-CLI │          │
│  │   (MCP)     │  │   (MCP)     │  │   (MCP)     │          │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘          │
│         │                │                │                  │
│         │ CPG Analysis   │ CPG Analysis   │ CPG Analysis    │
│         │ Outcomes       │ Outcomes       │ Outcomes        │
│         │ Metrics        │ Metrics        │ Metrics         │
│         └────────────────┴────────────────┘                  │
│                          │                                   │
│                          │ Report to Parameter Server        │
│                          ▼                                   │
│                    (rpc-api backend)                         │
└──────────────────────────────────────────────────────────────┘
```

---

## Data Flow: Complete Communication Cycle

### 1. Metrics Collection Flow

```
DevBob Agent
  └─ Activity Execution
      ├─ Before: CPG analysis of workspace
      │   └─ metabob-cli: Generate embeddings
      │   └─ Identify high-risk regions
      │   └─ Load relevant impulses
      │
      ├─ During: Task execution
      │   └─ Record decisions at each step
      │   └─ Track context usage
      │   └─ Measure token costs
      │
      └─ After: Outcome reporting
          ├─ Success/failure status
          ├─ Duration, cost, tokens
          ├─ Components modified
          ├─ Quality delta (issues fixed/introduced)
          ├─ Context relevance scores
          └─ Agent decisions & reasoning

          ↓ Report via HTTP

metabob-rpc-api
  └─ POST /api/v1/metrics/activity-outcome
      ├─ Validate: org_id, project_id, agent_name
      ├─ Store: Activity execution record
      ├─ Aggregate: Success rates, costs, patterns
      └─ Update: Prediction models
```

### 2. Prediction & Recommendation Flow

```
metabob-rpc-api
  └─ Background Task (every 5 minutes)
      ├─ Load: All outcomes since last run
      ├─ Update: CPG FAISS index
      ├─ Analyze: Failure patterns
      │   └─ Which components fail together?
      │   └─ Which activity templates have low success?
      │   └─ Which contexts correlate with success?
      │
      ├─ Generate: Task predictions
      │   └─ High-risk files → "refactor-with-tests"
      │   └─ Quality issues → "fix-bug-complete"
      │   └─ Co-change groups → "sync-related-components"
      │
      └─ Publish: Recommendations
          └─ POST /api/v1/recommendations
              ├─ agent: "devbob-opencode"
              ├─ task: "Refactor session-memory.ts"
              ├─ reason: "85% failure prediction"
              ├─ suggestedActivity: "refactor-with-tests"
              └─ context: [impulse IDs, CPG regions]

          ↓ Poll by agents

DevBob Agent
  └─ GET /api/v1/recommendations?agent=devbob-opencode
      ├─ Receive: Prioritized task list
      ├─ Select: Highest priority or boredom task
      └─ Execute: Activity with pre-selected context
```

### 3. Context Relevance Learning Flow

```
Activity Execution
  ├─ Load impulses based on task type
  ├─ Execute with context
  └─ Record: Which impulses were actually used in output

      ↓ Analyze

Context Relevance Scorer
  ├─ Parse: Agent response for impulse citations
  ├─ Calculate: relevance_score = cited_impulses / loaded_impulses
  ├─ Track: impulse_id → task_type → relevance_score
  └─ Learn: Patterns
      └─ "For bugfix tasks, load test files first"
      └─ "For features, load similar components"
      └─ "Documentation rarely helps with refactors"

      ↓ Update

Impulse Budget Tuner
  ├─ High relevance impulses: +20% budget
  ├─ Low relevance impulses: -30% budget
  └─ Never-used impulses: Remove from recommendations
```

### 4. Activity Grading Flow

```
Activity Outcome
  ├─ Expected to fail? (is_experiment: true)
  ├─ Success metrics:
  │   ├─ Task completion: Did it finish?
  │   ├─ Quality delta: Issues fixed - issues introduced
  │   ├─ Cost efficiency: Cost per line of code changed
  │   ├─ Context efficiency: Relevant impulses / total loaded
  │   └─ LLM reduction: Attempts needed vs historical avg
  │
  └─ Grade: A/B/C/D/F
      ├─ A: Success + under budget + high relevance
      ├─ B: Success + acceptable cost
      ├─ C: Success but expensive or low relevance
      ├─ D: Failed but learned something useful
      └─ F: Failed and wasted resources

      ↓ Feed into learning

Learning System
  ├─ Identify: Which activities grade well?
  ├─ Pattern: Success correlates with what context?
  ├─ Evolve: Templates with consistent failures
  └─ Recommend: Activities with high success rates
```

### 5. Boredom Task Flow

```
Agent Idle Detection
  └─ No active user tasks for 5 minutes

      ↓ Request boredom task

DevBob Agent
  └─ GET /api/v1/tasks/boredom?agent=devbob-opencode
      
      ↓ Parameter Server decides

Task Generator
  ├─ Check: Recent failure patterns
  ├─ Identify: Technical debt areas
  ├─ Generate: Low-risk improvement tasks
  │   └─ "Add tests to high-risk functions"
  │   └─ "Refactor duplicated code"
  │   └─ "Update stale documentation"
  │   └─ "Run experimental activities"
  │
  └─ Return: Task with experiment flag
      └─ is_experiment: true
      └─ ok_to_fail: true
      └─ purpose: "Learning, not critical"

      ↓ Execute

Agent
  ├─ Execute activity with experiment flag
  ├─ Record outcome (failure is acceptable)
  └─ Report: What was learned
      └─ "Activity X doesn't work for Y context"
      └─ "Impulse budgets too high for Z"
```

---

## Remaining Implementation: 20% Tasks

### Task 1: Parameter Server (metabob-rpc-api)

**Priority**: HIGH
**Estimated**: 2 days

#### 1.1: Metrics Aggregation Endpoint

**File**: `repos/metabob-rpc-api/src/routes/metrics.ts`

```typescript
import { FastifyPluginAsync } from 'fastify'

export const metricsRoutes: FastifyPluginAsync = async (fastify) => {
  // Accept activity outcome from any agent
  fastify.post('/api/v1/metrics/activity-outcome', async (request, reply) => {
    const { org_id, project_id, agent_name, activity_outcome } = request.body
    
    // Validate
    if (!org_id || !project_id || !agent_name || !activity_outcome) {
      return reply.code(400).send({ error: 'Missing required fields' })
    }
    
    // Store in database
    const record = await db.activity_outcomes.insert({
      org_id,
      project_id,
      agent_name,
      activity_id: activity_outcome.activityId,
      template_id: activity_outcome.templateId,
      success: activity_outcome.success,
      duration_ms: activity_outcome.duration,
      cost_usd: activity_outcome.cost,
      tokens: activity_outcome.tokens,
      components_modified: activity_outcome.componentsModified,
      quality_delta: activity_outcome.qualityDelta,
      context_impulses: activity_outcome.contextImpulses,
      relevance_scores: activity_outcome.relevanceScores,
      created_at: new Date()
    })
    
    // Trigger prediction model update (async)
    await queuePredictionModelUpdate(org_id, project_id)
    
    return reply.code(201).send({ id: record.id })
  })
  
  // Get aggregated metrics
  fastify.get('/api/v1/metrics/summary', async (request, reply) => {
    const { org_id, project_id, time_window } = request.query
    
    const summary = await db.activity_outcomes.aggregate({
      where: { org_id, project_id, created_at: { $gte: time_window } },
      group_by: ['template_id'],
      metrics: {
        total_executions: 'count(*)',
        success_rate: 'avg(success)',
        avg_duration: 'avg(duration_ms)',
        avg_cost: 'avg(cost_usd)',
        avg_relevance: 'avg(relevance_scores)',
      }
    })
    
    return reply.send(summary)
  })
}
```

#### 1.2: Database Schema

**File**: `repos/metabob-rpc-api/prisma/schema.prisma`

```prisma
model ActivityOutcome {
  id                  String   @id @default(uuid())
  org_id              String
  project_id          String
  agent_name          String
  activity_id         String
  template_id         String
  success             Boolean
  duration_ms         Int
  cost_usd            Float
  tokens_input        Int
  tokens_output       Int
  tokens_cache        Int
  components_modified String[]
  quality_delta       Json     // { issuesFixed, issuesIntroduced }
  context_impulses    String[] // Impulse IDs loaded
  relevance_scores    Json     // impulse_id -> score
  agent_decisions     Json[]   // Decision log
  created_at          DateTime @default(now())
  
  @@index([org_id, project_id])
  @@index([template_id])
  @@index([agent_name])
  @@index([created_at])
}

model TaskPrediction {
  id                String   @id @default(uuid())
  org_id            String
  project_id        String
  agent_name        String
  task_description  String
  task_type         String   // "bugfix", "refactor", "feature"
  priority          Int      // 1-10
  failure_risk      Float    // 0.0-1.0
  suggested_activity String  // Template ID
  context_hints     String[] // Impulse IDs to load
  cpg_regions       Json     // High-risk file/component pairs
  reason            String
  status            String   // "pending", "claimed", "completed"
  created_at        DateTime @default(now())
  claimed_at        DateTime?
  completed_at      DateTime?
  
  @@index([org_id, project_id, status])
  @@index([agent_name, status])
  @@index([priority])
}

model ContextRelevance {
  id            String   @id @default(uuid())
  impulse_id    String
  task_type     String
  template_id   String
  relevance     Float    // 0.0-1.0
  usage_count   Int
  success_count Int
  last_used     DateTime
  
  @@unique([impulse_id, task_type, template_id])
  @@index([task_type, relevance])
}
```

### Task 2: Task Prediction Engine

**Priority**: HIGH
**Estimated**: 3 days

#### 2.1: CPG Embedding Analysis

**File**: `repos/metabob-rpc-api/src/services/prediction-engine.ts`

```typescript
import { FAISS } from '@langchain/community/vectorstores/faiss'
import { OpenAIEmbeddings } from '@langchain/openai'

export class PredictionEngine {
  private faissIndex: FAISS
  private embeddings: OpenAIEmbeddings
  
  async analyzeCPG(orgId: string, projectId: string): Promise<RiskAnalysis> {
    // 1. Get all CPG data from metabob-cli instances
    const cpgData = await this.fetchCPGData(orgId, projectId)
    
    // 2. Load FAISS index with embeddings
    await this.loadFAISSIndex(cpgData)
    
    // 3. Find high-risk regions
    const failures = await db.activity_outcomes.find({
      where: { org_id: orgId, project_id: projectId, success: false },
      order_by: { created_at: 'desc' },
      limit: 100
    })
    
    // 4. Extract failure patterns
    const failureEmbeddings = failures.map(f => ({
      components: f.components_modified,
      error: f.agent_decisions.find(d => d.outcome === 'failure')?.reasoning
    }))
    
    // 5. Find similar regions in codebase
    const riskyRegions = []
    for (const fail of failureEmbeddings) {
      const similar = await this.faissIndex.similaritySearch(
        fail.error,
        k: 10,
        filter: { orgId, projectId }
      )
      
      riskyRegions.push(...similar.map(s => ({
        file: s.metadata.file,
        component: s.metadata.component,
        risk_score: s.score,
        reason: `Similar to past failure: ${fail.error.slice(0, 100)}`
      })))
    }
    
    return {
      high_risk_regions: riskyRegions.filter(r => r.risk_score > 0.8),
      medium_risk_regions: riskyRegions.filter(r => r.risk_score > 0.6 && r.risk_score <= 0.8),
      co_change_groups: await this.findCoChangeGroups(cpgData)
    }
  }
  
  async findCoChangeGroups(cpgData: any): Promise<CoChangeGroup[]> {
    // Analyze git history for files that change together
    const gitHistory = await this.fetchGitHistory()
    
    // Build co-occurrence matrix
    const coMatrix = new Map<string, Map<string, number>>()
    for (const commit of gitHistory) {
      for (const file1 of commit.files) {
        for (const file2 of commit.files) {
          if (file1 !== file2) {
            if (!coMatrix.has(file1)) coMatrix.set(file1, new Map())
            const count = coMatrix.get(file1)!.get(file2) || 0
            coMatrix.get(file1)!.set(file2, count + 1)
          }
        }
      }
    }
    
    // Find strongly connected groups (co-change > 5 times)
    const groups: CoChangeGroup[] = []
    for (const [file1, partners] of coMatrix) {
      const strongPartners = Array.from(partners)
        .filter(([_, count]) => count >= 5)
        .map(([file, count]) => ({ file, count }))
      
      if (strongPartners.length > 0) {
        groups.push({
          anchor: file1,
          related: strongPartners,
          recommendation: "When modifying this file, consider updating related files"
        })
      }
    }
    
    return groups
  }
}
```

#### 2.2: Task Generator

**File**: `repos/metabob-rpc-api/src/services/task-generator.ts`

```typescript
export class TaskGenerator {
  private predictionEngine: PredictionEngine
  
  async generateTasks(orgId: string, projectId: string): Promise<TaskPrediction[]> {
    const analysis = await this.predictionEngine.analyzeCPG(orgId, projectId)
    const tasks: TaskPrediction[] = []
    
    // Generate refactor tasks for high-risk regions
    for (const region of analysis.high_risk_regions) {
      tasks.push({
        org_id: orgId,
        project_id: projectId,
        agent_name: this.selectAgent(region.file), // Route based on codebase
        task_description: `Refactor ${region.file}::${region.component} (high failure risk)`,
        task_type: 'refactor',
        priority: 9,
        failure_risk: region.risk_score,
        suggested_activity: 'refactor-with-tests',
        context_hints: await this.findRelevantImpulses(region),
        cpg_regions: [region],
        reason: region.reason,
        status: 'pending'
      })
    }
    
    // Generate co-change sync tasks
    for (const group of analysis.co_change_groups) {
      if (group.related.length >= 3) {
        tasks.push({
          task_description: `Sync related components: ${group.anchor} and ${group.related.length} others`,
          task_type: 'feature',
          priority: 6,
          suggested_activity: 'sync-related-components',
          context_hints: [group.anchor, ...group.related.map(r => r.file)],
          reason: group.recommendation
        })
      }
    }
    
    // Store tasks in database
    await db.task_predictions.insertMany(tasks)
    
    return tasks
  }
  
  async generateBoredomTask(agentName: string): Promise<TaskPrediction> {
    // Find low-risk improvement opportunities
    const technicalDebt = await this.findTechnicalDebt(agentName)
    
    return {
      agent_name: agentName,
      task_description: technicalDebt.description,
      task_type: 'experiment',
      priority: 3,
      failure_risk: 0.4,
      suggested_activity: technicalDebt.activity,
      is_experiment: true,
      ok_to_fail: true,
      purpose: 'Learning and continuous improvement'
    }
  }
}
```

### Task 3: Activity Grading System

**Priority**: HIGH
**Estimated**: 1 day

**File**: `repos/metabob-opencode/packages/opencode/src/session/activity-grader.ts`

```typescript
export namespace ActivityGrader {
  export interface GradingCriteria {
    task_completion: boolean        // Did it finish all tasks?
    quality_delta: number           // Issues fixed - issues introduced
    cost_efficiency: number         // Cost per line of code
    context_efficiency: number      // Relevant impulses / total loaded
    llm_reduction: number           // Attempts vs historical average
    expected_to_fail: boolean       // Is this an experiment?
  }
  
  export function gradeActivity(
    outcome: ActivityOutcome,
    criteria: GradingCriteria
  ): { grade: 'A' | 'B' | 'C' | 'D' | 'F', score: number, feedback: string } {
    
    // If expected to fail, grade on learning value
    if (criteria.expected_to_fail) {
      return gradeExperiment(outcome)
    }
    
    let score = 0
    const feedback: string[] = []
    
    // Task completion (30 points)
    if (criteria.task_completion) {
      score += 30
      feedback.push("✓ Completed all tasks")
    } else {
      feedback.push("✗ Did not complete all tasks")
    }
    
    // Quality delta (25 points)
    if (criteria.quality_delta > 5) {
      score += 25
      feedback.push(`✓ Fixed ${criteria.quality_delta} net issues`)
    } else if (criteria.quality_delta > 0) {
      score += 15
      feedback.push(`△ Fixed ${criteria.quality_delta} issues`)
    } else if (criteria.quality_delta < 0) {
      feedback.push(`✗ Introduced ${Math.abs(criteria.quality_delta)} issues`)
    }
    
    // Cost efficiency (20 points)
    if (criteria.cost_efficiency < 0.01) { // < $0.01 per line
      score += 20
      feedback.push("✓ Highly cost-efficient")
    } else if (criteria.cost_efficiency < 0.05) {
      score += 10
      feedback.push("△ Acceptable cost")
    } else {
      feedback.push(`✗ Expensive: $${criteria.cost_efficiency.toFixed(3)}/line`)
    }
    
    // Context efficiency (15 points)
    if (criteria.context_efficiency > 0.7) {
      score += 15
      feedback.push("✓ High context relevance")
    } else if (criteria.context_efficiency > 0.4) {
      score += 8
      feedback.push("△ Moderate context relevance")
    } else {
      feedback.push(`✗ Low context relevance: ${(criteria.context_efficiency * 100).toFixed(0)}%`)
    }
    
    // LLM reduction (10 points)
    if (criteria.llm_reduction < 0.8) { // 20% fewer attempts
      score += 10
      feedback.push("✓ Improved efficiency vs baseline")
    } else if (criteria.llm_reduction <= 1.2) {
      score += 5
      feedback.push("△ Similar to baseline")
    } else {
      feedback.push(`✗ More attempts than baseline: ${(criteria.llm_reduction * 100).toFixed(0)}%`)
    }
    
    // Determine grade
    let grade: 'A' | 'B' | 'C' | 'D' | 'F'
    if (score >= 85) grade = 'A'
    else if (score >= 70) grade = 'B'
    else if (score >= 55) grade = 'C'
    else if (score >= 40) grade = 'D'
    else grade = 'F'
    
    return { grade, score, feedback: feedback.join('\n') }
  }
  
  function gradeExperiment(outcome: ActivityOutcome): GradeResult {
    // For experiments, success is learning something useful
    const learningValue = assessLearningValue(outcome)
    
    if (learningValue.useful_insight) {
      return {
        grade: outcome.success ? 'A' : 'B',
        score: 80,
        feedback: `Experiment produced useful insight: ${learningValue.insight}`
      }
    } else {
      return {
        grade: 'C',
        score: 60,
        feedback: "Experiment completed but limited learning value"
      }
    }
  }
}
```

### Task 4: Context Relevance Learning

**Priority**: MEDIUM
**Estimated**: 2 days

**File**: `repos/metabob-opencode/packages/opencode/src/session/context-relevance-learner.ts`

```typescript
export class ContextRelevanceLearner {
  async analyzeOutcome(
    activityId: string,
    outcome: ActivityOutcome
  ): Promise<RelevanceFeedback> {
    
    // 1. Get impulses that were loaded
    const activity = await Activity.load(activityId)
    const loadedImpulses = Object.keys(activity.impulses)
    
    // 2. Parse agent response for impulse citations
    const citedImpulses = this.extractCitations(outcome.agent_decisions)
    
    // 3. Calculate relevance scores
    const relevanceScores = {}
    for (const impulseId of loadedImpulses) {
      const citationCount = citedImpulses.filter(c => c === impulseId).length
      relevanceScores[impulseId] = citationCount > 0 ? (citationCount / loadedImpulses.length) : 0
    }
    
    // 4. Update global relevance database
    for (const [impulseId, score] of Object.entries(relevanceScores)) {
      await db.context_relevance.upsert({
        where: {
          impulse_id: impulseId,
          task_type: outcome.task_type,
          template_id: outcome.templateId
        },
        update: {
          relevance: (existing.relevance * existing.usage_count + score) / (existing.usage_count + 1),
          usage_count: existing.usage_count + 1,
          success_count: existing.success_count + (outcome.success ? 1 : 0),
          last_used: new Date()
        },
        create: {
          impulse_id: impulseId,
          task_type: outcome.task_type,
          template_id: outcome.templateId,
          relevance: score,
          usage_count: 1,
          success_count: outcome.success ? 1 : 0,
          last_used: new Date()
        }
      })
    }
    
    // 5. Generate budget recommendations
    return this.generateBudgetRecommendations(relevanceScores)
  }
  
  private extractCitations(decisions: AgentDecision[]): string[] {
    const citations: string[] = []
    
    for (const decision of decisions) {
      // Parse reasoning and context for impulse references
      const matches = decision.reasoning.matchAll(/impulse:(\w+)/g)
      for (const match of matches) {
        citations.push(match[1])
      }
      
      // Also check if impulse content was quoted
      for (const [impulseId, impulse] of Object.entries(activity.impulses)) {
        if (decision.reasoning.includes(impulse.pointer.content?.slice(0, 50))) {
          citations.push(impulseId)
        }
      }
    }
    
    return citations
  }
  
  private generateBudgetRecommendations(scores: Record<string, number>): BudgetRecommendations {
    const recommendations = []
    
    for (const [impulseId, score] of Object.entries(scores)) {
      if (score > 0.8) {
        recommendations.push({
          impulseId,
          action: 'increase_budget',
          reason: `High relevance (${(score * 100).toFixed(0)}%)`,
          new_budget_multiplier: 1.2
        })
      } else if (score < 0.2) {
        recommendations.push({
          impulseId,
          action: 'decrease_budget',
          reason: `Low relevance (${(score * 100).toFixed(0)}%)`,
          new_budget_multiplier: 0.7
        })
      }
    }
    
    return { recommendations }
  }
}
```

### Task 5: Cost Tracking Fix (From Previous Analysis)

**Priority**: HIGH (Blocking visibility)
**Estimated**: 2 hours

**See**: `reports/COST_TRACKING_ISSUE_ANALYSIS.md` for implementation

---

## Testing the Full Cycle

### Step 1: Test Communication Flows

Use `multi-agent-acp-workflow` activity:

```typescript
activity({
  templateId: 'multi-agent-acp-workflow',
  variables: {
    containerName: 'devbob-opencode',
    agentType: 'general',
    contextType: 'codeAnalysis',
    contextDescription: 'CPG analysis results for session-memory.ts',
    taskDescription: 'Analyze high-risk regions in session management',
    expectedOutput: 'List of refactoring recommendations',
    responseImpulseId: 'cpg-analysis-results',
    delegationReason: 'Test Metabob CPG → Task Prediction flow'
  },
  reason: 'Validate that Metabob can analyze itself, generate tasks, and coordinate multi-agent development'
})
```

### Step 2: Test Metrics Collection

```bash
# In devbob-opencode container
curl -X POST http://api-server-dev:8080/api/v1/metrics/activity-outcome \
  -H "Content-Type: application/json" \
  -d '{
    "org_id": "metabob",
    "project_id": "self-improvement",
    "agent_name": "devbob-opencode",
    "activity_outcome": {
      "activityId": "act_123",
      "templateId": "refactor-with-tests",
      "success": false,
      "duration": 45000,
      "cost": 0.234,
      "tokens": {"input": 12000, "output": 3000, "cache": 8000},
      "componentsModified": ["src/session/session-memory.ts"],
      "qualityDelta": {"issuesFixed": 2, "issuesIntroduced": 1},
      "contextImpulses": ["sessionMemoryDocs", "testExamples"],
      "relevanceScores": {"sessionMemoryDocs": 0.8, "testExamples": 0.3}
    }
  }'
```

### Step 3: Test Task Prediction

```bash
# Generate predictions
curl -X POST http://api-server-dev:8080/api/v1/predictions/generate \
  -H "Content-Type: application/json" \
  -d '{"org_id": "metabob", "project_id": "self-improvement"}'

# Get recommendations for an agent
curl http://api-server-dev:8080/api/v1/recommendations?agent=devbob-opencode
```

### Step 4: Test Boredom Tasks

```bash
# Request boredom task when idle
curl http://api-server-dev:8080/api/v1/tasks/boredom?agent=devbob-opencode

# Should return low-priority improvement task
{
  "task": "Add tests to high-risk function: compactContext",
  "activity": "add-comprehensive-tests",
  "is_experiment": true,
  "context_hints": ["contextCompactionDocs", "existingTests"]
}
```

---

## Success Metrics

### Learning System Health
- [ ] 100+ activity outcomes collected
- [ ] Failure patterns identified (>80% accuracy)
- [ ] Task predictions generated (>5 per day)
- [ ] Context relevance scores tracked (all impulses)
- [ ] Activity grades computed (A-F distribution)

### Cost Reduction
- [ ] Baseline: Current avg cost per task
- [ ] Target: 30% reduction through context learning
- [ ] Monitor: Cost trends over 1 week
- [ ] Validate: Quality maintained or improved

### Autonomy
- [ ] Agents claim and execute tasks without user input
- [ ] Boredom tasks keep agents productive during idle time
- [ ] Cross-agent coordination (>3 agents collaborating)
- [ ] Self-improvement cycle completes (Metabob improves Metabob)

### Prediction Accuracy
- [ ] High-risk predictions: 70% accurate
- [ ] Activity recommendations: 60% success rate
- [ ] Context hints: 80% relevance
- [ ] Co-change predictions: 75% accurate

---

## Next Steps: Implementation Order

1. **Immediate** (Today):
   - Fix cost tracking in ACP (2 hours)
   - Test multi-agent communication flow (1 hour)
   - Document current data flows with Metabob annotations (1 hour)

2. **Short Term** (This Week):
   - Implement parameter server metrics endpoints (1 day)
   - Build prediction engine with CPG embeddings (2 days)
   - Create activity grading system (1 day)
   - Test full cycle with 10+ activities (1 day)

3. **Medium Term** (Next Week):
   - Deploy context relevance learning (2 days)
   - Implement boredom task generation (1 day)
   - Build feedback loop for template evolution (2 days)
   - Scale to 100+ executions for learning (ongoing)

The system becomes **self-improving**: more executions → better predictions → better context selection → lower costs → more experiments → faster learning. 🚀
