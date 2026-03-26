# Minibob System Inspection Summary

**Date:** March 20, 2026  
**Repositories Analyzed:** repos/minibob, repos/metabob-activity-api, repos/metabob-opencode

---

## Executive Summary

Minibob is a **minimal vessel** (~2,000 lines) implementing the activity/impulse/hook/vessel abstraction for AI-driven development. It successfully demonstrates vessel-agnostic execution but **lacks the learning infrastructure** to become a true self-optimizing ribosome-style system.

### Current State: ✅ Solid Foundation

- Activity template execution with task dependencies
- Impulse system with lazy loading and pointers
- Thompson Sampling for activity recommendation
- Backend integration via MCP protocol
- Boredom system infrastructure
- ACP protocol for vessel-to-vessel communication

### Missing: ❌ Learning Loops

- No activity composition graph tracking
- No impulse relevance learning
- No tool call tracking as impulses
- No execution sequence learning
- No autonomous variant creation
- No goal → path learning

---

## Architecture Overview

### What Minibob Is

```
Minibob = Minimal Execution Vessel

Core Loop:
  1. Receive goal (natural language)
  2. Parse into type + intent
  3. Get activity recommendations (Thompson Sampling)
  4. Execute top-ranked activity
  5. Check goal completion
  6. Repeat until complete or limits hit

Data Flow:
  User Goal → GoalProcessor → Backend Recommendation → ActivityExecutor → LLM → Tools → Results
```

### Two Execution Modes

#### 1. Standalone (Direct CLI)
```bash
cd repos/minibob
bun run index.ts run templates/add-feature.json --var featureName="auth"
```

- Self-contained execution
- Direct MCP calls to activity-api
- Can run as HTTP server or CLI
- No external UI integration

#### 2. Integrated (OpenCode Library)
```typescript
import { MinibobIntegration } from "@metabob/minibob"

await MinibobIntegration.initialize(sessionID)
const result = await MinibobIntegration.submitGoal(
  sessionID,
  "Add authentication to the API",
  { files: ["src/api.ts"] },
  { maxActivities: 5, maxCost: 10.0 }
)
```

- Used as NPM library
- OpenCode provides: LLM config, MCP tools, working directory
- Session-scoped executors
- MCP tool pass-through from OpenCode
- Lifecycle hooks (SessionMemoryAgent)

**Key Insight:** Same activity templates work in both modes (vessel-agnostic)

---

## The Ribosome Analogy

Your stated goal is to build a system that works like biological protein synthesis:

| Biology | Minibob System |
|---------|----------------|
| **Ribosome** | Activity template (executes sequences) |
| **mRNA** | Activity template definition (instructions) |
| **tRNA** | Impulses (bring data to the right place) |
| **Amino acids** | Tasks (building blocks) |
| **Protein** | Execution result |
| **Protein folding** | Activity composition (sequences combine) |
| **Mutations** | Variants (experiments with modifications) |
| **Natural selection** | Thompson Sampling (keep what works) |
| **Gene expression regulation** | Impulse relevance (load only what's needed) |
| **Metabolic pathways** | Execution graphs (activities in sequence) |

**Current State:** You have ribosomes that can execute templates.

**Missing:** The feedback loops that enable evolution and optimization.

---

## Flow Analysis

### Typical Minibob Execution (Direct Mode)

```
1. User submits goal
   ↓
2. GoalProcessor.parseGoal(message, context)
   - Extract intent: "add authentication"  
   - Determine type: "feature"
   - Package context variables
   ↓
3. MCPClient.recommendActivities(intent, type, impulses, limit=3)
   ↓
   POST http://api.metabob.local/v2/activities/recommend
   {
     task_description: "add authentication",
     category: "feature",
     loaded_impulse_ids: [],
     limit: 3
   }
   ↓
4. Backend Thompson Sampling
   - Query: SELECT * FROM variant_performance_metrics WHERE category='feature'
   - For each variant: sample ~ Beta(α, β)
   - Rank by sample value
   - Return top 3 templates
   ↓
5. loadTemplateFromMCPOrLocal(template_id)
   - Fetch full template JSON from backend
   - Parse task definitions
   ↓
6. ActivityExecutor.execute(template, variables, reason)
   ↓
   For each task in template.tasks:
     6.1. Resolve dependencies (wait for previous tasks)
     6.2. Substitute variables in prompt ({{variable}}, {{impulse:id}})
     6.3. Load impulses (lazy, respect budgets)
     6.4. Build LLM messages
     6.5. Call LLM (Anthropic/OpenAI)
     6.6. Execute tool calls (bash, read, write, edit, git, activity, impulse_create)
     6.7. Store task output as activityOutput impulse
     6.8. Validate result (optional)
   ↓
7. Execution complete
   ↓
8. MCPClient.reportExecution(variant_id, success, duration, cost, tokens)
   ↓
   POST http://api.metabob.local/v2/activities/executions
   {
     variant_id: "...",
     success: true,
     duration_ms: 45000,
     cost: 0.0234,
     tokens: { input: 5000, output: 1200, cache: 0 }
   }
   ↓
9. Backend updates Thompson parameters
   - ATOMIC: α += 1 (if success), β += 1 (if failure)
   - Update success_rate, avg_duration, avg_cost
   - Invalidate Redis cache
   ↓
10. GoalProcessor.isGoalComplete(executions)
    - Check if last execution succeeded
    - (NAIVE: doesn't verify actual goal achievement)
    ↓
11. If complete: return GoalResult
    If not: goto step 3 (next iteration)
```

### Integrated Mode Differences

When running inside OpenCode via MinibobIntegration:

- Step 1: OpenCode session receives goal
- Step 2: MinibobIntegration.submitGoal() wraps GoalProcessor
- Step 3-8: Same as standalone (minibob library execution)
- Step 6: Tools are OpenCode's MCP tools + minibob's built-in tools
- Step 6: Lifecycle hooks fire (SessionMemoryAgent prepares context)
- Step 6: UI callbacks (onTaskStart, onTaskComplete) log to OpenCode
- Step 9: Same backend learning (shared activity-api)

**Convergence Point:** Both modes use same backend, same templates, same Thompson Sampling

---

## Critical Gaps

### 1. Activity Composition Not Tracked

**What happens:**
- Activity A calls Activity B via `activity` tool
- Both execute successfully
- Individual metrics updated (A's α++, B's α++)

**What's missing:**
- No record that A → B composition occurred
- No graph edge created
- No weight learned for this path
- Next time: system doesn't "know" that A usually needs B

**Database missing:**
```sql
CREATE TABLE activity_composition_graph (
  parent_activity_id STRING,
  child_activity_id STRING,
  execution_count INT,
  weight FLOAT  -- P(B follows A)
);
```

**Impact:** Cannot learn "add feature usually needs tests" patterns

---

### 2. Impulse Relevance Not Learned

**What happens:**
```typescript
// Activity template specifies impulses
template.tasks[0].prompt.template = `
Given these files: {{impulse:source-files}}
And these tests: {{impulse:test-files}}
And architecture: {{impulse:architecture-doc}}
Implement the feature.
`

// All impulses loaded (15,000 tokens)
// Activity succeeds
```

**What's missing:**
- No tracking of which impulses were actually relevant
- No learning that `architecture-doc` is rarely needed
- Next execution: loads all 3 impulses again (wastes tokens)

**Should track:**
```typescript
impulse_relevance_metrics {
  impulse_id: "architecture-doc",
  activity_variant_id: "add-feature-complete",
  times_loaded: 50,
  times_execution_succeeded_with_it: 35,
  times_execution_succeeded_without_it: 30,
  relevance_score: 0.15  // Not actually needed
}
```

**Impact:** Wastes 30-50% of token budget on irrelevant context

---

### 3. Tool Calls Not Tracked as Impulses

**What happens:**
```typescript
// During LLM execution
LLM calls: bash("npm test")
Result: "Tests passed: 42/42"

LLM calls: edit("src/api.ts", ...)
Result: "File edited"

// Results used within this LLM conversation
// Then discarded - no impulse created
```

**What's missing:**
- Next task cannot reference `{{impulse:test-results}}`
- No learning that "bash is always used for testing"
- No vessel requirement tracking (does this activity need bash?)

**Should do:**
```typescript
onToolCall = (toolName, params, result) => {
  // Auto-create impulse
  const impulse = createImpulse({
    id: `tool:${toolName}:${Date.now()}`,
    type: "tool_execution",
    pointer: {
      type: "tool_call_result",
      toolName,
      params,
      result
    }
  })
  
  // Track in execution
  currentExecution.impulses_used.push(impulse.id)
}
```

**Impact:** Cannot learn tool requirements or create data flows

---

### 4. Execution Sequences Not Tracked

**What happens:**
```typescript
// Goal: "Add authentication"
// Iteration 1: Executes add-feature-complete (success)
// Iteration 2: Executes add-tests (success)  
// Iteration 3: Executes commit-organized-changes (success)

// Each recorded individually in activity_executions table
// No record that they were part of the SAME GOAL
// No sequence learned
```

**What's missing:**
```sql
CREATE TABLE execution_sequences (
  goal_id STRING,
  sequence ARRAY<OBJECT>,  -- [{ activity_id, order }]
  outcome STRING,
  total_duration INT,
  total_cost FLOAT
);
```

**Impact:** Every goal execution starts from zero, no path learning

---

### 5. Goal → Path Learning Not Implemented

**Current:**
```typescript
// Each iteration: recommend single activity
for (let i = 0; i < maxActivities; i++) {
  recommendations = await backend.recommend(goal)  // Single step
  execute(recommendations[0])
  if (complete) break
}
```

**Should be:**
```typescript
// Plan entire sequence from learned paths
paths = await backend.getLearnedPaths(goal)
// Returns:
// Path 1: [scaffold, implement, test, commit] (90% success)
// Path 2: [add-feature, test, commit] (80% success)

// Thompson Sample on PATHS, not activities
selectedPath = thompsonSamplePaths(paths)

// Execute entire planned sequence
for (activity of selectedPath.sequence) {
  execute(activity)
}
```

**Impact:** No predictive planning, always trial-and-error

---

### 6. Variant Creation Not Autonomous

**Current:**
- Variants created manually by developers
- `genealogy` field exists but unused
- Boredom system polls for tasks but backend returns empty

**Should be:**
```typescript
// Backend boredom task generation
generateBoredomTasks() {
  // Find underperforming activities
  const poor = await db.query(`
    SELECT * FROM variant_performance_metrics
    WHERE total_executions > 10 AND success_rate < 0.8
  `)
  
  // For each: analyze failures, create split/merge/debug task
  return poor.map(variant => ({
    templateId: "create-variant-split",
    variables: {
      source_variant_id: variant.variant_id,
      failure_patterns: analyzeFailures(variant)
    }
  }))
}
```

**Impact:** No autonomous self-improvement

---

## Backend Learning Infrastructure

### What Exists

```sql
-- ✅ Templates stored
activity_template {
  variant_id,
  activity_id,
  variant_name,
  description,
  category,
  task_steps,
  genealogy  -- EXISTS but unused
}

-- ✅ Thompson Sampling metrics
variant_performance_metrics {
  variant_id,
  total_executions,
  successful_executions,
  success_rate,
  thompson_alpha,
  thompson_beta
}

-- ✅ Individual executions
activity_executions {
  execution_id,
  variant_id,
  success,
  duration_ms,
  cost,
  tokens,
  impulses_used,  -- LIST but not analyzed
  component_changes  -- LIST but not analyzed
}

-- ✅ Impulse storage
impulse_data {
  impulse_id,
  impulse_data,
  api_key,
  project_id
}
```

### What's Missing

```sql
-- ❌ Composition graph
activity_composition_graph {
  parent_activity_id,
  child_activity_id,
  execution_count,
  weight
}

-- ❌ Impulse relevance
impulse_relevance_metrics {
  impulse_id,
  activity_variant_id,
  relevance_score
}

-- ❌ Execution sequences
execution_sequences {
  goal_id,
  sequence,
  outcome
}

-- ❌ Goal paths
goal_execution_paths {
  goal_signature,
  successful_sequences,
  optimal_sequence
}

-- ❌ Tool patterns
tool_usage_patterns {
  activity_variant_id,
  tool_name,
  usage_probability
}
```

---

## Key Differences: Direct vs Integrated

| Aspect | Direct (minibob CLI) | Integrated (OpenCode) |
|--------|----------------------|----------------------|
| **Entry Point** | `bun run index.ts run` | `MinibobIntegration.submitGoal()` |
| **LLM Config** | Environment vars | OpenCode config |
| **Tools Available** | Built-in only | Built-in + OpenCode MCP tools |
| **Impulse Resolution** | Minibob only | Minibob + OpenCode context |
| **UI Feedback** | Console logs | OpenCode TUI + logs |
| **Session Management** | Stateless | Session-scoped executors |
| **Lifecycle Hooks** | None | SessionMemoryAgent |
| **Backend Learning** | ✅ Same (shared API) | ✅ Same (shared API) |
| **Template Registry** | ✅ Same (shared API) | ✅ Same (shared API) |

**Critical Convergence:** Both modes use the same backend (`metabob-activity-api`), so learning from one benefits the other.

---

## Boredom System Status

### Infrastructure: ✅ Complete

```typescript
// minibob/src/boredom.ts
- BoredomTaskExecutor class
- Poll backend every 30s when idle
- Execute boredom activities
- Report results
- Integrated with minibob lifecycle
```

### Logic: ❌ Missing

```typescript
// Backend: GET /boredom-tasks returns empty
// No task generation implemented

// Should generate tasks like:
{
  id: "split-add-feature-20260320",
  templateId: "create-variant-split",
  priority: "high",
  variables: {
    source_variant_id: "add-feature-complete",
    failure_patterns: ["multi-file features fail 60%"]
  },
  reason: "Improve add-feature-complete success rate"
}
```

---

## Recommendations

### Phase 1: Close Learning Loops (Highest Impact)

**Priority 1:** Activity Composition Graph
- Add `activity_composition_graph` table
- Track when activity A calls activity B
- Build graph queries for visualization
- Use graph to suggest next activities

**Priority 2:** Impulse Relevance Learning
- Add `impulse_relevance_metrics` table
- Track which impulses correlate with success
- Auto-optimize budgets
- Skip irrelevant impulses

**Priority 3:** Tool Call Tracking
- Create impulses from all tool calls
- Track tool usage patterns
- Learn vessel requirements
- Enable tool result references in subsequent tasks

### Phase 2: Sequence Learning (Medium Impact)

**Priority 4:** Execution Sequence Tracking
- Add `execution_sequences` table
- Link activities that run together for same goal
- Query common sequences for goal types

**Priority 5:** Goal Path Learning
- Add `goal_execution_paths` table
- Thompson Sample on paths, not individual activities
- Plan multi-step executions upfront

### Phase 3: Autonomous Improvement (Long-term)

**Priority 6:** Boredom Task Generation
- Implement backend task generation
- Create split/merge/debug tasks automatically
- A/B test variants

**Priority 7:** Preemptive Execution
- Predict next likely goal
- Pre-load impulses speculatively
- Execute activities before user asks

---

## Conclusion

**Minibob successfully demonstrates:**
- ✅ Vessel-agnostic execution (same templates in CLI or OpenCode)
- ✅ Activity template system with task dependencies
- ✅ Impulse system with lazy loading
- ✅ Thompson Sampling for activity selection
- ✅ Backend integration and metrics reporting
- ✅ Boredom system infrastructure

**Minibob is missing:**
- ❌ Learning loops that turn execution data into patterns
- ❌ Composition graph tracking
- ❌ Impulse relevance optimization
- ❌ Tool requirement learning
- ❌ Sequence planning
- ❌ Autonomous variant creation

**The gap is not in the architecture - it's in the feedback loops.**

The system can execute activities but cannot yet learn which activities to compose, which data to load, or how to improve itself. Implementing the missing database tables and learning queries would transform it from a "template executor" into a "self-optimizing execution engine."

---

## Files for Further Review

**Key Implementation Files:**
- `repos/minibob/src/goal-processor.ts` - Goal parsing and execution loop
- `repos/minibob/src/activity.ts` - Activity execution engine
- `repos/minibob/src/impulse.ts` - Impulse storage and resolution
- `repos/minibob/src/mcp.ts` - Backend communication
- `repos/minibob/src/boredom.ts` - Boredom task executor

**Backend API:**
- `repos/metabob-activity-api/src/routes/activities.ts` - Template and execution endpoints
- `repos/metabob-activity-api/src/models/schemas.ts` - Data schemas

**OpenCode Integration:**
- `repos/metabob-opencode/packages/opencode/src/minibob-integration/index.ts`

**Documentation:**
- `repos/minibob/README.md` - Minibob overview
- `repos/minibob/ARCHITECTURE.md` - Vessel philosophy
