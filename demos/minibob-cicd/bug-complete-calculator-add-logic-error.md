# Bug Fix Complete

## Bug
Test failures in calculator: The add function was incorrectly using subtraction instead of addition

```
error: expect(received).toBe(expected)

Expected: 5
Received: -1

at Calculator > add > adds two positive numbers

error: expect(received).toBe(expected)

Expected: -5
Received: 1

at Calculator > add > adds negative numbers
```

## Root Cause
Logic error in the `add()` function implementation - used `a - b` instead of `a + b`. This was likely a copy-paste error or typo when implementing the basic arithmetic operations. The bug was in the core business logic, not edge cases or complex scenarios.

## Fix
- **File**: `src/calculator.ts`
- **Change**: Changed `value: a - b` to `value: a + b` in the add function
- **Test**: Added regression test "addition is not subtraction" to prevent this specific bug
- **Impact**: Fixed 2 failing tests, all 28 tests now pass

## Deliverables
✅ Bug fixed and verified - add function now correctly adds numbers
✅ Regression test added - prevents the exact same mistake in future
✅ All tests passing (28/28) - no broken functionality
✅ Changes committed with detailed explanation
✅ Resolution documented with root cause analysis

## Key Learnings
1. **Simple bugs can have big impact** - A single character error broke core functionality
2. **Basic operations need tests** - Even trivial functions like add/subtract need comprehensive coverage
3. **Regression tests are valuable** - Added specific test to catch this exact error pattern
4. **Code review importance** - This type of logic error would be caught in peer review

## Commit Hash
46bf862 - "fix: Calculator add function using subtraction instead of addition"