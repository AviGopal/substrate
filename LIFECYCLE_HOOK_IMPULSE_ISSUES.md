# Lifecycle Hook: Session Memory Issues

## Problem Summary

The `manage-session-memory` lifecycle hook activity **completed successfully** but **no impulses were transferred** to the parent session. The user's session has no context prepared despite the hook running.

## Evidence

### 1. Activity Completed Successfully ✅
```json
{
  "id": "act_mluvelvh_238cc6973c3d46c7",
  "status": "done",
  "templateId": "manage-session-memory",
  "duration": 145366,  // ~2.4 minutes
  "impulseCount": 0,   // ❌ NO IMPULSES!
  "callingSessionId": "ses_385d6f2eaffew6BjgpIG0c81uS"
}
```

### 2. Task Outputs Were Captured ✅
Trace shows all 5 tasks completed with outputs captured:
- ✓ analyzeIntentOutput
- ✓ createImpulsesOutput  
- ✓ reviewContextSpaceOutput
- ✓ optimizeIfNeededOutput
- ✓ finalizeContextOutput

### 3. But No Impulses in Activity Record ❌
```json
{
  "impulses": {}  // ❌ EMPTY!
}
```

### 4. Session Transcript Shows Repeated Recreation 🔄
The agent in task 2 (create-impulses):
1. Creates 5 impulses with `impulse_create`
2. Says "✅ Impulses Created Successfully"
3. Then in task 3 says "It appears we've moved to a new activity context"
4. Recreates impulses again
5. This pattern repeats in tasks 4 and 5

## Root Causes

### Issue 1: Impulses Not Persisting Between Tasks
**Symptom**: Agent keeps saying "context has been reset" and recreating impulses

**Possible Causes**:
1. **Activity session isolation** - Each task might be running in a separate session
2. **Impulse scope confusion** - Impulses created in task sessions, not activity session
3. **Activity record not being reloaded** - Activity.load() might be loading stale data

**Evidence from Code**:
```typescript
// impulse-create.ts line 26-28
const activityId =
  (context.extra?.["activityId"] as string | undefined) || 
  Activity.getActivityForSession(context.sessionID)
```

If `context.extra.activityId` is not being passed correctly, impulses might be created in wrong scope.

### Issue 2: Task Sessions vs Activity Session Confusion
**From activity.ts (executeTemplate)**:
```typescript
// Line 2127
sessionID: sessionID, // Use dedicated activity session for context isolation
```

Tasks execute in the **activity session**, but then:
```typescript
// Line 2162-2163
if (_activity.executionEvidence && taskResult.metadata?.sessionId) {
  const subsessionID = taskResult.metadata.sessionId
```

There might be a **subsession** created by TaskTool that the impulses are going to.

### Issue 3: impulse_list Showing Empty Results
**From transcript**: Agent calls `impulse_list` and gets no results, even immediately after calling `impulse_create`.

This suggests:
1. Impulses are being created in a different activity/session than the one being queried
2. `impulse_list` is querying the wrong scope
3. Activity record is not being saved properly after impulse creation

## Architecture Issue: Multi-Level Session Nesting

```
Parent Session (where we need impulses)
  ↓
Lifecycle Hook (manage-session-memory activity)
  ↓
Activity Session (ses_384f612c4ffeUU5Nbbvjh8sLh3)
  ↓
Task 1 (analyze-intent) - Memory Agent
    ↓
    Subsession? (task tool creates one)
  ↓
Task 2 (create-impulses) - Memory Agent
    ↓
    impulse_create called HERE
    ↓
    Which activityId is used? ❓
    ↓
    Subsession? (task tool creates one)
```

**The Problem**: `impulse_create` needs to know which activity to add impulses to, but there are multiple levels of nesting.

## Diagnostic Questions

1. **Where are impulses actually being created?**
   - In the activity session?
   - In a task subsession?
   - In a completely different activity?

2. **Is context.extra.activityId being passed correctly?**
   - From executeTemplate to TaskTool.execute
   - From TaskTool to the memory agent
   - From memory agent to impulse_create

3. **Why does impulse_list return empty immediately after impulse_create?**
   - Is it querying the wrong activity?
   - Is Activity.save() failing silently?
   - Is Activity.load() loading stale data?

## Recommended Fixes

### Fix 1: Verify activityId Propagation
Ensure `context.extra.activityId` is passed through all levels:
1. executeTemplate sets it (line 2133)
2. TaskTool receives it and passes to subagent
3. Subagent has it in tool context
4. impulse_create receives it correctly

**Add logging**:
```typescript
// In impulse-create.ts after line 27
log.debug("impulse_create context", {
  sessionID: context.sessionID,
  extraActivityId: context.extra?.["activityId"],
  resolvedActivityId: activityId,
  scope,
})
```

### Fix 2: Verify Activity Record Persistence
Add logging to confirm Activity.save() is working:
```typescript
// In impulse-create.ts after line 85
const reloaded = await Activity.load(activityId)
log.debug("verified impulse saved", {
  id: params.id,
  activityId,
  impulseCountBefore: Object.keys(activity.impulses).length,
  impulseCountAfter: Object.keys(reloaded.impulses).length,
  impulseExists: !!reloaded.impulses[params.id],
})
```

### Fix 3: Make Impulses Visible Across Task Boundaries
The issue might be that each task is working with a **separate copy** of the activity record. Consider:

1. **Option A**: Use a shared activity record reference
   ```typescript
   // Pass activity as mutable reference, not reloaded each time
   const result = await executeTemplate(
     template,
     activity, // <- This reference should be updated by impulse_create
     ...
   )
   ```

2. **Option B**: Reload activity before each task
   ```typescript
   // In executeTemplate task loop, before each task
   _activity = await Activity.load(_activity.id)
   ```

3. **Option C**: Store impulses in session memory instead
   ```typescript
   // impulse_create could ALSO add to SessionMemory
   await SessionMemory.addImpulse(sessionID, impulse)
   ```

### Fix 4: Debug with Explicit Logging
Add comprehensive logging to track impulse lifecycle:

```typescript
// At each stage
log.info("IMPULSE LIFECYCLE", {
  stage: "create_called" | "saved_to_activity" | "verified_in_activity" | "transferred_to_parent",
  impulseId,
  activityId,
  sessionID,
  impulseCount: Object.keys(activity.impulses).length,
})
```

## Testing Plan

### Phase 1: Verify Impulse Creation
1. Add logging to impulse_create
2. Send test message to trigger hook
3. Check logs to confirm:
   - ✓ activityId is correct
   - ✓ Impulses are saved to activity record
   - ✓ Activity.save() succeeds
   - ✓ Activity.load() shows impulses persist

### Phase 2: Verify Impulse Visibility
1. Add logging to impulse_list
2. Check that impulse_list can see impulses created in same activity
3. Verify impulses persist across task boundaries

### Phase 3: Verify Impulse Transfer
1. Check executeActivityInline return value has impulses
2. Verify lifecycle hook transfers them to parent session
3. Confirm parent session can see impulses with impulse_list

## Quick Fix Attempt

**Simplest fix to try first**: Ensure activity is reloaded before each task checks impulses:

```typescript
// In executeTemplate, at the start of the task loop (before line 1957)
for (const task of order.map(id => template.tasks.find(t => t.id === id)!)) {
  const taskId = task.id
  
  // Reload activity to get latest impulses from previous tasks
  _activity = await Activity.load(_activity.id)
  
  // ... rest of task execution
}
```

This ensures each task sees impulses created by previous tasks.

## Expected Behavior After Fix

1. Task 2 creates impulses → saved to activity record
2. Task 3 starts → reloads activity → sees impulses → doesn't recreate
3. Task 4 starts → reloads activity → sees impulses → doesn't recreate  
4. Task 5 starts → reloads activity → sees impulses → doesn't recreate
5. Activity completes → executeActivityInline returns `{ impulses: {...} }`
6. Lifecycle hook transfers impulses to parent session
7. Main agent can see impulses with impulse_list

## Related Files

- `repos/metabob-opencode/packages/opencode/src/tool/activity.ts` (executeTemplate, executeActivityInline)
- `repos/metabob-opencode/packages/opencode/src/tool/impulse-create.ts` (impulse creation logic)
- `repos/metabob-opencode/packages/opencode/src/session/turn-lifecycle-hooks.ts` (impulse transfer)
- `repos/metabob-opencode/packages/opencode/src/session/activity.ts` (Activity.load, Activity.save)

## Success Criteria

After fix:
- ✅ Impulses created in task 2 persist and are visible in tasks 3-5
- ✅ Agent doesn't say "context has been reset" or recreate impulses
- ✅ Activity record shows impulses: `"impulseCount": 5`
- ✅ Parent session receives impulses after hook completes
- ✅ Main agent can see and use impulses prepared by memory agent
