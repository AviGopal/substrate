# Quick Start: Data Handoff Validation Tests

**Purpose**: Validate every data handoff between OpenCode → CLI → Backend

**Status**: 5/12 tests implemented (HIGH priority complete ✅)

---

## Run Tests (2 minutes)

```bash
# Navigate to test directory
cd scripts/validate-handoffs

# Set environment
export BACKEND_URL="http://localhost:8080"
export TEST_API_KEY="your-api-key"

# Run all tests
python run_all_validations.py --verbose

# Or run individually
python 01_session_creation.py --verbose
python 02_activity_search.py --verbose
python 03_activity_execution_start.py --verbose
python 04_activity_step_recording.py --verbose
python 05_activity_execution_complete.py --verbose
```

---

## What Each Test Validates

### ✅ Test 01: Session Creation
**Validates**: Session token lifecycle
- Backend health check
- Session creation via `/v2/session/create`
- Token generation and persistence
- Org/Project ID assignment
- Authenticated calls work

### ✅ Test 02: Activity Search
**Validates**: Thompson Sampling variant selection
- Activity search via `/v2/activities/search`
- Thompson Sampling scores
- Category/query filtering
- Activity impressions recorded

### ✅ Test 03: Activity Execution Start
**Validates**: Execution initialization
- Execution start via `/v2/activities/record/start`
- `activity_selections` row created (user choice)
- `activity_executions` row created (status="running")
- `execution_id` returned for tracking

### ✅ Test 04: Activity Step Recording
**Validates**: Step-by-step trace capture
- Step recording via `/v2/activities/record/step`
- Full metrics: tokens, cost, duration, tool_calls
- Impulse provenance: `impulses_loaded`, `impulses_created`
- Step order validation
- Multiple steps link to execution

### ✅ Test 05: Activity Execution Complete
**Validates**: Thompson Sampling feedback loop
- Execution completion via `/v2/activities/record/complete`
- `activity_executions` status updated to "completed"
- `activity_selections` marked converted
- Thompson Sampling priors updated (alpha/beta)
- Aggregated metrics correct

---

## Expected Results

**All tests PASS if**:
- ✅ Backend running at `$BACKEND_URL`
- ✅ API key valid
- ✅ Database has bootstrap templates
- ✅ Endpoints exist: `/v2/activities/record/start`, `/record/step`, `/record/complete`

**Test failures indicate**:
- ❌ Missing endpoints (backend not up-to-date)
- ❌ Schema mismatches (Proto → V2 → OpenCode)
- ❌ Database issues (foreign keys, missing tables)
- ❌ Authentication problems (invalid/expired token)

---

## What's Validated

✅ **Activity Execution Lifecycle**: Complete end-to-end flow  
✅ **Thompson Sampling**: Feedback loop closes properly  
✅ **Impulse Provenance**: Full lineage tracked  
✅ **Cost & Quality**: Tokens, USD, duration captured  
✅ **Architecture**: OpenCode → CLI → Backend boundaries respected  
✅ **Authentication**: Session tokens flow correctly  
✅ **Schemas**: Proto → V2 → OpenCode transformations work  

---

## Quick Reference

| Test | File | Lines | Priority | Status |
|------|------|-------|----------|--------|
| 01 | 01_session_creation.py | 183 | HIGH | ✅ |
| 02 | 02_activity_search.py | 214 | HIGH | ✅ |
| 03 | 03_activity_execution_start.py | 256 | HIGH | ✅ |
| 04 | 04_activity_step_recording.py | 315 | HIGH | ✅ |
| 05 | 05_activity_execution_complete.py | 326 | HIGH | ✅ |
| 06 | 06_placeholder.py | - | MEDIUM | ⚠️ |
| 07 | 07_placeholder.py | - | MEDIUM | ⚠️ |
| 08 | 08_placeholder.py | - | MEDIUM | ⚠️ |
| 09 | 09_placeholder.py | - | MEDIUM | ⚠️ |
| 10 | 10_placeholder.py | - | LOW | ⚠️ |
| 11 | 11_placeholder.py | - | LOW | ⚠️ |
| 12 | 12_placeholder.py | - | LOW | ⚠️ |

**Coverage**: 5/12 (41.7%) | **HIGH Priority**: 5/5 (100%) ✅

---

## Troubleshooting

### Test Fails: "Session creation failed: 500"
**Fix**: Check backend logs - likely database connection issue

### Test Fails: "No activities found"
**Fix**: Load bootstrap templates: `cd repos/metabob-rpc-api && python scripts/bootstrap_templates.py`

### Test Fails: "Token authentication failed: 401"
**Fix**: Check API key is valid: `echo $TEST_API_KEY`

### Test Fails: "Execution start failed: 404"
**Fix**: Backend missing endpoint - update to latest version

---

## Full Documentation

- **Design**: `DATA_HANDOFF_VALIDATION_PLAN.md` (1,551 lines)
- **Implementation**: `DATA_HANDOFF_TESTS_03-05_COMPLETE.md` (661 lines)
- **Session Summary**: `SESSION_COMPLETE_FEB14_HANDOFF_TESTS.md` (520 lines)
- **Usage Guide**: `README.md` (573 lines)

---

**Status**: HIGH Priority Tests Complete ✅  
**Date**: February 14, 2026  
**Next**: Run tests OR implement medium priority tests
