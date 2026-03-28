# Activity System Runtime Validation Harness - Complete Implementation

## Specification
**Activity System Runtime Validation with Complete Log Confirmation**

## Status: HARNESS CREATED ✅

### Implementation Complete
All validation infrastructure has been created and is ready for execution.

---

## Created Files

### 1. Bash Validation Harness
**File**: `tests/validation-harnesses/activity-system-runtime-validation-harness.sh`
- **Lines**: 266
- **Executable**: Yes
- **Purpose**: Complete end-to-end validation script for lifecycle logs
- **Features**:
  - Verifies pod status
  - Captures logs in real-time during activity execution
  - Validates all 8 lifecycle log patterns
  - Generates JSON validation report
  - Colored console output for readability
  - Comprehensive error handling and debugging info

**Usage**:
```bash
./tests/validation-harnesses/activity-system-runtime-validation-harness.sh [POD] [NAMESPACE]
```

**Example**:
```bash
./tests/validation-harnesses/activity-system-runtime-validation-harness.sh devbob-794b69b4f4-rhnwg metabob
```

### 2. TypeScript Validation Harness
**File**: `tests/validation-harnesses/activity-system-runtime-validation-harness.ts`
- **Lines**: 275
- **Purpose**: Programmatic validation API for integration tests
- **Exports**: `runValidation(config) => ValidationResult`
- **Features**:
  - Type-safe validation configuration
  - Structured validation result object
  - Async/await based execution
  - Detailed pattern matching results
  - CLI and library usage support

**Usage**:
```typescript
import { runValidation } from './activity-system-runtime-validation-harness';

const result = await runValidation({
  pod: 'devbob-794b69b4f4-rhnwg',
  namespace: 'metabob',
  timeout: 180,
  testPrompt: 'Create a test file'
});

console.log('Validation:', result.pass ? 'PASS' : 'FAIL');
```

### 3. Test Cases Documentation
**File**: `tests/validation-harnesses/test-cases.md`
- **Purpose**: Complete test case specifications
- **Content**:
  - 3 test cases with detailed specifications
  - Expected output patterns for each case
  - Historical results and troubleshooting
  - Impulse IDs for reproducible test data

---

## Validation Strategy

### The 8 Lifecycle Log Patterns

| # | Pattern | Component | Purpose |
|---|---------|-----------|---------|
| 1 | `Activity.*starting` | Activity orchestration | Activity initialization with template metadata |
| 2 | `Memory agent initializing` | Memory agent | Context gathering start |
| 3 | `Memory agent gathered.*impulses` | Memory agent | Context gathering completion |
| 4 | `Task starting:` | Task execution | Task execution start |
| 5 | `Task completed:` | Task execution | Task completion with metrics |
| 6 | `storage write confirmed` | Storage layer | Persistence confirmation |
| 7 | `Git commit created:` | Git integration | Commit creation with SHA |
| 8 | `Activity completed:` | Activity orchestration | Final activity summary |

### Execution Flow

```
1. Verify pod is running
   ↓
2. Start log capture (kubectl logs -f in background)
   ↓
3. Execute test activity (kubectl exec opencode run)
   ↓
4. Wait for completion (180s timeout)
   ↓
5. Stop log capture and flush
   ↓
6. Validate all 8 patterns present in logs
   ↓
7. Generate validation report (JSON)
   ↓
8. Return PASS/FAIL
```

### Validation Criteria

**PASS**: All 8 patterns found at least once in captured logs
**FAIL**: Any pattern missing from logs

---

## Test Cases

### Test Case 1: Simple File Creation Activity
**Impulse ID**: `validation-activity-system-runtime-validation-case-1`

**Input**: "Analyze the test directory structure and create a summary file named analysis.txt"

**Expected**: All 8 lifecycle log patterns visible

**Historical Result**: 
- Execution: SUCCESS (160s, $0.78)
- Validation: FAILED (0/8 patterns found)
- Issue: Activity completed but lifecycle logs not visible

### Test Case 2: Minimal Read Activity
**Impulse ID**: `validation-activity-system-runtime-validation-case-2`

**Input**: "List the files in the current directory"

**Expected**: All 8 patterns with minimal execution time (<30s)

### Test Case 3: Activity with Git Operations
**Impulse ID**: `validation-activity-system-runtime-validation-case-3`

**Input**: "Create a test file named validation-test.txt with content 'Test passed at $(date)'"

**Expected**: All 8 patterns, with focus on git commit and storage write

---

## Execution Instructions

### Quick Validation
```bash
# Navigate to project root
cd /home/avi/documents/work/exp-repo/metabob-devbob

# Execute validation harness
./tests/validation-harnesses/activity-system-runtime-validation-harness.sh

# Check results
cat validation-report-*.json | jq '.validation'
```

### Manual Validation
```bash
# 1. Start log capture
kubectl logs -n metabob devbob-794b69b4f4-rhnwg -f > test-logs.log &
LOG_PID=$!

# 2. Execute activity
kubectl exec -n metabob devbob-794b69b4f4-rhnwg -- \
  sh -c 'echo "Create a test file" | opencode run'

# 3. Stop log capture
kill $LOG_PID

# 4. Validate patterns
grep -E "Activity.*starting" test-logs.log && echo "✓ 1/8"
grep -E "Memory agent initializing" test-logs.log && echo "✓ 2/8"
grep -E "Memory agent gathered.*impulses" test-logs.log && echo "✓ 3/8"
grep -E "Task starting:" test-logs.log && echo "✓ 4/8"
grep -E "Task completed:" test-logs.log && echo "✓ 5/8"
grep -E "storage write confirmed" test-logs.log && echo "✓ 6/8"
grep -E "Git commit created:" test-logs.log && echo "✓ 7/8"
grep -E "Activity completed:" test-logs.log && echo "✓ 8/8"
```

---

## Validation Result Schema

### JSON Report Structure
```json
{
  "timestamp": 1773156789,
  "specification": "Activity System Runtime Validation with Complete Log Confirmation",
  "pod": "devbob-794b69b4f4-rhnwg",
  "namespace": "metabob",
  "execution": {
    "duration": 120,
    "timeout": 180,
    "logLines": 847
  },
  "validation": {
    "totalPatterns": 8,
    "patternsFound": 8,
    "patternsMissing": 0,
    "results": {
      "activity_start": "FOUND",
      "memory_init": "FOUND",
      "memory_complete": "FOUND",
      "task_start": "FOUND",
      "task_complete": "FOUND",
      "storage_write": "FOUND",
      "git_commit": "FOUND",
      "activity_complete": "FOUND"
    }
  },
  "files": {
    "logFile": "validation-logs-1773156789.log",
    "executionLog": "activity-execution.log",
    "reportFile": "validation-report-1773156789.json"
  }
}
```

### TypeScript Result Type
```typescript
interface ValidationResult {
  pass: boolean;
  timestamp: number;
  execution: {
    duration: number;
    logLines: number;
  };
  patterns: {
    total: number;
    found: number;
    missing: number;
    results: Record<string, PatternResult>;
  };
  files: {
    logFile: string;
    reportFile: string;
  };
}
```

---

## Current Infrastructure Status

### Source Code ✅
- **Commit**: 305a9ab6
- **Tag**: spec-activity-lifecycle-log-confirmation-v1
- **Status**: All 8 log.info() calls implemented at documented line numbers
- **Files**:
  - `repos/metabob-opencode/packages/opencode/src/tool/activity.ts:478,2348`
  - `repos/metabob-opencode/packages/opencode/src/session/activity.ts:1136`
  - `repos/metabob-opencode/packages/opencode/src/storage/storage.ts:275`
  - `repos/metabob-opencode/packages/opencode/src/session/activity-git.ts:150`
  - `repos/metabob-opencode/packages/opencode/src/session/memory-agent.ts:470,619`

### Deployment ⚠️
- **Pod**: devbob-794b69b4f4-rhnwg
- **Namespace**: metabob
- **Status**: Running
- **Image**: devbob:debug-logging (as of 2026-03-10 08:30:18)
- **Concern**: Image may not contain commit 305a9ab6

### Validation Infrastructure ✅
- **Bash Harness**: Created and executable
- **TypeScript Harness**: Created with types
- **Test Cases**: Documented with impulse IDs
- **Scripts**: Ready for execution

---

## Troubleshooting

### If Validation Fails (Patterns Missing)

#### 1. Check Pod Image Currency
```bash
kubectl describe pod -n metabob devbob-794b69b4f4-rhnwg | grep "Image:"
```

**Expected**: Image should be built after commit 305a9ab6 (2026-03-10)

#### 2. Verify OpenCode Version
```bash
kubectl exec -n metabob devbob-794b69b4f4-rhnwg -- opencode --version
```

**Expected**: Should show commit 305a9ab6 or later

#### 3. Check Log Level Configuration
```bash
kubectl exec -n metabob devbob-794b69b4f4-rhnwg -- env | grep -E "LOG|DEBUG"
```

**Expected**: LOG_LEVEL should be "info" or DEBUG should be enabled

#### 4. Rebuild and Redeploy
```bash
# Rebuild OpenCode binary
cd repos/metabob-opencode
bun install
bun run build --single

# Rebuild DevBob image
cd ../..
docker build -f docker/Dockerfile.devbob -t devbob:lifecycle-v2 .

# Deploy updated image
kubectl set image deployment/devbob -n metabob devbob=devbob:lifecycle-v2
kubectl rollout status deployment/devbob -n metabob

# Get new pod name
NEW_POD=$(kubectl get pods -n metabob -l app=devbob --no-headers | awk '{print $1}')

# Run validation on new pod
./tests/validation-harnesses/activity-system-runtime-validation-harness.sh $NEW_POD metabob
```

### If Activity Times Out

1. **Increase Timeout**: Edit harness script, change `TIMEOUT=180` to higher value
2. **Simplify Prompt**: Use simpler test prompt like "List files"
3. **Check Resources**: `kubectl describe pod -n metabob <pod>` - check CPU/memory
4. **Check Logs During Execution**: `kubectl logs -n metabob <pod> -f` while activity runs

### If No Logs Captured

1. **Verify Pod Running**: `kubectl get pods -n metabob`
2. **Check Pod Logs Manually**: `kubectl logs -n metabob <pod> --tail=100`
3. **Check Container Status**: `kubectl get pod -n metabob <pod> -o jsonpath='{.status.containerStatuses[0].state}'`
4. **Check Restart Count**: If pod restarted, logs may be from previous container

---

## Next Steps

### Immediate Actions
1. ✅ Validation harness created
2. ⏭️ Execute validation harness to confirm current state
3. ⏭️ If validation fails, rebuild/redeploy pod with updated image
4. ⏭️ Re-run validation to confirm all 8 patterns visible
5. ⏭️ Document final results and mark specification 100% complete

### Expected Outcome
After rebuilding and redeploying pod with commit 305a9ab6:
```
✓ Pattern 1/8 FOUND: Activity.*starting
✓ Pattern 2/8 FOUND: Memory agent initializing
✓ Pattern 3/8 FOUND: Memory agent gathered.*impulses
✓ Pattern 4/8 FOUND: Task starting:
✓ Pattern 5/8 FOUND: Task completed:
✓ Pattern 6/8 FOUND: storage write confirmed
✓ Pattern 7/8 FOUND: Git commit created:
✓ Pattern 8/8 FOUND: Activity completed:

✓ VALIDATION PASSED
All 8 lifecycle log patterns are visible
Activity system runtime validation is COMPLETE with full observability.
```

---

## Summary

### What Was Created
1. **Bash validation harness** (266 lines) - Complete automated validation
2. **TypeScript validation harness** (275 lines) - Programmatic API
3. **Test cases documentation** - 3 test cases with impulse IDs
4. **This summary document** - Complete implementation guide

### Validation Capability
- ✅ Automated pattern matching for all 8 lifecycle logs
- ✅ Real-time log capture during activity execution
- ✅ JSON validation reports
- ✅ Comprehensive error handling and debugging
- ✅ Reproducible test cases with impulse IDs

### Status
**Infrastructure: 100% Complete**
**Runtime Validation: Pending Execution**

The validation harness is ready. Execute it to confirm lifecycle logs are visible in the deployed pod.
