# Next Session Quick Start - Activity Deadlock Fix Testing

**Status**: Timeout protection applied, ready for testing  
**Goal**: Capture timeout logs and implement permanent fix  
**Estimated Time**: 4-6 hours total

---

## Context

Activity execution hangs on second task delegation. Applied 60-second timeout fix to surface the problem. Now need to test, analyze logs, and implement permanent fix.

**Read First**:
- `SESSION_SUMMARY_ACTIVITY_DEADLOCK_FIX_FEB15.md` - Full summary
- `ACTIVITY_EXECUTION_ROOT_CAUSE_FEB15.md` - Technical analysis
- `ACTIVITY_DEADLOCK_FIX_APPLIED.md` - Fix details

---

## Quick Commands

### 1. Verify Commits
```bash
cd /home/avi/documents/work/exp-repo/metabob-devbob
git log --oneline -3
# Should see:
# 41aa085 Session summary: Activity deadlock timeout fix applied
# d24d487 Document activity execution deadlock root cause and timeout fix

cd repos/metabob-opencode
git log --oneline -1
# Should see:
# 22b91495 Add timeout protection to SessionPrompt queue
```

### 2. Check Modified Files
```bash
cd /home/avi/documents/work/exp-repo/metabob-devbob

# View timeout fix
git show HEAD~1:repos/metabob-opencode -- packages/opencode/src/session/prompt.ts | grep -A 30 "SESSION IS BUSY"

# View logging additions
git show HEAD~1:repos/metabob-opencode -- packages/opencode/src/tool/task.ts | grep -A 5 "ABOUT TO CALL"
```

### 3. Regenerate Session Token
```bash
cd /home/avi/documents/work/exp-repo/metabob-devbob
python3 scripts/create_session_state.py
# ✅ Session token valid until Feb 17
```

### 4. Test Activity Execution
```bash
# TODO: Create proper test script that:
# 1. Starts OpenCode
# 2. Executes 3-task template (feature-fdb6afae)
# 3. Monitors for 60s timeout
# 4. Captures logs showing which session is busy
# 5. Displays error message

# For now, manual test:
# - Use search_activities tool
# - Execute activity with activityId: "feature-fdb6afae"
# - Wait for timeout (60s)
# - Check activity-debug.log for 🔴 markers
```

### 5. Analyze Timeout Logs
```bash
# After timeout occurs:
grep "🔴\|🟢\|🔵" activity-debug.log | tail -50

# Look for:
# - Which session ID is busy
# - When it became busy (during Task 1? between tasks?)
# - Queue length at timeout
# - Parent vs child session IDs
```

---

## Expected Test Result

### Successful Timeout (What We Want)
```
[TIME] Task 1: STARTED
[TIME+30s] Task 1: COMPLETED ✅
[TIME+30s] Task 2: STARTED
[TIME+30s] 🔵 ABOUT TO CALL SessionPrompt.prompt()
           childSessionID: session-child-2-abc123
           parentSessionID: session-parent-xyz789
[TIME+30s] 🔴 SESSION IS BUSY - QUEUING REQUEST
           sessionID: session-child-2-abc123  ← KEY INFO!
           queueLength: 0
[TIME+90s] 🔴 QUEUE TIMEOUT - POSSIBLE DEADLOCK
           sessionID: session-child-2-abc123
           waitedSeconds: 60
[TIME+90s] ❌ ERROR: Session session-child-2-abc123 remained locked for >60s
[TIME+90s] Activity: FAILED with clear error
```

### What the Logs Tell Us

**If busy session = child session itself**:
- Lock acquired but never released
- Likely bug in `using abort = lock()` cleanup
- **Fix**: Ensure lock disposal happens in all code paths

**If busy session = parent session**:
- Child checking parent's lock status (shouldn't!)
- **Fix**: Bypass locking for child sessions (Option 4)

**If busy session = previous child session**:
- First child didn't clean up properly
- **Fix**: Ensure child session cleanup after task completion

---

## Implementation Plan (After Log Analysis)

### Option A: Parent Lock Issue → Release During Delegation

**File**: `repos/metabob-opencode/packages/opencode/src/tool/activity.ts` line ~808

```typescript
// Current (causes deadlock):
const taskResult = await taskToolDef.execute({...}, ctx)

// Fix (release parent lock):
const parentLock = SessionLock.release(ctx.sessionID)
try {
  const taskResult = await taskToolDef.execute({...}, ctx)
} finally {
  SessionLock.reacquire(ctx.sessionID, parentLock)
}
```

**Estimated Time**: 2 hours (implementation + testing)

---

### Option B: Queue Processing Bug → Fix Callbacks

**File**: `repos/metabob-opencode/packages/opencode/src/session/prompt.ts` line ~729

```typescript
// Ensure queued callbacks are invoked after lock release
const queued = state().queued.get(input.sessionID) ?? []
for (const item of queued) {
  item.callback(result)  // ← Make sure this actually runs!
}
state().queued.delete(input.sessionID)
```

**Estimated Time**: 3-4 hours (requires deep investigation)

---

### Option C: Child Session Lock → Bypass Locking

**File**: `repos/metabob-opencode/packages/opencode/src/session/prompt.ts` line ~484

```typescript
function isBusy(sessionID: string) {
  // Don't lock child sessions (they have unique IDs)
  const session = Session.get(sessionID)
  if (session?.parentID) {
    return false  // Child sessions never busy
  }
  return SessionLock.isLocked(sessionID)
}
```

**Estimated Time**: 1-2 hours (simple, low risk)

---

## Success Criteria

### Phase 1: Timeout Captured ✅
- ✅ Activity times out after 60s (not forever)
- ✅ Clear error message displayed
- ✅ Logs show which session is busy
- ✅ OpenCode terminates cleanly

### Phase 2: Root Cause Fixed ✅
- ✅ 3-task template completes successfully
- ✅ All tasks execute without timeout
- ✅ No infinite hangs
- ✅ No excessive CPU usage

### Phase 3: Validation ✅
- ✅ 2-task template still works
- ✅ 4-8 task templates work
- ✅ Concurrent executions work
- ✅ Nested activities work

---

## Files to Review

### Core Implementation
1. `repos/metabob-opencode/packages/opencode/src/session/prompt.ts`
   - Lines 484-540: Timeout protection (modified)
   - Lines 729-748: Queue processing (might need fix)

2. `repos/metabob-opencode/packages/opencode/src/tool/task.ts`
   - Lines 79-82: Child session creation
   - Lines 145-168: Logging around SessionPrompt.prompt()

3. `repos/metabob-opencode/packages/opencode/src/tool/activity.ts`
   - Lines 808-820: Where TaskTool.execute() is called
   - Might need parent lock release here

### Session/Lock System
4. `repos/metabob-opencode/packages/opencode/src/session/lock.ts`
   - SessionLock.acquire/release/isLocked implementation
   - Might have reference counting bug

---

## Known State

### Backend
- ✅ Docker containers running (8+ hours uptime)
- ✅ SurrealDB healthy
- ✅ 20 activity templates available
- ✅ API responding (http://localhost:8080/status)

### Frontend/CLI
- ✅ Session token valid until Feb 17
- ✅ MCP integration working
- ✅ search_activities returns results
- ⚠️ Activity execution times out (expected with current fix)

### Test Templates
- ✅ `demo-315bfaf1` (2 tasks): WORKS
- ❌ `feature-fdb6afae` (3 tasks): HANGS → will timeout
- ❌ `other-e5032a65` (8 tasks): HANGS → will timeout

---

## Debugging Checklist

When test runs:

- [ ] OpenCode started successfully
- [ ] Session token loaded
- [ ] Activity execution started
- [ ] Task 1 completes
- [ ] Task 2 starts
- [ ] 🔵 "ABOUT TO CALL" log appears
- [ ] 🔴 "SESSION IS BUSY" log appears ← KEY!
- [ ] Timeout after 60s
- [ ] 🔴 "QUEUE TIMEOUT" log appears
- [ ] Clear error message shown
- [ ] activity-debug.log captured
- [ ] Session IDs extracted from logs
- [ ] Root cause hypothesis formed

---

## Emergency Rollback

If timeout causes other problems:

```bash
cd /home/avi/documents/work/exp-repo/metabob-devbob/repos/metabob-opencode
git revert HEAD  # Revert timeout fix
cd ../..
git add repos/metabob-opencode
git commit -m "Revert timeout fix - caused issues"
```

---

## Questions to Answer

From timeout logs:

1. **Which session is busy?**
   - Parent activity session?
   - Current child session?
   - Previous child session?

2. **When did it become busy?**
   - Before Task 2 starts?
   - During Task 2 delegation?
   - Leftover from Task 1?

3. **Why is it busy?**
   - Lock not released?
   - Lock reference leaked?
   - Wrong session ID being checked?

4. **Queue state?**
   - How many items queued?
   - Are callbacks being invoked?
   - Is queue growing or stable?

---

## Timeline Estimate

**Immediate** (1 hour):
- Start OpenCode
- Execute test
- Capture timeout logs
- Extract session IDs

**Analysis** (1 hour):
- Review logs
- Identify busy session
- Form hypothesis
- Choose fix option

**Implementation** (2-4 hours):
- Code the fix
- Test locally
- Verify no regressions

**Validation** (1 hour):
- Test 2-8 task templates
- Check concurrent executions
- Verify backend state

**Total**: 5-7 hours to complete resolution

---

## Success Message

When this is done, you should be able to:

```javascript
// This will WORK (currently times out):
activity({
  activityId: "feature-fdb6afae",
  variables: {
    method: "GET",
    path: "/api/users",
    description: "User retrieval endpoint"
  },
  reason: "Add user API endpoint with tests"
})

// Result:
// ✅ Task 1: Analyze existing patterns (30s)
// ✅ Task 2: Check change impact (20s)
// ✅ Task 3: Implement endpoint (40s)
// ✅ Activity completed successfully!
```

**That's when we know the system is truly working!**

---

**Ready to go**: All code committed, logs enhanced, timeout protection active. Just need to test and analyze! 🚀
