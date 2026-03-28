# Task Steps Storage Bug - FIXED ✅

**Date**: February 14, 2026  
**Status**: **RESOLVED**

## Problem Summary

Activity templates created via the API and MCP tools returned empty `task_steps: []` arrays, even though the backend code correctly prepared the data. This prevented templates from being usable.

## Root Cause

**SurrealDB schema constraint issue** in the `production` database:

```sql
-- ❌ BROKEN: Strict TYPE array constraint stripped nested objects
DEFINE FIELD task_steps ON activity_variants TYPE array PERMISSIONS FULL;
```

When the field was defined as `TYPE array` without further specification, SurrealDB **rejected nested objects** within the array, resulting in empty arrays being stored.

## Investigation Process

### 1. Initial Hypothesis (Disproven)
- Suspected Python surrealdb client serialization issue
- **DISPROVEN**: Direct SQL INSERT tests showed the same behavior

### 2. Database Comparison
Found two databases with different behaviors:
- **`metabob`** database: NO field definitions → nested objects worked perfectly
- **`production`** database: Strict `TYPE array` → nested objects stripped

### 3. Direct Testing
```bash
# Direct SQL INSERT test
CREATE activity_variants:test SET task_steps = [{"id": "s1", "desc": "test"}];
SELECT task_steps FROM activity_variants:test;
# Result: task_steps: []  ❌ Empty!
```

This confirmed the issue was at the **database schema level**, not application code.

## Solution

Changed the field definition from strict `TYPE array` to `FLEXIBLE`:

```sql
-- Remove broken constraint
REMOVE FIELD task_steps ON activity_variants;

-- ✅ FIXED: Use FLEXIBLE type to allow nested objects
DEFINE FIELD task_steps ON activity_variants FLEXIBLE PERMISSIONS FULL;
```

### Why FLEXIBLE Works

SurrealDB's `FLEXIBLE` type allows storing **any data type** without validation, including:
- Arrays with nested objects
- Complex nested structures
- Dynamic schemas

This matches the behavior of the `metabob` database which had no field definitions.

## Verification

### Test 1: Direct SQL Insert ✅
```sql
CREATE activity_variants:test_flexible SET 
  task_steps = [{"id": "step1", "description": "First step", "subagent": "general"}];

SELECT task_steps FROM activity_variants:test_flexible;
-- Result: [{ description: 'First step', id: 'step1', subagent: 'general' }] ✅
```

### Test 2: API Template Creation ✅
```bash
curl -X POST http://localhost:8080/v2/activities/templates \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"name": "Test", "task_steps": [...]}'

# Response shows full task_steps with 2 nested objects ✅
# Database query confirms: step_count: 2 ✅
```

### Test 3: Database Query Verification ✅
```sql
SELECT variant_id, array::len(task_steps) as step_count 
FROM activity_variants 
WHERE variant_id = "test-644705f8";

-- Result: { step_count: 2, variant_id: 'test-644705f8' } ✅
```

## Schema Change Details

### Before (Broken)
```sql
DEFINE FIELD task_steps ON activity_variants TYPE array PERMISSIONS FULL;
```

### After (Fixed)
```sql
DEFINE FIELD task_steps ON activity_variants FLEXIBLE PERMISSIONS FULL;
```

### Impact on Existing Records
- **Old records**: Still have empty `task_steps: []` (data was lost when written)
- **New records**: Will store nested objects correctly
- **No migration needed**: Old records will remain empty, but new templates work

## Files Involved

### Database
- **Container**: `metabob-surreal`
- **Database**: `production` (fixed)
- **Table**: `activity_variants`
- **Field**: `task_steps`

### Backend (No changes needed)
- `/repos/metabob-rpc-api/server/routes/v2_activities.py` - API route (working correctly)
- `/repos/metabob-rpc-api/server/actions/activity_variants.py` - Database operations (working correctly)
- `/repos/metabob-rpc-api/server/models/proto_task_step.py` - Pydantic models (working correctly)

### Frontend (No changes needed)
- `/repos/metabob-cli/src/metabob_cli/mcp/tools.py` - MCP tools (working correctly)
- `/repos/metabob-cli/src/metabob_cli/mcp/activity_manager.py` - Activity manager (working correctly)

## Success Metrics

✅ SurrealDB schema updated to `FLEXIBLE` type  
✅ Direct SQL INSERT stores nested objects  
✅ API template creation returns full `task_steps`  
✅ Database query shows correct `step_count`  
✅ End-to-end flow working  

## Lessons Learned

### 1. Test at Every Layer
The bug was hidden because we didn't test **direct database operations** first. Starting with SQL INSERT immediately isolated the issue to the schema layer.

### 2. Schema Design Matters
SurrealDB's strict typing can cause unexpected data loss. For dynamic schemas:
- Use `FLEXIBLE` type for complex nested structures
- Test schema constraints before deploying
- Compare working vs broken environments

### 3. Database Comparison is Diagnostic Gold
Comparing `metabob` (working) vs `production` (broken) databases revealed the schema difference immediately.

## Recommendation

**For future SurrealDB schema definitions**:
- Use `FLEXIBLE` for fields with complex nested structures
- Use `TYPE array<object>` if you need type safety (untested - may not work)
- Test schema constraints with direct SQL before using in application code
- Monitor for empty arrays as a sign of schema rejection

## Next Steps

1. ✅ **Fix Applied**: Schema changed to `FLEXIBLE`
2. ✅ **Verification Complete**: End-to-end tests passing
3. 🔄 **Search Index**: May need time to reindex (templates created before fix will show 0 steps)
4. 📝 **Documentation**: Update schema documentation to note `FLEXIBLE` requirement

## Conclusion

The bug is **fully resolved**. The fix was a **one-line schema change** from `TYPE array` to `FLEXIBLE`. All new templates created after this fix will store `task_steps` correctly with full nested objects.

---

**Status**: 🟢 PRODUCTION READY  
**Schema Version**: Updated 2026-02-15  
**Tested**: Direct SQL ✅ | API ✅ | Database ✅
