# Async Ripple Changes Trace - Complete Analysis

## Specification
**Name:** Complete Async Ripple Changes for SurrealDB Official Library

**Root Cause:** get_surreal_client() became async in Phase 1 (variant_id fix), but only 3 of 56 calls were updated to use await

## Current State vs Desired State

### Phase 1 Complete (5%)
- ✅ Core async client: `server/db/surrealdb_client.py` - AsyncSurrealDBClient with async get_surreal_client()
- ✅ Partial conversion: `server/db/operations/template_metrics.py` - 3 functions async (get_metrics, create_metrics, update_metrics_after_execution)
- **Progress:** 3 of 56 calls (5%) properly use await

### Phase 2 Incomplete (95% remaining)

**Blocking Issue:** 8 operation modules + 2 route/CLI files have 53 calls that need async conversion

## Components Requiring Async Conversion

### 1. server/db/operations/failure_pattern.py
- **Functions:** 6 (record_failure, get_failure_patterns, get_pattern_by_id, get_recent_failures, get_patterns_by_error_type, delete_old_patterns)
- **Current:** def functions, no await on get_surreal_client() or db calls
- **Gap:** Convert to async def, add await to 6 get_surreal_client() calls + all db operations
- **Extra Fix:** Line 144 uses update(), should use merge() for partial updates

### 2. server/db/operations/task_execution.py
- **Functions:** 5 (insert_task_execution, update_task_execution, get_task_executions, get_failed_tasks, get_task_execution)
- **Current:** def functions, no await on get_surreal_client() or db calls
- **Gap:** Convert to async def, add await to 5 get_surreal_client() calls + all db operations
- **Extra Fix:** Line 132 uses update(), should use merge()

### 3. server/db/operations/activity_content.py
- **Functions:** 3 (insert_activity_content, get_activity_content, get_activity_content_by_variant)
- **Current:** def functions, no await on get_surreal_client() or db calls
- **Gap:** Convert to async def, add await to 3 get_surreal_client() calls + all db operations

### 4. server/db/operations/activity_execution.py
- **Functions:** 6 (insert_execution, get_execution, get_executions_by_template, get_recent_executions, get_failure_details, delete_old_executions)
- **Current:** def functions, no await on get_surreal_client() or db calls
- **Gap:** Convert to async def, add await to 6 get_surreal_client() calls + all db operations

### 5. server/db/operations/impulse_data.py
- **Functions:** 5 (create_impulse, get_impulse, list_impulses, update_impulse, delete_impulse)
- **Current:** def functions, no await on get_surreal_client() or db calls
- **Gap:** Convert to async def, add await to 5 get_surreal_client() calls + all db operations

### 6. server/db/operations/activity_data.py
- **Functions:** 5 (create_activity, get_activity, list_activities, update_activity, delete_activity)
- **Current:** def functions, no await on get_surreal_client() or db calls
- **Gap:** Convert to async def, add await to 5 get_surreal_client() calls + all db operations

### 7. server/db/operations/impulse_learning.py
- **Functions:** 4 (insert_mapping_record, get_mapping_records, query_patterns, query_by_activity_category)
- **Current:** def functions, no await on get_surreal_client() or db calls
- **Gap:** Convert to async def, add await to 4 get_surreal_client() calls + all db operations

### 8. server/db/operations/template_data.py
- **Functions:** 6 (create_template_record, get_template_by_variant_id, list_all_templates, update_template_record, delete_template_record, get_templates_by_activity_id)
- **Current:** def functions, no await on get_surreal_client() or db calls
- **Gap:** Convert to async def, add await to 6 get_surreal_client() calls + all db operations
- **Extra Fix:** Line 175 uses update(), should use merge()

### 9. server/routes/activity.py
- **Function:** update_template_metrics (async route handler)
- **Current:** Line 463 calls get_surreal_client() without await, line 509 calls db.update() without await
- **Gap:** Add await keywords to lines 463 and 509

### 10. server/cli.py
- **Functions:** 3 CLI commands (init_schema, validate_schema, db_status)
- **Current:** Lines 96, 146, 218 call get_surreal_client() without await, then use sync db calls
- **Gap:** Wrap with asyncio.run() around get_surreal_client() and all db operations
- **Special Case:** CLI commands are synchronous entry points

## Data Flow

```
FastAPI Route (async)
  ↓ await
DB Operations Module (should be async)
  ↓ await
AsyncSurrealDBClient (async methods)
  ↓
SurrealDB v3.0+

CLI Command (sync)
  ↓ asyncio.run()
DB Operations Module (async)
  ↓ await
AsyncSurrealDBClient (async methods)
  ↓
SurrealDB v3.0+
```

## Implementation Pattern

**Before:**
```python
def function_name(...):
    db = get_surreal_client()
    result = db.query(...)
    return result
```

**After:**
```python
async def function_name(...):
    db = await get_surreal_client()
    result = await db.query(...)
    return result
```

## Critical Issues to Fix

### merge() vs update()
- **Problem:** update() replaces ALL fields (causes variant_id to become NONE)
- **Solution:** Use merge() for partial updates to preserve immutable fields
- **Files to fix:**
  - server/db/operations/failure_pattern.py:144
  - server/db/operations/task_execution.py:132
  - server/db/operations/template_data.py:175

## Testing Strategy

1. **Unit Tests:** Test each operation module function with async test framework
2. **Integration Tests:** Test route handlers with FastAPI TestClient async mode
3. **CLI Tests:** Test CLI commands with asyncio.run() wrapper

## Trace Impulse

**ID:** trace-Complete-Async-Ripple-Changes-for-SurrealDB-Official-Library
**Type:** templateDefinition
**Budget:** 5000 tokens
**Content:** Full JSON trace data with all component details

## Summary Statistics

- **Total Functions:** 40
- **Total get_surreal_client() calls:** 56
- **Converted (Phase 1):** 3 calls (5%)
- **Remaining (Phase 2):** 53 calls (95%)
- **Operation Modules:** 8
- **Route Handlers:** 1
- **CLI Commands:** 3
- **update() → merge() fixes:** 3
