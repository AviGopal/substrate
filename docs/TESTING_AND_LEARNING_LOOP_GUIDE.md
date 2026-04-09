# Testing Expectations & Learning Loop Guide

This document explains how the system validates activity outcomes and demonstrates the complete learning cycle.

## Table of Contents

1. [How the System Tests Expectations](#how-the-system-tests-expectations)
2. [The Complete Learning Loop](#the-complete-learning-loop)
3. [Demonstrating the Loop](#demonstrating-the-loop)
4. [Observing Learning in Action](#observing-learning-in-action)

---

## How the System Tests Expectations

The system uses a **multi-layered validation architecture** that enables deterministic validation without LLM involvement.

### Layer 1: Pre-Flight Schema Validation

**Purpose**: Catch structural errors before execution
**Location**: `repos/minibob/src/schema-validator.ts`

```typescript
validateActivityTemplate(template) {
  // Validates:
  // - Required fields (id, name, description)
  // - Field naming (camelCase vs snake_case)
  // - Nested structure consistency
}
```

**Catches**:
- `required_files` instead of `requiredFiles`
- Missing required fields
- Type mismatches

### Layer 2: Pre-Execution Validation

**Purpose**: Skip LLM execution when expectations already met
**Location**: `repos/minibob/src/activity.ts:1625-1850`

```typescript
checkPreValidation(task) {
  // Check if:
  // 1. requiredFiles already exist
  // 2. forbiddenPatterns are already absent
  // 3. requiredPatterns already present

  if (allChecksPassed) {
    return { skip: true, confidence: 1.0 }
    // Mark task as completed WITHOUT calling LLM
  }
}
```

**Benefits**:
- Save tokens/cost when work already done
- Deterministic validation (no reasoning needed)
- Fast-fail on impossible tasks

**Example**:
```json
{
  "id": "verify-compile",
  "description": "Ensure TypeScript compiles",
  "validation": {
    "requiredFiles": ["src/index.ts"],
    "forbiddenPatterns": [
      { "file": "src/index.ts", "pattern": "console.log" }
    ]
  }
}
```

If file exists and has no console.log → task completes instantly without LLM.

### Layer 3: Post-Execution Validation

**Purpose**: Verify LLM output meets expectations
**Location**: `repos/minibob/src/activity.ts:2724-2812`

```typescript
async runValidation(validation, taskOutput, variables) {
  // 1. Check requiredFiles exist
  for (const filePath of validation.requiredFiles) {
    if (!await exists(filePath)) {
      return { success: false, error: `Missing: ${filePath}` }
    }
  }

  // 2. Check requiredPatterns present
  for (const pattern of validation.requiredPatterns) {
    if (typeof pattern === 'string') {
      // Pattern in task output
      if (!taskOutput.match(pattern)) {
        return { success: false, error: `Pattern not found: ${pattern}` }
      }
    } else {
      // Pattern in specific file
      const content = await readFile(pattern.file)
      if (!content.match(pattern.pattern)) {
        return { success: false, error: `Pattern not in ${pattern.file}` }
      }
    }
  }

  // 3. Check forbiddenPatterns absent
  for (const { file, pattern } of validation.forbiddenPatterns) {
    const content = await readFile(file)
    if (content.match(pattern)) {
      return { success: false, error: `Forbidden pattern: ${pattern}` }
    }
  }

  // 4. Run validation commands
  for (const { command, expectedOutput } of validation.commands) {
    const result = await bash(command)
    if (!result.success || !result.output.includes(expectedOutput)) {
      return { success: false, error: `Command failed: ${command}` }
    }
  }

  return { success: true }
}
```

**Validation Structure**:
```json
{
  "validation": {
    "requiredFiles": ["src/index.ts"],
    "requiredPatterns": [
      { "file": "src/index.ts", "pattern": "export function" },
      "Successfully compiled"
    ],
    "forbiddenPatterns": [
      { "file": "src/index.ts", "pattern": "console.log" },
      { "file": "src/index.ts", "pattern": "debugger" }
    ],
    "commands": [
      { "command": "bun run typecheck", "expectedOutput": "No errors" },
      { "command": "bun test", "expectedOutput": "passed" }
    ]
  }
}
```

### Layer 4: Shape-Based Validation

**Purpose**: Validate behaviors, not text patterns
**Location**: `repos/minibob/src/validators/early-exit.ts`

```typescript
await checkEarlyExit([
  { shape: 'file_exists', pointer: { type: 'file', path: 'src/index.ts' } },
  { shape: 'typescript_compiles', pointer: { type: 'file', path: 'src/index.ts' } },
  { shape: 'tests_pass', pointer: { type: 'file', path: '.' } }
])

// Returns:
{
  canExit: true,
  satisfied: ['file_exists', 'typescript_compiles', 'tests_pass'],
  unsatisfied: [],
  validations: [...]
}
```

**Built-in validators** (no LLM):
- `file_exists` - File exists at path
- `json_valid` - Valid JSON syntax
- `typescript_compiles` - TypeScript has no errors
- `tests_pass` - Test suite passes
- `builds` - Build succeeds
- `lint_passes` - Linting passes

### Layer 5: State Transition Tracking

**Purpose**: Capture what changed for learning
**Location**: `repos/minibob/src/activity.ts:2100-2200`

```typescript
// Before task execution
const beforeHashes = await captureFileHashes(workingDirectory, filesAvailable)

// Execute task...

// After task execution
const afterHashes = await captureFileHashes(workingDirectory, [
  ...outputState.filesCreated,
  ...outputState.filesModified
])

return {
  stateTransition: {
    before: { "src/index.ts": "abc123...", "package.json": "def456..." },
    after: { "src/index.ts": "xyz789...", "package.json": "def456..." },
    workingDirectory: "/path/to/project"
  }
}
```

**Used by ribosome** to extract:
- Which files were created
- Which files were modified
- What tool calls led to changes
- Mechanical template extraction

### Layer 6: Metrics Capture

**Purpose**: Measure everything for learning

```typescript
return {
  taskId: "task-1",
  status: "completed" | "failed",
  startedAt: 1234567890,
  completedAt: 1234567900,

  // Metrics for learning
  tokens: {
    input: 1500,
    output: 800,
    cache: 200
  },
  cost: 0.042,  // USD
  duration_ms: 10000,

  // Tool usage
  toolCalls: [
    {
      name: "read",
      arguments: { filePath: "src/index.ts" },
      result: { success: true, output: "..." },
      duration_ms: 50
    }
  ],

  // Validation results
  preValidationPassed: false,
  estimatedTokenSavings: 0,

  // Failure classification
  error: "Validation failed: pattern not found",
  errorType: "validation"  // execution | timeout | validation
}
```

### Failure Classification

**Types tracked**:
- `execution` - LLM or tool execution error
- `timeout` - Task exceeded timeout
- `validation` - Post-execution validation failed
- `pattern_mismatch` - Required patterns not found
- `file_not_found` - Required files missing

**Used for pattern learning**: Backend learns which failure types correlate with specific tool arguments or impulse combinations.

---

## The Complete Learning Loop

The learning loop has **6 phases** that continuously improve activity recommendations:

```
┌─────────────────────────────────────────────────────────────────┐
│                     LEARNING LOOP                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  1. EXECUTE (MiniBob)                                           │
│     ↓                                                            │
│     Capture trace with state deltas, tool calls, impulses       │
│                                                                  │
│  2. STORE (Backend)                                             │
│     ↓                                                            │
│     activity_execution_traces += execution_data                 │
│     variant_performance_metrics += Thompson scores              │
│                                                                  │
│  3. EXTRACT (Ribosome)                                          │
│     ↓                                                            │
│     Select traces → extract template (mechanical)               │
│     POST /v2/ribosome/extract → new template variant            │
│                                                                  │
│  4. SAMPLE (Thompson)                                           │
│     ↓                                                            │
│     alpha/beta updated from execution metrics                   │
│     recommendActivities() uses Beta(α, β) sampling              │
│                                                                  │
│  5. RECOMMEND (Next Execution)                                  │
│     ↓                                                            │
│     MiniBob gets ranked list of activities                      │
│     Selects highest sampled_value (Thompson optimism)           │
│                                                                  │
│  6. REPEAT (Feedback Loop)                                      │
│     Loop → Better scores → Better recommendations               │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Phase 1: Execute (MiniBob)

**Location**: `repos/minibob/src/activity.ts`

What gets captured:
```typescript
{
  execution_id: "exec-123",
  template_id: "fix-bug-v1",
  status: "completed",

  tasks: [
    {
      id: "task-1",
      description: "Read error logs",
      actualPrompt: "...",  // Exact prompt sent to LLM
      toolCalls: [
        {
          name: "read",
          arguments: { filePath: "/logs/error.log" },
          result: { success: true, output: "..." }
        }
      ],
      result: {
        status: "success",
        metadata: {
          inputState: { filesAvailable, variables, impulses },
          outputState: { filesModified, filesCreated },
          stateTransition: { before: {...}, after: {...} }
        }
      }
    }
  ],

  // Metrics
  duration_ms: 45000,
  cost: 0.23,
  tokens: { input: 3000, output: 1500 }
}
```

### Phase 2: Store (Backend)

**Location**: `repos/metabob-activity-api/src/routes/execution-traces.ts`

Backend receives:
```typescript
POST /v2/activities/execution-traces
{
  execution_id: "exec-123",
  template_id: "fix-bug-v1",
  success: true,
  duration_ms: 45000,
  cost: 0.23,
  tokens: { input: 3000, output: 1500 },

  // State tracking
  state_snapshot: {
    input_state: { filesAvailable, impulses },
    output_state: { filesModified, filesCreated },
    stateTransition: { before, after }
  },

  // Impulse tracking
  impulses_used: ["error-log", "source-code"],

  // Tool patterns
  tool_calls: [...]
}
```

Backend updates metrics:
```sql
UPDATE variant_performance_metrics
SET
  total_executions = total_executions + 1,
  successful_executions = successful_executions + 1,
  thompson_alpha = successful_executions + 1,  -- Successes
  thompson_beta = failed_executions + 1,       -- Failures
  success_rate = successful_executions / total_executions,
  updated_at = time::now()
WHERE activity_id = 'fix-bug-v1';
```

### Phase 3: Extract (Ribosome)

**Location**: `repos/metabob-activity-api/src/routes/ribosome.ts`

Mechanical template extraction (NO LLM):
```typescript
// Find successful execution patterns
GET /v2/ribosome/candidates
// Returns:
[
  {
    activity_id: "fix-bug-v1",
    execution_count: 12,
    success_count: 10,
    execution_ids: ["exec-1", "exec-2", ...]
  }
]

// Extract template from traces
POST /v2/ribosome/extract
{
  execution_ids: ["exec-1", "exec-2", "exec-3"],
  name: "fix-bug-pattern-v2",
  category: "bugfix"
}

// Returns new template:
{
  id: "fix-bug-pattern-v2",
  tasks: [
    {
      id: "task-1",
      description: "Read error logs",
      tools: { required: ["read"], optional: [] },
      validation: {
        requiredFiles: ["/logs/error.log"],
        requiredPatterns: ["Error:"]
      }
    }
  ],
  extractedFrom: {
    executionIds: ["exec-1", "exec-2", "exec-3"],
    successRate: 0.90
  },
  confidence: 0.75
}
```

### Phase 4: Sample (Thompson Sampling)

**Location**: `repos/metabob-activity-api/src/routes/activities.ts`

Thompson Sampling selects templates:
```typescript
// For each template variant
const recommendations = templates.map(t => ({
  template_id: t.id,
  thompson_alpha: t.metrics.thompson_alpha,  // Successes + 1
  thompson_beta: t.metrics.thompson_beta,    // Failures + 1
  sampled_value: betaSample(alpha, beta),    // Sample from Beta(α, β)
  success_rate: t.metrics.success_rate
}))

// Sort by sampled value (Thompson optimism)
recommendations.sort((a, b) => b.sampled_value - a.sampled_value)
```

**The Math**:
- **Alpha (α)**: Number of successes + 1 (Bayesian prior)
- **Beta (β)**: Number of failures + 1 (Bayesian prior)
- **Sampling**: Draw from Beta(α, β) distribution
- **Selection**: Highest sampled value wins

**Example**:
```
Template A: 10 successes, 2 failures → Beta(11, 3)
  Sample: 0.78 (high success rate → high expected value)

Template B: 2 successes, 1 failure → Beta(3, 2)
  Sample: 0.62 (fewer trials → more uncertainty)

Template A selected! (higher sampled value)
```

### Phase 5: Recommend (Next Execution)

**Location**: `repos/minibob/src/goal-processor.ts`

MiniBob requests recommendations:
```typescript
POST /v2/activities/recommend
{
  task_description: "fix authentication bug",
  category: "bugfix",
  loaded_impulses: ["error-trace", "source-code"],
  limit: 3
}

// Returns:
[
  {
    template_id: "fix-auth-v3",
    selection_metadata: {
      thompson_alpha: 8,
      thompson_beta: 2,
      sampled_value: 0.78,
      success_rate: 0.875
    }
  },
  {
    template_id: "fix-auth-v2",
    selection_metadata: {
      thompson_alpha: 5,
      thompson_beta: 3,
      sampled_value: 0.61,
      success_rate: 0.625
    }
  }
]
```

MiniBob selects top recommendation and executes it.

### Phase 6: Repeat (Feedback Loop)

The cycle closes:
1. Execution generates trace
2. Trace updates Thompson scores
3. Better scores = higher selection probability
4. More selections = more data
5. More data = better recommendations

**Why it's self-improving**:
- Successful activities get higher α → higher expected sample → more trials
- More trials generate more data → more confidence in scores
- Ribosome extracts successful patterns → new templates enter competition
- Thompson Sampling balances exploration (try new templates) vs exploitation (use known-good templates)

---

## Demonstrating the Loop

### Quick Demo Script

```bash
./scripts/demonstrate-learning-loop.sh
```

This script shows all 6 phases in action:
1. Executes an activity with MiniBob
2. Verifies trace storage in backend
3. Checks Thompson Sampling score updates
4. Gets activity recommendations
5. Shows impulse relevance tracking
6. Displays ribosome extraction candidates

### Manual Demonstration

#### Step 1: Execute an Activity

```bash
cd /tmp/demo-workspace
minibob --single "Create a TypeScript function that adds two numbers"
```

Observe the execution trace being captured.

#### Step 2: Check Backend Storage

```bash
curl -H "Authorization: ApiKey $METABOB_API_KEY" \
  https://activity.metabob.com/v2/activities/execution-traces?limit=5
```

Your execution should appear in the traces.

#### Step 3: View Thompson Sampling Scores

```bash
curl -H "Authorization: ApiKey $METABOB_API_KEY" \
  https://activity.metabob.com/v2/activities/templates?limit=10
```

Look for `thompson_alpha`, `thompson_beta`, and `success_rate` fields.

#### Step 4: Get Recommendations

```bash
curl -X POST \
  -H "Authorization: ApiKey $METABOB_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "task_description": "create TypeScript function",
    "category": "feature",
    "limit": 5
  }' \
  https://activity.metabob.com/v2/activities/recommend
```

Templates are ranked by `sampled_value` (Thompson Sampling).

#### Step 5: Check Impulse Relevance

```bash
curl -H "Authorization: ApiKey $METABOB_API_KEY" \
  "https://activity.metabob.com/v2/activities/impulse-relevance?limit=10"
```

Shows which impulses improve success rates.

#### Step 6: View Ribosome Candidates

```bash
curl -H "Authorization: ApiKey $METABOB_API_KEY" \
  https://activity.metabob.com/v2/ribosome/candidates
```

Shows execution patterns ready for extraction.

---

## Observing Learning in Action

### Track Thompson Sampling Evolution

Run the same activity multiple times and watch scores update:

```bash
# Execute 5 times
for i in {1..5}; do
  minibob --single "fix authentication bug"
  sleep 5
done

# Check score evolution
curl -H "Authorization: ApiKey $METABOB_API_KEY" \
  https://activity.metabob.com/v2/activities/templates/fix-auth-v1 | \
  jq '.metrics | {alpha, beta, success_rate, total_executions}'
```

You'll see:
- `thompson_alpha` increases with each success
- `thompson_beta` increases with each failure
- `success_rate` converges to true performance
- Template ranking changes as scores stabilize

### Watch Impulse Relevance Learning

Compare success rates with/without specific impulses:

```bash
# Execution 1: With error logs
minibob --single "fix bug" --impulses error-logs,source-code

# Execution 2: Without error logs
minibob --single "fix bug" --impulses source-code

# Check relevance
curl -H "Authorization: ApiKey $METABOB_API_KEY" \
  "https://activity.metabob.com/v2/activities/impulse-relevance?impulse_id=error-logs"
```

System learns:
```json
{
  "impulse_id": "error-logs",
  "times_loaded": 20,
  "times_execution_succeeded": 18,
  "times_not_loaded_succeeded": 5,
  "relevance_score": 0.9,      // Success when loaded
  "irrelevance_score": 0.5,    // Success when NOT loaded
  "impact": 0.4                // Impulse adds 40% success probability
}
```

### Monitor Ribosome Extractions

Watch templates being extracted from successful executions:

```bash
# Check candidates
curl -H "Authorization: ApiKey $METABOB_API_KEY" \
  https://activity.metabob.com/v2/ribosome/candidates

# Extract template
curl -X POST \
  -H "Authorization: ApiKey $METABOB_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "execution_ids": ["exec-1", "exec-2", "exec-3"],
    "name": "extracted-fix-pattern",
    "category": "bugfix"
  }' \
  https://activity.metabob.com/v2/ribosome/extract

# Verify new template appears in recommendations
curl -X POST \
  -H "Authorization: ApiKey $METABOB_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "task_description": "fix bug",
    "category": "bugfix",
    "limit": 10
  }' \
  https://activity.metabob.com/v2/activities/recommend | \
  jq '.recommendations[] | select(.template_id | contains("extracted"))'
```

The extracted template immediately enters Thompson Sampling competition!

---

## Key Insights

### Validation is Deterministic

- **No LLM needed** for most validation checks
- **Fast-fail** on impossible tasks
- **Skip work** when expectations already met
- **Comprehensive metrics** capture everything for learning

### Learning is Continuous

- **Every execution** updates Thompson scores
- **Ribosome extracts** successful patterns automatically
- **Impulse relevance** tracks what helps vs hurts
- **Feedback loop** continuously improves recommendations

### The Loop Never Stops

Even "completed" activities feed learning that immediately improves the next execution. The instance becomes the vessel for the next transformation in a continuous loop.

This is the **process-of-becoming** in action: continuous transformation through measured execution.
