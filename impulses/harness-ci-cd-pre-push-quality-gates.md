# Validation Harness: CI/CD Pre-Push Quality Gates

## Overview

This validation harness provides automated, repeatable testing of the CI/CD pre-push quality gates specification without requiring LLM execution.

## Harness Location

**File**: `tests/validation-harnesses/ci-cd-pre-push-quality-gates-harness.ts`

**Type**: Executable TypeScript validation script

**Runtime**: Bun

## Purpose

Validates the complete data flow:
```
Git Push → Pre-Push Hook → Typecheck → Exit Code → Push Decision
```

## Test Coverage

The harness includes 6 test cases covering all critical scenarios:

1. **Type Error Detection** (case-1)
   - Validates that TypeScript errors block pushes
   - Verifies error messages are clear and actionable

2. **Successful Typecheck** (case-2)
   - Validates that valid code allows pushes
   - Ensures no false positives

3. **Bypass Mechanism** (case-3)
   - Validates --no-verify flag functionality
   - Confirms defense-in-depth with CI as second layer

4. **Multiple Type Errors** (case-4)
   - Validates handling of files with multiple errors
   - Tests across different repositories (dashboard)

5. **Timeout Handling** (case-5)
   - Validates 120s timeout mechanism
   - Prevents indefinite hangs

6. **Clear Error Messages** (case-6)
   - Validates error output quality
   - Ensures file paths and descriptions are included

## Architecture

### Core Components

1. **Test Repository Setup**
   - Creates isolated test repositories
   - Installs dependencies (TypeScript, Husky)
   - Configures pre-push hooks
   - Sets up fake remote for push simulation

2. **Validation Logic**
   - Executes git push with various scenarios
   - Captures stdout/stderr output
   - Analyzes exit codes
   - Compares actual vs expected behavior

3. **Expected Outputs** (Historical Data)
   - Stored as impulses (validation-ci-cd-pre-push-quality-gates-case-N)
   - No LLM needed for validation
   - Can be executed deterministically

### Interfaces

```typescript
interface ValidationInput {
  testCase: string;
  repository: string;
  scenario: "type-error" | "timeout" | "success" | "bypass";
  errorCode?: string;
  timeout?: number;
}

interface ValidationOutput {
  hookExecuted: boolean;
  typecheckRan: boolean;
  errorsDetected: boolean;
  pushBlocked: boolean;
  exitCode: number;
  errorMessage: string;
  executionTime: number;
}

interface ValidationResult {
  pass: boolean;
  testCase: string;
  actual: ValidationOutput;
  expected: ValidationOutput;
  diff?: string[];
}
```

### Key Functions

- `createTestRepository(scenario, errorCode)`: Creates isolated test environment
- `runCommand(command, args, cwd, timeout)`: Executes shell commands with timeout
- `runValidation(input)`: Runs single test case and compares output
- `runAllValidations()`: Executes all test cases sequentially
- `getExpectedOutput(scenario)`: Returns expected behavior for scenario

## Execution

### Run All Tests
```bash
cd /home/avi/documents/work/exp-repo/metabob-devbob
bun run tests/validation-harnesses/ci-cd-pre-push-quality-gates-harness.ts
```

### Run Single Test
```typescript
import { runValidation } from './tests/validation-harnesses/ci-cd-pre-push-quality-gates-harness.ts';

const result = await runValidation({
  testCase: "case-1-type-error",
  repository: "metabob-opencode",
  scenario: "type-error"
});

console.log(result.pass ? "PASS" : "FAIL");
```

## Expected Runtime

- **case-1** (type-error): ~5-10 seconds
- **case-2** (success): ~5-10 seconds
- **case-3** (bypass): ~2-5 seconds
- **case-4** (multiple-errors): ~5-10 seconds
- **case-5** (timeout): ~120 seconds (timeout test)
- **case-6** (clear-messages): ~5-10 seconds

**Total Runtime**: ~3-5 minutes

## Success Criteria

All tests must pass (PASS: 6/6) with:
- ✅ Hook execution verified
- ✅ Typecheck execution verified
- ✅ Error detection verified
- ✅ Push blocking verified
- ✅ Exit codes correct
- ✅ Error messages clear

## Integration

This harness integrates with the trace-enforce-validate-loop workflow:

1. **Trace** → Identifies components and data flow
2. **Enforce** → Applies code mutations to close gaps
3. **Validate** → **This harness verifies enforcement**
4. **Conflict Detection** → Checks for specification conflicts
5. **Ripple** → Propagates improvements across codebase

## Historical Context

This validation harness was created as part of the ci-cd-pre-push-quality-gates specification enforcement on 2026-02-26. It validates that:

- 75 TypeScript errors were successfully blocked in metabob-opencode
- Pre-push hooks enforce quality across 4 repositories
- Timeout mechanisms prevent indefinite hangs
- Error messages provide actionable feedback

## Token Budget

**Budget**: 2000 tokens

**Usage**: This impulse consumes ~1500 tokens when loaded, leaving 500 tokens for context in downstream tasks.

## Related Impulses

- `trace-ci-cd-pre-push-quality-gates`: Original trace analysis
- `enforcement-ci-cd-pre-push-quality-gates`: Enforcement summary
- `validation-ci-cd-pre-push-quality-gates-case-1` through `case-6`: Individual test cases

## Maintenance

When updating the specification:
1. Update expected outputs in impulse files
2. Add new test cases if needed
3. Update harness code to cover new scenarios
4. Re-run validation to confirm changes

---

**Document Version**: 1.0
**Created**: 2026-02-26
**Status**: Active
**Maintainer**: CI/CD Quality Team
