# Systematic Fix Plan: Boredom System & Activity Templates

**Date**: 2026-03-02 07:15 UTC  
**Priority**: CRITICAL  
**Root Cause Identified**: Async/await mismatch in RPC API

## Root Cause Analysis

### Issue 1: Missing `await` Keywords (CRITICAL) 🔥

**Error**: `401 Client Error: Unauthorized for url: http://surrealdb:8000/rpc`

**Root Cause**: The `get_boredom_candidates()` function in `template_metrics.py` is **NOT** using `await`:

```python
# WRONG (current code):
def get_boredom_candidates(...):
    db = await get_surreal_client()  # Returns AsyncSurrealDBClient
    result = db.query(...)  # ❌ Returns coroutine, not executed!
    
# This is attempting HTTP RPC call on unconnected/unawaited coroutine
```

**Why 401 Error**:
1. `get_surreal_client()` returns `AsyncSurrealDBClient`
2. `db.query()` is async and returns a **coroutine**
3. Without `await`, the coroutine is never executed
4. The legacy HTTP RPC fallback code tries to execute `/rpc` endpoint
5. SurrealDB returns 401 because request is malformed

**Files Affected**:
- `server/db/operations/template_metrics.py` - ALL functions
- `server/routes/learning_loop.py` - query_executions, get_boredom_activities
- `server/db/operations/activity_execution.py`
- `server/db/operations/failure_pattern.py`
- `server/db/operations/impulse_learning.py`

### Issue 2: Test Pollution (HIGH)

**Count**: 60+ test templates in registry
- 46x `test-cochange-*` templates
- 18x `test-template-*` templates

**Impact**: Noise in searches, boredom system confusion, wasted resources

### Issue 3: Failed Templates (HIGH)

**Templates**:
1. `complete-metabob-search-embedding-integration` - 0% (2 exec, 6.9s avg)
2. `improve-metabob-search-with-embeddings` - 0% (2 exec, 288.4s avg)

**Likely Cause**: Precondition failures or missing dependencies

## Fix Strategy

### Phase 1: Fix Async/Await (IMMEDIATE) 🚨

**Priority**: CRITICAL  
**Duration**: 30-45 minutes  
**Risk**: LOW (pure bug fix)

**Files to Fix**:

1. **`server/db/operations/template_metrics.py`**
   - Convert ALL functions to `async def`
   - Add `await` to all `db.query()`, `db.create()`, `db.merge()` calls
   - Functions affected:
     - `get_metrics()` ✓ (already async)
     - `create_metrics()` ❌ (NOT async)
     - `update_metrics_after_execution()` ❌ (NOT async)
     - `get_boredom_candidates()` ❌ (NOT async) **← ROOT CAUSE**
     - `get_all_metrics()` ❌ (NOT async)

2. **`server/routes/learning_loop.py`**
   - Add `await` to all database operation calls
   - Lines affected:
     - Line 185: `insert_execution()` - needs await
     - Line 197: `record_failure()` - needs await  
     - Line 233: `get_execution()` - needs await
     - Line 277: `get_recent_executions()` - needs await
     - Line 294: `get_executions_by_template()` - needs await
     - Line 333: `get_metrics()` - needs await
     - Line 377: `get_boredom_candidates()` - needs await **← FAILING**
     - Line 415: `get_failure_patterns()` - needs await
     - Line 592: `get_mapping_records()` - needs await
     - Line 751: `query_by_activity_category()` - needs await

3. **`server/db/operations/activity_execution.py`**
   - Convert all functions to `async def`
   - Add `await` to database calls

4. **`server/db/operations/failure_pattern.py`**
   - Convert all functions to `async def`
   - Add `await` to database calls

**Example Fix**:
```python
# BEFORE (broken):
def get_boredom_candidates(
    improvement_threshold: float = 0.7,
    exclude_recent_hours: int = 24,
    max_results: int = 10,
) -> List[Dict[str, Any]]:
    db = await get_surreal_client()  # ❌ await in non-async function
    result = db.query(sql, params)    # ❌ No await, returns coroutine
    return result

# AFTER (fixed):
async def get_boredom_candidates(
    improvement_threshold: float = 0.7,
    exclude_recent_hours: int = 24,
    max_results: int = 10,
) -> List[Dict[str, Any]]:
    db = await get_surreal_client()   # ✓ Correct
    result = await db.query(sql, params)  # ✓ Correct
    return result
```

**Testing**:
```bash
# After fix, this should return candidates (not 401):
curl "http://localhost:8080/api/v1/learning-loop/boredom-activities?threshold=0.7&limit=5"
```

### Phase 2: Clean Up Test Pollution (IMMEDIATE) 🧹

**Priority**: HIGH  
**Duration**: 5 minutes  
**Risk**: NONE (test data only)

**Actions**:
```bash
# Clean local storage
cd ~/.local/share/opencode/storage/activity-template
rm -f test-cochange-*.json test-template-*.json

# Verify cleanup
ls -1 *.json | wc -l  # Should be ~8-10 real templates
```

**Verification**:
```bash
# Should show 0 test templates:
search_activities() | grep "test-" | wc -l
```

### Phase 3: Debug Failed Templates (HIGH PRIORITY) 🐛

**Priority**: HIGH  
**Duration**: 30-60 minutes  
**Risk**: MEDIUM

**Template 1**: `complete-metabob-search-embedding-integration`
- 0% success, 2 executions, 6.9s avg
- Likely fails immediately (early abort)

**Investigation**:
1. Load activity execution logs from SurrealDB
2. Check task 1 preconditions
3. Identify validation failures
4. Fix task logic or prerequisites

**Template 2**: `improve-metabob-search-with-embeddings`
- 0% success, 2 executions, 288.4s avg
- Longer duration suggests mid-execution failure (task 3-5?)

**Investigation**:
1. Review task sequence (5 tasks total)
2. Identify which task failed
3. Check CPG/embedding integration
4. Fix dependencies or task implementation

### Phase 4: Comprehensive Testing (FINAL) ✅

**Priority**: MEDIUM  
**Duration**: 20-30 minutes  
**Risk**: LOW

**Tests**:
1. **Boredom API Endpoint**
   ```bash
   curl "http://localhost:8080/api/v1/learning-loop/boredom-activities?threshold=0.7&limit=5"
   # Expected: JSON array of candidates
   ```

2. **Template Metrics**
   ```bash
   curl "http://localhost:8080/api/v1/learning-loop/templates/create-demo-utility-function/metrics"
   # Expected: Metrics with success_rate, avg_cost, etc.
   ```

3. **Boredom System Flow**
   - Create idle session (5+ min)
   - Verify fetch triggered
   - Check activity execution
   - Validate metrics reporting

## Implementation Order

### Step 1: Fix Async/Await (NOW) 🚨
Files to edit:
1. `repos/metabob-rpc-api/server/db/operations/template_metrics.py`
2. `repos/metabob-rpc-api/server/routes/learning_loop.py`
3. `repos/metabob-rpc-api/server/db/operations/activity_execution.py`
4. `repos/metabob-rpc-api/server/db/operations/failure_pattern.py`

### Step 2: Test Fix
```bash
# Restart RPC API pod
kubectl rollout restart deployment/metabob-rpc-api -n metabob

# Wait for pod ready
kubectl wait --for=condition=ready pod -l app=metabob-rpc-api -n metabob --timeout=60s

# Test endpoint
curl "http://localhost:8080/api/v1/learning-loop/boredom-activities?threshold=0.7&limit=5"
```

### Step 3: Clean Up Test Pollution
```bash
cd ~/.local/share/opencode/storage/activity-template
rm -f test-*.json
```

### Step 4: Debug Failed Templates
Use activity template `debug-activity-template-failures`

### Step 5: Validate End-to-End
Test complete boredom system flow

## Success Criteria

### Phase 1 (Async/Await Fix)
- ✅ Boredom API returns 200 (not 401)
- ✅ Returns JSON array of candidates
- ✅ No "Unauthorized" errors in logs
- ✅ SurrealDB queries execute successfully

### Phase 2 (Cleanup)
- ✅ 0 test templates in registry
- ✅ search_activities returns only real templates
- ✅ Local storage: 8-10 templates (not 60+)

### Phase 3 (Template Debugging)
- ✅ Both embedding templates fixed
- ✅ Success rate > 80%
- ✅ Execution logs clean

### Phase 4 (E2E Testing)
- ✅ Boredom system detects idle sessions
- ✅ Fetches candidates via API
- ✅ Executes activities successfully
- ✅ Reports metrics to backend

## Timeline

- **Phase 1**: 30-45 min ⏱️⏱️
- **Phase 2**: 5 min ⏱️
- **Phase 3**: 30-60 min ⏱️⏱️
- **Phase 4**: 20-30 min ⏱️

**Total**: 85-140 minutes (1.5-2.5 hours)

## Next Action

**IMMEDIATE**: Fix async/await in template_metrics.py and learning_loop.py

This is a **critical bug** blocking the entire boredom system and learning loop.
