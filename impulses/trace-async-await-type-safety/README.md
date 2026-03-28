# Trace: async-await-type-safety

**Specification**: All async function calls in metabob-rpc-api must use await keyword. Type checking with pyright/mypy must be enforced in CI pipeline. All route handlers must have minimum 80% test coverage. Pre-commit hooks must validate async/await correctness before commits.

## Summary

Systematic quality enforcement gaps in metabob-rpc-api are causing recurring async/await bugs. Three production bugs occurred between Mar 2-4, 2026, all caused by missing `await` keywords on async database operations.

## Root Cause

**No systematic quality gates**:
- ❌ No type checking (mypy/pyright) in CI or pre-commit
- ❌ No test coverage for learning_loop routes (0%)
- ❌ No coverage threshold enforcement
- ❌ Async bugs reach production without detection

## Evidence

### Recent Bugs (Mar 2-4, 2026)

1. **a09b360** (Mar 4): Fix additional missing await calls in impulse_learning.py
   - `normalize_pattern()` and `track_usage()` called without await
   - `list()` incorrectly awaited (not async)

2. **1dc5c3b** (Mar 4): Fix missing await calls in async functions  
   - 18+ missing await calls in learning_loop.py
   - `get_boredom_candidates()` coroutine error
   - Added null check for session_id

3. **05ae371** (Mar 2): Add missing await keywords for async database operations
   - Fixed ResponseValidationError issues

## Components Analysis

### Critical Gaps

| Component | Current | Desired | Gap |
|-----------|---------|---------|-----|
| learning_loop.py routes | 0% coverage | 80% coverage | NO TESTS |
| impulse_learning.py ops | 0% coverage | 80% coverage | NO TESTS |
| Pre-commit hooks | black, isort only | + pyright | NO TYPE CHECK |
| CI pipeline | tests only | tests + types + coverage | NO ENFORCEMENT |

### Files Affected

- `repos/metabob-rpc-api/server/routes/learning_loop.py` - 8 async endpoints, 0 tests
- `repos/metabob-rpc-api/server/db/operations/impulse_learning.py` - 9 async functions, 0 tests
- `repos/metabob-rpc-api/.pre-commit-config.yaml` - Missing type checking hook
- `repos/metabob-rpc-api/.github/workflows/run-tests.yaml` - Missing type check + coverage enforcement

## Data Flow (Bug Path)

```
Developer writes async function
    ↓
Commits without type check (pre-commit has no pyright)
    ↓
Pre-commit runs black/isort → NO TYPE VALIDATION
    ↓
CI runs tests → NO COVERAGE THRESHOLD → NO TYPE CHECKING
    ↓
Bug reaches production
    ↓
Runtime error: ResponseValidationError, coroutine not awaited
    ↓
Manual hotfix commit (happened 3 times in 4 days)
```

## Implementation Plan

### Phase 1: Type Checking (CRITICAL)

1. Add pyright to `pyproject.toml` dev dependencies
2. Configure pyright with `reportUnawaited: error`
3. Add pyright pre-commit hook
4. Add type checking step to `.github/workflows/run-tests.yaml`

### Phase 2: Test Coverage (CRITICAL)

5. Create `tests/routes/test_routes_learning_loop.py` with 80%+ coverage
6. Add `--cov-fail-under=80` to pytest in CI

### Phase 3: Validation

7. Test enforcement:
   - Commit missing await → pre-commit fails
   - Remove tests → CI fails on coverage
   - Type error in PR → CI blocks merge

## External Validation

### Bug Injection Test
1. Remove `await` from a DB call in learning_loop.py
2. Attempt to commit
3. **EXPECTED**: pre-commit hook fails with pyright error
4. **EXPECTED**: If bypassed, CI fails on pyright step

### Coverage Test
1. Delete tests from test_routes_learning_loop.py
2. Push to PR
3. **EXPECTED**: CI fails with coverage < 80% error

### Production Smoke Test
1. Deploy to test environment
2. Call `POST /api/v1/learning-loop/executions`
3. Call `GET /api/v1/learning-loop/boredom-activities`
4. **EXPECTED**: No ResponseValidationError, no coroutine warnings

## Metrics

| Metric | Value |
|--------|-------|
| Bugs Before Enforcement | 3 |
| Days With Bugs | 4 |
| Files Affected | 3 |
| Async Functions in Scope | 68+ |
| Current Coverage | 0% |
| Target Coverage | 80% |

## Next Steps

This trace provides the foundation for:
1. **Enforcement**: Add quality gates to prevent bugs
2. **Validation**: Test that gates work end-to-end
3. **Documentation**: Record the specification permanently

See `trace-analysis.json` for complete component details and implementation plan.
