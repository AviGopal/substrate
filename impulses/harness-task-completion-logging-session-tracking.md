# Validation Harness: Task Completion Logging and Session Tracking

## Harness ID
`harness-task-completion-logging-session-tracking`

## Purpose
Automated validation harness to verify that task completion logs are emitted and session tracking works correctly after fixing the TrailblazingExecutor metadata.sessionId bug.

## File Location
`repos/metabob-opencode/tests/validation-harnesses/task-completion-logging-session-tracking-harness.ts`

## Specification Validated
**Task Completion Logging and Session Tracking**

### Root Cause Tested
TrailblazingExecutor.executeTaskWithTrailblazing was returning TaskResult without metadata.sessionId, causing the condition at activity.ts:2878 to fail and preventing sessionsSpawned from being populated.

### Fix Validated
1. Added `metadata: { sessionId }` field to TaskResult schema
2. Added `metadata: { sessionId: params.sessionID }` to all return statements
3. Added session tracking code in trailblazing path (activity.ts:2449-2507)
4. Added task completion logging in non-trailblazing path (activity.ts:2989-3002)

## Validation Strategy

### Execution Flow
1. Execute a 3-task activity with simple tasks
2. Capture all logs to verify "Task completed:" appears 3 times
3. Extract activity ID from logs
4. Load activity record from storage
5. Verify executionEvidence.sessionsSpawned has 3 entries
6. Verify each entry has required fields
7. Return PASS/FAIL (no LLM needed)

### Checks Performed

#### Log Pattern Analysis
- **Task Completion Logs**: "Task completed:" must appear exactly 3 times
- **Session Tracking Logs**: "tracked session for correctness validation" must appear 3 times
- **Activity Completion**: "Activity completed:" must appear exactly 1 time

#### Activity Storage Verification
- Activity record file must exist at `.opencode/storage/activity/{activityId}.json`
- `executionEvidence.sessionsSpawned` array must have exactly 3 entries
- Each session entry must have all required fields:
  - sessionID (string)
  - taskId (string)
  - agentType (string)
  - startTime (number)
  - endTime (number)
  - messageCount (number)
  - toolCallCount (number)
  - duration (number)
  - cost (number)

#### Overall Pass Criteria
1. Activity execution exits with code 0
2. All log patterns found with correct counts
3. Activity storage verification passes
4. All sessions have all required fields
5. No missing fields detected

## Usage

### Direct Execution
```bash
cd repos/metabob-opencode
npx tsx tests/validation-harnesses/task-completion-logging-session-tracking-harness.ts
```

### Programmatic Usage
```typescript
import runValidation, { ValidationInput } from './task-completion-logging-session-tracking-harness'

const input: ValidationInput = {
  templateId: 'test-simple-3-task-validation',
  variables: {
    testDescription: 'Validation test for task completion logging'
  },
  reason: 'Validate TrailblazingExecutor fix',
  expectedTaskCount: 3,
  timeout: 180,
  verifyStorage: true
}

const result = runValidation(input)
console.log(`Validation: ${result.pass ? 'PASS' : 'FAIL'}`)
console.log(result.summary)
```

## Output Format

### Success Output
```json
{
  "pass": true,
  "timestamp": 1234567890,
  "input": {...},
  "execution": {
    "command": "opencode activity test-simple-3-task-validation",
    "duration": 45000,
    "exitCode": 0,
    "logFile": "/tmp/task-completion-validation-1234567890.log",
    "logLines": 523
  },
  "logs": {
    "taskCompleteCount": 3,
    "expectedTasks": 3,
    "patterns": {
      "taskComplete": {
        "pattern": "Task completed:",
        "found": true,
        "occurrences": 3,
        "expected": 3,
        "pass": true
      },
      "trackedSession": {
        "pattern": "tracked session for correctness validation",
        "found": true,
        "occurrences": 3,
        "expected": 3,
        "pass": true
      }
    }
  },
  "activityRecord": {
    "activityId": "act_abc123",
    "recordFound": true,
    "sessionsSpawned": 3,
    "expectedSessions": 3,
    "hasTaskMetrics": true,
    "sessionsWithRequiredFields": 3,
    "missingFields": [],
    "pass": true,
    "details": [
      "Found 3 sessions in sessionsSpawned array",
      "Sessions with all required fields: 3/3",
      "✅ All session tracking requirements met"
    ]
  },
  "summary": "✅ PASS - All validation checks succeeded",
  "errors": [],
  "warnings": []
}
```

### Failure Output (Before Fix)
```json
{
  "pass": false,
  "activityRecord": {
    "sessionsSpawned": 0,
    "expectedSessions": 3,
    "pass": false,
    "details": [
      "⚠️  sessionsSpawned array is empty!",
      "❌ Session tracking requirements NOT met"
    ]
  },
  "summary": "❌ FAIL - Activity record verification failed: 0 sessions found, expected 3",
  "errors": []
}
```

## Test Cases

### Case 1: Simple 3-Task Activity
- **Impulse ID**: `validation-task-completion-logging-session-tracking-case-1`
- **Template**: `test-simple-3-task-validation`
- **Expected Tasks**: 3
- **Purpose**: Verify basic session tracking functionality

## Integration

### CI/CD Integration
```yaml
# .github/workflows/validate-session-tracking.yml
name: Validate Session Tracking
on: [push, pull_request]
jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Run validation harness
        run: |
          cd repos/metabob-opencode
          npx tsx tests/validation-harnesses/task-completion-logging-session-tracking-harness.ts
```

### Pre-commit Hook
```bash
# .git/hooks/pre-commit
npx tsx repos/metabob-opencode/tests/validation-harnesses/task-completion-logging-session-tracking-harness.ts
if [ $? -ne 0 ]; then
  echo "Session tracking validation failed!"
  exit 1
fi
```

## Dependencies
- Node.js + TypeScript (tsx)
- OpenCode CLI (`opencode activity` command)
- File system access for activity storage verification

## Limitations
- Requires OpenCode to be properly installed
- Requires activity template to be registered
- Creates temporary log files (cleaned up manually)
- Activity storage must be accessible

## Historical Context
This harness validates the fix for a critical bug discovered during lifecycle logging validation:
- 7-task validation activity showed 0 task completion logs and 0 sessions tracked
- Root cause: `taskResult.metadata?.sessionId` was undefined
- Impact: Correctness validation verdicts failed due to missing session data

The harness ensures this bug never regresses by automatically testing session tracking for every commit.

## Token Budget
2000 tokens (allocated for impulse storage and reuse)

## Maintenance
- Update expected counts if activity template changes
- Update required fields if session schema changes
- Add new test cases for edge cases (failures, cost limits, etc.)
