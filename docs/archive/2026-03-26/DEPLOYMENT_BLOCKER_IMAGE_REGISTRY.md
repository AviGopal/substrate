# Deployment Blocker: Docker Image Registry Access

## Issue
Cannot deploy project persistence fix (commit adb858a) to Kubernetes cluster.

## Root Cause
1. Docker image built locally: `metabobapp/metabob-rpc-api:0.28.3-project-persistence-fix`
2. Image exists in local Docker but not pushed to registry
3. Kubernetes `imagePullPolicy: IfNotPresent` works for first pod (cached)
4. New pods fail with `ErrImagePull`: "pull access denied for metabobapp/metabob-rpc-api"
5. Container filesystem is read-only (can't hot-patch)

## Attempted Workarounds
❌ **kubectl cp + overwrite**: Read-only file system  
❌ **imagePullPolicy: Always**: Tries to pull from registry (fails)  
❌ **Docker COPY in Dockerfile**: Layer caching issues, base image already has file  

## Current State
- Code fix: ✅ Committed (adb858a)
- Docker image: ✅ Built locally
- Kubernetes deployment: ❌ Blocked (no registry push)
- Running pod: Has old code (db.create pattern)

## Required Solution
**Push image to registry** (one of):
1. Docker Hub: `docker push metabobapp/metabob-rpc-api:0.28.3-project-persistence-fix`
2. Private registry: Configure and push
3. Local registry: Set up local Docker registry for k8s

## Temporary Workaround for Testing
Since we cannot deploy the fix, we'll:
1. **Document the bug** (already done in SURREALDB_PERSISTENCE_BUG_AUDIT.md)
2. **Test current behavior** with Playwright to establish baseline
3. **Test authentication flow** (which IS fixed and deployed)
4. **Create comprehensive test suite** for post-deployment validation

## Files Ready for Deployment
- `repos/metabob-rpc-api/server/db/operations/project_ops.py` (SQL INSERT fix)
- `Dockerfile.project-persistence-fix` (build configuration)
- Helm values updated: `tag: 0.28.3-project-persistence-fix`

## Next Steps
1. Get Docker Hub credentials or set up registry access
2. Push image: `docker push metabobapp/metabob-rpc-api:0.28.3-project-persistence-fix`
3. Redeploy with `kubectl rollout restart`
4. Validate fix with E2E tests

## Testing Plan (Current Code)
Without the fix deployed, we can still:
- ✅ Test dashboard login (auth fix IS deployed)
- ✅ Test project creation API (returns 200, shows bug)
- ✅ Test project list API (returns empty, confirms bug)
- ✅ Document expected behavior vs actual
- ✅ Create Playwright test scripts for post-deployment validation
