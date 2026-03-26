# RPC API 0.17.0 Access Point Audit

**Date**: 2026-03-05  
**Version**: 0.17.0 (pushed to origin/main, commit fd6efd2)  
**Deployed**: metabob-rpc-api:cloud-auth-fix-v4 (functional code identical to 0.17.0)

## Executive Summary

Tested 5 critical metabob-cli access points against the deployed RPC API. Found:
- **1 HIGH severity bug**: Schema validation conflict in dashboard endpoint
- **1 missing route**: POST /api/v1/learning-loop/impulse-mappings not implemented
- **2 working endpoints**: Template metrics and learning loop executions
- **1 expected failure**: Authentication endpoint (requires JWT setup)

## Test Results

### ✅ Test 2: GET /api/template/{template_id}/metrics - **WORKING**
**Actual Route**: `/api/v1/learning-loop/templates/{template_id}/metrics`

```bash
curl http://localhost:8081/api/v1/learning-loop/templates/add-feature-complete/metrics
```

**Response**:
```json
{
  "stable": {
    "template_id": "add-feature-complete",
    "executions": 0,
    "success_rate": 0.0,
    "avg_cost": 0.0,
    "avg_duration": 0.0
  },
  "candidates": []
}
```

**Status**: ✅ Endpoint exists and returns proper structure  
**Location**: `repos/metabob-rpc-api/server/routes/learning_loop.py:489`  
**Function**: `get_template_metrics()`

---

### ✅ Test 3: POST /api/v1/learning-loop/executions - **WORKING**
```bash
curl -X POST http://localhost:8081/api/v1/learning-loop/executions \
  -H "Content-Type: application/json" \
  -d '{
    "activity_id": "act_test_001",
    "template_id": "add-feature-complete",
    "duration_ms": 300000,
    "success": true,
    "tokens_input": 5000,
    "tokens_output": 2000,
    "tokens_cache": 1000,
    "cost_usd": 0.05
  }'
```

**Response**:
```json
{
  "success": true,
  "execution_id": "act_test_001",
  "metrics_updated": true
}
```

**Status**: ✅ Endpoint works with correct schema  
**Location**: `repos/metabob-rpc-api/server/routes/learning_loop.py:289`  
**Function**: `record_execution()`  
**Schema**: `ExecutionRequest` - requires `activity_id`, optional `template_id`

---

### ❌ Test 1: POST /v2/activities/executions - **SCHEMA BUG (HIGH SEVERITY)**

```bash
curl -X POST http://localhost:8081/v2/activities/executions \
  -H "Content-Type: application/json" \
  -d '{
    "activity_id": "test_activity_001",
    "template_id": "add-feature-complete",
    "started_at": "2026-03-05T09:30:00Z",
    "duration_ms": 300000,
    "success": true,
    "tokens": {"input": 5000, "output": 2000, "cache": 1000},
    "cost_usd": 0.05
  }'
```

**Response**:
```json
{
  "error": "Invalid execution_data: 1 validation error for ExecutionResultData\nvariant_id\n  Field required [type=missing, input_value={...}, input_type=dict]"
}
```

**Status**: ❌ **HIGH SEVERITY BUG** - Schema validation doesn't match implementation  
**Location**: `repos/metabob-rpc-api/server/routes/activity.py:318`  
**Function**: `record_activity_execution()`

**Root Cause**:
The endpoint has a **dual purpose** (line 326-328 comments):
1. Persist execution to SurrealDB for dashboard (needs `template_id`)
2. Update Thompson Sampling metrics (needs `variant_id`)

But the implementation at lines 372-459:
- Validates required fields manually (line 378-391): expects `template_id`
- Calls `insert_execution()` (line 422): uses `template_id` parameter
- Tries to update Thompson Sampling (line 448): expects `variant_id`

**The Bug**: Lines 372-391 validate for `template_id`, but some earlier code must be validating against `ExecutionResultData` which requires `variant_id`.

**Fix Required**: Remove ExecutionResultData validation or make it optional for this endpoint, since dashboard writes don't need `variant_id`.

---

### ❌ Test 4: POST /api/v1/learning-loop/impulse-mappings - **ROUTE MISSING**

```bash
curl -X POST http://localhost:8081/api/v1/learning-loop/impulse-mappings \
  -H "Content-Type: application/json" \
  -d '{
    "impulse_id": "test_impulse_001",
    "activity_id": "test_activity_001",
    "template_id": "add-feature-complete",
    "usage_count": 1
  }'
```

**Response**:
```json
{
  "detail": "Method Not Allowed"
}
```

**Status**: ❌ Route not implemented  
**Available**: Only `GET /api/v1/learning-loop/impulse-mappings` exists (line 955 in learning_loop.py)  
**Missing**: POST handler for recording impulse mappings

**Related Endpoints**:
- `POST /api/v1/learning-loop/record-turn` (line 857) - Records turn-level learning with impulses
- `GET /api/v1/learning-loop/impulse-mappings` (line 955) - Queries existing mappings

**Fix Required**: Either:
1. Add POST endpoint for direct impulse mapping records
2. OR Document that clients should use `POST /api/v1/learning-loop/record-turn` instead

**Recommendation**: Use `/record-turn` endpoint - it's more comprehensive and processes impulses automatically.

---

### ⚠️ Test 5: GET /auth/orgs/{org_id}/activity - **NOT AUTHENTICATED (EXPECTED)**

```bash
curl http://localhost:8081/auth/orgs/test_org_001/activity
```

**Response**:
```json
{
  "error": "Not authenticated"
}
```

**Status**: ⚠️ Expected failure - endpoint requires JWT authentication  
**Location**: `repos/metabob-rpc-api/server/routes/cloud_auth.py`  
**Function**: `get_organization_activity()`

**To Test Properly**:
1. Authenticate via `/auth/login` to get JWT token
2. Pass token as `Authorization: Bearer {token}` header
3. Then test organization activity endpoint

**Known Issue**: Authentication has SurrealDB query format bugs (result[0] vs result[0][0]) mentioned in session summary.

---

## Endpoint Consolidation Recommendations

### Current Confusion: 2 Execution Recording Endpoints

**Problem**: Two different endpoints for recording executions with different schemas:

| Endpoint | Schema | Purpose | Status |
|----------|--------|---------|--------|
| POST /v2/activities/executions | Needs `template_id` + `variant_id` | Dashboard Activity History | ❌ Schema bug |
| POST /api/v1/learning-loop/executions | Needs `activity_id`, optional `template_id` | Learning Loop + Metrics | ✅ Works |

**Recommendation**: 
- **Fix `/v2/activities/executions`** to NOT require `variant_id` (dashboard doesn't need it)
- **OR Deprecate** `/v2/activities/executions` and route all execution recording through `/api/v1/learning-loop/executions`
- Update learning_loop endpoint to ALSO write to dashboard tables (already writes to SurrealDB activity_execution)

### Field Name Inconsistency

**Problem**: `template_id` vs `variant_id` used interchangeably

**Occurrences**:
- `/v2/activities/executions` expects both (unclear why)
- `/v2/activities/templates` uses `variant_id` as primary key
- `/api/v1/learning-loop/executions` uses `template_id`
- SurrealDB `activity_execution` table uses `template_id` (line 81 in activity_execution.py)

**Recommendation**:
- **Database**: Always use `template_id` (it's the template identifier)
- **API**: Accept both `template_id` and `variant_id` as aliases
- **Internal**: Use `template_id` consistently
- **Genealogy**: Use `variant_id` only in ActivityVariant proto for variant relationships

---

## Critical Fixes Required

### 1. Fix POST /v2/activities/executions Schema Validation (HIGH PRIORITY)

**File**: `repos/metabob-rpc-api/server/routes/activity.py`  
**Line**: 318-459

**Current Code** (problematic):
```python
@router.post("/executions", status_code=201)
async def record_activity_execution(
    execution_data: Dict[str, Any],  # No schema validation here
    redis: StrictRedis = Depends(get_redis_connection),
) -> Dict[str, Any]:
    # ... validates manually for template_id
    # ... but Thompson Sampling update expects variant_id
```

**Fix Option 1** (Quick Fix - Recommended):
```python
@router.post("/executions", status_code=201)
async def record_activity_execution(
    execution_data: Dict[str, Any],
    redis: StrictRedis = Depends(get_redis_connection),
) -> Dict[str, Any]:
    """
    Record activity execution to SurrealDB for Dashboard Activity History.
    
    Note: variant_id is optional - if provided, updates Thompson Sampling.
    """
    # ... existing validation for template_id (line 378-391)
    
    # Also update Thompson Sampling if variant_id provided
    try:
        variant_id = execution_data.get("variant_id")
        if variant_id:
            await record_execution_result(redis, execution_data)
        else:
            logger.info("No variant_id provided, skipping Thompson Sampling update")
    except Exception as e:
        logger.warning(f"Thompson Sampling update failed (non-critical): {e}")
```

**Fix Option 2** (Clean Architecture - Recommended Long-term):
Remove `/v2/activities/executions` and route all execution recording through `/api/v1/learning-loop/executions` which already:
- Writes to SurrealDB `activity_execution` table (line 215)
- Updates template_metrics (line 235-243)
- Records failure patterns (line 246-253)
- Creates impulse usage records (line 256-277)
- Uses correct schema with `activity_id` + optional `template_id`

**Migration Path**:
1. Update dashboard to poll from `activity_execution` table (already done)
2. Update metabob-cli to call `/api/v1/learning-loop/executions` instead
3. Deprecate `/v2/activities/executions` with 30-day sunset notice
4. Remove deprecated endpoint after migration complete

### 2. Add POST /api/v1/learning-loop/impulse-mappings OR Document Alternative (MEDIUM PRIORITY)

**Option A**: Add missing POST endpoint
```python
@router.post("/impulse-mappings", response_model=ImpulseMappingResponse, status_code=201)
async def create_impulse_mapping(
    request: ImpulseMappingCreateRequest
) -> ImpulseMappingResponse:
    """
    Create impulse mapping record directly.
    
    For most use cases, prefer POST /record-turn which handles impulses automatically.
    """
    # Implementation
```

**Option B**: Document that clients should use `/record-turn` (RECOMMENDED)

Update API documentation to clarify:
- `POST /api/v1/learning-loop/record-turn` - Use this for turn-level learning (includes impulses)
- `GET /api/v1/learning-loop/impulse-mappings` - Query existing mappings
- No direct POST for impulse mappings - use `/record-turn` instead

### 3. Fix Authentication SurrealDB Query Bugs (MEDIUM PRIORITY)

**Known Issue** (from session summary):
> Authentication returns 401 due to SurrealDB query format mismatches (result[0] vs result[0][0])

**Files to Check**:
- `repos/metabob-rpc-api/server/routes/cloud_auth.py`
- `repos/metabob-rpc-api/server/db/operations/*.py`

**Pattern to Fix**:
```python
# WRONG
result = await db.query("SELECT * FROM users WHERE email = $email", {"email": email})
user = result[0][0]  # Incorrect - assumes result is [[{...}]]

# CORRECT
result = await db.query("SELECT * FROM users WHERE email = $email", {"email": email})
user = result[0] if result else None  # result is [{...}]
```

---

## Testing Checklist

Once fixes are applied:

- [ ] POST /v2/activities/executions accepts `template_id` without `variant_id`
- [ ] POST /v2/activities/executions writes to SurrealDB activity_execution table
- [ ] POST /v2/activities/executions optionally updates Thompson Sampling if `variant_id` provided
- [ ] POST /api/v1/learning-loop/executions works with full schema
- [ ] GET /api/v1/learning-loop/templates/{id}/metrics returns metrics
- [ ] POST /api/v1/learning-loop/record-turn handles impulse learning
- [ ] GET /api/v1/learning-loop/impulse-mappings queries mappings
- [ ] Authentication flow works end-to-end (login → JWT → protected endpoints)
- [ ] GET /auth/orgs/{org_id}/activity returns activity timeline with JWT
- [ ] All endpoints use consistent field names (`template_id` preferred)

---

## Deployment Status

### Git Status
- **Commit**: fd6efd2 (version bump to 0.17.0)
- **Branch**: main
- **Remote**: Pushed to origin/main ✅
- **Tag**: v0.17.0 created and pushed ✅

### Kubernetes Status
- **Current Image**: metabob-rpc-api:cloud-auth-fix-v4
- **Functional Code**: Identical to 0.17.0 (only version numbers differ)
- **Running Pod**: metabob-rpc-api-99795f9c5-sf79z (1/1 Running)
- **Port Forward**: localhost:8081 → service:8080

### Next Steps
1. Apply schema fixes to `activity.py` and `learning_loop.py`
2. Test all 5 access points with corrected payloads
3. Build proper 0.17.0 Docker image with fixes
4. Deploy to k8s with `kubectl set image` or Helm upgrade
5. Verify dashboard activity history works end-to-end
6. Document final API contracts for metabob-cli integration

---

## Metabob-CLI Integration Impact

### Current metabob-cli MCP Tools
Based on the test payloads, metabob-cli likely has these MCP tools:

1. **`metabob_record_activity_execution`**
   - Currently calling: `/v2/activities/executions` ❌ (broken)
   - Should call: `/api/v1/learning-loop/executions` ✅ (works)
   - Schema: `ExecutionRequest` with `activity_id` + optional `template_id`

2. **`metabob_get_template_metrics`**
   - Currently calling: `/api/template/{id}/metrics` ❌ (wrong path)
   - Should call: `/api/v1/learning-loop/templates/{id}/metrics` ✅
   - Works correctly

3. **`metabob_record_thompson_sampling`**
   - Currently calling: `/api/v1/learning-loop/executions` ✅
   - Works correctly

4. **`metabob_record_impulse_mapping`**
   - Currently calling: `/api/v1/learning-loop/impulse-mappings` ❌ (POST not implemented)
   - Should call: `/api/v1/learning-loop/record-turn` ✅ (works, more comprehensive)

5. **`metabob_get_organization_activity`**
   - Currently calling: `/auth/orgs/{org_id}/activity` ⚠️
   - Requires JWT authentication setup first
   - Works once authenticated

### Recommended metabob-cli Updates

**High Priority**:
1. Update `metabob_record_activity_execution` to call `/api/v1/learning-loop/executions`
2. Update `metabob_get_template_metrics` to use correct path `/api/v1/learning-loop/templates/{id}/metrics`

**Medium Priority**:
3. Replace `metabob_record_impulse_mapping` with `metabob_record_turn_learning`
4. Add JWT authentication flow for dashboard endpoints

**Low Priority**:
5. Consolidate execution recording to single MCP tool (avoid duplication)

---

## Success Metrics

**Definition of Done**:
- ✅ All 5 access points return 200 OK (or 401 with auth, which is expected)
- ✅ Executions persist to SurrealDB activity_execution table
- ✅ Template metrics update correctly after executions
- ✅ Thompson Sampling parameters update (if variant_id provided)
- ✅ Impulse learning records created via /record-turn
- ✅ Dashboard activity timeline loads from cache-aside pattern
- ✅ No HIGH severity schema validation bugs
- ✅ Field naming consistent (`template_id` everywhere)
- ✅ Docker image 0.17.0 built and deployed to k8s
- ✅ metabob-cli MCP tools updated to use correct endpoints

**Current Status**: 2/5 endpoints working, 1 HIGH bug, 1 missing route, 1 auth setup needed
