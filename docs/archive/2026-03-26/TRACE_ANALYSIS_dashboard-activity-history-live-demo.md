# Dashboard Activity History Live Demo - Trace Analysis

## Specification Name
Dashboard Activity History Live Demo

## Overview
- **Purpose**: End-to-end demonstration of activity history visualization
- **Data Flow**: OpenCode CLI (devbob) → SurrealDB → RPC API (Redis cache-aside) → Dashboard UI
- **Key Components**: 9
- **Implementation Status**: PARTIALLY_IMPLEMENTED

## Components Analysis

### 1. Activity.finalize()

**File**: `repos/metabob-opencode/packages/opencode/src/session/activity.ts`

**Current Behavior**: Records activity execution locally in Activity.Info storage, calls MetabobCLI.recordActivityOutcome() for metrics

**Desired Behavior**: Should persist activity execution to SurrealDB activity_executions table via RPC API /activity/record endpoint

**Gap**: MISSING: Direct SurrealDB persistence. Currently only records to metabob-cli backend (NOT the same as RPC API). Need to add HTTP call to RPC API /activity/record endpoint after activity completion.

**Implementation Path**: repos/metabob-opencode/packages/opencode/src/session/activity.ts:finalize()

**Priority**: HIGH

### 2. insert_execution()

**File**: `repos/metabob-rpc-api/server/db/operations/activity_execution.py`

**Current Behavior**: Inserts activity execution records into SurrealDB activity_executions table with full metrics (tokens, cost, duration, success status)

**Desired Behavior**: IMPLEMENTED - Writes to SurrealDB as primary storage, no Redis write on insert (cache-aside on reads only)

**Gap**: NONE - Correctly implements write path

**Implementation Path**: repos/metabob-rpc-api/server/db/operations/activity_execution.py:insert_execution

**Priority**: COMPLETE

### 3. get_organization_activity()

**File**: `repos/metabob-rpc-api/server/db/operations/activity_execution.py`

**Current Behavior**: Implements cache-aside pattern: checks Redis cache first, on miss queries SurrealDB, populates cache with 60s TTL, returns formatted activity events

**Desired Behavior**: IMPLEMENTED - Read path with Redis caching for <5ms latency

**Gap**: PARTIAL: Actor attribution hardcoded to 'system@metabob.local'. Need to join with users table or add user_id field to activity_executions table.

**Implementation Path**: repos/metabob-rpc-api/server/db/operations/activity_execution.py:get_organization_activity

**Priority**: MEDIUM

### 4. GET /auth/orgs/{org_id}/activity

**File**: `repos/metabob-rpc-api/server/routes/cloud_auth.py`

**Current Behavior**: Protected endpoint requiring JWT authentication, calls get_organization_activity() with Redis client, returns paginated activity list

**Desired Behavior**: IMPLEMENTED - API endpoint with authentication and caching

**Gap**: NONE - Correctly implements API contract

**Implementation Path**: repos/metabob-rpc-api/server/routes/cloud_auth.py:get_organization_activity

**Priority**: COMPLETE

### 5. activity_executions table schema

**File**: `repos/metabob-rpc-api/sql/migrations/006-dashboard-tables.surql`

**Current Behavior**: Defines SCHEMAFULL table with fields: execution_id, session_id, activity_id, variant_id, project_id, user_id, org_id, status, timestamps, duration, cost, tokens

**Desired Behavior**: MISMATCH - The schema defines execution_id, variant_id fields but insert_execution() uses activity_id, template_id. Schema needs alignment with actual usage.

**Gap**: CRITICAL: Schema mismatch between migration (execution_id, variant_id) and actual code (activity_id, template_id). Need to update schema or update code to match.

**Implementation Path**: repos/metabob-rpc-api/sql/migrations/006-dashboard-tables.surql:activity_executions

**Priority**: HIGH

### 6. Dashboard deployment

**File**: `repos/platform/metabob-apps/charts/metabob-dashboard/charts/templates/deployment.yaml`

**Current Behavior**: Deploys React dashboard with env vars REACT_APP_API_BASE_URL='', REACT_APP_AUTH_BASE_URL='/auth', routes API calls via Istio service mesh

**Desired Behavior**: IMPLEMENTED - Dashboard deployed with correct API routing

**Gap**: NONE - Deployment configured correctly

**Implementation Path**: repos/platform/metabob-apps/charts/metabob-dashboard/charts/templates/deployment.yaml

**Priority**: COMPLETE

### 7. Helmfile orchestration

**File**: `repos/platform/metabob-apps/helmfile.yaml.gotmpl`

**Current Behavior**: Defines release order: config → redis → surrealdb → metabob-rpc-api → metabob-dashboard → devbob, supports multiple environments (default/integration/production)

**Desired Behavior**: IMPLEMENTED - Correct dependency chain and deployment order

**Gap**: NONE - Helmfile correctly orchestrates all services

**Implementation Path**: repos/platform/metabob-apps/helmfile.yaml.gotmpl

**Priority**: COMPLETE

### 8. Devbob configuration

**File**: `repos/platform/metabob-apps/charts/devbob/values/default.devbob.values.yaml`

**Current Behavior**: Configures OpenCode server with SurrealDB connection (host: surrealdb, port: 8000, namespace: metabob, database: devbob)

**Desired Behavior**: IMPLEMENTED - Devbob can connect to SurrealDB

**Gap**: MISSING: No RPC API URL configured. Devbob needs REACT_APP_API_BASE_URL or similar env var to know where to POST activity execution data.

**Implementation Path**: repos/platform/metabob-apps/charts/devbob/values/default.devbob.values.yaml

**Priority**: HIGH

### 9. Validation harness

**File**: `tests/validation-harnesses/Dashboard-Activity-History-Viewing-Flow-harness.ts`

**Current Behavior**: 15-step validation harness covering infrastructure (kubectx, pods, services), DNS, authentication, API validation, and integration

**Desired Behavior**: IMPLEMENTED - Comprehensive validation framework

**Gap**: PARTIAL: Steps 9-15 are placeholder/SKIP status. Need Playwright automation for browser-based validation (dashboard refresh, detail page, filtering).

**Implementation Path**: tests/validation-harnesses/Dashboard-Activity-History-Viewing-Flow-harness.ts

**Priority**: MEDIUM


## Data Flow Trace

**Entry Point**: kubectl exec -it devbob -- opencode activity --template=test-activity

**Transform Steps**:
- **Step 1**: Activity.finalize()
  - Action: Calculates activity stats (tokens, cost, duration, success)
  - Output: Activity.Info with full metrics
  - Status: IMPLEMENTED

- **Step 2**: HTTP POST to RPC API /activity/record
  - Action: Sends activity execution data to RPC API
  - Output: Activity record persisted to SurrealDB
  - Status: MISSING - This HTTP call does not exist in OpenCode CLI

- **Step 3**: insert_execution()
  - Action: Writes to SurrealDB activity_executions table
  - Output: Record ID returned
  - Status: IMPLEMENTED

- **Step 4**: Dashboard polls GET /auth/orgs/{org_id}/activity every 60s
  - Action: Frontend timer triggers API request with JWT token
  - Output: HTTP GET request to RPC API
  - Status: ASSUMED - Dashboard code not traced in this analysis

- **Step 5**: get_organization_activity() - Cache check
  - Action: Checks Redis cache with key: activity:org:{org_id}:limit:{limit}:offset:{offset}
  - Output: Cache HIT: Return cached data (<5ms), Cache MISS: Continue to step 6
  - Status: IMPLEMENTED

- **Step 6**: get_organization_activity() - SurrealDB query
  - Action: SELECT * FROM activity_executions ORDER BY started_at DESC LIMIT $limit
  - Output: Raw execution records from SurrealDB (50-100ms)
  - Status: IMPLEMENTED

- **Step 7**: get_organization_activity() - Transform
  - Action: Converts execution records to activity event format (type, actor, timestamp, description, metadata)
  - Output: Formatted activities array
  - Status: IMPLEMENTED (actor hardcoded)

- **Step 8**: get_organization_activity() - Cache populate
  - Action: redis.setex(cache_key, 60, json.dumps(response_data))
  - Output: Cache populated with 60s TTL
  - Status: IMPLEMENTED

- **Step 9**: Dashboard renders RecentActivity component
  - Action: Displays activity timeline with cards showing template, status, actor, duration, cost
  - Output: UI updated with latest activity data
  - Status: ASSUMED - Dashboard code not traced


**Validation Checks**:
- **Check**: Activity persisted to SurrealDB
  - Query/Command: SELECT * FROM activity_executions WHERE activity_id = $activity_id
  - Expected: Record exists with correct metrics

- **Check**: Redis cache populated
  - Query/Command: redis-cli GET activity:org:test-org:limit:50:offset:0
  - Expected: JSON string with activities array

- **Check**: API returns correct schema
  - Query/Command: GET /auth/orgs/{org_id}/activity
  - Expected: {activities: [...], hasMore: boolean, total: number}

- **Check**: Dashboard displays activity
  - Query/Command: Browser automation: check for activity card in timeline
  - Expected: Activity visible with correct metadata


**Exit**: Dashboard UI displays activity history, user can click to see detail page

## Critical Gaps

### Gap 1: OpenCode CLI does NOT persist to SurrealDB via RPC API
- **Impact**: Activities executed in devbob are not visible in dashboard
- **Solution**: Add HTTP POST to RPC API /activity/record endpoint in Activity.finalize()
- **Effort**: Medium (2-4 hours)

### Gap 2: SurrealDB schema mismatch (execution_id vs activity_id, variant_id vs template_id)
- **Impact**: Schema migrations may fail or inserts may be rejected
- **Solution**: Update schema to match actual field names used in code
- **Effort**: Low (1 hour)

### Gap 3: Actor attribution hardcoded to 'system@metabob.local'
- **Impact**: Dashboard shows wrong user for all activities
- **Solution**: Add user_id to activity_executions insert, join with users table in query
- **Effort**: Low (1-2 hours)

### Gap 4: Devbob chart missing RPC API URL configuration
- **Impact**: Even if OpenCode adds HTTP call, it won't know where to send data
- **Solution**: Add METABOB_RPC_API_URL env var to devbob values
- **Effort**: Low (30 minutes)


## Implementation Status

**Ready for Demo**: NO ❌

**Blockers**:
- OpenCode CLI missing HTTP POST to RPC API /activity/record
- SurrealDB schema needs field name updates
- Devbob container needs RPC API URL environment variable

## Next Steps

### Step 1: Update SurrealDB schema to match code field names
**Files**: `repos/metabob-rpc-api/sql/migrations/006-dashboard-tables.surql`
**Validation**: Run migration, verify inserts succeed

### Step 2: Add RPC_API_URL to devbob chart values
**Files**: `repos/platform/metabob-apps/charts/devbob/values/default.devbob.values.yaml`
**Validation**: kubectl exec devbob -- env | grep RPC_API

### Step 3: Implement Activity.finalize() HTTP POST to RPC API
**Files**: `repos/metabob-opencode/packages/opencode/src/session/activity.ts`
**Validation**: Execute activity, check SurrealDB for record

### Step 4: Deploy all services using helmfile
**Command**: `helmfile -e default apply`
**Validation**: kubectl get pods -n metabob (all Running)

### Step 5: Run validation harness
**Command**: `tsx tests/validation-harnesses/Dashboard-Activity-History-Viewing-Flow-harness.ts`
**Validation**: 15/15 steps PASS

### Step 6: Execute live demo with Playwright automation
**Description**: Automated browser session capturing screenshots at each step
**Validation**: Screenshots saved to output/ directory, activity visible in dashboard


## Metadata

- **Trace Impulse ID**: trace-dashboard-activity-history-live-demo
- **Generated**: 2026-03-05T08:37:08.512Z
- **Specification**: Dashboard Activity History Live Demo
- **Data Flow**: OpenCode CLI → SurrealDB → RPC API (Redis) → Dashboard UI
