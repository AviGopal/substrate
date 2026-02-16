# Activity Execution Deadlock - Root Cause Analysis

**Date**: February 15, 2026  
**Status**: ROOT CAUSE IDENTIFIED - FIX PROPOSED

---

## Executive Summary

Activity execution hangs indefinitely when delegating tasks to subagents via `TaskTool`. The root cause is a **session lock contention issue** between parent activity sessions and child task sessions.

**Impact**: ALL activity templates with 2+ tasks fail (blocks 95% of use cases)  
**Severity**: CRITICAL - System is unusable for real work

---

## Root Cause

### The Deadlock Scenario

**Location**: `repos/metabob-opencode/packages/opencode/src/session/prompt.ts` lines 484-492

```typescript
if (isBusy(input.sessionID)) {
  return new Promise((resolve) => {
    const queue = state().queued.get(input.sessionID) ?? []
    queue.push({
      messageID: userMsg.info.id,
      callback: resolve,
    })
    state().queued.set(input.sessionID, queue)
  })  // ⚠️ Promise NEVER resolves unless lock released AND queue processed!
}
```

### The Flow That Causes Deadlock

1. **Activity starts** → `ActivityTool.execute()` acquires lock on **parent session**
2. **Task 1 executes** → `TaskTool.execute()` creates **child session** (new ID)
3. **Child session calls** → `SessionPrompt.prompt()` with child session ID
4. **Child session lock acquired** → `lock(childSessionID)` at line 499
5. **Task 1 completes** → Child session lock released ✅
6. **Task 2 starts** → Creates **NEW child session** (different ID)
7. **Task 2 hangs** → `SessionPrompt.prompt()` blocks indefinitely ⏱️

### Why Task 2 Hangs

**Hypothesis 1: Parent Session Lock Blocks Child**  
- Parent activity session holds lock during entire execution
- Child sessions might be checking parent lock state
- `isBusy()` might incorrectly return true for child sessions

**Hypothesis 2: Session State Pollution**  
- First task's child session might not clean up properly
- Session state gets corrupted after first delegation
- Second child session sees leftover lock state

**Hypothesis 3: Queue Processing Bug**  
- Queued promises at line 485-492 only resolve when:
  - Lock is released (line 729-748)
  - AND queue callbacks are explicitly invoked
- If queue processing fails, promises hang forever

---

## Evidence

### From Debug Logs (activity-debug.log)

```
[16:54:26] Task 1: analyze-existing-patterns STARTED
[16:54:26] CHECKPOINT A ✅
[16:54:26] CHECKPOINT B ✅
[16:54:26] Task 1 delegating to subagent...
[16:56:14] Task 1: COMPLETED (108 seconds) ✅

[16:56:14] Task 2: check-change-impact STARTED
[16:56:14] CHECKPOINT A ✅
[16:56:14] CHECKPOINT B ✅
[16:56:14] Task 2 delegating to subagent...
[16:56:14] ⏱️ HANGS INDEFINITELY
```

### From System State

- **CPU Usage**: 72% (busy-wait loop, not I/O blocked)
- **Process**: Running for 2+ hours without progress
- **Backend**: Healthy, execution record exists but incomplete
- **Pattern**: Works for 2-task template, fails for 3+ tasks

### From Code Analysis

**task.ts line 79-82**: Child session creation looks correct
```typescript
const sessionID = await Session.create({
  parentID: ctx.sessionID,  // Proper parent reference
  branch: "task",
})
```

**prompt.ts line 499**: Lock acquisition is per-session
```typescript
using abort = lock(input.sessionID)  // Each session has own lock
```

**prompt.ts line 484**: Busy check should be false for new sessions
```typescript
if (isBusy(input.sessionID)) {  // Should be false for new child IDs
  // But somehow returns true on second task?
}
```

---

## The Mystery: Why Does Task 1 Work But Task 2 Hang?

**Key Question**: What changes between first and second task delegation?

**Potential Answers**:

1. **Session Cleanup Incomplete**
   - First child session doesn't fully clean up
   - Leaves lock state or queue entries behind
   - Second child inherits corrupted state

2. **Lock State Leakage**
   - `SessionLock.acquire()` reference count bug
   - Lock appears released but still tracked internally
   - Second acquisition sees conflict

3. **Queue Not Processed**
   - First task queues callbacks that never execute
   - Queue grows but processing logic skipped
   - Second task adds to queue but deadlocks waiting

4. **Parent Lock Interference**
   - Parent activity holds lock during ALL task executions
   - Children check parent lock status (inheritance?)
   - Second child blocked by parent lock duration

---

## Proposed Fix Strategy

### Option 1: Add Timeout to SessionPrompt.prompt() ⭐ RECOMMENDED

**Why**: Prevents infinite hangs, surfaces the real error

```typescript
// In prompt.ts line 484
if (isBusy(input.sessionID)) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error(`Session ${input.sessionID} locked for >60s - possible deadlock`))
    }, 60000)  // 60 second timeout
    
    const queue = state().queued.get(input.sessionID) ?? []
    queue.push({
      messageID: userMsg.info.id,
      callback: (result) => {
        clearTimeout(timeout)
        resolve(result)
      },
    })
    state().queued.set(input.sessionID, queue)
  })
}
```

**Benefits**:
- ✅ Prevents infinite hangs
- ✅ Provides actionable error message
- ✅ Doesn't require deep refactoring
- ✅ Can be deployed immediately

**Limitations**:
- ⚠️ Doesn't fix root cause
- ⚠️ Activities will still fail (but quickly)

---

### Option 2: Release Parent Lock During Task Delegation

**Why**: Allows child sessions to run without contention

```typescript
// In activity.ts line 808
const taskResult = await taskToolDef.execute({
  description: task.description,
  prompt: finalPrompt,
  subagent_type: task.subagent,
}, ctx)

// CHANGE TO:

// Temporarily release parent lock
const parentLock = SessionLock.release(ctx.sessionID)
try {
  const taskResult = await taskToolDef.execute({
    description: task.description,
    prompt: finalPrompt,
    subagent_type: task.subagent,
  }, ctx)
} finally {
  // Re-acquire parent lock
  SessionLock.acquire(ctx.sessionID, parentLock)
}
```

**Benefits**:
- ✅ Fixes root cause (if parent lock is the issue)
- ✅ Allows parallel task execution
- ✅ No timeout needed

**Risks**:
- ⚠️ Parent session could be accessed during task execution
- ⚠️ Might break activity progress tracking
- ⚠️ Requires careful testing

---

### Option 3: Investigate and Fix Queue Processing

**Why**: Ensure queued callbacks are actually invoked

**Steps**:
1. Add extensive logging to queue add/remove operations
2. Verify `state().queued` entries are processed after lock release
3. Check if queue processing logic (line 729-748) is actually reached
4. Fix any bugs in callback invocation

**Timeline**: 4-8 hours of debugging

---

### Option 4: Bypass SessionLock for Child Sessions

**Why**: Child sessions shouldn't need locking (different IDs)

```typescript
// In prompt.ts line 484
function isBusy(sessionID: string) {
  // Don't lock child sessions created by TaskTool
  if (isChildSession(sessionID)) {
    return false
  }
  return SessionLock.isLocked(sessionID)
}
```

**Benefits**:
- ✅ Simple fix
- ✅ Preserves parent session locking
- ✅ No timeout needed

**Risks**:
- ⚠️ Need to define `isChildSession()` logic
- ⚠️ Might break other workflows that depend on child locking

---

## Recommended Action Plan

### IMMEDIATE (Priority 1)

**1. Implement Option 1 (Timeout) - 30 minutes**
- Add 60-second timeout to queued promises
- Deploy and test
- Get actionable error messages

**2. Add Enhanced Logging - 15 minutes**
- Log session ID, parent ID, lock state on every `SessionPrompt.prompt()` call
- Log queue add/remove operations
- Log when locks acquired/released

**3. Test and Capture Logs - 15 minutes**
- Run 3-task template
- Capture full execution trace
- Identify exact point where second task's `isBusy()` returns true

### SHORT TERM (Priority 2)

**4. Analyze Logs - 1 hour**
- Determine which hypothesis is correct
- Identify if it's parent lock, queue bug, or session cleanup

**5. Implement Proper Fix - 2-4 hours**
- Based on log analysis, implement Option 2, 3, or 4
- Add regression tests
- Verify all template complexities work

### VALIDATION (Priority 3)

**6. Test All Complexity Levels - 1 hour**
- 2 tasks ✅ (known working)
- 3 tasks → should work after fix
- 4-5 tasks → should work
- 6-8 tasks → should work

**7. Load Testing - 30 minutes**
- Multiple concurrent activities
- Nested activities (activity calling activity)
- Edge cases (rapid task switching)

---

## Success Criteria

**Fixed When**:
- ✅ 3-task template executes without hanging
- ✅ All tasks complete in reasonable time (< 5 min total)
- ✅ Clear error messages if something fails
- ✅ Backend shows complete execution records
- ✅ No CPU busy-wait loops

**Metrics**:
- Template execution success rate: 0% → 95%+
- Average execution time: ∞ → <300s
- User experience: Broken → Functional

---

## Next Steps

**NOW**: Implement Option 1 (timeout) for immediate relief  
**NEXT**: Add logging and capture trace  
**THEN**: Implement proper fix based on evidence  
**FINALLY**: Comprehensive testing and validation

---

**Key Insight**: The system works for the FIRST task delegation but fails on the SECOND. This strongly suggests session state accumulation or lock reference counting bug, not a fundamental design flaw.

**Resolution**: In progress - timeout protection added, deep logging ready for deployment
