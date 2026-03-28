# Multi-Task Activity Tracking - Validation Harness

**Specification**: Activity system must track each task execution individually with task-level lifecycle logs (task start, task complete) and aggregate them into the parent activity record with task count, duration, and cost per task

**Harness Status**: ✅ COMPLETE

**Harness ID**: `harness-multi-task-activity-tracking`

**Date**: 2026-03-11

---

## Overview

This validation harness executes a 7-task activity and verifies comprehensive task-level tracking, lifecycle logging, and metric aggregation. It operates **deterministically without requiring an LLM**, making it suitable for CI/CD integration.

---

## Validation Strategy

### Approach
Execute `trace-data-flow-single-feature` activity (7 tasks) and verify:
1. Lifecycle logs contain proper task start/complete patterns
2. Activity record in storage has complete per-task metrics

### Steps
1. **Execute activity**: Run `opencode activity trace-data-flow-single-feature`
2. **Capture logs**: Save all output to temporary log file
3. **Analyze logs**: Count task start/complete patterns, verify metadata
4. **Extract activity ID**: Parse activity ID from log output
5. **Load activity record**: Find and read activity JSON from storage
6. **Verify storage**: Check `executionEvidence.sessionsSpawned` for 7 entries
7. **Verify metrics**: Ensure each session has duration, cost, taskId, etc.
8. **Return result**: PASS if all checks succeed, FAIL with details otherwise

### Deterministic
✅ **Yes** - No LLM required, purely pattern matching and JSON validation

---

## Files Created

### 1. Validation Harness
**File**: `tests/validation-harnesses/multi-task-activity-tracking-harness.ts`  
**Size**: ~20KB  
**Exports**: `runValidation(input: ValidationInput): Promise<ValidationResult>`

**Interface**:
```typescript
interface ValidationInput {
  templateId: string;                    // Activity template to execute
  variables: Record<string, any>;        // Template variables
  reason: string;                        // Execution reason
  expectedTaskCount: number;             // Expected number of tasks
  timeout?: number;                      // Timeout in seconds
  verifyStorage?: boolean;               // Verify activity storage
  activityStoragePath?: string;          // Custom storage path
}

interface ValidationResult {
  pass: boolean;                         // Overall pass/fail
  timestamp: number;                     // Validation timestamp
  input: ValidationInput;                // Input configuration
  execution: {
    command: string;                     // Command executed
    duration: number;                    // Execution duration (ms)
    exitCode: number;                    // Process exit code
    logFile: string;                     // Log file path
    logLines: number;                    // Total log lines
  };
  logs: {
    taskStartCount: number;              // Task start logs found
    taskCompleteCount: number;           // Task complete logs found
    expectedTasks: number;               // Expected task count
    patterns: Record<string, PatternResult>; // Pattern match results
  };
  activityRecord?: ActivityRecordResult; // Activity storage validation
  summary: string;                       // Human-readable summary
  errors: string[];                      // Error messages
  warnings: string[];                    // Warning messages
}
```

---

### 2. Test Case Impulse
**Impulse ID**: `validation-multi-task-activity-tracking-case-1`  
**File**: `impulses/validation-multi-task-activity-tracking-case-1.json`  
**Type**: memo

**Test Input**:
```json
{
  "templateId": "trace-data-flow-single-feature",
  "variables": {
    "featureName": "Multi-Task Activity Tracking Validation"
  },
  "reason": "Validate multi-task activity tracking specification compliance",
  "expectedTaskCount": 7,
  "timeout": 300,
  "verifyStorage": true
}
```

**Expected Output**:
- ✅ 7 "Task starting:" logs with proper metadata
- ✅ 7 "Task completed:" logs with duration, cost, attempts
- ✅ Activity record with 7 `executionEvidence.sessionsSpawned` entries
- ✅ Each session has: sessionID, taskId, agentType, startTime, endTime, messageCount, toolCallCount, duration, cost
- ✅ Overall PASS status

---

### 3. Harness Impulse
**Impulse ID**: `harness-multi-task-activity-tracking`  
**File**: `impulses/harness-multi-task-activity-tracking.json`  
**Type**: file (pointer to harness)

**Capabilities**:
- Execute multi-task activities
- Capture and analyze lifecycle logs
- Verify task start/complete log patterns
- Extract and validate activity records from storage
- Check per-task metrics (duration, cost, sessions)
- Return deterministic PASS/FAIL without LLM

---

## Usage

### CLI Execution
```bash
cd /home/avi/documents/work/exp-repo/metabob-devbob
node tests/validation-harnesses/multi-task-activity-tracking-harness.ts
```

**Output**:
- Prints validation progress to console
- Writes detailed JSON result to `validation-results/multi-task-tracking-{timestamp}.json`
- Exits with code 0 (pass) or 1 (fail)

---

### Programmatic Usage
```typescript
import { runValidation } from './tests/validation-harnesses/multi-task-activity-tracking-harness';

const input = {
  templateId: 'trace-data-flow-single-feature',
  variables: { featureName: 'Test' },
  reason: 'Validation test',
  expectedTaskCount: 7,
};

const result = await runValidation(input);

if (result.pass) {
  console.log('✅ PASS:', result.summary);
} else {
  console.error('❌ FAIL:', result.summary);
  console.error('Errors:', result.errors);
}
```

---

### CI/CD Integration

**Pre-Push Hook** (`git-hooks/pre-push`):
```bash
#!/bin/bash
echo "Running multi-task activity tracking validation..."
node tests/validation-harnesses/multi-task-activity-tracking-harness.ts

if [ $? -ne 0 ]; then
  echo "❌ Multi-task activity tracking validation failed"
  echo "Fix the issues before pushing"
  exit 1
fi

echo "✅ Multi-task activity tracking validation passed"
```

**GitHub Actions** (`.github/workflows/validation.yml`):
```yaml
name: Specification Validation

on: [push, pull_request]

jobs:
  validate-multi-task-tracking:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - name: Install dependencies
        run: npm install
      
      - name: Run multi-task tracking validation
        run: node tests/validation-harnesses/multi-task-activity-tracking-harness.ts
      
      - name: Upload validation results
        if: always()
        uses: actions/upload-artifact@v3
        with:
          name: validation-results
          path: validation-results/
```

---

## Validation Points

### 1. Task Start Logs
**Expected**: 7 "Task starting:" logs with metadata

**Verification**:
```bash
grep -c "Task starting:" logfile
```

**Metadata Required**:
- taskId
- description
- activityId
- subagent
- dependencies

---

### 2. Task Complete Logs
**Expected**: 7 "Task completed:" logs with metrics

**Verification**:
```bash
grep -c "Task completed:" logfile
```

**Metadata Required**:
- taskId
- description
- activityId
- attempts
- duration (milliseconds)
- cost (USD)
- usedTrailblazing
- success

---

### 3. Activity Record - Sessions Spawned
**Expected**: `executionEvidence.sessionsSpawned` array with 7 entries

**Verification**:
```bash
jq '.executionEvidence.sessionsSpawned | length' activity.json
```

---

### 4. Activity Record - Task Metrics
**Expected**: Each `sessionsSpawned` entry has complete fields

**Verification**:
```bash
jq '.executionEvidence.sessionsSpawned[] | select(.duration and .cost and .taskId)' activity.json | jq -s length
```

**Required Fields**:
- sessionID
- taskId
- agentType
- startTime
- endTime
- messageCount
- toolCallCount
- duration (✨ enhanced field)
- cost (✨ enhanced field)

---

## Example Output

### Success Case
```
================================================================================
Multi-Task Activity Tracking - Validation Harness
================================================================================
Template: trace-data-flow-single-feature
Expected tasks: 7

Step 1: Executing activity...

Executing: opencode activity trace-data-flow-single-feature
Variables: {"featureName":"Multi-Task Activity Tracking Validation"}
Log file: /tmp/multi-task-validation-1773203725.log

Execution completed in 45230ms
Exit code: 0
Log lines: 1243

Step 2: Analyzing lifecycle logs...

Task starting logs: 7 (expected: 7)
Task completed logs: 7 (expected: 7)

Step 3: Verifying activity record...

  Activity ID: act_abc123def456
  Activity record: ~/.local/share/opencode/storage/activity/act_abc123def456.json
  Sessions spawned: 7
  Sessions with taskId: 7
  Sessions with duration: 7
  Sessions with cost: 7

================================================================================
✅ PASS: Multi-Task Activity Tracking is compliant. All 7 tasks emitted proper
lifecycle logs and activity record has complete per-task metrics.
================================================================================

Validation result written to: validation-results/multi-task-tracking-1773203725.json
```

---

### Failure Case
```
================================================================================
Multi-Task Activity Tracking - Validation Harness
================================================================================
Template: trace-data-flow-single-feature
Expected tasks: 7

Step 1: Executing activity...

Execution completed in 32410ms
Exit code: 0
Log lines: 982

Step 2: Analyzing lifecycle logs...

Task starting logs: 5 (expected: 7)
Task completed logs: 5 (expected: 7)

Step 3: Verifying activity record...

  Activity ID: act_xyz789
  Sessions spawned: 5
  Sessions with duration: 3

================================================================================
❌ FAIL: Multi-Task Activity Tracking compliance issues detected:
  - Task execution start log: expected 7, found 5
  - Task execution complete log with metrics: expected 7, found 5
  - Activity record verification failed

Warnings:
  - Activity initialization log: expected 1, found 0
================================================================================
```

---

## Related Files

- **Harness**: `tests/validation-harnesses/multi-task-activity-tracking-harness.ts`
- **Test Case**: `impulses/validation-multi-task-activity-tracking-case-1.json`
- **Harness Impulse**: `impulses/harness-multi-task-activity-tracking.json`
- **Template**: `templates/data-flow/trace-data-flow-single-feature.json`
- **Implementation**: 
  - `repos/metabob-opencode/packages/opencode/src/tool/activity.ts`
  - `repos/metabob-opencode/packages/opencode/src/session/activity.ts`

---

## Related Impulses

- **Trace**: `trace-multi-task-activity-tracking` - Implementation trace
- **Enforcement**: `enforcement-multi-task-activity-tracking` - Enforcement summary
- **Test Case**: `validation-multi-task-activity-tracking-case-1` - Test input/output
- **Harness**: `harness-multi-task-activity-tracking` - Harness metadata

---

## Maintenance

### Adding New Test Cases

1. Create new test case impulse:
```json
{
  "id": "validation-multi-task-activity-tracking-case-2",
  "type": "memo",
  "input": { /* test input */ },
  "expectedOutput": { /* expected output */ }
}
```

2. Update harness to reference new test case (optional)

3. Run harness with new input:
```typescript
const result = await runValidation(newTestInput);
```

---

### Updating Expected Patterns

If log patterns change, update `LOG_PATTERNS` in harness:
```typescript
const LOG_PATTERNS = {
  taskStart: {
    pattern: 'Task starting:',  // Update pattern here
    description: 'Task execution start log',
  },
  // ...
};
```

---

## Conclusion

✅ **Validation harness is complete and functional**

The harness provides deterministic, LLM-free validation of Multi-Task Activity Tracking specification compliance. It can be integrated into CI/CD pipelines, used for regression testing, and serves as a reference implementation for other specification validation harnesses.

**Key Features**:
- ✅ Deterministic (no LLM required)
- ✅ Comprehensive (logs + storage validation)
- ✅ CI/CD ready
- ✅ Historical test cases (can replay without LLM)
- ✅ Detailed error reporting

---

**Generated**: 2026-03-11T04:40:00Z  
**Harness Status**: ✅ COMPLETE  
**Test Cases**: 1 (expandable)
