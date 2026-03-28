# IMPULSE: validation-Task Completion Logging Fix Verification-case-2

**Type**: memo  
**Created**: 2026-03-10  
**Purpose**: Test case for validating task completion logging fix with simple 3-task activity

## Test Case 2: Simple 3-Task Activity

### Input
```json
{
  "activityId": "act_<to-be-generated>",
  "activityTemplate": "test-simple-3-task",
  "taskCount": 3,
  "repoPath": "repos/metabob-opencode",
  "logFilePath": "dev.log"
}
```

### Expected Output
```json
{
  "taskCompletionLogsCount": 3,
  "sessionsSpawnedCount": 3,
  "requiredSessionFields": [
    "sessionID",
    "taskId",
    "agentType",
    "startTime",
    "endTime",
    "messageCount",
    "toolCallCount",
    "duration",
    "cost"
  ],
  "correctnessVerdict": "NOT 'incorrect'",
  "minimumImprovement": 3
}
```

### Validation Checks

1. **Task Completion Logs Count**: Verify 3 "Task completed:" logs in dev.log
2. **Sessions Spawned Count**: Verify sessionsSpawned.length === 3
3. **Session Field Completeness**: Each session has all 9 required fields
4. **Correctness Verdict**: Verify verdict is NOT "incorrect"
5. **Improvement Over Broken Activities**: Verify +3 sessions compared to baseline (0 sessions)

### Purpose

This test case validates the fix with a simpler activity to ensure:
- The fix works for activities with fewer tasks (not just 7)
- Session tracking scales correctly with task count
- No off-by-one errors or edge cases

### Success Criteria

All 5 validation checks must pass:
- ✅ Task completion logs count = 3
- ✅ Sessions spawned count = 3
- ✅ All sessions have 9 required fields
- ✅ Correctness verdict ≠ "incorrect"
- ✅ Improvement: +3 sessions (100% increase from 0)

### How to Run

```bash
# Execute the test activity
cd repos/metabob-opencode
npx opencode activity test-simple-3-task \
  --variables '{"taskDescription":"test"}' \
  --reason "Validate task completion logging fix with simple activity"

# Get activity ID from output
ACTIVITY_ID="act_xyz789"

# Run validation harness
node ../../tests/validation-harnesses/task-completion-logging-fix-verification-harness.ts \
  "$ACTIVITY_ID" \
  "../../dev.log" \
  "." \
  3
```

### Expected Harness Output

```
================================================================================
Task Completion Logging Fix Verification - Validation Harness
================================================================================
Activity ID: act_xyz789
Log File: ../../dev.log
Repo Path: .
Expected Task Count: 3
================================================================================

📊 VALIDATION RESULTS

✅ ALL CHECKS PASSED (11/11)

================================================================================

🔍 DETAILED CHECKS

✅ Task completion logs count
   ✅ Found 3 task completion logs
   Expected: 3
   Actual: 3

✅ Activity storage file exists
   ✅ Activity storage loaded: act_xyz789

✅ Sessions spawned count
   ✅ Found 3 tracked sessions
   Expected: 3
   Actual: 3

[... 9 field checks for 3 sessions ...]

✅ Correctness verdict
   ✅ Correctness verdict is 'correct' (not 'incorrect')

✅ Improvement over broken activities
   ✅ Improved by 3 sessions (+100%)

================================================================================

📈 COMPARISON WITH BROKEN ACTIVITIES

Previous Broken Activities:
  act_mmliyv8s: 0 sessions, 0 logs
  act_mmln210z: 0 sessions, 0 logs

Current Activity:
  act_xyz789: 3 sessions, 3 logs

Improvement:
  Sessions: +3
  Logs: +3
  Percent: +100%

================================================================================

🎯 FINAL RESULT

✅ VALIDATION PASSED
   11/11 checks passed
================================================================================
```

---

**Token Budget**: N/A (historical test case data)  
**Reusable**: Yes - can be run without LLM  
**Stable**: Yes - input/output contract is fixed
