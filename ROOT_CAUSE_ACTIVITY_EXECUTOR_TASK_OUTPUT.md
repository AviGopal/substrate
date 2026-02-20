# Root Cause: Activity Executor Not Capturing Task Outputs

**Date**: 2026-02-20  
**Issue**: manage-session-memory activities fail after task 1  
**Diagnosis By**: User observation - "looks like an issue with the activity executor not feeding in the next tasks into the same activity session"

## Problem Statement

The activity executor **stops after the first task** in multi-task activities. Evidence:

```
Activity: act_mlun9tpt_1018f6ac1559ce1a
Template: manage-session-memory (5 tasks)
Status: failed

Execution Evidence:
- Sessions Spawned: 1 (only task: analyze-intent)
- Expected: 5 sessions (one per task)
```

## Root Cause Analysis

### 1. Task Output Variables Not Captured ❌

**File**: `repos/metabob-opencode/packages/opencode/src/tool/activity.ts`  
**Lines**: 1994-2166 (TaskTool execution block)

The activity executor executes `TaskTool.execute()` but **does not capture the task output** and make it available to subsequent tasks.

**Evidence from template**:
```json
{
  "id": "create-impulses",
  "dependencies": ["analyze-intent"],
  "prompt": "Create impulses based on the intent analysis.\n\n## Intent Analysis Results\n\n{{analyzeIntentOutput}}\n\n..."
}
```

Task 2 references `{{analyzeIntentOutput}}` (the output from task 1), but this variable is **never created**.

### 2. Variable Interpolation Failure

When the executor tries to interpolate task 2's prompt:

1. Calls `ActivityTemplate.interpolatePrompt(task.prompt.template, enrichedVariables)` (line 1915)
2. Template contains `{{analyzeIntentOutput}}`
3. Variable `analyzeIntentOutput` doesn't exist in `enrichedVariables`
4. Interpolation throws an error
5. Caught by catch block at line 2167
6. Early return at line 2199 stops all subsequent tasks

### 3. Code Evidence

**After TaskTool.execute() (line 2014)**:
```typescript
const taskResult = await taskToolDef.execute(...)

// Check abort signal after completion
if (abortSignal.aborted) {
  throw new Error("Activity execution aborted by user")
}

const duration = Date.now() - startTime

// Extract metrics from TaskTool result (using shared helper)
const metrics = await extractMetricsFromSession(sessionID)
const tokens = metrics.tokens
const cost = metrics.cost
```

**Missing**:
```typescript
// ❌ NOT PRESENT - should capture task output:
// const outputVariableName = toCamelCase(taskId) + "Output"
// variables[outputVariableName] = taskResult.response || taskResult.output
```

### 4. Impact on Multi-Task Activities

**Any activity with task dependencies fails** because:
1. Task 1 executes successfully
2. Task 1 output not captured
3. Task 2 tries to reference `{{task1NameOutput}}`
4. Variable not found → interpolation error
5. Activity fails, tasks 2-N never execute

## The Fix

### Required Changes

**File**: `repos/metabob-opencode/packages/opencode/src/tool/activity.ts`  
**Location**: After line 2032 (after metrics extraction)

```typescript
// After extracting metrics (line 2032)
totalTokens.cache += tokens.cache

// ✅ ADD THIS: Capture task output for subsequent tasks
// Convert task ID to camelCase and append "Output" suffix
// Example: "analyze-intent" → "analyzeIntentOutput"
const outputVariableName = taskId
  .split('-')
  .map((word, i) => i === 0 ? word : word.charAt(0).toUpperCase() + word.slice(1))
  .join('') + 'Output'

// Extract output from taskResult (response text or structured output)
const taskOutput = taskResult.response || taskResult.output || ''

// Add to variables for subsequent tasks
variables[outputVariableName] = taskOutput

log.debug("captured task output as variable", {
  taskId,
  variableName: outputVariableName,
  outputLength: taskOutput.length,
})
```

### Alternative: Use Shared Variables Object

Instead of mutating the `variables` object, create a `taskOutputs` object that's merged with variables during interpolation:

```typescript
const taskOutputs: Record<string, string> = {}

// In task execution loop, after each task completes:
const outputVariableName = toCamelCase(taskId) + 'Output'
taskOutputs[outputVariableName] = taskResult.response || ''

// When interpolating (line 1915):
const enrichedVariables = {
  ...mergedVariables,
  ...impulseMetadata,
  ...taskOutputs,  // ✅ Include task outputs
}
```

## Testing the Fix

### 1. Verify with manage-session-memory Activity

Run the manage-session-memory activity and check:

```bash
# Find activity
ACTIVITY=$(find ~/.local/share/opencode/storage/activity -name "*.json" -exec grep -l "manage-session-memory" {} \; | head -1)

# Check sessions spawned
cat "$ACTIVITY" | jq '.executionEvidence.sessionsSpawned | length'

# Expected: 5 (one per task)
# Current: 1 (only analyze-intent)
```

### 2. Check Task Results

```bash
cat "$ACTIVITY" | jq '.executionEvidence.sessionsSpawned[] | {taskId, messageCount}'
```

Expected output:
```json
{"taskId": "analyze-intent", "messageCount": 3}
{"taskId": "create-impulses", "messageCount": 3}
{"taskId": "review-context-space", "messageCount": 3}
{"taskId": "optimize-if-needed", "messageCount": 3}
{"taskId": "finalize-context", "messageCount": 3}
```

### 3. Verify Impulse Creation

After fix, check that impulses were created:

```bash
cat "$ACTIVITY" | jq '.impulses | keys | length'

# Expected: > 0 (impulses created by memory agent)
# Current: 0 (no impulses)
```

## Impact on Lifecycle Hook

Once this fix is applied:

1. ✅ manage-session-memory activity will complete all 5 tasks
2. ✅ Memory agent will create impulses (task 2)
3. ✅ Impulses will be transferred to parent session
4. ✅ Session memory files will be created
5. ✅ Lifecycle hook will provide context to main agent

## Related Issues

This affects **all activity templates with task dependencies**:

- manage-session-memory (infrastructure)
- Any template where task N references `{{taskMOutput}}` from earlier task M
- Templates using task chaining patterns

## Implementation Priority

**CRITICAL** - This breaks the entire activity system for multi-task workflows.

Without this fix:
- Only single-task activities work
- Multi-task activities fail silently after task 1
- Session memory agent cannot function
- Impulse-driven context system is blocked

## Summary

**Root Cause**: Activity executor doesn't capture task outputs as variables  
**Impact**: Multi-task activities fail after task 1  
**Fix**: Capture `taskResult` and add to `variables` with naming convention  
**Naming**: `taskId` → `camelCaseTaskIdOutput` (e.g., `analyze-intent` → `analyzeIntentOutput`)  
**Location**: After line 2032 in activity.ts  
**Priority**: CRITICAL - blocks entire context optimization system
