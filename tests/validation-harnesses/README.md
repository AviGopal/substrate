# Validation Harnesses

This directory contains validation harnesses for verifying that specifications have been correctly implemented.

## metabob-cli-test-implementation-alignment-harness.ts

**Specification**: metabob-cli-test-implementation-alignment

**Strategy**: External test execution

**Purpose**: Validates that the metabob-cli test suite is aligned with the current implementation after schema changes and architectural refactoring.

### What it validates:

1. **TypeScript Typecheck**: Zero compilation errors in test files
2. **Test Execution**: 709+ tests passing
3. **Performance**: Test suite completes in < 10 seconds
4. **Coverage**: 97%+ code coverage
5. **Error-Free**: No I/O errors during test teardown

### Usage:

```bash
# Run from project root
cd /home/avi/documents/work/exp-repo/metabob-devbob

# Execute harness directly
bun tests/validation-harnesses/metabob-cli-test-implementation-alignment-harness.ts

# Or with custom project root
PROJECT_ROOT=/path/to/project bun tests/validation-harnesses/metabob-cli-test-implementation-alignment-harness.ts
```

### Test Cases:

Three test case impulses define expected outcomes:

1. **validation-metabob-cli-test-implementation-alignment-case-1**: Baseline validation (strict thresholds)
2. **validation-metabob-cli-test-implementation-alignment-case-2**: Regression check (relaxed thresholds)
3. **validation-metabob-cli-test-implementation-alignment-case-3**: Performance validation

### Exit Codes:

- `0`: All validations passed
- `1`: One or more validations failed
- `2`: Harness error (e.g., unable to execute tests)

### Output:

The harness prints detailed validation results including:
- Typecheck error count
- Test pass/fail/skip counts
- Execution duration
- Coverage percentage (if available)
- I/O error count
- Pass/fail status for each validation criterion
