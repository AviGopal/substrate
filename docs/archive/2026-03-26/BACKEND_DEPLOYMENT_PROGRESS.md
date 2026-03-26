# Backend Deployment Progress

**Date**: 2026-03-03  
**Session**: Resume from MCP Architecture Fixes

## Summary

Successfully deployed fixed metabob-rpc-api backend to K8s cluster, resolving CrashLoopBackOff issue. Identified and partially fixed async/await bugs in learning loop. **Blocked** by SurrealDB client connection issue.

---

## What Was Fixed ✅

### 1. Dockerfile Fixes
**File**: `repos/metabob-rpc-api/docker/Dockerfile.server.fixed`

**Issues Fixed**:
- ✅ Added `COPY docs/ docs/` to builder stage (schema files weren't being copied)
- ✅ Fixed schema COPY command (removed shell redirection syntax)
- ✅ Created `/opt/app/metrics` directory with proper permissions
- ✅ Multi-stage build with slim base image

**Commits**:
- Dockerfile.server.fixed created (previous session)
- Incremental fixes during deployment

**Result**: Backend pod **Running** (1/1), no more CrashLoopBackOff after 143 restarts

### 2. Database Schema Initialization
**File**: `repos/metabob-rpc-api/docs/schema/activity_learning_loop.surql`

**Actions**:
- ✅ Applied schema manually via SurrealDB HTTP API
- ✅ Created `activity_execution` table with required fields
- ✅ Verified schema with INFO FOR DB query

**Commands Used**:
```bash
kubectl exec -n metabob deployment/devbob -- sh -c 'curl -X POST http://surrealdb:8000/sql \
  -u "root:changeme" -H "Accept: application/json" \
  --data-binary @- << "EOF"
USE NS metabob DB devbob;
DEFINE TABLE IF NOT EXISTS activity_execution SCHEMAFULL PERMISSIONS FULL;
DEFINE FIELD IF NOT EXISTS activity_id ON activity_execution TYPE string;
DEFINE FIELD IF NOT EXISTS template_id ON activity_execution TYPE string;
...
EOF
'
```

**Result**: Schema tables created successfully

### 3. Async/Await Fixes
**File**: `repos/metabob-rpc-api/server/routes/learning_loop.py`

**Bug Found**: Missing `await` keywords on async database operations
- Line 167: `execution = insert_execution(...)` → `await insert_execution(...)`
- Line 185: `update_metrics_after_execution(...)` → `await update_metrics_after_execution(...)`
- Line 197: `record_failure(...)` → `await record_failure(...)`

**Commit**: `05ae371`
```
fix: Add missing await keywords for async database operations in learning loop
```

**Impact**: Functions were returning coroutines without executing, preventing database writes

---

## Current Blocker ❌

### SurrealDB Client Connection Issue

**Error**:
```
'BlockingHttpSurrealConnection' object has no attribute 'connect'
```

**Root Cause**: `server/db/surrealdb_client.py` uses official `surrealdb-py` library but:
1. `get_surreal_client()` is `async` but returns an async client wrapper
2. Client wrapper tries to call `.connect()` on `BlockingHttpSurrealConnection`
3. The blocking connection class doesn't have a `connect()` method

**Affected Components**:
- `server/db/surrealdb_client.py` - AsyncSurrealDBClient wrapper
- `server/db/operations/activity_execution.py` - Uses `get_surreal_client()`
- `server/db/operations/template_metrics.py` - Uses `get_surreal_client()`
- `server/routes/learning_loop.py` - All endpoints affected

**CLI Tool Also Broken**:
```bash
kubectl exec deployment/metabob-rpc-api -- python3 -c "from server.cli import cli; cli(['db', 'init-schema', '--schema-file', '/app/schema/activity_learning_loop.surql'])"
# Error: 'BlockingHttpSurrealConnection' object has no attribute 'connect'
```

---

## What Works ✅

1. **Backend Health**: Pod running, responding to requests
   ```bash
   kubectl get pods -n metabob | grep rpc-api
   # metabob-rpc-api-7cb5c887c4-8g58j   1/1   Running
   ```

2. **Root Endpoint**: Returns version and status
   ```bash
   kubectl exec -n metabob deployment/devbob -- curl -s http://metabob-rpc-api:8080/
   # {"status":"ok","timestamp":"2026-03-03T06:00:00Z","version":"0.16.4"}
   ```

3. **Request Validation**: Endpoints validate input correctly
   ```bash
   POST /api/v1/learning-loop/executions
   # Returns 422 with detailed validation errors for missing fields
   ```

4. **Database Connection**: SurrealDB accessible
   ```bash
   kubectl exec -n metabob deployment/devbob -- curl -X POST http://surrealdb:8000/sql ...
   # Works, returns results
   ```

---

## What Doesn't Work ❌

1. **Execution Recording**: `/api/v1/learning-loop/executions` endpoint fails
   - Returns: `'BlockingHttpSurrealConnection' object has no attribute 'connect'`
   - Reason: SurrealDB client can't connect

2. **Metrics Updates**: All learning loop endpoints non-functional
   - `/api/v1/learning-loop/templates/{id}/metrics`
   - `/api/v1/learning-loop/boredom-activities`
   - `/api/v1/learning-loop/templates/{id}/failures`

3. **Database CLI Tools**: Schema management commands broken
   - `db init-schema` - Can't connect to SurrealDB
   - `db validate` - Can't verify tables
   - `db status` - Can't query metrics

---

## Next Steps 🔧

### Priority 1: Fix SurrealDB Client

**Options**:

**Option A: Fix AsyncSurrealDBClient wrapper** (Recommended)
- Investigate `surrealdb-py` library usage
- Check if `BlockingHttpSurrealConnection` needs different initialization
- May need to use `Surreal()` class differently
- Look for examples in surrealdb-py documentation

**Option B: Revert to HTTP RPC client** (Fallback)
- Previous implementation used direct HTTP requests
- Session summary mentions "custom HTTP RPC client had parameter serialization bugs"
- Those bugs might have been fixed
- Less ideal but known to work

**Option C: Use async HTTP client directly**
- Use `aiohttp` or `httpx` for async HTTP requests
- Bypass surrealdb-py library entirely
- More control, but more code to maintain

### Priority 2: Fix Remaining Async/Await Bugs

**File**: `server/routes/learning_loop.py`

Type checker warnings indicate **17 more missing awaits**:
- Line 239: get_template_metrics()
- Line 277, 282: get_boredom_activities()
- Line 301, 303: get_boredom_activities()
- Line 340: get_template_failures()
- Line 383, 416: get_mapping_records()
- Line 602, 609: iteration over coroutines
- Line 770: compute_recommendations() argument

**Impact**: Entire learning loop API is broken

### Priority 3: Comprehensive Testing

Once SurrealDB client works:
1. Test execution recording end-to-end
2. Verify metrics updates in database
3. Test Thompson sampling calculations
4. Validate boredom detection
5. Check MCP integration (metabob-opencode calling backend)

---

## Investigation Commands

### Check Backend Logs
```bash
kubectl logs -n metabob deployment/metabob-rpc-api --tail=100
```

### Test Execution Recording
```bash
kubectl exec -n metabob deployment/devbob -- curl -X POST \
  http://metabob-rpc-api:8080/api/v1/learning-loop/executions \
  -H "Content-Type: application/json" \
  -d '{
    "activity_id": "test-001",
    "template_id": "add-feature-complete",
    "started_at": "2026-03-03T06:00:00Z",
    "duration_ms": 50000,
    "success": true,
    "tokens_input": 2000,
    "tokens_output": 1000,
    "tokens_cache": 300,
    "cost_usd": 0.12,
    "completed_at": "2026-03-03T06:00:50Z"
  }'
```

### Query Database
```bash
kubectl exec -n metabob deployment/devbob -- sh -c '
  curl -X POST http://surrealdb:8000/sql \
    -u "root:changeme" -H "Accept: application/json" \
    --data-binary "USE NS metabob DB devbob; SELECT * FROM activity_execution LIMIT 5;"
' | python3 -m json.tool
```

### Check SurrealDB Client Code
```bash
cd repos/metabob-rpc-api
cat server/db/surrealdb_client.py
```

---

## Files Modified This Session

1. `repos/metabob-rpc-api/docker/Dockerfile.server.fixed`
   - Added `COPY docs/ docs/` to builder stage
   - Fixed schema COPY command
   - Created /opt/app/metrics with permissions

2. `repos/metabob-rpc-api/server/routes/learning_loop.py`
   - Added `await` to insert_execution()
   - Added `await` to update_metrics_after_execution()
   - Added `await` to record_failure()
   - **Commit**: `05ae371`

3. Manual schema application (not a file, but documented above)

---

## Deployment Status

| Component | Status | Details |
|-----------|--------|---------|
| **metabob-rpc-api pod** | ✅ Running | 1/1, no crashes |
| **SurrealDB** | ✅ Running | Responding to queries |
| **Schema** | ✅ Applied | activity_execution table exists |
| **Backend API** | ⚠️ Partially | Health endpoint works, learning loop broken |
| **Database writes** | ❌ Broken | Client connection issue |
| **CLI tools** | ❌ Broken | Same connection issue |

---

## Session Summary

**Time Spent**: ~60 minutes  
**Commits**: 1 (`05ae371`)  
**Docker Builds**: 3  
**Deployments**: 3 rollouts  
**Issues Fixed**: 4 (Dockerfile, schema, async/await partial)  
**Issues Remaining**: 1 major blocker (SurrealDB client)

**Outcome**: Backend is deployed and stable but learning loop API is non-functional due to SurrealDB client connection issue. Ready for deeper investigation of surrealdb-py library usage or fallback to HTTP client.
