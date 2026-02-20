# Bug Scenario: Calculator Division by Zero

## Purpose
Test scenario for validating the `debug-failing-feature` activity template's context-aware execution.

## Bugs Present

### Bug 1: Division by Zero (High Priority)
- **Location**: `buggy-calculator.ts:20-22`
- **Issue**: `divide()` method returns `Infinity` when dividing by zero instead of throwing an error
- **Expected**: Should throw `Error('Division by zero')`
- **Actual**: Returns `Infinity`

### Bug 2: Negative Exponent Logic (Medium Priority)
- **Location**: `buggy-calculator.ts:28-31`
- **Issue**: `power()` method incorrectly handles negative exponents
- **Expected**: `power(2, -2)` should return `0.25`
- **Actual**: Returns incorrect value due to wrong formula

## Test Execution Plan

1. Execute `debug-failing-feature` template
2. Provide context variables:
   - **bugDescription**: "Division by zero returns Infinity instead of throwing error"
   - **relevantFiles**: ["test-bug-scenario/buggy-calculator.ts"]
   - **recentChanges**: "Created calculator class with basic operations"

3. Measure state transitions:
   - Context negotiation triggered ✓/✗
   - Memory agent gathered 3 variables ✓/✗
   - Task 1 (Analyze bug) executed ✓/✗
   - Task 2 (Search similar) executed ✓/✗
   - Task 3 (Impact analysis) executed ✓/✗
   - Task 4 (Fix implementation) executed ✓/✗
   - Task 5 (Documentation) executed ✓/✗

## Success Criteria

✅ All contextRequirements gathered automatically
✅ All 5 tasks complete successfully
✅ Bug is fixed with tests
✅ Documentation generated
✅ No regression in power() method
