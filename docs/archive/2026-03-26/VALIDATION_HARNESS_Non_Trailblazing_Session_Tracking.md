# Validation Harness: Non-Trailblazing Session Tracking

**Specification:** Non-Trailblazing Session Tracking  
**Harness File:** `tests/validation-harnesses/non-trailblazing-session-tracking-harness.ts`  
**Created:** 2026-03-11  
**Status:** ✅ Ready for execution

---

## Overview

This validation harness verifies that the Non-Trailblazing Session Tracking fix is working correctly. It validates that activities using deterministic (non-trailblazing) tasks properly track session metadata in the `executionEvidence.sessionsSpawned` array.

### What It Tests

1. **Session Tracking Presence**: Verifies `sessionsSpawned` array has expected number of entries
2. **Field Completeness**: Validates each session entry has all 9 required fields
3. **Correctness Verdict**: Ensures verdict is not 'incorrect' after session tracking
4. **Task Completion Logs**: Regression check that logging still works
5. **Before/After Comparison**: Documents improvement from 0 → 5 sessions tracked

---

## Test Cases

### Case 1: After Fix (Expected PASS)
**Impulse ID:** `validation-non-trailblazing-session-tracking-case-1`

**Input:**
- Activity Template: `manage-session-memory`
- Variables: `{ maxContextTokens: 8000, compressionStrategy: "adaptive" }`
- Reason: "Validate non-trailblazing session tracking after fix implementation"

**Expected Output:**
```json
{
  "sessionsSpawnedCount": 5,
  "eachSessionHasFields": [
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
  "correctnessVerdictNot": "incorrect",
  "taskCompletionLogsCount": 5,
  "allTasksNonTrailblazing": true
}
```

**Execution Steps:**
1. Execute activity:
   ```bash
   opencode activity run manage-session-memory \
     --variables '{"maxContextTokens":8000,"compressionStrategy":"adaptive"}' \
     --reason 'Validate session tracking'
   ```
2. Note the activity ID from output
3. Run validation harness:
   ```bash
   bun run tests/validation-harnesses/non-trailblazing-session-tracking-harness.ts <activity-id>
   ```

**Expected Result:** ✅ PASS

---

### Case 2: Before Fix (Historical - Broken State)
**Impulse ID:** `validation-non-trailblazing-session-tracking-case-2`

**Input:**
- Existing Activity ID: `act_mmlph9ig_38038a63a4c5760c`
- Status: Broken (commit dab595c1 - partial fix only)

**Actual Result (Historical):**
```json
{
  "sessionsSpawnedCount": 0,
  "correctnessVerdict": "incorrect",
  "taskCompletionLogsCount": 5,
  "status": "broken - session tracking not implemented"
}
```

**Purpose:** 
Documents the broken state before the fix. Shows that:
- Task completion logs were working (5/5 found) ✅
- Session tracking was broken (0/5 sessions tracked) ❌
- Correctness verdict was 'incorrect' due to missing sessions

**Comparison:**
- **BEFORE:** 0 sessions tracked
- **AFTER:** 5 sessions tracked
- **Improvement:** Session tracking now works for deterministic tasks

---

## Validation Strategy

### Execution Flow
```
1. Execute Activity
   ↓
2. Load Activity from Storage
   ↓
3. Check executionEvidence.sessionsSpawned
   ↓
4. Validate Field Presence (9 required fields)
   ↓
5. Check Correctness Verdict
   ↓
6. Count Task Completion Logs
   ↓
7. Return PASS/FAIL
```

### Success Criteria

**✅ PASS Conditions:**
- `sessionsSpawned.length === 5` (one per task)
- Each session entry has all 9 required fields:
  - `sessionID` (string)
  - `taskId` (string)
  - `agentType` (string)
  - `startTime` (number)
  - `endTime` (number)
  - `messageCount` (number)
  - `toolCallCount` (number)
  - `duration` (number)
  - `cost` (number)
- `correctnessVerdict.verdict !== 'incorrect'`
- Task completion logs present (5 logs found)

**❌ FAIL Conditions:**
- `sessionsSpawned.length !== 5`
- Any session entry missing required fields
- `correctnessVerdict.verdict === 'incorrect'`
- Task completion logs missing

---

## Usage

### CLI Usage
```bash
# Run validation with existing activity
bun run tests/validation-harnesses/non-trailblazing-session-tracking-harness.ts <activity-id>

# Or use environment variable
ACTIVITY_ID=<activity-id> bun run tests/validation-harnesses/non-trailblazing-session-tracking-harness.ts
```

### Programmatic Usage
```typescript
import { runValidation } from './tests/validation-harnesses/non-trailblazing-session-tracking-harness'

const result = await runValidation({
  activityTemplate: "manage-session-memory",
  variables: { maxContextTokens: 8000, compressionStrategy: "adaptive" },
  reason: "Validate session tracking",
  existingActivityId: "act_xyz123"
})

if (result.pass) {
  console.log("✅ Validation PASSED")
} else {
  console.error("❌ Validation FAILED:", result.errors)
}
```

### Output Format
```json
{
  "pass": true,
  "actual": {
    "activityId": "act_xyz123",
    "status": "done",
    "sessionsSpawnedCount": 5,
    "sessionsSpawned": [...],
    "taskCompletionLogsCount": 5,
    "correctnessVerdict": {
      "verdict": "correct",
      "confidence": 0.95
    },
    "allTasksNonTrailblazing": true,
    "missingFields": []
  },
  "expected": {
    "sessionsSpawnedCount": 5,
    "eachSessionHasFields": ["sessionID", "taskId", ...],
    "correctnessVerdictNot": "incorrect",
    "taskCompletionLogsCount": 5,
    "allTasksNonTrailblazing": true
  },
  "errors": [],
  "beforeAfterComparison": {
    "beforeActivityId": "act_mmlph9ig_38038a63a4c5760c",
    "beforeSessionsSpawnedCount": 0,
    "afterActivityId": "act_xyz123",
    "afterSessionsSpawnedCount": 5,
    "improvement": "0 → 5 sessions tracked"
  }
}
```

---

## Impulses Created

### 1. Test Case 1 (After Fix)
- **ID:** `validation-non-trailblazing-session-tracking-case-1`
- **Type:** memo
- **File:** `impulses/validation-non-trailblazing-session-tracking-case-1.json`
- **Budget:** 2000 tokens
- **Purpose:** Expected behavior after fix implementation

### 2. Test Case 2 (Before Fix)
- **ID:** `validation-non-trailblazing-session-tracking-case-2`
- **Type:** memo
- **File:** `impulses/validation-non-trailblazing-session-tracking-case-2.json`
- **Budget:** 2000 tokens
- **Purpose:** Historical broken state for comparison

### 3. Harness Impulse
- **ID:** `harness-non-trailblazing-session-tracking`
- **Type:** file
- **File:** `impulses/harness-non-trailblazing-session-tracking.json`
- **Budget:** 2000 tokens
- **Pointer:** `tests/validation-harnesses/non-trailblazing-session-tracking-harness.ts`
- **Purpose:** Executable validation harness

---

## Implementation Details

### Code Structure

**Main Function:** `runValidation(input: ValidationInput): Promise<ValidationOutput>`

**Helpers:**
- `getActivity(activityId: string)`: Load activity from storage
- `validateSessionEntry(entry: any)`: Check for required fields
- `countTaskCompletionLogs(activityId: string)`: Count logs in dev.log

**No LLM Required:**
- ✅ Pure data validation
- ✅ No interpretation needed
- ✅ Deterministic pass/fail
- ✅ Can be run in CI/CD

### Dependencies

**Required:**
- `Activity.load()` - Load activity from storage
- `Bun.file()` - Read log files
- `Session.messages()` - (used by activity execution, not harness)

**No External Services:**
- ✅ No HTTP calls
- ✅ No LLM calls
- ✅ No database queries (uses local storage)

---

## Related Documents

**Trace Document:**
- File: `TRACE_Non_Trailblazing_Session_Tracking.md`
- Impulse: `trace-Non-Trailblazing Session Tracking`

**Enforcement Document:**
- File: `ENFORCEMENT_Non_Trailblazing_Session_Tracking.md`
- Impulse: `enforcement-Non-Trailblazing Session Tracking`

**Specification Source:**
- Original Issue: Runtime validation in fresh session (commit dab595c1)
- Fix Location: `repos/metabob-opencode/packages/opencode/src/tool/activity.ts:2724-2786`

---

## Validation Checklist

Before running validation:
- [ ] Activity executed successfully
- [ ] Activity ID available
- [ ] Harness file exists at expected path
- [ ] Activity storage accessible

Run validation:
- [ ] Execute harness with activity ID
- [ ] Verify PASS result
- [ ] Check all 9 fields present in each session entry
- [ ] Verify correctness verdict is not 'incorrect'
- [ ] Confirm task completion logs found

Expected results:
- [ ] sessionsSpawned.length === 5
- [ ] No missing fields
- [ ] Correctness verdict: 'correct' or 'likely-correct'
- [ ] Before/after shows 0 → 5 improvement

---

## Troubleshooting

### Error: "Activity ID not found in storage"
**Solution:** Verify activity ID is correct and activity completed successfully

### Error: "Missing required fields"
**Solution:** Check that the fix (lines 2724-2786) was applied correctly

### Error: "Task completion logs not found"
**Solution:** Check dev.log file exists and contains activity logs

### Validation FAIL: "sessionsSpawnedCount !== 5"
**Solution:** 
1. Verify activity template has 5 tasks
2. Check all tasks completed successfully
3. Verify fix code is executing (add debug logs)

### Validation FAIL: "Correctness verdict is 'incorrect'"
**Solution:**
1. Check sessionsSpawned is populated
2. Verify toolCalls array is populated
3. Ensure Activity.save() was called

---

## Next Steps

After validation PASS:
1. ✅ Commit validation harness
2. ✅ Update documentation with results
3. ✅ Add to CI/CD pipeline (optional)
4. ✅ Archive broken activity for future reference

After validation FAIL:
1. ❌ Review fix implementation in activity.ts:2724-2786
2. ❌ Add debug logging to track execution
3. ❌ Run activity again with increased logging
4. ❌ Compare with reference implementation (lines 2931-2987)
5. ❌ Re-run validation after fix

---

## Summary

This validation harness provides **deterministic, automated verification** that the Non-Trailblazing Session Tracking fix is working correctly. It requires:
- ✅ No LLM calls
- ✅ No manual interpretation
- ✅ No external services

It validates:
- ✅ Session tracking works for deterministic tasks
- ✅ All required fields are present
- ✅ Correctness verdict improves
- ✅ Task completion logs still work (regression check)

The harness can be run **programmatically** in CI/CD pipelines or **manually** via CLI for development validation.
