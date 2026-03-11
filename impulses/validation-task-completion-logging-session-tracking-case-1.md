# Validation Test Case 1: Task Completion Logging and Session Tracking

## Test Case ID
`validation-task-completion-logging-session-tracking-case-1`

## Purpose
Verify that task completion logs are emitted and session tracking works correctly for a simple 3-task activity after fixing the TrailblazingExecutor metadata.sessionId bug.

## Input
```json
{
  "templateId": "test-simple-3-task-validation",
  "variables": {
    "testDescription": "Validation test for task completion logging and session tracking"
  },
  "reason": "Validate that TrailblazingExecutor fix enables proper session tracking",
  "expectedTaskCount": 3,
  "timeout": 180,
  "verifyStorage": true
}
```

## Expected Output

### Log Patterns
1. **Task Completion Logs**: 3 occurrences of "Task completed:" with metrics
   - Each log should include: taskId, description, duration, cost, attempts
   
2. **Session Tracking Logs**: 3 occurrences of "tracked session for correctness validation"
   - Confirms that session tracking code executed successfully

3. **Activity Completion**: 1 occurrence of "Activity completed:"

### Activity Storage
Activity record at `.opencode/storage/activity/{activityId}.json` should contain:

```json
{
  "id": "act_...",
  "status": "completed",
  "executionEvidence": {
    "sessionsSpawned": [
      {
        "sessionID": "session_...",
        "taskId": "task-1",
        "agentType": "general",
        "startTime": 1234567890,
        "endTime": 1234567900,
        "messageCount": 5,
        "toolCallCount": 3,
        "duration": 10000,
        "cost": 0.05
      },
      {
        "sessionID": "session_...",
        "taskId": "task-2",
        "agentType": "general",
        "startTime": 1234567900,
        "endTime": 1234567910,
        "messageCount": 4,
        "toolCallCount": 2,
        "duration": 10000,
        "cost": 0.04
      },
      {
        "sessionID": "session_...",
        "taskId": "task-3",
        "agentType": "general",
        "startTime": 1234567910,
        "endTime": 1234567920,
        "messageCount": 6,
        "toolCallCount": 4,
        "duration": 10000,
        "cost": 0.06
      }
    ],
    "toolCalls": [...]
  }
}
```

### Required Fields Per Session
Each entry in `sessionsSpawned` must have:
- ✅ `sessionID` (string)
- ✅ `taskId` (string)
- ✅ `agentType` (string)
- ✅ `startTime` (number)
- ✅ `endTime` (number)
- ✅ `messageCount` (number)
- ✅ `toolCallCount` (number)
- ✅ `duration` (number)
- ✅ `cost` (number)

### Success Criteria
1. Activity execution exits with code 0
2. 3 task completion logs found in output
3. 3 session tracking confirmation logs found
4. Activity storage file exists
5. `executionEvidence.sessionsSpawned` array has exactly 3 entries
6. All 3 sessions have all required fields
7. No missing fields detected

### Failure Indicators (Before Fix)
Before the fix, this test would show:
- ❌ 0 "tracked session" logs (condition failed)
- ❌ `sessionsSpawned` array is empty
- ❌ Missing sessionID, messageCount, toolCallCount fields

### Success Indicators (After Fix)
After the fix, this test shows:
- ✅ 3 "tracked session" logs
- ✅ `sessionsSpawned` array has 3 entries
- ✅ All required fields present in each session entry

## Historical Context
This test case validates the fix for the critical bug where:
- `TrailblazingExecutor.executeTaskWithTrailblazing` returned TaskResult without metadata.sessionId
- Condition `taskResult.metadata?.sessionId` at activity.ts:2878 failed
- `sessionsSpawned` array remained empty
- Correctness validation verdicts failed due to missing session data

The fix added:
1. `metadata: { sessionId }` field to TaskResult schema
2. `metadata: { sessionId: params.sessionID }` to all return statements
3. Session tracking code in trailblazing path
4. Task completion logging in non-trailblazing path

## Usage
```bash
cd repos/metabob-opencode
npx tsx tests/validation-harnesses/task-completion-logging-session-tracking-harness.ts
```

## Notes
- This is a HISTORICAL test case that can be re-run without LLM
- Test creates minimal side effects (only log files and activity storage)
- Test is idempotent and can be run multiple times
- Test validates both execution paths (trailblazing and non-trailblazing)
