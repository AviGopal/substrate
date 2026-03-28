# Trace: surrealdb-async-await-deployment

## Specification
surrealdb-async-await-deployment - Deploy async/await fixes from commit 9756fa5 to the local Kubernetes cluster

## Context
- Fixes Completed: commit 9756fa5 in repos/metabob-rpc-api
- Current State: Code fixed locally, but deployed pod runs old broken code
- Deployment Gap: metabob-rpc-api-cdc954554-wmrnd has image metabob-rpc-api:fixed-await but needs rebuild with 9756fa5
- Validation Harness: tests/validation-harnesses/surrealdb-async-await-enforcement-harness.sh
- Target Environment: local Kubernetes (docker-desktop), metabob namespace, api.metabob.local

## Summary

**Current State**: Code has been fixed locally (commit 9756fa5) with proper async/await patterns for SurrealDB operations, but the deployed Kubernetes pod (metabob-rpc-api-cdc954554-wmrnd) still runs the old broken code.

**Desired State**: Deploy the fixed code to the local Kubernetes cluster so templates persist to SurrealDB (primary storage) and survive cache expiry.

**Data Flow (BROKEN in Current Deployment)**:
Current deployed pod: route → create_template() WITHOUT await → SurrealDB coroutine never runs → template only in Redis cache → lost on expiry

**Data Flow (FIXED after Deployment)**:
Entry: HTTP POST /v2/activities/templates → create_activity_template route handler
Transform: create_template() → await create_template_record(db) → SurrealDB INSERT
Validate: Template in SurrealDB → Redis cache → API response
Exit: Template persists after cache flush (survives Redis FLUSHALL)

## Components Analysis

### repos/metabob-rpc-api/server/actions/activity.py:303 - create_template
- **Current Behavior**: async def with await keywords for SurrealDB operations (commit 9756fa5)
- **Deployed Behavior**: Old code without proper awaits, causing RuntimeWarning coroutine errors
- **Gap**: Docker image needs rebuild from current repo state

### repos/metabob-rpc-api/server/actions/activity.py:563 - record_execution_result
- **Current Behavior**: async def with await keywords for SurrealDB insert and metrics update
- **Deployed Behavior**: Old code without awaits, metrics not persisting to SurrealDB
- **Gap**: Pod running old image

### repos/metabob-rpc-api/server/routes/activity.py:256 - create_activity_template
- **Current Behavior**: Route handler properly awaits create_template()
- **Deployed Behavior**: Old route handler, templates only cached in Redis
- **Gap**: Deployment update required

### repos/metabob-rpc-api/docker/Dockerfile.server:1 - Docker build configuration
- **Current Behavior**: Valid Dockerfile with Python 3.12-alpine base
- **Deployed Behavior**: N/A - needs build from current repo
- **Gap**: Must build from repos/metabob-rpc-api with 9756fa5 commit

### helm/charts/metabob-rpc-api/values.yaml:1 - Helm chart values
- **Current Behavior**: References metabob-rpc-api:0.12.5 (old version)
- **Deployed Behavior**: Deployment uses metabob-rpc-api:fixed-await (also old)
- **Gap**: Need to build new image with commit 9756fa5, tag appropriately, update values

## Deployment Plan

### Step step1: Build Docker image from repos/metabob-rpc-api

**Commands**:
```bash
cd repos/metabob-rpc-api
docker build -f docker/Dockerfile.server -t metabob-rpc-api:9756fa5-async-await .
```

**Validation**: Image exists in docker images list
**Component**: docker/Dockerfile.server

### Step step2: Tag image for local registry

**Commands**:
```bash
docker tag metabob-rpc-api:9756fa5-async-await metabob-rpc-api:latest
docker tag metabob-rpc-api:9756fa5-async-await metabobapp/metabob-rpc-api:9756fa5-async-await
```

**Validation**: Tagged images visible in docker images
**Component**: Docker registry

### Step step3: Update Kubernetes deployment with new image

**Commands**:
```bash
kubectl set image deployment/metabob-rpc-api -n metabob metabob-rpc-api=metabob-rpc-api:9756fa5-async-await
# Alternative: Update helm values and helmfile sync
```

**Validation**: kubectl get deployment metabob-rpc-api -n metabob shows new image
**Component**: helm/charts/metabob-rpc-api

### Step step4: Wait for rollout to complete

**Commands**:
```bash
kubectl rollout status deployment/metabob-rpc-api -n metabob --timeout=5m
```

**Validation**: Rollout status shows 'successfully rolled out'
**Component**: Kubernetes deployment

### Step step5: Verify new pod is running

**Commands**:
```bash
kubectl get pods -n metabob -l app=metabob-rpc-api
kubectl wait --for=condition=Ready pod -l app=metabob-rpc-api -n metabob --timeout=2m
```

**Validation**: Pod status is Running and Ready
**Component**: metabob-rpc-api pod

### Step step6: Validate via api.metabob.local

**Commands**:
```bash
curl http://api.metabob.local/health
curl http://api.metabob.local/v2/activities/templates
```

**Validation**: Health check returns 200, templates endpoint accessible
**Component**: API endpoint

### Step step7: Run comprehensive validation harness

**Commands**:
```bash
RPC_API_URL=http://api.metabob.local NAMESPACE=metabob ./tests/validation-harnesses/surrealdb-async-await-enforcement-harness.sh
```

**Validation**: Harness exits with code 0 (all 8 tests PASS)
**Component**: Validation harness

### Step step8: Check pod logs for coroutine warnings

**Commands**:
```bash
kubectl logs -n metabob -l app=metabob-rpc-api --tail=100 | grep -i 'coroutine.*never awaited'
```

**Validation**: Zero coroutine warnings (grep returns no matches)
**Component**: Pod logs

## Validation Criteria (8 Tests)

test1_api_health:
- Description: API is accessible at api.metabob.local
- Command: `curl -f http://api.metabob.local/health`
- Expected: HTTP 200, health endpoint responds

test2_create_template:
- Description: POST /v2/activities/templates creates template
- Command: `curl -X POST -H 'Content-Type: application/json' -d '{...}' http://api.metabob.local/v2/activities/templates`
- Expected: Returns variant_id and activity_id

test3_redis_cache_hit:
- Description: GET /v2/activities/templates/{variant_id} returns from cache
- Command: `curl http://api.metabob.local/v2/activities/templates/{variant_id}`
- Expected: Template returned (from Redis cache)

test4_no_coroutine_warnings:
- Description: Pod logs show zero RuntimeWarning messages
- Command: `kubectl logs -n metabob <pod> --tail=100 | grep 'coroutine.*was never awaited' | wc -l`
- Expected: 0 (no warnings)

test5_surrealdb_persistence:
- Description: Template exists in SurrealDB primary storage
- Command: `kubectl exec -n metabob surrealdb-0 -- surreal sql ... 'SELECT * FROM activity_template WHERE variant_id = ...'`
- Expected: Query returns 1 record

test6_cache_flush:
- Description: Redis cache can be flushed without data loss
- Command: `kubectl exec -n metabob redis-0 -- redis-cli FLUSHALL`
- Expected: Cache flushed successfully

test7_surrealdb_fallback:
- Description: Template still accessible after cache flush (loaded from SurrealDB)
- Command: `curl http://api.metabob.local/v2/activities/templates/{variant_id}`
- Expected: Template returned (from SurrealDB fallback)

test8_storage_sync:
- Description: Redis and SurrealDB are synchronized
- Command: `curl API, check Redis key exists`
- Expected: Template repopulated in Redis from SurrealDB

## Architecture Comparison

### Before (Current Deployed State)
- client: HTTP POST /v2/activities/templates
- handler: create_activity_template route (without await)
- action: create_template() function (missing await)
- database: SurrealDB coroutine never executed
- cache: Redis cache updated (temporary)
- result: Template lost after 1 hour TTL expiry

### After (With Fixes Deployed)
- client: HTTP POST /v2/activities/templates
- handler: create_activity_template route (with await)
- action: create_template() async function (with await)
- database: await create_template_record() → SurrealDB INSERT (primary)
- cache: Redis cache updated (TTL 1 hour)
- result: Template persists permanently in SurrealDB, cached in Redis

## Success Metrics
- Validation harness exit code 0 (all 8 tests pass)
- Zero 'coroutine was never awaited' warnings in pod logs
- Templates created via API persist to SurrealDB (verified via direct query)
- Templates survive Redis cache flush (loaded from SurrealDB fallback)
- GET /v2/activities/templates returns persisted templates after pod restart

## Known Issues
### issue1
- Description: Current pod metabob-rpc-api-cdc954554-wmrnd runs old code
- Impact: Templates not persisting to SurrealDB, only cached in Redis
- Resolution: Build new Docker image from commit 9756fa5 and deploy

### issue2
- Description: Helm values reference outdated image tag 0.12.5
- Impact: Helmfile sync would revert to old version
- Resolution: Update helm/charts/metabob-rpc-api/values.yaml with new tag

### issue3
- Description: Image tag 'fixed-await' doesn't reflect commit 9756fa5
- Impact: Tag name ambiguous, unclear which fixes are included
- Resolution: Use semantic tag: 9756fa5-async-await or 0.17.0-async-await

## Risk Analysis
### risk1
- Description: Docker build fails due to missing dependencies
- Likelihood: Low
- Mitigation: Dockerfile.server already validated, Python deps in requirements.txt

### risk2
- Description: Kubernetes rollout timeout
- Likelihood: Low
- Mitigation: Increase timeout to 10m if needed, pod resources already allocated

### risk3
- Description: Breaking changes to API contract
- Likelihood: None
- Mitigation: Commit 9756fa5 only adds await keywords, no API signature changes

### risk4
- Description: Validation harness fails on first run
- Likelihood: Medium
- Mitigation: Harness may need env var adjustments (RPC_API_URL, NAMESPACE), documented in harness header

## Rollback Plan
- **if_deployment_fails**: kubectl rollout undo deployment/metabob-rpc-api -n metabob
- **if_validation_fails**: Revert to previous image tag via kubectl set image
- **if_api_breaks**: Check pod logs for errors, rollback immediately
- **data_safety**: No data loss risk - Redis is cache only, SurrealDB has no breaking schema changes

## Related Specifications
- surrealdb-primary-redis-cache
- metrics-calculation-in-rpc-api-only
- thompson-sampling-in-rpc-api-only
- project-scoped-template-filtering
- activity-template-query-filtering

## Files Involved
- repos/metabob-rpc-api/server/actions/activity.py (5 functions: create_template, record_execution_result, create_variant, list_templates, get_template_by_id)
- repos/metabob-rpc-api/server/routes/activity.py (5 route handlers updated to await async functions)
- repos/metabob-rpc-api/docker/Dockerfile.server (build config)
- helm/charts/metabob-rpc-api/values.yaml (deployment config)
- helm/helmfile.yaml (orchestration)
- tests/validation-harnesses/surrealdb-async-await-enforcement-harness.sh (validation)

## Complete Deployment Script

```bash
# Step 1: Build Docker image
cd repos/metabob-rpc-api
docker build -f docker/Dockerfile.server -t metabob-rpc-api:9756fa5-async-await .

# Step 2: Tag for local use
docker tag metabob-rpc-api:9756fa5-async-await metabob-rpc-api:latest

# Step 3: Update deployment
kubectl set image deployment/metabob-rpc-api -n metabob metabob-rpc-api=metabob-rpc-api:9756fa5-async-await --record

# Step 4: Wait for rollout
kubectl rollout status deployment/metabob-rpc-api -n metabob --timeout=5m

# Step 5: Verify pod
kubectl get pods -n metabob -l app=metabob-rpc-api
kubectl wait --for=condition=Ready pod -l app=metabob-rpc-api -n metabob --timeout=2m

# Step 6: Test API
curl http://api.metabob.local/health
curl http://api.metabob.local/v2/activities/templates

# Step 7: Run validation harness
RPC_API_URL=http://api.metabob.local NAMESPACE=metabob ./tests/validation-harnesses/surrealdb-async-await-enforcement-harness.sh

# Step 8: Check logs for warnings
kubectl logs -n metabob -l app=metabob-rpc-api --tail=100 | grep -i 'coroutine.*never awaited'
```

## Next Steps
1. Build Docker image from repos/metabob-rpc-api with commit 9756fa5
2. Tag image: metabob-rpc-api:9756fa5-async-await
3. Update Kubernetes deployment: kubectl set image deployment/metabob-rpc-api
4. Wait for rollout: kubectl rollout status
5. Verify pod ready: kubectl wait --for=condition=Ready
6. Test API: curl http://api.metabob.local/v2/activities/templates
7. Run validation harness: tests/validation-harnesses/surrealdb-async-await-enforcement-harness.sh
8. Check logs: kubectl logs -n metabob -l app=metabob-rpc-api | grep coroutine
9. Verify SurrealDB persistence: kubectl exec surrealdb-0 -- surreal sql ...
10. Document deployment: Update DEPLOYMENT_STATUS.md with results

