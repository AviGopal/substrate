# Goal Flow Through MiniBob: Deep Analysis

This document provides exhaustive detail on how user goals flow through MiniBob, including component alignment, gaps, expectations, and testability strategies.

## Executive Summary

MiniBob has **10 distinct goal entry points** with **5 separate execution pathways**, some of which bypass critical learning infrastructure. The system's core learning loop (Thompson Sampling + Impulse Relevance) has **zero test coverage** and contains a critical bug (deterministic sampling instead of probabilistic).

---

## 1. Goal Entry Points - Complete Map

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         MINIBOB ENTRY POINTS                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  CLI                          HTTP                        Programmatic      │
│  ───                          ────                        ────────────      │
│  run <template>               POST /run                   ActivityExecutor  │
│  goal "..."                   POST /goal ⭐ PRIMARY        GoalProcessor     │
│  improvise "..."              POST /goal/search-first     GoalImproviser    │
│  understand <path>            POST /acp                   SearchFirstExec   │
│  diagnose "..."                                           VesselBootstrap   │
│                                                                             │
│  Background                                                                 │
│  ──────────                                                                 │
│  Boredom Loop (every 30s when idle)                                        │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Which Entry Points Use The Learning System?

| Entry Point | GoalProcessor | Thompson Sampling | Impulse Learning | Ribosome |
|-------------|---------------|-------------------|------------------|----------|
| `POST /goal` | ✅ Yes | ✅ Via MCP | ✅ Yes | ✅ Yes |
| CLI `goal` | ✅ Yes | ✅ Via MCP | ✅ Yes | ✅ Yes |
| `POST /run` | ❌ No | ❌ No | ❌ No | ✅ Yes |
| CLI `run` | ❌ No | ❌ No | ❌ No | ✅ Yes |
| `POST /goal/search-first` | ❌ No | ❌ No | ❌ No | ❌ No |
| CLI `improvise` | ❌ No | ❌ No | ❌ No | ✅ Local only |
| Boredom (goal) | ❌ Uses SearchFirst | ❌ Bypassed | ❌ No | ❌ No |
| Boredom (template) | ❌ No | ❌ No | ❌ No | ✅ Yes |

**Critical Finding**: The boredom system—intended for autonomous improvement—bypasses Thompson Sampling entirely.

---

## 2. The Primary Goal Flow: POST /goal

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      COMPLETE GOAL EXECUTION FLOW                           │
│                                                                             │
│  User: "Fix the authentication bug in login.ts"                            │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  STEP 1: GOAL PARSING (GoalProcessor.parseGoal)                            │
│  ──────────────────────────────────────────────                            │
│  Location: repos/minibob/src/goal-processor.ts:105-125                     │
│                                                                             │
│  Input:  "Fix the authentication bug in login.ts"                          │
│  Output: {                                                                  │
│    message: "Fix the authentication bug in login.ts",                      │
│    type: "bugfix",     // Detected via "fix" + "bug" keywords              │
│    intent: <same as message>,                                              │
│    context: {},                                                            │
│    createdAt: 1711378800000                                                │
│  }                                                                          │
│                                                                             │
│  Keyword → Type Mapping:                                                    │
│    "add", "create", "implement" → "feature"                                │
│    "fix", "bug", "error"        → "bugfix"                                 │
│    "refactor", "clean"          → "refactor"                               │
│    (other)                      → "other"                                   │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  STEP 2: THOMPSON SAMPLING RECOMMENDATIONS                                  │
│  ─────────────────────────────────────────────                             │
│  Location: repos/minibob/src/goal-processor.ts:144-181                     │
│  Backend:  repos/metabob-activity-api/src/routes/activities.ts             │
│                                                                             │
│  MiniBob → MCPClient.recommendActivities()                                 │
│         → POST /v2/activities/recommend                                    │
│                                                                             │
│  Request: {                                                                 │
│    task_description: "Fix the authentication bug in login.ts",             │
│    category: "bugfix",                                                     │
│    loaded_impulses: [],                                                    │
│    limit: 3                                                                │
│  }                                                                          │
│                                                                             │
│  Backend Logic (DETERMINISTIC - BUG!):                                     │
│  ┌─────────────────────────────────────────────────────────────────┐       │
│  │ For each template matching category:                            │       │
│  │   alpha = metrics.thompson_alpha || 1.0                         │       │
│  │   beta = metrics.thompson_beta || 1.0                           │       │
│  │                                                                  │       │
│  │   sample = alpha / (alpha + beta)  // ⚠️ EXPECTED VALUE, NOT SAMPLE    │
│  │                                                                  │       │
│  │ Sort by sample descending, return top N                         │       │
│  └─────────────────────────────────────────────────────────────────┘       │
│                                                                             │
│  Response: [                                                                │
│    { template_id: "debug-ts-error", selection_metadata: {                  │
│        method: "thompson_sampling", alpha: 15, beta: 3, sample: 0.833      │
│    }},                                                                     │
│    { template_id: "fix-auth-flow", selection_metadata: {                   │
│        method: "thompson_sampling", alpha: 8, beta: 4, sample: 0.667       │
│    }}                                                                      │
│  ]                                                                          │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  STEP 3: RELEVANCE ASSESSMENT                                              │
│  ────────────────────────────────                                          │
│  Location: repos/minibob/src/goal-processor.ts:194-230                     │
│                                                                             │
│  For top recommendation ("debug-ts-error"):                                │
│                                                                             │
│  Scoring:                                                                   │
│  ┌──────────────────────────────────────────────────────────────────┐      │
│  │ Type alignment: "bugfix" matches "debug" pattern     +0.2        │      │
│  │ Keyword overlap: "auth" not in template name         +0.0        │      │
│  │ Type match: template has "error"                     +0.3        │      │
│  │ Generic penalty: not generic                         ×1.0        │      │
│  │ ─────────────────────────────────────────────────────────        │      │
│  │ Total: 0.5                                                       │      │
│  └──────────────────────────────────────────────────────────────────┘      │
│                                                                             │
│  THRESHOLD: 0.3                                                             │
│                                                                             │
│  Decision: 0.5 >= 0.3 → EXECUTE TEMPLATE (not improvise)                   │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  STEP 4: TEMPLATE LOADING                                                  │
│  ────────────────────────────                                              │
│  Location: repos/minibob/src/activity.ts:1415-1438                         │
│                                                                             │
│  loadTemplateFromMCPOrLocal("debug-ts-error")                              │
│                                                                             │
│  Resolution order:                                                          │
│  1. Check if path contains "/" or ".json" → load from filesystem           │
│  2. Try MCP: GET /v2/activities/templates/{id}                             │
│  3. Fallback: Load from templates/{id}.json                                │
│                                                                             │
│  Template structure:                                                        │
│  {                                                                          │
│    id: "debug-ts-error",                                                   │
│    name: "Debug TypeScript Error",                                         │
│    category: "bugfix",                                                     │
│    tasks: [                                                                │
│      { id: "analyze", prompt: { template: "Read {{file}} and analyze" }}, │
│      { id: "fix", prompt: { template: "Fix the identified issue" }}       │
│    ]                                                                       │
│  }                                                                          │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  STEP 5: ACTIVITY EXECUTION                                                │
│  ──────────────────────────────                                            │
│  Location: repos/minibob/src/activity.ts:430-752                           │
│                                                                             │
│  ActivityExecutor.execute({                                                 │
│    template,                                                                │
│    variables: { file: "login.ts" },                                        │
│    impulses: accumulatedImpulses,  // From previous iterations             │
│    reason: "Goal: Fix the authentication bug in login.ts"                  │
│  })                                                                         │
│                                                                             │
│  For each task in template:                                                 │
│  ┌─────────────────────────────────────────────────────────────────┐       │
│  │ 1. Capture inputState (files, env, impulses, variables)         │       │
│  │ 2. Query impulse relevance from backend (if MCP enabled)        │       │
│  │ 3. Filter impulses by learned relevance (threshold 0.5)         │       │
│  │ 4. Load filtered impulses (LOCAL → CUSTOM → BACKEND → FALLBACK) │       │
│  │ 5. Format impulses for context injection                        │       │
│  │ 6. Build prompt with {{variable}} substitution                  │       │
│  │ 7. Call LLM with tools (bash, read, write, edit, git, etc.)     │       │
│  │ 8. Execute tool calls returned by LLM                           │       │
│  │ 9. Create impulses from tool outputs                            │       │
│  │ 10. Capture outputState (files modified/created/deleted)        │       │
│  │ 11. Run validation (required files, patterns, commands)         │       │
│  │ 12. Record impulse relevance (wasLoaded, executionSucceeded)    │       │
│  │ 13. Retry on failure (if retry policy configured)               │       │
│  └─────────────────────────────────────────────────────────────────┘       │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  STEP 6: GOAL VERIFICATION                                                 │
│  ─────────────────────────────                                             │
│  Location: repos/minibob/src/goal-processor.ts:283-348                     │
│                                                                             │
│  verifyGoalAchievement(goal, executions)                                   │
│                                                                             │
│  Objective criteria (prevents LLM hallucination):                          │
│  ┌─────────────────────────────────────────────────────────────────┐       │
│  │ Goal pattern          Verification                              │       │
│  │ ─────────────         ────────────                              │       │
│  │ change/modify/edit    filesModified.length > 0                  │       │
│  │ create/add/implement  filesModified.length > 0                  │       │
│  │ test                  Output contains "test" evidence           │       │
│  │ analyze/explore       toolsUsed > 0                             │       │
│  │ (default)             filesModified > 0 OR toolsUsed > 0        │       │
│  └─────────────────────────────────────────────────────────────────┘       │
│                                                                             │
│  Result: { verified: true, reason: "Verified: 2 file(s) modified" }        │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  STEP 7: LEARNING FEEDBACK                                                 │
│  ─────────────────────────────                                             │
│  Location: repos/minibob/src/activity.ts:625-733                           │
│                                                                             │
│  7a. Report Execution Metrics                                               │
│      MCPClient.reportExecution(execution)                                   │
│      → POST /v2/activities/executions                                      │
│      → Updates Thompson α/β: success → α+1, failure → β+1                  │
│                                                                             │
│  7b. Store Full Execution Trace                                             │
│      MCPClient.storeExecutionTrace(execution)                              │
│      → POST /v2/activities/execution-traces                                │
│      → Stores tasks, tool calls, state transitions                         │
│                                                                             │
│  7c. Record Tool Usage Patterns                                             │
│      For each tool call:                                                    │
│      MCPClient.recordToolUsage({toolName, executionId, ...})               │
│      → POST /v2/activities/tool-usage                                      │
│                                                                             │
│  7d. Ribosome Template Extraction (on success)                              │
│      IF execution.status === "completed" AND                                │
│         template.metadata?.author !== "ribosome":                          │
│                                                                             │
│      extractedTemplate = assembleTemplateFromExecution(execution)          │
│      → Creates new template with actual prompts that worked                │
│      → Registers with backend for future Thompson Sampling                 │
│      → Enqueues for boredom testing                                        │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  STEP 8: CONTEXT PROPAGATION                                               │
│  ────────────────────────────────                                          │
│  Location: repos/minibob/src/goal-processor.ts:353-410, 593-595            │
│                                                                             │
│  createImpulsesFromExecution(execution)                                    │
│  → impulse:trace:{executionId}     (activityExecutionTrace, 4000 tokens)   │
│  → impulse:output:{executionId}:*  (activityOutput per task, 2000 tokens)  │
│  → impulse:file:{executionId}:*    (file for modified files, 3000 tokens)  │
│                                                                             │
│  These impulses are accumulated and passed to the NEXT activity iteration  │
│  if goal is not yet complete.                                              │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  STEP 9: ITERATION LOOP                                                    │
│  ───────────────────────────                                               │
│  Location: repos/minibob/src/goal-processor.ts:452-637                     │
│                                                                             │
│  Loop continues until:                                                      │
│  - Goal verified complete                                                   │
│  - Max activities reached (default: 5)                                     │
│  - Max cost exceeded (default: $10)                                        │
│  - No recommendations returned                                              │
│                                                                             │
│  Each iteration:                                                            │
│  - Gets fresh Thompson Sampling recommendations                            │
│  - Includes accumulated impulses from previous executions                  │
│  - Assesses relevance and decides template vs improvisation                │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Component Alignment Analysis

### What Aligns Well

| Components | Alignment | Evidence |
|------------|-----------|----------|
| GoalProcessor ↔ MCPClient | ✅ Strong | Clear request/response contracts, consistent field names |
| ActivityExecutor ↔ Types | ✅ Strong | ExecutedTask matches execution trace schema |
| Impulse Creation ↔ Resolution | ✅ Strong | Pointer types consistent, LOCAL/BACKEND dispatch works |
| State Capture ↔ Storage | ✅ Strong | inputState/outputState/stateTransition captured and stored |
| Ribosome ↔ Templates | ✅ Strong | Extracted templates have same structure as manual ones |

### What Doesn't Align

| Components | Issue | Impact |
|------------|-------|--------|
| Boredom ↔ GoalProcessor | Boredom uses SearchFirstExecutor, bypasses Thompson | Autonomous improvement doesn't use learned templates |
| Thompson Code ↔ Algorithm | Uses expected value `α/(α+β)` not Beta sampling | No exploration, deterministic selection |
| `/goal/search-first` ↔ Learning | No connection to Thompson or relevance learning | Experimental path disconnected |
| Impulse Types ↔ Documentation | Backend can add types, but no discovery mechanism | MiniBob doesn't know what types backend supports |
| Multi-tenant ↔ Testing | RBAC enforced in code but no tests | Cannot prove isolation works |

---

## 4. What's Possible vs Impossible

### Currently Possible

| Capability | How It Works |
|------------|--------------|
| Goal → Template execution | GoalProcessor.executeGoal() with Thompson recommendations |
| Impulse context injection | LOCAL (file, memo), CUSTOM (registered), BACKEND (MCP) resolution |
| Objective goal verification | verifyGoalAchievement() checks actual file modifications |
| Execution trace storage | Full trace with tool calls, state, captured to backend |
| Template extraction | Ribosome extracts templates from successful executions |
| Impulse relevance learning | Records (wasLoaded, executionSucceeded) per impulse per activity |

### Currently Impossible

| Capability | Blocker |
|------------|---------|
| **Probabilistic template exploration** | Thompson Sampling uses expected value, not actual sampling |
| **Autonomous improvement via boredom** | Boredom bypasses GoalProcessor/Thompson entirely |
| **Verify learning improves over time** | Zero test coverage of Thompson/relevance systems |
| **Prove multi-tenant isolation** | No tests of RBAC PERMISSIONS enforcement |
| **Discover available impulse types** | No backend endpoint to list supported pointer types |
| **Unload impulses mid-execution** | unload() exists but never called |

---

## 5. Expectations vs Reality

### Thompson Sampling

**Expectation**: Probabilistic selection balancing exploration/exploitation
```typescript
// What should happen:
sample = Beta(alpha, beta).sample()  // Random each call
// Templates with same expected value get different samples
// Uncertainty (low α+β) means more variance → more exploration
```

**Reality**: Deterministic selection by success rate
```typescript
// What actually happens:
sample = alpha / (alpha + beta)  // Expected value, always same
// Templates with same success rate always get same score
// No exploration of uncertain templates
```

### Impulse Relevance Learning

**Expectation**: System learns which impulses help specific activities
```
Execute activity with impulse A → SUCCESS → A.relevance increases
Execute activity with impulse A → FAILURE → A.relevance decreases
Next time: filter out low-relevance impulses, save tokens
```

**Reality**: Data recorded but filtering may not be working
- Records written to backend ✅
- `filterImpulsesByRelevance()` exists ✅
- No tests prove filtering decisions improve outcomes ❌
- No tests prove token savings are realized ❌

### Boredom System

**Expectation**: Autonomous improvement when idle
```
Idle > 60s → Fetch boredom tasks → Execute with learning → Improve templates
```

**Reality**: Bypasses the learning system
```
Idle > 60s → Fetch boredom tasks → SearchFirstExecutor (no Thompson) → No α/β updates
```

---

## 6. How to Prove What Works

### Test Strategy: Three Levels

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           E2E TESTS (10%)                                   │
│  - Full goal→execution→learning→improvement cycle                          │
│  - Multi-tenant isolation                                                   │
│  - Real Kubernetes deployment                                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                      INTEGRATION TESTS (30%)                                │
│  - API endpoints (Thompson, impulses, traces)                              │
│  - Database schema & RBAC queries                                          │
│  - Auth flows (JWT, sessions)                                              │
│  - Composition graph recording                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                         UNIT TESTS (60%)                                    │
│  - Thompson Sampling math (α/β updates)                                    │
│  - Impulse relevance scoring                                               │
│  - Goal parsing                                                             │
│  - Relevance assessment                                                     │
│  - Template filtering                                                       │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Critical Tests Needed

#### 1. Prove Thompson Sampling Works

```typescript
// Unit: Verify α/β update math
test("Thompson α/β updates on execution", () => {
  const metrics = { thompson_alpha: 1, thompson_beta: 1 };

  // Success
  updateThompson(metrics, true);
  expect(metrics.thompson_alpha).toBe(2);
  expect(metrics.thompson_beta).toBe(1);

  // Failure
  updateThompson(metrics, false);
  expect(metrics.thompson_alpha).toBe(2);
  expect(metrics.thompson_beta).toBe(2);
});

// Integration: Verify sampling is probabilistic
test("Thompson sampling produces different results", async () => {
  const samples = [];
  for (let i = 0; i < 100; i++) {
    const rec = await api.recommend({ task: "test" });
    samples.push(rec[0].template_id);
  }

  // With proper Beta sampling, should see variation
  const unique = new Set(samples);
  expect(unique.size).toBeGreaterThan(1);  // WILL FAIL with current code
});

// E2E: Verify learning improves selection
test("Better templates selected more often over time", async () => {
  // Create 2 templates, execute good one 10x success, bad one 10x failure
  // Query recommendations 100 times
  // Good template should appear first > 80% of time
});
```

#### 2. Prove Impulse Relevance Learning Works

```typescript
// Unit: Relevance score calculation
test("Impulse relevance increases with successful executions", () => {
  const metric = { loaded_success: 5, loaded_fail: 1, not_loaded_success: 1, not_loaded_fail: 3 };
  const score = calculateRelevance(metric);
  expect(score).toBeGreaterThan(0.7);  // High relevance
});

// Integration: Filtering uses learned scores
test("Low-relevance impulses filtered out", async () => {
  // Record: impulse A loaded→success 10x, impulse B loaded→fail 10x
  const filtered = await filterImpulsesByRelevance(['A', 'B']);
  expect(filtered.toLoad).toContain('A');
  expect(filtered.toSkip).toContain('B');
});

// E2E: Token savings realized
test("Token usage decreases as relevance learning happens", async () => {
  const execution1 = await executeGoal("Fix bug", { impulses: ['A', 'B', 'C'] });
  // Record relevance...
  const execution2 = await executeGoal("Fix bug", { impulses: ['A', 'B', 'C'] });

  // Second execution should use fewer tokens (filtered impulses)
  expect(execution2.tokens.input).toBeLessThan(execution1.tokens.input);
});
```

#### 3. Prove Goal Flow Works End-to-End

```typescript
test("Complete goal→execution→learning→improvement cycle", async () => {
  // 1. Submit goal
  const result1 = await minibob.executeGoal("Add health endpoint");
  expect(result1.completed).toBe(true);

  // 2. Verify trace stored
  const traces = await api.getExecutionTraces({ limit: 1 });
  expect(traces[0].execution_id).toBe(result1.executions[0].id);

  // 3. Verify Thompson updated
  const metrics = await api.getTemplateMetrics(result1.executions[0].templateId);
  expect(metrics.thompson_alpha).toBeGreaterThan(1);

  // 4. Verify ribosome extracted template
  const templates = await api.listTemplates({ author: "ribosome" });
  expect(templates.some(t => t.sourceExecutionId === result1.executions[0].id)).toBe(true);

  // 5. Submit similar goal - should use learned template
  const result2 = await minibob.executeGoal("Add status endpoint");
  expect(result2.executions[0].templateId).toContain("learned");
});
```

#### 4. Prove Multi-Tenant Isolation

```typescript
test("RBAC prevents cross-org data access", async () => {
  const org1Token = await getJWT({ org_id: "org-1" });
  const org2Token = await getJWT({ org_id: "org-2" });

  // Create template in org-1
  await api.createTemplate({ name: "secret" }, org1Token);

  // Query from org-2 should NOT see it
  const templates = await api.listTemplates(org2Token);
  expect(templates.map(t => t.name)).not.toContain("secret");
});
```

---

## 7. Current Test Coverage

| Feature | Unit | Integration | E2E |
|---------|------|-------------|-----|
| Goal Parsing | ✅ Mocked | ❌ None | ❌ None |
| Thompson Sampling | ❌ None | ❌ None | ❌ None |
| Impulse Creation | ✅ Basic | ❌ None | ❌ None |
| Impulse Resolution | ✅ Basic | ❌ None | ❌ None |
| Impulse Relevance | ❌ None | ❌ None | ❌ None |
| Activity Execution | ❌ None | ❌ None | ❌ None |
| Goal Verification | ❌ None | ❌ None | ❌ None |
| Trace Storage | ❌ None | ❌ None | ❌ None |
| Ribosome Extraction | ❌ None | ❌ None | ❌ None |
| Multi-tenant RBAC | ❌ None | ❌ None | ❌ None |
| Boredom System | ❌ None | ❌ None | ❌ None |

---

## 8. Critical Fixes Needed

### Fix 1: Thompson Sampling (fix-thompson-sampling change)

**Current** (repos/metabob-activity-api/src/routes/activities.ts):
```typescript
sample = alpha / (alpha + beta)  // Deterministic expected value
```

**Required**:
```typescript
// Option A: Use actual Beta sampling
import { beta } from '@stdlib/random-base-beta';
sample = beta(alpha, beta);

// Option B: Wilson score interval for small samples
if (alpha + beta < 10) {
  const n = alpha + beta - 2;
  const p = (alpha - 1) / n;
  const z = 1.96;
  sample = (p + z*z/(2*n) - z*Math.sqrt((p*(1-p) + z*z/(4*n))/n)) / (1 + z*z/n);
} else {
  sample = (alpha - 1) / (alpha + beta - 2) + (Math.random() - 0.5) * 0.1;
}
```

### Fix 2: Boredom System Routing

**Current** (repos/minibob/src/boredom.ts):
```typescript
// Goal-based tasks use SearchFirstExecutor
if (task.goal) {
  await searchFirstExecutor.execute(task.goal);  // Bypasses Thompson
}
```

**Required**:
```typescript
// Goal-based tasks should use GoalProcessor
if (task.goal) {
  await goalProcessor.executeGoal(task.goal, {}, {
    maxActivities: 3,
    maxCost: 5.0
  });
}
```

### Fix 3: Impulse Type Discovery

**Add endpoint** to repos/metabob-activity-api/src/routes/impulses.ts:
```typescript
app.get('/v2/impulses/types', async (c) => {
  return c.json({
    local: ['memo', 'file'],
    backend: ['activityExecutionTrace', 'activityTemplate', 'activityMetrics', ...],
    custom: registry.getRegisteredTypes()
  });
});
```

---

## 9. Files Referenced

**MiniBob Core:**
- `repos/minibob/src/goal-processor.ts` (655 lines) - Goal orchestration
- `repos/minibob/src/activity.ts` (1465 lines) - Activity execution
- `repos/minibob/src/impulse.ts` (379 lines) - Impulse lifecycle
- `repos/minibob/src/impulse-filter.ts` (274 lines) - Relevance filtering
- `repos/minibob/src/mcp.ts` (830 lines) - Backend communication
- `repos/minibob/src/improviser.ts` (400+ lines) - Goal improvisation
- `repos/minibob/src/boredom.ts` (350+ lines) - Autonomous background

**Backend API:**
- `repos/metabob-activity-api/src/routes/activities.ts` - Templates, recommend, executions
- `repos/metabob-activity-api/src/routes/impulses.ts` - Impulse CRUD
- `repos/metabob-activity-api/src/routes/execution-traces.ts` - Trace storage
- `repos/metabob-activity-api/src/routes/goal-paths.ts` - Goal path learning

**Database Schemas:**
- `repos/metabob-activity-api/sql/schemas/011-executions.surql` - Execution traces
- `repos/metabob-activity-api/sql/schemas/013-impulse-tool-usage.surql` - Tool patterns
- `repos/metabob-activity-api/sql/schemas/016-fix-created-by-type.surql` - Auth fixes

---

## 10. Recommended Next Steps

### Immediate (Week 1)
1. **Fix Thompson Sampling** - Change expected value to actual Beta sampling
2. **Add Thompson unit tests** - Verify α/β math and probabilistic selection
3. **Add impulse relevance tests** - Verify scoring and filtering

### Short-term (Week 2-3)
4. **Route boredom through GoalProcessor** - Enable learning for autonomous activities
5. **Add E2E learning loop test** - Prove goal→execution→improvement cycle
6. **Add multi-tenant tests** - Verify RBAC isolation

### Medium-term (Month 1)
7. **Add impulse type discovery** - Endpoint to list available pointer types
8. **Add composition graph tests** - Verify activity dependency tracking
9. **Add ribosome tests** - Verify template extraction quality
