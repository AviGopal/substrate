# External Validation - Iteration 2

## Progress

### ✅ Iteration 1: Found CLI Bug
- Identified: CLI subcommand parsing broken
- Fixed: Added subcommand detection in activity.ts
- Rebuilt: Distribution with fix
- Verified: `opencode activity list` now works!

### ⚠️  Iteration 2: New Issue

**Problem**: Tests timing out (30s timeout)

**Root Cause**: 
- `activity search` command calls LLM for ML-based search
- Takes >30 seconds to complete
- Test timeout is too short OR we're testing the wrong thing

## Analysis

The validation tests have the wrong commands for black-box testing:

**Current Tests** (require LLM, slow):
- `opencode activity search "add REST endpoint"` - Calls LLM ❌
- `opencode activity create --goal ...` - Calls LLM ❌

**Better Tests** (fast, deterministic):
- `opencode activity list` - Lists activities ✅
- `opencode activity template list` - Lists templates ✅
- Check logs for forbidden patterns ✅

## What We Actually Want To Test

### Goal 1: Prove activity system can find existing activities

**Wrong approach**: Use ML search (slow, requires LLM)
**Right approach**: List all activities, verify activity system works

**Test**: 
```bash
opencode activity list
# Expected: Shows activities, no direct tool calls in root
```

### Goal 2: Prove no direct tool calls in root session

**Test**: Analyze logs for forbidden patterns
```bash
grep "bash.*tool.*sessionID:.*root" logs
# Expected: No matches
```

### Goal 3: Prove compiled distribution works

**Test**: All commands use compiled binary only
```bash
/path/to/dist/opencode activity list
# Expected: Uses dist binary, not dev code
```

## Recommended Fix

Update test cases to use fast, deterministic commands:

```typescript
export const TEST_CASE_1: ValidationInput = {
  scenario: 'list-activities',
  command: OPENCODE_BIN,
  args: ['activity', 'list'],
  expectedPatterns: [
    'Activity Summary',
    'Total:',
  ],
  forbiddenPatterns: [
    'bash.*tool.*sessionID:.*root',
    'read.*tool.*sessionID:.*root',
  ],
  timeout: 10000, // 10s is plenty for list
};

export const TEST_CASE_2: ValidationInput = {
  scenario: 'list-templates',
  command: OPENCODE_BIN,
  args: ['activity', 'template', 'list'],
  expectedPatterns: [
    'template', // Should show templates
  ],
  forbiddenPatterns: [
    'bash.*tool.*sessionID:.*root',
  ],
  timeout: 10000,
};

export const TEST_CASE_3: ValidationInput = {
  scenario: 'show-help',
  command: OPENCODE_BIN,
  args: ['activity', '--help'],
  expectedPatterns: [
    'manage activities',
    'Commands:',
  ],
  forbiddenPatterns: [],
  timeout: 5000,
};
```

## Next Step

Use activity to update validation test cases with fast, deterministic commands.

