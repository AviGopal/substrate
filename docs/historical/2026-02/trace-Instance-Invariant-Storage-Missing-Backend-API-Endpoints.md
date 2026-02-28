# Trace Analysis: Instance-Invariant Storage - Missing Backend API Endpoints

**Specification**: Instance-Invariant Storage - Missing Backend API Endpoints

**Status**: 🔴 CRITICAL GAPS IDENTIFIED

**Executed**: 2026-02-27

---

## Executive Summary

**Problem**: CLI MCP tools (`metabob_activity_save`, `metabob_activity_load`) are implemented correctly but return 404 errors because the backend rpc-api endpoints they call **DO NOT EXIST**.

**Impact**: 
- Activity storage fails (404 on POST /v2/activities)
- Cross-instance retrieval fails (404 on GET /v2/activities/{id})
- 4 out of 6 validation tests are blocked

**Root Cause**: First pass implementation only added CLI MCP tools but skipped the backend endpoints and database operations.

**Solution**: Add 2 missing backend endpoints and 1 missing database operations file (90 minutes estimated effort).

---

## Components Analysis

### 1. ❌ CRITICAL: Missing Backend Endpoints

**File**: `repos/metabob-rpc-api/server/routes/activity.py`

**Current State**:
- ✅ Has `/v2/activities/templates/*` endpoints (lines 43-385)
- ✅ Has `/v2/activities/content` endpoint (line 392)
- ✅ Has `/v2/activities/tasks` endpoints (lines 471-614)
- ❌ MISSING: `POST /v2/activities` for activity storage
- ❌ MISSING: `GET /v2/activities/{id}` for activity retrieval

**Gap**: Need to add 2 new route handlers after line 615.

**Reference Implementation**: `repos/metabob-rpc-api/server/routes/impulse.py` lines 64-169
- POST /v2/impulses (line 64) → Copy as template
- GET /v2/impulses/{id} (line 129) → Copy as template

---

### 2. ❌ CRITICAL: Missing Database Operations

**File**: `repos/metabob-rpc-api/server/db/operations/activity_data.py`

**Current State**: FILE DOES NOT EXIST

**Gap**: Need to create complete CRUD operations file.

**Required Functions**:
```python
def create_activity(activity_id, api_key, project_id, activity_data) -> Dict
def get_activity(activity_id, api_key, project_id) -> Optional[Dict]
def list_activities(api_key, project_id, limit, offset) -> List[Dict]
def update_activity(activity_id, api_key, project_id, activity_data) -> Optional[Dict]
def delete_activity(activity_id, api_key, project_id) -> bool
```

**Reference Implementation**: `repos/metabob-rpc-api/server/db/operations/impulse_data.py`
- Complete file can be copied and "impulse" replaced with "activity"
- Uses SurrealDB with (api_key, project_id) scoping for multi-tenant isolation

---

### 3. ✅ CORRECT: CLI MCP Tools

**File**: `repos/metabob-cli/src/metabob_cli/mcp/tools.py`

**Components**:
- ✅ `metabob_activity_save` (line 5595): Calls `POST {base_url}/v2/activities`
- ✅ `metabob_activity_load` (line 5684): Calls `GET {base_url}/v2/activities/{id}`

**Status**: Both tools implemented correctly. Just waiting for backend endpoints to exist.

---

### 4. ✅ REFERENCE: Impulse Endpoints (Working Example)

**File**: `repos/metabob-rpc-api/server/routes/impulse.py`

**Status**: COMPLETE - Use as template for activity endpoints

**Endpoints**:
- ✅ POST /v2/impulses (line 64)
- ✅ GET /v2/impulses/{id} (line 129)
- ✅ GET /v2/impulses (line 171)
- ✅ PUT /v2/impulses/{id} (line 223)
- ✅ DELETE /v2/impulses/{id} (line 288)

**Pattern**: All use (api_key, project_id) scoping via X-API-Key header and project_id query param.

---

## Data Flow Trace

### Impulse Storage (✅ WORKING)
```
opencode impulse-create.ts:85-87
  → MCP.clients()['metabob']
  → metabob_impulse_store
  → POST /v2/impulses [EXISTS ✅]
  → impulse_data.py create_impulse() [EXISTS ✅]
  → SurrealDB impulse_data table
```

### Activity Storage (❌ BROKEN - 404)
```
opencode activity.ts:677-684
  → MCP.clients()['metabob']
  → metabob_activity_save
  → POST /v2/activities [MISSING 404 ❌]
  → activity_data.py create_activity() [MISSING ❌]
  → SurrealDB activity_data table
```

### Activity Retrieval (❌ BROKEN - 404)
```
opencode activity.ts:504-513
  → MCP.clients()['metabob']
  → metabob_activity_load
  → GET /v2/activities/{id} [MISSING 404 ❌]
  → activity_data.py get_activity() [MISSING ❌]
  → SurrealDB activity_data table
```

---

## Implementation Plan

### Step 1: Create activity_data.py (30 minutes)

**File**: `repos/metabob-rpc-api/server/db/operations/activity_data.py`

**Action**:
1. Copy `impulse_data.py` (312 lines)
2. Global replace: `impulse` → `activity`
3. Replace field names: `impulse_id` → `activity_id`
4. Replace table name: `impulse_data` → `activity_data`
5. Update docstrings

**Template**:
```python
def create_activity(
    activity_id: str,
    api_key: str,
    project_id: str,
    activity_data: Dict[str, Any],
) -> Dict[str, Any]:
    """Create activity with (api_key, project_id) scoping."""
    db = get_surreal_client()
    data = {
        "activity_id": activity_id,
        "api_key": api_key,
        "project_id": project_id,
        "activity_data": activity_data,
        "created_at": datetime.utcnow().isoformat(),
        "updated_at": datetime.utcnow().isoformat(),
    }
    result = db.create("activity_data", data)
    return result
```

---

### Step 2: Add Activity Storage Endpoints (45 minutes)

**File**: `repos/metabob-rpc-api/server/routes/activity.py`

**Action**: Add after line 615 (after task execution endpoints)

**Models to Add** (after line 40):
```python
from pydantic import BaseModel, Field

class ActivityCreateRequest(BaseModel):
    activity_id: str = Field(..., description="Unique activity identifier")
    project_id: str = Field(..., description="Project identifier")
    activity_data: dict = Field(..., description="Full activity object")

class ActivityResponse(BaseModel):
    activity_id: str
    api_key: str
    project_id: str
    activity_data: dict
    created_at: str
    updated_at: str
```

**Endpoint 1: POST /v2/activities** (after line 615):
```python
@router.post("/", response_model=ActivityResponse, status_code=201)
async def create_activity_endpoint(
    request: ActivityCreateRequest,
    x_api_key: str = Header(..., alias="X-API-Key"),
):
    """Store activity with (api_key, project_id) scoping."""
    from server.db.operations.activity_data import create_activity
    
    try:
        result = create_activity(
            activity_id=request.activity_id,
            api_key=x_api_key,
            project_id=request.project_id,
            activity_data=request.activity_data,
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
```

**Endpoint 2: GET /v2/activities/{id}**:
```python
@router.get("/{activity_id}", response_model=ActivityResponse)
async def get_activity_endpoint(
    activity_id: str,
    project_id: str = Query(..., description="Project identifier"),
    x_api_key: str = Header(..., alias="X-API-Key"),
):
    """Retrieve activity with (api_key, project_id) scoping."""
    from server.db.operations.activity_data import get_activity
    
    result = get_activity(activity_id, x_api_key, project_id)
    if not result:
        raise HTTPException(status_code=404, detail="Activity not found")
    return result
```

---

### Step 3: Register Operations (5 minutes)

**File**: `repos/metabob-rpc-api/server/db/operations/__init__.py`

**Action**: Add import
```python
from .activity_data import (
    create_activity,
    get_activity,
    list_activities,
    update_activity,
    delete_activity,
)
```

---

### Step 4: Validation (15 minutes)

**Command**:
```bash
cd tests
npx tsx validation-harnesses/invariant-storage-across-instances-with-vessel-flow-harness.ts
```

**Expected Result**: All 6 tests pass
- ✅ Test 1: Vessel Flow Compliance (already passing)
- ✅ Test 2: Cross-Instance Retrieval (will pass after endpoints added)
- ✅ Test 3: Multi-Tenant Isolation (will pass after endpoints added)
- ✅ Test 4: Project Isolation (will pass after endpoints added)
- ✅ Test 5: Pagination (will pass after endpoints added)
- ✅ Test 6: Backend Sync Enforcement (already passing)

---

## Validation Results (Current State)

### Current Status: 2/6 Tests Pass

| Test | Status | Reason |
|------|--------|--------|
| Test 1: Vessel Flow Compliance | ✅ PASS | No direct HTTP calls, MCP used correctly |
| Test 2: Cross-Instance Retrieval | ⏭️ SKIP | Needs POST/GET /v2/activities endpoints |
| Test 3: Multi-Tenant Isolation | ⏭️ SKIP | Needs backend with api_key scoping |
| Test 4: Project Isolation | ⏭️ SKIP | Needs backend with project_id scoping |
| Test 5: Pagination | ⏭️ SKIP | Needs GET /v2/activities list endpoint |
| Test 6: Backend Sync Enforcement | ✅ PASS | Dual-write pattern implemented |

**Pass Rate**: 2/2 runnable tests (100%), 4 blocked by missing backend

---

## Critical Findings

### Finding 1: POST /v2/activities Missing
- **Severity**: 🔴 CRITICAL
- **Impact**: `metabob_activity_save` returns 404, storage fails
- **Fix**: Add endpoint at line 616+ in activity.py

### Finding 2: GET /v2/activities/{id} Missing
- **Severity**: 🔴 CRITICAL
- **Impact**: `metabob_activity_load` returns 404, cross-instance fails
- **Fix**: Add endpoint at line 640+ in activity.py

### Finding 3: activity_data.py Missing
- **Severity**: 🔴 CRITICAL
- **Impact**: No database operations, endpoints can't work
- **Fix**: Copy impulse_data.py and rename fields

---

## Reference Locations

### Working Examples (Copy These)
- `repos/metabob-rpc-api/server/routes/impulse.py:64-169` - Endpoint patterns
- `repos/metabob-rpc-api/server/db/operations/impulse_data.py:1-312` - DB operations

### Files to Modify
- `repos/metabob-rpc-api/server/routes/activity.py` - Add endpoints after line 615
- `repos/metabob-rpc-api/server/db/operations/activity_data.py` - Create new file
- `repos/metabob-rpc-api/server/db/operations/__init__.py` - Add imports

### Validation
- `tests/validation-harnesses/invariant-storage-across-instances-with-vessel-flow-harness.ts`

---

## Estimated Effort

| Task | Time | Priority |
|------|------|----------|
| Create activity_data.py | 30 min | CRITICAL |
| Add activity.py endpoints | 45 min | CRITICAL |
| Add Pydantic models | 10 min | CRITICAL |
| Register operations | 5 min | MEDIUM |
| Run validation | 15 min | HIGH |
| **TOTAL** | **90 min** | |

---

## Summary

**What Works**:
- ✅ CLI MCP tools implemented correctly
- ✅ OpenCode integration with dual-write pattern
- ✅ Impulse endpoints as reference implementation
- ✅ Validation harness ready

**What's Missing**:
- ❌ POST /v2/activities endpoint
- ❌ GET /v2/activities/{id} endpoint
- ❌ activity_data.py database operations

**Next Action**: Copy impulse.py and impulse_data.py patterns to implement missing activity endpoints (90 minutes).

**Risk**: LOW - Reference implementation exists and works, just needs to be duplicated for activities.

---

## Impulse Metadata

- **ID**: `trace-Instance-Invariant Storage - Missing Backend API Endpoints`
- **Type**: `templateDefinition`
- **Budget**: 5000 tokens
- **Created**: 2026-02-27
- **Purpose**: Trace analysis for downstream validation and enforcement tasks
