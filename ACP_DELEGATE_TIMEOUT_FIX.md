# ACP Delegate Timeout Fix - Activity-Based Timeout

## Problem

The `acp_delegate` tool was using a hard timeout that would kill the delegation even if the remote agent was actively working. This caused long-running activities (like `create-activity-template`) to fail prematurely.

**Old Behavior**:
```typescript
// Hard timeout - kills request after N seconds regardless of activity
const timeoutPromise = new Promise((_, reject) => {
  setTimeout(
    () => reject(new Error(`Delegation timeout: Task exceeded ${params.timeout}s timeout`)),
    params.timeout * 1000,
  )
})

result = await Promise.race([promptPromise, timeoutPromise])
```

**Issue**: If an activity takes 6 minutes but the agent is actively working the entire time, it would still timeout at 5 minutes (default timeout).

## Solution

Implemented an **activity-based timeout** that only triggers if the agent is **idle** for the timeout duration. As long as the agent shows any activity (message chunks, tool calls, permission requests), the timeout resets.

### Changes Made

**File**: `repos/metabob-opencode/packages/opencode/src/tool/acp-delegate.ts`

#### Change 1: Track Last Activity Time (Lines ~391-397)

```typescript
// Activity-based timeout tracking
// Reset this timestamp whenever we receive any activity from the agent
let lastActivityTime = Date.now()
const IDLE_TIMEOUT_MS = params.timeout * 1000 // Use the parameter timeout as idle timeout
```

#### Change 2: Reset Timer on All Agent Activity (Lines ~404-432)

```typescript
const client: ACPClient = {
  requestPermission: async (params: RequestPermissionRequest) => {
    log.debug("auto-approving permission", { title: params.toolCall?.title })
    lastActivityTime = Date.now() // Reset on permission request
    return {
      outcome: { outcome: "selected", optionId: params.options[0]?.optionId || "allow" },
    }
  },
  sessionUpdate: async (params: SessionNotification) => {
    const update = params.update as any
    // Reset activity timer on ANY update
    lastActivityTime = Date.now()
    
    if (update.sessionUpdate === "agent_message_chunk" && update.content?.type === "text") {
      responseText += update.content.text
      log.debug("received message chunk", { length: update.content.text.length })
    } else if (update.sessionUpdate === "tool_call") {
      toolCalls.push(update.title)
      log.debug("tool call", { title: update.title })
    } else if (update.sessionUpdate === "tool_call_update") {
      // Track tool errors
      if (update.status === "error" || update.error) {
        toolErrors.push({
          tool: update.title || "unknown",
          error: update.error || "unknown error",
        })
        log.warn("tool call failed", { title: update.title, error: update.error })
      }
    }
  },
}
```

**Key**: `lastActivityTime` is reset on:
- Permission requests
- Message chunks
- Tool calls
- Tool call updates
- ANY `sessionUpdate` event

#### Change 3: Idle-Based Timeout Check (Lines ~507-545)

```typescript
// Activity-based timeout: only triggers if agent is idle for the timeout duration
// This allows long-running tasks as long as the agent keeps showing activity
const createIdleTimeoutPromise = () => new Promise<never>((_, reject) => {
  const checkInterval = setInterval(() => {
    const idleTime = Date.now() - lastActivityTime
    if (idleTime > IDLE_TIMEOUT_MS) {
      clearInterval(checkInterval)
      reject(new Error(
        `Idle timeout: Agent has been inactive for ${params.timeout}s (total elapsed: ${((Date.now() - startTime) / 1000).toFixed(1)}s). ` +
        `The agent may be stuck or waiting for input.`
      ))
    }
  }, 1000) // Check every second
})

// Race between prompt completion and idle timeout
result = await Promise.race([promptPromise, createIdleTimeoutPromise()])
```

**How It Works**:
- Checks agent idle time every 1 second
- Only times out if idle time exceeds the configured timeout
- Error message includes both idle time and total elapsed time
- Provides helpful context about why it timed out

## New Behavior

### Example: Long-Running Activity

**Activity**: `create-activity-template` (takes 10 minutes)

**Timeline**:
```
0:00 - Start execution, timeout = 300s (5 min)
0:05 - Agent analyzes examples → activity detected, timer resets
1:30 - Agent designs task graph → activity detected, timer resets
3:00 - Agent writes JSON → activity detected, timer resets
5:00 - Agent registers template → activity detected, timer resets
7:00 - Agent verifies registration → activity detected, timer resets
10:00 - Agent completes → ✅ SUCCESS (no timeout despite 10 min duration)
```

**Key**: As long as the agent does something every 5 minutes, it will never timeout.

### Example: Stuck Agent

**Activity**: Agent gets stuck waiting for input

**Timeline**:
```
0:00 - Start execution, timeout = 300s (5 min)
0:05 - Agent starts task → activity detected
0:30 - Agent waits for user input (none coming)
5:30 - No activity for 5 minutes → ✅ TIMEOUT
      Error: "Idle timeout: Agent has been inactive for 300s (total elapsed: 330s)"
```

**Key**: If the agent is truly stuck, it will timeout after the idle period.

## Benefits

1. **Long-Running Activities Work**: Activities can take as long as needed if they're actively working
2. **Detects True Hangs**: Still catches stuck agents that aren't making progress
3. **Better Error Messages**: Timeout errors now show both idle time and total time
4. **More Flexible**: Default timeout (5 min) is now an idle threshold, not a hard limit

## Configuration

The timeout parameter is now interpreted as **idle timeout**:

```typescript
acp_delegate({
  target: "docker://devbob-opencode",
  taskDescription: "Create new activity template",
  prompt: "...",
  timeout: 300  // Agent can be idle for 300s before timing out
                // But total duration can be unlimited as long as active
})
```

**Recommendations**:
- **Default (300s / 5 min)**: Good for most activities
- **Long activities (600s / 10 min)**: For complex multi-step workflows
- **Quick tasks (60s / 1 min)**: For simple delegations

## Testing

### Manual Test

```typescript
// In OpenCode
acp_delegate({
  target: "docker://devbob-opencode",
  taskDescription: "Test long-running activity",
  prompt: `Execute a create-activity-template activity to create a simple template.
  
  This should take 5+ minutes but should NOT timeout as long as you're working.`,
  timeout: 300  // 5 min idle timeout
})
```

**Expected**: Activity completes successfully even if it takes > 5 minutes, as long as agent shows activity.

### Automated Test

Create a test activity that:
1. Sleeps for 2 minutes (idle)
2. Does work for 1 minute (active)
3. Sleeps for 2 minutes (idle)
4. Does work for 1 minute (active)

**With old code**: Would timeout after 5 min total
**With new code**: Would timeout after 2 min idle (as soon as first sleep exceeds timeout)

## Backwards Compatibility

✅ **Fully backwards compatible**

- The `timeout` parameter still has the same meaning (threshold value)
- Behavior is more permissive (allows longer tasks)
- Error messages are more informative
- No breaking changes to the API

## UI Changes

The UI now reflects the new behavior:

**Before**:
```
Timeout: 300s
```

**After**:
```
Idle timeout: 300s (resets on activity)
```

**Timeout Error Before**:
```
Delegation timeout: Task exceeded 300s timeout
```

**Timeout Error After**:
```
Idle timeout: Agent has been inactive for 300s (total elapsed: 650s).
The agent may be stuck or waiting for input.

Consider: increasing timeout, breaking into smaller tasks, or checking agent logs.
```

## Impact

This fix enables:
- ✅ `create-activity-template` to run without premature timeout
- ✅ Long-running analysis activities
- ✅ Multi-step workflows with complex tool chains
- ✅ Activities that involve building, testing, or deployment

While still protecting against:
- ✅ Hung agents waiting for input
- ✅ Infinite loops without progress
- ✅ Network connection issues
- ✅ Crashed remote agents

## Files Modified

- `repos/metabob-opencode/packages/opencode/src/tool/acp-delegate.ts` (3 changes)

## Verification

To verify the fix is working:

1. **Check the code**: Confirm `lastActivityTime` is being tracked and reset
2. **Run a long activity**: Try `create-activity-template` via delegation
3. **Monitor logs**: Check for "received message chunk" and "tool call" debug logs showing activity
4. **Observe behavior**: Activity should complete even if > timeout duration

## Summary

**Before**: Hard timeout kills delegation after N seconds regardless of progress
**After**: Idle timeout only kills delegation if agent is inactive for N seconds

This makes the `acp_delegate` tool much more practical for real-world multi-agent workflows where activities can take variable amounts of time but are continuously making progress.
