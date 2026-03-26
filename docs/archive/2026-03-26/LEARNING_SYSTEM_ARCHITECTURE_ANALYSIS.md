# Learning System Architecture Analysis

## Current State: What IS Being Stored

### ✅ Lightweight Execution Records (`/v2/activities/executions`)
**Stored Data**:
- `variant_id`: Template identifier
- `success`: Boolean (completed vs failed)
- `duration_ms`: Execution time
- `cost`: USD cost (currently null)
- `tokens`: {input, output, cache}
- `error_message`: If failed
- `error_type`: Classification of failure
- `failed_task_id`: Which task failed
- `impulses_used`: Array of impulse IDs
- `executed_at`: Timestamp

**Current Volume**: 10+ executions stored

**Purpose**: Thompson Sampling α/β parameter updates
- Success → increment α
- Failure → increment β
- Probability = α / (α + β)

### ✅ Activity Templates (`/v2/activities/templates`)
**Stored Data**:
- `variant_id`: Unique template ID
- `activity_id`: Base activity (for genealogy)
- `variant_name`: Human-readable name
- `description`: What it does
- `category`: feature/bugfix/refactor/tool/infrastructure
- `task_steps`: Array of task definitions
- `scope`: global/project/org
- `thompson_alpha`, `thompson_beta`: Selection parameters
- `total_executions`, `successful_executions`: Counters
- `avg_duration_ms`, `avg_cost_usd`: Performance metrics

**Current Volume**: 5 templates (3 broken with old bug, 2 working)

**Purpose**: Template library + Thompson Sampling selection

### ✅ Tool Usage Patterns (`/v2/activities/tool-usage`)
**Stored**: Which tools were called in which templates

**Purpose**: Understanding tool call patterns for optimization

### ✅ Activity Composition (`/v2/activities/composition`)
**Stored**: Which activities call other activities

**Purpose**: Composition graph for complex behaviors

## Critical Gap: Execution Traces Not Being Recorded

### ❌ Detailed Execution Traces (`/v2/activities/execution-traces`)
**Should Store**:
- Full task execution details
  - Actual prompts sent
  - LLM responses received
  - Tool calls made (with arguments and results)
  - State transitions (before/after file hashes)
  - Input/output state for each task
  - Validation results
- Impulses created during execution
- Files modified/created/deleted
- Goal context (what triggered this)
- Complete execution flow

**Current Volume**: 0 (not implemented!)

**Missing Implementation**:
1. MiniBob never populates `execution.executionTrace`
2. Code checks `if (execution.executionTrace)` but it's always undefined
3. Ribosome pattern (`assembleTemplateFromExecution`) requires executionTrace
4. Debugging-as-activity requires executionTrace

## Biological Analogy: What We're Building

### Protein Sequences (Activity Templates)
- **Amino acids** = Individual tasks
- **Protein folding** = Task dependencies and execution order
- **Protein function** = Goal achieved
- **Protein variants** = Template variants (via Thompson Sampling)
- **Protein interactions** = Activity composition

### Evolutionary Mechanisms

#### 1. Variation Generation (LLM-Guided)
**NOT purely random** - LLM winnows search space based on:
- Learned weights (what patterns typically work)
- Execution history (what failed before)
- Context (current goal, available tools, file state)
- Constraints (maxCost, maxTasks, preferComposition)

**Process**:
```
Goal → LLM proposes plausible decomposition → Improvised template
      ↓
   Not trusted until proven by execution!
```

#### 2. Selection (Thompson Sampling)
**Ground truth from execution data**, not LLM reasoning:
- Success rate (α / (α + β))
- Cost efficiency (avg_cost_usd)
- Duration (avg_duration_ms)
- Error patterns (which tasks fail)

**Process**:
```
Template library → Thompson Sampling → Selected template
                 ↓
              Execute in reality
                 ↓
              Success/Failure observed
                 ↓
              Update α/β parameters
```

#### 3. Composition (Complex from Simple)
**Reusability** - Templates call templates:
```
deploy-activity-system
  ├─ verify-helm-directory (simple: list files)
  ├─ run-helmfile-sync (simple: bash command)
  └─ verify-deployment (composition: check-pods + health-checks)
```

**Emergent Capabilities**:
- Simple behaviors compose into complex behaviors
- Composition graph shows which patterns work together
- Failed compositions teach us about incompatibilities

#### 4. Learning (Experience-Based)
**What we need to store**:
1. **Hypotheses** (LLM-generated templates) - HAVE ✅
2. **Outcomes** (success/fail metrics) - HAVE ✅
3. **Execution Details** (what actually happened) - MISSING ❌
4. **Composition Patterns** (which work together) - HAVE ✅

## Why Execution Traces Matter

### Use Case 1: Ribosome Pattern
**Extract templates from successful goal executions**:
```
Goal: "Deploy backend"
  → Execute tasks improvisationally
  → Success!
  → Ribosome reads executionTrace
  → Generates "deploy-backend" template
  → New reusable capability
```

**Requires**: Full task execution details (prompts, tool calls, state)

### Use Case 2: Debugging-as-Activity
**Auto-fix failures**:
```
Template: "upgrade-component"
  → Execute
  → Task 2 fails
  → System reads executionTrace
  → Creates debug activity: "Fix upgrade-component task 2"
  → Debug activity analyzes failure
  → Proposes fix
  → Creates variant "upgrade-component-v2"
```

**Requires**: Error context, tool outputs, state transitions

### Use Case 3: Pattern Recognition
**Learn what works**:
```
Execution 1: Used "bash + write" → Success
Execution 2: Used "bash + write" → Success  
Execution 3: Used "edit + bash" → Failed
  → Pattern: "write is more reliable than edit for file creation"
  → Future templates prefer write
```

**Requires**: Tool call sequences and outcomes

### Use Case 4: Composition Learning
**Understand dependencies**:
```
Activity A calls Activity B
  → Execution trace shows:
    - Files created by A
    - Files read by B
    - State transition: A's output → B's input
  → Learn: "A must run before B, produces files X,Y"
```

**Requires**: State transitions between composed activities

## What Needs to Be Implemented

### Priority 1: Enable Execution Trace Recording in MiniBob

**File**: `repos/minibob/src/activity.ts`

**Changes Needed**:
1. Populate `execution.executionTrace` during execution
2. Capture for each task:
   - `actualPrompt`: Rendered prompt sent to LLM
   - `response`: LLM response
   - `toolCalls`: Array of {tool, arguments, result}
   - `inputState`: {filesAvailable, environment, impulses, variables}
   - `outputState`: {filesModified, filesCreated, filesDeleted, exitCode, stderr}
   - `stateTransition`: {before: fileHashes, after: fileHashes, workingDirectory}
   - `validationResults`: What validation checks passed/failed
3. Call `mcp.storeExecutionTrace(execution)` after populating

**Implementation Sketch**:
```typescript
// In executeActivity(), after task loop:
execution.executionTrace = {
  tasks: this.executedTaskDetails, // Collected during execution
  impulsesCreated: this.impulsesCreated.map(i => i.id),
  filesModified: this.filesModified,
  goalContext: this.currentGoalContext ? {
    goal: this.currentGoalContext,
    intent: this.currentGoalIntent,
    createdAt: Date.now()
  } : undefined
}

// Send to backend
if (execution.executionTrace) {
  await mcp.storeExecutionTrace(execution)
}
```

### Priority 2: Verify Backend Stores Traces Correctly

**File**: `repos/metabob-activity-api/src/routes/activities.ts`

**Endpoint**: `POST /v2/activities/execution-traces`

**Verify**:
1. Schema validation works (StoreExecutionTraceRequestSchema)
2. SurrealDB table `execution_traces` defined
3. Data persists correctly
4. Query endpoint `GET /v2/activities/execution-traces` works

### Priority 3: Enable Ribosome Pattern

**File**: `repos/minibob/src/template-generator.ts`

**Function**: `assembleTemplateFromExecution()`

**Currently**: Requires `execution.executionTrace`

**Once traces available**: Can extract templates from successful goal executions

### Priority 4: Enable Debugging-as-Activity

**File**: `repos/minibob/src/goal-processor.ts` (or new debug module)

**Flow**:
1. Activity fails
2. Load executionTrace from backend
3. Analyze failure (which task, what error, what state)
4. Create debug activity: "Fix {templateId} {failedTask}"
5. Debug activity proposes fix
6. Create variant with fix
7. Retry

## Summary: The Learning Loop

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│  1. HYPOTHESIS GENERATION (LLM-guided, not random)             │
│     Goal → LLM → Plausible template decomposition              │
│     Context: execution history + learned patterns + constraints │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  2. REALITY TEST (Execute in actual environment)               │
│     Template → Execute tasks → Observe outcome                  │
│     Ground truth: Does it actually work?                        │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  3. DATA COLLECTION (What we NEED to improve)                  │
│     ✅ Lightweight metrics (success, duration, cost)            │
│     ❌ Execution traces (what happened, why it failed)          │
│     ✅ Tool usage patterns                                      │
│     ✅ Composition relationships                                │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  4. LEARNING (Update beliefs based on evidence)                │
│     ✅ Thompson Sampling (α/β updates)                          │
│     ❌ Ribosome (extract working patterns)                      │
│     ❌ Debug-as-activity (auto-fix failures)                    │
│     ✅ Composition graph (which combos work)                    │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  5. SELECTION (Choose next action)                             │
│     Goal + Context → Thompson Sampling → Select template       │
│     Probability based on measured success, not LLM confidence   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
        │
        └──> Back to step 2 (Execute selected template)
```

**Key Insight**: We trust LLM to generate plausible hypotheses (winnowing search space), but we ONLY trust execution data for learning what works. The LLM doesn't know "reality's structure" - only execution reveals that.

## Next Steps

1. **Implement execution trace recording** in MiniBob activity executor
2. **Verify traces store correctly** in backend
3. **Enable ribosome pattern** to extract templates from successful executions
4. **Build debugging-as-activity** to auto-fix failures
5. **Demonstrate full learning loop**: goal → improvise → execute → trace → learn → improve

This will complete the biological analogy: variation (LLM), selection (Thompson Sampling), and heredity (template extraction via ribosome).
