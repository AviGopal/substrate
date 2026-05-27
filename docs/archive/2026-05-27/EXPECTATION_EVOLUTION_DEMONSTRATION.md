# Expectation Evolution Demonstration

> **Purpose**: Demonstrate how expectations evolve through the learning loop across multiple executions, showing Thompson Sampling parameter evolution, shape-conditioned learning, and template refinement.

---

## Overview

This demonstration shows the **learning loop in action** - how the system progresses from no templates (pure improvisation) to refined, shape-conditioned templates with accurate success predictions. The demonstration tracks Thompson Sampling parameters (α, β), success rates, and expectation adjustments across 5 executions of the same goal.

**Key Learning Mechanisms Demonstrated:**
1. **Thompson Sampling** - Beta distribution parameters evolve from prior (1,1) to evidence-based estimates
2. **Shape-Conditioned Learning** - Success rates vary based on input impulse shapes present
3. **Ribosome Extraction** - Successful improvisations become reusable templates
4. **Variant Competition** - Multiple template variants compete via probabilistic selection
5. **Early Exit Detection** - Behavioral validators enable early completion

---

## Test Scenario Specification

### Goal Definition

```
"Create a TypeScript utility function that validates email addresses with tests"
```

**Why this goal?**
- Concrete, repeatable outcome (deterministic validation)
- Clear behavioral constraint (tests must pass)
- Multiple valid implementations (enables variant creation)
- Measurable success criteria (TypeScript compiles, tests pass)

### Initial State Space

**Available Impulse Shapes:**
```typescript
[
  "goal_context",           // The goal description
  "codebase_structure",     // File tree, existing modules
  "typescript_config",      // tsconfig.json for compilation settings
]
```

**Expected Activity Matches (Execution 1):**
- **None** - No templates match this goal initially
- System will **improvise** with LLM guidance

### Success Criteria

An execution succeeds if:
1. ✅ TypeScript file created (`src/utils/email-validator.ts`)
2. ✅ Test file created (`src/utils/email-validator.test.ts`)
3. ✅ Code compiles without errors (`tsc --noEmit`)
4. ✅ Tests pass (`bun test`)

**Early Exit Validator:**
```typescript
{
  shape: "typescript_compiles",
  validator: "tsc",
  options: { noEmit: true }
}
```

If the validator passes after task 3 (file creation + compilation), the activity can exit early, skipping task 4 (additional polish).

---

## Execution Sequence with Predicted Outcomes

### Execution 1: Pure Improvisation

**State Before:**
- No templates in backend
- Thompson Sampling state: empty
- No shape-conditioned scores

**Expected Flow:**
1. Goal arrives: "Create a TypeScript utility function..."
2. Backend query: `GET /v2/activities/recommend?goal=...&shapes=[goal_context,codebase_structure]`
3. Response: `{ templates: [], improvise: true }`
4. MiniBob improvises using LLM with tools
5. Tasks executed:
   - Task 1: Analyze goal, decide on approach (LLM reasoning)
   - Task 2: Create validator function (file write)
   - Task 3: Create test file (file write)
   - Task 4: Run tests (bash tool: `bun test`)
6. Validation: Tests pass ✅
7. Success recorded

**Trace Captured:**
```typescript
{
  trace_id: "exec_001",
  trace_type: "improvisation",
  goal: "Create a TypeScript utility function...",

  input_impulses: [
    { shape: "goal_context", ... },
    { shape: "codebase_structure", ... }
  ],

  tasks: [
    { id: "t1", resolver: "llm", duration_ms: 2300, ... },
    { id: "t2", resolver: "file_write", duration_ms: 150, ... },
    { id: "t3", resolver: "file_write", duration_ms: 180, ... },
    { id: "t4", resolver: "bash", duration_ms: 1200, ... }
  ],

  output_impulses: [
    { shape: "typescript_source", path: "src/utils/email-validator.ts" },
    { shape: "test_file", path: "src/utils/email-validator.test.ts" }
  ],

  outcome: {
    success: true,
    duration_ms: 3830,
    cost_usd: 0.025
  }
}
```

**Ribosome Extraction:**
Backend analyzes successful trace and creates template:

```typescript
{
  id: "create-typescript-utility:v1",
  name: "Create TypeScript Utility Function",
  category: "feature",

  input_shapes: ["goal_context", "codebase_structure"],
  output_shapes: ["typescript_source", "test_file"],

  tasks: [
    {
      id: "analyze",
      description: "Analyze goal and plan implementation",
      resolver: "llm",
      prompt: { template: "Analyze the goal: {{goal}}...", variables: ["goal"] }
    },
    {
      id: "implement",
      description: "Create utility function",
      resolver: "file_write",
      validation: { requiredPatterns: ["export function"] }
    },
    {
      id: "test",
      description: "Create test file",
      resolver: "file_write",
      validation: { requiredPatterns: ["describe(", "expect("] }
    },
    {
      id: "verify",
      description: "Run tests",
      resolver: "bash",
      command: "bun test"
    }
  ],

  // Thompson Sampling initial state
  thompson: { alpha: 1, beta: 1 }  // Prior only
}
```

**State After Execution 1:**
```typescript
// Backend Thompson state
{
  "create-typescript-utility:v1": {
    alpha: 2,  // 1 prior + 1 success
    beta: 1,   // 1 prior + 0 failures
    expected_rate: 0.667,  // 2/3
    executions: 1
  }
}

// Shape-conditioned scores
{
  activity: "create-typescript-utility:v1",
  input_shape_set: ["goal_context", "codebase_structure"],
  successes: 1,
  failures: 0,
  conditional_alpha: 2,
  conditional_beta: 1
}
```

**Metrics:**
- Success rate: 100% (1/1) - **but high uncertainty** (only 1 execution)
- Expected score: 0.667 (Beta mean with prior)
- Cost: $0.025
- Duration: 3830ms

---

### Execution 2: First Template Reuse

**State Before:**
- 1 template available: `create-typescript-utility:v1`
- Thompson state: α=2, β=1

**Expected Flow:**
1. Goal arrives (same as before)
2. Backend query with shapes
3. **Template match found!**
4. Thompson Sampling: `sample(α=2, β=1)` → likely high score (mean=0.667)
5. Template selected with probability ~85% (vs 15% improvise)
6. MiniBob executes template tasks
7. **Potential early exit after task 3** (if TypeScript compiles + tests pass)

**Two Possible Outcomes:**

#### Outcome A: Success (Probability ~70%)

Template works, but takes longer due to iteration:

```typescript
{
  trace_id: "exec_002",
  trace_type: "template_execution",
  template_id: "create-typescript-utility:v1",

  outcome: {
    success: true,
    duration_ms: 4200,  // Slightly slower
    cost_usd: 0.028,
    early_exit: false
  }
}
```

**Updated Thompson State:**
```typescript
{
  alpha: 3,  // 2 + 1 success
  beta: 1,   // No failures yet
  expected_rate: 0.75,  // 3/4
  executions: 2
}
```

#### Outcome B: Failure (Probability ~30%)

Template fails due to missing TypeScript config:

```typescript
{
  trace_id: "exec_002",
  trace_type: "template_execution",
  template_id: "create-typescript-utility:v1",

  failure_reason: "TypeScript compilation failed - tsconfig.json missing",

  outcome: {
    success: false,
    duration_ms: 2100,
    cost_usd: 0.015
  }
}
```

**Updated Thompson State:**
```typescript
{
  alpha: 2,  // No change
  beta: 2,   // 1 + 1 failure
  expected_rate: 0.50,  // 2/4
  executions: 2
}
```

**Trailblazing - Variant Creation:**

Backend creates variant to handle missing config:

```typescript
{
  id: "create-typescript-utility:v2",
  name: "Create TypeScript Utility Function (with config check)",
  variant_of: { parent: "create-typescript-utility:v1", reason: "missing_tsconfig" },

  input_shapes: ["goal_context", "codebase_structure", "typescript_config"],  // Added!

  tasks: [
    {
      id: "check-config",
      description: "Verify TypeScript configuration exists",
      resolver: "file_read",
      path: "tsconfig.json"
    },
    // ... rest of tasks from v1
  ],

  thompson: { alpha: 1, beta: 1 }  // New variant starts with prior
}
```

**Metrics After Execution 2 (Outcome B assumed):**
- v1: Success rate 50% (1/2), α=2, β=2
- v2: Success rate 50% (0/0 + prior), α=1, β=1

---

### Execution 3: Variant Competition

**State Before:**
- 2 templates: v1 (α=2, β=2), v2 (α=1, β=1)
- Input shapes now include `typescript_config` (filesystem discovered)

**Expected Flow:**
1. Goal arrives
2. Backend query: `shapes=["goal_context", "codebase_structure", "typescript_config"]`
3. Both templates match on shapes, but v2 requires `typescript_config` (better match)
4. Thompson Sampling:
   - v1: `sample(2, 2)` → mean=0.50, high certainty
   - v2: `sample(1, 1)` → mean=0.50, **high variance** (exploration)
5. **v2 selected** (exploration favors uncertain templates)
6. Execution succeeds with config check

```typescript
{
  trace_id: "exec_003",
  template_id: "create-typescript-utility:v2",

  outcome: {
    success: true,
    duration_ms: 3900,
    cost_usd: 0.027,
    early_exit: true  // Config check + compile passed
  }
}
```

**Updated Thompson State:**
```typescript
// v1 unchanged
{ alpha: 2, beta: 2, expected_rate: 0.50, executions: 2 }

// v2 updated
{ alpha: 2, beta: 1, expected_rate: 0.667, executions: 1 }
```

**Shape-Conditioned Learning:**

```typescript
{
  activity: "create-typescript-utility:v2",

  // With typescript_config present
  shape_set_1: {
    shapes: ["goal_context", "codebase_structure", "typescript_config"],
    successes: 1,
    failures: 0,
    conditional_rate: 1.0  // 100% when config present!
  },

  // Without typescript_config (hypothetical from v1 failures)
  shape_set_2: {
    shapes: ["goal_context", "codebase_structure"],
    successes: 1,
    failures: 1,
    conditional_rate: 0.5  // 50% when config missing
  }
}
```

**Key Learning:** System now knows v2 performs better when `typescript_config` is available.

**Metrics:**
- v1: 50% success (1/2)
- v2: 100% success (1/1) - **but still uncertain** (only 1 execution)

---

### Execution 4: Exploitation Begins

**State Before:**
- v1: α=2, β=2 (certain mediocrity)
- v2: α=2, β=1 (uncertain promise)
- Shape-conditioned scores available

**Expected Flow:**
1. Goal arrives with `typescript_config` shape
2. Backend computes shape-conditioned scores:
   - v1 with config: `sample(1, 1)` → mean=0.50 (prior only, no data)
   - v2 with config: `sample(2, 1)` → mean=0.667 (observed success)
3. **v2 selected with ~80% probability** (exploitation)
4. Execution succeeds again

```typescript
{
  trace_id: "exec_004",
  template_id: "create-typescript-utility:v2",

  outcome: {
    success: true,
    duration_ms: 3700,  // Getting faster
    cost_usd: 0.024,
    early_exit: true
  }
}
```

**Updated Thompson State:**
```typescript
// v1 unchanged
{ alpha: 2, beta: 2, expected_rate: 0.50, executions: 2 }

// v2 gaining confidence
{ alpha: 3, beta: 1, expected_rate: 0.75, executions: 2 }
```

**Metrics:**
- v1: 50% (1/2) - **exploitation will avoid this**
- v2: 100% (2/2) - **becoming the preferred choice**

---

### Execution 5: Convergence

**State Before:**
- v1: α=2, β=2
- v2: α=3, β=1

**Expected Flow:**
1. Goal arrives
2. Thompson Sampling:
   - v1: `sample(2, 2)` → mean=0.50, stdev=0.20
   - v2: `sample(3, 1)` → mean=0.75, stdev=0.18
3. **v2 selected with ~95% probability**
4. Execution succeeds

```typescript
{
  trace_id: "exec_005",
  template_id: "create-typescript-utility:v2",

  outcome: {
    success: true,
    duration_ms: 3500,  // Optimized
    cost_usd: 0.022,
    early_exit: true
  }
}
```

**Final Thompson State:**
```typescript
// v1 - avoided
{ alpha: 2, beta: 2, expected_rate: 0.50, executions: 2 }

// v2 - converged
{ alpha: 4, beta: 1, expected_rate: 0.80, executions: 3 }
```

**Metrics:**
- v1: 50% success (1/2) - **will rarely be selected**
- v2: 100% success (3/3) - **dominant template for this goal**
- System learned to prefer v2 when `typescript_config` shape is present

---

## Measurement Plan

### Metrics Tracked Across Executions

| Execution | Template | α | β | Expected Rate | Actual Success | Duration (ms) | Cost ($) | Early Exit |
|-----------|----------|---|---|---------------|----------------|---------------|----------|------------|
| 1 | improvise | 1 | 1 | 0.50 | ✅ | 3830 | 0.025 | ❌ |
| 2 | v1 | 2 | 1 | 0.667 | ❌ | 2100 | 0.015 | ❌ |
| 3 | v2 | 1 | 1 | 0.50 | ✅ | 3900 | 0.027 | ✅ |
| 4 | v2 | 2 | 1 | 0.667 | ✅ | 3700 | 0.024 | ✅ |
| 5 | v2 | 3 | 1 | 0.75 | ✅ | 3500 | 0.022 | ✅ |

**Trends to Observe:**
1. **Thompson parameters stabilize** - α and β increase, variance decreases
2. **Success prediction improves** - expected rate converges to actual rate
3. **Duration decreases** - template execution becomes more efficient
4. **Early exit frequency increases** - validator triggers more reliably
5. **Cost reduces** - fewer LLM calls, more deterministic resolvers

### Shape-Conditioned Learning Metrics

| Shape Set | Template | Successes | Failures | Conditional Rate | Selection Prob |
|-----------|----------|-----------|----------|------------------|----------------|
| `[goal, codebase]` | v1 | 1 | 1 | 0.50 | 20% |
| `[goal, codebase]` | v2 | 0 | 0 | 0.50 (prior) | 30% |
| `[goal, codebase, config]` | v1 | 0 | 0 | 0.50 (prior) | 5% |
| `[goal, codebase, config]` | v2 | 3 | 0 | 1.0 | 95% |

**Learning Insight:** The system learns that v2 requires `typescript_config` and performs perfectly when it's available.

---

## Visualization Strategy

### 1. Thompson Parameter Evolution Chart

**Line graph** showing α and β over executions:

```
Alpha/Beta Evolution
  ▲
5 │                    ●v2α
  │                  ●
  │                ●
4 │              ●
  │            ●
3 │          ●
  │        ●──────────●──────────●v1α
  │      ●
2 │    ●
  │  ●
1 │●─────────────────────────●─────────●v1β,v2β
  │
0 └──────┬─────┬─────┬─────┬─────┬────▶
         1     2     3     4     5    Execution
```

**Interpretation:**
- v1α plateaus (no new successes)
- v1β plateaus (no new failures)
- v2α grows linearly (consistent success)
- v2β flat (no failures)

### 2. Expected vs Actual Success Rate

**Bar chart comparison:**

```
Success Rate (%)
100 ├─────────────────────────────
    │      ███v2 Actual (100%)
 75 ├──────███─────────●v2 Expected
    │      ███         │
 50 ├──────███─────────●v1 Actual & Expected
    │      ███
 25 ├──────███─────────────────────
    │      ███
  0 └──────┴───────────────────────▶
         Exec1  Exec2  Exec3-5
```

**Convergence:** Expected rate approaches actual rate as evidence accumulates.

### 3. Selection Probability Heatmap

```
Template Selection Probability by Execution

      │ Exec1 │ Exec2 │ Exec3 │ Exec4 │ Exec5 │
──────┼───────┼───────┼───────┼───────┼───────┤
improv│ 100%  │  15%  │   5%  │   2%  │   1%  │ (dark→light)
──────┼───────┼───────┼───────┼───────┼───────┤
  v1  │   -   │  85%  │  45%  │  18%  │   4%  │
──────┼───────┼───────┼───────┼───────┼───────┤
  v2  │   -   │   -   │  50%  │  80%  │  95%  │ (light→dark)
──────┴───────┴───────┴───────┴───────┴───────┘

Legend: Darker = Higher probability
```

**Trend:** Selection probability shifts from improvisation → v1 → v2 as evidence accumulates.

### 4. Duration & Cost Reduction

**Dual-axis line chart:**

```
Duration (ms)          Cost ($)
4000├─●                    ├─0.030
    │  ╲                   │
3800│   ●──────●           ├─0.028
    │    ╲      ╲          │
3600│     ╲      ●─●       ├─0.026
    │      ╲              ●├─0.024
3400│       ╲              │
    │        ╲─────────────├─0.022
3200└────────────────────▶ └─0.020
         1   2   3   4   5
```

**Optimization:** As template stabilizes, execution becomes faster and cheaper.

### 5. Shape-Conditioned Score Matrix

**Table showing conditional success rates:**

```
╔══════════════════════════╦═════════╦══════════╗
║  Input Shape Set         ║   v1    ║    v2    ║
╠══════════════════════════╬═════════╬══════════╣
║ [goal, codebase]         ║  50%    ║   50%*   ║
║                          ║ (1/2)   ║ (prior)  ║
╠══════════════════════════╬═════════╬══════════╣
║ [goal, codebase, config] ║  50%*   ║  100%    ║
║                          ║ (prior) ║  (3/3)   ║
╚══════════════════════════╩═════════╩══════════╝

* = Prior only (no executions with this shape set)
```

**Key Insight:** v2 requires `config` shape for perfect success.

---

## Expected Results After 5 Executions

### 1. Template Convergence

**Outcome:** v2 becomes the dominant template for this goal class.

```typescript
{
  "create-typescript-utility:v1": {
    alpha: 2,
    beta: 2,
    expected_rate: 0.50,
    selection_probability: 0.04,  // Rarely selected
    last_selected: "exec_002"
  },

  "create-typescript-utility:v2": {
    alpha: 4,
    beta: 1,
    expected_rate: 0.80,
    selection_probability: 0.95,  // Dominant
    last_selected: "exec_005"
  }
}
```

### 2. Shape-Conditioned Accuracy

The system learns precise conditions for success:

```typescript
{
  rule: "When input includes 'typescript_config', use v2",
  confidence: 0.95,
  evidence: { successes: 3, failures: 0 }
}
```

### 3. Performance Optimization

- **Duration:** 3830ms → 3500ms (8.6% reduction)
- **Cost:** $0.025 → $0.022 (12% reduction)
- **Early exits:** 0% → 80% (behavioral validation working)

### 4. Uncertainty Reduction

Thompson Sampling variance decreases:

```
Execution 1: σ² ≈ 0.08 (high uncertainty, prior only)
Execution 5: σ² ≈ 0.03 (low uncertainty, evidence-based)
```

### 5. Expectation Alignment

Expected success rate converges to actual:

```
v2 Expected:  [0.50 → 0.667 → 0.75 → 0.80]
v2 Actual:    [1.0    1.0     1.0    1.0]
Convergence: 30% error → 20% error (improving)
```

After ~10 executions, expected rate should converge to ~0.95 (accounting for occasional edge cases).

---

## Running the Demonstration

### Prerequisites

1. **MiniBob** with ribosome extraction enabled
2. **Backend** (`metabob-activity-api`) with Thompson Sampling
3. **Test project** with TypeScript configured

### Execution Script

```bash
#!/bin/bash
# run-expectation-demo.sh

GOAL="Create a TypeScript utility function that validates email addresses with tests"

# Clean state
rm -rf .metabob/traces/*
rm -rf src/utils/email-validator*

echo "=== Execution 1: Pure Improvisation ==="
minibob --single "$GOAL" --verbose

echo "=== Execution 2: First Template Reuse ==="
rm -rf src/utils/email-validator*
minibob --single "$GOAL" --verbose

echo "=== Execution 3: Variant Competition ==="
rm -rf src/utils/email-validator*
minibob --single "$GOAL" --verbose

echo "=== Execution 4: Exploitation Begins ==="
rm -rf src/utils/email-validator*
minibob --single "$GOAL" --verbose

echo "=== Execution 5: Convergence ==="
rm -rf src/utils/email-validator*
minibob --single "$GOAL" --verbose

# Analyze results
node analyze-expectation-evolution.js
```

### Analysis Script

```javascript
// analyze-expectation-evolution.js
const traces = loadTraces('.metabob/traces/')
const thompsonState = fetchFromBackend('/v2/activities/thompson-state')

console.log('=== Thompson Parameter Evolution ===')
plotAlphaBeta(thompsonState)

console.log('=== Success Rate Convergence ===')
plotSuccessRates(traces, thompsonState)

console.log('=== Selection Probability Over Time ===')
plotSelectionProbability(traces)

console.log('=== Performance Trends ===')
plotDurationAndCost(traces)

console.log('=== Shape-Conditioned Learning ===')
printShapeScores(thompsonState)
```

---

## Success Criteria for Demonstration

The demonstration succeeds if:

1. ✅ **Ribosome extraction works** - Execution 1 creates template v1
2. ✅ **Variant creation works** - Failure in Execution 2 creates v2
3. ✅ **Thompson Sampling converges** - α/β parameters stabilize by Execution 5
4. ✅ **Shape-conditioned learning** - System learns v2 needs `typescript_config`
5. ✅ **Selection probability shifts** - v2 becomes dominant (>90% selection)
6. ✅ **Performance improves** - Duration and cost decrease
7. ✅ **Early exit works** - Validators trigger in Executions 3-5
8. ✅ **Expectations align** - Expected rate converges toward actual rate

---

## Extensions

### Variant A: Introduce Deliberate Failure

After Execution 3, modify the test file format to trigger a failure in Execution 4:

```typescript
// Before (Jest-style)
describe('email validation', () => { ... })

// After (Bun-style)
test('email validation', () => { ... })
```

**Expected:** System creates v3 that handles both test frameworks.

### Variant B: Add Impulse Relevance Learning

Track which impulses are actually used:

```typescript
{
  template: "create-typescript-utility:v2",
  impulse: "typescript_config",

  loaded: 5,
  used: 5,
  success_when_loaded: 5,
  success_when_not_loaded: 0,

  relevance_score: 1.0  // Always useful
}
```

### Variant C: Multi-Goal Generalization

Run similar goals to test template reuse:

```
Goal 2: "Create a utility to parse JSON with validation"
Goal 3: "Create a string formatting utility with tests"
```

**Expected:** System reuses `create-typescript-utility:v2` with different variables.

---

## Implementation Blockers

This demonstration requires **Gap 2** to be implemented:

- [ ] Ribosome extraction endpoint (`POST /v2/activities/extract-from-trace`)
- [ ] Shape-conditioned Thompson Sampling queries
- [ ] Backend variant creation on failure
- [ ] Early exit detection in MiniBob
- [ ] Shape inference from execution traces

**Status:** Not yet runnable. Create as roadmap item for post-Gap-2 validation.

---

## Documentation Cross-References

- [IMPULSE_ACTIVITY_FOUNDATION.md](../architecture/IMPULSE_ACTIVITY_FOUNDATION.md) - Core learning model
- [COMPOSITION_AND_CONTROL_FLOW.md](../architecture/COMPOSITION_AND_CONTROL_FLOW.md) - Activity composition patterns
- [Thompson Sampling Implementation](../../repos/microplastic/src/selection/thompson.ts)
- [Ribosome Extractor](../../repos/microplastic/src/ribosome/extractor.ts)
- [Early Exit Detection](../../repos/deployment/vessels/minibob/src/validators/early-exit.ts)

---

## Summary

This demonstration shows the **complete learning loop** from improvisation to refined, shape-conditioned templates. Key observations:

1. **Thompson Sampling works** - Uncertain templates are explored; successful ones are exploited
2. **Variants compete** - Multiple approaches coexist; the best one emerges naturally
3. **Shape conditioning matters** - Success depends on available context
4. **Expectations converge** - Predicted success rates align with observed rates
5. **Performance improves** - Optimized templates execute faster and cheaper

The demonstration proves that the system can **learn from experience** without explicit human programming of success conditions.
