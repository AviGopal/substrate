# Validation Harness: async-await-type-safety

**Specification**: All async function calls in metabob-rpc-api must use await keyword. Type checking with pyright/mypy must be enforced in CI pipeline. All route handlers must have minimum 80% test coverage. Pre-commit hooks must validate async/await correctness before commits.

## Overview

This validation harness verifies that the async-await-type-safety specification is properly enforced through automated checks.

## Validation Strategy

The harness performs 9 independent checks:

### Configuration Checks (1-7)

1. **Pyright Configuration** - Verifies `pyrightconfig.json` exists with `reportUnawaited: error`
2. **Dev Dependencies** - Verifies `pyright>=1.1.350` is in `pyproject.toml`
3. **Pre-commit Hook** - Verifies pyright hook exists in `.pre-commit-config.yaml`
4. **CI Type Checking** - Verifies "Run Type Checking" step in `run-tests.yaml`
5. **Coverage Enforcement** - Verifies `--cov-fail-under=80` flag in CI
6. **Build Type Checking** - Verifies `type-check` job in `build.yaml`
7. **Test Suite Exists** - Verifies `test_routes_learning_loop.py` exists with >400 lines

### Runtime Checks (8-9)

8. **Pyright Execution** - Runs pyright on `learning_loop.py`, expects 0 errors
9. **Test Coverage** - Runs pytest with coverage, expects >=80%

## Test Cases

Each test case is stored as an impulse with expected inputs/outputs:

| Case | Impulse ID | Purpose |
|------|------------|---------|
| 1 | validation-async-await-type-safety-case-1 | Pyright config validation |
| 2 | validation-async-await-type-safety-case-2 | Dev dependency check |
| 3 | validation-async-await-type-safety-case-3 | Pre-commit hook verification |
| 4 | validation-async-await-type-safety-case-4 | CI type checking step |
| 5 | validation-async-await-type-safety-case-5 | CI coverage enforcement |
| 6 | validation-async-await-type-safety-case-6 | Build workflow type-check job |
| 7 | validation-async-await-type-safety-case-7 | Test suite existence |
| 8 | validation-async-await-type-safety-case-8 | Pyright execution test |
| 9 | validation-async-await-type-safety-case-9 | Coverage measurement test |

## Running the Harness

### From Command Line

```bash
cd tests/validation-harnesses
./async-await-type-safety-harness.sh
```

### Exit Codes

- `0` - All checks passed (VALIDATION PASSED)
- `1` - One or more checks failed (VALIDATION FAILED)

### Output

The harness produces:
1. **Console output** - Color-coded check results (✓ PASS, ✗ FAIL, ⚠ SKIP)
2. **JSON results** - `async-await-type-safety-validation-results.json`

### Sample Output

```
========================================================================
Validation Harness: async-await-type-safety
========================================================================

========================================================================
CHECK 1: Pyright Configuration Exists
========================================================================
✓ PASS: pyrightconfig.json exists with reportUnawaited: error

...

========================================================================
VALIDATION SUMMARY
========================================================================

Total Checks: 9
Passed: 7
Failed: 2

Success Rate: 77.8%

Results written to: async-await-type-safety-validation-results.json

✗ VALIDATION FAILED
```

## Dependencies

### Required (for config checks 1-7)

- `bash` (>=4.0)
- `grep`
- `wc`

### Optional (for runtime checks 8-9)

- `pyright` (install: `pip install pyright`)
- `pytest` (install: `pip install pytest pytest-cov`)
- `bc` (for percentage calculations)

**Note**: Checks 8-9 are SKIPPED if tools not installed, but config checks 1-7 will still run.

## Results Format

The JSON results file contains:

```json
{
  "specificationName": "async-await-type-safety",
  "validationDate": "2026-03-04T22:15:00Z",
  "totalChecks": 9,
  "passedChecks": 7,
  "failedChecks": 2,
  "successRate": 77.8,
  "overallStatus": "FAIL",
  "checks": [
    {
      "name": "pyrightconfig.json exists with reportUnawaited: error",
      "status": "PASS",
      "details": "Configuration file found with correct settings",
      "expected": "reportUnawaited: error",
      "actual": "reportUnawaited: error"
    }
    // ... more checks
  ]
}
```

## What Gets Validated

### Quality Gates

- ✅ Local type checking (pre-commit hook)
- ✅ CI type checking (run-tests.yaml)
- ✅ Coverage threshold (--cov-fail-under=80)
- ✅ Build-time type checking (build.yaml)
- ✅ Test coverage (test_routes_learning_loop.py)

### Expected Outcomes

| Check | Expected | Validated By |
|-------|----------|--------------|
| Pyright config exists | File with reportUnawaited: error | File check + grep |
| Pyright in dependencies | pyright>=1.1.350 in pyproject.toml | grep |
| Pre-commit hook | pyright hook in .pre-commit-config.yaml | grep |
| CI type checking | "Run Type Checking" step | grep |
| Coverage enforcement | --cov-fail-under=80 flag | grep |
| Build type checking | type-check job dependency | grep |
| Test suite | test_routes_learning_loop.py with >400 lines | File check + wc |
| Type checking passes | pyright exits 0, 0 errors | pyright execution |
| Coverage passes | pytest reports >=80% | pytest execution |

## Historical Test Cases

All test cases are stored as impulses and can be re-run without LLM:

- **Input**: File path, check type
- **Expected Output**: Expected content, validation criteria
- **Validation Method**: grep, wc, pyright, pytest

These are IMMUTABLE records of what the specification requires.

## Integration with CI

This harness can be integrated into CI pipelines:

```yaml
- name: Validate Specification Enforcement
  run: tests/validation-harnesses/async-await-type-safety-harness.sh
```

It will fail the build if enforcement is not properly configured.

## Troubleshooting

### Check 8 SKIP: pyright not installed

Install pyright:
```bash
pip install pyright
```

### Check 9 FAIL: pytest not installed

Install pytest with coverage:
```bash
pip install pytest pytest-cov pytest-asyncio
```

### Check 9 FAIL: Tests failed to run

Ensure dependencies are installed:
```bash
cd repos/metabob-rpc-api
pip install -e .[dev]
```

### False Positives

If a check fails but you believe enforcement is correct, inspect:
1. File paths (are they correct?)
2. Expected values (do they match current implementation?)
3. Validation method (is it appropriate?)

## Maintenance

### Updating Expected Values

If the specification changes, update the impulse files in:
```
impulses/validation-async-await-type-safety/case-*.json
```

Each impulse contains:
- `input`: What to check
- `expectedOutput`: What to expect
- `validationMethod`: How to validate

### Adding New Checks

1. Add a new case-N.json impulse
2. Add a new check section in the harness script
3. Update the test case count
4. Update this README

## Related Files

- **Harness**: `tests/validation-harnesses/async-await-type-safety-harness.sh`
- **Test Cases**: `impulses/validation-async-await-type-safety/case-*.json`
- **Results**: `tests/validation-harnesses/async-await-type-safety-validation-results.json`
- **Trace**: `impulses/trace-async-await-type-safety/trace-analysis.json`
- **Enforcement**: `impulses/trace-async-await-type-safety/enforcement-summary.json`
