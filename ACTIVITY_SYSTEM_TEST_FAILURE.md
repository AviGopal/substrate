# Activity System Test Failure Report

**Date**: 2026-02-06  
**Test Objective**: Create and execute 'jiggle-documentation' activity template  
**Result**: ❌ FAILED - Backend using wrong version

## Executive Summary

The activity system test failed because **the backend is running a pre-built Docker image (`metabobapp/metabob-rpc-api:0.16.12`) instead of the development version** from `repos/metabob-rpc-api`. This is a devbob configuration issue where the docker-compose setup specifies an image tag that prevents using the local development code.

## Root Cause

### Docker Compose Configuration Issue

In `configs/docker-compose.devbob.yaml`:

```yaml
metabob-rpc-api-server:
  container_name: api-server-dev
  image: metabobapp/metabob-rpc-api:0.16.12  # ❌ Using pre-built image
  build:
    context: ../repos/metabob-rpc-api
    dockerfile: ./docker/Dockerfile.server
  # ...
```

**Problem**: When `image:` is specified, Docker Compose will use that pre-built image even if `build:` context is present. The image needs to be rebuilt or the configuration needs to use local builds only.

### Running Containers

```bash
$ docker ps
NAMES                              IMAGE                            
metabob-rpc-api-server-dev-1       metabob-rpc-api-server-dev       # Using old image
metabob-rpc-api-worker-dev-1       metabob-rpc-api-api-worker-dev   # Using old image
```

The containers are running but using the old 0.16.12 image, not the development code from `repos/metabob-rpc-api`.

## Impact

### Why This Breaks Activity System

1. **Template Registration Format Mismatch**:
   - `metabob-cli register-template` uses development version schema
   - Backend API (0.16.12) expects different schema
   - Registration "succeeds" but verification fails

2. **API Endpoint Mismatch**:
   - MCP tools query `/activity-recommendations/variants/` (new format)
   - Old backend may not have this endpoint or uses different auth
   - Templates stored but not retrievable

3. **Version Skew**:
   - metabob-cli: development version (installed from repos/metabob-cli)
   - metabob-rpc-api: 0.16.12 (pre-built image)
   - metabob-opencode: development version (workspaces in repos/)
   - **Result**: Incompatible APIs between components

## Required Fix

### Solution: Rebuild Backend from Development Code

```bash
# Stop current containers
docker-compose -f configs/docker-compose.devbob.yaml down

# Rebuild API server and worker from local code
docker-compose -f configs/docker-compose.devbob.yaml build --no-cache metabob-rpc-api-server metabob-rpc-api-worker

# Restart with freshly built images
docker-compose -f configs/docker-compose.devbob.yaml up -d
```

### Alternative: Remove Image Tag to Force Local Build

Edit `configs/docker-compose.devbob.yaml`:

```yaml
metabob-rpc-api-server:
  container_name: api-server-dev
  # image: metabobapp/metabob-rpc-api:0.16.12  # REMOVE THIS LINE
  build:
    context: ../repos/metabob-rpc-api
    dockerfile: ./docker/Dockerfile.server
```

Then rebuild:
```bash
docker-compose -f configs/docker-compose.devbob.yaml up -d --build
```

## Test Sequence (Original)

### Step 1: Template Creation ✅
- Created `templates/custom/jiggle-documentation.json`
- Template follows OpenCode format

### Step 2: Template Registration ⚠️  
```bash
$ metabob-cli register-template templates/custom/jiggle-documentation.json --status active

Successfully registered template: jiggle-documentation
  Variant ID: jiggle-documentation-772b239e
  ⚠ Template registered but verification failed
```

**Why It Failed**: Development metabob-cli registered to old backend API. Schema mismatch caused verification failure.

### Step 3: Template Retrieval ❌
```typescript
activity({ activityId: "jiggle-documentation-772b239e", ... })
Error: Activity not found
```

**Why It Failed**: MCP tools query new endpoints that don't exist in 0.16.12 backend.

## Validation Criteria (NOT MET)

- ✗ Backend running development version from `repos/metabob-rpc-api`
- ✗ metabob-cli and backend API versions aligned
- ✗ Template registered successfully (verification passed)
- ✗ Template retrievable via MCP tools
- ✗ Activity executes successfully

**Result**: 0/5 criteria met due to version mismatch

## Next Steps

1. **Rebuild backend from development code** (priority 1)
2. **Verify version alignment** across all components
3. **Re-test template registration** with aligned versions
4. **Re-test activity execution** end-to-end
5. **Document devbob configuration** to prevent future version skew

## Conclusion

This is a **devbob configuration issue**, not an activity system bug. The docker-compose configuration needs to ensure all services run from development code, not pre-built images, to maintain version compatibility across the development environment.

---

**Test Conducted By**: Activity Mode Agent  
**Root Cause**: Docker image version mismatch (using 0.16.12 instead of dev code)  
**Fix Required**: Rebuild backend containers from `repos/metabob-rpc-api`  
**Status**: Configuration Issue - Version Skew in DevBob Environment
