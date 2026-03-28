# Trace Analysis: rpc-api-deployed-infrastructure-validation

## Specification Summary

**Purpose**: Validate metabob-rpc-api endpoints work correctly with deployed infrastructure in local Kubernetes cluster

**Scope**: End-to-end testing of RPC API with real infrastructure dependencies (SurrealDB, Redis, DevBob container)

---

## Deployed Infrastructure

### Kubernetes Namespace: `metabob`

#### Components

1. **metabob-rpc-api**
   - Pod: `metabob-rpc-api-5c5dfb6b9b-rbhm8`
   - Service: `metabob-rpc-api.metabob.svc.cluster.local:8080`
   - External: `http://api.metabob.local`
   - Image: `metabob-rpc-api:record-id-fix`
   - Status: ✅ Running
   - Connections:
     - SurrealDB: `ws://surrealdb:8000`
     - Redis: `redis://redis-master:6379`
     - Database: `SURREAL_DATABASE=production`
     - Namespace: `SURREAL_NAMESPACE=metabob`

2. **devbob**
   - Pod: `devbob-766dcccf49-hfql6`
   - Service: `devbob.metabob.svc.cluster.local:8080`
   - External: `http://devbob.metabob.local`
   - Status: ✅ Running
   - Connections:
     - RPC API: `METABOB_API_URL=http://metabob-rpc-api`
     - SurrealDB: `SURREALDB_URL=http://surrealdb:8000`
     - Database: `SURREALDB_DATABASE=devbob`

3. **surrealdb**
   - Pod: `surrealdb-5bdddd9989-sdm5g`
   - Service: `surrealdb.metabob.svc.cluster.local:8000`
   - Status: ✅ Running
   - Auth: `surrealdb-credentials` secret

4. **redis**
   - Pod: `redis-master-0`
   - Service: `redis-master.metabob.svc.cluster.local:6379`
   - Status: ✅ Running

---

## Validation Targets

### 1. Health Check Endpoint
- **Endpoint**: `GET /`
- **File**: `repos/metabob-rpc-api/server/routes/health.py`
- **Status**: ✅ **PASS**
- **Current Behavior**: Returns `{"status": "ok", "timestamp": "ISO8601", "version": "0.16.4"}`
- **Test Result**: Returns 200 OK with valid JSON

### 2. Template Listing
- **Endpoint**: `GET /v2/activities/templates`
- **File**: `repos/metabob-rpc-api/server/routes/activity.py:72`
- **Component**: `list_activity_templates`
- **Status**: ✅ **PASS**
- **Current Behavior**: Lists templates from Redis cache with Thompson Sampling scores
- **Multi-Tenant Support**: Headers `x-tenant-id`, `x-org-id`, `x-project-id`
- **Test Result**: Returns 200 OK with `{"templates": []}`

### 3. Template Creation
- **Endpoint**: `POST /v2/activities/templates`
- **File**: `repos/metabob-rpc-api/server/routes/activity.py:246`
- **Component**: `create_activity_template`
- **Status**: ⛔ **BLOCKED**
- **Issue**: SurrealDB authentication failure (401)
- **Data Flow**: Client → FastAPI → `create_template_record(SurrealDB)` → Redis cache
- **Storage**:
  - Primary: `SurrealDB table: activity_template`
  - Cache: `Redis key: activity:template:{variant_id}`

### 4. Template Retrieval
- **Endpoint**: `GET /v2/activities/templates/{template_id}`
- **File**: `repos/metabob-rpc-api/server/routes/activity.py:134`
- **Component**: `get_activity_template`
- **Status**: ❓ **NOT TESTED**
- **Data Flow**: Client → Redis (cache check) → [miss] → SurrealDB → populate cache → response

### 5. Quality Score Endpoint (NEW)
- **Endpoint**: `GET /v2/activities/templates/{template_id}/quality-score`
- **File**: `repos/metabob-rpc-api/server/routes/activity.py:547`
- **Component**: `get_template_quality_score`
- **Status**: ❓ **NOT TESTED**
- **Implementation**:
  - Success score: `(success_rate * 40.0)` - Primary indicator
  - Cost score: `20 * (1 - cost/0.50)` - Lower cost = higher score
  - Duration score: `20 * (1 - duration/300000)` - Faster = higher score
  - Documentation score: `10 (description) + 10 (validation)`
  - Total: 0-100 points
- **Purpose**: Validates recent deployment includes quality score feature

### 6. Learning Loop Execution Recording (SCHEMA TOLERANCE)
- **Endpoint**: `POST /api/v1/learning-loop/executions`
- **File**: `repos/metabob-rpc-api/server/routes/learning_loop.py:132`
- **Component**: `record_execution`
- **Status**: ⚠️ **PARTIALLY WORKING**
- **Issue**: Pydantic validation still requires `template_id` and `started_at`
- **Schema Tolerance**:
  - Required: `activity_id`, `duration_ms`, `success`
  - Optional with defaults:
    - `template_id`: Extracted from activity_id pattern
    - `started_at`: Calculated from `completed_at - duration`
    - `completed_at`: Defaults to `datetime.utcnow()`
- **Data Flow**: Client → fill defaults → `insert_execution(SurrealDB)` → `update_metrics(SurrealDB)`

---

## Data Flow Summary

1. **Template Creation**: Client → `api.metabob.local/v2/activities/templates` (POST) → `create_template_record(SurrealDB)` → cache(Redis) → response

2. **Template Retrieval**: Client → Redis cache → [miss] → SurrealDB → populate cache → response

3. **Quality Score**: Client → `get_template_stats(Redis)` → calculate score → response

4. **Execution Reporting**: Client → `insert_execution(SurrealDB)` → `update_metrics(SurrealDB)` → response

5. **Learning Loop**: Execution → SurrealDB (activity_execution) → Aggregate (template_metrics) → Thompson Sampling → Template Selection → Next Execution

---

## Current vs Desired State

### Current State
- ✅ Health endpoint working
- ✅ Template listing working (empty initially)
- ⛔ Template creation blocked (SurrealDB auth error 401)
- ❓ Quality score endpoint deployed but not tested
- ⚠️ Schema tolerance partially working (still requires some fields)
- ❓ Multi-tenant isolation implemented but not validated
- ❓ DevBob integration not tested end-to-end

### Desired State
- ✅ All HTTP endpoints respond without 5xx errors
- ✅ Templates persist to SurrealDB correctly
- ✅ Redis cache populated after SurrealDB writes
- ✅ Org/project scoped templates filtered correctly
- ✅ DevBob can execute activities that call RPC API
- ✅ Learning loop accepts minimal execution data
- ✅ Quality score endpoint returns scores for templates with history

---

## Blockers

### 1. SurrealDB Authentication Failure
- **Error**: `401, message='Unauthorized', url='http://surrealdb:8000/rpc'`
- **Impact**: Cannot create templates in SurrealDB (primary storage)
- **Possible Causes**:
  - Credentials secret not mounted correctly to metabob-rpc-api pod
  - `SURREAL_USER`/`SURREAL_PASS` environment variables incorrect
  - SurrealDB authentication not initialized properly
  - Database namespace/database not created during init
- **Investigation**:
  - Check `surrealdb-credentials` secret
  - Verify init-schema job ran successfully
  - Check pod environment variables

### 2. Schema Tolerance Not Fully Implemented
- **Error**: Field `template_id` and `started_at` still required by Pydantic validation
- **Impact**: Clients must send all fields despite `Optional` schema annotations
- **Possible Causes**:
  - Pydantic `Field(...)` still marks fields as required
  - Need `Field(default=None)` instead of `Field(None, ...)`
  - API validation happening before default-filling logic
- **Fix**: Update `ExecutionRequest` Pydantic model

---

## Next Steps

### Step 1: Fix SurrealDB Authentication
1. Verify `surrealdb-credentials` secret exists and contains valid credentials
2. Check metabob-rpc-api pod can read secret: `kubectl describe pod`
3. Verify `SURREAL_USER`/`SURREAL_PASS` environment variables in pod
4. Test direct SurrealDB connection from rpc-api pod: `curl http://surrealdb:8000`
5. Review init-schema job logs to confirm database initialization

### Step 2: Validate Template CRUD Operations
1. `POST /v2/activities/templates` - create test template
2. `GET /v2/activities/templates` - list templates (should include test template)
3. `GET /v2/activities/templates/{id}` - retrieve test template
4. Verify template stored in SurrealDB (direct query)
5. Verify template cached in Redis: `redis-cli GET activity:template:{id}`

### Step 3: Validate Quality Score Endpoint
1. Create template with execution history
2. `POST /api/v1/learning-loop/executions` - record multiple executions
3. `GET /v2/activities/templates/{id}/quality-score` - get quality score
4. Verify score calculation matches specification
5. Confirm client code does NOT calculate quality scores locally

### Step 4: Validate Schema Tolerance
1. Fix `ExecutionRequest` Pydantic model to use `Field(default=None)`
2. `POST /api/v1/learning-loop/executions` with minimal data (`activity_id`, `duration`, `success`)
3. Verify API fills `template_id` from activity_id pattern
4. Verify API calculates `started_at` from `completed_at - duration`
5. Confirm no Pydantic validation errors

### Step 5: Validate Multi-Tenant Isolation
1. Create templates with different `org_id`/`project_id` scope
2. `GET /v2/activities/templates` with Bearer token (specific org)
3. Verify only org-scoped + global templates returned
4. `GET /v2/activities/templates` without Bearer token
5. Verify only global templates returned

### Step 6: Validate DevBob Integration
1. `kubectl exec` into devbob pod
2. Test opencode CLI can call metabob-rpc-api endpoints
3. Execute activity that uses template selection (Thompson Sampling)
4. Verify activity calls `POST /v2/activities/templates/{id}/select`
5. Confirm end-to-end workflow: DevBob → RPC API → SurrealDB → Redis → response

---

## Test Plan

### Test Harness
`tests/validation-harnesses/rpc-api-deployed-infrastructure-validation-harness.ts`

### Test Cases

**TC1: Health Check**
- Endpoint: `GET /`
- Expected: 200 OK, `{'status': 'ok', 'version': string}`

**TC2: List Templates (Empty)**
- Endpoint: `GET /v2/activities/templates`
- Expected: 200 OK, `{'templates': []}`

**TC3: Create Template**
- Endpoint: `POST /v2/activities/templates`
- Headers: `x-tenant-id`, `x-org-id`, `x-project-id`
- Expected: 201 Created, `{'variant_id': string, 'activity_id': string}`

**TC4: Get Template by ID**
- Endpoint: `GET /v2/activities/templates/{variant_id}`
- Expected: 200 OK, Full template with metrics

**TC5: Quality Score Endpoint**
- Endpoint: `GET /v2/activities/templates/{id}/quality-score`
- Expected: 200 OK, `{'quality_score': number, 'breakdown': {...}, 'metrics': {...}}`

**TC6: Record Execution (Minimal Data)**
- Endpoint: `POST /api/v1/learning-loop/executions`
- Payload: `{'activity_id': string, 'duration_ms': number, 'success': boolean}`
- Expected: 201 Created, `{'success': true, 'execution_id': string}`

**TC7: Multi-Tenant Template Listing**
- Endpoint: `GET /v2/activities/templates`
- Headers: `Authorization: Bearer {token}`
- Expected: Returns only global + org-scoped templates

**TC8: DevBob Activity Execution**
- Description: Execute activity from DevBob container that calls RPC API
- Expected: Activity completes successfully, calls api.metabob.local endpoints

---

## Components Summary

| File | Component | Line | Status | Notes |
|------|-----------|------|--------|-------|
| `repos/metabob-rpc-api/server/routes/health.py` | Health check | - | ✅ Working | Returns status, timestamp, version |
| `repos/metabob-rpc-api/server/routes/activity.py` | `list_activity_templates` | 72 | ✅ Working | Thompson Sampling, multi-tenant |
| `repos/metabob-rpc-api/server/routes/activity.py` | `create_activity_template` | 246 | ⛔ Blocked | SurrealDB auth error |
| `repos/metabob-rpc-api/server/routes/activity.py` | `get_activity_template` | 134 | ❓ Not tested | Depends on creation |
| `repos/metabob-rpc-api/server/routes/activity.py` | `get_template_quality_score` | 547 | ❓ Not tested | New endpoint |
| `repos/metabob-rpc-api/server/routes/learning_loop.py` | `record_execution` | 132 | ⚠️ Partial | Schema tolerance issue |
| `repos/metabob-rpc-api/server/actions/activity.py` | `create_template` | - | ⛔ Blocked | SurrealDB connection |
| `repos/metabob-rpc-api/server/db/operations/activity_execution.py` | `insert_execution` | - | ❓ Not tested | Depends on SurrealDB |

---

## Impulse Metadata

- **Impulse ID**: `trace-rpc-api-deployed-infrastructure-validation`
- **Type**: `templateDefinition`
- **Budget**: 5000 tokens
- **Purpose**: Infrastructure validation trace for downstream tasks
- **Components**: 6 validation targets
- **Blockers**: 2 critical issues
- **Next Steps**: 6 action items with detailed tasks

---

**Generated**: 2026-03-03
**Activity**: trace-enforce-validate-loop
**Context**: Third invocation - deployed infrastructure validation
