# Impulse-Intent-Expectation Architecture

This document explains how the system passes impulses between resolvers, generates expectations from shapes and execution graphs, and adjusts expectations based on outcomes.

## Table of Contents

1. [Overview: The Three-Layer Model](#overview-the-three-layer-model)
2. [Impulse Resolution Protocol](#impulse-resolution-protocol)
3. [Shape-Based Expectation Generation](#shape-based-expectation-generation)
4. [Intent Flow: From Impulses to Outcomes](#intent-flow-from-impulses-to-outcomes)
5. [Expectation Adjustment Learning Loop](#expectation-adjustment-learning-loop)
6. [Complete Example: End-to-End Flow](#complete-example-end-to-end-flow)

---

## Overview: The Three-Layer Model

The system operates on three fundamental concepts that work together:

```
┌─────────────────────────────────────────────────────────────────┐
│                    UNIFIED ARCHITECTURE                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  LAYER 1: IMPULSE STATE SPACE                                  │
│  ├─ Available data (files, traces, errors, configs)            │
│  ├─ Shapes describe structure without loading content          │
│  └─ Resolvers live where data lives (distributed)              │
│                                                                  │
│  LAYER 2: INTENT & EXPECTATIONS                                │
│  ├─ Goal enrichment extracts expected outcomes                 │
│  ├─ Outcomes map to output shapes                              │
│  └─ Execution graph shows which activities compose             │
│                                                                  │
│  LAYER 3: LEARNING & ADJUSTMENT                                │
│  ├─ Thompson Sampling learns shape-conditioned success rates   │
│  ├─ Ribosome extracts patterns from successful executions      │
│  └─ Expectations adjust based on outcome mismatches            │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### The Key Innovation: Shape-Conditioned Learning

Traditional systems learn global success rates. This system learns **contextual success rates**:

- Activity "fix-auth-bug" with inputs `[source_code, error_log]` → 92% success
- Same activity with inputs `[source_code]` only → 65% success
- Same activity with inputs `[source_code, error_log, test_results]` → 97% success

This enables precise recommendations based on **what data is actually available**.

---

## Impulse Resolution Protocol

### The Three-Tier Resolver Hierarchy

Impulses are resolved through delegation, not centralization:

```
┌────────────────────────────────────────────────────────────────┐
│  TIER 1: LOCAL RESOLVERS (MiniBob)                            │
│  ├─ memo: Embedded content (instant)                          │
│  ├─ file: Filesystem reads (1-50ms)                           │
│  ├─ directoryTree: File structure (10-100ms)                  │
│  ├─ gitDiff: Git operations (50-500ms)                        │
│  └─ packageConfig: Package files (1-10ms)                     │
│                                                                 │
│  TIER 2: VESSEL DISCOVERY (Dynamic Network)                   │
│  ├─ Discovery finds capable vessels                           │
│  ├─ Resolvers register dynamically                            │
│  └─ Cached after first discovery (100-500ms)                  │
│                                                                 │
│  TIER 3: BACKEND MCP (Centralized Learning)                   │
│  ├─ activityExecutionTrace: Full execution history            │
│  ├─ activityTemplate: Template definitions                    │
│  ├─ activityMetrics: Performance data                         │
│  └─ Any new type backend adds (50-200ms)                      │
└────────────────────────────────────────────────────────────────┘
```

**Implementation**: `repos/minibob/src/impulse.ts:257-530`

### Passing Impulses as Variables

Impulses become variables through **automatic substitution**:

```typescript
// Activity template uses {{impulse:id}} syntax
const taskPrompt = `
Fix the bug described in {{impulse:errorLog}}.
The failing code is in {{impulse:sourceFile}}.
Previous attempts: {{impulse:previousAttempts}}
`

// MiniBob automatically:
// 1. Identifies impulse references
// 2. Loads impulses (respecting token budgets)
// 3. Substitutes content into prompt
// 4. Sends to LLM

// Result sent to LLM:
`Fix the bug described in:
Error: TypeError: Cannot read property 'user' of undefined
  at AuthMiddleware (auth.ts:42)
  ...

The failing code is in:
export function AuthMiddleware(req, res) {
  const user = req.session.user  // session is undefined!
  ...
}

Previous attempts:
- Attempt 1: Added null check → still failed
- Attempt 2: Initialized session → partially worked
`
```

**No explicit "variables"** - impulses ARE the variables. The resolution happens implicitly based on pointer type.

### Metadata-First, Content-Later Approach

LLMs see impulse **metadata** before loading expensive content:

```xml
<!-- Pointer mode: LLM reasons about structure -->
<impulse_context>
  <impulse_ref id="errorLog" type="file" shape="error_output"
               row_count="127"
               summary="Application error trace from failed execution"
               available_ops="read,analyze,debug" />

  <impulse_ref id="recentFailures" type="activityExecutionTrace"
               shape="execution_history"
               row_count="5"
               summary="Last 5 failed executions of this activity"
               available_ops="analyze,compare,diff" />
</impulse_context>

<!-- LLM can reason: "I need to analyze errorLog first, then compare with recentFailures" -->
<!-- Only THEN does MiniBob load the actual content -->
```

This enables:
- **Selective loading**: Only load impulses the LLM actually needs
- **Token optimization**: Don't waste context on unused data
- **Reasoning about data**: LLM plans before execution

**Implementation**: `repos/minibob/src/impulse.ts:580-630`

### Cross-Resolver Delegation

When MiniBob encounters unknown impulse types:

```
User activity needs: { type: "activityExecutionTrace", executionId: "exec-123" }
                                    ↓
               MiniBob checks local resolvers → NOT FOUND
                                    ↓
               MiniBob checks vessel discovery → NOT FOUND
                                    ↓
               MiniBob delegates to backend via MCP
                                    ↓
       Backend queries: SELECT * FROM activity_execution_traces WHERE id = 'exec-123'
                                    ↓
               Backend formats trace as markdown
                                    ↓
               Returns content to MiniBob
                                    ↓
               MiniBob injects into prompt
```

**Key benefit**: Backend can add new impulse types (`codeAnalysis`, `riskAssessment`, `securityScan`) without MiniBob code changes.

**Implementation**: `repos/minibob/src/mcp.ts:1239-1260`, `repos/metabob-activity-api/src/routes/impulses.ts:575-800`

### Impulse Evolution: Output Impulses Feed Next Activities

When activities complete, they **create new impulses** for downstream use:

```typescript
// Activity "fix-bug" completes
execution.outputImpulses = [
  {
    id: "fixed-code",
    shape: "source_code",
    pointer: { type: "file", path: "src/auth.ts" },
    metadata: {
      producedBy: "fix-bug-v2",
      summary: "Fixed authentication middleware"
    }
  },
  {
    id: "test-results",
    shape: "test_result",
    pointer: { type: "activityOutput", activityId: "fix-bug-v2", taskId: "verify" },
    metadata: {
      producedBy: "fix-bug-v2",
      summary: "All 12 auth tests passing"
    }
  }
]

// Backend stores these impulses
await backend.storeImpulses(execution.outputImpulses)

// Next activity can reference them:
// "Based on {{impulse:test-results}}, document the fix"
// MiniBob resolves via backend → gets test execution summary
```

**This creates activity composition chains** where data flows automatically through impulse references.

**Implementation**: `repos/minibob/src/mcp.ts:975-1089`

---

## Shape-Based Expectation Generation

### The Shape Vocabulary

Shapes emerge from usage patterns, creating a living vocabulary:

| Shape | Examples | Auto-Generated Validation |
|-------|----------|---------------------------|
| `source_code` | `*.ts`, `*.py`, `*.js` | `typescript_compiles`, `lint_passes` |
| `test_suite` | `*.test.ts`, `*.spec.js` | `tests_pass`, file exists |
| `error` | Error messages, exceptions | Pattern: `error\|exception\|failure` |
| `trace` | Stack traces, execution logs | Pattern: `stack\|trace\|debug` |
| `config_file` | `*.json`, `*.yaml`, `*.env` | `json_valid`, `yaml_valid` |
| `patch` | Code modifications, diffs | Files modified, tests pass |
| `documentation` | `*.md`, READMEs | `markdown_valid`, file exists |
| `test_result` | Test execution output | Pattern: `pass\|fail\|coverage` |

**Key insight**: The system doesn't predefine these - they emerge from execution traces and are extracted by the ribosome.

### From Shapes to Validation Rules

The system automatically generates validation from shapes:

```typescript
// Activity declares output shapes
activity.outputSchema = {
  produces: [
    { shape: "source_code", description: "Fixed authentication code" },
    { shape: "test_suite", description: "Tests for auth flow" }
  ]
}

// System automatically generates validation:
activity.tasks[0].validation = {
  // From "source_code" shape:
  requiredFiles: ["src/**/*.ts"],
  requiredPatterns: [
    { file: "src/auth.ts", pattern: "export.*function" }
  ],
  commands: [
    { command: "bun run typecheck", expectedOutput: "No errors" }
  ],

  // From "test_suite" shape:
  requiredFiles: ["src/**/*.test.ts"],
  requiredPatterns: [
    { file: "src/auth.test.ts", pattern: "describe.*Auth" }
  ],
  commands: [
    { command: "bun test", expectedOutput: "passed" }
  ]
}
```

**This happens automatically** during ribosome template extraction from successful executions.

### Activity Execution Graph Informs Expectations

The system tracks activity composition to understand expected dataflows:

```sql
-- Composition graph tracks: Activity A → Activity B
activity_composition_graph {
  parent_activity_id: "extract-error-logs",
  child_activity_id: "debug-error",

  -- Data flow metadata
  impulse_flow: [
    {
      parent_output_shape: "error",
      child_input_shape: "error",
      flow_type: "direct_pass"
    }
  ],

  -- Success metrics
  execution_count: 15,
  success_count: 13,
  weight: 0.87  // success_count / execution_count
}
```

**Expectation Formula from Graph**:

```
When suggesting activity B after activity A:
Expected success = P(A succeeds) × P(A→B compatible) × P(B succeeds | A's output)

Example:
- Activity "extract-error" → 92% success, produces "error" shape
- Activity "debug-error" → 85% success when given "error" shape
- Compatibility: 100% (shapes match)
- Combined: 0.92 × 1.0 × 0.85 = 78% expected success

vs. incompatible chain:
- Activity "extract-error" → 92% success, produces "error" shape
- Activity "add-feature" → 90% success, needs "requirements" shape
- Compatibility: 0% (shapes don't match)
- Combined: 0.92 × 0.0 × 0.90 = 0% expected success → filtered out
```

**Implementation**: `repos/metabob-activity-api/sql/002-learning-system-phase1.surql:19-69`

### Shape Validators Enable Deterministic Expectations

Built-in validators map shapes to checks:

```typescript
// Shape: "source_code"
const sourceCodeValidators = [
  {
    name: "file_exists",
    check: (path) => fs.existsSync(path),
    earlyExit: true  // Can exit when this passes
  },
  {
    name: "typescript_compiles",
    check: (path) => exec("tsc --noEmit").exitCode === 0,
    earlyExit: true
  },
  {
    name: "lint_passes",
    check: (path) => exec("eslint").exitCode === 0,
    earlyExit: false  // Nice to have, not required
  }
]

// During execution:
for (const validator of sourceCodeValidators) {
  const result = await validator.check(file)
  if (result && validator.earlyExit) {
    // Shape satisfied - can exit early!
    return { canExit: true, satisfied: [validator.name] }
  }
}
```

**This enables fast-fail validation** without LLM involvement.

**Implementation**: `repos/minibob/src/validators/shape-validators.ts`

---

## Intent Flow: From Impulses to Outcomes

### The Complete Flow

```
STAGE 1: Impulse State Space Analysis
─────────────────────────────────────
Available files, execution traces, error logs
        ↓
System identifies shapes: [source_code, error_log, test_results]


STAGE 2: Goal Enrichment
─────────────────────────
User: "fix the authentication flow bug"
        ↓
LLM enriches:
{
  category: "bugfix",
  clarifiedIntent: "Fix broken authentication mechanism",
  expectedOutcomes: [
    "Authentication flow working again",
    "Tests passing",
    "No errors in logs"
  ],
  requiredCapabilities: ["file_read", "file_write", "bash"],
  successCriteria: "All auth tests pass"
}


STAGE 3: Outcome → Shape Mapping
─────────────────────────────────
"Authentication flow working" → shape: "source_code"
"Tests passing" → shape: "test_suite"
"No errors in logs" → shape: "patch"
        ↓
expectedOutputShapes = ["source_code", "test_suite", "patch"]


STAGE 4: Shape-Conditioned Activity Selection
──────────────────────────────────────────────
POST /recommend {
  impulse_shapes: ["source_code", "error_log", "test_results"],  ← Available
  expected_output_shapes: ["source_code", "test_suite", "patch"]  ← Expected
}
        ↓
Backend Thompson Sampling:
- Filters activities where input_shapes ⊆ available shapes
- Gets shape-conditioned scores (Beta distribution per shape combination)
- Boosts activities with matching output_shapes
        ↓
Returns: [
  {
    activity_id: "fix-auth-bug-v2",
    input_shapes: ["source_code", "error_log"],
    output_shapes: ["source_code", "test_suite"],
    thompson_score: 0.93  ← High confidence for THIS shape combination
  }
]


STAGE 5: Execution with Outcome Tracking
─────────────────────────────────────────
MiniBob executes activity:
- Loads impulses matching input_shapes
- Executes tasks
- Creates output impulses
        ↓
Tracks:
- impulses_loaded: [source_code, error_log] ← What was actually used
- impulses_created: [fixed_code, test_results] ← What was produced
- output_shapes: ["source_code", "test_suite"] ← Shapes produced


STAGE 6: Outcome Validation
────────────────────────────
Compare:
  Expected: ["source_code", "test_suite", "patch"]
  Actual: ["source_code", "test_suite"]
        ↓
Result: PARTIAL MATCH (missing "patch")
        ↓
Actions:
- Mark execution as SUCCESS (tests pass)
- Note incomplete outcome coverage
- Create variant template suggesting patch generation
- Adjust Thompson scores (success += 1, but partial flag set)
```

### Intent Representation

Intent exists at multiple levels:

```typescript
// Level 1: Raw user input
const userGoal = "fix the authentication flow bug"

// Level 2: Enriched intent (via LLM)
const enrichedIntent = {
  category: "bugfix",
  clarifiedIntent: "Fix broken authentication mechanism causing failed logins",
  expectedOutcomes: ["Authentication flow working", "Tests passing", "No errors"],
  requiredCapabilities: ["file_read", "file_write", "bash"],
  successCriteria: "All auth tests pass"
}

// Level 3: Shape-encoded intent
const shapeIntent = {
  inputShapes: ["source_code", "error_log"],  // What data we have
  outputShapes: ["source_code", "test_suite", "patch"],  // What we expect to produce
  category: "bugfix"
}

// Level 4: Activity-encoded intent
const selectedActivity = {
  id: "fix-auth-bug-v2",
  tasks: [
    { description: "Analyze error logs" },  // Intent: understand problem
    { description: "Fix authentication code" },  // Intent: solve problem
    { description: "Run tests" }  // Intent: verify solution
  ],
  inputSchema: { required: [{shape: "error_log"}] },  // What it needs
  outputSchema: { produces: [{shape: "source_code"}, {shape: "test_suite"}] }  // What it delivers
}
```

**Intent propagates through shapes** - from high-level goals to concrete validation rules.

### Impulse State Space Creates Intent Constraints

The available impulses **constrain what activities can execute**:

```typescript
// Scenario 1: Rich impulse state
availableShapes = ["source_code", "error_log", "test_results", "execution_trace"]
        ↓
Can execute:
- "fix-auth-bug-v2" (needs: source_code, error_log) ✓
- "debug-with-trace" (needs: execution_trace, error_log) ✓
- "comprehensive-fix" (needs: all 4 shapes) ✓


// Scenario 2: Sparse impulse state
availableShapes = ["source_code"]
        ↓
Can execute:
- "fix-auth-bug-v2" (needs: source_code, error_log) ✗ Missing error_log
- "debug-with-trace" (needs: execution_trace, error_log) ✗ Missing both
- "comprehensive-fix" (needs: all 4 shapes) ✗ Missing 3 shapes
- "simple-code-fix" (needs: source_code) ✓ Only this works


// System responds:
{
  executable: ["simple-code-fix"],
  blocked: ["fix-auth-bug-v2", "debug-with-trace", "comprehensive-fix"],
  suggestions: [
    "Load error logs to unlock 2 better activities",
    "Run execution trace to enable comprehensive debugging"
  ]
}
```

This creates **data-driven intent refinement** - the system suggests acquiring missing impulses to unlock better capabilities.

---

## Expectation Adjustment Learning Loop

### The Feedback Mechanism

When outcomes differ from expectations, the system learns:

```
┌──────────────────────────────────────────────────────────────┐
│  EXPECTATION MISMATCH → LEARNING                             │
├──────────────────────────────────────────────────────────────┤
│                                                               │
│  SCENARIO 1: Expected Outputs Not Produced                   │
│  ──────────────────────────────────────────                  │
│  Expected: ["source_code", "test_suite", "patch"]            │
│  Actual: ["source_code"]                                     │
│           ↓                                                   │
│  Actions:                                                     │
│  1. Mark as PARTIAL success (not full failure)               │
│  2. Thompson: alpha += 0.5 (partial credit)                  │
│  3. Extract attempt template with suggestions:               │
│     - "Add test execution task"                              │
│     - "Add patch documentation task"                         │
│  4. Shape-conditioned score: penalize this combination       │
│                                                               │
│  SCENARIO 2: Wrong Input Shapes Used                         │
│  ─────────────────────────────────────────                   │
│  Activity expected: ["source_code", "error_log"]             │
│  Actually loaded: ["source_code", "execution_trace"]         │
│           ↓                                                   │
│  Actions:                                                     │
│  1. Track as shape variant: same activity, different inputs  │
│  2. Create new shape-conditioned score entry:                │
│     - Original: Beta(15, 2) for [source_code, error_log]     │
│     - New: Beta(1, 1) for [source_code, execution_trace]     │
│  3. Learn independently for this combination                 │
│                                                               │
│  SCENARIO 3: Validation Failed Despite Execution Success     │
│  ───────────────────────────────────────────────────────     │
│  Execution: success = true                                   │
│  Validation: requiredPatterns not found                      │
│           ↓                                                   │
│  Actions:                                                     │
│  1. Override success flag → failed                           │
│  2. Thompson: beta += 1 (count as failure)                   │
│  3. Record failure type: "validation_pattern_mismatch"       │
│  4. Ribosome: DON'T extract template (validation didn't pass)│
│  5. Suggest validation rule refinement                       │
│                                                               │
└──────────────────────────────────────────────────────────────┘
```

### Confidence-Based Template Extraction

The ribosome uses **confidence scores** to determine when to extract patterns:

```typescript
// After successful execution
const confidence = calculateExtractionConfidence(trace)

// Factors:
// 1. Impulse consistency: Did we use expected shapes?
const impulseScore = trace.impulses_loaded.filter(i =>
  i.shape in expectedInputShapes
).length / expectedInputShapes.length

// 2. Output consistency: Did we produce expected shapes?
const outputScore = trace.impulses_created.filter(i =>
  i.shape in expectedOutputShapes
).length / expectedOutputShapes.length

// 3. Validation success: Did all validators pass?
const validationScore = trace.validations_passed / trace.validations_total

// 4. Execution success: Did activity complete?
const executionScore = trace.status === "completed" ? 1.0 : 0.0

// Combined confidence
const confidence = (
  0.3 * impulseScore +
  0.3 * outputScore +
  0.2 * validationScore +
  0.2 * executionScore
)

// Decision:
if (confidence > 0.8) {
  // High confidence - extract as template
  const template = extractTemplate(trace)
  template.metadata.schemaConfidence = confidence
  await backend.storeTemplate(template)

} else if (confidence > 0.5) {
  // Medium confidence - extract as draft, require review
  const draft = extractTemplate(trace)
  draft.status = "draft"
  draft.requiresReview = true
  await backend.storeDraft(draft)

} else {
  // Low confidence - just store trace for analysis
  await backend.storeTrace(trace)
}
```

**Implementation**: `repos/metabob-activity-api/src/routes/ribosome.ts:120-503`

### Shape-Conditioned Thompson Sampling

The key innovation: **Different success rates for different input contexts**:

```sql
-- Global metrics (all executions)
variant_performance_metrics {
  activity_id: "fix-auth-bug",
  total_executions: 50,
  successful_executions: 42,
  thompson_alpha: 43,  -- successes + 1
  thompson_beta: 9     -- failures + 1
}
-- Expected sample: ~0.83

-- Shape-conditioned metrics (specific input shapes)
impulse_shape_activity_score {
  activity_id: "fix-auth-bug",
  shape_signature: ["source_code", "error_log"],  -- THIS combination
  executions: 15,
  successes: 14,
  thompson_alpha: 15,
  thompson_beta: 2
}
-- Expected sample: ~0.88 (BETTER for this shape combination!)

impulse_shape_activity_score {
  activity_id: "fix-auth-bug",
  shape_signature: ["source_code"],  -- Different combination
  executions: 10,
  successes: 6,
  thompson_alpha: 7,
  thompson_beta: 5
}
-- Expected sample: ~0.58 (WORSE without error_log)
```

**When recommending activities**:
1. Check if current impulse shapes match any known combinations
2. Use shape-conditioned score if available (more accurate)
3. Fall back to global score if no shape match

**Result**: Recommendations become **context-aware** - the same activity is rated differently depending on what data is available.

**Implementation**: `repos/metabob-activity-api/src/routes/activities.ts:2602-2856`

---

## Complete Example: End-to-End Flow

Let's trace a complete workflow from user goal to adjusted expectations:

### Initial State

```typescript
// User workspace
files = ["src/auth.ts", "src/auth.test.ts", "logs/error.log"]

// Available impulse shapes (inferred from workspace)
availableShapes = ["source_code", "error_log", "test_suite"]

// User goal
goal = "The auth tests are failing, fix them"
```

### Step 1: Goal Enrichment

```typescript
const enrichment = await enrichGoalWithLLM(goal)

// Result:
{
  category: "bugfix",
  clarifiedIntent: "Fix failing authentication tests by debugging and resolving errors",
  expectedOutcomes: [
    "Authentication tests passing",
    "No errors in test execution",
    "Code changes documented"
  ],
  requiredCapabilities: ["file_read", "file_write", "bash"],
  successCriteria: "All tests in src/auth.test.ts pass"
}

// Map outcomes to shapes
expectedOutputShapes = [
  "test_suite",      // from "tests passing"
  "source_code",     // from "code changes"
  "documentation"    // from "documented"
]
```

### Step 2: Activity Selection (Shape-Conditioned)

```typescript
// Request recommendations
const request = {
  task_description: enrichment.clarifiedIntent,
  impulse_shapes: ["source_code", "error_log", "test_suite"],
  expected_output_shapes: ["test_suite", "source_code", "documentation"],
  category: "bugfix"
}

// Backend processing:
// 1. Filter by input shapes
const candidates = activities.filter(a =>
  a.inputSchema.required.every(shape =>
    request.impulse_shapes.includes(shape.shape)
  )
)

// 2. Get shape-conditioned scores
const scores = await getShapeConditionedScores(
  orgId,
  candidates.map(a => a.id),
  request.impulse_shapes
)

// 3. Apply Thompson Sampling with boosting
for (const activity of candidates) {
  let alpha = scores[activity.id]?.thompson_alpha || 1
  let beta = scores[activity.id]?.thompson_beta || 1

  // Shape compatibility boost
  const shapeBoost = activity.inputSchema.required.every(s =>
    request.impulse_shapes.includes(s.shape)
  ) ? 3 : 0

  // Output coverage boost
  const outputCoverage = activity.outputSchema.produces.filter(s =>
    request.expected_output_shapes.includes(s.shape)
  ).length / request.expected_output_shapes.length
  const outputBoost = Math.floor(outputCoverage * 4)

  alpha += shapeBoost + outputBoost

  // Sample from Beta distribution
  const sample = betaSample(alpha, beta)
  activity.score = sample
}

// Sort by score
candidates.sort((a, b) => b.score - a.score)

// Top recommendation:
{
  template_id: "fix-test-failure-v2",
  input_shapes: ["source_code", "error_log", "test_suite"],
  output_shapes: ["source_code", "test_suite"],  // Missing "documentation"!
  selection_metadata: {
    alpha: 18,  // 15 base + 3 shape boost
    beta: 3,
    sample: 0.86,
    shape_conditioned: true
  }
}
```

### Step 3: Execution

```typescript
// MiniBob executes activity
const execution = await executeActivity("fix-test-failure-v2", {
  impulses: [
    { id: "auth-code", shape: "source_code", pointer: {type: "file", path: "src/auth.ts"} },
    { id: "error-log", shape: "error_log", pointer: {type: "file", path: "logs/error.log"} },
    { id: "tests", shape: "test_suite", pointer: {type: "file", path: "src/auth.test.ts"} }
  ]
})

// Tasks execute:
// Task 1: Analyze error log ✓
// Task 2: Fix authentication bug ✓
// Task 3: Run tests ✓

// Output impulses created:
execution.outputImpulses = [
  { id: "fixed-auth", shape: "source_code", pointer: {type: "file", path: "src/auth.ts"} },
  { id: "test-results", shape: "test_suite", pointer: {type: "activityOutput", ...} }
]

execution.output_impulse_shapes = ["source_code", "test_suite"]
execution.success = true
execution.duration_ms = 45000
execution.cost = 0.23
```

### Step 4: Outcome Validation

```typescript
// Compare expected vs actual
const expected = ["test_suite", "source_code", "documentation"]
const actual = ["source_code", "test_suite"]

// Analysis
const coverage = {
  matched: ["source_code", "test_suite"],
  missing: ["documentation"],
  unexpected: [],
  coverageRatio: 2/3  // 66%
}

// Validation result
if (coverage.coverageRatio === 1.0) {
  result = "COMPLETE"
} else if (coverage.coverageRatio >= 0.5) {
  result = "PARTIAL"  // This case
} else {
  result = "FAILED"
}
```

### Step 5: Learning & Adjustment

```typescript
// 1. Update global Thompson metrics
await updateMetrics({
  activity_id: "fix-test-failure-v2",
  success: true,
  partial: true,  // Flag for incomplete outcome coverage
  duration_ms: 45000,
  cost: 0.23
})

// Result:
// thompson_alpha: 15 → 16 (success += 1, but partial flag recorded)
// thompson_beta: 2 (unchanged)

// 2. Update shape-conditioned scores
await updateShapeScores({
  activity_id: "fix-test-failure-v2",
  shape_signature: ["source_code", "error_log", "test_suite"],
  success: true,
  partial: true
})

// Result:
// For THIS shape combination:
// thompson_alpha: 12 → 13
// thompson_beta: 1 (unchanged)
// partial_outcomes: 1 (new tracking)

// 3. Extract attempt template
const attemptTemplate = await extractAttemptTemplate(execution, {
  missingOutcomes: ["documentation"],
  suggestions: [
    "Add documentation generation task",
    "Create CHANGELOG.md entry",
    "Document API changes in README"
  ]
})

// New variant created:
{
  id: "fix-test-failure-v3",
  basedOn: "fix-test-failure-v2",
  isVariant: true,
  tasks: [
    ...originalTasks,
    {
      id: "document-changes",
      description: "Document the fix in CHANGELOG and README",
      validation: {
        requiredFiles: ["CHANGELOG.md"],
        requiredPatterns: ["## Fixed"]
      },
      outputShapes: ["documentation"]
    }
  ],
  outputSchema: {
    produces: [
      { shape: "source_code" },
      { shape: "test_suite" },
      { shape: "documentation" }  // Now includes missing shape!
    ]
  },
  metadata: {
    createdFrom: "outcome_mismatch",
    confidence: 0.5  // Medium confidence - needs validation
  }
}

// 4. Adjust recommendations
// Next time same goal appears:
const nextRecommendations = [
  {
    template_id: "fix-test-failure-v3",  // NEW variant
    score: 0.72,  // Beta(1, 1) + boosting = medium score
    reason: "Includes documentation generation"
  },
  {
    template_id: "fix-test-failure-v2",  // Original
    score: 0.86,  // Beta(13, 1) = high score
    reason: "Proven track record, but missing documentation"
  }
]

// Thompson Sampling will try v3 occasionally (exploration)
// If v3 succeeds multiple times, it will become the default (exploitation)
```

### Step 6: Expectation Refinement

After 5 more executions of variant v3:

```typescript
// Variant v3 performance:
// - Execution 1: success, all shapes produced ✓
// - Execution 2: success, all shapes produced ✓
// - Execution 3: success, missing documentation ✗
// - Execution 4: success, all shapes produced ✓
// - Execution 5: success, all shapes produced ✓

// Updated metrics:
{
  activity_id: "fix-test-failure-v3",
  total_executions: 5,
  successful_executions: 5,
  complete_outcomes: 4,  // All expected shapes produced
  partial_outcomes: 1,   // Some shapes missing

  thompson_alpha: 6,  // 5 successes + 1
  thompson_beta: 1,   // 0 failures + 1

  // Shape-conditioned for [source_code, error_log, test_suite]
  shape_alpha: 5,
  shape_beta: 1,

  outcome_coverage_avg: 0.93  // 4 complete + 0.66*1 partial = 4.66/5
}

// Now when recommending:
// v3: Beta(5, 1) = ~0.83 with complete outcomes
// v2: Beta(13, 1) = ~0.93 but partial outcomes

// Adjusted with outcome coverage:
// v3: 0.83 * 0.93 = 0.77
// v2: 0.93 * 0.66 = 0.61

// Result: v3 becomes the default recommendation!
// Expectations adjusted: "documentation" now expected for this goal type
```

---

## Key Architectural Insights

### 1. Variables Are Implicit Through Impulse Substitution

No explicit variable passing - impulses resolve on-demand and inject into prompts.

**Benefits**:
- Resolvers don't need to know about each other
- Backend can add new impulse types transparently
- Token budgets enforced automatically
- Lazy loading optimizes context usage

### 2. Shapes Enable Deterministic Validation

Shapes map to validators that check without LLM involvement.

**Benefits**:
- Fast-fail when expectations not met
- Early exit when goals achieved
- No token cost for validation
- Confidence scores drive extraction

### 3. Thompson Sampling Is Shape-Conditioned

Success rates vary by input data context.

**Benefits**:
- Precise recommendations based on available data
- Learns optimal activity-shape pairings
- Automatic A/B testing of variants
- Exploration-exploitation balance

### 4. Expectations Adjust Automatically

Ribosome extracts patterns, Thompson Sampling updates scores, variants emerge from failures.

**Benefits**:
- System improves without manual tuning
- Successful patterns become templates
- Failed patterns suggest improvements
- Confidence calibrates trust

### 5. The Loop Never Stops

Every execution → trace → learning → better recommendations → next execution.

**The process-of-becoming**: Continuous transformation through measured execution and automatic pattern extraction.

---

## Summary

This architecture creates a self-improving system where:

1. **Impulses pass between resolvers** via delegation protocol (local → discovered → backend)
2. **Shapes generate expectations** automatically (validation rules, early exit triggers)
3. **Execution graphs inform composition** (dataflow patterns, success probabilities)
4. **Outcomes adjust expectations** (Thompson Sampling updates, ribosome extraction, variant creation)

The key innovation: **Shape-conditioned learning** enables context-aware recommendations where success rates depend on what data is actually available, not just global averages.

Intent flows from impulses (available data) → enrichment (expected outcomes) → activity selection (shape-aware) → execution (outcome tracking) → learning (expectation adjustment) → improved recommendations.

The system doesn't just execute activities - it **learns which activities work best for which data contexts** and **automatically generates new variants** when expectations aren't met.
