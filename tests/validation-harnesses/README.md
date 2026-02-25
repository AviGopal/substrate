# Validation Harness: sidebar-impulse-visibility

## Overview

This validation harness tests the TUI sidebar's ability to display real-time impulse loading state and activity progress tracking. It validates all 7 specification requirements without requiring an LLM.

## Files

- `sidebar-impulse-visibility-harness.ts` - Main validation script
- `sidebar-test-cases.json` - Historical test cases with expected outputs
- `README.md` - This file

## Usage

### Run All Test Cases

```bash
cd tests/validation-harnesses
bun run sidebar-impulse-visibility-harness.ts case-1-basic-impulse-loading
bun run sidebar-impulse-visibility-harness.ts case-2-activity-progress
bun run sidebar-impulse-visibility-harness.ts case-3-warning-thresholds
bun run sidebar-impulse-visibility-harness.ts case-4-incremental-loading
```

### Run Programmatically

```typescript
import { runValidation, testCases } from './sidebar-impulse-visibility-harness'

const result = await runValidation(testCases['case-1-basic-impulse-loading'])

if (result.pass) {
  console.log('✅ Validation PASSED')
} else {
  console.log('❌ Validation FAILED')
  console.log('Errors:', result.errors)
}
```

## Test Cases

### Case 1: Basic Impulse Loading

**Purpose:** Verify sidebar shows impulse count incrementing as impulses load by priority

**Validation:**
- Initial state: 0/4 impulses loaded, 0% utilization
- After high-priority load: 2/4 impulses loaded, 50% utilization
- After medium-priority load: 3/4 impulses loaded, 75% utilization

**Expected Behavior:**
- Memory section appears when impulses exist
- Impulse counter shows X/Y format
- Token counter updates with budget usage
- Utilization progress bar advances

### Case 2: Activity Progress Tracking

**Purpose:** Verify sidebar activity section tracks task completion in real-time

**Validation:**
- Task counter advances: Task 0/5 -> 1/5 -> 2/5 -> 3/5 -> 4/5 -> 5/5
- Progress bar advances: 0% -> 20% -> 40% -> 60% -> 80% -> 100%
- Status changes: executing -> executing -> executing -> completing -> done
- Elapsed time increases

**Expected Behavior:**
- Activities section shows active activities
- Task counter format is "Task N/M"
- Progress bar updates with color coding
- Status badge reflects current state

### Case 3: Warning Thresholds (85%)

**Purpose:** Verify sidebar shows warnings when utilization exceeds 85%

**Validation:**
- Initial state: 0% utilization, no warning
- After loading 3 high-priority impulses: 90% utilization (9000/10000), warning appears

**Expected Behavior:**
- Warning indicator appears at 85%+ utilization
- Progress bar color changes to red
- Memory section shows warning badge

### Case 4: Incremental Loading with Activity Progress

**Purpose:** Verify sidebar shows both impulse loading and activity progress simultaneously

**Validation:**
- Impulses: 0/5 -> 2/5 -> 3/5 loaded
- Activity: Task 0/3 -> 1/3 -> 2/3 -> 3/3
- Progress: 0% -> 33% -> 67% -> 100%
- Utilization: 0% -> 40% -> 60%

**Expected Behavior:**
- Both sections update independently
- No race conditions or conflicts
- All metrics stay synchronized

## Validation Criteria

### Pass Conditions

✅ All snapshots match expected values
✅ Impulse counts accurate (loaded/total)
✅ Token usage tracked correctly
✅ Utilization percentage within ±1% tolerance
✅ Activity progress advances correctly
✅ Task counter format is "Task N/M"
✅ Status transitions match expected sequence
✅ Warnings appear at correct thresholds

### Fail Conditions

❌ Any snapshot mismatch
❌ Impulse count incorrect
❌ Token usage incorrect
❌ Utilization off by >1%
❌ Activity progress incorrect
❌ Task counter format wrong
❌ Status transitions incorrect
❌ Warnings missing or incorrect

## Architecture

### Validation Flow

```
1. Create test session
2. Create impulses (varying priorities and budgets)
3. Capture initial snapshot (baseline)
4. Load high-priority impulses
5. Capture snapshot (verify impulse loading)
6. Load medium-priority impulses
7. Capture snapshot (verify incremental loading)
8. Create test activity
9. Simulate task completion
10. Capture snapshots at each step (verify progress)
11. Compare all snapshots to expected values
12. Return PASS/FAIL with errors
```

### Snapshot Structure

```typescript
interface SidebarSnapshot {
  timestamp: number
  impulses: {
    loaded: number        // Count of loaded impulses
    total: number         // Total impulse count
    utilization: number   // Percentage (0-100)
  }
  tokens: {
    used: number         // Tokens consumed
    total: number        // Total budget
  }
  activities: Array<{
    title: string
    status: string       // executing, completing, done
    progress: {
      current: number    // Completed tasks
      total: number      // Total tasks
      percentage: number // Progress (0-100)
    }
    elapsedMs: number
  }>
  warnings: {
    memoryWarning: boolean  // True when utilization >= 85%
    heapWarning: boolean    // True when heap >= 80%
  }
}
```

## Integration with trace-enforce-validate Loop

This harness is designed to be used in the trace-enforce-validate loop:

1. **Trace** identifies specification requirements and current implementation
2. **Enforce** applies changes to close gaps
3. **Validate** (this harness) confirms changes work as expected

The harness:
- Runs without LLM (uses historical test cases)
- Returns deterministic PASS/FAIL results
- Provides detailed error messages for debugging
- Captures actual vs expected for comparison

## Maintenance

### Adding New Test Cases

1. Add entry to `sidebar-test-cases.json`
2. Add entry to `testCases` object in harness
3. Define input parameters and expected outputs
4. Run validation to verify

### Updating Expected Values

If specification changes:
1. Update expected snapshots in test cases
2. Re-run validation
3. Verify new behavior matches updated spec

## Troubleshooting

### Validation Fails with "Snapshot count mismatch"

**Cause:** Activity execution didn't generate expected number of snapshots

**Solution:** Check that impulse loading and task completion logic is working correctly

### Utilization Mismatch

**Cause:** Token budget calculation differs from expected

**Solution:** Verify impulse budgets are correct and loading logic is working

### Activity Progress Incorrect

**Cause:** Task completion simulation not updating state correctly

**Solution:** Check activity state updates and storage writes

## Performance

- **Execution time:** ~1-2 seconds per test case
- **Storage I/O:** Minimal (test session cleanup)
- **Memory usage:** <50 MB
- **Parallelizable:** Yes (independent test cases)

## Future Enhancements

- [ ] Add visual TUI rendering validation (screenshot comparison)
- [ ] Test color coding thresholds (green/yellow/red)
- [ ] Test refresh rate (2.5s polling)
- [ ] Test race conditions (concurrent updates)
- [ ] Add stress test (many impulses/activities)
- [ ] Test error handling (malformed state)
