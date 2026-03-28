# Test Plan: 3-Task Activity Template with Timeout Fix

**Date**: February 15, 2026  
**Objective**: Verify timeout protection on `feature-fdb6afae` (3-task template)

## Test Configuration

**Template to Test**:
- ID: `feature-fdb6afae`
- Name: Add REST Endpoint V2
- Tasks: 3
- Known Status: 2-task templates work, 3+ task templates hang

**Expected Behavior WITH Timeout Fix**:
- Task 1: Completes successfully ✅
- Task 2: Hangs and triggers 60-second timeout ⏱️
- Error message: "🔴 QUEUE TIMEOUT - POSSIBLE DEADLOCK"
- Logs capture: Which session ID is marked as busy

## Test Execution Steps

### 1. Clear Logs
```bash
rm -f activity-debug.log
```

### 2. Execute Template via Activity Tool
Use minimal variables to reduce complexity:
```javascript
activity({
  activityId: "feature-fdb6afae",
  variables: {
    endpoint_path: "/api/test",
    http_method: "GET",
    endpoint_description: "Test endpoint",
    handler_name: "handleTest"
  },
  reason: "Test timeout protection on 3-task template"
})
```

### 3. Monitor Execution
Watch for these log markers:
- 🔵 "ABOUT TO CALL SessionPrompt.prompt()" - Task delegation start
- 🟢 "RETURNED FROM SessionPrompt.prompt()" - Task completion
- 🔴 "SESSION IS BUSY - QUEUING REQUEST" - Deadlock detected
- 🔴 "QUEUE TIMEOUT - POSSIBLE DEADLOCK" - Timeout triggered (60s)

### 4. Capture Critical Data
From timeout error, extract:
- **sessionID**: Which session was marked busy?
- **messageID**: The queued message ID
- **queueLength**: How many requests queued?
- **Parent vs Child**: Was it parent or child session?

## Expected Results

### Success Criteria (Timeout Working)
- [✓] Activity starts without immediate error
- [✓] Task 1 completes (logs show 🟢)
- [✓] Task 2 hangs (no 🟢 for 60s)
- [✓] Timeout triggers after 60s
- [✓] Error message includes session ID
- [✓] System remains responsive (no infinite hang)

### Data to Extract
1. **Task 1 Session ID** (from first 🔵 log)
2. **Task 2 Session ID** (from second 🔵 log)
3. **Busy Session ID** (from 🔴 timeout error)
4. **Queue State** (length, position)

## Next Steps Based on Results

### If Session = Parent Session
→ **Fix**: Release parent lock during task delegation  
→ **Location**: `activity.ts` line 808  
→ **Strategy**: Temporarily unlock parent before `TaskTool.execute()`

### If Session = Previous Child Session
→ **Fix**: Child session cleanup bug  
→ **Location**: `task.ts` after task completion  
→ **Strategy**: Ensure child session properly released

### If Session = Current Child Session
→ **Fix**: Lock inheritance bug  
→ **Location**: `task.ts` session creation  
→ **Strategy**: Ensure child sessions created without parent lock

### If Queue Not Processing
→ **Fix**: Queue callback invocation  
→ **Location**: `prompt.ts` lines 729-748  
→ **Strategy**: Debug `processQueue()` logic

## Execution Timeline

- **T+0s**: Activity starts, Task 1 begins
- **T+5-10s**: Task 1 completes (if successful)
- **T+10s**: Task 2 starts
- **T+10s**: Task 2 hangs (queue detection)
- **T+70s**: Timeout triggered (60s after queue)
- **T+70s**: Error thrown with diagnostic data

## Success Definition

**Test passes if**:
1. No infinite hang (system returns control within 90s)
2. Clear error message identifying the busy session
3. Logs captured for root cause analysis
4. System remains usable after timeout

**Test fails if**:
1. System hangs indefinitely (timeout not working)
2. Timeout occurs but logs are unclear
3. System becomes unresponsive after timeout

---

**Status**: Ready to execute  
**Next Action**: Run activity tool with test variables
