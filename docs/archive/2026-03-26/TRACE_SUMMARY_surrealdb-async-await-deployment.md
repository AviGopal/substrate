# Trace Summary: surrealdb-async-await-deployment

## Executive Summary

**Specification**: Deploy async/await fixes from commit 9756fa5 to local Kubernetes cluster (metabob namespace).

**Problem**: Code has been fixed locally with proper async/await patterns for SurrealDB operations, but the deployed pod (`metabob-rpc-api-cdc954554-wmrnd`) still runs the old broken code. Templates are not persisting to SurrealDB, only cached in Redis, causing data loss after 1 hour TTL expiry.

**Solution**: Build Docker image from `repos/metabob-rpc-api` with commit 9756fa5, deploy to local Kubernetes cluster, validate via comprehensive harness.

---

## Current State vs Desired State

### Current State (BROKEN)
- **Local Code**: Fixed (commit 9756fa5) - all async/await keywords present
- **Deployed Pod**: Old code - missing await keywords
- **Data Flow**: HTTP POST → create_template() WITHOUT await → coroutine never runs → template only in Redis → lost after 1 hour
- **Pod Logs**: RuntimeWarning: coroutine 'create_template_record' was never awaited
- **Learning Loop**: Broken - metrics not persisting to SurrealDB

### Desired State (WORKING)
- **Deployed Pod**: New image with commit 9756fa5 fixes
- **Data Flow**: HTTP POST → await create_template() → await create_template_record() → SurrealDB INSERT (primary) → Redis cache (TTL) → response
- **Pod Logs**: Zero coroutine warnings
- **Learning Loop**: Working - metrics persist, Thompson sampling functional
- **Persistence**: Templates survive cache flush and pod restarts

---

## Components Involved

| Component | File | Line | Current Behavior | Gap |
|-----------|------|------|------------------|-----|
| `create_template` | repos/metabob-rpc-api/server/actions/activity.py | 303 | async def with await (fixed) | Need deployment |
| `record_execution_result` | repos/metabob-rpc-api/server/actions/activity.py | 563 | async def with await (fixed) | Need deployment |
| `create_activity_template` | repos/metabob-rpc-api/server/routes/activity.py | 256 | Route handler awaits properly (fixed) | Need deployment |
| Dockerfile | repos/metabob-rpc-api/docker/Dockerfile.server | 1 | Valid, ready to build | Need build |
| Helm values | helm/charts/metabob-rpc-api/values.yaml | 1 | References old tag 0.12.5 | Need update |

---

## Data Flow Trace

### Entry Point
```
HTTP POST /v2/activities/templates
  ↓
FastAPI route: create_activity_template (line 256)
```

### Transform
```
await create_template(redis, template_data)
  ↓
await create_template_record(template_data)  # SurrealDB INSERT (PRIMARY)
  ↓
await create_metrics(variant_id)             # Initialize metrics
  ↓
redis.set(f"activity:template:{variant_id}") # Cache (TTL 1 hour)
```

### Validate
```
Template exists in:
  1. SurrealDB (activity_template table) - PRIMARY, permanent
  2. Redis cache (activity:template:*) - CACHE, 1 hour TTL
```

### Exit
```
Return {
  variant_id: "...",
  activity_id: "...",
  name: "...",
  ...
}
```

### Broken Flow (Current Deployment)
```
HTTP POST /v2/activities/templates
  ↓
create_activity_template route (NO await)
  ↓
create_template() called (NO await)
  ↓
create_template_record() coroutine created but NEVER awaited
  ↓
⚠️ RuntimeWarning: coroutine was never awaited
  ↓
Template only in Redis cache (temporary)
  ↓
❌ Lost after 1 hour TTL expiry
```

---

## Deployment Plan (8 Steps)

### Step 1: Build Docker Image
```bash
cd repos/metabob-rpc-api
docker build -f docker/Dockerfile.server -t metabob-rpc-api:9756fa5-async-await .
```
**Expected**: Image builds successfully (2-5 minutes)

### Step 2: Tag Image for Local Use
```bash
docker tag metabob-rpc-api:9756fa5-async-await metabob-rpc-api:latest
docker tag metabob-rpc-api:9756fa5-async-await metabobapp/metabob-rpc-api:9756fa5-async-await
```
**Expected**: Tags visible in `docker images`

### Step 3: Update Kubernetes Deployment
```bash
kubectl set image deployment/metabob-rpc-api -n metabob \
  metabob-rpc-api=metabob-rpc-api:9756fa5-async-await --record
```
**Expected**: Deployment updated, rollout triggered

### Step 4: Wait for Rollout
```bash
kubectl rollout status deployment/metabob-rpc-api -n metabob --timeout=5m
```
**Expected**: "successfully rolled out" message

### Step 5: Verify New Pod
```bash
kubectl get pods -n metabob -l app=metabob-rpc-api
kubectl wait --for=condition=Ready pod -l app=metabob-rpc-api -n metabob --timeout=2m
```
**Expected**: Pod status = Running, Ready

### Step 6: Test API Endpoints
```bash
curl http://api.metabob.local/health
curl http://api.metabob.local/v2/activities/templates
```
**Expected**: Both return HTTP 200

### Step 7: Run Validation Harness
```bash
RPC_API_URL=http://api.metabob.local \
NAMESPACE=metabob \
./tests/validation-harnesses/surrealdb-async-await-enforcement-harness.sh
```
**Expected**: Exit code 0, all 8 tests PASS

### Step 8: Check Pod Logs
```bash
kubectl logs -n metabob -l app=metabob-rpc-api --tail=100 | \
  grep -i 'coroutine.*never awaited'
```
**Expected**: Zero matches (no warnings)

---

## Validation Criteria (8 Tests)

The validation harness tests/validation-harnesses/surrealdb-async-await-enforcement-harness.sh performs:

1. **API Health Check**: Verify api.metabob.local is accessible
2. **Create Template**: POST /v2/activities/templates returns variant_id
3. **Redis Cache Hit**: GET template from cache (immediate response)
4. **No Coroutine Warnings**: Pod logs show zero RuntimeWarning messages
5. **SurrealDB Persistence**: Template exists in activity_template table
6. **Cache Flush**: Redis FLUSHALL succeeds without data loss
7. **SurrealDB Fallback**: Template still accessible after cache flush
8. **Storage Sync**: Redis and SurrealDB are synchronized

---

## Success Metrics

- ✅ Validation harness exits with code 0 (all 8 tests pass)
- ✅ Zero "coroutine was never awaited" warnings in pod logs
- ✅ Templates created via API persist to SurrealDB (verified via direct query)
- ✅ Templates survive Redis cache flush (loaded from SurrealDB fallback)
- ✅ GET /v2/activities/templates returns persisted templates after pod restart

---

## Risk Analysis

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Docker build fails | Low | Dockerfile.server validated, deps in requirements.txt |
| Kubernetes rollout timeout | Low | Can increase timeout to 10m, resources pre-allocated |
| Breaking API changes | None | Commit 9756fa5 only adds await keywords, no signature changes |
| Validation harness fails | Medium | May need env var adjustments (RPC_API_URL, NAMESPACE) |

---

## Rollback Plan

| Scenario | Action |
|----------|--------|
| Deployment fails | `kubectl rollout undo deployment/metabob-rpc-api -n metabob` |
| Validation fails | `kubectl set image deployment/metabob-rpc-api -n metabob metabob-rpc-api=metabob-rpc-api:fixed-await` |
| API breaks | Check pod logs, immediate rollback to previous version |
| Data safety | No risk - Redis is cache only, SurrealDB has no schema changes |

---

## Known Issues

1. **Current pod runs old code**
   - Pod: metabob-rpc-api-cdc954554-wmrnd
   - Image: metabob-rpc-api:fixed-await (outdated)
   - Impact: Templates not persisting, only cached in Redis
   - Resolution: Build new image with commit 9756fa5

2. **Helm values reference outdated tag**
   - File: helm/charts/metabob-rpc-api/values.yaml
   - Current: tag: 0.12.5
   - Impact: Helmfile sync would revert to old version
   - Resolution: Update values.yaml after successful deployment

3. **Ambiguous image tag naming**
   - Current: "fixed-await" doesn't specify which fixes
   - Proposed: "9756fa5-async-await" or "0.17.0-async-await"
   - Impact: Clear versioning for future troubleshooting

---

## Related Specifications

- **surrealdb-primary-redis-cache**: Defines write-first to SurrealDB pattern
- **metrics-calculation-in-rpc-api-only**: Thompson sampling metrics persistence
- **thompson-sampling-in-rpc-api-only**: Learning loop depends on persisted metrics
- **project-scoped-template-filtering**: Template queries require SurrealDB persistence
- **activity-template-query-filtering**: Filtering depends on SurrealDB data

---

## Files Involved

- repos/metabob-rpc-api/server/actions/activity.py (5 functions modified)
- repos/metabob-rpc-api/server/routes/activity.py (5 route handlers updated)
- repos/metabob-rpc-api/docker/Dockerfile.server (build configuration)
- helm/charts/metabob-rpc-api/values.yaml (deployment configuration)
- helm/helmfile.yaml (orchestration)
- tests/validation-harnesses/surrealdb-async-await-enforcement-harness.sh (validation)

---

## Trace Impulse Details

- **Impulse ID**: trace-surrealdb-async-await-deployment
- **Location**: impulses/trace-surrealdb-async-await-deployment.md
- **Size**: 309 lines
- **Budget**: 5000 tokens
- **Contains**: Full deployment plan, validation criteria, risk analysis, rollback procedures

---

## Next Steps for Downstream Tasks

1. **Enforcement Task**: Execute deployment plan (8 steps)
2. **Validation Task**: Run validation harness, verify all 8 tests pass
3. **Documentation Task**: Update deployment status, record pod logs, capture metrics
4. **Learning Task**: Record deployment success/failure for future template optimization

---

## Critical Path

1. Build Docker image from repos/metabob-rpc-api **(2-5 min)**
2. Update Kubernetes deployment **(30 sec)**
3. Wait for rollout completion **(1-3 min)**
4. Run validation harness **(2-3 min)**

**Total Estimated Time**: 5-10 minutes

---

## Architecture Diagram

```
┌──────────────────────────────────────────────────────────────┐
│                   BEFORE (Broken)                           │
├──────────────────────────────────────────────────────────────┤
│ Client                                                       │
│   ↓ POST /v2/activities/templates                          │
│ Route Handler (no await)                                    │
│   ↓ create_template() called                               │
│ Action Function (no await)                                  │
│   ↓ create_template_record() coroutine NEVER EXECUTED      │
│ ❌ SurrealDB: NO WRITE                                      │
│ ✓ Redis: Cached (temporary, 1 hour TTL)                   │
│ Result: Template lost after expiry                         │
└──────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────┐
│                   AFTER (Fixed)                             │
├──────────────────────────────────────────────────────────────┤
│ Client                                                       │
│   ↓ POST /v2/activities/templates                          │
│ Route Handler (with await)                                  │
│   ↓ await create_template()                                │
│ Action Function (with await)                                │
│   ↓ await create_template_record()                         │
│ ✅ SurrealDB: WRITE (PRIMARY, permanent)                    │
│   ↓                                                          │
│ ✅ Redis: Cache (secondary, 1 hour TTL)                     │
│ Result: Template persists permanently                       │
└──────────────────────────────────────────────────────────────┘
```

---

**End of Trace Summary**
