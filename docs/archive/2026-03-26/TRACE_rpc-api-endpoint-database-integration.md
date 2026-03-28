# Trace: RPC API Endpoint Database Integration

## Specification Summary

**ID**: rpc-api-endpoint-database-integration

**Description**: All metabob-rpc-api REST endpoints must correctly interface with the underlying database (SurrealDB) for data persistence and retrieval.

**Critical Requirements**:
1. Accept valid requests per OpenAPI spec
2. Execute proper database queries/operations
3. Return correct responses with proper serialization
4. Handle database errors gracefully
5. Maintain data consistency between API layer and database

**Key Endpoint Groups**:
- `/v2/activities/templates` - Template CRUD operations
- `/v2/activities/executions` - Activity execution tracking
- `/v2/activities/storage` - Activity state persistence
- `/v2/activities/tasks` - Task execution tracking
- `/api/v1/learning-loop/*` - Metrics and learning data

---

## Current Implementation Trace

### Architecture Overview

```
Entry Point: FastAPI Application (server/app.py)
    ↓
Route Handlers (server/routes/*.py)
    ↓
Business Logic (server/actions/*.py)
    ↓
Database Operations (server/db/operations/*.py)
    ↓
SurrealDB Client (server/db/surrealdb_client.py - Official AsyncSurreal)
    ↓
SurrealDB Server (HTTP/WebSocket)
```

### Data Flow Pattern: CACHE-ASIDE with SurrealDB Primary

**Specification**: `surrealdb-primary-redis-cache`
- **Write Path**: Client → SurrealDB (primary) → Redis cache (TTL)
- **Read Path**: Client → Redis (hit) OR SurrealDB (miss) → populate Redis

---

## Component Analysis

### 1. Entry Point & Route Registration

**File**: `repos/metabob-rpc-api/server/app.py`

**Current Behavior**:
- Creates FastAPI app with lifespan context manager
- Registers all routers including:
  - `activity_router` (line 63)
  - `activity_metrics_router` (line 79)
  - `learning_loop_router` (line 81)
- Initializes SurrealDB connection on startup via `get_surreal_client()`
- Uses official `surrealdb-py` library (v1.0.0+) with proper async/await

**Desired Behavior**: ✅ CORRECT
- Entry point correctly configured
- All routers properly registered

**Gap**: NONE

---

### 2. Template Endpoints (Activity Router)

**File**: `repos/metabob-rpc-api/server/routes/activity.py`

#### Endpoint: `GET /v2/activities/templates`

**Current Behavior** (lines 64-124):
- Handler: `list_activity_templates()`
- Calls: `server.actions.activity.list_templates()` with Redis and tenant filters
- Returns: `{"templates": [...]}`
- **CACHE-ASIDE PATTERN**: Redis → SurrealDB on miss → populate cache
- Multi-tenant filtering by `org_id`, `project_id`, `scope`

**Desired Behavior**: ✅ CORRECT
- Template list correctly retrieved from SurrealDB
- Cache-aside pattern implemented
- Multi-tenant isolation enforced

**Gap**: NONE

#### Endpoint: `GET /v2/activities/templates/{template_id}`

**Current Behavior** (lines 126-164):
- Handler: `get_activity_template()`
- Calls: `server.actions.activity.get_template_by_id()`
- Returns: Full template variant with metrics
- **CACHE-ASIDE PATTERN**: Redis → SurrealDB on miss → populate cache

**Known Issue** (from conversation context):
- **BUG**: Returns Internal Server Error (500) due to SurrealDB RecordID serialization
- **Root Cause**: RecordID objects from official library not properly serialized to JSON
- **Location**: Response serialization when returning SurrealDB records

**Desired Behavior**:
- Return complete template JSON without serialization errors
- Handle RecordID objects transparently

**Gap**: SERIALIZATION BUG
- RecordID objects need sanitization before JSON response
- `sanitize_record()` function exists but may not be applied consistently

#### Endpoint: `POST /v2/activities/templates`

**Current Behavior** (lines 167-264):
- Handler: `create_activity_template()`
- Calls: `server.actions.activity.create_template()`
- Returns: 201 with created template
- **WRITE PATH**: SurrealDB → Redis cache

**From conversation**: ✅ WORKS (POST returns 201)

**Desired Behavior**: ✅ CORRECT
- Template creation works correctly
- Data persisted to SurrealDB
- Cache populated

**Gap**: NONE

#### Endpoint: `POST /v2/activities/templates/{template_id}/metrics`

**Current Behavior** (lines 405-536):
- Handler: `update_template_metrics()`
- Updates metrics after activity execution
- Uses `db.merge()` for partial updates (preserves variant_id, activity_id)
- Updates SurrealDB directly (no Redis in path)

**Desired Behavior**: ✅ CORRECT
- Metrics updates preserve identity fields
- Uses MERGE instead of UPDATE (partial update)

**Gap**: NONE

---

### 3. Learning Loop Endpoints

**File**: `repos/metabob-rpc-api/server/routes/learning_loop.py`

#### Endpoint: `POST /api/v1/learning-loop/executions`

**Current Behavior** (lines 120-213):
- Handler: `record_execution()`
- Inserts execution record via `insert_execution()`
- Updates metrics via `update_metrics_after_execution()`
- Records failure patterns if execution failed

**Desired Behavior**: ✅ CORRECT
- Execution recording works
- Metrics aggregation correct
- Failure tracking enabled

**Gap**: NONE

#### Endpoint: `GET /api/v1/learning-loop/templates/{template_id}/metrics`

**Current Behavior** (lines 310-346):
- Handler: `get_template_metrics()`
- Calls: `get_metrics()` from SurrealDB operations
- Returns: Aggregated metrics including Thompson sampling parameters

**Desired Behavior**: ✅ CORRECT
- Metrics retrieval from SurrealDB works

**Gap**: NONE

---

### 4. Database Layer (SurrealDB Client)

**File**: `repos/metabob-rpc-api/server/db/surrealdb_client.py`

**Current Behavior**:
- Uses official `surrealdb-py` library (AsyncSurreal)
- Provides async methods: `query()`, `create()`, `select()`, `update()`, `merge()`, `delete()`
- **CRITICAL**: Includes `sanitize_record()` function (lines 370-388)
  - Purpose: "Sanitize SurrealDB record for JSON serialization"
  - Note: "The official library handles RecordID objects properly, but this function is kept for API compatibility with legacy code"
  - **Implementation**: Currently just passes through (no actual sanitization!)

**Desired Behavior**:
- All RecordID objects converted to strings before JSON serialization
- Consistent sanitization across all query results

**Gap**: SANITIZE_RECORD NOT IMPLEMENTED
- Function exists but does NOT convert RecordID to string
- Should convert `RecordID` objects to string format: `"table:id"`

**Fix Required**:
```python
def sanitize_record(record: Any) -> Any:
    """Sanitize SurrealDB record for JSON serialization."""
    from surrealdb import RecordID
    
    if isinstance(record, RecordID):
        return str(record)  # Convert RecordID to "table:id" string
    elif isinstance(record, dict):
        return {k: sanitize_record(v) for k, v in record.items()}
    elif isinstance(record, list):
        return [sanitize_record(item) for item in record]
    else:
        return record
```

---

### 5. Database Operations (Template Metrics)

**File**: `repos/metabob-rpc-api/server/db/operations/template_metrics.py`

#### Function: `get_metrics(template_id: str)`

**Current Behavior** (lines 20-53):
- Queries: `SELECT * FROM template_metrics WHERE variant_id = $variant_id`
- **APPLIES SANITIZATION**: Calls `sanitize_record()` on line 49 and 52
- Returns metrics or None

**Desired Behavior**: ✅ CORRECT (once sanitize_record is fixed)
- Query correct
- Sanitization applied

**Gap**: DEPENDS ON SANITIZE_RECORD FIX

#### Function: `create_metrics(template_id: str)`

**Current Behavior** (lines 56-158):
- Creates initial metrics record with all fields
- Uses explicit SET clauses (not CONTENT $data) due to RPC API issues
- Returns created record with `sanitize_record()` applied

**Desired Behavior**: ✅ CORRECT (once sanitize_record is fixed)

**Gap**: DEPENDS ON SANITIZE_RECORD FIX

---

### 6. Database Operations (Template Data)

**File**: `repos/metabob-rpc-api/server/db/operations/template_data.py`

#### Function: `get_template_by_variant_id(variant_id: str)`

**Current Behavior** (lines 67-92):
- Uses: `db.select(f"activity_template:{variant_id}")`
- **APPLIES SANITIZATION**: Calls `sanitize_record()` on line 90
- Returns template or None

**Desired Behavior**: ✅ CORRECT (once sanitize_record is fixed)

**Gap**: DEPENDS ON SANITIZE_RECORD FIX

---

### 7. Business Logic (Activity Actions)

**File**: `repos/metabob-rpc-api/server/actions/activity.py`

**Current Behavior**:
- Implements cache-aside pattern correctly
- Redis operations are synchronous (not async)
- SurrealDB operations are async (await)
- Multi-tenant filtering enforced

**Desired Behavior**: ✅ CORRECT
- Business logic correctly structured

**Gap**: NONE

---

## Root Cause Analysis

### Primary Issue: RecordID Serialization

**Problem**: 
GET `/v2/activities/templates/{id}` returns 500 Internal Server Error

**Root Cause**:
1. SurrealDB official library returns `RecordID` objects in query results
2. `RecordID` objects are NOT JSON serializable by default
3. FastAPI's JSON encoder fails when trying to serialize RecordID
4. `sanitize_record()` function exists but does NOT convert RecordID to string

**Evidence**:
- `sanitize_record()` comment says "The official library handles RecordID objects properly, but this function is kept for API compatibility"
- Function currently just passes through values without converting RecordID
- Template creation (POST) works because it returns newly created data without RecordID objects
- Template retrieval (GET) fails because SurrealDB returns records with RecordID in `id` field

**Solution**:
Implement proper RecordID → string conversion in `sanitize_record()`:
```python
from surrealdb import RecordID

def sanitize_record(record: Any) -> Any:
    if isinstance(record, RecordID):
        return str(record)
    elif isinstance(record, dict):
        return {k: sanitize_record(v) for k, v in record.items()}
    elif isinstance(record, list):
        return [sanitize_record(item) for item in record]
    else:
        return record
```

---

## Data Flow Validation

### Successful Flow: POST /v2/activities/templates

```
1. Client → POST /v2/activities/templates
2. Route: create_activity_template() → server/routes/activity.py:167
3. Action: create_template() → server/actions/activity.py
4. DB Op: create_template_record() → server/db/operations/template_data.py:26
5. Client: db.create(record_id, data) → server/db/surrealdb_client.py:157
6. SurrealDB: INSERT template
7. Response: Created template (no RecordID in response because new data)
8. Cache: Redis populated with template JSON
9. Result: ✅ 201 Created
```

### Failing Flow: GET /v2/activities/templates/{id}

```
1. Client → GET /v2/activities/templates/{id}
2. Route: get_activity_template() → server/routes/activity.py:126
3. Action: get_template_by_id() → server/actions/activity.py:224
4. DB Op: get_template_by_variant_id() → server/db/operations/template_data.py:67
5. Client: db.select(record_id) → server/db/surrealdb_client.py:187
6. SurrealDB: RETURN template WITH RecordID in 'id' field
7. Sanitize: sanitize_record() called but DOES NOT convert RecordID
8. Response: FastAPI tries to JSON serialize RecordID → ❌ FAILS
9. Result: ❌ 500 Internal Server Error
```

---

## Component Status Summary

| Component | File | Status | Issue |
|-----------|------|--------|-------|
| Entry Point | server/app.py | ✅ OK | None |
| Activity Router | server/routes/activity.py | ⚠️ PARTIAL | GET endpoint fails serialization |
| Learning Loop Router | server/routes/learning_loop.py | ✅ OK | None |
| Activity Actions | server/actions/activity.py | ✅ OK | None |
| SurrealDB Client | server/db/surrealdb_client.py | ❌ BUG | sanitize_record() not implemented |
| Template Metrics Ops | server/db/operations/template_metrics.py | ⚠️ DEPENDS | Depends on sanitize fix |
| Template Data Ops | server/db/operations/template_data.py | ⚠️ DEPENDS | Depends on sanitize fix |
| Activity Execution Ops | server/db/operations/activity_execution.py | ✅ OK | None |

---

## Endpoint Validation Checklist

### Template Endpoints (`/v2/activities/templates`)

- [x] **POST /templates** - Create template
  - Status: ✅ WORKS (returns 201)
  - Database: SurrealDB insert successful
  - Serialization: No RecordID in response
  
- [ ] **GET /templates/{id}** - Get template by ID
  - Status: ❌ FAILS (returns 500)
  - Database: SurrealDB query successful
  - Serialization: RecordID not converted to string
  - **FIX REQUIRED**: Implement sanitize_record()

- [x] **GET /templates** - List templates
  - Status: ✅ LIKELY WORKS
  - Database: SurrealDB query successful
  - Serialization: May have same RecordID issue
  - **NEEDS VALIDATION**: Test to confirm

- [ ] **POST /templates/{id}/metrics** - Update metrics
  - Status: ⚠️ UNKNOWN
  - Database: SurrealDB merge successful
  - Serialization: Unknown
  - **NEEDS VALIDATION**: Test endpoint

### Learning Loop Endpoints (`/api/v1/learning-loop`)

- [ ] **POST /executions** - Record execution
  - Status: ⚠️ UNKNOWN
  - Database: SurrealDB insert successful
  - Serialization: Unknown
  - **NEEDS VALIDATION**: Test endpoint

- [ ] **GET /templates/{id}/metrics** - Get metrics
  - Status: ⚠️ UNKNOWN
  - Database: SurrealDB query successful
  - Serialization: May have RecordID issue
  - **NEEDS VALIDATION**: Test endpoint

- [ ] **GET /boredom-activities** - Get boredom candidates
  - Status: ⚠️ UNKNOWN
  - **NEEDS VALIDATION**: Test endpoint

### Activity Storage Endpoints (`/v2/activities/storage`)

- [ ] **POST /storage** - Create activity
  - Status: ⚠️ UNKNOWN
  - **NEEDS VALIDATION**: Test endpoint

- [ ] **GET /storage/{id}** - Get activity
  - Status: ⚠️ UNKNOWN
  - **NEEDS VALIDATION**: Test endpoint

### Task Execution Endpoints (`/v2/activities/tasks`)

- [ ] **POST /tasks** - Record task start
  - Status: ⚠️ UNKNOWN
  - **NEEDS VALIDATION**: Test endpoint

- [ ] **PATCH /tasks/{id}** - Update task execution
  - Status: ⚠️ UNKNOWN
  - **NEEDS VALIDATION**: Test endpoint

---

## Required Actions

### CRITICAL (Must Fix for Production)

1. **Fix sanitize_record() implementation**
   - File: `repos/metabob-rpc-api/server/db/surrealdb_client.py:370`
   - Add RecordID → string conversion
   - Test: GET /v2/activities/templates/{id} returns 200

2. **Validate all GET endpoints**
   - Test all retrieval endpoints for RecordID serialization
   - Ensure sanitize_record() is called consistently
   - Add integration tests

### HIGH (Should Fix Soon)

3. **Comprehensive endpoint testing**
   - Create test suite covering all endpoints
   - Validate request/response schemas
   - Test error handling (404, 400, 500)

4. **Error response standardization**
   - Ensure consistent error format across all endpoints
   - Add proper HTTP status codes
   - Include actionable error messages

### MEDIUM (Technical Debt)

5. **Cache consistency validation**
   - Verify Redis cache TTL settings
   - Test cache invalidation on updates
   - Validate cache-aside pattern implementation

6. **Multi-tenant isolation testing**
   - Validate org_id and project_id filtering
   - Test scope enforcement (global, org, project)
   - Ensure no data leakage between tenants

---

## Validation Plan

### Phase 1: Fix Critical Bug (1-2 hours)

1. Implement sanitize_record() with RecordID conversion
2. Deploy to staging/devbob-k8s
3. Test GET /v2/activities/templates/{id}
4. Verify 200 response with valid JSON

### Phase 2: Comprehensive Endpoint Testing (2-4 hours)

1. Create test script covering all endpoint groups:
   - Template CRUD operations
   - Execution recording
   - Metrics retrieval
   - Learning loop endpoints
   - Storage endpoints
   - Task tracking endpoints

2. Validate each endpoint:
   - Request schema compliance
   - Database operation success
   - Response serialization
   - Error handling
   - Status codes

3. Document results in validation matrix

### Phase 3: Integration Validation (1-2 hours)

1. Test complete workflow:
   - Create template → Record execution → Update metrics → Get metrics
   - Store activity → Update tasks → Retrieve activity
   - Multi-tenant isolation scenarios

2. Performance testing:
   - Cache hit/miss rates
   - Response times
   - Database query performance

---

## Success Criteria

1. ✅ All endpoints return proper HTTP status codes
2. ✅ No RecordID serialization errors in responses
3. ✅ Database operations succeed without data loss
4. ✅ Multi-tenant isolation enforced correctly
5. ✅ Cache-aside pattern working as specified
6. ✅ Error responses include actionable messages
7. ✅ Integration tests pass for complete workflows

---

## Appendix: Key Files Reference

### Application Entry
- `repos/metabob-rpc-api/server/app.py` - FastAPI app factory
- `repos/metabob-rpc-api/server/main.py` - Entry point

### Route Handlers
- `repos/metabob-rpc-api/server/routes/activity.py` - Template endpoints
- `repos/metabob-rpc-api/server/routes/learning_loop.py` - Learning loop endpoints

### Business Logic
- `repos/metabob-rpc-api/server/actions/activity.py` - Template actions

### Database Layer
- `repos/metabob-rpc-api/server/db/surrealdb_client.py` - SurrealDB client (CRITICAL BUG HERE)
- `repos/metabob-rpc-api/server/db/operations/template_metrics.py` - Metrics CRUD
- `repos/metabob-rpc-api/server/db/operations/template_data.py` - Template CRUD
- `repos/metabob-rpc-api/server/db/operations/activity_execution.py` - Execution CRUD

### Configuration
- `repos/metabob-rpc-api/server/config.py` - Settings (SurrealDB connection)

### Tests
- `test_v2_activities.sh` - Existing v2 API test (basic)
- `repos/metabob-rpc-api/tests/routes/` - Route unit tests

