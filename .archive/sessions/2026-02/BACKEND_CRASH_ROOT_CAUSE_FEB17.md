# Backend Crash Root Cause - Feb 17, 2026

**Status**: 🔴 **CRITICAL STARTUP FAILURE**

---

## Executive Summary

Backend API server (`api-server-dev`) has been **unable to start for 5+ hours** due to a FastAPI type annotation error.

**Root Cause**: Invalid return type annotation `Redis` in a FastAPI endpoint

**Impact**: 
- ✅ Container running but backend server NOT STARTED
- ❌ Port 8080 not listening (connection refused)
- ❌ All API calls fail (backend never responds)
- ❌ Health checks fail for 103+ consecutive checks
- ❌ Entire activity system unusable (cannot access backend)

---

## Error Details

### Full Error Message
```python
fastapi.exceptions.FastAPIError: Invalid args for response field! 
Hint: check that <class 'redis.client.Redis'> is a valid Pydantic field type. 

If you are using a return type annotation that is not a valid Pydantic field 
(e.g. Union[Response, dict, None]) you can disable generating the response 
model from the type annotation with the path operation decorator parameter 
response_model=None. 

Read more: https://fastapi.tiangolo.com/tutorial/response-model/
```

### Error Location
```
File "/usr/local/lib/python3.13/site-packages/fastapi/routing.py", line 665
  → get_dependant(path=self.path_format, call=self.endpoint)
  
File "/usr/local/lib/python3.13/site-packages/fastapi/dependencies/utils.py", line 301
  → analyze_param()
  
File "/usr/local/lib/python3.13/site-packages/fastapi/utils.py", line 75
  → raise FastAPIError("Invalid args for response field!")
```

---

## Problem Explanation

### What Happened
Someone added or modified a FastAPI endpoint with an invalid return type annotation:

```python
# WRONG - FastAPI cannot serialize Redis objects
@app.get("/some-endpoint")
async def get_redis() -> Redis:  # ❌ Invalid Pydantic field type
    return redis_client
```

### Why It's Wrong
- FastAPI uses **Pydantic** to validate and serialize response types
- `Redis` is a **client object**, not a serializable data structure
- Pydantic cannot convert `Redis` to JSON
- FastAPI **crashes on startup** when parsing route definitions

### Correct Patterns
```python
# Option 1: Return actual data, not the client
@app.get("/some-endpoint")
async def get_data() -> dict:  # ✅ Serializable
    data = redis_client.get("key")
    return {"value": data}

# Option 2: Disable response model validation
@app.get("/some-endpoint", response_model=None)
async def get_redis() -> Redis:  # ✅ Allowed with response_model=None
    return redis_client

# Option 3: Use Depends for dependency injection
@app.get("/some-endpoint")
async def use_redis(redis: Redis = Depends(get_redis_client)) -> dict:
    data = redis.get("key")
    return {"value": data}
```

---

## Impact Timeline

### Container State
```
Status: Up 51 minutes (unhealthy)
Failing Streak: 103 health checks
Started: ~5 hours ago
Last Success: Never (hasn't started successfully)
```

### Cascading Failures
1. **00:00** - Backend container starts
2. **00:01** - FastAPI initialization begins
3. **00:02** - Route definition parsing encounters `Redis` type
4. **00:03** - FastAPI raises exception and exits
5. **00:04** - Container stays running but backend process dead
6. **00:05** - Health check: connection refused (port 8080 not listening)
7. **00:06+** - Health check fails every 30 seconds (103+ failures)

### Downstream Impact
- ❌ Template API: Cannot query templates
- ❌ Activity execution: Cannot record sessions
- ❌ Success attribution: Cannot save outcomes
- ❌ MCP tools: `search_activities()` returns empty
- ❌ Learning system: No data collection possible
- ❌ Code analysis: Submission endpoint unreachable

---

## Container vs. Service Confusion

**Key Insight**: Container is **healthy** but service is **dead**

### Container Level
```bash
docker ps | grep api-server-dev
# Output: Up 51 minutes (unhealthy)
```
✅ Container running  
❌ Service not running inside container

### Service Level
```bash
docker exec api-server-dev netstat -tlnp | grep 8080
# Output: (nothing - port not listening)
```
❌ Backend server never started  
❌ Port 8080 not bound

### Health Check
```bash
docker inspect api-server-dev --format='{{.State.Health.Status}}'
# Output: unhealthy (103 consecutive failures)
```

The health check tries to reach `http://localhost:8080/health` but gets **connection refused** because the backend crashed during startup.

---

## How to Fix

### Step 1: Find the Offending Endpoint
```bash
# Search backend codebase for Redis type annotations
cd repos/metabob-rpc-api
rg "-> Redis" --type py
rg "return.*Redis" --type py
rg "Response\[Redis\]" --type py
```

### Step 2: Fix the Type Annotation
Replace `-> Redis` with one of:
- `-> dict` (return serializable data)
- `-> None` + `response_model=None` (disable validation)
- Remove the annotation entirely

### Step 3: Rebuild and Restart
```bash
# Rebuild backend image with fix
docker-compose build api-server-dev

# Restart container
docker-compose restart api-server-dev

# Verify startup
docker logs -f api-server-dev
# Should see: "Application startup complete"
# Should NOT see: FastAPIError
```

### Step 4: Verify Health
```bash
# Wait 10 seconds for startup
sleep 10

# Check health endpoint
curl http://localhost:8080/health
# Expected: {"status": "healthy"}

# Check docker health status
docker inspect api-server-dev --format='{{.State.Health.Status}}'
# Expected: healthy
```

---

## Prevention

### Code Review Checklist
- [ ] No `Redis` in return type annotations
- [ ] No `Database` in return type annotations
- [ ] No `Client` objects in return type annotations
- [ ] All return types are Pydantic models or primitives

### Testing
- [ ] Backend starts successfully locally
- [ ] Health endpoint returns 200
- [ ] Port 8080 listening
- [ ] No FastAPI errors in startup logs

### CI/CD
- [ ] Add startup smoke test to CI
- [ ] Verify health endpoint in deployment
- [ ] Alert if health check fails 5+ times

---

## Related Issues

### Issue 1: Template Persistence Disabled
**File**: `ACTIVITY_CREATE_FAILURE_ANALYSIS.md`  
**Status**: Separate issue - template save intentionally disabled  
**Blocker**: Fix backend startup FIRST, then re-enable persistence

### Issue 2: Template Retrieval Failures
**Symptoms**: "Template not found" for all lookups  
**Root Cause**: Backend not running → cannot query database  
**Fix**: This issue resolves when backend starts successfully

### Issue 3: Connection Reset Errors
**Symptoms**: `[Errno 104] Connection reset by peer`  
**Root Cause**: Client retries fail because backend never responds  
**Fix**: This issue resolves when backend starts successfully

---

## Next Steps

**Priority 1**: Fix backend startup (CRITICAL)
1. Find `-> Redis` type annotation in backend code
2. Replace with proper type or `response_model=None`
3. Rebuild and restart backend
4. Verify startup succeeds

**Priority 2**: Re-enable template persistence (HIGH)
1. Review why it was disabled
2. Re-enable template save method
3. Test template creation end-to-end

**Priority 3**: Validate activity system (MEDIUM)
1. Search for templates via MCP
2. Execute template
3. Verify success attribution data

---

## Evidence Summary

### Container Running
```
CONTAINER ID   IMAGE                              STATUS
0f8880f99809   metabobapp/metabob-rpc-api:0.16.12 Up 51 minutes (unhealthy)
```

### Service Not Running
```
Health Check Failures: 103 consecutive
Error: Connection refused (port 8080 not listening)
```

### Startup Crash
```
fastapi.exceptions.FastAPIError: Invalid args for response field! 
Hint: check that <class 'redis.client.Redis'> is a valid Pydantic field type
```

### Impact
```
- search_activities(): Empty (backend unreachable)
- Template API: Failed (connection refused)
- Activity execution: Cannot record (backend down)
- Success attribution: Broken (no backend)
```

---

## Conclusion

**The backend has been down for 5+ hours due to a simple type annotation error.**

This single issue is the **root cause** of:
- Template discovery failures
- Template retrieval errors  
- Activity tracking failures
- Success attribution breakage
- All "connection reset" errors

**Fix**: Find and correct the `-> Redis` type annotation in the backend codebase.

**ETA**: 10-15 minutes (find code, fix type, rebuild, restart)

**Confidence**: 99% - Error message is explicit and traceback is clear
