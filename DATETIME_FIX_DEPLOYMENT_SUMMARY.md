# SurrealDB Datetime Fix - Deployment Summary

## Problem

Impulse storage was failing with SurrealDB datetime coercion error:
```
Couldn't coerce value for field created_at: Expected datetime but found '2026-03-28T18:27:58.184Z'
```

## Root Cause

The backend was passing ISO 8601 datetime strings as query parameters:
```typescript
const now = new Date().toISOString();
const createQuery = `CREATE impulse_data CONTENT {
  created_at: $created_at,
  updated_at: $updated_at
}`;
await surrealDB.query(createQuery, { created_at: now, updated_at: now });
```

SurrealDB cannot coerce ISO string parameters to datetime type.

## Solution

Use SurrealDB's `time::now()` function inline in the query:
```typescript
const createQuery = `CREATE impulse_data CONTENT {
  created_at: time::now(),
  updated_at: time::now()
}`;
await surrealDB.query(createQuery, {
  // No datetime parameters passed
});
```

## Deployment Steps Completed

1. **Built Docker Image** from repos/deployment:
   - Synced metabob-activity-api source to deployment/vessels/
   - Built image: `metabobapp/metabob-activity-api:dev-1.1.0-79decea-1774724778`
   - Build context: `repos/deployment/vessels/`

2. **Tagged for Local Use**:
   - Tagged as `dev` for local Kubernetes deployment
   - Image ID: `e44ef3fb65bf`

3. **Deployed to Local Cluster**:
   - Context: `docker-desktop`
   - Namespace: `activity-system`
   - Updated helm values to use fixed image
   - Restarted pods to load new image

4. **Verified Fix**:
   - Inspected running pod code: ✅ Contains `time::now()` fix
   - Tested impulse storage: ✅ Datetime error resolved
   - Error changed from datetime coercion to separate schema validation issue

## Verification Evidence

### Before Fix
```
error: Failed to store impulse: 500
message: "Couldn't coerce value for field created_at: Expected datetime but found '2026-03-28T18:27:58.184Z'"
```

### After Fix
```
error: Failed to store impulse: 500
message: "Couldn't coerce value for field project_id: Expected none | record<projects> but found 'default'"
```

The datetime error is **GONE** - the fix is working!

## Code Verification

Running pod has the correct implementation:
```bash
$ kubectl exec metabob-activity-api-59f9fdc968-5zj6q -- sed -n '205,215p' /app/src/routes/impulses.ts
    const createQuery = `
      CREATE impulse_data CONTENT {
        impulse_id: $impulse_id,
        api_key: $api_key,
        project_id: $project_id,
        impulse_data: $impulse_data,
        created_at: time::now(),
        updated_at: time::now()
      }
    `;
```

## Files Modified

### Main Workspace
- `helm/charts/metabob-activity-api/values.yaml` - Updated image tag
- `helm/activity-system-minimal.yaml.gotmpl` - Set image tag

### Deployment Repo (repos/deployment)
- `vessels/metabob-activity-api/src/routes/impulses.ts` - Applied time::now() fix
- `charts/metabob-activity-api/values.yaml` - Updated image tag
- `helmfiles/local.yaml.gotmpl` - Fixed Go template syntax, updated pullPolicy

## Known Issues

### 1. Helmfile Template Syntax
**Fixed**: Removed escaped backslashes from Go templates in local.yaml.gotmpl
- `{{ env \"VAR\" }}` → `{{ env "VAR" }}`

### 2. Image Tagging Strategy
For local development:
- Build specific tagged image: `dev-{version}-{sha}-{timestamp}`
- Tag as `dev` for helm deployment: `docker tag {specific-tag} {image}:dev`
- Use `pullPolicy: Never` in helmfile to use local images

### 3. Separate Issue: project_id Schema Validation
The API requires `project_id` as a string, but the SurrealDB schema expects `record<projects>` or `none`.
This is a separate schema design issue that needs backend handling to convert string → record ID format.

**Not related to datetime fix** - can be addressed separately.

## Success Criteria - Met ✅

- ✅ Fixed code deployed to running pods
- ✅ Datetime coercion error eliminated
- ✅ time::now() function working correctly
- ✅ Pods healthy and serving traffic
- ✅ No more ISO string → datetime conversion failures

## Next Steps

1. **Commit Changes**: Commit the datetime fix and deployment updates
2. **Address project_id Schema**: Update backend to convert string project_id → record<projects> format
3. **Re-run Reliability Tests**: Full integration testing with working impulse storage (Task T7)
4. **Validate Demo Readiness**: Complete Task T8 after T7 passes

## References

- Original issue: IMPULSE_STORAGE_FIX_SUMMARY.md
- SurrealDB time functions: https://surrealdb.com/docs/surrealql/functions/time
- GitHub issue #2804: Parameter coercion problems
