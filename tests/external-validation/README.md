# External Activity System Validation

## Overview

This directory contains **external black-box validation** for OpenCode's activity system. The validation proves that OpenCode works as expected by observing **only compiled distribution behavior** through CLI commands and log analysis - no direct code execution.

## Why External Validation?

**Problem**: How do we prove the activity system works without relying on internal code?

**Solution**: Black-box testing that:
1. Uses ONLY compiled OpenCode distribution (not dev code)
2. Sends requests via CLI/HTTP API only (no direct code execution)
3. Captures logs to prove activity search/execution/creation
4. Verifies NO direct tool calls occur (only activities)
5. Tests finding existing activities AND creating new ones
6. Provides objective PASS/FAIL criteria from log analysis

## Structure

```
tests/external-validation/
├── activity-system-black-box-test.sh  # Main test harness
├── lib/
│   ├── log-analyzer.ts                # Session-aware log pattern analyzer
│   └── success-criteria.ts            # Success criteria validator
├── fixtures/
│   └── test-scenarios.json            # Test scenario definitions
└── README.md                          # This file
```

## Test Scenarios

### Scenario A: Search for Existing Activity

**Goal**: Prove that activity search works via CLI

**Command**:
```bash
opencode activity search 'add REST endpoint'
```

**Expected Behavior**:
- Returns list of matching templates
- NO direct tool calls in root session logs
- Logs show: `search_activities called`, `templates returned`

**Success Criteria**:
- ✅ All required patterns found
- ✅ No forbidden patterns (direct bash/read/edit in root)
- ✅ Exit code 0
- ✅ Execution time < 30s

---

### Scenario B: Execute Existing Activity

**Goal**: Prove that activity execution works with proper session isolation

**Command**:
```bash
opencode activity add-rest-endpoint \
  --variables '{"method":"POST","path":"/api/test", ...}' \
  --reason 'External validation test'
```

**Expected Behavior**:
- Activity lifecycle completes (start → memory init → tasks → complete)
- Tool calls ONLY in child sessions (activity-*)
- NO direct tool calls in root session
- Logs show all 8 lifecycle patterns

**Success Criteria**:
- ✅ All required lifecycle patterns found
- ✅ Tool calls in child session only
- ✅ No forbidden patterns (direct tools in root)
- ✅ Exit code 0
- ✅ Execution time < 5 minutes

---

### Scenario C: Create Activity via Goal-Seeking

**Goal**: Prove that goal-seeking activity creation works without executing

**Command**:
```bash
opencode activity create \
  --goal 'Add health check endpoint that returns server status' \
  --name 'Add Health Check Endpoint' \
  --category 'feature'
```

**Expected Behavior**:
- Goal decomposed into sub-goals
- Existing activities searched for composition
- New template created and registered
- Template NOT executed (creation only)

**Success Criteria**:
- ✅ Goal decomposition patterns found
- ✅ Template created
- ✅ Template NOT executed
- ✅ No forbidden patterns
- ✅ Exit code 0
- ✅ Execution time < 2 minutes

## Running the Validation

### Prerequisites

1. Build OpenCode distribution:
```bash
cd repos/metabob-opencode
npm run build:dist
```

2. Ensure compiled binary exists:
```bash
ls repos/metabob-opencode/packages/opencode/dist/opencode-linux-x64/opencode
```

### Execute Validation

```bash
cd tests/external-validation
./activity-system-black-box-test.sh
```

### Output

**Success**:
```
==========================================
  EXTERNAL VALIDATION: ✅ PASS
==========================================

The activity system has been PROVEN to work through:
1. Compiled distribution execution (not dev code)
2. CLI-only testing (no direct code execution)
3. Log-based validation (observable behavior)
4. Activity-only execution (no direct tool calls)
5. Complete scenario coverage (search/execute/create)
```

**Failure**:
```
==========================================
  EXTERNAL VALIDATION: ❌ FAIL
==========================================

Failures detected. See logs in: test-results/external-validation/
```

## Results Location

All test results are saved to:
```
test-results/external-validation/
├── logs/
│   ├── scenario-a-search-<timestamp>.log
│   ├── scenario-b-execute-<timestamp>.log
│   └── scenario-c-create-<timestamp>.log
├── scenario-a-search-analysis.txt
├── scenario-b-execute-analysis.txt
├── scenario-c-create-analysis.txt
└── meta-validation.txt
```

## Log Analysis

The validation uses **session-aware pattern matching** to detect:

### ✅ Expected Patterns

- `Activity.*starting` - Activity execution started
- `Memory agent initializing` - Context gathering
- `Task.*starting` - Task execution started
- `Task.*completed` - Task completed
- `Activity.*completed` - Activity finished
- `search_activities.*called` - Search tool invoked
- `create_activity_goal_seeking.*called` - Creation tool invoked

### ❌ Forbidden Patterns

- `bash.*tool.*sessionID:.*root` - Direct bash in root session
- `read.*tool.*sessionID:.*root` - Direct read in root session
- `edit.*tool.*sessionID:.*root` - Direct edit in root session
- `write.*tool.*sessionID:.*root` - Direct write in root session

**Key Insight**: Tool calls in `activity-*` child sessions are ALLOWED (expected behavior). Only direct calls in root session are forbidden.

## Meta-Validation

The test includes **meta-validation** to ensure it properly tested all requirements:

### Meta-Validation Criteria

1. ✅ Test ran compiled distribution (not dev code)
2. ✅ Test used CLI/API only (no direct code execution)
3. ✅ Logs captured for all scenarios
4. ✅ Activity search tested
5. ✅ Activity execution tested
6. ✅ Activity creation tested
7. ✅ No direct tool calls validated

### Meta-Validation Output

```
Meta-Validation Results:
========================
✅ req-1: Test ran compiled distribution
✅ req-2: Test used CLI/API only
✅ req-3: Logs captured for all scenarios (3 files)
✅ Scenario scenario-a-search passed
✅ Scenario scenario-b-execute passed
✅ Scenario scenario-c-create passed
✅ req-7: No direct tool calls found (validated)

FINAL RESULT: ✅ META-VALIDATION PASS
```

## CI/CD Integration

To integrate with CI/CD, add to `.github/workflows/`:

```yaml
name: External Activity Validation

on: [push, pull_request]

jobs:
  activity-validation:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Build OpenCode Distribution
        run: |
          cd repos/metabob-opencode
          npm install
          npm run build:dist
      
      - name: Run External Validation
        run: |
          cd tests/external-validation
          ./activity-system-black-box-test.sh
      
      - name: Upload Results
        if: always()
        uses: actions/upload-artifact@v3
        with:
          name: external-validation-results
          path: test-results/external-validation/
```

## TypeScript Log Analyzer

The log analyzer (`lib/log-analyzer.ts`) provides:

- **Session-aware pattern detection**: Distinguishes root vs activity child sessions
- **Pattern matching**: Required, optional, and forbidden patterns
- **Evidence extraction**: Line numbers and matched log entries
- **Session context tracking**: Tool calls per session
- **Detailed reports**: Human-readable evidence reports

### Usage Example

```typescript
import { LogAnalyzer, createLogPattern } from './lib/log-analyzer';

const logs = loadLogsFromFile('scenario-a-search.log');
const analyzer = new LogAnalyzer(logs);

const requiredPatterns = [
  createLogPattern('search_activities.*called', 'Search tool invoked', 'required'),
  createLogPattern('templates.*returned', 'Templates returned', 'required'),
];

const forbiddenPatterns = [
  createLogPattern('bash.*tool.*sessionID:.*root', 'Direct bash in root', 'critical'),
];

const result = analyzer.analyze(requiredPatterns, forbiddenPatterns, [], 'scenario-a');

console.log(analyzer.generateEvidenceReport(result));
```

## Success Criteria Validator

The success criteria validator (`lib/success-criteria.ts`) provides:

- **Criterion-by-criterion validation**: Each success criterion checked independently
- **Evidence collection**: Detailed evidence for pass/fail
- **Aggregate reporting**: Overall PASS/FAIL across scenarios
- **Human-readable summaries**: Clear pass/fail messages

### Usage Example

```typescript
import { SuccessCriteriaValidator } from './lib/success-criteria';

const scenario = loadScenario('scenario-a-search');
const logs = loadLogs('scenario-a-search.log');

const result = SuccessCriteriaValidator.validateScenario(
  scenario,
  logs,
  0, // exit code
  12500 // execution time in ms
);

console.log(result.summary);
console.log(`Result: ${result.passed ? 'PASS' : 'FAIL'}`);
```

## Extending the Validation

### Adding New Scenarios

1. Add scenario definition to `fixtures/test-scenarios.json`:
```json
{
  "id": "scenario-d-custom",
  "name": "Custom Scenario",
  "command": "opencode activity ...",
  "expectedPatterns": [...],
  "forbiddenPatterns": [...],
  "successCriteria": {...}
}
```

2. Add scenario runner to `activity-system-black-box-test.sh`:
```bash
run_scenario_d_custom() {
  # Implementation
}
```

3. Call in `main()`:
```bash
if run_scenario_d_custom; then
  ((scenarios_passed++))
else
  ((scenarios_failed++))
fi
```

### Adding New Patterns

Update `fixtures/test-scenarios.json`:
```json
{
  "expectedPatterns": [
    {
      "pattern": "new-pattern-regex",
      "description": "What this pattern means",
      "severity": "required"
    }
  ]
}
```

## Troubleshooting

### Validation Fails: "OpenCode distribution not found"

**Solution**: Build distribution first:
```bash
cd repos/metabob-opencode
npm run build:dist
```

### Validation Fails: "Forbidden patterns detected"

**Cause**: Direct tool calls found in root session

**Debug**:
```bash
grep -E "(bash|read|edit|write).*tool.*sessionID:.*root" \
  test-results/external-validation/logs/scenario-*.log
```

**Fix**: Ensure all tool calls happen within activity child sessions

### Scenario Times Out

**Cause**: Activity execution exceeds time limit

**Solution**: Increase timeout in `test-scenarios.json`:
```json
{
  "executionTime": {
    "max": 600000  // 10 minutes
  }
}
```

## Architecture

This validation enforces OpenCode's **activity-first principle**:

```
User Request
    ↓
CLI Command (opencode activity ...)
    ↓
Activity Tool
    ↓
Template Load
    ↓
Child Session Create (isolated)
    ↓
Task Execution (tools called HERE, in child session)
    ↓
Evidence Capture
    ↓
Backend Record
    ↓
LOGS (prove NO direct tools in root session)
```

**Key Validation Points**:
1. User never calls tools directly
2. All tool calls happen in activity child sessions
3. Root session only calls activity/search/list tools
4. Execution is fully traceable through logs

## References

- [Activity System Architecture](../../docs/ACTIVITY_SYSTEM_ARCHITECTURE.md)
- [External Validation Strategy](../../docs/reports/2026-02/EXTERNAL_VALIDATION_STRATEGY_SUMMARY.md)
- [Runtime Validation Harness](../validation-harnesses/activity-system-runtime-validation-harness.ts)

## License

Same as OpenCode
