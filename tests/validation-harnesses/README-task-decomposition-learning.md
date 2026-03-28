# Validation Harness: task-decomposition-learning

## Overview

This validation harness tests Phase 1 (variant tracking fix) of the task-decomposition-learning specification.

**Status:** ✅ COMPLETE - All 10 tests passing

## What It Tests

### 1. Variant Tracking (5 tests)
Tests that variant selections are correctly stored and retrieved:
- **Candidate variant with Thompson Sampling**: Verifies variant stored, variant_id calculated correctly
- **Stable variant with Thompson Sampling**: Verifies stable variant doesn't pass variant_id
- **Candidate variant with direct load**: Verifies non-Thompson Sampling paths work
- **Stable variant with direct load**: Verifies stable direct load works
- **Failed activity with candidate variant**: Verifies failure path tracks variants correctly

### 2. Beta Parameter Validation (5 tests)
Tests that invalid Beta distribution parameters are handled safely:
- **Valid parameters**: Normal operation with valid alpha/beta
- **NaN parameters**: Fallback to mean when parameters are NaN
- **Infinity parameters**: Fallback to mean when parameters are Infinity
- **Negative parameters**: Fallback to mean when parameters are negative
- **Zero parameters**: Fallback to mean when parameters are zero

## Running the Harness

### Command Line
```bash
bun run tests/validation-harnesses/task-decomposition-learning-harness.ts
```

### Programmatic Usage
```typescript
import { runValidation, runAllTestCases, runBetaValidationTests } from './task-decomposition-learning-harness'

// Run single test
const result = runValidation({
  testCase: "candidate-variant-thompson-sampling",
  selectionResult: {
    template: { id: "test", name: "Test", version: { generation: 1 } },
    selectedId: "test-variant-123",
    variant: "candidate",
    thompsonSampling: {
      method: "thompson_sampling",
      alpha: 5,
      beta: 3,
      sample: 0.65
    }
  },
  activityStatus: "done"
})

console.log(result.pass) // true/false

// Run all test cases
const allResults = await runAllTestCases()
console.log(`Passed: ${allResults.passed}/${allResults.totalTests}`)

// Run beta validation tests
const betaResults = runBetaValidationTests()
console.log(`Passed: ${betaResults.passed}/${betaResults.totalTests}`)
```

## Test Coverage

### Phase 1: Variant Tracking ✅
- [x] Variant stored in activity.selection_reason
- [x] Variant_id calculated correctly for candidate variants
- [x] Variant_id undefined for stable variants
- [x] Selection reason complete with all fields
- [x] Works for both Thompson Sampling and direct load
- [x] Works for both successful and failed activities

### Phase 1: Beta Validation ✅
- [x] Valid parameters pass through normally
- [x] Invalid parameters trigger fallback
- [x] Fallback uses distribution mean
- [x] No infinite loops on bad parameters

### Phase 2: Decomposition Detection ⏳
Not yet implemented - requires:
- TaskDecompositionAnalyzer module
- createDecomposedVariant function
- Post-execution hook

### Phase 3: Automation ⏳
Not yet implemented - requires:
- ABTestOrchestrator backend service
- Automatic promotion logic

### Phase 4: Pattern Library ⏳
Not yet implemented - requires:
- Database schema for patterns
- Pattern storage and retrieval

## Test Results

```
=== Variant Tracking Tests ===
Total: 5
Passed: 5
Failed: 0

✅ PASS: candidate-variant-thompson-sampling
✅ PASS: stable-variant-thompson-sampling
✅ PASS: candidate-variant-direct-load
✅ PASS: stable-variant-direct-load
✅ PASS: candidate-variant-failed-activity

=== Beta Parameter Validation Tests ===
Total: 5
Passed: 5
Failed: 0

✅ PASS: valid-beta-parameters
✅ PASS: invalid-beta-parameters-nan
✅ PASS: invalid-beta-parameters-infinity
✅ PASS: invalid-beta-parameters-negative
✅ PASS: invalid-beta-parameters-zero

✅ ALL TESTS PASSED
```

## Integration with CI/CD

This harness can be integrated into CI/CD pipelines:

```yaml
# .github/workflows/validate-learning.yml
name: Validate Task Decomposition Learning
on: [push, pull_request]
jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: oven-sh/setup-bun@v1
      - run: bun install
      - run: bun run tests/validation-harnesses/task-decomposition-learning-harness.ts
```

## Expected Behavior

When Phase 1 is correctly implemented:
1. ✅ Variant selections are stored in activity.selection_reason.variant
2. ✅ Variant IDs are correctly passed to MetabobCLI.startActivityExecution
3. ✅ Variant IDs are correctly passed to TemplateMetricsClient.reportExecution
4. ✅ Beta parameter validation prevents system hangs
5. ✅ Thompson Sampling can distinguish between stable and candidate executions
6. ✅ A/B testing metrics are tracked accurately

## Future Enhancements

When Phase 2-4 are implemented, extend this harness to test:

### Phase 2: Decomposition Detection
- Detect complex tasks (>15K tokens, <70% success)
- Generate decomposition recommendations
- Create decomposed template variants
- Trigger post-execution analysis hook

### Phase 3: Automation
- Automatic promotion after 10 runs
- Promotion criteria validation
- Winner selection logic

### Phase 4: Pattern Library
- Store successful decomposition patterns
- Retrieve patterns for reuse
- Pattern matching across templates

## Files

- **Harness:** `tests/validation-harnesses/task-decomposition-learning-harness.ts`
- **README:** `tests/validation-harnesses/README-task-decomposition-learning.md`
- **Trace:** `docs/data-flows/task-decomposition-learning-flow.md`
- **Enforcement:** `/tmp/enforcement-task-decomposition-learning.json`

## Related Specifications

- **Specification:** task-decomposition-learning
- **Trace Impulse:** trace-task-decomposition-learning
- **Enforcement Impulse:** enforcement-task-decomposition-learning
- **Harness Impulse:** harness-task-decomposition-learning

## Contact

For questions or issues with this validation harness, refer to the task-decomposition-learning specification documentation.
