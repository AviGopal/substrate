# Thompson Sampling Validation Harness

**Specification**: thompson-sampling-template-selection  
**Harness File**: tests/validation-harnesses/thompson-sampling-template-selection-harness.ts  
**Date**: 2026-02-23

## Purpose

Validate that Thompson Sampling template selection is working correctly by:
1. Testing Beta distribution sampling produces correct ranges
2. Verifying selection distribution favors high-success templates (exploitation)
3. Ensuring exploration still occurs for lower-success templates
4. Confirming selection_reason metadata is recorded

## Test Strategy

### Test Case 1: Beta Distribution Sampling
**Input**:
- alpha = 19 (18 successes + 1)
- beta = 3 (2 failures + 1)
- sampleSize = 1000

**Expected Output**:
- Mean in range [0.75, 0.90]
- All samples in [0, 1]
- Beta(19, 3) distribution mean ≈ 0.86

**Validation**: Samples follow Beta distribution characteristics

---

### Test Case 2: Thompson Sampling Distribution
**Input**:
- Template A: 18 successes, 2 failures (90% success rate)
  - alpha = 19, beta = 3
- Template B: 10 successes, 10 failures (50% success rate)
  - alpha = 11, beta = 11
- iterations = 100

**Expected Output**:
- Template A selection rate: 65-85% (exploitation bias)
- Template B selection rate: 15-35% (exploration)
- Thompson Sampling metadata present

**Validation**: High-success templates selected more often while still exploring alternatives

---

### Test Case 3: Selection Reason Recording
**Input**:
- templateId = "hello-world-thompson-A"
- variables = {}
- reason = "Validation test"

**Expected Output**:
- selection_reason field exists
- Contains fields: method, alpha, beta, sample, selectedId
- method = "thompson_sampling"

**Validation**: Activity metadata correctly records Thompson Sampling decisions

---

## Usage

```typescript
import { runValidation } from "./tests/validation-harnesses/thompson-sampling-template-selection-harness"
import * as TemplateSelector from "./repos/metabob-opencode/packages/opencode/src/session/template-selector"
import { ActivityTool } from "./repos/metabob-opencode/packages/opencode/src/tool/activity"

// Run validation
const result = await runValidation({
  selectFn: TemplateSelector.select,
  invokeActivityFn: ActivityTool.invoke,
})

console.log(result.summary)
// Thompson Sampling Validation Results:
// - Distribution Test: PASS - Thompson Sampling working correctly. A: 76.0%, B: 24.0%
// - Selection Reason Test: PASS - selection_reason correctly recorded with all expected fields
// Overall: PASS ✅

if (!result.pass) {
  console.error("Validation failed!")
  console.error(JSON.stringify(result.results, null, 2))
}
```

## Test Cases (Impulse Storage)

### Case 1: Beta Sample Validation
**Impulse ID**: validation-thompson-sampling-template-selection-case-1

```json
{
  "input": {
    "alpha": 19,
    "beta": 3,
    "sampleSize": 1000
  },
  "expectedOutput": {
    "meanRange": { "min": 0.75, "max": 0.90 },
    "allInRange": true
  }
}
```

### Case 2: Distribution Validation
**Impulse ID**: validation-thompson-sampling-template-selection-case-2

```json
{
  "input": {
    "templateA": { "id": "hello-world-thompson-A", "successes": 18, "failures": 2 },
    "templateB": { "id": "hello-world-thompson-B", "successes": 10, "failures": 10 },
    "iterations": 100
  },
  "expectedOutput": {
    "aSelectionRate": { "min": 0.65, "max": 0.85 },
    "bSelectionRate": { "min": 0.15, "max": 0.35 },
    "hasMetadata": true
  }
}
```

### Case 3: Selection Reason Validation
**Impulse ID**: validation-thompson-sampling-template-selection-case-3

```json
{
  "input": {
    "templateId": "hello-world-thompson-A",
    "variables": {},
    "reason": "Validation test"
  },
  "expectedOutput": {
    "hasSelectionReason": true,
    "fields": ["method", "alpha", "beta", "sample", "selectedId"],
    "method": "thompson_sampling"
  }
}
```

---

## Harness Implementation

The harness provides:
- Mock metrics setup via `setMockMetrics()` and `clearMockMetrics()`
- Beta distribution validation
- Thompson Sampling distribution testing
- Selection reason validation
- Comprehensive pass/fail reporting

## Integration with CI/CD

```bash
# Run validation harness
bun test tests/validation-harnesses/thompson-sampling-template-selection-harness.ts

# Expected output:
# Thompson Sampling Validation Results:
# - Distribution Test: PASS - Thompson Sampling working correctly. A: 76.0%, B: 24.0%
# - Selection Reason Test: PASS - selection_reason correctly recorded with all expected fields
# Overall: PASS ✅
```

## Success Criteria

✅ **PASS** if:
1. Template A (90% success) selected 65-85% of time
2. Template B (50% success) selected 15-35% of time
3. Thompson Sampling metadata present in all selections
4. selection_reason field correctly populated in activity metadata

❌ **FAIL** if:
1. Selection rates outside expected ranges (randomness issue)
2. No Thompson Sampling metadata (algorithm not invoked)
3. Missing selection_reason fields (metadata not recorded)
4. Activity invocation fails (integration broken)

---

## Notes

- Validation uses mocked metrics to avoid Redis dependency
- Test is deterministic over large sample sizes (100 iterations)
- Statistical variance expected but should stay within ranges
- Can be run without LLM or external services

**Status**: Ready for execution. Harness validates Thompson Sampling implementation.
