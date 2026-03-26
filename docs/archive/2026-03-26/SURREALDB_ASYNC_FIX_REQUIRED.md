# SurrealDB Async/Await Fix Required

**Date**: 2026-03-03  
**Status**: ⚠️ Blocking Issue - Comprehensive async/await fix needed

## Problem Summary

The metabob-rpc-api has multiple async/await bugs preventing template storage in SurrealDB. Templates are added to Redis but fail to persist to SurrealDB, causing a complete data loss.

## Root Cause

Several functions in `server/actions/activity.py` are **synchronous** but call **asynchronous** SurrealDB operations without awaiting them.

### Missing Awaits Found:

1. **Line 402**: `create_template_record(template)` - NOT awaited
   ```python
   def create_template(...):  # <-- SYNC function
       create_template_record(template)  # <-- Calling ASYNC function
   ```

2. **Line 423**: `create_metrics(...)` - NOT awaited (likely)

3. **Line 606**: Another async call not awaited

4. **Line 622**: Another async call not awaited

5. **Line 650** (routes/activity.py): `insert_activity_content(...)` - ✅ **FIXED**

## Required Changes

### 1. Make `create_template` Async

**File**: `server/actions/activity.py`  
**Line**: ~305

**Change**:
```python
# BEFORE:
def create_template(
    redis: StrictRedis,
    template_data: Dict[str, Any],
    ...
) -> Dict[str, Any]:

# AFTER:
async def create_template(
    redis: StrictRedis,
    template_data: Dict[str, Any],
    ...
) -> Dict[str, Any]:
```

**Then await all SurrealDB calls inside**:
```python
# Line ~402
await create_template_record(template)

# Line ~423
await create_metrics(...)
```

### 2. Make `create_variant` Async

**File**: `server/actions/activity.py`  
**Line**: ~461

**Change**:
```python
# BEFORE:
def create_variant(
    redis: StrictRedis,
    parent_id: str,
    variant_data: Dict[str, Any],
) -> Dict[str, Any]:

# AFTER:
async def create_variant(
    redis: StrictRedis,
    parent_id: str,
    variant_data: Dict[str, Any],
) -> Dict[str, Any]:
```

**Add awaits for any SurrealDB calls inside**.

### 3. Update Callers

**File**: `server/routes/activity.py`  
**Line**: ~256

```python
# BEFORE:
template = create_template(redis, template_data, ...)

# AFTER:
template = await create_template(redis, template_data, ...)
```

**Line**: ~301
```python
# BEFORE:
variant = create_variant(redis, template_id, variant_data)

# AFTER:
variant = await create_variant(redis, template_id, variant_data)
```

### 4. Fix Other Missing Awaits

Search for all calls to async functions in `server/actions/activity.py`:

```bash
cd repos/metabob-rpc-api
grep -n "create_\|update_\|insert_\|select_" server/actions/activity.py \
  | grep -v "await " | grep -v "def " | grep -v "#"
```

Add `await` to any async function calls.

## Verification Steps

After fixing:

1. **Rebuild Image**:
   ```bash
   cd repos/metabob-rpc-api
   docker build -f docker/Dockerfile.server.fixed -t metabob-rpc-api:async-fixed .
   ```

2. **Redeploy**:
   ```bash
   kubectl set image deployment/metabob-rpc-api \
     rpc-api=metabob-rpc-api:async-fixed -n metabob
   kubectl rollout status deployment/metabob-rpc-api -n metabob
   ```

3. **Test Template Creation**:
   ```bash
   curl -X POST http://api.metabob.local/v2/activities/templates \
     -H "Content-Type: application/json" \
     -d '{"name": "test-async-fix", "description": "Test", ...}'
   ```

4. **Verify Template Persists**:
   ```bash
   curl http://api.metabob.local/v2/activities/templates
   # Should show: {"templates": [{"activity_id": "test-async-fix", ...}]}
   ```

5. **Check Logs** (should have NO warnings):
   ```bash
   kubectl logs -n metabob -l app=metabob-rpc-api --tail=50 | grep -E "WARNING|ERROR"
   # Should NOT see: "Template X in list but not found in storage"
   # Should NOT see: "coroutine 'create_template_record' was never awaited"
   ```

## Impact

### Current Broken Flow:
1. User creates template via API ✅
2. Template added to Redis list ✅
3. SurrealDB write **SILENTLY FAILS** ❌ (coroutine not awaited)
4. API returns success ⚠️ (misleading!)
5. GET template → 404 Not Found ❌
6. Logs show: "Template X in list but not found in storage"

### After Fix:
1. User creates template via API ✅
2. Template added to Redis list ✅  
3. SurrealDB write **SUCCEEDS** ✅ (properly awaited)
4. API returns success ✅
5. GET template → 200 OK with data ✅
6. No warnings in logs ✅

## Files to Modify

1. `repos/metabob-rpc-api/server/actions/activity.py`
   - Make `create_template` async (line ~305)
   - Make `create_variant` async (line ~461)
   - Add `await` to all SurrealDB calls inside both functions

2. `repos/metabob-rpc-api/server/routes/activity.py`
   - Add `await` when calling `create_template` (line ~256)
   - Add `await` when calling `create_variant` (line ~301)
   - ✅ Already fixed `insert_activity_content` (line 650)

## Related Issues

This is a **common async/await bug pattern** in Python:
- Forgetting to `await` an async function
- Python doesn't error, just returns a coroutine object
- Coroutine never executes → silent failure
- Warning only shows at runtime: `RuntimeWarning: coroutine 'X' was never awaited`

## References

- Python async/await docs: https://docs.python.org/3/library/asyncio-task.html
- SurrealDB Python client: https://github.com/surrealdb/surrealdb.py
- Original diagnostic: `/METABOB_CLI_CONNECTION_DIAGNOSIS.md`

---

**Priority**: 🔴 CRITICAL - Blocks all template storage and activity execution
**Est. Time**: 30 minutes (code changes + rebuild + test)
