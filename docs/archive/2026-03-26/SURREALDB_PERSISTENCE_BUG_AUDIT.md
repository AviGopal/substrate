# SurrealDB HTTP Client Persistence Bug - Complete Audit

## Executive Summary
**CRITICAL**: Discovered systematic bug affecting ALL database write operations across the platform.

### Impact Scope
- ❌ Users/Organizations (partially fixed in auth flow)
- ❌ Projects (fix committed, pending deployment)
- ❌ API Keys
- ❌ Problems/Components
- ❌ Sessions (potentially)

### Root Cause
The `surrealdb-py` HTTP client methods `.create()` and `.insert()` return success but **DO NOT persist records** to the database.

## Affected Files

### 1. api_key_ops.py
**Line 60**: `result = await db.create("api_keys", data)`
- **Impact**: API keys appear created but are not queryable
- **User Impact**: Authentication failures, "invalid API key" errors

### 2. organization_ops.py
**Line 56**: `result = await db.create("organizations", data)`
- **Impact**: Organizations created but not retrievable
- **User Impact**: Users can register but can't see their org

### 3. problem_ops.py (MULTIPLE INSTANCES)
**Line 78**: `result = await db.create("problems", data)`
**Line 103**: `result = await db.insert("problems", problems)`  # Bulk insert
**Line 116**: `record = await db.create("problems", problem)`   # Batch fallback
- **Impact**: Analysis results not persisted
- **User Impact**: metabob-cli reports problems, dashboard shows empty

### 4. user_ops.py (PARTIALLY FIXED)
**Line 82**: `result = await db.create(record_id, data)`
**Line 331**: `result = await db.create("user_organizations", data)`
- **Impact**: User records exist (fixed in cloud_auth.py), but user_organizations join table may fail
- **User Impact**: Users created but org membership broken

### 5. project_ops.py
✅ **FIXED** (commit adb858a): Converted to SQL INSERT

## Fix Pattern

### Before (BROKEN)
```python
data = {"field": value, ...}
result = await db.create("table", data)
```

### After (WORKING)
```python
created_at = datetime.utcnow().isoformat() + "Z"
sql = """
    INSERT INTO table {
        field: $field,
        created_at: $created_at
    }
"""
params = {"field": value, "created_at": created_at}
result = await db.query(sql, params)

# Parse result with fallback
if result and len(result) > 0:
    if isinstance(result[0], dict) and "result" in result[0]:
        records = result[0]["result"]
        if records: return sanitize_record(records[0])
    elif isinstance(result[0], list):
        return sanitize_record(result[0][0])
return params  # Fallback
```

## Fix Priority

### P0 - Critical (Breaks E2E Flow)
1. ✅ **user registration** (cloud_auth.py) - Already fixed
2. ⚠️ **problem_ops.py** - Breaks metabob-cli analysis persistence
3. ⚠️ **project_ops.py** - Already fixed, needs deployment

### P1 - High (User-Facing Features)
4. ⚠️ **organization_ops.py** - Affects new org creation
5. ⚠️ **api_key_ops.py** - Breaks API authentication
6. ⚠️ **user_ops.py** - user_organizations join table

## Deployment Status

| File | Status | Commit | Deployed |
|------|--------|--------|----------|
| cloud_auth.py | ✅ Fixed | d61fa57 | ✅ Yes (rev 37) |
| project_ops.py | ✅ Fixed | adb858a | ❌ No |
| problem_ops.py | ❌ Broken | - | - |
| organization_ops.py | ❌ Broken | - | - |
| api_key_ops.py | ❌ Broken | - | - |
| user_ops.py | ⚠️ Partial | - | - |

## Recommended Action Plan

### Phase 1: Immediate (Block E2E validation)
1. Fix `problem_ops.py` (3 instances)
2. Deploy `project_ops.py` fix
3. Test complete metabob-cli → dashboard flow

### Phase 2: User Management
4. Fix `organization_ops.py`
5. Fix `api_key_ops.py`
6. Fix `user_ops.py` (user_organizations)

### Phase 3: Validation
7. Create comprehensive test suite
8. Validate all CRUD operations persist
9. Document coding standard

## Testing Strategy

```bash
# For each table:
# 1. Create record via API
# 2. Verify in SurrealDB directly
# 3. Query via API
# 4. Compare results

# Example:
curl -X POST /api/problems -d '{"name": "test"}'
# Response: {"id": "problems:xyz", ...}

# Direct SurrealDB query:
curl -X POST http://surrealdb:8000/sql \
  -d "SELECT * FROM problems WHERE id = 'problems:xyz'"
# Expected: [{"result": [{"id": "problems:xyz", ...}]}]
# Actual (if broken): [{"result": []}]

# API query:
curl -X GET /api/problems
# Expected: [{"id": "problems:xyz", ...}]
# Actual (if broken): []
```

## Architecture Decision

**CODING STANDARD**: Never use `db.create()` or `db.insert()` with HTTP client.

### Add to all `*_ops.py` files:
```python
"""
IMPORTANT: SurrealDB HTTP Client Workaround
-------------------------------------------
Do NOT use db.create() or db.insert() - they don't persist records.
Always use db.query() with SQL INSERT statements.

Correct pattern:
    sql = "INSERT INTO table { field: $value, ... }"
    result = await db.query(sql, params)

See: E2E_DATA_FLOW_PROJECT_PERSISTENCE_BUG.md
"""
```

## Next Session TODO
1. Create bulk fix script for all `*_ops.py` files
2. Run comprehensive test suite
3. Deploy all fixes as single release
4. Update architecture documentation
