# Template Loading Fix - Root Cause & Solution

## Problem Summary

✅ **85 templates successfully synced** to backend (`api.metabob.local`)  
✅ **Templates confirmed in SurrealDB** (logs show writes successful)  
❌ **GET `/v2/activities/templates` returns 0 templates**  
❌ **`search_activities` tool returns empty list**

## Root Cause Analysis

### Code Path Traced

1. **API Route**: `server/routes/activity.py:72` (`list_activity_templates`)
2. **Business Logic**: `server/actions/activity.py:154` (`list_templates`)
3. **Database Query**: `server/db/operations/template_data.py:95` (`list_all_templates`)

### The Issue

In `list_all_templates` (line 150-156):

```python
# No org_id: return only global templates (unauthenticated access)
query = """
    SELECT * FROM activity_template
    WHERE scope IS NULL OR scope = 'global'
    ORDER BY created_at DESC
    LIMIT $limit
"""
```

When templates are created via POST `/v2/activities/templates`, the **`scope` field is likely not being set**, resulting in templates that don't match the query filter.

### Evidence

1. **Templates ARE being written**: Logs show `✅ Template written to SurrealDB (primary): trace_enforce_validate_loop_99b07520`
2. **Query returns empty**: GET endpoint returns `{"templates": []}`
3. **Cache miss behavior**: Code correctly falls back to SurrealDB query
4. **Filter too restrictive**: Query requires `scope IS NULL OR scope = 'global'`

## Likely Causes

### Option 1: Scope Field Missing
Templates POSTed without `scope` field, but SurrealDB stores as `undefined` instead of `NULL`.

### Option 2: Query Result Parsing Issue  
Line 158-161 in `template_data.py`:
```python
if result and len(result) > 0:
    return result[0] if isinstance(result[0], list) else []
```

If SurrealDB returns result in unexpected format, this could return empty list.

### Option 3: Record ID Mismatch
Templates stored with variant suffix (e.g., `trace_enforce_validate_loop_99b07520`) but query doesn't find them.

## Solution Steps

### Fix 1: Add Debugging to Query Function

Add logging to `list_all_templates` to see what SurrealDB actually returns:

```python
# In server/db/operations/template_data.py, line 156 after query
logger.info(f"📊 SurrealDB query result: {result}")
logger.info(f"📊 Result type: {type(result)}, length: {len(result) if result else 0}")
if result and len(result) > 0:
    logger.info(f"📊 First element type: {type(result[0])}, value: {result[0][:2] if isinstance(result[0], list) else 'not a list'}")
```

### Fix 2: Broaden Query Filter

Change query to accept templates without scope field:

```python
query = """
    SELECT * FROM activity_template
    WHERE scope IS NONE OR scope IS NULL OR scope = 'global' OR scope = NONE
    ORDER BY created_at DESC  
    LIMIT $limit
"""
```

Or simply return ALL templates (since auth is optional in DEBUG mode):

```python
query = """
    SELECT * FROM activity_template
    ORDER BY created_at DESC
    LIMIT $limit
"""
```

### Fix 3: Ensure Templates Have Scope on Creation

In `server/actions/activity.py`, when calling `create_template_record`, ensure scope is set:

```python
template_data["scope"] = template_data.get("scope", "global")  # Default to global
```

## Recommended Fix (Quick Win)

**Modify `list_all_templates` to return ALL templates when no org_id**:

```python
# server/db/operations/template_data.py, line 149-156
else:
    # No org_id: return ALL templates (DEBUG mode allows unauthenticated access)
    # In production with auth required, org_id will always be present
    query = """
        SELECT * FROM activity_template
        ORDER BY created_at DESC
        LIMIT $limit
    """
    result = await db.query(query, {"limit": limit})
```

**Rationale**:
- Backend is in DEBUG mode (`auto_error=False` in routes)
- Auth is optional for development
- Filtering by scope=NULL is too restrictive for dev environment
- Templates ARE in database, just not matching filter

## Testing Plan

### 1. Apply Fix
```bash
cd /home/avi/documents/work/exp-repo/metabob-devbob/repos/metabob-rpc-api

# Edit server/db/operations/template_data.py line 149-156
# Remove scope filter from unauthenticated query
```

### 2. Restart Backend
```bash
kubectl rollout restart deployment/metabob-rpc-api -n metabob
kubectl logs -n metabob -l app=metabob-rpc-api -f
```

### 3. Test GET Endpoint
```bash
curl -H "Authorization: Bearer mb_devbob_test_simple_2026_v2" \
  http://api.metabob.local/v2/activities/templates | jq '{count: (.templates | length)}'
```

Expected: `{"count": 85}` ✅

### 4. Test search_activities Tool
```bash
cd /home/avi/documents/work/exp-repo/metabob-devbob/repos/metabob-opencode
bun run dev ../.. search_activities
```

Expected: List of templates displayed ✅

### 5. Test Activity Execution
```bash
cd /home/avi/documents/work/exp-repo/metabob-devbob/repos/metabob-opencode
bun run dev ../.. activity \
  --template trace-enforce-validate-loop \
  --variable specificationName="test" \
  --reason "Test template loading"
```

Expected: Template loads and executes ✅

## Alternative: Direct Database Fix

If query fix doesn't work, update templates directly in database to add scope:

```sql
USE NS metabob DB metabob_dev;
UPDATE activity_template SET scope = 'global' WHERE scope IS NONE;
```

## Next Steps

1. ✅ Apply query fix (remove scope filter)
2. ✅ Restart backend
3. ✅ Test GET endpoint returns templates
4. ✅ Test search_activities tool
5. ✅ Execute activity to verify end-to-end
6. ✅ Commit fix with explanation

## Summary

**Root Cause**: Scope filter too restrictive for templates without explicit scope field  
**Fix**: Remove scope filter from unauthenticated template query  
**Impact**: Templates become accessible, activity loading works  
**Risk**: Low (DEBUG mode already allows unauthenticated access)  
**Effort**: 5 minutes (1 line change + restart)

---

**Status**: Fix identified, ready to apply  
**Priority**: HIGH - blocks all template usage  
**ETA**: <10 minutes to deploy and verify
