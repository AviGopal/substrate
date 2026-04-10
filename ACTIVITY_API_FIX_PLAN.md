# Activity API Template Fetch 500 Error - Fix Plan

**Issue**: GET /v2/activities/templates/{id} returns 500 error when fetching template by ID

**Trace**: `activity_execution_traces:u2pc5zg4ybcirfu7cpjb`

## Root Cause Analysis

### Problem
The endpoint at `src/routes/activities.ts:1294-1373` queries:
```typescript
WHERE (meta::id(id) = $variant_id OR meta::id(id) = $normalized_id)
  AND execution_type = 'template'
```

This fails when:
1. Template doesn't have `execution_type` field set
2. Template has `execution_type = null` or different value
3. Query logic doesn't handle all ID format variations

### ID Format Variations
Templates can be stored with IDs in multiple formats:
- Simple: `detect-execution-bugs`
- Angle-bracket: `⟨detect-execution-bugs⟩`
- Full record: `activity:detect-execution-bugs`
- Full with brackets: `activity:⟨detect-execution-bugs⟩`

## Fix Strategy

### Option 1: Make execution_type Optional in Query (RECOMMENDED)
Change the WHERE clause to:
```typescript
WHERE (meta::id(id) = $variant_id OR meta::id(id) = $normalized_id)
  AND (execution_type = 'template' OR execution_type = NONE OR execution_type IS NULL)
```

**Pros**: Works with all existing data
**Cons**: May return non-template records if not careful

### Option 2: Backfill execution_type for All Templates
Run migration to set `execution_type = 'template'` on all activity records that are templates.

**Pros**: Clean data model
**Cons**: Requires migration, might miss some templates

### Option 3: Remove execution_type Filter for Single Template Fetch
Since we're fetching by explicit ID, we don't need the execution_type filter for this endpoint.

**Pros**: Simplest fix
**Cons**: Might return execution records if IDs overlap

## Recommended Implementation

**Immediate Fix** (Option 3): Remove execution_type filter from single template fetch
```typescript
// Line 1330-1333
const variantQuery = `
  SELECT * FROM activity
  WHERE (meta::id(id) = $variant_id OR meta::id(id) = $normalized_id)
  LIMIT 1
`;
```

**Follow-up** (Option 2): Add migration to backfill execution_type
```surql
UPDATE activity SET execution_type = 'template'
WHERE execution_type IS NONE
  AND tasks IS NOT NONE
  AND tasks != [];
```

## Testing

### 1. Verify Current State
```bash
# Check if detect-execution-bugs exists
curl "https://activity.metabob.com/v2/activities/templates" \
  -H "Authorization: ApiKey $METABOB_API_KEY" | \
  jq '.templates[] | select(.id | contains("detect"))'

# Try to fetch it directly
curl "https://activity.metabob.com/v2/activities/templates/detect-execution-bugs" \
  -H "Authorization: ApiKey $METABOB_API_KEY"
```

### 2. After Fix
```bash
# Should return 200 with template data
curl "https://activity.metabob.com/v2/activities/templates/detect-execution-bugs" \
  -H "Authorization: ApiKey $METABOB_API_KEY" | jq '.'
```

### 3. Verify MiniBob Can Use It
```bash
minibob --single "Use detect-execution-bugs activity to analyze a log file"
```

## Deployment Steps

1. **Apply fix** to `repos/metabob-activity-api/src/routes/activities.ts`
2. **Run tests**: `cd repos/metabob-activity-api && bun test`
3. **Test locally** with SurrealDB connection
4. **Commit** to main workspace
5. **Push to dev** branch in deployment repo
6. **CI/CD** auto-deploys to canary
7. **Verify** at activity.metabob.com
8. **Test** with MiniBob execution
9. **Monitor** traces for successful template fetch

## Files to Modify

- `repos/metabob-activity-api/src/routes/activities.ts` (line 1330-1333, 1344-1347)
- Optionally: Add migration `sql/migrations/054-backfill-execution-type.surql`

## Success Criteria

- ✅ GET /v2/activities/templates/{id} returns 200 for registered templates
- ✅ MiniBob can fetch and execute registered activities
- ✅ No 500 errors in activity-api logs
- ✅ Templates visible in GitHub Pages dashboard
