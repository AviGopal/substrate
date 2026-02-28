# Validation Harness: metrics-tui-accuracy

## Overview

This validation harness tests that all metrics displayed in the TUI sidebar and stats command accurately reflect the actual system state. This ensures users can trust the displayed values for cost tracking, resource monitoring, and system health assessment.

## Specification

**Name**: metrics-tui-accuracy  
**Category**: Data Accuracy & Consistency  
**Priority**: HIGH

## Expected Behavior

All metrics displayed in the TUI sidebar and stats command must:
1. **Accurately reflect the actual system state** - no estimation errors or drift
2. **Be consistent across all display methods** - endpoint, TUI, stats command show identical values
3. **Handle edge cases gracefully** - empty sessions, zero division, NaN/Infinity values
4. **Match within <1% floating point tolerance** - accounting for rounding errors

## Test Strategy

The validation harness:
1. Creates test sessions with known metrics (specific token counts, costs, activity states)
2. Calls `/session/:id/state` and `/session/:id/relationships/cost-breakdown` endpoints
3. Verifies returned JSON matches expected values
4. Runs `stats` command and parses output to extract displayed values
5. Compares endpoint data vs TUI displayed data vs stats command output for consistency
6. Tests edge cases: empty sessions (0 metrics), high utilization (>90%), budget warnings (>$8), NaN/Infinity handling

## Test Cases

### Case 1: Normal Session
- **File**: `test-cases/metrics-tui-accuracy-case-1.json`
- **Description**: Test normal session with typical metrics
- **Metrics**: 10 messages, $0.50 cost, 7 activities (5 completed, 1 failed, 1 active)
- **Expected**: All three sources show identical values within 1% tolerance

### Case 2: Empty Session
- **File**: `test-cases/metrics-tui-accuracy-case-2.json`
- **Description**: Test empty session with zero metrics - tests zero division handling
- **Metrics**: 0 messages, $0 cost, 0 activities
- **Expected**: Graceful handling of zero division, no NaN or Infinity values

### Case 3: High Utilization
- **File**: `test-cases/metrics-tui-accuracy-case-3.json`
- **Description**: Test high utilization session (>90%) - tests warning thresholds
- **Metrics**: 100 messages, $5.00 cost, 25 activities, 95% impulse utilization
- **Expected**: Warning indicators shown correctly, no overflow errors

### Case 4: Budget Warning
- **File**: `test-cases/metrics-tui-accuracy-case-4.json`
- **Description**: Test session exceeding $8 budget warning threshold
- **Metrics**: 50 messages, $8.50 cost (exceeds $8 threshold)
- **Expected**: Budget warning shown, metrics remain accurate

## Running the Harness

```bash
# Run all test cases
cd tests/validation-harnesses
bun run metrics-tui-accuracy-harness.ts

# Run specific test case
cd tests/validation-harnesses
bun run metrics-tui-accuracy-harness.ts --case normal-session
```

## Validation Criteria

The harness returns **PASS** if:
- ✅ All endpoint data matches expected values (within 1% tolerance)
- ✅ Endpoint data matches stats command output (within 1% tolerance)
- ✅ Endpoint data matches TUI sidebar data (exact match)
- ✅ Edge cases handled correctly (no NaN, Infinity, or crashes)
- ✅ Zero division handled gracefully (returns 0, not NaN)
- ✅ Empty sessions handled correctly (shows 0 metrics, not errors)

The harness returns **FAIL** if:
- ❌ Any metric differs by >1% between sources
- ❌ NaN or Infinity values appear in metrics
- ❌ Zero division causes errors or NaN
- ❌ Empty sessions cause errors or missing data
- ❌ High utilization metrics overflow or become invalid

## Output Format

```json
{
  "pass": true,
  "actual": {
    "endpointData": { ... },
    "statsCommandOutput": { ... },
    "tuiSidebarData": { ... }
  },
  "expected": {
    "cost": 0.50,
    "tokens": { "input": 5000, "output": 2000, "cache": 1000 },
    "activities": { "total": 7, "completed": 5, "failed": 1, "successRate": 0.833 },
    "contextUtilization": 60.0
  },
  "consistency": {
    "endpointVsStats": true,
    "endpointVsTui": true,
    "statsVsTui": true,
    "discrepancies": []
  },
  "edgeCases": {
    "handlesNaN": true,
    "handlesInfinity": true,
    "handlesZeroDivision": true,
    "handlesEmptySession": true
  },
  "errors": [],
  "testCase": "normal-session"
}
```

## Enforcement Impact

This validation harness validates the Priority 1 enforcement changes:
1. **Storage path traversal fix** - Ensures Storage.read/list/remove validate paths
2. **SessionState error isolation** - Ensures Promise.allSettled gracefully degrades
3. **Stats NaN validation** - Ensures Number.isFinite() prevents NaN propagation

## Related Files

- **Harness**: `metrics-tui-accuracy-harness.ts`
- **Test Cases**: `test-cases/metrics-tui-accuracy-case-{1-4}.json`
- **Trace Analysis**: `../../docs/data-flows/metrics-tui-accuracy-flow.md`
- **Enforcement Summary**: `/tmp/enforcement-metrics-tui-accuracy.json`

## Maintenance

When updating the spec or implementation:
1. Update test cases in `test-cases/` directory
2. Update expected values to match new behavior
3. Re-run validation harness to confirm changes
4. Update this README with new test cases or criteria
