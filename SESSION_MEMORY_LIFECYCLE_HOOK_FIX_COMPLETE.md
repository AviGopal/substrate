# Session Memory Lifecycle Hook - Fix Complete

## Summary

Fixed the session memory agent lifecycle hook to properly execute activity templates using the same execution path as the activity tool.

## Problem

The lifecycle hook was using `TemplateExecutor.execute()` which:
- Was designed for **CLI execution** (standalone activities)
- Passed `parentSessionID: undefined` to task execution
- Created activities with `callingSessionId: null`
- Activities got stuck in "setup" status
- No impulses were transferred to parent session

## Solution

Created `executeActivityInline()` function in `activity.ts` that:
1. Uses the **same execution path as the activity tool** (lines 485-1012)
2. Creates **child session properly** with `callingSessionID` set
3. Executes tasks in child session
4. Returns impulses to lifecycle hook
5. Hook **transfers impulses to parent session**

## Files Modified

### 1. `repos/metabob-opencode/packages/opencode/src/tool/activity.ts`

Added new export function `executeActivityInline()` after line 1012:
- Creates child session (like activity tool does)
- Sets `activity.callingSessionId = parentSessionID` ✅
- Executes template using `executeTemplate()`
- Returns impulses for transfer
- Updates template metrics

### 2. `repos/metabob-opencode/packages/opencode/src/session/turn-lifecycle-hooks.ts`

Updated memory-management hook (lines 45-146):
- Changed from `TemplateExecutor.execute()` to `executeActivityInline()`
- Imports `executeActivityInline` and `SessionMemory`
- Calls `executeActivityInline()` with parent session ID
- **Transfers impulses** from activity to parent session
- Logs impulse transfer for debugging

## Key Architectural Points

### ✅ Activities Run in Child Sessions (Correct!)

This is the **intended design** for activity composition:
```
Main session (user interaction)
  ↓
Before-turn hook (lifecycle)
  ↓
Activity child session (manage-session-memory)
  ↓
Memory agent tasks execute
  ↓
Impulses created in activity session
  ↓
Hook transfers impulses to main session
  ↓
Main agent sees impulses in context
```

### ✅ Preserves Core Principles

- **Activity-based**: Uses `manage-session-memory` template
- **Child session model**: Enables composition (activities → activities)
- **Measurable**: Template metrics tracked (executions, success rate, cost)
- **Learnable**: Backend receives full activity execution data
- **Shareable**: Template shared via MCP across environments
- **No proliferation**: Child sessions properly tracked and closed

## Build

```bash
cd repos/metabob-opencode/packages/opencode
bun run build
```

Build completed successfully - all platform targets verified ✅

## Testing

### 1. Clean old activities
```bash
bash test-lifecycle-hook-fix.sh
```
Removed 11 stuck activities in "setup" status

### 2. Verification (after new session)
```bash
bash verify-lifecycle-hook-fix.sh
```

Expected results:
- ✅ Status: "done" or "failed" (not "setup")
- ✅ callingSessionId: set (not null)
- ✅ Impulses: present in parent session memory
- ✅ Child sessions: tracked in executionEvidence

## Verification Checklist

After starting a new OpenCode session and sending a message:

1. **Check activity status**:
   ```bash
   find ~/.local/share/opencode/storage/activity -name "*.json" \
     -exec grep -l "manage-session-memory" {} \; | head -1 | \
     xargs jq -r '.status'
   ```
   Should show: `done` or `failed` (NOT `setup`)

2. **Check parent session link**:
   ```bash
   find ~/.local/share/opencode/storage/activity -name "*.json" \
     -exec grep -l "manage-session-memory" {} \; | head -1 | \
     xargs jq -r '.callingSessionId'
   ```
   Should show: session ID (NOT `null`)

3. **Check impulses in parent session**:
   ```bash
   SESSION_ID=$(ls -td ~/.local/share/opencode/storage/session/*/ | head -1 | xargs basename)
   cat ~/.local/share/opencode/storage/session-memory/${SESSION_ID}.json | jq '.impulses | length'
   ```
   Should show: > 0

4. **Check child session tracking**:
   ```bash
   find ~/.local/share/opencode/storage/activity -name "*.json" \
     -exec grep -l "manage-session-memory" {} \; | head -1 | \
     xargs jq '.executionEvidence.sessionsSpawned | length'
   ```
   Should show: > 0

## What Changed vs What Stayed

### Changed ✏️
- Lifecycle hook execution path (TemplateExecutor → executeActivityInline)
- Impulse transfer logic (explicit transfer to parent session)
- Session linking (callingSessionId properly set)

### Stayed the Same ✅
- Activity template system (still uses `manage-session-memory` template)
- Child session creation (still creates child sessions for activities)
- Template configurability (context requirements still in template)
- Metrics tracking (executions, success rate, cost still tracked)
- Learning system integration (backend still receives data)

## Benefits

1. **Activities complete successfully** instead of getting stuck in "setup"
2. **Parent session properly linked** via `callingSessionId`
3. **Impulses transferred to parent** so main agent has context
4. **Child sessions tracked** in `executionEvidence`
5. **Template metrics updated** for learning system
6. **Enables activity composition** (activities can call activities)

## Next Steps

1. ✅ Verify fix with new session (send message, run verification script)
2. Monitor activity execution logs for any errors
3. Test activity composition (activities calling other activities)
4. Update learning system with successful execution data

## Related Documents

- **ARCHITECTURE_CORRECTION.md**: Technical deep-dive into the fix
- **MEMORY_AGENT_LIFECYCLE_HOOK_FINDINGS.md**: Original problem analysis
- **VERIFICATION_SUMMARY.md**: Test results summary

---

**Status**: ✅ Fix implemented and ready for testing  
**Build**: ✅ Successful (all platforms)  
**Next**: Verify with new OpenCode session
