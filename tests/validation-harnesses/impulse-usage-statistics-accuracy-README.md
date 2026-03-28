# Impulse Usage Statistics Accuracy Validation Harness

## Overview

This validation harness tests the **impulse-usage-statistics-accuracy** specification, ensuring that:

1. **Token-weighted cost attribution** - Costs are attributed proportionally based on token contribution
2. **LoadCount monotonic increase** - LoadCount always increases, never decreases
3. **TotalTokens accumulation** - Token counts accumulate correctly across loads
4. **LastAccessed tracking** - Timestamps are updated and remain recent
5. **Data integrity** - All statistics maintain invariants

## Specification

**Goal**: Ensure accurate cost attribution to impulses and reliable frequency tracking for priority decisions, enabling data-driven impulse optimization and accurate TUI statistics display.

**Expected Behavior**:
- When impulse loaded: Increment `loadCount`, add to `totalTokens`, update `lastAccessed`
- When task completes: Calculate cost as `(impulseTokens/totalTaskTokens) * taskCost`
- Add attributed cost to `totalCost`
- Save to local storage
- Report to backend (dual-write)

## Test Cases

### Test Case 1: Token-weighted cost attribution with 3 tasks
- **Impulse**: 100 tokens
- **Task 1**: 200 total tokens, $0.10 cost → impulse gets $0.05 (100/200 * 0.10)
- **Task 2**: 300 total tokens, $0.15 cost → impulse gets $0.05 (100/300 * 0.15)
- **Task 3**: 400 total tokens, $0.20 cost → impulse gets $0.05 (100/400 * 0.20)
- **Expected**: loadCount=3, totalTokens=300, totalCost=$0.15

### Test Case 2: Larger impulse (500 tokens)
- **Impulse**: 500 tokens
- **Task 1**: 1000 total tokens, $0.50 cost → impulse gets $0.25 (500/1000 * 0.50)
- **Task 2**: 2000 total tokens, $1.00 cost → impulse gets $0.25 (500/2000 * 1.00)
- **Expected**: loadCount=2, totalTokens=1000, totalCost=$0.50

### Test Case 3: Edge case - single task
- **Impulse**: 250 tokens
- **Task 1**: 1000 total tokens, $0.40 cost → impulse gets $0.10 (250/1000 * 0.40)
- **Expected**: loadCount=1, totalTokens=250, totalCost=$0.10

## Running the Harness

### Run all tests:
```bash
cd tests/validation-harnesses
bun run impulse-usage-statistics-accuracy-harness.ts
```

### Using the runner:
```bash
cd tests/validation-harnesses
bun run impulse-usage-statistics-accuracy-runner.ts
```

## Expected Output

```
=== Impulse Usage Statistics Accuracy Validation ===

Test Case 1: ✅ PASS
  LoadCount: 3 (expected: 3)
  TotalTokens: 300 (expected: 300)
  TotalCost: $0.1500 (expected: $0.1500)
  LastAccessed Recent: true
  LoadCount Monotonic: true
  Cost Breakdown:
    task-1: $0.0500
    task-2: $0.0500
    task-3: $0.0500

Test Case 2: ✅ PASS
  LoadCount: 2 (expected: 2)
  TotalTokens: 1000 (expected: 1000)
  TotalCost: $0.5000 (expected: $0.5000)
  LastAccessed Recent: true
  LoadCount Monotonic: true
  Cost Breakdown:
    task-1: $0.2500
    task-2: $0.2500

Test Case 3: ✅ PASS
  LoadCount: 1 (expected: 1)
  TotalTokens: 250 (expected: 250)
  TotalCost: $0.1000 (expected: $0.1000)
  LastAccessed Recent: true
  LoadCount Monotonic: true
  Cost Breakdown:
    task-1: $0.1000

Summary: 3 passed, 0 failed
```

## Validation Criteria

### LoadCount
- ✅ Must equal number of task executions
- ✅ Must increase monotonically (never decrease)
- ✅ Must start at 0 and increment by 1 per load

### TotalTokens
- ✅ Must equal impulse.tokenCount × loadCount
- ✅ Must accumulate correctly across loads
- ✅ Must match sum of all token additions

### TotalCost
- ✅ Must use token-weighted attribution formula
- ✅ Must equal sum of (impulseTokens/taskTokens) × taskCost for all tasks
- ✅ Must be within tolerance (0.0001) of expected value
- ✅ Must be non-negative

### LastAccessed
- ✅ Must be updated on each load
- ✅ Must be within 5 seconds of test execution
- ✅ Must be a valid timestamp (> 0)

### Data Integrity
- ✅ No INVARIANT VIOLATION errors
- ✅ All statistics maintain consistency
- ✅ Token counts match actual usage

## Files

- **impulse-usage-statistics-accuracy-harness.ts** - Main validation harness
- **impulse-usage-statistics-accuracy-runner.ts** - CLI runner script
- **impulse-usage-statistics-accuracy-README.md** - This documentation

## Impulses

Test case data is stored in impulses:
- `validation-impulse-usage-statistics-accuracy-case-1` - Test case 1 data
- `validation-impulse-usage-statistics-accuracy-case-2` - Test case 2 data
- `validation-impulse-usage-statistics-accuracy-case-3` - Test case 3 data
- `harness-impulse-usage-statistics-accuracy` - Harness file pointer

## Integration

This harness can be integrated into:
1. **CI/CD pipeline** - Run on every commit
2. **Pre-deployment checks** - Verify before release
3. **Manual testing** - Quick validation during development
4. **Regression testing** - Ensure changes don't break accuracy

## Success Criteria

All test cases must pass (100% success rate) for the specification to be considered correctly implemented.

Current Status: **✅ PASSING** (3/3 tests pass)
