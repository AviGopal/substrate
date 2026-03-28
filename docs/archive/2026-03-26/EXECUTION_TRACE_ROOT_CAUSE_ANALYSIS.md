# Root Cause Analysis: Execution Traces Not Persisting

**Date**: 2026-03-22
**Severity**: **CRITICAL** - Breaks Instance → Learning feedback loop
**Status**: Root cause identified

## Problem Statement

MiniBob reports "✓ Execution reported to backend" but backend query shows 0 execution traces:

```bash
# MiniBob says:
[Activity] ✓ Execution reported to backend

# But backend shows:
GET /v2/activities/execution-traces?limit=10
Response: { "total": 0, "executions": [] }
```

## Root Cause

**The `executionTrace` field is never initialized, so trace storage is always skipped.**

### Code Flow Analysis

#### 1. ActivityExecution Object Creation
**File**: `repos/minibob/src/activity.ts:383-391`

```typescript
const execution: ActivityExecution = {
  id: activityId,
  templateId: template.id,
  status: "executing",
  variables,
  impulses: [],
  taskResults: [],
  startedAt: Date.now(),
  // ❌ executionTrace field is NEVER initialized
}
```

#### 2. Conditional Trace Storage
**File**: `repos/minibob/src/activity.ts:512-520`

```typescript
// Store execution trace for debugging-as-activity
if (execution.executionTrace) {  // ❌ ALWAYS FALSE - never initialized!
  console.log(`[Activity] Storing execution trace...`)
  const traceStored = await mcp.storeExecutionTrace(execution)
  if (traceStored) {
    console.log(`[Activity] ✓ Execution trace stored: ${execution.id}`)
  } else {
    console.warn(`[Activity] ⚠ Failed to store execution trace`)
  }
}
```

#### 3. Type Definition Shows It's Optional
**File**: `repos/minibob/src/types.ts:175-193`

```typescript
export interface ActivityExecution {
  id: string
  templateId: string
  status: ActivityStatus
  variables: Record<string, unknown>
  impulses: Impulse[]
  taskResults: TaskResult[]
  startedAt: number
  completedAt?: number
  error?: string
  executionTrace?: ExecutionTrace  // ❌ Optional, with comment "if recording enabled"
  metrics?: {
    duration: number
    cost: number
    totalTokens: { input: number; output: number }
  }
}
```

**Comment on line 186**: `/** Execution trace (if recording enabled) */`
This suggests trace recording was intended to be toggleable, but no toggle was implemented.

## Why This Happens

### Two Different Reporting Mechanisms

MiniBob has **two separate methods** for reporting execution data:

#### Method 1: `reportExecution()` - Metrics Only ✅ WORKING
**File**: `repos/minibob/src/mcp.ts:216-259`

```typescript
async reportExecution(execution: ActivityExecution): Promise<boolean> {
  // Posts to /v2/activities/executions (NOT /execution-traces)
  const payload = {
    variant_id: execution.templateId,
    success: execution.status === "completed",
    duration_ms: execution.metrics?.duration || 0,
    cost: execution.metrics?.cost || 0,
    tokens: { ... },
    // Minimal data - just metrics
  }

  const response = await this.request("POST", "/v2/activities/executions", payload)
  // ✅ This succeeds - updates template_metrics table
}
```

**This is what we see succeeding**:
```
[Activity] ✓ Execution reported to backend
```

**Result**: Template metrics update (success_rate, execution_count, Thompson alpha/beta)

#### Method 2: `storeExecutionTrace()` - Full Trace ❌ NEVER CALLED
**File**: `repos/minibob/src/mcp.ts:591-618`

```typescript
async storeExecutionTrace(execution: ActivityExecution): Promise<boolean> {
  // Posts to /v2/activities/execution-traces (different endpoint)
  const response = await this.request("POST", "/v2/activities/execution-traces", {
    execution_id: execution.id,
    template_id: execution.templateId,
    status: execution.status,
    duration_ms: execution.metrics?.duration || 0,
    cost_usd: execution.metrics?.cost || 0,
    execution_trace: execution.executionTrace || {  // ❌ Always empty object
      tasks: [],
      impulsesCreated: [],
      filesModified: [],
    },
  })
  // ❌ This is never called because execution.executionTrace is undefined
}
```

**This is never logged** because the conditional at line 512 is never true.

## Database Schema Mismatch

There's also a **table name mismatch** between schema and route:

### Schema Definition
**File**: `repos/metabob-activity-api/sql/004-execution-traces.surql`

```sql
DEFINE TABLE execution_traces SCHEMAFULL;
DEFINE FIELD template_id ON execution_traces TYPE string;
```

### Route Query
**File**: `repos/metabob-activity-api/src/routes/execution-traces.ts:167`

```typescript
const query = `
  SELECT * FROM activity_execution_traces  -- ❌ Different table name!
  ${whereClause}
  ORDER BY executed_at DESC
  LIMIT $limit
  START $offset
`;
```

**Expected table**: `execution_traces`
**Actual query**: `activity_execution_traces`

This mismatch means even if traces were sent, they'd go to the wrong table.

## Impact Analysis

### What's Broken

1. **Full execution traces** (task-by-task details, state transitions, tool calls) - **NOT STORED**
2. **Ribosome pattern** (extracting templates from successful executions) - **INCOMPLETE**
3. **Debugging-as-activity** (loading failed execution traces as impulses) - **IMPOSSIBLE**
4. **Dashboard execution history** - **EMPTY**

### What's Working

1. **Template metrics** (success rate, execution count) - **WORKING**
2. **Thompson Sampling** (alpha/beta learning) - **WORKING**
3. **Tool usage tracking** - **WORKING**
4. **Composition graphs** - **WORKING**

## Why Metrics Still Work

Template metrics are updated via a **different endpoint**:

```
MiniBob: POST /v2/activities/executions → Backend updates template_metrics
MiniBob: POST /v2/activities/execution-traces → Backend stores full traces (NEVER CALLED)
```

So we get:
- ✅ Success rates updating
- ✅ Thompson Sampling learning
- ❌ No execution history
- ❌ No detailed traces for debugging

## Fixes Required

### Fix 1: Initialize executionTrace During Execution

**File**: `repos/minibob/src/activity.ts`

**Current** (line 383-391):
```typescript
const execution: ActivityExecution = {
  id: activityId,
  templateId: template.id,
  status: "executing",
  variables,
  impulses: [],
  taskResults: [],
  startedAt: Date.now(),
}
```

**Proposed**:
```typescript
const execution: ActivityExecution = {
  id: activityId,
  templateId: template.id,
  status: "executing",
  variables,
  impulses: [],
  taskResults: [],
  startedAt: Date.now(),
  executionTrace: {
    tasks: [],
    impulsesCreated: [],
    filesModified: [],
  },
}
```

**Impact**: Enables trace storage for all executions

### Fix 2: Populate executionTrace During Task Execution

Need to add code to populate the trace as tasks execute:

```typescript
// After each task completes
execution.executionTrace.tasks.push({
  taskId: task.id,
  description: task.description,
  inputState: { ... },
  outputState: { ... },
  stateTransition: { ... },
  toolCalls: [ ... ],
  prompt: actualPrompt,
  response: llmResponse,
})
```

### Fix 3: Fix Table Name Mismatch

**Option A**: Update schema to match route
```sql
-- Rename table
ALTER TABLE execution_traces RENAME TO activity_execution_traces;
```

**Option B**: Update route to match schema
```typescript
// Change query from:
SELECT * FROM activity_execution_traces
// To:
SELECT * FROM execution_traces
```

**Recommendation**: Option B (update route) - schema was defined first, route should match

### Fix 4: Verify POST Endpoint Exists

Check that backend has POST handler for `/v2/activities/execution-traces`:

```typescript
// Should exist in routes/execution-traces.ts
app.post('/', async (c) => {
  // Insert into execution_traces table
})
```

If missing, implement it.

## Testing Plan

After fixes:

1. **Run simple activity**:
   ```bash
   cd repos/minibob
   bun run index.ts run templates/hello-world.json
   ```

2. **Verify trace storage**:
   ```bash
   curl -s 'http://api.minibob.local/v2/activities/execution-traces?limit=1' | jq .
   ```

   **Expected**: `{ "total": 1, "executions": [...] }`

3. **Verify trace content**:
   ```bash
   curl -s 'http://api.minibob.local/v2/activities/execution-traces/<execution_id>' | jq .
   ```

   **Expected**: Full trace with tasks, state transitions, tool calls

4. **Verify dashboard display**:
   - Open `http://dashboard.minibob.local`
   - Navigate to "Executions" tab
   - Should see execution history

## Priority

**CRITICAL** - This is the missing link in the intention flow:

```
GOAL → VESSEL → BECOMING → INSTANCE → [BROKEN HERE] → LEARNING → VESSEL'
```

Without execution traces:
- Cannot extract patterns for ribosome
- Cannot debug failures with impulses
- Cannot verify state transitions
- Cannot demonstrate continuous improvement

**Recommendation**: Fix immediately to restore full intention flow.
