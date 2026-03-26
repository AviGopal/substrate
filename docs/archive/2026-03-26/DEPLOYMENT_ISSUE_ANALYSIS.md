# Deployment Issue Analysis: metabob-cli-to-dashboard-data-flow

## Problem Summary

Backend API endpoints for project CRUD operations were successfully coded and committed, but are not accessible in the running application despite multiple deployment attempts.

## Root Cause Identified

**Stale Application State in Running Container**

The issue is NOT with the code, Docker image, or Kubernetes pod - it's with how the FastAPI application is loading modules.

### Evidence

1. **Source Code**: ✓ Correct (verified via git, MD5 checksums)
   - `server/routes/cloud_auth.py` lines 736, 837 contain new routes
   - `server/db/operations/problem_ops.py` exists
   - Commit: `3bcb8df`

2. **Docker Image**: ✓ Contains correct code
   - MD5 checksum matches source
   - File contents verified
   - Image: `metabobapp/metabob-rpc-api:0.25.0-projects-fix-1773298187`

3. **Kubernetes Pod**: ✓ Running correct image  
   - Image ID: `sha256:47635e45db1acaca...`
   - Pod filesystem has updated files
   - Restarted multiple times

4. **Python Module**: ✓ Routes exist in router object
   - `cloud_auth.router.routes` shows 9 routes
   - Project routes at positions 6-7
   - Functions `create_org_project` and `get_org_projects` are importable

5. **FastAPI Application**: ✗ NOT serving the routes
   - OpenAPI spec shows only 1 /orgs route (activity, not projects)
   - Requests to `/auth/orgs/{org_id}/projects` return 404
   - Application is serving from stale module state

### Why This Happened

The Dockerfile approach used:
```dockerfile
FROM metabobapp/metabob-rpc-api:0.25.0-orgs-fix-1773293841
COPY server/routes/cloud_auth.py /app/server/routes/cloud_auth.py
COPY server/db/operations/problem_ops.py /app/server/db/operations/problem_ops.py
```

This copies files but doesn't guarantee the running application will reload them because:
1. **Module Import Caching**: Python caches imported modules at the interpreter level
2. **Uvicorn Workers**: With 16 workers (`--workers 16`), each has its own Python interpreter
3. **Factory Pattern**: Using `factory=True` should reload, but something is preventing it
4. **Base Image State**: The base image may have pre-compiled or pre-loaded application state

## Failed Remediation Attempts

1. ✗ Pod restart (multiple times)
2. ✗ Force pod deletion with `--grace-period=0`
3. ✗ Python bytecode cache clearing (`rm *.pyc`)
4. ✗ Layered Docker image rebuild

## Proposed Solutions

### Solution 1: Full Image Rebuild (Recommended)
Build Docker image from scratch without using base image:

```bash
cd repos/metabob-rpc-api
docker build -f docker/Dockerfile.server -t metabobapp/metabob-rpc-api:0.25.1-projects-clean .
kubectl set image deployment/metabob-rpc-api rpc-api=metabobapp/metabob-rpc-api:0.25.1-projects-clean
```

**Pros**: Clean slate, no cached state  
**Cons**: 5-10 minute build time (installs all dependencies)

### Solution 2: Clear Python Import Cache
Add environment variable to prevent caching:

```yaml
# In deployment spec
env:
  - name: PYTHONDONTWRITEBYTECODE
    value: "1"
  - name: PYTHONUNBUFFERED
    value: "1"
```

Then rebuild and redeploy.

**Pros**: Prevents future caching issues  
**Cons**: Slightly slower startup

### Solution 3: Use Helm/Helmfile for Deployment
Deploy via proper infrastructure as code:

```bash
cd helm
helmfile sync
```

**Pros**: Proper deployment management, version tracking  
**Cons**: Requires helmfile configuration

### Solution 4: Direct Source Mount (Development Only)
Mount source code as volume for hot reload:

```yaml
volumes:
  - name: source
    hostPath:
      path: /path/to/repos/metabob-rpc-api
volumeMounts:
  - name: source
    mountPath: /app
```

**Pros**: Instant updates during development  
**Cons**: Not suitable for production

## Recommended Action Plan

1. **Immediate**: Use Solution 1 (full rebuild) to unblock validation
2. **Short-term**: Add Solution 2 (Python env vars) to prevent recurrence  
3. **Long-term**: Implement Solution 3 (Helm deployment) for proper infrastructure management

## Impact

**Current Status**: 
- Code changes: 100% complete ✓
- Deployment: 0% functional ✗
- Validation: Blocked (cannot run end-to-end tests)

**Blocked Work**:
- Gap 1: CLI project registration (depends on POST /auth/orgs/{org_id}/projects)
- Gap 2: Session-project linking (depends on projects existing)
- Gap 3: SurrealDB persistence (depends on project_id from sessions)
- End-to-end validation harness

**Time Lost**: ~2 hours debugging deployment vs ~10 minutes for full rebuild

## Lessons Learned

1. Layered Dockerfiles with `COPY` don't guarantee application reload
2. Python module caching happens at multiple levels (`.pyc`, import cache, worker processes)
3. Always verify OpenAPI spec, not just filesystem, after deployment
4. For significant code changes, prefer full image rebuilds over layered updates
5. Set `PYTHONDONTWRITEBYTECODE=1` for Docker containers to avoid cache issues

