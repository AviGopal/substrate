# Critical Integration Tests

## Overview

This document describes the comprehensive integration tests added to cover the three critical loops identified in the audit:

1. **Loop 1**: Impulse chaining and flow (creation → chaining → transformation)
2. **Loop 2**: Thompson Sampling feedback loop (feedback → α/β → selection probability)
3. **Loop 3**: StateSpaceManager functionality (714 LOC previously untested)

## Test Files

### MiniBob Tests

Location: `/repos/minibob/test/`

| Test File | Coverage | Tests | Critical Path |
|-----------|----------|-------|---------------|
| `impulse-chaining.test.ts` | Impulse flow | 6 | Task output → Task input chaining |
| `state-space-manager.test.ts` | StateSpaceManager | 25+ | All 20 methods + edge cases |
| `shape-inference.test.ts` | Shape inference | 80+ | All 11 shapes + edge cases |
| `e2e-impulse-flow.test.ts` | End-to-end flow | 4 | Complete multi-task execution |

### Activity API Tests

Location: `/repos/metabob-activity-api/test/`

| Test File | Coverage | Tests | Critical Path |
|-----------|----------|-------|---------------|
| `thompson-integration.test.ts` | Thompson Sampling | 10+ | Feedback → parameter updates → selection |

## Running Tests

### MiniBob Tests

```bash
cd repos/minibob

# Run all tests
bun test

# Run specific test file
bun test test/impulse-chaining.test.ts
bun test test/state-space-manager.test.ts
bun test test/shape-inference.test.ts
bun test test/e2e-impulse-flow.test.ts

# Run with verbose output
bun test --verbose

# Run with coverage (future enhancement)
bun test --coverage
```

### Activity API Tests

```bash
cd repos/metabob-activity-api

# Run all tests
bun test

# Run Thompson Sampling integration test
bun test test/thompson-integration.test.ts

# IMPORTANT: Thompson tests require:
# - Activity API running at http://activity.metabob.local
# - Valid API key in METABOB_API_KEY_TEST or METABOB_API_KEY_ORG_A
```

**Environment Variables for Thompson Tests:**

```bash
export ACTIVITY_API_ENDPOINT="http://activity.metabob.local"
export METABOB_API_KEY_TEST="your-api-key-here"
# OR
export METABOB_API_KEY_ORG_A="your-api-key-here"
```

## Test Coverage by Loop

### Loop 1: Impulse Chaining

**Files Tested:**
- `repos/minibob/src/impulse.ts` - Impulse creation, loading, resolution
- `repos/minibob/src/activity.ts` - Task execution with impulse references
- `repos/minibob/src/state-space-manager.ts` - Impulse lifecycle management

**Critical Paths Tested:**

1. **Task output → Task input chaining**
   - Test: `impulse-chaining.test.ts: "Task output flows to next task input"`
   - Validates: Task 1 creates impulse → Task 2 loads it → Task 2 uses it
   - Expected: Impulse ID matches, content loaded, budget tracked

2. **Lazy loading**
   - Test: `impulse-chaining.test.ts: "Lazy loading: Task 2 loads impulse only when needed"`
   - Validates: Impulse not loaded until explicitly requested
   - Expected: Budget only consumed when loaded

3. **Multi-task chaining**
   - Test: `impulse-chaining.test.ts: "Multiple tasks chain impulses sequentially"`
   - Validates: Task 1 → Task 2 → Task 3 with proper derivation tracking
   - Expected: derivedFrom field correctly tracks lineage

4. **File-based impulses**
   - Test: `impulse-chaining.test.ts: "Impulse chaining with file pointer type"`
   - Validates: File pointers resolve and chain correctly
   - Expected: File content loaded, derivation tracked

5. **Budget management**
   - Test: `impulse-chaining.test.ts: "Impulse unloading frees budget for next task"`
   - Validates: Unload frees budget without deleting impulse
   - Expected: Budget restored, impulse metadata persists

6. **End-to-end flow**
   - Test: `e2e-impulse-flow.test.ts: "Complete flow: error analysis → source code → fix generation"`
   - Validates: 3-task activity with realistic impulse transformations
   - Expected: Error → Analysis → Source → Fix, with full derivation chain

### Loop 2: Thompson Sampling

**Files Tested:**
- `repos/metabob-activity-api/src/routes/activities.ts` - Feedback endpoints
- Thompson Sampling selection logic

**Critical Paths Tested:**

1. **Feedback → α/β updates**
   - Test: `thompson-integration.test.ts: "Feedback affects Thompson parameters"`
   - Validates: Positive feedback increases α, negative increases β
   - Expected: α=2, β=1 after positive feedback on α=1, β=1

2. **Feedback intensity**
   - Test: `thompson-integration.test.ts: "Feedback intensity affects parameter magnitude"`
   - Validates: Intensity multiplier affects α/β delta
   - Expected: intensity=3.0 causes α to increase by 3

3. **Selection probability changes**
   - Test: `thompson-integration.test.ts: "Selection probability changes with feedback"`
   - Validates: Templates with higher α/(α+β) selected more often
   - Expected: α=6, β=1 selected ~67% vs α=1, β=6 selected ~33%

4. **Statistical validation**
   - Test: `thompson-integration.test.ts: "Statistical test: Selection probability matches Beta distribution"`
   - Validates: Selection frequencies match expected Beta distribution
   - Expected: Mean selection rate ≈ α/(α+β)

5. **Edge cases**
   - Tests: Extreme positive, extreme negative, concurrent updates
   - Validates: System handles edge cases without corruption
   - Expected: Parameters accumulate correctly, no race conditions

### Loop 3: StateSpaceManager

**Files Tested:**
- `repos/minibob/src/state-space-manager.ts` - All 20 methods (714 LOC)

**Methods Tested (20/20):**

#### Query Methods (7/7)
1. `getAvailableShapes()` - Returns unique set of shapes
2. `getImpulsesByShape(shape)` - Returns impulses matching shape
3. `getShapeSignature()` - Returns sorted shape array
4. `getAllImpulses()` - Returns all impulses
5. `getImpulse(id)` - Returns impulse by ID
6. `getSnapshot()` - Returns complete state snapshot

#### Mutation Methods (8/8)
7. `addImpulse()` - Adds impulse and indexes by shape
8. `removeImpulse()` - Removes and unindexes impulse
9. `loadImpulse()` - Loads single impulse, updates budget
10. `loadImpulses()` - Loads multiple impulses in parallel
11. `unloadImpulse()` - Unloads impulse, frees budget
12. `clear()` - Clears all impulses and resets budget

#### Budget Methods (5/5)
13. `getBudgetRemaining()` - Returns remaining budget
14. `getBudgetState()` - Returns complete budget state
15. `canLoad()` - Checks if impulse can be loaded
16. `setBudgetTotal()` - Updates total budget

#### Prediction Methods (4/4)
17. `predictRequiredInputs()` - Predicts inputs for goal
18. `predictExpectedOutputs()` - Predicts outputs from activity
19. `findMissingImpulses()` - Finds missing required impulses
20. `canExecuteActivity()` - Checks if activity can execute

**Test Coverage:**
- **25+ tests** covering all methods and edge cases
- **Shape indexing**: Add, remove, query by shape
- **Budget tracking**: Load, unload, overflow handling
- **Activity execution**: Missing shapes, execution readiness
- **Prediction**: Output prediction, missing impulse detection

### Loop 3B: Shape Inference

**Files Tested:**
- `repos/minibob/src/shape-resolver.ts` - `extractImpliedShapes()` function

**Shapes Tested (11/11):**

1. `source_code` - File extensions (.ts, .js, .py, .go, etc.)
2. `error` - Error keywords (error, exception, crash, bug, etc.)
3. `trace` - Error keywords + execution keywords
4. `goal` - Action verbs (fix, implement, add, etc.)
5. `test_suite` - Test keywords (test, spec, suite, coverage)
6. `execution_trace` - Execution keywords (run, executed, trace)
7. `activity_template` - Template keywords (template, pattern, variant)
8. `activity_metrics` - Metrics keywords (metric, performance, stats)
9. `metrics` - Performance keywords
10. `sql_schema` - Database keywords (migration, schema, table)
11. Combined patterns - Multiple shapes from single description

**Test Coverage:**
- **80+ tests** covering all shapes and edge cases
- **File extensions**: 9 languages tested
- **Error keywords**: 7 keywords tested
- **Action verbs**: 15 verbs tested
- **Edge cases**: Empty string, case sensitivity, multiple spaces

## Expected Pass/Fail Criteria

### All Tests Should Pass

These tests are designed to validate critical system functionality. **All tests should pass** before deployment.

### Test Failures Indicate Critical Issues

If any test fails, it indicates a critical issue in one of the three loops:

**Loop 1 failures** → Impulse chaining broken → Activities cannot chain tasks
**Loop 2 failures** → Thompson Sampling broken → System cannot learn from feedback
**Loop 3 failures** → StateSpaceManager broken → Activity execution unreliable

### Performance Expectations

| Test File | Expected Duration |
|-----------|------------------|
| `impulse-chaining.test.ts` | < 5s |
| `state-space-manager.test.ts` | < 10s |
| `shape-inference.test.ts` | < 2s |
| `e2e-impulse-flow.test.ts` | < 15s |
| `thompson-integration.test.ts` | < 60s (requires API) |

**Note**: Thompson integration tests are slower because they make real HTTP requests to the backend.

## CI/CD Integration

### MiniBob Tests

Add to `.github/workflows/test-minibob.yml`:

```yaml
name: Test MiniBob

on:
  push:
    branches: [dev, main]
    paths:
      - 'repos/minibob/**'
  pull_request:
    branches: [dev, main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: oven-sh/setup-bun@v1
      - name: Install dependencies
        run: cd repos/minibob && bun install
      - name: Run tests
        run: cd repos/minibob && bun test
```

### Activity API Tests

Thompson Sampling tests require a running backend. Options:

1. **Skip in CI** (mark as manual tests)
2. **Deploy test backend** in CI environment
3. **Mock backend** for unit tests (separate from integration tests)

**Recommended**: Skip Thompson integration tests in CI, run manually before production deployment.

## Test Data and Fixtures

### MiniBob Tests

- **No external dependencies** - all tests use in-memory state
- **Temporary files** created in `/tmp/`, cleaned up automatically
- **Random IDs** via `crypto.randomBytes()` to avoid collisions

### Activity API Tests

- **Requires backend** - must have activity API running
- **Test templates** created with random IDs
- **Cleanup** - test templates are org-scoped, won't interfere with production

## Debugging Test Failures

### MiniBob Test Failures

```bash
# Run single test with verbose output
bun test test/impulse-chaining.test.ts --verbose

# Check logs for detailed error messages
# Tests log all operations with console.log

# Common issues:
# - File permissions: Check /tmp/ writeable
# - Budget overflow: Check budget limits in tests
# - Timing: Async operations may need more time
```

### Thompson Integration Test Failures

```bash
# Verify backend running
curl http://activity.metabob.local/health

# Verify API key valid
curl -H "Authorization: ApiKey YOUR_KEY" \
  http://activity.metabob.local/v2/activities/templates

# Check backend logs
kubectl logs -n activity-system -l app=metabob-activity-api --tail=100

# Common issues:
# - Backend not running: Start local cluster
# - Invalid API key: Check environment variables
# - SurrealDB connection: Verify database accessible
```

## Future Enhancements

1. **Coverage reporting** - Add Bun coverage support
2. **Performance benchmarks** - Track test execution time
3. **Mutation testing** - Verify tests catch regressions
4. **Parallel execution** - Run tests concurrently where safe
5. **Visual reports** - Generate HTML test reports
6. **Backend mocking** - Mock activity API for faster Thompson tests

## Related Documentation

- [IMPULSE_ACTIVITY_FOUNDATION.md](../architecture/IMPULSE_ACTIVITY_FOUNDATION.md) - Core system model
- [DEVELOPMENT_GUIDE.md](../DEVELOPMENT_GUIDE.md) - Development workflows
- [DEPLOYMENT_WORKFLOW.md](../../repos/deployment/DEPLOYMENT_WORKFLOW.md) - CI/CD pipeline
