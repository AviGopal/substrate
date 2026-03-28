# External Validation Test Findings

**Date**: 2026-03-18  
**Status**: Tests revealed critical bugs  
**Result**: ❌ 0/3 tests passing (BUT this is expected and valuable!)

---

## Summary

The external validation tests **correctly identified real bugs** in the OpenCode CLI. This demonstrates the validation system works - it found issues that need fixing!

## Test Results

**All 3 tests failed** with the same root cause:

```
Error: --variables is required when executing template "list"
Error: --variables is required when executing template "search"
```

## Root Cause Analysis

### Bug in OpenCode CLI Command Parsing

**File**: `repos/metabob-opencode/packages/opencode/src/cli/cmd/activity.ts` (line 1704-1709)

**Problem**:
```typescript
const positionals = argv._?.slice(1) || []
if (positionals.length > 0) {
  const templateId = positionals[0] as string
  if (!argv.variables) {
    throw new Error(`--variables is required when executing template "${templateId}"`)
  }
}
```

**Issue**: The CLI treats ALL positional arguments after "activity" as template IDs, even registered subcommands like "list", "search", "template".

**Expected Behavior**:
- `opencode activity list` → Execute list subcommand
- `opencode activity search task` → Execute search subcommand  
- `opencode activity my-template --variables {...}` → Execute template

**Actual Behavior**:
- `opencode activity list` → ERROR: "--variables required for template 'list'"
- `opencode activity search` → ERROR: "--variables required for template 'search'"

---

## Why This Is Actually Good News

### ✅ Validation System Works!

The external validation correctly:
1. **Used only compiled distribution** (not dev code)
2. **Tested via external CLI** (proper black-box testing)
3. **Analyzed logs for patterns** (objective criteria)
4. **Found real bugs** (CLI command parsing broken)

### ✅ Tests Are Correctly Designed

The test commands are **exactly right**:
```bash
# Test 1: List activities
opencode activity list

# Test 2: Search activities
opencode activity search "add REST endpoint"

# Test 3: Check templates
opencode activity template list
```

These are the **correct** commands based on the CLI help output. The bug is in OpenCode, not the tests!

---

## What Needs To Be Fixed

### Option 1: Fix OpenCode CLI Parsing (Recommended)

**Change needed** in `src/cli/cmd/activity.ts`:

```typescript
// BEFORE (buggy)
const positionals = argv._?.slice(1) || []
if (positionals.length > 0) {
  const templateId = positionals[0] as string
  if (!argv.variables) {
    throw new Error(`--variables is required when executing template "${templateId}"`)
  }
}

// AFTER (fixed)
const positionals = argv._?.slice(1) || []
const subcommands = ['list', 'search', 'template', 'run', 'init', 'clear', 'metrics', 'recommend', 'promote', 'evolve']

if (positionals.length > 0) {
  const firstArg = positionals[0] as string
  
  // Only require --variables if it's NOT a registered subcommand
  if (!subcommands.includes(firstArg)) {
    const templateId = firstArg
    if (!argv.variables) {
      throw new Error(`--variables is required when executing template "${templateId}"`)
    }
  }
}
```

### Option 2: Update Tests to Use Different Interface (Workaround)

Instead of CLI, tests could:
- Use OpenCode HTTP API directly
- Use programmatic API calls
- Use MCP tools directly

**BUT**: This defeats the purpose of external validation! We want to test the compiled distribution as users would use it.

---

## Recommendation

### Fix the OpenCode CLI Bug

This is the right solution because:
1. **Users expect CLI to work** - subcommands should work as documented
2. **CLI help shows these commands** - they're documented but broken
3. **External validation revealed the issue** - this is exactly what validation is for
4. **Fix benefits everyone** - not just tests, but real users

### Steps to Fix

1. Create activity to fix CLI command parsing
2. Add subcommand detection before template validation
3. Re-run external validation tests
4. Expect all tests to pass after fix

---

## Meta-Validation Success

Even though tests failed, the **validation system succeeded** because:

✅ **Correctly used compiled distribution**  
✅ **Tested via proper external interface (CLI)**  
✅ **Found real bugs in production code**  
✅ **Provided clear error messages**  
✅ **Objective pass/fail criteria**  
✅ **Reproducible test cases**  

The validation is doing its job - finding issues that need fixing!

---

## Next Steps

### Immediate: Fix OpenCode CLI

Use an activity to fix the CLI command parsing bug:

```bash
# Use trace-enforce-validate-loop activity
# Specification: fix-opencode-cli-subcommand-parsing
# Fix the command parsing to recognize subcommands
# Re-run validation to verify fix
```

### After Fix: Expect All Tests to Pass

Once CLI is fixed, validation should show:
```
✅ Test 1: List activities - PASS
✅ Test 2: Search activities - PASS  
✅ Test 3: Template list - PASS

Overall: ✅ PASS (3/3 tests)
```

---

## Conclusion

The external validation **worked perfectly**:
- Found real bugs via black-box testing
- Used only compiled distribution
- Provided clear failure analysis
- Identified root cause
- Recommended fix

**This is validation success, not failure!** 🎉

The tests are correct. The OpenCode CLI has a bug. We fix the bug, tests will pass.

---

**Status**: Validation system validated ✅  
**Next**: Fix OpenCode CLI bug via activity
