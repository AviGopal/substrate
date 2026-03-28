# Impulse Storage 400 Error Investigation and Fixes

## Problem

When running reliability hook tests, all impulse storage requests were failing with 400 errors, preventing the full integration testing of the reliability system.

## Root Causes Identified

### 1. Schema Validation Error (FIXED in MiniBob)

**Error**: `Invalid request body: Expected string, received null at path ["project_id"]`

**Location**: `repos/minibob/src/mcp.ts` line 568

**Cause**: The MCP client was sending `project_id: null` when no project was configured, but the backend schema requires `project_id` to be a string.

**Fix**:
```typescript
// Before
const projectId = this.getProjectId()

// After
const projectId = this.getProjectId() || 'default'
```

### 2. Extra Field in Payload (FIXED in MiniBob)

**Error**: `Invalid request body: Unrecognized keys: ["shape"]`

**Location**: `repos/minibob/src/mcp.ts` lines 594-614

**Cause**: The MCP client was sending a `shape` field as a sibling to `metadata` in `impulse_data`, but the backend schema (`ImpulseDataSchema`) only allows: `id`, `type`, `pointer`, `budget`, `priority`, `scope`, `metadata`.

**Fix**:
```typescript
// Before
impulse_data: {
  id: impulse.id,
  type: impulse.pointer?.type ?? "memo",
  pointer: impulse.pointer ?? { type: "memo", content: impulse.content ?? "" },
  budget: impulse.budget ?? 4000,
  priority: ...,
  shape: shape,  // ❌ NOT IN SCHEMA
  metadata: {
    tags: impulse.tags,
    content: impulse.content,
    shape: shape,
  },
}

// After
impulse_data: {
  id: impulse.id,
  type: impulse.pointer?.type ?? "memo",
  pointer: impulse.pointer ?? { type: "memo", content: impulse.content ?? "" },
  budget: impulse.budget ?? 4000,
  priority: ...,
  // Shape goes in metadata only
  metadata: {
    tags: impulse.tags,
    content: impulse.content,
    shape: shape,
  },
}
```

### 3. Environment Variable Mismatch (FIXED in MiniBob)

**Error**: Test was connecting to `https://activity.metabob.com` (production) instead of local backend

**Location**: `repos/minibob/.env` line 8

**Cause**: The `.env` file used `MINIBOB_MCP_ENDPOINT` but `config.ts` expects `ACTIVITY_API_ENDPOINT`.

**Fix**:
```bash
# Before
MINIBOB_MCP_ENDPOINT=http://activity.metabob.local

# After
ACTIVITY_API_ENDPOINT=http://activity.metabob.local
```

### 4. SurrealDB Datetime Coercion Error (IN PROGRESS - Backend)

**Error**: `Couldn't coerce value for field created_at: Expected datetime but found '2026-03-28T18:27:58.184Z'`

**Location**: `repos/metabob-activity-api/src/routes/impulses.ts` lines 204-224

**Cause**: The backend was passing ISO 8601 datetime strings as query parameters, but SurrealDB expects native datetime objects or the `time::now()` function.

**Fix Applied (but not yet deployed successfully)**:
```typescript
// Before
const now = new Date().toISOString();
const createQuery = `
  CREATE impulse_data CONTENT {
    impulse_id: $impulse_id,
    api_key: $api_key,
    project_id: $project_id,
    impulse_data: $impulse_data,
    created_at: $created_at,
    updated_at: $updated_at
  }
`;
const result = await surrealDB.query<any>(createQuery, {
  impulse_id,
  api_key,
  project_id,
  impulse_data,
  created_at: now,
  updated_at: now,
});

// After
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
const result = await surrealDB.query<any>(createQuery, {
  impulse_id,
  api_key,
  project_id,
  impulse_data,
});
```

**Status**: Code changes made locally but Docker image rebuild not successfully copying updated source files. Need to investigate Dockerfile caching or use alternative deployment method.

## Progress Summary

- ✅ Fixed MiniBob schema validation errors (project_id null, extra shape field)
- ✅ Fixed environment variable configuration
- ⏳ Backend datetime fix applied locally but deployment blocked by Docker build cache issue
- ❌ Full end-to-end test still failing on backend datetime coercion

## Next Steps

1. Resolve Docker image build cache issue for metabob-activity-api
2. Successfully deploy backend with datetime fix
3. Re-run integration tests to verify impulses store correctly
4. Proceed with full reliability hooks testing (T7)

## Files Modified

### MiniBob
- `repos/minibob/src/mcp.ts` - Fixed project_id default and shape field location
- `repos/minibob/.env` - Fixed environment variable name

### Backend (pending deployment)
- `repos/metabob-activity-api/src/routes/impulses.ts` - Fixed datetime handling

## Test Evidence

**Before fixes**: 400 errors with detailed validation messages logged
**After MiniBob fixes**: 500 errors (backend datetime issue)
**Expected after backend fix**: Impulses store successfully, hooks execute

