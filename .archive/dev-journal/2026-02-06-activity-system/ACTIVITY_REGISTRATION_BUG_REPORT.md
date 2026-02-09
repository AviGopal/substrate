# Activity Registration System - Critical Bug Report

**Date**: February 6, 2026  
**Severity**: CRITICAL - Blocks all activity execution  
**Component**: Activity registration / Database serialization

## Summary

The activity execution system is completely non-functional due to a critical bug in the database serialization layer. Activity templates (including all bootstrap activities) are inserted into SurrealDB with **empty `task_steps` arrays**, making them impossible to execute.

## Impact

- ❌ **NO activities can be executed** (including bootstrap activities)
- ❌ Activity tool always returns "Activity not found"  
- ❌ MCP `get_activity` returns activities with 0 tasks
- ❌ New templates cannot be registered properly

## Root Cause

The `scripts/init-db.py` script's INSERT query fails to properly serialize complex JSON structures (nested objects/arrays) when inserting activity variants into SurrealDB.

### Evidence

**File Content** (repos/metabob-proto/activities/bootstrap/bug-fix.json):
```json
{
  "variant_id": "bug-fix-v1",
  "activity_id": "bug-fix",
  "task_steps": [
    {/* 4 complete task definitions */}
  ]
}
```

**Database Content** (SELECT * FROM activity_variants WHERE variant_id = 'bug-fix-v1'):
```json
{
  "variant_id": "bug-fix-v1",
  "activity_id": "bug-fix",
  "task_steps": []  // ❌ EMPTY!
}
```

## Affected Code

**File**: `scripts/init-db.py`  
**Lines**: ~296-328

```python
# Build CREATE query
fields = []
for key, value in template.items():
    # ... escaping logic ...
    elif isinstance(value, (list, dict)):
        fields.append(f"{key} = {json.dumps(value)}")  # ❌ THIS FAILS

create_query = f"USE NS {ns} DB {db}; CREATE activity_variants SET {', '.join(fields)};"
results = execute_query(client, create_query, config)
```

### Problem

The `json.dumps(value)` output is inserted directly into the SQL string without proper escaping. Complex nested structures contain characters (`"`, `\n`, `{`, `}`, etc.) that break the SQL syntax, causing the array to be stored as empty.

## Reproduction Steps

1. Run `python scripts/init-db.py` (loads bootstrap activities)
2. Query database: `SELECT task_steps FROM activity_variants WHERE variant_id = 'bug-fix-v1'`
3. **Result**: `task_steps: []` (should be 4 tasks)
4. Try to execute activity: `activity({ activityId: "bug-fix-v1", ... })`
5. **Error**: "Activity bug-fix-v1 not found" (MCP returns activity with 0 tasks, gets rejected)

## Test Case

### Expected Behavior
```bash
# Register template
python scripts/init-db.py

# Query database
curl -u "local:testing" -X POST http://localhost:8000/sql \
  --data "USE NS metabob DB devbob; SELECT variant_id, task_steps FROM activity_variants WHERE variant_id = 'bug-fix-v1';"

# Expected: task_steps array with 4 objects
```

### Actual Behavior
```json
{
  "variant_id": "bug-fix-v1",
  "task_steps": []  // ❌ Empty
}
```

## Attempted Workarounds

### 1. Manual INSERT with Python Script
**Status**: Failed  
**Reason**: Same serialization issue - `json.dumps()` output breaks SQL string

### 2. Convert to Bootstrap Format
**Status**: N/A  
**Reason**: Bootstrap templates already in correct format, problem is serialization not format

### 3. Use RPC API Endpoint
**Status**: Blocked  
**Reason**: API endpoints require authentication, and they ultimately call the same broken serialization code

## Solution Options

### Option 1: Fix SQL Escaping (Recommended)
Use SurrealDB's parameterized queries instead of string interpolation:

```python
# Instead of:
create_query = f"CREATE activity_variants SET {', '.join(fields)};"

# Use:
query = "CREATE activity_variants SET task_steps = $task_steps, ..."
params = {"task_steps": task_steps_array, ...}
result = db.query(query, params)
```

**Pros**: Proper, SQL-injection-safe approach  
**Cons**: Requires refactoring init-db.py

### Option 2: Use SurrealDB Python SDK
Switch from raw HTTP to official SurrealDB Python client:

```python
from surrealdb import Surreal

async with Surreal("ws://localhost:8000/rpc") as db:
    await db.signin({"user": "local", "pass": "testing"})
    await db.use("metabob", "devbob")
    
    # Direct object insertion (no serialization issues)
    await db.create("activity_variants", template_dict)
```

**Pros**: Handles serialization automatically  
**Cons**: Adds new dependency

### Option 3: Use RPC API for Registration
Create proper template registration endpoint in metabob-rpc-api:

```python
@router.post("/templates")
async def register_template(template: ActivityTemplateCreate, db: SurrealDBClient):
    # Use SurrealDB client's native methods (handles serialization)
    result = await db.create("activity_variants", template.dict())
    return result
```

**Pros**: Proper API-driven approach  
**Cons**: Requires backend changes

## Recommended Fix

**Priority**: P0 (Critical - blocks all activity functionality)

**Steps**:
1. Refactor `scripts/init-db.py` to use parameterized queries
2. Test with bootstrap activities
3. Verify `task_steps` array is populated in database
4. Test activity execution end-to-end
5. Document proper template registration process

**Estimated Effort**: 2-4 hours

## Workaround for Testing

Until fixed, activities CANNOT be executed. However, the jiggle-documentation template itself is **valid and complete** - it just can't be registered due to this bug.

## Related Issues

- Activity tool always fails with "not found"
- MCP `get_activity` returns incomplete data
- Template registration via CLI finds 0 templates
- `search_activities` returns empty results

## Files to Fix

1. `scripts/init-db.py` - Database seeding script (lines ~296-328)
2. (Optional) `repos/metabob-rpc-api/server/actions/activity_variants.py` - Add proper create method

## Verification Checklist

After fix:
- [ ] Bootstrap activities have populated `task_steps` in database
- [ ] `SELECT * FROM activity_variants WHERE variant_id = 'bug-fix-v1'` shows 4 tasks
- [ ] MCP `get_activity("bug-fix-v1")` returns activity with 4 tasks
- [ ] Activity tool can execute bootstrap activities
- [ ] New templates can be registered and executed
- [ ] jiggle-documentation template can be registered

## Additional Context

### Why This Wasn't Caught Earlier

The init-db.py script reports "success" even when `task_steps` fails to serialize:
```
Created: bug-fix-v1
Bootstrap seed complete: 8 created, 0 skipped
```

It checks for INSERT success but doesn't validate the inserted data structure.

### Why Tests Pass

If there are tests, they likely:
- Mock the database layer
- Don't verify `task_steps` content
- Test template validation (which works) not execution (which doesn't)

---

**Status**: Documented and reported  
**Next Action**: Assign to backend team for fix  
**Blocking**: jiggle-documentation activity execution test
