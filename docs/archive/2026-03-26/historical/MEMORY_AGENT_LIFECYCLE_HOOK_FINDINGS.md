# Memory Agent Lifecycle Hook - Test Findings

## Test Date
February 19, 2026

## Test Objective
Verify that the session memory agent lifecycle hook is working correctly:
1. Impulses should be present in the current session's context
2. No extra sessions should be created (other than the current one)

## Test Results

### ❌ FAILED: Both requirements not met

### Issue 1: Extra Sessions Created
- **Expected**: Only 1 session (the current session)
- **Actual**: 7+ `manage-session-memory` activity sessions created
- **Evidence**:
  ```
  Activity: act_mluku788_ca4aa492b4c83fa1
  executionEvidence.sessionsSpawned:
    - sessionID: ses_38604e3e6ffeiSwQvmU78Lwdh2
    - taskId: analyze-intent
    - agentType: memory
  ```

### Issue 2: No Impulses in Current Session
- **Expected**: Session memory file with impulses
- **Actual**: No session memory file created
- **Location checked**: `~/.local/share/opencode/storage/session-memory/{sessionID}.json`
- **Status**: File does not exist

### Issue 3: Activities Stuck in "setup" Status
- **Expected**: Activities complete and return impulses
- **Actual**: All 7 `manage-session-memory` activities have `status: "setup"`
- **Impact**: Hook execution starts but never finishes
- **Evidence**:
  ```json
  {
    "status": "setup",
    "parentSessionID": null,
    "sessionIDs": [],
    "stats": {
      "tokens": { "input": 0, "output": 0 }
    }
  }
  ```

## Root Cause Analysis

### Hook Implementation (turn-lifecycle-hooks.ts:20-146)

The memory management hook:
1. ✅ Correctly registered at priority 10 (before turn)
2. ✅ Enabled checks work correctly
3. ❌ Executes `TemplateExecutor.execute()` which spawns a **new session**
4. ❌ Activity gets stuck in "setup" and never completes
5. ❌ No impulses are returned to the parent session

### Code Flow
```typescript
// turn-lifecycle-hooks.ts:73-80
const result = await TemplateExecutor.execute({
  templateId: "manage-session-memory",
  variables: { userMessage: ctx.promptText },
  reason: `Prepare context for user message: "${ctx.promptText.slice(0, 100)}..."`,
  parentSessionID: ctx.sessionID,  // ⚠️ Links to parent but still creates new session
})
```

### Problems Identified

1. **Session Proliferation**
   - Each hook execution spawns a new activity session
   - Activity creates a memory agent session (`agentType: "memory"`)
   - This violates the "single session" requirement

2. **Activity Never Completes**
   - Activities stuck at `status: "setup"`
   - No completion means no impulses returned
   - Hook waits indefinitely or times out

3. **No Impulse Transfer**
   - Even if activity completed, impulses would be in the **activity session**
   - They need to be transferred to the **parent session**
   - No mechanism exists for this transfer

## Expected vs Actual Behavior

### Expected Flow
```
User message
  ↓
Before turn hook (priority 10)
  ↓
Memory agent analyzes context (in SAME session)
  ↓
Impulses added to current session memory
  ↓
Main agent sees impulses in context
  ↓
Response with full context awareness
```

### Actual Flow
```
User message
  ↓
Before turn hook (priority 10)
  ↓
TemplateExecutor.execute() called
  ↓
NEW activity session created
  ↓
NEW memory agent session spawned
  ↓
Activity stuck in "setup"
  ↓
Hook returns (no impulses)
  ↓
Main agent proceeds WITHOUT context
```

## Fix Required

### Option 1: Direct Memory Agent Call (Recommended)
Instead of using TemplateExecutor, call the memory agent directly:

```typescript
// In turn-lifecycle-hooks.ts memory-management hook
const { SessionMemoryAgent } = await import("./session-memory-agent")

// Call directly in the SAME session (no new session)
const impulses = await SessionMemoryAgent.analyzeAndPrepareContext({
  sessionID: ctx.sessionID,
  userMessage: ctx.promptText,
})

// Add impulses to current session
for (const impulse of impulses) {
  await SessionMemory.addImpulse(ctx.sessionID, impulse)
}
```

### Option 2: Activity Completion + Transfer
Fix the activity template to:
1. Complete successfully
2. Transfer impulses from activity session to parent session

This is more complex and still creates extra sessions.

### Option 3: Disable Activity-Based Hook
Use a simpler lifecycle approach:
- Pre-turn hook calls memory functions directly
- No activity template involved
- No session spawning

## Verification Steps

After fix is applied:

1. **Count sessions**:
   ```bash
   find ~/.local/share/opencode/storage/session -maxdepth 1 -type d | wc -l
   ```
   Should show only 1 active session in recent hour

2. **Check memory file**:
   ```bash
   cat ~/.local/share/opencode/storage/session-memory/{sessionID}.json | jq '.impulses | length'
   ```
   Should show > 0 impulses

3. **Verify no stuck activities**:
   ```bash
   find ~/.local/share/opencode/storage/activity -name "*.json" \
     -exec grep -l "manage-session-memory" {} \; | \
     xargs jq -r '.status' | sort | uniq -c
   ```
   Should NOT show any "setup" status

## Related Files

- Hook implementation: `repos/metabob-opencode/packages/opencode/src/session/turn-lifecycle-hooks.ts`
- Memory lifecycle: `repos/metabob-opencode/packages/opencode/src/session/memory-lifecycle.ts`
- Session memory: `repos/metabob-opencode/packages/opencode/src/session/session-memory.ts`
- Template executor: `repos/metabob-opencode/packages/opencode/src/session/template-executor.ts`

## Next Steps

1. Implement Option 1 (direct memory agent call)
2. Remove activity-based approach for lifecycle hooks
3. Test that impulses appear in session memory
4. Verify single session constraint
5. Update this document with results
