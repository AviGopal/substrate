# Minibob Architecture Gap Analysis

## Executive Summary

Based on the stated goals and current implementation, there are significant gaps between the **idealized system architecture** (ribosome-style learning system) and the **current implementation** (basic Thompson Sampling with templates).

This document identifies these gaps using your stated idealizations:
- Activities as execution sequences/dataflows (similar to ribosomes)
- Impulses as pointers for learning data relevance
- Learning which activities run in which sequence to achieve goals
- Activity composition graphs with edge weights
- Tool calls tracked like impulses
- Variants created through split/merge/debug cycles

---

## Core Conceptual Framework

### The Ribosome Analogy

**What it means:**
- Activities = ribosomes (execute sequences, transform data)
- Impulses = mRNA/tRNA (carry instructions and data to the right place)
- Tasks = amino acids (building blocks that compose together)
- Activity sequences = protein synthesis (multiple activities compose to achieve goals)
- Variants = mutations (experiment with different sequences)
- Thompson Sampling = natural selection (choose patterns that work)

**Current vs Ideal:**

| Concept | Ideal (Ribosome) | Current Implementation | Gap |
|---------|------------------|------------------------|-----|
| Activity execution | Sequential dataflow where each task receives data from previous | ✅ Implemented via `activityOutput` impulse pointers | GOOD |
| Activity composition | Activities call other activities, forming execution graphs | ⚠️ Supported but not tracked/learned | **MAJOR GAP** |
| Impulse learning | Track which impulses were relevant/irrelevant to success | ❌ Not tracked | **CRITICAL GAP** |
| Tool call tracking | Treat tool calls as impulses for learning vessel requirements | ❌ Not implemented | **CRITICAL GAP** |
| Sequence learning | Learn which activities run in which order for goals | ❌ Not tracked | **CRITICAL GAP** |
| Edge weights | Graph edges weighted by co-execution probability | ❌ Not tracked | **CRITICAL GAP** |
| Variant creation | Split/merge/debug creates new variants automatically | ❌ Manual only | **CRITICAL GAP** |
| Boredom activities | Background variant creation based on metrics | ⚠️ Infrastructure exists, no variant logic | **MAJOR GAP** |

---

## Gap Analysis by Component

### 1. Activity System

#### ✅ What Works
```typescript
// minibob/src/activity.ts - Basic execution works
- Template loading from backend
- Task dependency resolution
- Variable substitution (including impulse refs)
- Nested activity execution (activity tool)
- Thompson Sampling for recommendation
```

#### ❌ What's Missing

**1.1 Activity Composition Graph Tracking**

**Current state:**
- Activities CAN call other activities via the `activity` tool
- Each execution is isolated - no relationship tracking
- No graph structure stored

**What should exist:**
```typescript
// Backend: activity_composition_graph table (MISSING)
interface ActivityCompositionEdge {
  parent_activity_id: string      // The calling activity
  child_activity_id: string        // The called activity
  execution_id: string             // When this happened
  goal_context: string             // What goal triggered this
  success: boolean                 // Did it work?
  execution_count: number          // How many times seen
  weight: number                   // Learned probability (0-1)
  created_at: timestamp
  updated_at: timestamp
}

// Example learning:
// Goal: "Add authentication"
// Execution 1: add-feature-complete → commit-organized-changes (success)
// Execution 2: add-feature-complete → add-comprehensive-tests → commit-organized-changes (success)
// 
// Graph learns: 
//   Edge(add-feature → commit) weight=1.0 (always happens)
//   Edge(add-feature → tests) weight=0.5 (sometimes happens)
//   Edge(tests → commit) weight=1.0 (always follows tests)
```

**Impact:** Cannot learn "add feature usually needs tests then commit" patterns

---

**1.2 Execution Sequence Recording**

**Current state:**
```typescript
// ExecutionRecordSchema - What's tracked
{
  variant_id: string,
  success: boolean,
  duration_ms: number,
  cost: number,
  tokens: { input, output, cache },
  impulses_used?: string[],        // ✅ Listed but not learned from
  component_changes?: string[]     // ✅ Listed but not learned from
}
```

**What's missing:**
```typescript
// Should track: execution_sequences table
interface ExecutionSequence {
  goal_id: string                  // What goal was being achieved
  session_id: string               // Which session
  sequence: Array<{
    activity_id: string
    execution_id: string
    order: number                  // Position in sequence
    trigger_type: "goal" | "nested" | "boredom"
    parent_execution_id?: string   // If nested
  }>
  outcome: "success" | "partial" | "failure"
  total_duration: number
  total_cost: number
  created_at: timestamp
}

// Learning queries:
// "Which sequences successfully achieve goal X?"
// "After activity A fails, which activity B usually fixes it?"
// "What's the typical sequence length for goal category Y?"
```

**Impact:** Cannot learn "for bug fixes, try activity A, then B, then C" patterns

---

**1.3 Variant Creation from Historical Data**

**Current state:**
- Variants are created manually
- `genealogy` field exists but unused
- Boredom system exists but doesn't create variants

**What should exist:**
```typescript
// Boredom activity: "create-variant-from-metrics"
// Triggers when:
// - Activity X has >10 executions
// - Success rate < 80%
// - Common failure pattern detected

interface VariantCreationTask {
  type: "split" | "merge" | "debug"
  source_variant_id: string
  reason: string
  analysis: {
    failure_patterns: string[]
    successful_patterns: string[]
    suggested_modifications: string[]
  }
}

// Example split:
// Original: "add-feature-complete" (70% success)
// Analysis: Fails on multi-file features
// Split into:
//   - "add-feature-single-file" (95% success)
//   - "add-feature-multi-file" (85% success)
// Both get genealogy: { parent: "add-feature-complete", reason: "split_by_file_count" }
```

**Impact:** System cannot self-improve based on failure patterns

---

### 2. Impulse System

#### ✅ What Works
```typescript
// minibob/src/impulse.ts
- Pointer types: memo, file, activityOutput, custom
- Lazy loading with token budgets
- Storage in backend (for cross-execution access)
- Variable substitution in templates
```

#### ❌ What's Missing

**2.1 Impulse Relevance Learning**

**Current state:**
```typescript
// ExecutionRecordSchema.impulses_used is recorded but not analyzed
impulses_used?: string[]  // Just a list, no relevance data
```

**What should exist:**
```typescript
// Backend: impulse_relevance_metrics table (MISSING)
interface ImpulseRelevanceMetric {
  impulse_id: string
  activity_variant_id: string
  task_id: string
  
  // Relevance indicators
  times_loaded: number             // How often loaded
  times_execution_succeeded: number // Success when present
  times_execution_failed: number    // Failure when present
  
  // Learned relevance score (Bayesian)
  relevance_score: number          // P(success | impulse present)
  irrelevance_score: number        // P(success | impulse absent)
  
  // Context
  typical_content_size: number     // Average tokens
  typical_pointer_type: string     // Most common type
  
  updated_at: timestamp
}

// Learning:
// If activity X always succeeds WITH impulse A but fails WITHOUT it
//   → relevance_score = high
// If activity X succeeds regardless of impulse B
//   → irrelevance_score = high (can skip loading, save tokens)
```

**Impact:** Cannot optimize token usage or learn which context is actually needed

---

**2.2 Impulse Type Evolution**

**Current state:**
- Fixed pointer types: `memo`, `file`, `activityOutput`, `custom`
- Custom resolvers can be registered but not learned

**What should exist:**
```typescript
// New pointer types based on learning:

type ImpulsePointer = 
  | { type: "memo", content: string }
  | { type: "file", path: string }
  | { type: "activityOutput", activityId: string, taskId?: string }
  | { type: "tool_call_result", toolName: string, executionId: string }  // NEW
  | { type: "component", componentId: string, extractionQuery: string }  // NEW
  | { type: "graph_slice", graphQuery: string }                         // NEW
  | { type: "learned_pattern", patternId: string }                      // NEW
  | { type: "custom", resolver: string, data: Record<string, unknown> }

// Example: tool_call_result impulse
// After running `bash "npm test"`, store output as impulse
// Next task can reference: {{impulse:test-results}}
// Learn: "tasks that read test results usually fix bugs"
```

**Impact:** Cannot treat tool calls as learnable data sources

---

**2.3 Impulse Budget Optimization**

**Current state:**
```typescript
// Fixed budgets per impulse
impulse.budget = 5000  // Static, not learned
```

**What should exist:**
```typescript
// Learn optimal budgets based on outcomes
interface ImpulseBudgetMetric {
  impulse_pattern: string          // e.g., "file:*.test.ts"
  activity_variant_id: string
  
  budget_experiments: Array<{
    budget: number
    success_rate: number
    avg_cost: number
  }>
  
  optimal_budget: number           // Learned sweet spot
  min_viable_budget: number        // Minimum for success
}

// Thompson Sampling for budgets:
// Try 1000, 3000, 5000, 10000 token budgets
// Learn which gives best success/cost ratio
```

**Impact:** Waste tokens or miss critical context

---

### 3. Tool System

#### ✅ What Works
```typescript
// minibob/src/tools.ts
- bash, read, write, edit, git tools
- activity tool (nested execution)
- impulse_create tool
- Tool results returned to LLM
```

#### ❌ What's Missing

**3.1 Tool Call Tracking as Impulses**

**Current state:**
- Tool calls happen during LLM execution
- Results returned but not stored
- No learning about which tools are useful

**What should exist:**
```typescript
// Treat every tool call as an impulse creation

// During execution:
executor.onToolCall = async (toolName, params, result) => {
  // Create impulse from tool call
  const impulse = createImpulse({
    id: `tool:${toolName}:${Date.now()}`,
    type: "tool_execution",
    pointer: {
      type: "tool_call_result",
      toolName,
      params,
      result,
      executionId: currentExecutionId
    },
    budget: estimateTokens(result),
  })
  
  // Store in backend with relevance tracking
  await mcp.storeImpulse(impulse)
  
  // Associate with current activity
  currentExecution.impulses_used.push(impulse.id)
}

// Later learning:
// "Activity X always calls bash to run tests"
// "Activity Y never uses git status, but git diff is critical"
// "Tool read is called 10x per execution on average"
```

**Impact:** Cannot learn which tools/vessels are needed for activities

---

**3.2 Vessel Requirement Learning**

**Current state:**
```typescript
// Activities don't declare tool dependencies
// No way to know if activity needs specific MCP servers
```

**What should exist:**
```typescript
// Activity template with learned requirements
interface ActivityTemplate {
  // ... existing fields
  
  learned_requirements: {
    tools: Array<{
      name: string
      usage_probability: number    // 0-1, learned
      avg_calls_per_execution: number
    }>
    
    vessels: Array<{
      vessel_type: string           // e.g., "metabob-mcp"
      capabilities: string[]        // e.g., ["search_codebase_issues"]
      required: boolean             // Learned: always needed vs optional
    }>
    
    impulse_patterns: Array<{
      pattern: string               // e.g., "file:src/**/*.ts"
      typical_count: number
      typical_total_tokens: number
    }>
  }
}

// Use for:
// 1. Pre-flight checks: "Do we have the tools needed?"
// 2. Resource allocation: "This activity needs metabob MCP"
// 3. Cost estimation: "This typically uses 50k tokens"
```

**Impact:** Cannot predict resource needs or validate environment

---

### 4. Goal Processing

#### ✅ What Works
```typescript
// minibob/src/goal-processor.ts
- Parse goal into type and intent
- Loop: recommend → execute → check completion
- MetabobCLI.recommendActivities() uses Thompson Sampling
```

#### ❌ What's Missing

**4.1 Goal → Activity Sequence Learning**

**Current state:**
```typescript
// recommendActivities returns templates for SINGLE STEP
// No multi-step planning
// No sequence learning

recommendations = await backend.recommend(goal)
// Returns: [template1, template2, template3]
// Picks: template1
// Execute, check completion, repeat
```

**What should exist:**
```typescript
// Backend: goal_execution_paths table (MISSING)
interface GoalExecutionPath {
  goal_signature: string           // Normalized goal pattern
  goal_category: string
  
  successful_sequences: Array<{
    sequence: string[]             // [activity_id1, activity_id2, ...]
    success_count: number
    avg_duration: number
    avg_cost: number
  }>
  
  failed_sequences: Array<{
    sequence: string[]
    failure_count: number
    typical_failure_point: number  // Which step fails
  }>
  
  optimal_sequence: string[]       // Most reliable path
  thompson_params: {
    alpha: number,
    beta: number
  }[]                              // Per-step sampling
}

// Multi-step planning:
goal = "Add authentication to API"
paths = await backend.getGoalPaths(goal)
// Returns: 
// Path 1: [add-feature, add-tests, commit] (80% success, 3 min, $0.50)
// Path 2: [add-feature, commit] (60% success, 2 min, $0.30)
// Path 3: [scaffold, implement, test, commit] (90% success, 5 min, $0.80)

// Thompson Sample among paths, not just first step
```

**Impact:** Every goal execution is trial-and-error instead of learned planning

---

**4.2 Goal Completion Learning**

**Current state:**
```typescript
// GoalProcessor.isGoalComplete() - Basic heuristics
isGoalComplete(executions): { complete: boolean, reason: string } {
  if (executions.length === 0) return { complete: false, reason: "No executions" }
  const lastExec = executions[executions.length - 1]
  if (lastExec.status === "failed") return { complete: false, reason: "Last failed" }
  return { complete: true, reason: "Last succeeded" }  // NAIVE
}
```

**What should exist:**
```typescript
// Learn goal completion patterns
interface GoalCompletionPattern {
  goal_category: string
  
  completion_indicators: Array<{
    indicator_type: "file_created" | "test_passed" | "commit_made" | "tool_success"
    indicator_value: string
    reliability: number            // How often indicates true completion
  }>
  
  false_completion_patterns: Array<{
    pattern: string                // What looked complete but wasn't
    actual_outcome: string
  }>
}

// Better completion check:
isGoalComplete(goal, executions): CompletionAnalysis {
  // Check learned indicators
  const indicators = await backend.getCompletionIndicators(goal.type)
  
  // Verify multiple signals
  const checks = [
    hasExpectedFiles(goal, executions),
    testsPass(executions),
    commitMade(executions),
    noFailures(executions),
    meetsCustomIndicators(indicators, executions)
  ]
  
  // Weighted decision based on learned reliability
  return computeCompletion(checks, indicators)
}
```

**Impact:** Goals marked complete prematurely or run too long

---

### 5. Boredom System

#### ✅ What Works
```typescript
// minibob/src/boredom.ts
- Poll backend for tasks when idle
- Execute boredom activities
- Report results
```

#### ❌ What's Missing

**5.1 Variant Creation Tasks**

**Current state:**
```typescript
// Backend /boredom-tasks endpoint returns empty
// No automatic variant creation
```

**What should exist:**
```typescript
// Boredom task types:
type BoredomTaskType = 
  | "create_variant_split"        // Split underperforming activity
  | "create_variant_merge"        // Merge similar activities
  | "create_variant_debug"        // Debug failing activity
  | "optimize_impulse_budgets"    // A/B test impulse budgets
  | "prune_irrelevant_impulses"   // Remove unused impulses
  | "discover_tool_patterns"      // Analyze tool usage
  | "build_composition_graph"     // Strengthen graph edges

// Backend generates these based on metrics:
async function generateBoredomTasks(): BoredomTask[] {
  const tasks = []
  
  // Find underperforming activities
  const poor = await db.query(`
    SELECT * FROM variant_performance_metrics
    WHERE total_executions > 10 
    AND success_rate < 0.8
    ORDER BY total_executions DESC
    LIMIT 5
  `)
  
  for (const variant of poor) {
    tasks.push({
      id: `split-${variant.variant_id}`,
      templateId: "create-variant-split",
      priority: "high",
      variables: {
        source_variant_id: variant.variant_id,
        failure_patterns: await analyzeFailures(variant.variant_id)
      },
      reason: `Improve ${variant.variant_name} (${variant.success_rate}% success)`
    })
  }
  
  // Find similar activities to merge
  // Find stale impulses to prune
  // etc.
  
  return tasks
}
```

**Impact:** No autonomous self-improvement

---

**5.2 Preemptive Execution**

**Current state:**
- Boredom runs when idle
- All execution is reactive to goals

**What should exist:**
```typescript
// Preemptive activity execution based on predictions

interface PreemptiveExecution {
  predicted_goal: string           // "User likely to ask for feature X"
  confidence: number               // Based on context/history
  candidate_activities: string[]   // Activities that might help
  
  // Execute speculatively
  // If prediction correct: instant response
  // If prediction wrong: use as learning data
}

// Example:
// User has been fixing bugs in auth.ts
// Predict: "User will add tests"
// Preemptively: Load test file impulses, prepare test template
// When user asks: "Add tests" → instant execution (context pre-loaded)
```

**Impact:** No predictive optimization

---

## Critical Missing Infrastructure

### Database Tables Not Yet Created

```sql
-- Activity composition graph
CREATE TABLE activity_composition_graph (
  id UUID PRIMARY KEY,
  parent_activity_id STRING,
  child_activity_id STRING,
  execution_id STRING,
  goal_context STRING,
  success BOOL,
  execution_count INT,
  weight FLOAT,  -- Learned probability
  created_at DATETIME,
  updated_at DATETIME
);

-- Execution sequences
CREATE TABLE execution_sequences (
  id UUID PRIMARY KEY,
  goal_id STRING,
  session_id STRING,
  sequence ARRAY<OBJECT>,  -- [{ activity_id, order, trigger_type }]
  outcome STRING,
  total_duration INT,
  total_cost FLOAT,
  created_at DATETIME
);

-- Impulse relevance metrics
CREATE TABLE impulse_relevance_metrics (
  id UUID PRIMARY KEY,
  impulse_id STRING,
  activity_variant_id STRING,
  task_id STRING,
  times_loaded INT,
  times_execution_succeeded INT,
  times_execution_failed INT,
  relevance_score FLOAT,
  irrelevance_score FLOAT,
  updated_at DATETIME
);

-- Goal execution paths
CREATE TABLE goal_execution_paths (
  id UUID PRIMARY KEY,
  goal_signature STRING,
  goal_category STRING,
  successful_sequences ARRAY<OBJECT>,
  failed_sequences ARRAY<OBJECT>,
  optimal_sequence ARRAY<STRING>,
  thompson_alpha FLOAT,
  thompson_beta FLOAT,
  updated_at DATETIME
);

-- Tool usage patterns
CREATE TABLE tool_usage_patterns (
  id UUID PRIMARY KEY,
  activity_variant_id STRING,
  tool_name STRING,
  avg_calls_per_execution FLOAT,
  usage_probability FLOAT,
  typical_params OBJECT,
  success_correlation FLOAT,
  updated_at DATETIME
);
```

---

## Recommended Implementation Roadmap

### Phase 1: Composition Graph Tracking (2-3 weeks)
- [ ] Add `activity_composition_graph` table
- [ ] Track nested activity calls
- [ ] Build graph queries
- [ ] Visualize execution graphs

### Phase 2: Impulse Learning (2-3 weeks)
- [ ] Add `impulse_relevance_metrics` table
- [ ] Track which impulses affect outcomes
- [ ] Implement relevance scoring
- [ ] Auto-prune irrelevant impulses

### Phase 3: Tool Call Tracking (1-2 weeks)
- [ ] Capture all tool calls as impulses
- [ ] Add `tool_usage_patterns` table
- [ ] Learn tool requirements per activity
- [ ] Add vessel requirement checks

### Phase 4: Sequence Learning (3-4 weeks)
- [ ] Add `execution_sequences` table
- [ ] Add `goal_execution_paths` table
- [ ] Implement multi-step planning
- [ ] Thompson Sample on paths, not steps

### Phase 5: Variant Creation (3-4 weeks)
- [ ] Implement split/merge/debug boredom tasks
- [ ] Auto-generate variant creation tasks
- [ ] Track genealogy properly
- [ ] A/B test variants automatically

### Phase 6: Preemptive Execution (2-3 weeks)
- [ ] Build goal prediction model
- [ ] Implement speculative execution
- [ ] Cache results for instant response
- [ ] Learn from prediction accuracy

---

## Conclusion

The current implementation is a **solid foundation** with:
- ✅ Basic activity execution
- ✅ Impulse storage and loading
- ✅ Thompson Sampling for single-step selection
- ✅ Boredom infrastructure

But it's missing the **learning loops** that make it a true "ribosome-style self-optimizing system":
- ❌ No composition graph learning
- ❌ No impulse relevance learning  
- ❌ No tool requirement learning
- ❌ No sequence learning
- ❌ No autonomous variant creation

**The gap is not in the vessel architecture - it's in the learning infrastructure.**

The system can execute activities but cannot yet **learn which activities to compose, which data to load, or how to improve itself based on outcomes**.

Implementing the missing tables and learning loops above would transform minibob from a "template executor" into a true "self-optimizing execution engine."
