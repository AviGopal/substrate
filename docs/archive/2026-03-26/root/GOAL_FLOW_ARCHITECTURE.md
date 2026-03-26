# Goal Flow Architecture: User Intent → MiniBob → Execution

This document describes how user goals flow through MiniBob, from initial intent to verified completion, with learning feedback that improves future executions.

## Overview

```
┌──────────────────────────────────────────────────────────────────────────┐
│                           USER GOAL FLOW                                 │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  User Goal      Parse        Recommend       Execute      Verify         │
│     │            │              │               │            │           │
│     ▼            ▼              ▼               ▼            ▼           │
│  "Fix the   → GoalProc  →  Thompson   →  Template   →  Objective   →  Learn
│   auth bug"   .parseGoal   Sampling      or Improv     Verification   Feedback
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
```

## 1. Goal Parsing

**Location:** `repos/minibob/src/goal-processor.ts` → `parseGoal()`

The user's natural language goal is parsed into a structured `Goal` object:

```typescript
interface Goal {
  message: string      // Original user message
  type: "feature" | "bugfix" | "refactor" | "exploration" | "other"
  intent: string       // Parsed intent (currently = message)
  context: Record<string, unknown>  // Variables/files from user
  createdAt: number
}
```

### Type Inference

Keywords in the message determine the goal type:

| Keywords | Goal Type |
|----------|-----------|
| add, create, implement | feature |
| fix, bug, error | bugfix |
| refactor, clean, reorganize | refactor |
| analyze, explore, find | exploration |
| (other) | other |

## 2. Thompson Sampling Recommendations

**Location:** `repos/metabob-activity-api/src/routes/activities.ts` → `/v2/activities/recommend`

The backend recommends activity templates using Thompson Sampling:

```
POST /v2/activities/recommend
{
  "task_description": "Fix the authentication bug",
  "category": "bugfix",
  "context_impulse_ids": ["impulse:trace:prev-001"],
  "limit": 3
}
```

### How Thompson Sampling Works

For each matching template, the backend:

1. **Retrieves performance history** (alpha = successes + 1, beta = failures + 1)
2. **Samples from Beta distribution** → `sample = Beta(alpha, beta).sample()`
3. **Ranks by sample value** → Higher samples = higher probability of selection

This creates an exploration/exploitation balance:
- **New templates** (low alpha+beta) have high variance → explored more
- **Proven templates** (high alpha) have high expected value → exploited
- **Failed templates** (high beta) have low expected value → selected less

## 3. Relevance Assessment

**Location:** `repos/minibob/src/goal-processor.ts` → `assessRelevance()`

Before executing a recommended template, MiniBob checks if it's actually relevant:

```typescript
assessRelevance(goal, recommendation) → score 0.0 to 1.0
```

### Scoring Factors

| Factor | Points |
|--------|--------|
| Type alignment (bugfix → "fix" in template) | +0.3 |
| Keyword overlap | +0.3 × (matched / total) |
| Special patterns (bugfix + "debug") | +0.2 |
| Generic penalty ("generic" in template) | ×0.7 |

### Threshold

- **Score ≥ 0.3:** Execute the template
- **Score < 0.3:** Fall back to improvisation

## 4. Execution Paths

### 4A. Template Execution

**Location:** `repos/minibob/src/activity.ts` → `ActivityExecutor.execute()`

For relevant templates:

```
Template → Tasks → For each task:
                   ├── Load impulse context
                   ├── Expand {{variables}}
                   ├── Call LLM with tools
                   ├── Execute tool calls
                   ├── Validate outputs
                   └── Retry on failure
```

### 4B. Improvisation

**Location:** `repos/minibob/src/improviser.ts` → `GoalImproviser.improvise()`

When no relevant template exists:

```
Goal → LLM step-by-step:
       ├── 1. Reason about next step
       ├── 2. Select tool
       ├── 3. Execute tool
       ├── 4. Record step in trace
       ├── 5. Check if goal achieved
       └── 6. Loop until done/stuck (max 50 steps)
```

Every improvisation step is recorded for template extraction (Ribosome pattern).

## 5. Goal Verification

**Location:** `repos/minibob/src/goal-processor.ts` → `verifyGoalAchievement()`

**Purpose:** Prevent LLM hallucination where activity claims success but did nothing.

### Verification Criteria

| Goal Pattern | Verification |
|--------------|--------------|
| change/modify/edit/update | filesModified.length > 0 |
| create/add/implement | filesModified.length > 0 |
| test | Output contains test execution evidence |
| analyze/explore/find | toolsUsed > 0 |
| (default) | filesModified > 0 OR toolsUsed > 0 |

## 6. Learning Feedback

After execution completes, MiniBob reports back to the backend:

### Execution Trace Storage
```
POST /v2/activities/execution-traces
→ Stores detailed trace with tasks, tool calls, state changes
→ Enables "debugging as activity" pattern
→ Visible in dashboard
```

### Thompson Sampling Update
```
On success: alpha += 1 (template more likely to be selected)
On failure: beta += 1 (template less likely to be selected)
```

### Tool Usage Recording
```
POST /v2/activities/tool-usage
→ Records which tools were used and in what sequence
→ Enables tool sequence pattern learning
```

### Ribosome Template Extraction
```
On successful execution where template.metadata.author !== "ribosome":
  → assembleTemplateFromExecution(execution)
  → Register new template for future Thompson Sampling
  → Enqueue for boredom testing
```

## 7. Related OpenSpec Changes

| Change | Status | Relevance |
|--------|--------|-----------|
| impulse-pointer-mvp | 32/64 | Fixes impulse system for context management |
| fix-thompson-sampling | 0/41 | Fixes Beta distribution sampling (currently deterministic!) |
| multi-source-learning | 7/86 | Adds MCP tool usage, git history, pattern detection |
| observation-hierarchy-foundation | 0/70 | Adds observability for goal execution |

## 8. E2E Testing

**Location:** `e2e/goal-flow-tests.spec.ts`

Test scenarios covering:

1. **Goal Parsing** - Type inference from keywords
2. **Thompson Sampling** - Recommendations include selection metadata
3. **Execution & Learning** - Traces stored, alpha/beta updated
4. **Impulse Context** - Context propagation between executions
5. **Ribosome Extraction** - Templates extracted from successful improvisation
6. **Tool Usage Patterns** - Sequences recorded for learning

### Running Tests

```bash
# Deploy activity-system first
cd helm && helmfile -f activity-system-minimal.yaml.gotmpl sync

# Run E2E tests
bun test e2e/goal-flow-tests.spec.ts
```

## 9. Example Goals for Live Testing

### Simple Goals (template execution)

```typescript
// Bugfix - should find simple-fix template
"Fix the typo in README.md"

// Feature - should find add-endpoint template
"Add a health check endpoint"

// Refactor - should find refactor-db template
"Refactor the database connection to use pooling"
```

### Complex Goals (may improvise)

```typescript
// Specific bugfix - likely improvisation
"Fix the race condition in the session handler that causes intermittent auth failures"

// Complex feature - likely improvisation
"Implement real-time notifications using WebSockets with reconnection handling"
```

### Exploration Goals (no file modifications)

```typescript
// Should use read/grep without modifications
"Analyze the codebase structure and identify potential security vulnerabilities"
```

## 10. Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              USER                                           │
│                                │                                            │
│                     "Fix the auth bug in login.ts"                         │
└───────────────────────────────┬─────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           MINIBOB VESSEL                                    │
│                                                                             │
│  ┌────────────────┐    ┌────────────────┐    ┌────────────────────────┐   │
│  │ GoalProcessor  │───▶│   MCPClient    │───▶│    ActivityExecutor    │   │
│  │                │    │                │    │    or GoalImproviser   │   │
│  │ parseGoal()    │    │ recommend()    │    │                        │   │
│  │ assessRelevance│    │ authenticate() │    │ execute() / improvise()│   │
│  │ verifyGoal()   │    │ reportExec()   │    │                        │   │
│  └────────────────┘    └────────────────┘    └────────────────────────┘   │
│                                                                             │
└───────────────────────────────┬─────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                       METABOB-ACTIVITY-API                                  │
│                                                                             │
│  ┌────────────────┐    ┌────────────────┐    ┌────────────────────────┐   │
│  │ /recommend     │    │ /exec-traces   │    │   Thompson Sampling    │   │
│  │                │    │                │    │                        │   │
│  │ Beta sampling  │    │ Store traces   │    │   alpha/beta updates   │   │
│  │ Rank templates │    │ Learning data  │    │   Pattern detection    │   │
│  └────────────────┘    └────────────────┘    └────────────────────────┘   │
│                                                                             │
└───────────────────────────────┬─────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                            SURREALDB                                        │
│                                                                             │
│   activity_registry ← Templates with alpha/beta                            │
│   activity_execution_traces ← Execution history                            │
│   tool_usage_patterns ← Tool sequence learning                             │
│   impulse_data ← Context pointers                                          │
│   impulse_relevance_metrics ← Learned impulse usefulness                   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Key Principles

1. **Activity-First**: Non-trivial work flows through templates, enabling learning
2. **Thompson Sampling**: Probabilistic selection balances exploration/exploitation
3. **Impulse Context**: Lazy-loaded pointers manage context window efficiently
4. **Objective Verification**: Prevents LLM hallucination of success
5. **Ribosome Pattern**: Successful improvisation → reusable templates
6. **Continuous Learning**: Every execution feeds the learning loop

---

## 11. What's Possible vs Impossible

### POSSIBLE TODAY ✅

| Capability | Component | How to Test |
|------------|-----------|-------------|
| Execute goal via HTTP | MiniBob `/goal` | `curl -X POST http://minibob:3000/goal -d '{"goal":"..."}'` |
| Execute goal via CLI | MiniBob `improvise` | `bun run index.ts improvise "your goal"` |
| Thompson Sampling recommendations | Activity-API | `POST /v2/activities/recommend` |
| Template variant A/B testing | Activity-API | Create two variants, run goals, check metrics |
| Execution trace storage | Activity-API | Query `activity_execution_traces` table |
| Tool usage tracking | Activity-API | Query `tool_usage` table |
| Impulse relevance metrics | Activity-API | Query `impulse_relevance_metrics` table |
| Activity composition graph | Activity-API | Query `activity_composition_graph` table |
| Ribosome template extraction | MiniBob | Check `template.metadata.author === "ribosome"` |
| MCP tool exposure (7 tools) | metabob-mcp | `tools/list` via MCP protocol |
| Multi-tenant RBAC | SurrealDB | All queries filtered by `$auth.org_id` |

### BLOCKED (Needs spec implementation) 🔶

| Capability | Blocker | Spec |
|------------|---------|------|
| Proper exploration/exploitation | Thompson uses expected value not sampling | fix-thompson-sampling |
| Custom impulse resolvers | Resolvers not wired to dispatch | impulse-pointer-mvp |
| Impulse metadata (shape, count) | Field not added to Impulse type | impulse-pointer-mvp |
| process_impulse tool | Not implemented | impulse-pointer-mvp |
| Multi-scale traces (Layer 0-3) | Schema not updated | observation-hierarchy-foundation |
| Circuit breaker | Not implemented | observation-hierarchy-foundation |
| Peer comparison | Not implemented | observation-hierarchy-foundation |

### IMPOSSIBLE (No spec yet) ❌

| Capability | What Would Enable It |
|------------|---------------------|
| MCP session → execution trace | multi-source-learning M1.2 |
| Git commits → execution trace | multi-source-learning M1.3 |
| Analysis-API impulse pointers | multi-source-learning M2 |
| Pattern emergence queries | multi-source-learning M3 |

---

## 12. Related Documentation

- **E2E Testing**: [E2E_TESTING_GOAL_FLOW.md](./E2E_TESTING_GOAL_FLOW.md) - Concrete test cases and variated examples
- **OpenSpec Dependencies**: [OPENSPEC_DEPENDENCY_MAP.md](./OPENSPEC_DEPENDENCY_MAP.md) - Change relationships and blockers
- **Thompson Sampling Fix**: [../openspec/changes/fix-thompson-sampling/design.md](../openspec/changes/fix-thompson-sampling/design.md)
- **Impulse Pointer MVP**: [../openspec/changes/impulse-pointer-mvp/IMPLEMENTATION_SPEC.md](../openspec/changes/impulse-pointer-mvp/IMPLEMENTATION_SPEC.md)
