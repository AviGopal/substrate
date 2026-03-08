# Activity Lifecycle E2E Validation Harness

## Overview

This validation harness tests the complete Activity Lifecycle implementation through the full stack:

```
TypeScript (metabob-opencode) 
    ↓ MCP protocol
Python (metabob-cli)
    ↓ HTTP/JSON
FastAPI (metabob-rpc-api)
    ↓ SurrealDB protocol
SurrealDB
    ↓ (back through stack)
Client
```

## Test Coverage

### 1. Dynamic Creation Trigger (GAP-1) ✅
- **Validates**: When no templates match, system suggests `create_activity_goal_seeking`
- **Tests**: Template search with novel request
- **Expected**: Empty results with suggestion object

### 2. Activity Storage (GAP-2) ⚠️
- **Validates**: Activities are stored in backend with org/project scope
- **Tests**: POST activity, query back, verify presence
- **Expected**: Activity appears in filtered results

### 3. Multi-Tenant Isolation (GAP-9) ✅
- **Validates**: Activities are isolated by organization
- **Tests**: Create for org1, query with org2
- **Expected**: org2 sees empty results (no leakage)

### 4. Boredom Activity Filtering (GAP-9) ✅
- **Validates**: Boredom activities filtered by org/project
- **Tests**: Fetch boredom activities with filter
- **Expected**: All results match filter criteria

### 5. Type Preservation (Phase 1) ✅
- **Validates**: Data types preserved through JSON serialization
- **Tests**: POST with int/bool/float, GET back, compare types
- **Expected**: Types exactly match (int stays int, not string)

### 6. Pydantic Validation (Phase 1) ✅
- **Validates**: Invalid data rejected by API
- **Tests**: POST with wrong types (string instead of int)
- **Expected**: HTTP 400/422 with validation error

### 7. Random Data Integrity (Phase 1) ✅
- **Validates**: Complex data structures preserved end-to-end
- **Tests**: Generate random nested data, POST, GET, compare
- **Expected**: Exact field-by-field match

## Usage

### Prerequisites

```bash
# Install dependencies
pip install aiohttp

# Ensure RPC API is running
kubectl get pods -n metabob | grep metabob-rpc-api
```

### Running Tests

```bash
# From repository root
python tests/validation-harnesses/e2e-activity-lifecycle-validation.py

# Or from within devbob pod (if needed)
kubectl exec -it -n metabob deployment/devbob -- \
  python /workspace/tests/validation-harnesses/e2e-activity-lifecycle-validation.py
```

### Expected Output

```
================================================================================
Activity Lifecycle E2E Validation Harness
================================================================================

Target: http://api.metabob.local
API Key: test-api-k...

Running tests...
--------------------------------------------------------------------------------
Running: Test 1: Dynamic Creation Trigger... ✅ PASS
Running: Test 2: Activity Storage... ✅ PASS
Running: Test 3: Multi-Tenant Isolation... ✅ PASS
Running: Test 4: Boredom Activity Filtering... ✅ PASS
Running: Test 5: Type Preservation... ✅ PASS
Running: Test 6: Pydantic Validation... ✅ PASS
Running: Test 7: Random Data Integrity... ✅ PASS

================================================================================
SUMMARY
================================================================================
Tests Passed: 7/7 (100.0%)

✅ ALL TESTS PASSED - System validated!
```

## Current Status

### ✅ Implemented (Ready for Testing)
- GAP-1: Dynamic creation trigger
- GAP-9: Multi-tenant scoping
- Phase 1: Impulse binding foundation
- Phase 1: Type safety (TypedDict definitions)
- Phase 1: Pydantic models for validation

### ⏳ Needs Deployment
- **Current Blocker**: RPC API pod running old Docker image
- **Fix**: Need to rebuild Docker image with latest commits
  - metabob-rpc-api@306b1a4 (Phase 1 + GAP-9 changes)
  - Includes: async/await fixes, new impulse types, multi-tenant scoping

### ❌ Not Yet Implemented (Next Phase)
- GAP-3: Pattern extraction service
- GAP-5: Boredom activity types (split/merge/debug)
- GAP-6: Activity evolution logic
- GAP-10: Periodic scheduling mechanism

## Troubleshooting

### Test Failures

#### Connection Errors
```
Error: aiohttp.ClientConnectorError: Cannot connect to host api.metabob.local
```
**Fix**: Ensure RPC API pod is running and accessible
```bash
kubectl port-forward -n metabob svc/metabob-rpc-api 8080:8080
# Then update API_BASE_URL to http://localhost:8080
```

#### 404 Not Found
```
Error: API returned 404: endpoint not found
```
**Fix**: Old code deployed without Phase 1 endpoints. Redeploy with latest image:
```bash
cd repos/platform/metabob-apps
./deploy.sh -s metabob-rpc-api -m
```

#### Type Mismatches (Test 5 fails)
```
Error: Type mismatches: int_field: expected int, got str
```
**Indicates**: JSON serialization not preserving types
**Fix**: Check Pydantic models in `metabob-rpc-api/server/routes/impulse.py`

#### Isolation Breach (Test 3 fails)
```
Error: Activity leaked to org2 (isolation breach!)
```
**CRITICAL**: Multi-tenant isolation broken!
**Fix**: Check query filters in `metabob-rpc-api/server/routes/activity.py`

### Debugging

Enable verbose output:
```python
# Edit e2e-activity-lifecycle-validation.py
import logging
logging.basicConfig(level=logging.DEBUG)
```

Check API logs:
```bash
kubectl logs -n metabob -l app=metabob-rpc-api --tail=100 -f
```

## Architecture Validation

This harness validates the **architecture boundaries** defined in:
- `ARCHITECTURE_BOUNDARIES_metabob-cli-mcp-backend-communication.md`
- `ARCHITECTURE_SCOPE_ISOLATION_BOUNDARIES.md`

### Boundary 1: TypeScript ↔ Python (MCP)
- **Validated by**: Tests serialize data via JSON
- **Key Point**: TypedDict return types in metabob-cli
- **Evidence**: Test 5 (Type Preservation)

### Boundary 2: Python ↔ FastAPI (HTTP/JSON)
- **Validated by**: Tests make direct HTTP calls
- **Key Point**: Pydantic models validate input
- **Evidence**: Test 6 (Pydantic Validation)

### Boundary 3: FastAPI ↔ SurrealDB
- **Validated by**: Tests query backend storage
- **Key Point**: Multi-tenant scoping enforced
- **Evidence**: Test 3 (Multi-Tenant Isolation)

## Next Steps

### After Validation Passes (7/7)

1. **Deploy to Production** (if needed)
   ```bash
   cd repos/platform/metabob-apps
   ./deploy.sh -e production -s metabob-rpc-api -m -v
   ```

2. **Implement Remaining Gaps** (Priority: CRITICAL → HIGH → MEDIUM)
   - GAP-3: Pattern extraction service
   - GAP-10: Periodic boredom activity scheduler
   - GAP-5: Boredom activity types
   - GAP-6: Activity evolution logic
   - GAP-7: Replay comparison
   - GAP-8: Auto-promotion of better variants

3. **Create Follow-Up Validation Harnesses**
   - Pattern extraction validation
   - Boredom activity generation validation
   - Evolution logic validation

## References

- **Implementation Summary**: `PHASE1_COMPLETION_SUMMARY_dynamic-task-generation-impulse-binding.md`
- **Validation Plan**: `ACTIVITY_LIFECYCLE_VALIDATION_PLAN.md`
- **Architecture**: `ARCHITECTURE_BOUNDARIES_metabob-cli-mcp-backend-communication.md`
- **Commit History**: metabob-rpc-api@306b1a4, metabob-cli@aa799fa54

---

**Last Updated**: March 8, 2026  
**Status**: Ready for execution (pending deployment)  
**Expected Result**: 7/7 tests pass (100%)
