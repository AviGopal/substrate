# Task 7: Migrate metabob-rpc-api to Proto Types

## Overview

Migrate the RPC API backend to use generated protocol buffer types from `metabob-proto`, eliminating custom schemas and fixing the database serialization bug.

## Issues to Fix

### 1. Database Serialization Bug (CRITICAL)
**Location:** `scripts/init-db.py` lines 311, 314, 383
**Problem:** `json.dumps(value)` embedded in SQL string breaks escaping
```python
# BROKEN:
fields.append(f"{key} = {json.dumps(value)}")  # ❌ Quotes not escaped!

# FIXED:
# Use proper SQL parameter binding or escape JSON string
escaped_json = json.dumps(value).replace('"', '\\"')
fields.append(f'{key} = "{escaped_json}"')  # ✅ Properly escaped
```

**Impact:** ALL activities have empty `task_steps[]` arrays in database

### 2. Import Errors
**Location:** `server/models/proto_activity.py`
**Problem:** Imports reference old proto structure
```python
# Current (broken):
from proto.activity import activity_pb2  # ❌ Wrong path
from proto.activity import task_pb2      # ❌ Wrong path
from proto.common import types_pb2       # ❌ Wrong path

# Should be (from generated code):
from metabob.activity import variant_pb2  # ✅ Generated path
from metabob.common import types_pb2      # ✅ Generated path
```

### 3. Missing Proto Types
**Problem:** RPC API expects proto types that don't exist in current generated code
- `activity_pb2` (execution types - separate from variant)
- `task_pb2` (task types - separate from variant)

**Solution:** These are now in `variant_pb2.TaskStep`, `variant_pb2.ActivityVariant`

## Migration Steps

### Step 1: Install metabob-proto Package
Add dependency to `repos/metabob-rpc-api/pyproject.toml`:
```toml
[tool.uv.sources]
metabob-proto = { path = "../metabob-proto", editable = true }

[project]
dependencies = [
    # ... existing
    "metabob-proto>=0.1.0",
]
```

### Step 2: Fix Database Serialization Bug
Update `scripts/init-db.py`:
1. Fix JSON escaping in SQL statements
2. Verify task_steps array is populated correctly
3. Test with bootstrap activities

### Step 3: Update Proto Imports
Update `server/models/proto_activity.py`:
1. Change imports to use generated `metabob.activity` package
2. Update type references (ActivityVariant, TaskStep, etc.)
3. Remove fallback logic (proto will always be available)

### Step 4: Generate and Verify
1. Run `repos/metabob-proto/scripts/generate.sh`
2. Test imports in RPC API
3. Verify database seed works

## File Changes

### Files to Modify (3)
1. `repos/metabob-rpc-api/pyproject.toml` - Add dependency
2. `scripts/init-db.py` - Fix JSON escaping
3. `server/models/proto_activity.py` - Update imports

### Files to Test (2)
1. `server/routes/proto_activities.py` - Verify proto usage
2. `server/routes/activity_recommendations.py` - Verify variants work

## Verification Steps

1. **Code Generation Works**
   ```bash
   cd repos/metabob-proto
   ./scripts/generate.sh
   # Should see: ✓ Code generation complete!
   ```

2. **Imports Work**
   ```bash
   cd repos/metabob-rpc-api
   python3 -c "from metabob.activity import ActivityVariant, TaskStep; print('OK')"
   ```

3. **Database Seed Works**
   ```bash
   python3 scripts/init-db.py
   # Should see: Created: bug-fix-v1, feature-impl-v1, etc.
   # Verify task_steps is NOT empty
   ```

4. **API Works**
   ```bash
   # Start server
   uvicorn server.main:app --reload
   
   # Test endpoints
   curl http://localhost:8000/api/v1/activities/search
   ```

## Success Criteria

- ✅ `metabob-proto` installed as dependency
- ✅ No import errors in RPC API
- ✅ Database seed populates task_steps correctly
- ✅ Bootstrap activities have non-empty task_steps arrays
- ✅ API endpoints work with proto types
- ✅ No custom schema code (using generated types)

## Next Tasks

After completing Task 7:
- **Task 8:** Migrate metabob-cli to proto types
- **Task 9:** Migrate metabob-opencode to proto types
- **Task 10:** Convert jiggle-documentation to proto format and test

## Timeline

- Setup & dependency: 10 minutes
- Fix serialization bug: 15 minutes
- Update imports: 15 minutes
- Testing & verification: 20 minutes
- **Total: ~1 hour**
