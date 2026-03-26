# E2E Data Flow Project Persistence Bug

## Issue Summary
**Symptom**: Projects can be created (POST returns 201) but don't appear in GET /projects list  
**Root Cause**: `db.create()` method in SurrealDB HTTP client doesn't persist records  
**Impact**: Breaks metabob-cli → RPC API → Dashboard data flow  

## Bug Details

### Location
`repos/metabob-rpc-api/server/db/operations/project_ops.py:55`

```python
# BROKEN CODE (line 55)
result = await db.create("projects", data)
```

### Same Pattern as Authentication Bug
This is **identical** to the user registration bug fixed in commit d61fa57:
- commit d61fa57: Fixed user registration persistence
- commit 8016e08: Fixed login query parsing
- commit df63d83: Fixed schema field names

### Why db.create() Fails
The `surrealdb-py` HTTP client's `.create()` method:
1. Returns success (200 OK)
2. Generates a SurrealDB record ID (`projects:abc123`)
3. BUT: Record is NOT persisted to database
4. Subsequent SELECT queries return empty results

## Fix Applied

### Code Change
Replace `db.create()` with direct SQL INSERT:

```python
# FIXED CODE
created_at = datetime.utcnow().isoformat() + "Z"
updated_at = created_at

sql = """
    INSERT INTO projects {
        project_id: $project_id,
        org_id: $org_id,
        name: $name,
        git_root_hash: $git_root_hash,
        repository_url: $repository_url,
        branch: $branch,
        settings: $settings,
        created_at: $created_at,
        updated_at: $updated_at
    }
"""

params = {
    "project_id": project_id,
    "org_id": org_id,
    "name": name,
    "git_root_hash": git_root_hash,
    "repository_url": repository_url,
    "branch": branch or "main",
    "settings": settings or {},
    "created_at": created_at,
    "updated_at": updated_at,
}

result = await db.query(sql, params)
logger.info(f"Created project: {project_id} (org: {org_id})")

# Parse result with fallback pattern
if result and len(result) > 0:
    if isinstance(result[0], dict) and "result" in result[0]:
        records = result[0]["result"]
        if records and len(records) > 0:
            return sanitize_record(records[0])
    elif isinstance(result[0], list) and len(result[0]) > 0:
        return sanitize_record(result[0][0])

return {project_id: ..., org_id: ..., ...}  # Fallback
```

## Commit
```
commit adb858a
fix: Use SQL INSERT for project creation (SurrealDB persistence bug)

Same issue as user registration - db.create() doesn't persist with HTTP client.
Use direct SQL INSERT statements to ensure projects are queryable.

Fixes E2E data flow: metabob-cli → RPC API → SurrealDB → Dashboard
```

## Testing Evidence

### Before Fix
```bash
$ curl -X POST /api/auth/orgs/$ORG_ID/projects -d '{"name": "Test"}' 
{
  "id": "projects:abc123",
  "project_id": "uuid",
  "name": "Test",
  "created_at": "2026-03-12..."
}  # ✅ 201 CREATED

$ curl -X GET /api/auth/orgs/$ORG_ID/projects
{
  "projects": [],
  "total": 0
}  # ❌ Empty list
```

### After Fix (Expected)
```bash
$ curl -X POST /api/auth/orgs/$ORG_ID/projects -d '{"name": "Test"}'
{
  "id": "projects:abc123",
  "project_id": "uuid",
  "name": "Test"
}  # ✅ 201 CREATED

$ curl -X GET /api/auth/orgs/$ORG_ID/projects
{
  "projects": [
    {"project_id": "uuid", "name": "Test", ...}
  ],
  "total": 1
}  # ✅ Project appears in list
```

## Deployment Status
- ✅ Code fixed in: `repos/metabob-rpc-api/server/db/operations/project_ops.py`
- ✅ Committed: `adb858a`
- ⏳ Deployment pending: Need to rebuild Docker image and update Helm chart
- 🎯 Target image: `metabobapp/metabob-rpc-api:0.28.3-project-persistence-fix`

## Related Issues
All use same broken pattern (db.create/db.insert with HTTP client):

1. ✅ **FIXED** (d61fa57): User registration - `server/routes/cloud_auth.py`
2. ✅ **FIXED** (adb858a): Project creation - `server/db/operations/project_ops.py`
3. ⚠️ **TO CHECK**: Component creation - `server/db/operations/component_ops.py`
4. ⚠️ **TO CHECK**: Problem creation - `server/db/operations/problem_ops.py`
5. ⚠️ **TO CHECK**: Session creation - `server/db/operations/session_ops.py`

## Next Steps

1. **Immediate**: Rebuild and deploy RPC API with fix
2. **Audit**: Search all `*_ops.py` for `db.create()` and `db.insert()` calls
3. **Replace**: Convert all to SQL INSERT pattern
4. **Test**: Validate complete E2E flow after deployment
5. **Document**: Update architecture docs on SurrealDB client workaround

## Architecture Implication
**All SurrealDB writes via HTTP client MUST use SQL INSERT/UPDATE statements**

This is a **platform-wide constraint** that affects:
- User/org/project management
- Component/problem tracking  
- Session recording
- Activity execution history
- Any future table additions

Add to coding guidelines:
```python
# ❌ DO NOT USE (HTTP client bug)
await db.create("table", data)
await db.insert("table", data)

# ✅ USE THIS INSTEAD
sql = "INSERT INTO table { field: $value, ... }"
await db.query(sql, params)
```
