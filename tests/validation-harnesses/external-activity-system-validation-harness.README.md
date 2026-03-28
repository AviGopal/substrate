# External Activity System Validation Harness

## Overview

This validation harness **proves** that OpenCode's activity system works through external black-box testing. It uses ONLY the compiled OpenCode distribution and validates behavior through log analysis - no direct code execution.

## Purpose

Validates that:
1. ✅ OpenCode can find and execute existing activities
2. ✅ OpenCode can create new activities via goal-seeking
3. ✅ NO direct tool calls occur in root session (only activities)
4. ✅ All execution happens through compiled distribution
5. ✅ Behavior is observable through logs only

## Test Cases

### Test Case 1: Find Existing Activity

**Command**: `opencode activity search 'add REST endpoint'`

**Expected Behavior**:
- Searches for matching activity templates
- Returns `add-rest-endpoint` template
- Logs show: `search_activities called`, `templates returned`
- NO direct tool calls in root session

**Success Criteria**:
- All expected patterns found in logs
- No forbidden patterns (direct bash/read/edit in root)
- Exit code 0
- Execution time < 30s

---

### Test Case 2: Create New Activity via Goal-Seeking

**Command**: `opencode activity create --goal 'Add retry logic...' --name 'Add API Retry Logic' --category 'feature'`

**Expected Behavior**:
- Goal decomposed into sub-goals
- Searches for existing activities to compose
- Creates new template with generated tasks
- Registers template to backend
- Does NOT execute the created template

**Success Criteria**:
- Goal decomposition patterns found
- Template creation confirmed
- Template NOT executed (no `Activity starting`)
- No forbidden patterns
- Exit code 0
- Execution time < 2 minutes

---

### Test Case 3: Verify No Direct Tool Calls

**Command**: `opencode activity list`

**Expected Behavior**:
- Lists all available activity templates
- Uses `list_activity_templates` tool
- NO direct bash/read/edit/write calls in root session

**Success Criteria**:
- List patterns found
- NO forbidden tool call patterns in root session
- Exit code 0
- Execution time < 30s

---

## Prerequisites

1. **Build OpenCode Distribution**:
```bash
cd repos/metabob-opencode
npm install
npm run build:dist
```

2. **Verify Binary Exists**:
```bash
ls repos/metabob-opencode/packages/opencode/dist/opencode-linux-x64/opencode
```

## Running the Harness

### Option 1: CLI Execution

```bash
npx ts-node tests/validation-harnesses/external-activity-system-validation-harness.ts
```

### Option 2: Programmatic Usage

```typescript
import { runAllValidations } from './external-activity-system-validation-harness';

const result = await runAllValidations();

if (result.summary.overallPass) {
  console.log('✅ All validations passed');
} else {
  console.log('❌ Some validations failed');
  process.exit(1);
}
```

### Option 3: Single Test Case

```typescript
import { runValidation, TEST_CASE_1_EXISTING_ACTIVITY } from './external-activity-system-validation-harness';

const output = await runValidation(TEST_CASE_1_EXISTING_ACTIVITY);

console.log(`Test passed: ${output.pass}`);
console.log(`Evidence:`, output.evidence);
```

## Output

### Console Output

```
================================================================================
External Activity System Validation Harness
================================================================================

Running: case-1-existing-activity...
  Status: ✅ PASS
  Log: test-results/external-validation-harness/case-1-existing-activity-1234567890.log

Running: case-2-novel-goal...
  Status: ✅ PASS
  Log: test-results/external-validation-harness/case-2-novel-goal-1234567890.log

Running: case-3-no-direct-tools...
  Status: ✅ PASS
  Log: test-results/external-validation-harness/case-3-no-direct-tools-1234567890.log

================================================================================
VALIDATION SUMMARY
================================================================================

Total tests: 3
Passed: 3
Failed: 0

Meta-Validation:
  ✓ Tested compiled distribution: true
  ✓ Tested existing activity: true
  ✓ Tested goal-seeking: true
  ✓ Tested no direct tools: true
  ✓ Tested log analysis: true
  ✓ All requirements tested: true

Overall Result: ✅ PASS
================================================================================

Results saved to: test-results/external-validation-harness/validation-result-1234567890.json
```

### Result Files

All results are saved to `test-results/external-validation-harness/`:

```
test-results/external-validation-harness/
├── case-1-existing-activity-<timestamp>.log
├── case-2-novel-goal-<timestamp>.log
├── case-3-no-direct-tools-<timestamp>.log
└── validation-result-<timestamp>.json
```

### Result JSON Structure

```json
{
  "specificationName": "external-activity-system-validation",
  "timestamp": 1234567890,
  "testCases": [
    {
      "id": "case-1-existing-activity",
      "input": {...},
      "output": {
        "pass": true,
        "actual": {
          "exitCode": 0,
          "patternsFound": ["search_activities.*called", "templates.*returned"],
          "forbiddenPatternsFound": []
        },
        "evidence": [
          "✅ Pattern found: search_activities.*called",
          "✅ Forbidden pattern absent: bash.*tool.*sessionID:.*root"
        ]
      },
      "passed": true
    }
  ],
  "summary": {
    "totalTests": 3,
    "passed": 3,
    "failed": 0,
    "overallPass": true
  },
  "metaValidation": {
    "testedCompiledDistribution": true,
    "testedExistingActivity": true,
    "testedGoalSeeking": true,
    "testedNoDirectTools": true,
    "testedLogAnalysis": true,
    "allRequirementsTested": true
  }
}
```

## Log Analysis

The harness performs session-aware log analysis to detect:

### ✅ Expected Patterns

- `search_activities.*called` - Search tool invoked
- `list_activity_templates.*called` - List tool invoked
- `create_activity_goal_seeking.*called` - Goal-seeking invoked
- `Goal.*decomposed` - Goal broken down
- `Template.*created` - Template generated
- `Registered.*backend` - Template registered

### ❌ Forbidden Patterns

- `bash.*tool.*sessionID:.*root` - Direct bash in root
- `read.*tool.*sessionID:.*root` - Direct read in root
- `edit.*tool.*sessionID:.*root` - Direct edit in root
- `write.*tool.*sessionID:.*root` - Direct write in root
- `glob.*tool.*sessionID:.*root` - Direct glob in root
- `grep.*tool.*sessionID:.*root` - Direct grep in root

**Key Validation**: Tool calls in `activity-*` child sessions are ALLOWED. Only calls in root session are forbidden.

## Meta-Validation

The harness includes meta-validation to ensure it properly tested all requirements:

```typescript
metaValidation: {
  testedCompiledDistribution: true,  // Used compiled binary, not dev code
  testedExistingActivity: true,      // Test case 1 executed
  testedGoalSeeking: true,           // Test case 2 executed
  testedNoDirectTools: true,         // Test case 3 executed
  testedLogAnalysis: true,           // All tests analyzed logs
  allRequirementsTested: true        // All above are true
}
```

## Exit Codes

- **0**: All validations passed
- **1**: One or more validations failed

## Troubleshooting

### Error: "OpenCode binary not found"

**Cause**: Distribution not built

**Solution**:
```bash
cd repos/metabob-opencode
npm run build:dist
```

### Error: "Forbidden patterns detected"

**Cause**: Direct tool calls found in root session

**Debug**: Check log file for forbidden pattern matches
```bash
grep -E "(bash|read|edit|write).*tool.*sessionID:.*root" \
  test-results/external-validation-harness/case-*.log
```

**Fix**: Ensure all tool calls happen within activity child sessions

### Error: "Command timed out"

**Cause**: Execution exceeded timeout

**Solution**: Increase timeout in test case definition:
```typescript
const TEST_CASE_CUSTOM: ValidationInput = {
  ...
  timeout: 300000, // 5 minutes
};
```

## CI/CD Integration

Add to `.github/workflows/validation.yml`:

```yaml
name: External Activity Validation

on: [push, pull_request]

jobs:
  validate-activity-system:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - name: Build OpenCode Distribution
        run: |
          cd repos/metabob-opencode
          npm install
          npm run build:dist
      
      - name: Run External Validation
        run: |
          npx ts-node tests/validation-harnesses/external-activity-system-validation-harness.ts
      
      - name: Upload Results
        if: always()
        uses: actions/upload-artifact@v3
        with:
          name: validation-results
          path: test-results/external-validation-harness/
```

## Architecture

This harness validates OpenCode's **activity-first principle**:

```
User/CLI
   ↓
Activity Tool (search/list/create)
   ↓
Template Repository
   ↓
Child Session (isolated)
   ↓
Task Execution (tools called HERE)
   ↓
Logs (prove NO direct tools in root)
```

**Validation Strategy**:
1. Execute commands via compiled distribution only
2. Capture all logs (stdout + stderr)
3. Analyze logs for expected patterns
4. Detect forbidden patterns (direct tools in root)
5. Verify exit codes and execution times
6. Generate evidence for pass/fail
7. Meta-validate test coverage

## Related Files

- [External Validation Test Harness](../external-validation/activity-system-black-box-test.sh) - Shell-based harness
- [Log Analyzer](../external-validation/lib/log-analyzer.ts) - Session-aware pattern analyzer
- [Success Criteria Validator](../external-validation/lib/success-criteria.ts) - Criteria validator
- [Test Scenarios](../external-validation/fixtures/test-scenarios.json) - Scenario definitions

## License

Same as OpenCode
