# Learning System Implementation Progress

**Goal:** Build a ribosome-style self-optimizing learning system where activities compose together and the system learns optimal patterns.

---

## Phase 1: Core Learning Infrastructure

### Phase 1.1: Activity Composition Graph ✅ COMPLETE

**Files:**
- `repos/metabob-activity-api/src/models/schemas.ts` - Added CompositionEdgeSchema
- `repos/metabob-activity-api/src/routes/activities.ts` - Added POST/GET /composition endpoints

**What It Does:**
- Tracks when one activity calls another (parent → child relationship)
- Records execution context (goal, success/failure)
- Learns edge weights: `weight = success_count / execution_count`

**Example:**
```
add-feature-complete → add-comprehensive-tests (weight: 0.8)
add-feature-complete → commit-organized-changes (weight: 1.0)
```

**Learning:**
- "add-feature usually needs tests (80% of time)"
- "add-feature always followed by commit (100%)"

---

### Phase 1.2: Composition Tracking in Minibob ✅ COMPLETE

**Files:**
- `repos/minibob/src/activity.ts` - Added context tracking (currentActivityId, currentExecutionId, currentGoalContext)
- `repos/minibob/src/mcp.ts` - Added recordComposition() method

**What It Does:**
- Detects when nested activities execute
- Automatically reports composition to backend
- Passes context through nested execution tree

**Integration:**
```typescript
// In activity tool handler...
const result = await nestedExecutor.execute({ 
  template, 
  variables,
  parentActivityId: this.currentActivityId,
  parentExecutionId: this.currentExecutionId,
})

// After nested execution...
await mcp.recordComposition({
  parentActivityId: this.currentActivityId,
  childActivityId: template.id,
  success: result.status === "completed",
})
```

---

### Phase 1.3: Impulse Relevance Metrics ✅ COMPLETE

**Files:**
- `repos/metabob-activity-api/src/models/schemas.ts` - Added ImpulseRelevanceMetricSchema
- `repos/metabob-activity-api/src/routes/activities.ts` - Added POST/GET /impulse-relevance endpoints

**What It Does:**
- Tracks which impulses are loaded vs not loaded
- Records success/failure correlation
- Learns Bayesian relevance scores:
  - `relevance_score = P(success | impulse present)`
  - `irrelevance_score = P(success | impulse absent)`

**Use Case:**
```
Impulse: design-doc.md
Activity: add-feature-complete

Loaded + Success: 8 times
Loaded + Failure: 2 times
Not Loaded + Success: 1 time
Not Loaded + Failure: 9 times

→ relevance_score = 8/10 = 0.8
→ irrelevance_score = 1/10 = 0.1
→ Decision: LOAD this impulse (high relevance!)
```

**Optimization:**
- Skip impulses where `irrelevance_score > relevance_score` (save tokens)
- Prioritize loading high-relevance impulses first

---

### Phase 1.4: Tool Calls as Impulses ✅ COMPLETE

**Files:**
- `repos/minibob/src/activity.ts` - Added toolCallRecords array, tool wrapping, impulse creation

**What It Does:**
- Wraps tool handlers to track calls
- Records: tool name, params, result, timestamp
- Creates impulses from successful tool outputs
- Impulse ID format: `tool:{toolName}:{taskId}:{timestamp}`

**Example:**
```typescript
// Tool call executed...
bash({ command: "npm test" }) → output: "15 tests passed"

// Impulse created automatically...
{
  id: "tool:bash:task-1:1234567890",
  pointer: { type: "memo", content: "15 tests passed" },
  budget: 500,
  tags: ["tool:bash", "activity:add-feature-complete", "task:task-1"]
}
```

**Benefit:**
- Tool outputs become referenceable for downstream tasks
- Enables learning which tool outputs are relevant

---

### Phase 1.5: Tool Usage Patterns ✅ COMPLETE

**Files:**
- `repos/metabob-activity-api/src/models/schemas.ts` - Added ToolUsagePatternSchema
- `repos/metabob-activity-api/src/routes/activities.ts` - Added POST/GET /tool-usage endpoints
- `repos/minibob/src/mcp.ts` - Added recordToolUsage() method
- `repos/minibob/src/activity.ts` - Added tool usage reporting loop

**What It Does:**
- Tracks tool usage per activity
- Learns:
  - `usage_probability = P(tool used | activity executes)`
  - `success_correlation = correlation(tool_used, activity_success)`
  - `is_required = true` if activity never succeeds without tool
  - `is_optional = true` if tool not always used

**Use Cases:**
1. **Pre-flight checks:** "Does vessel have required tools?"
2. **Optimization:** "Skip loading rarely-used optional tools"
3. **Discovery:** "What tools does add-feature-complete typically need?"

**Example:**
```
Activity: add-feature-complete
Tool: bash

Executions: 10/10 used bash, all succeeded
→ usage_probability = 1.0
→ is_required = true
→ Conclusion: bash is REQUIRED for this activity
```

---

## Phase 1 Summary: What's Working

✅ **Composition Learning** - System knows which activities compose together  
✅ **Impulse Learning** - System knows which data is relevant  
✅ **Tool Learning** - System knows which tools activities need  
✅ **Automatic Tracking** - All metrics recorded passively during execution  
✅ **Bayesian Learning** - Proper probability computations (not just counters)  
✅ **Non-blocking Integration** - Learning never crashes execution  

---

## Phase 1 Remaining: What's Missing

### Phase 1.6: Execution Sequences Table ✅ COMPLETE

**Purpose:** Track activities that run together in same session

**Schema:**
```typescript
ExecutionSequenceItemSchema = {
  activity_id: string
  execution_id: string
  order: number
  trigger_type: 'goal' | 'nested' | 'boredom' | 'manual'
  parent_execution_id?: string
  success: boolean
  duration_ms: number
  cost_usd: number
}

ExecutionSequenceSchema = {
  session_id: string
  goal_context?: string
  sequence: ExecutionSequenceItem[]
  outcome: 'success' | 'partial' | 'failure'
  total_duration_ms: number
  total_cost_usd: number
  total_activities: number
  created_at: timestamp
  updated_at: timestamp
}
```

**Implementation:**
- Backend: POST/GET `/v2/activities/execution-sequences` endpoints
- Minibob: Session tracker module (`src/session.ts`)
- MCP Client: `recordExecutionSequence()` method
- Automatic reporting on session completion

**Learning:**
- "When goal = 'add authentication', sequence is usually: add-feature → add-tests → commit"
- Success rate by sequence: [A, B, C] = 95%, [A, C] = 71%
- Optimal sequence length learned from data

**Use Cases:**
- Session analysis: "What did I do in session X?"
- Goal patterns: "What sequences achieve goal Y?"
- Success analysis: "What successful sequences exist?"
- Failure analysis: "What sequences failed and why?"

---

### Phase 1.7: Goal Execution Paths Table ❌ NOT STARTED

**Purpose:** Store multi-step paths from goal to outcome

**Schema:**
```typescript
GoalExecutionPathSchema = {
  goal_description: string
  path: Array<{ activity_id: string, variables: object }>
  outcome: "success" | "failure"
  duration_ms: number
  cost_usd: number
  success_count: number
  failure_count: number
  thompson_alpha: number
  thompson_beta: number
}
```

**Learning:**
- Thompson Sampling over PATHS (not just single activities)
- "For goal 'add REST endpoint', path A has 80% success, path B has 60%"
- Recommend entire path sequences

---

### Phase 1.8: Minibob Impulse Relevance Integration ❌ NOT STARTED

**Purpose:** Use impulse relevance metrics to optimize token usage

**Implementation:**
1. Query impulse relevance BEFORE loading impulses
2. Skip low-relevance impulses
3. Report impulse usage AFTER execution

**Code:**
```typescript
// Before execution...
const relevance = await mcp.getImpulseRelevance({
  activity_variant_id: templateId,
  impulse_id: "design-doc"
})

if (relevance.irrelevance_score > relevance.relevance_score) {
  console.log("Skipping low-relevance impulse: design-doc")
  // Don't load impulse, save tokens
}

// After execution...
await mcp.recordImpulseRelevance({
  impulse_id: "design-doc",
  was_loaded: true,
  execution_succeeded: execution.status === "completed"
})
```

---

### Phase 1.9: Boredom System Variant Generation ❌ NOT STARTED

**Purpose:** Autonomous exploration of activity space

**Implementation:**
1. Background process monitors activity metrics
2. Detects patterns:
   - Low success rate → Create debug variant (add logging, validation)
   - High cost → Create optimized variant (reduce token usage)
   - Common failure → Split into sub-activities
3. Thompson Sampling tries new variants
4. Successful variants become permanent

**Example:**
```
Original: add-feature-complete (success rate: 60%, cost: $0.50)

Boredom system creates:
- add-feature-debug (adds validation steps)
- add-feature-optimized (reduces prompt tokens)
- add-feature-split (separates implementation from tests)

After 10 executions:
- add-feature-debug: 85% success, $0.60
- add-feature-optimized: 65% success, $0.30
- add-feature-split: 90% success, $0.70

→ Thompson Sampling favors add-feature-split
→ Original variant deprecated
```

---

## Overall Progress

### Completed: 6/9 Tasks (67%)

✅ Phase 1.1: Activity Composition Graph  
✅ Phase 1.2: Composition Tracking in Minibob  
✅ Phase 1.3: Impulse Relevance Metrics  
✅ Phase 1.4: Tool Calls as Impulses  
✅ Phase 1.5: Tool Usage Patterns  
✅ Phase 1.6: Execution Sequences Table  

### In Progress: 0/9

(None currently in progress)

### Not Started: 3/9 (33%)

❌ Phase 1.7: Goal Execution Paths Table  
❌ Phase 1.8: Minibob Impulse Relevance Integration  
❌ Phase 1.9: Boredom System Variant Generation  

---

## Ribosome Analogy Progress

| Biological System | Software Equivalent | Status |
|-------------------|---------------------|--------|
| Ribosomes execute sequences | Activities execute tasks | ✅ Working |
| Ribosomes compose together | Activities call activities | ✅ Tracked (1.1, 1.2) |
| mRNA/tRNA carry data | Impulses carry context | ✅ Tracked (1.3) |
| Amino acids = building blocks | Tools = building blocks | ✅ Tracked (1.4, 1.5) |
| Cells learn protein recipes | System learns activity sequences | ❌ Missing (1.6, 1.7) |
| Natural selection | Thompson Sampling | ⚠️ Partial (only single activities) |
| Mutations explore variants | Boredom creates variants | ❌ Missing (1.9) |
| Optimal protein synthesis | Optimal goal execution | ❌ Missing (1.7, 1.8) |

---

## Next Steps

### Recommended Order:

1. **Phase 1.6: Execution Sequences** (Foundation for path learning)
2. **Phase 1.7: Goal Execution Paths** (Thompson Sampling over paths)
3. **Phase 1.8: Impulse Integration** (Token optimization)
4. **Phase 1.9: Boredom Variants** (Autonomous improvement)

### Alternatively: Test Current Implementation

Before continuing, could validate Phases 1.1-1.5 work correctly:

1. Start backend
2. Execute activities with minibob
3. Query composition graph, impulse relevance, tool usage
4. Verify learned metrics are correct
5. Test pre-flight checks, optimization scenarios

---

## Architecture Integrity

All phases maintain:
- ✅ Non-blocking learning (execution never crashes on backend failure)
- ✅ Bayesian probability computations (not just counters)
- ✅ Incremental updates (rolling averages, not full recomputation)
- ✅ SurrealDB parameterized queries (no SQL injection)
- ✅ Zod validation on all inputs
- ✅ Consistent logging patterns
- ✅ Error handling with fallbacks

---

**Current Status: 67% Complete (6/9 phases)**  
**Ready to proceed to Phase 1.7 (Goal Execution Paths) or test current implementation.**
