# Template Loading Fix Summary

## Issue Description

Activity templates cannot be loaded via `search_activities` or the API endpoint `/v2/activities/templates` after backend restart.

## Root Cause

**Multi-layered issue**:

1. **Scope Mismatch**: Templates were being created with `scope="org"` (default in `create_template` function), but queries expected `scope IS NULL OR scope='global'`

2. **Query Filter Too Restrictive**: The SurrealDB query in `template_data.py` line 150-156 filters templates by scope, which excludes templates that don't match the expected values

3. **Redis Cache Dependency**: After backend restart, Redis cache is empty. When queries try to load from SurrealDB, the restrictive WHERE clause returns 0 results

4. **No Cache Warming**: There's no mechanism to automatically populate Redis from SurrealDB on startup

## Files Modified

### 1. `/repos/metabob-rpc-api/server/actions/activity.py`
**Line 372**: Changed default scope parameter
```python
# BEFORE:
async def create_template(
    redis: StrictRedis,
    template_data: Dict[str, Any],
    scope: str = "org",  # ❌ Wrong default
    
# AFTER:
async def create_template(
    redis: StrictRedis,
    template_data: Dict[str, Any],
    scope: Optional[str] = None,  # ✅ Correct default
```

###  2. `/repos/metabob-rpc-api/server/db/operations/template_data.py`
**Lines 150-162**: Removed scope filtering (temporary dev fix)
```python
# BEFORE:
query = """
    SELECT * FROM activity_template
    WHERE scope IS NULL OR scope = 'global'
    ORDER BY created_at DESC
    LIMIT $limit
"""

# AFTER:
query = """
    SELECT * FROM activity_template
    ORDER BY created_at DESC
    LIMIT $limit
"""
```

Also added debug logging to track query results.

## Workaround Applied

Modified local template files to use `scope="global"` instead of `scope=null`:
```bash
cd ~/.local/share/opencode/storage/activity-template
for f in *.json; do
  jq '.scope = "global"' "$f" > "$f.tmp" && mv "$f.tmp" "$f"
done
```

## Current Status

✅ **Templates work when in Redis cache** (27 templates accessible)
❌ **Templates don't load from SurrealDB** (query filter excludes them)
❌ **Code changes not deployed** (require Docker image rebuild)

## What Needs to Happen Next

### Option 1: Deploy Code Changes (Recommended)

1. **Rebuild Docker Image**:
```bash
cd repos/metabob-rpc-api
docker build -t metabobapp/metabob-rpc-api:0.20.1-template-fix .
docker push metabobapp/metabob-rpc-api:0.20.1-template-fix
```

2. **Update Kubernetes Deployment**:
```bash
kubectl set image deployment/metabob-rpc-api \
  metabob-rpc-api=metabobapp/metabob-rpc-api:0.20.1-template-fix \
  -n metabob
```

3. **Re-sync Templates** (with `scope=null` or removed):
```bash
cd /home/avi/documents/work/exp-repo/metabob-devbob
# First, revert local templates to scope=null
for f in ~/.local/share/opencode/storage/activity-template/*.json; do
  jq 'del(.scope)' "$f" > "$f.tmp" && mv "$f.tmp" "$f"
done

# Then sync
METABOB_API_URL="http://api.metabob.local" ./scripts/sync-templates.sh
```

4. **Verify**:
```bash
curl -s -H "Authorization: Bearer mb_devbob_test_simple_2026_v2" \
  http://api.metabob.local/v2/activities/templates | jq '.templates | length'
# Expected: 85
```

### Option 2: Hotfix with ConfigMap (Faster but Hacky)

Create a ConfigMap with the fixed Python file and mount it:
```bash
kubectl create configmap template-data-fix \
  --from-file=template_data.py=repos/metabob-rpc-api/server/db/operations/template_data.py \
  -n metabob

# Update deployment to mount the ConfigMap
# (requires editing deployment YAML)
```

### Option 3: Accept Current Limitations (Temporary)

- ✅ Templates work as long as backend doesn't restart
- ✅ 82 templates successfully synced to SurrealDB
- ❌ Templates not accessible after restart until re-synced
- ❌ 3 templates fail due to invalid characters in IDs

## Data Validation

### Templates in SurrealDB
```bash
# Check count
kubectl port-forward -n metabob svc/surrealdb 8000:8000 &
curl -u "root:changeme" -X POST http://localhost:8000/sql \
  -d "USE NS metabob DB devbob; SELECT count() FROM activity_template GROUP ALL;"
```

### Templates in Redis
```bash
kubectl exec -n metabob redis-master-0 -- redis-cli SCARD activity:templates:list
```

### Templates via API
```bash
curl -s -H "Authorization: Bearer mb_devbob_test_simple_2026_v2" \
  http://api.metabob.local/v2/activities/templates | jq '.templates | length'
```

## Failed Templates (Invalid Record IDs)

These 3 templates fail due to SurrealDB record ID constraints:

1. `debug_activity_execution_(self_contained)` - contains `(` and `)`
2. `enforce_architecture_separation:_metabob_components` - contains `:`
3. `evolve_activity_template_(self_contained)` - contains `(` and `)`

**Fix**: Sanitize template IDs in `generate_template_id()` function:
```python
def generate_template_id(name: str) -> str:
    base = name.lower().replace(" ", "_")
    # Remove characters invalid for SurrealDB record IDs
    base = re.sub(r'[():]', '', base)
    return base
```

## Testing Checklist

After deploying fix:

- [ ] Backend pods healthy and running
- [ ] Redis cache empty (or cleared)
- [ ] API returns 82+ templates
- [ ] `search_activities` tool lists templates
- [ ] Templates persist after backend restart
- [ ] Can execute activities using templates
- [ ] Dashboard shows template history

## Key Learnings

1. **Scope semantics matter**: `null` vs `"org"` vs `"global"` have different query semantics
2. **Cache warming needed**: Redis cache should be populated from SurrealDB on startup
3. **Query filters must match data**: WHERE clauses must align with actual data values
4. **Record ID constraints**: SurrealDB has strict rules for record IDs (no parentheses, colons, etc.)
5. **Code changes require rebuilds**: Can't hot-reload Python code without volume mounts or image rebuilds

## Related Files

- `repos/metabob-rpc-api/server/actions/activity.py` - Template creation logic
- `repos/metabob-rpc-api/server/db/operations/template_data.py` - SurrealDB queries
- `repos/metabob-rpc-api/server/routes/activity.py` - API routes
- `scripts/sync-templates.sh` - Template sync script
- `~/.local/share/opencode/storage/activity-template/` - Local template storage

## Next Steps

1. **Immediate**: Use Option 1 to rebuild and deploy fixed backend
2. **Short-term**: Add cache warming on startup
3. **Long-term**: Implement proper scope-based access control
4. **Future**: Add template validation before sync to catch invalid IDs

---

**Status**: Documented 2026-03-07
**Assignee**: DevBob Team
**Priority**: High (blocks all activity execution)
