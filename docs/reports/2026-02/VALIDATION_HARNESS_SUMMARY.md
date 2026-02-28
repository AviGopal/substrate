# Validation Harness: Instance-Invariant Storage - Missing Backend API Endpoints

**Specification**: Instance-Invariant Storage - Missing Backend API Endpoints

**Harness File**: `tests/validation-harnesses/instance-invariant-storage-missing-backend-api-endpoints-harness.ts`

**Created**: 2026-02-27

---

## Overview

This validation harness tests the newly implemented backend API endpoints for activity storage. It verifies that:

1. ✅ POST /v2/activities endpoint exists and works correctly
2. ✅ GET /v2/activities/{id} endpoint exists and works correctly
3. ✅ Cross-instance activity retrieval maintains data consistency
4. ✅ Multi-tenant isolation (api_key scoping) is enforced
5. ✅ Project isolation (project_id scoping) is enforced
6. ✅ Error handling works correctly (duplicate activities return 400)

---

## Test Cases

### Test Case 1: POST /v2/activities Endpoint Works

**Impulse ID**: `validation-instance-invariant-storage-missing-backend-api-endpoints-case-1`

**What It Tests**:
- POST endpoint exists at /v2/activities
- Returns 201 Created status
- Response includes activity_id, api_key, project_id
- Activity data is stored in SurrealDB

**Input**:
```json
{
  "endpoint": "/v2/activities",
  "method": "POST",
  "body": {
    "activity_id": "test-activity-{timestamp}-1",
    "project_id": "test_project_alpha",
    "activity_data": {
      "id": "test-activity-{timestamp}-1",
      "template": "test-template",
      "status": "running",
      "tasks": []
    }
  }
}
```

**Expected Output**:
- Status: 201
- Response contains activity_id, api_key, project_id, created_at, updated_at

---

### Test Case 2: GET /v2/activities/{id} Endpoint Works

**Impulse ID**: `validation-instance-invariant-storage-missing-backend-api-endpoints-case-2`

**What It Tests**:
- GET endpoint exists at /v2/activities/{id}
- Returns 200 OK status
- Retrieved data matches stored data exactly
- project_id query parameter is required

**Input**:
```json
{
  "endpoint": "/v2/activities/{activity_id}?project_id=test_project_alpha",
  "method": "GET",
  "headers": {
    "X-API-Key": "test_api_key_instance_a"
  }
}
```

**Expected Output**:
- Status: 200
- Data integrity: retrieved activity_data === stored activity_data

---

### Test Case 3: Cross-Instance Activity Retrieval

**Impulse ID**: `validation-instance-invariant-storage-missing-backend-api-endpoints-case-3`

**What It Tests**:
- Activity stored in Instance A can be retrieved from Instance B
- Same (api_key, project_id) credentials work across instances
- Data consistency is maintained

**Scenario**:
1. Instance A: POST /v2/activities (store activity)
2. Simulate network delay (100ms)
3. Instance B: GET /v2/activities/{id} (retrieve activity)
4. Verify data matches exactly

**Expected Output**:
- Store status: 201
- Retrieve status: 200
- Data match: true

---

### Test Case 4: Multi-Tenant Isolation (api_key Scoping)

**Impulse ID**: `validation-instance-invariant-storage-missing-backend-api-endpoints-case-4`

**What It Tests**:
- Activities are isolated by api_key
- Tenant 2 cannot access Tenant 1's data
- Returns 404 when api_key doesn't match

**Scenario**:
1. Tenant 1 (api_key_1): POST /v2/activities (store activity)
2. Tenant 2 (api_key_2): GET /v2/activities/{id} with api_key_2
3. Verify Tenant 2 gets 404 (not found)

**Expected Output**:
- Store status: 201
- Retrieve status: 404 (tenant isolation enforced)

---

### Test Case 5: Project Isolation (project_id Scoping)

**Impulse ID**: `validation-instance-invariant-storage-missing-backend-api-endpoints-case-5`

**What It Tests**:
- Activities are isolated by project_id
- Project 2 cannot access Project 1's data (even with same api_key)
- Returns 404 when project_id doesn't match

**Scenario**:
1. Project 1: POST /v2/activities with project_id=alpha
2. Try GET with project_id=beta (same api_key)
3. Verify request gets 404 (not found)

**Expected Output**:
- Store status: 201
- Retrieve status: 404 (project isolation enforced)

---

### Test Case 6: Duplicate Activity Returns 400

**Impulse ID**: `validation-instance-invariant-storage-missing-backend-api-endpoints-case-6`

**What It Tests**:
- Creating duplicate activity returns 400 Bad Request
- Error message explains the conflict
- First creation succeeds, second fails

**Scenario**:
1. POST /v2/activities with activity_id=X (should succeed with 201)
2. POST /v2/activities with activity_id=X again (should fail with 400)

**Expected Output**:
- First create status: 201
- Second create status: 400 (conflict)

---

## Running the Harness

### Prerequisites

1. **Backend running**: rpc-api must be running on `http://localhost:8000`
2. **SurrealDB running**: Database must be accessible
3. **Endpoints implemented**: POST and GET /v2/activities must exist
4. **Node.js + TypeScript**: Runtime environment for harness

### Command

```bash
cd tests
npx tsx validation-harnesses/instance-invariant-storage-missing-backend-api-endpoints-harness.ts
```

### Expected Output

```
🧪 Running Validation: Instance-Invariant Storage - Missing Backend API Endpoints

Running: testCase1_PostActivityEndpointWorks...
✅ PASS: POST /v2/activities endpoint works

Running: testCase2_GetActivityEndpointWorks...
✅ PASS: GET /v2/activities/{id} endpoint works

Running: testCase3_CrossInstanceActivityRetrieval...
✅ PASS: Cross-instance activity retrieval

Running: testCase4_MultiTenantIsolation...
✅ PASS: Multi-tenant isolation (api_key scoping)

Running: testCase5_ProjectIsolation...
✅ PASS: Project isolation (project_id scoping)

Running: testCase6_DuplicateActivityReturns400...
✅ PASS: Duplicate activity returns 400

======================================================================
📊 VALIDATION SUMMARY: 6/6 tests passed
Overall Status: ✅ PASS
======================================================================
```

### Estimated Run Time

5-10 seconds (all tests are automated HTTP requests)

---

## Architecture

### Non-LLM Validation

This harness is **fully automated** and requires **no LLM interaction**:

- ✅ Deterministic: Same input → same output
- ✅ Fast: Completes in seconds
- ✅ Repeatable: Can be run in CI/CD
- ✅ Self-contained: No external dependencies beyond backend

### Test Isolation

Each test case:
- Uses unique activity IDs (timestamp-based)
- Cleans up after itself (where possible)
- Can run independently
- Reports detailed diagnostics on failure

### Error Reporting

On failure, each test provides:
- Expected vs actual comparison
- HTTP status codes
- Response bodies
- Diagnostic information
- Clear error messages

---

## Integration with Enforcement

This harness validates the changes made during enforcement:

| Enforcement Change | Test Case(s) Validating It |
|--------------------|----------------------------|
| Created activity_data.py | All tests (indirectly, enables endpoints) |
| POST /v2/activities endpoint | Test 1, 3, 4, 5, 6 |
| GET /v2/activities/{id} endpoint | Test 2, 3, 4, 5 |
| (api_key, project_id) scoping | Test 4, 5 |
| Error handling (400 on duplicate) | Test 6 |

---

## Impulse Metadata

- **Harness Impulse ID**: `harness-instance-invariant-storage-missing-backend-api-endpoints`
- **Type**: `file`
- **Pointer**: `tests/validation-harnesses/instance-invariant-storage-missing-backend-api-endpoints-harness.ts`
- **Budget**: 2000 tokens
- **Purpose**: Automated validation of backend endpoint implementation

---

## Success Criteria

All 6 tests must pass for the specification to be considered fully validated:

1. ✅ POST endpoint works (201 created)
2. ✅ GET endpoint works (200 ok, data match)
3. ✅ Cross-instance retrieval works (consistency)
4. ✅ Multi-tenant isolation enforced (404 on wrong api_key)
5. ✅ Project isolation enforced (404 on wrong project_id)
6. ✅ Error handling correct (400 on duplicate)

**Current Status**: Ready for execution (endpoints implemented in enforcement phase)

---

## Maintenance

### Updating Test Cases

To add new test cases:

1. Create `testCaseN_Description()` function
2. Add to `testCases` array in `runValidation()`
3. Create corresponding impulse with test inputs/outputs
4. Update this documentation

### Changing Configuration

Backend URL and test credentials can be overridden via environment variables:

```bash
export METABOB_RPC_URL=http://production-backend:8000
export TEST_API_KEY_1=real_api_key_1
export TEST_API_KEY_2=real_api_key_2
npx tsx validation-harnesses/instance-invariant-storage-missing-backend-api-endpoints-harness.ts
```

---

## Related Documents

- Trace Analysis: `trace-Instance-Invariant-Storage-Missing-Backend-API-Endpoints.md`
- Enforcement Summary: `ENFORCEMENT_SUMMARY_Instance_Invariant_Storage.md`
- Original Specification: `invariant-storage-across-instances-with-vessel-flow`
