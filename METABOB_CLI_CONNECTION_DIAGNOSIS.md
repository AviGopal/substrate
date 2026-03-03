# Metabob CLI Connection Diagnosis and Fix

**Date**: 2026-03-03  
**Status**: ✅ Partially Fixed - Connection Working, Storage Bug Found

## Problem Statement

metabob-opencode (metabob-cli) running natively on the host machine was not connecting to the Kubernetes cluster. We expected to see:
- Logs showing CLI interactions with activity endpoints
- Data populating in SurrealDB
- Activity templates being stored and retrieved

## Root Cause Analysis

### 1. ✅ FIXED: Configuration Issue
**Problem**: metabob-cli config pointed to wrong URL  
**Location**: `/home/avi/documents/work/exp-repo/metabob-devbob/repos/metabob-opencode/.metabob/config.json`  
**Before**:
```json
{
  "base_url": "https://ide.metabob.com",
  "api_key": "mb_devbob_test_simple_2026_v2",
  "project_id": "opencode-dev"
}
```

**After**:
```json
{
  "base_url": "http://api.metabob.local",
  "api_key": "mb_devbob_test_simple_2026_v2",
  "project_root": "/home/avi/documents/work/exp-repo/metabob-devbob/repos/metabob-opencode"
}
```

**Changes**:
- ✅ Changed `base_url` from `https://ide.metabob.com` to `http://api.metabob.local`
- ✅ Changed `project_id` to `project_root` (CLI schema requirement)

### 2. ✅ VERIFIED: Ingress Working
**Status**: Working correctly  
**Evidence**:
```bash
$ curl http://api.metabob.local/
{"status":"ok","timestamp":"2026-03-03T09:35:08.417682","version":"0.16.4"}

$ curl http://api.metabob.local/docs
# Returns Swagger UI for API documentation
```

**Routing**:
- `api.metabob.local` → Istio Gateway → VirtualService → `metabob-rpc-api.metabob.svc.cluster.local:8080`
- `/etc/hosts`: `127.0.0.1 api.metabob.local`

### 3. ❌ BUG FOUND: SurrealDB Storage Failure
**Problem**: Templates created via API are added to Redis but fail to write to SurrealDB  
**Location**: `metabob-rpc-api` pod  
**Evidence**:
```log
2026-03-03 09:37:14,989 ERROR server.actions.activity ❌ SurrealDB query failed for add-feature-complete: 'coroutine' object has no attribute 'get'
```

**Root Cause**: Async/await bug in SurrealDB client usage
- Templates are added to Redis list successfully
- SurrealDB write operation fails due to improper coroutine handling
- Results in warnings: `Template X in list but not found in storage`

**Impact**:
- ❌ Templates cannot be retrieved (database is empty)
- ❌ Activity executions will fail (no templates available)
- ⚠️ Redis and SurrealDB out of sync

## Infrastructure Status

### ✅ Working Components

1. **Kubernetes Cluster**: docker-desktop context
2. **Istio Gateway**: Port 80, listening on all metabob.local domains
3. **RPC API Pod**: `metabob-rpc-api-5cbbccf5c-vxcf6` - Running
4. **SurrealDB Pod**: `surrealdb` - Running (in-memory mode)
5. **Redis**: `redis-master` - Running
6. **Ingress Route**: `api.metabob.local` → RPC API → Working
7. **API Endpoints**: 42 endpoints available (see `/openapi.json`)

### ⚠️ Components with Issues

1. **SurrealDB Storage**: Accepting connections but writes failing due to coroutine bug
2. **Template Bootstrap**: No templates in database (need to bootstrap after fix)

## API Endpoints Available

Key activity-related endpoints:
```
GET  /v2/activities/templates
POST /v2/activities/templates
GET  /v2/activities/templates/{template_id}
POST /v2/activities/executions
GET  /v2/activities/templates/{template_id}/stats
POST /v2/activities/storage
```

## Testing Results

### ✅ Connection Tests
```bash
# Health check
curl http://api.metabob.local/
{"status":"ok","timestamp":"...","version":"0.16.4"}

# List templates (empty due to storage bug)
curl http://api.metabob.local/v2/activities/templates
{"templates":[]}

# Create template (succeeds but not persisted)
curl -X POST http://api.metabob.local/v2/activities/templates -H "Content-Type: application/json" -d '{...}'
# Returns 201 Created but immediately lost
```

### ❌ Storage Tests
```bash
# Template created
curl -X POST http://api.metabob.local/v2/activities/templates ...
# Returns: {"variant_id":"add-feature-complete-adb7314d",...}

# Template NOT found
curl http://api.metabob.local/v2/activities/templates/add-feature-complete
# Returns: empty/null

# Logs show error
kubectl logs -n metabob -l app=metabob-rpc-api
# ERROR: 'coroutine' object has no attribute 'get'
```

## Environment Configuration

### SurrealDB
```
SURREALDB_URL=http://surrealdb:8000
SURREAL_NAMESPACE=metabob
SURREAL_DATABASE=devbob
SURREAL_USER=root
SURREAL_PASS=changeme
```

### Redis
```
REDIS_MASTER=redis-master:6379
```

### RPC API
```
API_PORT=8080
LOG_LEVEL=INFO
```

## Next Steps

### Immediate (Critical)

1. **Fix SurrealDB Coroutine Bug** ⚠️ BLOCKING
   - Location: `metabob-rpc-api` codebase
   - Issue: Improper async/await usage when writing templates
   - Fix: Add proper `await` to coroutine calls
   - File: Likely in `server/actions/activity.py` or similar

2. **Bootstrap Templates**
   - After storage fix, bootstrap core templates
   - Script available: `/scripts/bootstrap_core_templates.py`
   - Templates available: `/templates/bootstrap/*.json`

3. **Verify E2E Flow**
   - Create template via API
   - Verify template in SurrealDB
   - Retrieve template via API
   - Execute activity with template

### Short Term

1. **Enable Persistent Storage for SurrealDB**
   - Current: in-memory mode (data lost on restart)
   - Target: PersistentVolumeClaim with RocksDB backend
   - Update helm chart: `helm/charts/surrealdb/values.yaml`

2. **Add Monitoring**
   - SurrealDB query metrics
   - Template creation/retrieval rates
   - Activity execution tracking

## Verification Commands

### Check Configuration
```bash
# Verify metabob-cli config
cd repos/metabob-opencode
metabob-cli config

# Should show:
#   base_url: http://api.metabob.local
#   api_key: mb_devbob_test_simple_2026_v2
```

### Test API Connection
```bash
# Health check
curl http://api.metabob.local/

# List endpoints
curl http://api.metabob.local/openapi.json | jq '.paths | keys'

# List templates
curl http://api.metabob.local/v2/activities/templates
```

### Check Pod Logs
```bash
# RPC API logs
kubectl logs -n metabob -l app=metabob-rpc-api --tail=100

# SurrealDB logs
kubectl logs -n metabob -l app=surrealdb --tail=100

# Look for errors
kubectl logs -n metabob -l app=metabob-rpc-api | grep -E "ERROR|surrealdb"
```

### Verify SurrealDB
```bash
# Port-forward to SurrealDB
kubectl port-forward -n metabob svc/surrealdb 8000:8000 &

# Query database
curl -X POST http://localhost:8000/sql \
  -H "Accept: application/json" \
  -H "NS: metabob" \
  -H "DB: devbob" \
  -u "root:changeme" \
  -d "SELECT * FROM activity_template;"
```

## Files Modified

1. `/repos/metabob-opencode/.metabob/config.json` - Fixed base_url and field names
2. This document - Created for diagnosis tracking

## Files to Fix (Next Action)

1. `repos/metabob-rpc-api/server/actions/activity.py` (or similar)
   - Add proper `await` to SurrealDB coroutine calls
   - Search for: `surrealdb.*\.get\(` without await
   - Fix pattern: `result = await db.query(...)`

## Success Criteria

### Phase 1: Storage Fix ✅ When Complete
- [ ] Template created via API persists in SurrealDB
- [ ] Template can be retrieved via GET endpoint
- [ ] No "coroutine" errors in logs
- [ ] Redis and SurrealDB are synchronized

### Phase 2: CLI Integration ✅ When Complete
- [ ] metabob-cli can list templates
- [ ] metabob-cli can register templates
- [ ] Templates visible in both CLI and API
- [ ] Activity execution succeeds end-to-end

### Phase 3: Production Ready ✅ When Complete
- [ ] SurrealDB using persistent storage
- [ ] Core templates bootstrapped (20+ templates)
- [ ] Monitoring and metrics enabled
- [ ] Documentation updated

## References

- RPC API Swagger: http://api.metabob.local/docs
- SurrealDB Docs: https://surrealdb.com/docs
- Helm Charts: `/helm/charts/`
- Bootstrap Scripts: `/scripts/bootstrap*.py`
- Templates: `/templates/bootstrap/*.json`

---

**Status Legend**:
- ✅ Fixed/Working
- ⚠️ Blocking Issue
- ❌ Not Working
- 🔄 In Progress
