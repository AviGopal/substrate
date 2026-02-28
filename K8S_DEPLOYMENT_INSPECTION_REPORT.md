# Kubernetes Local Deployment Inspection Report

**Date**: 2026-02-28  
**Context**: docker-desktop  
**Namespace**: metabob

## Executive Summary

The Kubernetes deployment is **partially functional** with critical database schema issues preventing proper activity flow tracking and backend integration.

### Status Overview
- ✅ **Pods Running**: 3 devbob pods (StatefulSet), SurrealDB, Redis
- ✅ **Network Connectivity**: All services reachable internally
- ✅ **Bootstrap Templates**: 6 templates loaded locally in devbob pods
- ⚠️ **Database Schema**: NOT initialized - no tables exist
- ⚠️ **Backend Integration**: MCP registration failing (expected - using local fallback)
- ❌ **Activity Tracking**: Cannot persist to database (no schema)
- ❓ **Boredom Detection**: No evidence in logs (may not be triggered yet)

---

## Detailed Findings

### 1. Pod Status ✅

```
devbob-0                Running (12h, 1 restart)
devbob-1                Running (12h, 3 restarts)
devbob-2                Running (12h, 1 restart)
redis-master-0          Running (20h)
surrealdb               Running (26h)
metabob-rpc-api (1/2)   Running (one pod crashlooping with 67 restarts)
```

**Issue**: One metabob-rpc-api pod is crashlooping, but the other is healthy.

### 2. Configuration ✅

Environment variables properly set:
```yaml
SURREAL_HOST: surrealdb
SURREAL_PORT: 8000
SURREAL_USER: root
SURREAL_PASS: root
SURREAL_NAMESPACE: metabob
SURREAL_DATABASE: devbob
WAIT_FOR_BACKEND: false
METABOB_API_URL: http://metabob-rpc-api
```

### 3. Database Schema ❌ **CRITICAL ISSUE**

**Problem**: SurrealDB is running but database schema is not initialized.

```json
{
  "tables": {},
  "analyzers": {},
  "functions": {},
  "models": {},
  "params": {}
}
```

**Expected tables**:
- `activity_execution` - Track activity runs
- `activity_template` - Store templates
- `template_metrics` - Thompson Sampling metrics
- `task_execution` - Task-level details
- `activity_content` - Full activity data for replay

**Impact**:
- ❌ Activities cannot be persisted to database
- ❌ No learning loop (Thompson Sampling cannot function)
- ❌ No activity history for analysis
- ❌ Backend monitoring impossible

**Root Cause**: Schema initialization script (`initialize-surrealdb-schema.sql`) exists but has never been executed against the database.

### 4. Bootstrap Templates ✅ (Local Only)

6 templates successfully loaded locally on each devbob pod:
1. `create-activity`
2. `debug-activity-self-contained`
3. `evolve-activity-self-contained`
4. `manage-session-memory`
5. `trace-data-flow-single-feature`
6. `trace-enforce-validate-loop`

**Note**: Templates saved locally but NOT registered with Metabob MCP backend (expected behavior with WAIT_FOR_BACKEND=false).

### 5. Backend Integration ⚠️

MCP registration is failing for all templates:
```
WARN metabob not available for registerTemplate
WARN MCP registration failed, using local fallback
```

**Status**: This is EXPECTED behavior when:
- `WAIT_FOR_BACKEND=false`
- Metabob RPC API not fully initialized
- Using local fallback mode

**Local fallback is working correctly** - templates are usable locally.

### 6. Redis ✅

Redis is healthy:
```
PING → PONG
DBSIZE → 1
```

One key exists in Redis (likely a test or health check key).

### 7. Boredom Detection ❓

**No logs found** indicating boredom detection activity:
- No "BoredomDetector" logs
- No "BoredomMonitor" logs
- No "idle" or "bored" state logs
- No automatic activity triggers

**Possible reasons**:
1. No sessions have reached idle state threshold
2. Boredom detection not enabled in configuration
3. Boredom manager not initialized
4. Threshold not reached (may require longer idle time)

### 8. Metabob RPC API ⚠️

One of two pods is crashlooping:
```
metabob-rpc-api-7c9b865d9b-cd5dp: 67 restarts
metabob-rpc-api-7f8bb755bc-lqxb8: Running OK
```

**Impact**: Partial API availability, but not blocking local operations.

---

## Critical Issues & Recommendations

### Issue #1: Database Schema Not Initialized 🔴 **CRITICAL**

**Problem**: No tables exist in SurrealDB, preventing activity persistence and learning.

**Solution**:
1. Execute `initialize-surrealdb-schema.sql` against the database
2. Update deployment to run schema init as an init container or Job
3. Add schema version tracking to prevent re-initialization

**Command to fix immediately**:
```bash
kubectl exec -n metabob surrealdb-<pod> -- /surreal import \
  --conn http://localhost:8000 \
  --user root --pass root \
  --ns metabob --db devbob \
  /path/to/initialize-surrealdb-schema.sql
```

**Permanent fix**: Add Kubernetes Job or init container in Helm chart.

### Issue #2: No Evidence of Boredom Detection 🟡 **INVESTIGATE**

**Problem**: No logs showing boredom detection activity.

**Investigation steps**:
1. Check if BoredomManager is enabled in configuration
2. Verify idle threshold settings
3. Create a test session and wait for idle state
4. Check devbob-1 and devbob-2 logs (only checked devbob-0 so far)
5. Review boredom detector initialization logs on startup

**Expected logs when working**:
```
INFO BoredomDetector initialized threshold=<X>ms
INFO Session <id> idle for <X>ms, triggering boredom activity
INFO Executing boredom activity: <template-id>
```

### Issue #3: Metabob RPC API Pod Crashlooping 🟡 **NON-CRITICAL**

**Problem**: One of two metabob-rpc-api pods restarting constantly (67 times).

**Impact**: Limited - other pod is healthy and handling requests.

**Investigation**:
```bash
kubectl logs -n metabob metabob-rpc-api-7c9b865d9b-cd5dp --previous
kubectl describe pod -n metabob metabob-rpc-api-7c9b865d9b-cd5dp
```

---

## Verification Checklist

To verify the deployment is fully functional:

- [ ] **Database schema initialized** - Run schema SQL, verify tables exist
- [ ] **Templates in database** - Query `activity_template` table, should show 6+ templates
- [ ] **Activity execution persists** - Trigger an activity, verify `activity_execution` has data
- [ ] **Boredom detection triggers** - Create idle session, wait for threshold, check logs
- [ ] **Backend learning loop** - Run activity, verify metrics updated in `template_metrics`
- [ ] **Redis activity tracking** - Check Redis for activity state keys
- [ ] **MCP registration (optional)** - Set `WAIT_FOR_BACKEND=true`, verify registration succeeds

---

## Next Steps

### Immediate (Required for Core Functionality)
1. **Initialize database schema** - Execute `initialize-surrealdb-schema.sql`
2. **Verify templates persist** - Check `activity_template` table after init
3. **Test activity execution** - Run a simple activity and verify database persistence

### Short-term (Within 24 hours)
1. **Investigate boredom detection** - Check all devbob pods for boredom logs
2. **Fix crashlooping API pod** - Review logs and resolve issue
3. **Enable backend integration** - Set `WAIT_FOR_BACKEND=true` and test MCP registration
4. **Add schema init job** - Automate schema initialization in Helm chart

### Medium-term (Operational Hardening)
1. **Add health checks** - Database schema validation endpoint
2. **Add monitoring** - Prometheus metrics for activity execution rates
3. **Add alerting** - Alert on schema missing, pod crashloops, failed activities
4. **Document runbooks** - Common issues and resolution steps

---

## Architecture Verification

### Current State
```
┌─────────────┐
│  devbob-0   │────┐
│  devbob-1   │────┼──→ [SurrealDB] (EMPTY - no schema)
│  devbob-2   │────┘          ↓
└─────────────┘          (no tables)
      │                  (no data)
      ├──→ [Redis] ✅ (1 key)
      │
      └──→ [Metabob RPC API] ⚠️ (partial)
                  ↓
            (MCP calls fail - expected)
```

### Target State
```
┌─────────────┐
│  devbob-0   │────┐
│  devbob-1   │────┼──→ [SurrealDB] ✅
│  devbob-2   │────┘     ├── activity_execution
└─────────────┘          ├── activity_template (6+ templates)
      │                  ├── template_metrics
      │                  └── task_execution
      │
      ├──→ [Redis] ✅
      │     └── activity:<id>:state
      │
      └──→ [Metabob RPC API] ✅
            └──→ MCP Template Service ✅
```

---

## Appendix: Key Configuration

### SurrealDB Connection
```
URL: http://surrealdb:8000
Namespace: metabob
Database: devbob
Credentials: root:root
```

### Schema File
- Location: `./initialize-surrealdb-schema.sql`
- Status: EXISTS but NOT EXECUTED
- Action: Needs to be run against database

### Bootstrap Templates
- Count: 6
- Storage: Local filesystem in each devbob pod
- Backend sync: Disabled (WAIT_FOR_BACKEND=false)

### Redis
- Endpoint: redis-master:6379
- Status: Healthy
- Keys: 1 (minimal data)

---

## Conclusion

The deployment is **operational but incomplete**. Core services are running, but the database schema initialization was missed during setup. This prevents activity persistence, learning loop functionality, and proper backend integration.

**Priority**: Initialize database schema immediately to enable full functionality.

**Risk**: Low for read-only operations, HIGH for any activity execution or learning loop workflows.
