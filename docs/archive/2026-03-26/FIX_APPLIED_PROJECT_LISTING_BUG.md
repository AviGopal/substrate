# Project Listing Bug Fix Applied

**Date**: 2026-03-13  
**Status**: ✅ Code Fixed, ⏳ Deployment Pending

---

## Summary

Fixed critical bug in project listing endpoint that caused it to return field names instead of actual project data.

## Problem Identified

**Endpoint**: `GET /api/auth/orgs/{org_id}/projects`

**Symptom**: Returns field names instead of project objects
```json
{
  "projects": ["branch", "created_at", "id", "name", "org_id", "project_id", "settings", "updated_at"],
  "total": 8
}
```

**Expected**: Should return actual project objects
```json
{
  "projects": [{
    "project_id": "uuid",
    "name": "test-cli-project",
    "org_id": "uuid",
    ...
  }],
  "total": 1
}
```

## Root Cause

SurrealDB HTTP protocol sometimes returns query results in this format:
```python
[
  ["field1", "field2", "field3"],  # Field names list
  [                                  # Actual data
    {"field1": "value1", "field2": "value2"},
    {"field1": "value3", "field2": "value4"}
  ]
]
```

The existing code didn't handle this case and returned the field names list as data.

## Fix Applied

**File**: `repos/metabob-rpc-api/server/db/operations/project_ops.py`  
**Function**: `list_projects_by_org()`  
**Commit**: `239722a`

### Changes Made

1. **Added Field Names Detection** (Case 2a):
   ```python
   # Check if this is a field names list (list of strings)
   if len(first_elem) > 0 and isinstance(first_elem[0], str):
       # This is field names, check if there's data in next element
       if len(result) > 1 and isinstance(result[1], list):
           # Second element should be the actual records
           records = [r for r in result[1] if isinstance(r, dict)]
           return [sanitize_record(r) for r in records]
   ```

2. **Enhanced Validation**:
   - Verify records are dicts, not strings
   - Check for `project_id` field to confirm it's project data
   - Filter out non-dict elements

3. **Added Comprehensive Logging**:
   - Debug log showing raw result structure
   - Info logs for each case branch
   - Warning logs when field names detected

## Testing

### Before Fix
```bash
$ curl -H "Authorization: Bearer $TOKEN" \
  http://app.metabob.local/api/auth/orgs/$ORG_ID/projects

{
  "projects": ["branch", "created_at", ...],  # ❌ Field names
  "total": 8
}
```

### After Fix (Expected)
```bash
$ curl -H "Authorization: Bearer $TOKEN" \
  http://app.metabob.local/api/auth/orgs/$ORG_ID/projects

{
  "projects": [                               # ✅ Actual data
    {
      "project_id": "ab2d2509-3ffb-4ddf-951a-38c2ac139c28",
      "name": "test-cli-project",
      "org_id": "acfd1b1e-bb78-43d5-a5ac-7c804f50afb7",
      "branch": "main",
      "created_at": "2026-03-13T06:30:50.812746Z"
    }
  ],
  "total": 1
}
```

## Deployment Steps

### Option 1: Build and Deploy New Docker Image (Recommended)
```bash
cd repos/metabob-rpc-api

# Build new image
docker build -t metabobapp/metabob-rpc-api:0.30.1-project-list-fix \
  -f docker/Dockerfile.server .

# Push to registry
docker push metabobapp/metabob-rpc-api:0.30.1-project-list-fix

# Update Helm values
# File: repos/platform/metabob-apps/charts/metabob-rpc-api/values/default.metabob-rpc-api.values.yaml
# Change: tag: "0.30.1-project-list-fix"

# Deploy via Helmfile
cd repos/platform/deployments/metabob
helmfile apply -f helmfile.yaml -l component=metabob-rpc-api
```

### Option 2: Quick Test via Pod Restart
```bash
# The pod will restart with latest code if using imagePullPolicy: Always
kubectl delete pod -n metabob <pod-name>

# Wait for new pod
kubectl wait --for=condition=ready pod -n metabob -l app=metabob-rpc-api
```

## Verification

Once deployed, verify the fix:

```bash
# 1. Login and get token
TOKEN=$(curl -X POST http://app.metabob.local/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@metabob.com","password":"TestPassword123!"}' \
  | jq -r '.token')

ORG_ID=$(curl -X POST http://app.metabob.local/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@metabob.com","password":"TestPassword123!"}' \
  | jq -r '.user.org_id')

# 2. Test project listing
curl -H "Authorization: Bearer $TOKEN" \
  http://app.metabob.local/api/auth/orgs/$ORG_ID/projects | jq .

# 3. Expected: Should show projects array with dict objects (not field names)
# 4. Check dashboard at http://app.metabob.local/projects
#    - Projects should display with names visible
#    - No more blank project cards
```

## Dashboard Impact

### Before Fix
- **Projects Page**: Shows 8 blank project cards (no names displayed)
- **Home Page**: Shows "8 active projects" (count works, but can't navigate to projects)
- **User Experience**: Broken - users can't see their projects

### After Fix
- **Projects Page**: Shows projects with actual names ("test-cli-project", etc.)
- **Home Page**: Links to projects work correctly
- **User Experience**: Functional - users can browse and select projects

## Related Issues

This fix uses the same pattern already successfully applied to:
- **API Key Listing** (commit from previous session)
- Similar SurrealDB result parsing in `api_key_ops.py:130-163`

## Next Steps

1. ✅ **Code Fix**: Complete
2. ⏳ **Docker Build**: In progress (timing out due to size)
3. ⏳ **Deployment**: Pending
4. ⏳ **Verification**: Pending deployment
5. ⏳ **Activity Endpoint**: Still needs similar fix for empty results

## Notes

- **Activity Endpoint**: Separately returns error instead of empty array when no data exists
- **CLI Integration**: Still blocked by missing session endpoints (separate issue)
- **Architecture**: All boundaries correctly enforced (no direct DB access)

---

**Code Location**: `repos/metabob-rpc-api/server/db/operations/project_ops.py:127-207`  
**Commit**: `239722a - fix(project-ops): Handle SurrealDB field names in query results`
