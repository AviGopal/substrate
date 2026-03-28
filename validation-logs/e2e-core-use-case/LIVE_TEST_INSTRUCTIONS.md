
# Activity Learning & Debugging - Live Test Instructions

**Test Template:** /tmp/test-learning-activity.json
**Generated:** 2026-03-02T18:05:43.611Z

## Objective
Prove that activities can be learned from and debugged on the fly during execution.

## Prerequisites
- OpenCode CLI running: `cd repos/metabob-opencode && bun run cli`
- Terminal ready for file creation
- Test template registered

## Test Steps

### 1. Register Template
```
register_activity_template({ file_path: "/tmp/test-learning-activity.json" })
```

### 2. Execute Activity (Will Fail)
```
activity({
  templateId: 'test-activity-debugging-live',
  variables: {},
  reason: 'Test learning and debugging workflow'
})
```
**Expected:** Task 1 succeeds, Task 2 fails, note Activity ID

### 3. Debug On-the-Fly
```
activity_error_inspector({})
```
**Expected:** Shows failure details, error classification, recommendations

### 4. Fix Issue
```bash
echo 'Fixed!' > /tmp/deliberately-missing-file-for-test.txt
```

### 5. Replay from Failure
```
activity_replay({
  activityId: 'act_XXXXXXXXXX' // from step 2
})
```
**Expected:** Skips Task 1, re-runs Task 2, succeeds, shows token savings

### 6. Verify Learning
Check that:
- [ ] Error details were shown (step 3)
- [ ] Task 1 was skipped (step 5)
- [ ] Activity completed (step 5)
- [ ] Token savings reported (step 5)
- [ ] Metrics updated (check backend/logs)

## Success Criteria
- ✅ Error inspector auto-discovered failed activity
- ✅ Error inspector showed actionable debugging info
- ✅ Replay skipped successful task (50% token savings)
- ✅ Replay preserved context
- ✅ Activity completed after replay
- ✅ Learning data captured

## Notes
Document your observations in: validation-logs/e2e-core-use-case/live-test-results.md
