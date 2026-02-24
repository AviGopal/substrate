# Validation Fix Continuation: Error Handling Improvements

## Context

We fixed validation to actually validate (throw errors), now continuing to ensure errors are properly captured and reported.

## Fixes Applied

### Fix 1: Add Error Handling to Legacy Validation ✅

**Problem**: Legacy validation (`runValidation`) had no try-catch, causing errors to bubble up uncaught.

**Solution**: Added try-catch with proper error logging (commit 1010da34)

```typescript
// Before:
if (task.validation && !task.validation.preChecks && !task.validation.postChecks) {
  log.debug("running legacy task validation", { taskId })
  await runValidation(task, mergedVariables)  // ❌ NO ERROR HANDLING!
}

// After:
if (task.validation && !task.validation.preChecks && !task.validation.postChecks) {
  try {
    log.debug("running legacy task validation", { taskId })
    await runValidation(task, mergedVariables)
    log.debug("legacy task validation passed", { taskId })
  } catch (error) {
    log.error("legacy task validation failed", { taskId, error })
    throw new Error(`Validation failed: ${error instanceof Error ? error.message : String(error)}`)
  }
}
```

### Fix 2: Capture and Propagate Task Error Messages ✅

**Problem**: When tasks failed, `executeTemplate` returned `success: false` but didn't include the error message.

**Solution**: Added error field to return value and saved to activity (commit 98b28468)

```typescript
// In executeTemplate catch block:
return {
  success: false,
  tasks: taskResults,
  totalDuration,
  totalCost,
  totalTokens,
  error: error instanceof Error ? error.message : String(error),  // ✅ ADDED!
}

// In ActivityTool execute:
if (!result.success && (result as any).error) {
  activity.error = (result as any).error  // ✅ SAVE ERROR!
}
```

## Remaining Mystery: Task 3 Fails with 0.0s Duration

### Observations

**Consistent behavior across multiple runs**:
- Task 1: ✅ Completes (creates REQUIREMENTS.md)
- Task 2: ✅ Completes (creates TASK_GRAPH.md with all required patterns)
- Task 3: ❌ Fails immediately (0.0s duration, no session spawned)

**Error state**:
- `activity.error`: null
- `activity.errorStack`: null
- No error logs in dev.log
- No "executing task" log for task 3

### What This Means

Task 3 is failing **before the task execution try-catch block**, which means:

1. ❌ NOT task execution failure (would have duration > 0)
2. ❌ NOT validation failure (would be caught by our new error handling)
3. ✅ **Pre-execution check failure** (before task loop starts task 3)

### Possible Causes

1. **Task dependency resolution issue** - Maybe task 2 isn't marked as complete properly?
2. **Agent lookup failure** - Agent for task 3 can't be found?
3. **Tool validation failure** - Task 3 requires tools that aren't available? (but we checked - it has no tool requirements)
4. **Session creation failure** - Can't create session for task 3?
5. **Variable interpolation failure** - Task 3 prompt fails to interpolate?

### Next Debugging Steps

**Option 1: Add more granular logging**
- Log BEFORE each task starts in the loop
- Log after dependency check
- Log after agent lookup
- Log after tool validation
- Narrow down exactly where it fails

**Option 2: Simplify task 3**
- Create a minimal version with empty prompt
- See if it's the prompt content causing issues
- Rule out prompt interpolation problems

**Option 3: Check task ordering**
- Verify topological sort includes task 3
- Check if task 3 is being skipped in the loop
- Verify dependencies are correct

## What We Know Works

✅ **Validation system** - Checks files and patterns correctly
✅ **Error handling** - Legacy validation now has try-catch
✅ **Error propagation** - Task failures now capture error messages
✅ **Tasks 1 & 2** - Execute successfully and create outputs

## What Doesn't Work Yet

❌ **Task 3 execution** - Fails before even starting (0.0s duration)
❌ **Error visibility** - No error message captured for task 3 failure
❌ **Multi-task completion** - Can't complete activities with 3+ tasks

## Hypothesis

The issue is likely in the **task loop initialization** or **pre-execution validation** that happens between task 2 completing and task 3 starting. Since there's no error message, it's probably a **silent failure** or **early return** rather than an exception.

## Commits

1. `1010da34` - fix(activity): Add error handling to legacy validation
2. `98b28468` - fix(activity): Capture and propagate task failure error messages

## Status

🟡 **Partial Progress** - Error handling improved, but task 3 failure root cause still unknown

---

**Next**: Add detailed logging to trace exact failure point for task 3
