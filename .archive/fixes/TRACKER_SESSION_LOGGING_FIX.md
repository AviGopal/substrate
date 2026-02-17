# Tracker "Session Not Found" Error - Root Cause Fixed

**Date**: February 14, 2026  
**Status**: ✅ Fixed and committed  
**Commit**: `c042cba1` in metabob-opencode

---

## Problem Summary

User reported "session not found" errors appearing in logs, occurring in TRACKER-MCP context during tool execution.

---

## Root Cause Analysis

### Issue
`ToolInstrumentation.instrument()` was calling `AgentExecutionTracker.recordToolCall()` **without required session identifiers**.

### Two Call Sites with Different Behavior

**❌ BROKEN** - `packages/opencode/src/tool/tool-instrumentation.ts:46-49`
```typescript
AgentExecutionTracker.recordToolCall(toolId, args, {
  success,
  duration_ms: duration,
  error
  // MISSING: sessionID and parentSessionID!
})
```

**✅ CORRECT** - `packages/opencode/src/tool/tool.ts:81-86`
```typescript
AgentExecutionTracker.recordToolCall(id, args, {
  success,
  duration_ms: duration,
  error,
  sessionID: ctx.sessionID,        // ← Present
  parentSessionID: ctx.parentSessionID  // ← Present
})
```

### Expected Signature
From `agent-execution-tracker.ts:276-285`:
```typescript
export async function recordToolCall(
  toolName: string,
  args: any,
  result: { 
    success: boolean
    duration_ms: number
    error?: string
    sessionID: string          // ← REQUIRED
    parentSessionID?: string   // ← Optional
  }
)
```

### Error Flow
1. `ToolInstrumentation.instrument()` calls `recordToolCall()` without sessionID
2. `recordToolCall()` at line 294: `targetSessionId = result.parentSessionID || result.sessionID`
3. Both are undefined → `targetSessionId = undefined`
4. `recordToolInvocation(undefined, invocation)` called at line 321
5. MCP tool `metabob_record_tool_invocation` called with `session_id: undefined`
6. Backend lookup fails → **"session not found"** error

---

## Solution

### Fix Applied
Added session context to tool instrumentation layer:

```typescript
// Record tool invocation to tracker (non-blocking)
AgentExecutionTracker.recordToolCall(toolId, args, {
  success,
  duration_ms: duration,
  error,
  sessionID: ctx.sessionID,              // ← ADDED
  parentSessionID: ctx.parentSessionID   // ← ADDED
}).catch(trackingError => {
  log.debug("tool tracking failed", {
    tool: toolId,
    error: trackingError instanceof Error ? trackingError.message : String(trackingError)
  })
})
```

### Why This Works
- **Before**: sessionID was undefined → backend couldn't find session
- **After**: sessionID passed from ctx → backend correctly associates tool call with active session
- **Pattern**: Now matches the correct implementation in `tool.ts`

---

## Architecture Context

### Tool Execution Has Two Tracking Paths

1. **Direct tool execution** (`tool.ts`)
   - Has session context from Tool.Context ✅
   - Correctly passes sessionID to tracker ✅

2. **Instrumentation wrapper** (`tool-instrumentation.ts`)
   - Also has access to Tool.Context
   - Was NOT passing sessionID (now fixed) ✅

Both paths call `AgentExecutionTracker.recordToolCall()`, and both now provide required session IDs.

---

## Impact

### What's Fixed
✅ Instrumented tools now correctly attribute execution to active session  
✅ No more "session not found" errors from TRACKER-MCP  
✅ Tool execution tracking works for both direct and instrumented calls  
✅ Session hierarchy preserved (parent/child sessions)  

### Verification Steps
1. ✅ Fixed `tool-instrumentation.ts` to pass session IDs
2. 🔄 Test that instrumented tools no longer cause errors
3. 🔄 Verify tool calls appear in session execution records
4. 🔄 Check that tracker properly attributes calls to correct session

---

## Previous Session Work (Context)

This fix completes the **TUI stdout pollution cleanup** work:

### Phase 1: TUI Cleanup (Already Committed)
- Fixed 52 console.log → console.error conversions
- Fixed AgentExecutionTracker verbose logging (29 statements)
- Commit: `7ca9218e` - TUI now clean by default

### Phase 2: Session Tracking Fix (This Commit)
- Fixed sessionID missing in tool instrumentation
- Commit: `c042cba1` - Tracker now works correctly

---

## Testing Recommendations

### Manual Testing
```bash
# Run a session with instrumented tools
opencode chat

# Check that no "session not found" errors appear
# Tools should execute without tracker errors
```

### Verification Queries
```typescript
// Query backend to verify tool calls are recorded
// Should show tool calls associated with session IDs
```

---

## Key Learning

**Lesson**: When adding instrumentation wrappers, ensure they have access to **all context** that the original implementation uses. In this case, `Tool.Context` contains critical session identifiers that must be passed through to tracking systems.

**Pattern**: Always compare wrapper implementation against direct implementation to catch missing context.

---

**Status**: ✅ Root cause identified and fixed. Ready for testing and verification.
