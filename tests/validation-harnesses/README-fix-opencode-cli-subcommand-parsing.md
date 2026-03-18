# Validation Harness: fix-opencode-cli-subcommand-parsing

## Overview

This validation harness tests the fix for the OpenCode CLI bug where registered subcommands (like `list`, `search`, `template`) were incorrectly treated as template IDs, requiring `--variables` and `--reason` flags.

## Bug Description

**Before Fix**: All positional arguments after `activity` were treated as template IDs
```bash
$ opencode activity list
Error: --variables is required when executing template "list"
```

**After Fix**: Registered subcommands are detected and routed properly
```bash
$ opencode activity list
[Lists all activities successfully]
```

## Test Strategy

### 1. Subcommand Validation (Positive Tests)
- Test that each of the 10 registered subcommands work without `--variables`
- Subcommands: list, template, run, init, clear, metrics, recommend, search, promote, evolve

### 2. Template Validation (Negative Tests)
- Test that unknown template IDs still require `--variables` (backward compatibility)
- Ensure proper error messages are shown

### 3. Regression Tests
- Test that template execution with `--variables` still works
- Ensure no functionality was broken by the fix

## Test Cases

### Case 1: Subcommand 'list' should work without --variables
**Input**: `opencode activity list`
**Expected**: Exit code 0, no "--variables is required" error
**Impulse**: `validation-fix-opencode-cli-subcommand-parsing-case-1`

### Case 2: Subcommand 'search' should work without --variables
**Input**: `opencode activity search`
**Expected**: Exit code 0, no "--variables is required" error
**Impulse**: `validation-fix-opencode-cli-subcommand-parsing-case-2`

### Case 3: Subcommand 'template' should work without --variables
**Input**: `opencode activity template list`
**Expected**: Exit code 0, no "--variables is required" error
**Impulse**: `validation-fix-opencode-cli-subcommand-parsing-case-3`

### Case 4: Template execution should still require --variables
**Input**: `opencode activity my-custom-template`
**Expected**: Exit code 1, error contains "--variables is required"
**Impulse**: `validation-fix-opencode-cli-subcommand-parsing-case-4`

### Case 5: All registered subcommands should work
**Input**: Test all 10 subcommands
**Expected**: All pass without "--variables is required" error
**Impulse**: `validation-fix-opencode-cli-subcommand-parsing-case-5`

### Case 6: Template execution with --variables should work (regression)
**Input**: `opencode activity test-template --variables '{"key":"value"}' --reason 'testing'`
**Expected**: Exit code 0 or template-not-found error (but NOT "--variables is required")
**Impulse**: `validation-fix-opencode-cli-subcommand-parsing-case-6`

## Running the Harness

### Option 1: Shell Script (Recommended)
```bash
./run-fix-opencode-cli-subcommand-parsing-harness.sh
```

### Option 2: Direct TypeScript Execution
```bash
npx ts-node fix-opencode-cli-subcommand-parsing-harness.ts
```

### Option 3: Compiled JavaScript
```bash
npx tsc fix-opencode-cli-subcommand-parsing-harness.ts
node fix-opencode-cli-subcommand-parsing-harness.js
```

## Output Format

```
🧪 Running Validation Harness: fix-opencode-cli-subcommand-parsing

1. ✓ Subcommand 'list' should work without --variables - PASS
   ✓ Subcommand executed without requiring --variables

2. ✓ Subcommand 'search' should work without --variables - PASS
   ✓ Subcommand executed without requiring --variables

3. ✓ Subcommand 'template' should work without --variables - PASS
   ✓ Subcommand executed without requiring --variables

4. ✓ Template execution should still require --variables - PASS
   ✓ Unknown template correctly requires --variables

5. ✓ Template execution with --variables should work (regression test) - PASS
   ✓ Template execution accepts --variables (no regression)

6. ✓ All registered subcommands should work - PASS
   ✓ All 10 subcommands work without --variables

📊 Results: 6 passed, 0 failed out of 6 tests
✅ All tests passed!
```

## Exit Codes

- `0`: All tests passed
- `1`: One or more tests failed

## Integration with External Validation

This harness complements the external validation suite at:
```
repos/metabob-cli/run-external-validation.sh --suite cli
```

Both should pass after the fix is applied.

## Harness Design

### Key Features
1. **No LLM Required**: Pure code execution and comparison
2. **Deterministic**: Same input always produces same output
3. **Historical**: Test cases stored as impulses for reuse
4. **Standalone**: Can run independently without external dependencies
5. **Detailed**: Captures actual vs expected for debugging

### Architecture
```
Input (Test Case Impulse)
  ↓
Execute OpenCode CLI Command
  ↓
Capture stdout, stderr, exit code
  ↓
Compare with Expected Output
  ↓
Return PASS/FAIL + Details
```

## Files

- `fix-opencode-cli-subcommand-parsing-harness.ts` - Main harness implementation
- `run-fix-opencode-cli-subcommand-parsing-harness.sh` - Shell script runner
- `README-fix-opencode-cli-subcommand-parsing.md` - This file
- `impulses/validation-fix-opencode-cli-subcommand-parsing-case-*.json` - Test case definitions
- `impulses/harness-fix-opencode-cli-subcommand-parsing.json` - Harness metadata impulse

## Maintenance

### Adding New Test Cases
1. Create impulse: `validation-fix-opencode-cli-subcommand-parsing-case-N.json`
2. Add test function to harness if needed
3. Update `runValidation()` to include new test
4. Update this README with new test case

### Modifying Test Cases
1. Update impulse JSON file with new expected output
2. Test harness automatically uses updated expectations

## Related Documentation

- **Trace Analysis**: `impulses/trace-fix-opencode-cli-subcommand-parsing.json`
- **Enforcement Summary**: `impulses/enforcement-fix-opencode-cli-subcommand-parsing.json`
- **Bug Fix Code**: `repos/metabob-opencode/packages/opencode/src/cli/cmd/activity.ts` (lines 25-37, 1716-1737, 1739-1755)

## Success Criteria

✅ All 10 registered subcommands work without `--variables`
✅ Unknown template IDs still require `--variables` (backward compatibility)
✅ Template execution with `--variables` still works (no regression)
✅ Error messages are clear and accurate
✅ External validation suite passes (3/3 tests)
