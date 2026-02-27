# Validation Harness: ci-cd-pre-push-quality-gates

## Overview

This validation harness tests the complete CI/CD pre-push quality gate data flow without requiring LLM execution. It creates isolated test repositories, simulates git push operations, and validates that TypeScript errors are detected and blocked before reaching remote repositories.

## Files

- `ci-cd-pre-push-quality-gates-harness.ts` - Main validation script (15KB)
- `ci-cd-pre-push-quality-gates-README.md` - This file
- `/tmp/validation-test-cases.json` - Historical test cases with expected outputs

## What It Tests

The complete data flow of pre-push quality gates:
```
Developer: git push
  ↓
Git Core: Invoke .git/hooks/pre-push
  ↓
Husky Manager: Check HUSKY=0, setup environment
  ↓
Custom Hook: Execute 'bun typecheck' with timeout
  ↓
Bun Runtime: Lookup package.json script
  ↓
TypeScript Compiler: Check for type errors
  ↓
Exit Code: 0 = allow, 1-255 = block
  ↓
Git Decision: Allow or block push
```

## Test Scenarios

### 1. Type Error Detection (case-1)
**Purpose**: Verify pre-push hook detects TypeScript type errors and blocks push

**Input**:
```typescript
const x: number = "this is a string, not a number";
```

**Expected Output**:
- ✅ Hook executed: `true`
- ✅ Typecheck ran: `true`
- ✅ Errors detected: `true`
- ✅ Push blocked: `true`
- ✅ Exit code: `1`

---

### 2. Successful Typecheck (case-2)
**Purpose**: Verify pre-push hook allows push when no errors exist

**Input**:
```typescript
const x: number = 42;
const y: string = "hello";
```

**Expected Output**:
- ✅ Hook executed: `true`
- ✅ Typecheck ran: `true`
- ✅ Errors detected: `false`
- ✅ Push blocked: `false`
- ✅ Exit code: `0`

---

### 3. Bypass Mechanism (case-3)
**Purpose**: Verify --no-verify bypasses pre-push hook (defense in depth)

**Input**: Type errors + `git push --no-verify`

**Expected Output**:
- ✅ Hook executed: `false` (skipped)
- ✅ Typecheck ran: `false`
- ✅ Errors detected: `false`
- ✅ Push blocked: `false` (but CI should catch it)
- ✅ Exit code: `0`

---

### 4. Multiple Type Errors (case-4)
**Purpose**: Verify pre-push hook detects multiple errors in dashboard

**Input**:
```typescript
const a: number = "string";
const b: string = 123;
const c: boolean = "not a boolean";

function wrong(x: number): string {
  return x; // Type error
}
```

**Expected Output**:
- ✅ Hook executed: `true`
- ✅ Typecheck ran: `true`
- ✅ Errors detected: `true` (multiple errors)
- ✅ Push blocked: `true`
- ✅ Exit code: `1`

---

### 5. Timeout Handling (case-5)
**Purpose**: Verify timeout after 120 seconds with clear error message

**Input**: Large union types causing slow typecheck

**Expected Output**:
- ✅ Hook executed: `true`
- ✅ Typecheck ran: `true`
- ✅ Errors detected: `false`
- ✅ Push blocked: `true`
- ✅ Exit code: `124` (timeout)
- ✅ Error message: "Type checking timed out after 120 seconds"

---

### 6. Clear Error Messages (case-6)
**Purpose**: Verify error messages are actionable

**Expected Output**:
```
❌ Type checking failed with TypeScript errors
   Fix the errors above and try again
   Bypass (not recommended): git push --no-verify
```

---

## Usage

### Run All Tests

```bash
cd /home/avi/documents/work/exp-repo/metabob-devbob
bun run tests/validation-harnesses/ci-cd-pre-push-quality-gates-harness.ts
```

**Expected Output**:
```
================================================================================
CI/CD Pre-Push Quality Gates - Validation Harness
================================================================================

🧪 Running test case: case-1-type-error
   Scenario: type-error
   ✓ Test repository created: /tmp/test-quality-gate-1234567890
   → Simulating git push...
   ✓ Hook executed: true
   ✓ Typecheck ran: true
   ✓ Errors detected: true
   ✓ Push blocked: true
   ✓ Exit code: 1
   ✅ PASS
   ✓ Test repository cleaned up

🧪 Running test case: case-2-success
   ...
   ✅ PASS

🧪 Running test case: case-3-bypass
   ...
   ✅ PASS

🧪 Running test case: case-4-multiple-errors
   ...
   ✅ PASS

================================================================================
Summary
================================================================================
Total: 4 tests
Passed: 4 ✅
Failed: 0 ❌

✅ All validations passed!
```

---

### Run Programmatically

```typescript
import { runValidation, runAllValidations } from './ci-cd-pre-push-quality-gates-harness';

// Run single test
const result = await runValidation({
  testCase: "case-1-type-error",
  repository: "metabob-opencode",
  scenario: "type-error"
});

if (result.pass) {
  console.log('✅ Validation PASSED');
} else {
  console.log('❌ Validation FAILED');
  console.log('Differences:', result.diff);
}

// Run all tests
const results = await runAllValidations();
const passed = results.filter(r => r.pass).length;
console.log(`Passed: ${passed}/${results.length}`);

process.exit(results.every(r => r.pass) ? 0 : 1);
```

---

### CI Integration

**GitHub Actions**:
```yaml
name: Validation Harnesses

on:
  pull_request:
    branches: [main, dev]

jobs:
  validate-quality-gates:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v1
      
      - name: Install dependencies
        run: bun install
        
      - name: Run quality gates validation
        run: bun run tests/validation-harnesses/ci-cd-pre-push-quality-gates-harness.ts
```

---

## Output Format

### ValidationResult

```typescript
interface ValidationResult {
  pass: boolean;              // Overall pass/fail
  testCase: string;          // Test case identifier (e.g., "case-1-type-error")
  actual: ValidationOutput;  // Actual behavior observed
  expected: ValidationOutput; // Expected behavior
  diff?: string[];           // Differences if fail
}
```

### ValidationOutput

```typescript
interface ValidationOutput {
  hookExecuted: boolean;     // Pre-push hook was invoked
  typecheckRan: boolean;     // Typecheck command executed
  errorsDetected: boolean;   // TypeScript errors found
  pushBlocked: boolean;      // Push was blocked
  exitCode: number;          // Git push exit code (0=success, 1=error, 124=timeout)
  errorMessage: string;      // Error output from hook
  executionTime: number;     // Execution time in milliseconds
}
```

---

## Test Execution Flow

### 1. Setup Phase
- Create temporary directory in `/tmp/test-quality-gate-<timestamp>`
- Initialize git repository (`git init`)
- Configure git user (`user.name`, `user.email`)
- Create `package.json` with typecheck script
- Create `tsconfig.json` with strict mode
- Install TypeScript (`bun install`)
- Create `.husky/` directory with manager script
- Create `.husky/pre-push` hook (enforced version with error handling)
- Install Git hook: `.git/hooks/pre-push`
- Create test TypeScript files based on scenario
- Create initial commit
- Add fake remote repository (local bare git repo)

### 2. Execute Phase
- Run `git push origin master` (or with `--no-verify` for bypass test)
- Capture stdout and stderr
- Measure execution time
- Record exit code
- Handle timeout (default 180s)

### 3. Validate Phase
- Check if hook executed (look for "🔍 Running TypeScript type checking")
- Check if typecheck ran (look for "typecheck" in output)
- Check if errors detected (look for "error TS" or "❌")
- Check if push blocked (exit code !== 0)
- Compare exit code (0=success, 1=type error, 124=timeout)
- Compare actual vs expected outputs
- Generate diff if mismatch

### 4. Cleanup Phase
- Remove temporary test repository
- Remove fake remote repository
- Log cleanup status

---

## Expected vs Actual Comparison

### Example: Type Error Detected (PASS)

```
Actual:
{
  hookExecuted: true,
  typecheckRan: true,
  errorsDetected: true,
  pushBlocked: true,
  exitCode: 1,
  errorMessage: "❌ Type checking failed with TypeScript errors",
  executionTime: 4523
}

Expected:
{
  hookExecuted: true,
  typecheckRan: true,
  errorsDetected: true,
  pushBlocked: true,
  exitCode: 1,
  errorMessage: "Type checking failed with TypeScript errors",
  executionTime: 5000
}

Diff: []
Result: ✅ PASS
```

### Example: Hook Not Executed (FAIL)

```
Actual:
{
  hookExecuted: false,
  typecheckRan: false,
  errorsDetected: false,
  pushBlocked: false,
  exitCode: 0,
  errorMessage: "",
  executionTime: 234
}

Expected:
{
  hookExecuted: true,
  typecheckRan: true,
  errorsDetected: true,
  pushBlocked: true,
  exitCode: 1,
  errorMessage: "Type checking failed",
  executionTime: 5000
}

Diff: [
  "hookExecuted: expected true, got false",
  "typecheckRan: expected true, got false",
  "errorsDetected: expected true, got false",
  "pushBlocked: expected true, got false"
]
Result: ❌ FAIL
```

---

## Performance

| Test Case | Expected Duration | Notes |
|-----------|-------------------|-------|
| case-1-type-error | ~5s | Fast: Simple type error detection |
| case-2-success | ~5s | Fast: Valid TypeScript |
| case-3-bypass | ~1s | Very fast: Hook skipped |
| case-4-multiple-errors | ~5s | Fast: Multiple errors detected |
| case-5-timeout | ~120s | Slow: Waits for timeout |
| case-6-error-message | ~5s | Fast: Error message validation |

**Total Suite**: ~3-5 minutes (includes test-5 timeout)

---

## Troubleshooting

### Hook Not Executing

**Symptom**: `hookExecuted: false` when it should be `true`

**Possible Causes**:
1. Hook not executable: `ls -l .git/hooks/pre-push` (should be `-rwxr-xr-x`)
2. Husky manager missing: `ls -l .husky/_/h`
3. HUSKY env var set to 0: `echo $HUSKY`

**Fix**:
```bash
chmod +x .git/hooks/pre-push
chmod +x .husky/_/h
chmod +x .husky/pre-push
unset HUSKY
```

---

### Typecheck Not Running

**Symptom**: `typecheckRan: false` when hook executes

**Possible Causes**:
1. TypeScript not installed: `bun pm ls | grep typescript`
2. package.json missing typecheck script
3. Bun not in PATH

**Fix**:
```bash
bun install typescript
# Verify package.json has: "typecheck": "tsc --noEmit"
which bun  # Should show path to bun
```

---

### Test Hangs

**Symptom**: Test doesn't complete after 3+ minutes

**Possible Causes**:
1. Timeout not configured correctly
2. Git waiting for user input
3. Typecheck stuck in infinite loop

**Fix**:
```bash
# Increase timeout in runCommand call:
await runCommand("git", ["push", "origin", "master"], testDir, 300000); // 5 min

# Check for hung processes:
ps aux | grep "git\|tsc\|bun"
```

---

### Cleanup Failures

**Symptom**: Warning about failed cleanup

**Possible Causes**:
1. Files still in use (open file handles)
2. Permission denied
3. Directory already removed

**Fix**:
```bash
# Manually clean up if needed:
rm -rf /tmp/test-quality-gate-*
rm -rf /tmp/test-remote-*
```

---

## Maintenance

### Update Expected Outputs

When specification changes (e.g., new error message format), update expected outputs:

```typescript
// In getExpectedOutput function:
case "type-error":
  return {
    // ... other fields
    errorMessage: "New error message format",
  };
```

### Add New Test Cases

To add a new scenario:

1. Add input to `runAllValidations`:
```typescript
{
  testCase: "case-7-new-scenario",
  repository: "metabob-opencode",
  scenario: "type-error",
  errorCode: "// custom error code"
}
```

2. Add expected output to `getExpectedOutput`:
```typescript
case "new-scenario":
  return { /* expected values */ };
```

3. Document in this README

---

## Integration with Trace-Enforce-Validate Loop

This validation harness is part of the trace-enforce-validate-loop activity:

1. **Trace**: Analyzed data flow from Git push to TypeScript compiler
2. **Enforce**: Applied pre-push hooks with error handling to all repositories
3. **Validate**: **THIS HARNESS** - Verify enforcement works as expected
4. **Detect Conflicts**: Identify issues with enforcement
5. **Ripple Improvements**: Propagate pattern to other validations

**Previous Steps**:
- Trace: `TRACE_CI_CD_PRE_PUSH_QUALITY_GATES_SUMMARY.md`
- Enforcement: `ENFORCEMENT_CI_CD_PRE_PUSH_QUALITY_GATES_SUMMARY.md`

**Next Steps**:
- Conflict Detection: Identify breaking changes
- Ripple Improvements: Apply pattern to linting, security scanning

---

## References

- **Specification**: ci-cd-pre-push-quality-gates
- **Trace Analysis**: `TRACE_CI_CD_PRE_PUSH_QUALITY_GATES_SUMMARY.md`
- **Enforcement Summary**: `ENFORCEMENT_CI_CD_PRE_PUSH_QUALITY_GATES_SUMMARY.md`
- **Test Cases**: `/tmp/validation-test-cases.json`
- **Harness File**: `tests/validation-harnesses/ci-cd-pre-push-quality-gates-harness.ts`

---

## License

MIT
