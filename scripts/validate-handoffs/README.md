# Data Handoff Validation Suite

**Purpose**: Validate every data handoff between OpenCode → CLI → Backend to ensure proper architectural boundaries and data integrity.

**Status**: 2/12 tests implemented (16.7%)

---

## Quick Start

### Prerequisites

1. **Backend running**: `http://localhost:8080`
2. **Test API key**: Set `TEST_API_KEY` environment variable
3. **Python 3.10+**: With `requests` library

### Run All Tests

```bash
cd scripts/validate-handoffs
python run_all_validations.py --verbose
```

### Run Single Test

```bash
python 01_session_creation.py --verbose
```

### Environment Variables

```bash
export BACKEND_URL="http://localhost:8080"  # Default
export TEST_API_KEY="your-test-api-key"     # Required
```

---

## Test Suite Overview

| # | Test Name | Status | Handoff | Priority |
|---|-----------|--------|---------|----------|
| 01 | Session Creation | ✅ Implemented | OpenCode → CLI → Backend | HIGH |
| 02 | Activity Search | ✅ Implemented | OpenCode → CLI → Backend | HIGH |
| 03 | Activity Execution Start | ✅ Implemented | OpenCode → CLI → Backend | HIGH |
| 04 | Activity Step Recording | ✅ Implemented | CLI → Backend | HIGH |
| 05 | Activity Execution Complete | ✅ Implemented | CLI → Backend | HIGH |
| 06 | Component Annotation | ⚠️  Placeholder | OpenCode → CLI → Backend | MEDIUM |
| 07 | Template Creation | ⚠️  Placeholder | OpenCode → CLI → Backend | MEDIUM |
| 08 | Template Loading | ⚠️  Placeholder | OpenCode → CLI → Backend | MEDIUM |
| 09 | Session Token Refresh | ⚠️  Placeholder | CLI → Backend | MEDIUM |
| 10 | Priority Issues | ⚠️  Placeholder | OpenCode → CLI → Backend | LOW |
| 11 | Change Impact Analysis | ⚠️  Placeholder | OpenCode → CLI → Backend | LOW |
| 12 | Deletion Safety | ⚠️  Placeholder | OpenCode → CLI → Backend | LOW |

---

## Test Details

### ✅ Test 01: Session Creation

**Handoff**: `OpenCode → CLI MCP → Backend /v2/session/create → Redis + SurrealDB`

**Validates**:
1. Backend API accessible
2. Session created successfully
3. Session token generated
4. Org ID and Project ID returned
5. Consumer profile created
6. Token works for authenticated calls

**Run**:
```bash
python 01_session_creation.py --verbose
```

**Expected Output**:
```
✅ Backend healthy
✅ Session created: session-abc123...
✅ Session token: tok_xyz...
✅ Org ID: org-001
✅ Project ID: proj-001
✅ Authenticated call successful
```

---

### ✅ Test 02: Activity Search

**Handoff**: `OpenCode search_activities() → CLI MCP → Backend /v2/activities/search → Thompson Sampling`

**Validates**:
1. Activity search succeeds
2. Thompson Sampling variant selection
3. Schema valid (activity_id, variant_id present)
4. Category filter works
5. Query filter works
6. Activity impressions recorded

**Run**:
```bash
python 02_activity_search.py --verbose
```

**Expected Output**:
```
✅ Found 13 activities (bootstrap templates)
✅ Activity schema valid
✅ Category filter works (3 results)
✅ Query filter works (2 results)
```

---

### ✅ Test 03: Activity Execution Start

**Handoff**: `OpenCode activity() → CLI MCP → Backend /v2/activities/record/start`

**Validates**:
1. Session created with valid token
2. Activity template search succeeds
3. Activity execution started
4. Backend creates activity_selections row (user choice tracked)
5. Backend creates activity_executions row (status="running")
6. Execution ID returned for step tracking

**Run**:
```bash
python 03_activity_execution_start.py --verbose
```

**Expected Output**:
```
✅ Session created: session-abc123...
✅ Activity found: feature-impl-...
✅ Execution started: exec-xyz...
✅ activity_selections row verified
✅ Execution status: running
✅ execution_id valid for step tracking
```

---

### ✅ Test 04: Activity Step Recording

**Handoff**: `CLI ActivityManager.execute_task() → Backend /v2/activities/record/step`

**Validates**:
1. Session and execution created
2. Activity step recorded with metrics
3. Step persisted in execution_steps
4. Impulse metadata accepted (impulses_loaded, impulses_created)
5. Step order validation tested
6. Multiple steps linked to execution

**Run**:
```bash
python 04_activity_step_recording.py --verbose
```

**Expected Output**:
```
✅ Setup complete: execution_id=exec-abc...
✅ Step recorded: step-123
✅ Step persisted (step_count=1)
✅ Impulse metadata accepted
✅ Step order validation tested
✅ Second step recorded: step-124
```

---

### ✅ Test 05: Activity Execution Complete

**Handoff**: `CLI ActivityManager.complete_execution() → Backend /v2/activities/record/complete`

**Validates**:
1. Session, execution, and steps created
2. Execution completed with final metrics
3. Backend updates activity_executions (status="completed")
4. Backend updates activity_selections (converted=true)
5. Thompson Sampling priors tracked (alpha/beta)
6. Aggregated metrics correct (tokens, cost, duration)

**Run**:
```bash
python 05_activity_execution_complete.py --verbose
```

**Expected Output**:
```
✅ Setup complete: execution_id=exec-abc..., 2 steps recorded
✅ Execution completed successfully
✅ Execution status updated to 'completed'
✅ activity_selections conversion assumed
✅ Thompson Sampling: alpha=X, beta=Y
✅ Aggregated metrics: Success=True, Cost=$0.10, Tokens=3000, Duration=5.0s
```

---

### ⚠️ Test 06: Component Annotation

**Handoff**: `OpenCode metabob_annotate_component() → CLI MCP → Backend /v2/components/annotate`

**Validates**:
1. Annotation sent with component details
2. CLI adds execution_id from context
3. Backend creates component_changes row
4. Backend updates CPG with annotation
5. Linkage: component_change → execution_id

**Status**: Not yet implemented

---

### ⚠️ Test 07: Template Creation

**Handoff**: `OpenCode create_activity_template() → CLI MCP → Backend /v2/activities/templates`

**Validates**:
1. OpenCode schema → Proto transformation
2. Proto schema validation
3. Backend creates activities row
4. Backend creates activity_variants row (v1)
5. Source="agent" provenance tracking
6. Response transforms back: Proto → V2 → OpenCode

**Status**: Not yet implemented

---

### ⚠️ Test 08: Template Loading

**Handoff**: `OpenCode get_activity_template() → CLI MCP → Backend /v2/activities/templates/{id}`

**Validates**:
1. CLI cache check first
2. Backend call if cache miss
3. Thompson Sampling variant selection
4. Proto template returned
5. CLI caches template

**Status**: Not yet implemented

---

### ⚠️ Test 09: Session Token Refresh

**Handoff**: `CLI FileStateManager → Backend /v2/session/refresh → Redis`

**Validates**:
1. Token expiry detection (< 24h remaining)
2. Refresh endpoint called with current token
3. Backend validates current token
4. New token generated (30-day TTL)
5. FileStateManager cache updated
6. Token persists to disk

**Status**: Not yet implemented

---

### ⚠️ Test 10: Priority Issues

**Handoff**: `OpenCode metabob_get_priority_issues() → CLI MCP → Backend /v2/issues/priority`

**Validates**:
1. Backend infers work area from session history
2. Max 5 issues returned
3. Issues include resolution history
4. Issues include annotations
5. Empty result if no active work area

**Status**: Not yet implemented

---

### ⚠️ Test 11: Change Impact Analysis

**Handoff**: `OpenCode metabob_analyze_change_impact() → CLI MCP → Backend /v2/analysis/change-impact`

**Validates**:
1. Backend queries CPG for component
2. Dependency graph traversal (max_depth=3)
3. Issues in dependents included
4. Issues in dependencies included
5. Recommendation correct (safe/caution/critical)

**Status**: Not yet implemented

---

### ⚠️ Test 12: Deletion Safety Assessment

**Handoff**: `OpenCode metabob_assess_deletion_safety() → CLI MCP → Backend /v2/analysis/deletion-safety`

**Validates**:
1. GC-style liveness analysis performed
2. Live roots identified (entry points, public APIs)
3. Dead cycles distinguished from live code
4. Live paths returned if reachable
5. Safety verdict correct (SAFE/CAUTION/CRITICAL)

**Status**: Not yet implemented

---

## Implementation Guide

### Creating a New Test

1. **Copy template**:
   ```bash
   cp 01_session_creation.py 03_activity_execution_start.py
   ```

2. **Update docstring**: Describe handoff and validations

3. **Implement `run_validation()`**:
   - Step-by-step validation checks
   - Return dict with `passed`, `error`, `details`

4. **Test locally**:
   ```bash
   python 03_activity_execution_start.py --verbose
   ```

5. **Update this README**: Mark as ✅ Implemented

### Test Structure

```python
def run_validation(verbose: bool = False) -> Dict[str, Any]:
    result = {
        "passed": False,
        "details": {},
        "error": None
    }
    
    try:
        # Step 1: Setup
        if verbose:
            print("\n[1/N] Description...")
        
        # Perform validation
        # ...
        
        result["details"]["check_name"] = True
        
        if verbose:
            print("✅ Check passed")
        
        # More steps...
        
        # All checks passed
        result["passed"] = True
        
    except Exception as e:
        result["error"] = str(e)
    
    return result
```

---

## Test Runner Usage

### Run All Tests

```bash
python run_all_validations.py --verbose
```

### Run Specific Test

```bash
python run_all_validations.py --test 01_session_creation --verbose
```

### Stop on First Failure

```bash
python run_all_validations.py --stop-on-failure
```

### Custom Output Path

```bash
python run_all_validations.py --output custom_report.md
```

### Command Line Options

```
--verbose, -v          Show detailed test output
--stop-on-failure, -s  Stop after first test failure
--output, -o PATH      Save report to custom path (default: validation_report.md)
--test, -t NAME        Run specific test only (e.g., '01_session_creation')
```

---

## Validation Report

After running tests, a markdown report is generated:

**File**: `validation_report.md`

**Contents**:
- Overall pass rate
- Test-by-test results
- Detailed error messages
- Timing information

**Example**:
```markdown
# Data Handoff Validation Report

**Generated**: 2026-02-14 03:15:00
**Duration**: 5432ms
**Pass Rate**: 100.0% (12/12)

## ✅ ALL TESTS PASSED

| # | Test | Status | Duration | Details |
|---|------|--------|----------|---------|
| 1 | Session Creation | ✅ PASS | 234ms | - |
| 2 | Activity Search | ✅ PASS | 189ms | - |
...
```

---

## Integration with CI/CD

### GitHub Actions Example

```yaml
name: Data Handoff Validation

on: [push, pull_request]

jobs:
  validate-handoffs:
    runs-on: ubuntu-latest
    
    services:
      backend:
        image: metabob-rpc-api:latest
        ports:
          - 8080:8080
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Set up Python
        uses: actions/setup-python@v4
        with:
          python-version: '3.10'
      
      - name: Install dependencies
        run: pip install requests
      
      - name: Run validation suite
        env:
          BACKEND_URL: http://localhost:8080
          TEST_API_KEY: ${{ secrets.TEST_API_KEY }}
        run: |
          cd scripts/validate-handoffs
          python run_all_validations.py --verbose
      
      - name: Upload report
        uses: actions/upload-artifact@v3
        with:
          name: validation-report
          path: scripts/validate-handoffs/validation_report.md
```

---

## Troubleshooting

### Backend Not Running

```
❌ Backend unhealthy: Connection refused
```

**Solution**: Start backend:
```bash
cd repos/metabob-rpc-api
uvicorn server.app:app --reload --port 8080
```

### Invalid API Key

```
❌ Session creation failed: 401 Unauthorized
```

**Solution**: Set valid API key:
```bash
export TEST_API_KEY="valid-api-key-here"
```

### Database Not Initialized

```
❌ No activities returned (expected bootstrap templates)
```

**Solution**: Run bootstrap:
```bash
cd repos/metabob-rpc-api
python scripts/bootstrap_templates.py
```

---

## Next Steps

### High Priority (Complete These First)

1. ✅ Test 01: Session Creation (DONE)
2. ✅ Test 02: Activity Search (DONE)
3. ⚠️  Test 03: Activity Execution Start
4. ⚠️  Test 04: Activity Step Recording
5. ⚠️  Test 05: Activity Execution Complete

### Medium Priority

6. ⚠️  Test 06: Component Annotation
7. ⚠️  Test 07: Template Creation
8. ⚠️  Test 08: Template Loading
9. ⚠️  Test 09: Session Token Refresh

### Low Priority (Can Wait)

10. ⚠️  Test 10: Priority Issues
11. ⚠️  Test 11: Change Impact Analysis
12. ⚠️  Test 12: Deletion Safety

---

## Related Documentation

- **DATA_HANDOFF_VALIDATION_PLAN.md** - Detailed design and architecture
- **DATA_FLOW_CHAIN_OF_CUSTODY_COMPLETE.md** - Complete data flow documentation
- **REPOS_DUPLICATION_ANALYSIS.md** - Architecture boundary enforcement

---

**Last Updated**: February 14, 2026  
**Status**: 5/12 tests implemented (41.7%)
**Target**: 100% coverage by end of sprint
