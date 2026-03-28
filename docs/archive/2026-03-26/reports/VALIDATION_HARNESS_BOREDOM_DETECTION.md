# Validation Harness: Boredom Activity Detection Mechanism

## Overview

This document describes the validation harness for the Boredom Activity Detection Mechanism specification. The harness provides automated, LLM-free testing of all detection methods and integration points.

**Specification**: Boredom Activity Detection Mechanism  
**Harness File**: `tests/validation-harnesses/boredom-activity-detection-mechanism-harness.ts`  
**Test Cases**: 5 (stored as impulses)  
**Impulse ID**: `harness-boredom-activity-detection-mechanism`

---

## Detection Mechanisms Tested

The harness validates all six detection mechanisms identified in the trace analysis:

### 1. Title Prefix Detection
- **Marker**: `[BOREDOM]` or `[MANUAL BOREDOM]`
- **Method**: `DetectionMethods.detectByTitlePrefix(activity)`
- **Tests**: Case 1, 2, 3, 4

### 2. Branch Name Detection
- **Marker**: `boredom-activity`
- **Method**: `DetectionMethods.detectByBranch(activity)`
- **Tests**: Case 1, 2, 4, 5

### 3. Persistent Field Detection
- **Marker**: `activity.isBoredom === true`
- **Method**: `DetectionMethods.detectByPersistentField(activity)`
- **Tests**: All cases

### 4. Marker Consistency Validation
- **Assertion**: All markers present if any marker present
- **Method**: `Assertions.assertMarkersConsistent(activity)`
- **Tests**: All cases

### 5. InitiatedBy Correctness
- **Assertion**: `initiatedBy` matches title prefix type
- **Method**: `Assertions.assertInitiatedByCorrect(activity)`
- **Tests**: Case 1, 2

### 6. No Debug Prefix Interference
- **Assertion**: No `[EVIDENCE_TEST]` prefix present
- **Method**: `Assertions.assertNoDebugPrefix(activity)`
- **Tests**: All cases

---

## Test Cases

### Case 1: Auto Boredom Activity with [BOREDOM] Prefix

**Impulse ID**: `validation-boredom-activity-detection-mechanism-case-1`

**Input**:
```json
{
  "title": "[BOREDOM] fix-auth-failures",
  "branch": "boredom-activity"
}
```

**Expected Output**:
```json
{
  "isBoredom": true,
  "initiatedBy": "boredom-auto",
  "branch": "boredom-activity",
  "titleHasBoredomPrefix": true,
  "detectionMethods": {
    "titlePrefix": true,
    "branchName": true,
    "persistentField": true
  }
}
```

**Tests**: Standard auto-executed boredom activity detection

---

### Case 2: Manual Boredom Activity with [MANUAL BOREDOM] Prefix

**Impulse ID**: `validation-boredom-activity-detection-mechanism-case-2`

**Input**:
```json
{
  "title": "[MANUAL BOREDOM] improve-test-coverage",
  "branch": "main"
}
```

**Expected Output**:
```json
{
  "isBoredom": true,
  "initiatedBy": "boredom-manual",
  "branch": "boredom-activity",
  "titleHasBoredomPrefix": true,
  "detectionMethods": {
    "titlePrefix": true,
    "branchName": true,
    "persistentField": true
  }
}
```

**Tests**: Manual boredom trigger with auto-correction of branch name

---

### Case 3: Normal User Activity (No Boredom Markers)

**Impulse ID**: `validation-boredom-activity-detection-mechanism-case-3`

**Input**:
```json
{
  "title": "Add login feature",
  "branch": "feature-login"
}
```

**Expected Output**:
```json
{
  "isBoredom": null,
  "initiatedBy": null,
  "branch": "feature-login",
  "titleHasBoredomPrefix": false,
  "detectionMethods": {
    "titlePrefix": false,
    "branchName": false,
    "persistentField": false
  }
}
```

**Tests**: Control case - normal user activity should not be detected as boredom

---

### Case 4: Boredom Activity with Only Title Prefix (Auto-Correction)

**Impulse ID**: `validation-boredom-activity-detection-mechanism-case-4`

**Input**:
```json
{
  "title": "[BOREDOM] refactor-database",
  "branch": "main"
}
```

**Expected Output**:
```json
{
  "isBoredom": true,
  "initiatedBy": "boredom-auto",
  "branch": "boredom-activity",
  "titleHasBoredomPrefix": true,
  "detectionMethods": {
    "titlePrefix": true,
    "branchName": true,
    "persistentField": true
  }
}
```

**Tests**: Enforcement logic auto-corrects branch to `boredom-activity`

---

### Case 5: Boredom Activity with Only Branch Name (Auto-Correction)

**Impulse ID**: `validation-boredom-activity-detection-mechanism-case-5`

**Input**:
```json
{
  "title": "Some Activity",
  "branch": "boredom-activity"
}
```

**Expected Output**:
```json
{
  "isBoredom": true,
  "initiatedBy": null,
  "branch": "boredom-activity",
  "titleHasBoredomPrefix": false,
  "detectionMethods": {
    "titlePrefix": false,
    "branchName": true,
    "persistentField": true
  }
}
```

**Tests**: Branch-based detection sets persistent field even without title prefix

---

## Usage

### Running the Harness

```bash
# From repository root
cd /home/avi/documents/work/exp-repo/metabob-devbob

# Run validation harness
npx tsx tests/validation-harnesses/boredom-activity-detection-mechanism-harness.ts
```

### Expected Output

```
🔍 Running Boredom Activity Detection Mechanism Validation Harness

Running 5 test cases...

# Boredom Activity Detection Mechanism - Validation Report

**Total Tests**: 5
**Passed**: 5 ✅
**Failed**: 0 ❌
**Success Rate**: 100.0%

---

## Test 1: Auto Boredom Activity with [BOREDOM] Prefix ✅ PASS

**Expected**:
```json
{
  "isBoredom": true,
  "initiatedBy": "boredom-auto",
  ...
}
```

**Actual**:
```json
{
  "isBoredom": true,
  "initiatedBy": "boredom-auto",
  ...
}
```

---

[... additional test results ...]

📄 Report saved to: validation-report-boredom-detection.md
```

### Exit Codes

- `0` - All tests passed (100% success rate)
- `1` - One or more tests failed

### Generated Files

- **Report**: `validation-report-boredom-detection.md`
- **Test Cases**: `impulses/validation-test-cases/validation-boredom-activity-detection-mechanism-case-*.json`

---

## Integration Points Tested

### 1. Activity Creation
- **Component**: `Activity.create()`
- **Location**: `repos/metabob-opencode/packages/opencode/src/session/activity.ts:392-465`
- **Tests**: Marker enforcement logic, auto-correction, schema validation

### 2. BoredomManager Execution
- **Component**: `BoredomManager.executeBoredomActivity()`
- **Location**: `repos/metabob-opencode/packages/opencode/src/session/boredom-manager.ts:250-373`
- **Tests**: Persistent field assignment, failed activity cleanup

### 3. Schema Validation
- **Component**: `Activity.Info` schema
- **Location**: `repos/metabob-opencode/packages/opencode/src/session/activity.ts:153-356`
- **Tests**: Optional field compatibility, enum validation

---

## Observable Indicators

The harness validates these observable indicators:

### 1. Activity Schema Fields
```typescript
{
  isBoredom: boolean | undefined
  initiatedBy: "user" | "boredom-auto" | "boredom-manual" | undefined
  branch: string
  title: string
  reason: string | undefined
}
```

### 2. Detection Method Results
```typescript
{
  titlePrefix: boolean      // title.includes('[BOREDOM]')
  branchName: boolean        // branch === 'boredom-activity'
  persistentField: boolean   // isBoredom === true
}
```

### 3. Assertion Results
```typescript
{
  markersConsistent: { pass: boolean, errors: string[] }
  initiatedByCorrect: { pass: boolean, errors: string[] }
  noDebugPrefix: { pass: boolean, errors: string[] }
}
```

---

## Validation Workflow

```
┌─────────────────────────────────────────────────────────────┐
│                   VALIDATION WORKFLOW                        │
└─────────────────────────────────────────────────────────────┘

  Load Test Cases
       │
       ├─ From impulses: impulses/validation-test-cases/*.json
       └─ Fallback: inline test cases in harness
       │
       ▼
  For Each Test Case
       │
       ├─ Create Activity with input
       │   └─ Activity.create({ title, branch })
       │
       ├─ Capture Actual Output
       │   ├─ activity.isBoredom
       │   ├─ activity.initiatedBy
       │   ├─ activity.branch
       │   └─ Detection method results
       │
       ├─ Run Assertions
       │   ├─ Assertions.assertMarkersConsistent()
       │   ├─ Assertions.assertInitiatedByCorrect()
       │   └─ Assertions.assertNoDebugPrefix()
       │
       ├─ Compare with Expected Output
       │   └─ Field-by-field comparison
       │
       ├─ Clean Up
       │   └─ Activity.remove(activity.id)
       │
       └─ Return ValidationResult
           ├─ pass: boolean
           ├─ testCase: string
           ├─ actual: any
           ├─ expected: any
           └─ errors?: string[]
       │
       ▼
  Generate Report
       │
       ├─ Calculate success rate
       ├─ Format results (markdown)
       ├─ Write to file: validation-report-boredom-detection.md
       └─ Display to console
       │
       ▼
  Exit with Code
       │
       ├─ 0 if all tests pass
       └─ 1 if any test fails
```

---

## Impulse Documentation

### Harness Impulse

**ID**: `harness-boredom-activity-detection-mechanism`  
**Type**: `file`  
**Pointer**: `tests/validation-harnesses/boredom-activity-detection-mechanism-harness.ts`  
**Budget**: 2000 tokens

**Content**: Full harness implementation (400+ lines)

### Test Case Impulses

| Impulse ID | Type | Budget | Content |
|------------|------|--------|---------|
| `validation-boredom-activity-detection-mechanism-case-1` | `memo` | 500 | Auto boredom test case |
| `validation-boredom-activity-detection-mechanism-case-2` | `memo` | 500 | Manual boredom test case |
| `validation-boredom-activity-detection-mechanism-case-3` | `memo` | 500 | Normal activity test case |
| `validation-boredom-activity-detection-mechanism-case-4` | `memo` | 500 | Auto-correction test case (title) |
| `validation-boredom-activity-detection-mechanism-case-5` | `memo` | 500 | Auto-correction test case (branch) |

**Total Budget**: 4500 tokens (harness + test cases)

---

## Maintenance

### Adding New Test Cases

1. **Create impulse file**: `impulses/validation-test-cases/validation-boredom-activity-detection-mechanism-case-N.json`
2. **Define test case**:
   ```json
   {
     "id": "validation-boredom-activity-detection-mechanism-case-N",
     "name": "Test case description",
     "input": { ... },
     "expectedOutput": { ... }
   }
   ```
3. **Run harness**: Harness automatically loads new impulse files
4. **Verify**: Check validation report for new test results

### Updating Expected Outputs

If enforcement changes expected behavior:

1. **Update impulse files**: Modify `expectedOutput` in impulse JSON
2. **Document change**: Update this README with new expected behavior
3. **Re-run harness**: Verify all tests pass with new expectations
4. **Commit impulses**: Commit updated impulse files to git

### Debugging Failed Tests

When a test fails:

1. **Check console output**: See which assertion failed
2. **Review report**: Read detailed error messages in validation report
3. **Compare actual vs expected**: JSON diff shows mismatches
4. **Inspect activity**: Use `Activity.get()` to inspect created activities
5. **Check enforcement**: Verify enforcement logic is working correctly

---

## Related Documentation

- **Trace Analysis**: `BOREDOM_DETECTION_MECHANISM_TRACE.md`
- **Enforcement Summary**: `BOREDOM_DETECTION_ENFORCEMENT_SUMMARY.md`
- **Validation Harnesses**: `tests/validation-harnesses/README.md`
- **Test Case Impulses**: `impulses/validation-test-cases/`

---

## Summary

This validation harness provides:

✅ **Automated testing** - No LLM required, runs as pure code  
✅ **Comprehensive coverage** - Tests all 6 detection mechanisms  
✅ **Historical test cases** - Impulses stored in git, versioned  
✅ **Clear reporting** - Markdown report with pass/fail status  
✅ **CI integration** - Can run in automated pipelines  
✅ **Maintenance friendly** - Easy to add new test cases

**Status**: ✅ **READY FOR USE**

Run the harness to validate that the Boredom Activity Detection Mechanism enforcement is working correctly!
