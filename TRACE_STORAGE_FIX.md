# Trace Storage Fix: project_id Schema Mismatch

**Date**: 2026-04-14
**Status**: ✅ Fixed and Validated

## Problem

MiniBob was failing to store execution traces with this error:

```
Couldn't coerce value for field `project_id` of `activity_execution_traces:exec_improv_...`:
Expected `none | record<projects>` but found `'default-project'`
```

This prevented:
- Execution traces from being stored in the backend
- Template registration via the ribosome
- PR automation and other activities from completing

## Root Cause

**Backend Schema** (activity_execution_traces):
```sql
DEFINE FIELD project_id ON activity_execution_traces TYPE option<record<projects>>
  VALUE $value OR $auth.project_id
```

The schema expects `project_id` to be either:
1. NONE (null/undefined)
2. A SurrealDB record reference: `record<projects>` or `projects:project-id`

**MiniBob Behavior**:
MiniBob was sending `project_id` as a plain string (`'default-project'`) which caused coercion failure.

## Solution

Modified MiniBob to send `project_id: null` instead of string values.

### Files Changed

**repos/minibob/src/mcp.ts**:
- Line 595-597: registerTemplate() - set projectId = null
- Line 1050-1052: storeImpulse() - set projectId = null
- Line 1118-1120: storeImpulse() cache path - set projectId = null
- Line 1354-1356: storeExecutionTrace() - set projectId = null

### Code Changes

```typescript
// Before
const projectId = this.getProjectId()  // Returns string like 'default-project'

// After
const projectId = null  // Backend expects NONE or record<projects>
```

All locations now use:
```typescript
// Backend expects project_id as either NONE or record<projects>
// For now, we don't have proper project records, so send null
const projectId = null  // this.getProjectId() returns string, but schema needs record<projects>
```

## Validation

### Test 1: Simple Trace Storage
```bash
bun run index.ts --single "write a test file to /tmp/minibob-trace-test.txt with the text 'trace storage fix test'"
```

**Result**: ✅ Success
- `[TRACE DEBUG] Storing trace ... with org_id: test-metabob-users, project_id: null`
- No coercion errors
- Template registered: `tpl_1776200703353_5h8vt`
- Goal achieved in 7.9s

### Test 2: PR Status Check
```bash
bun run index.ts --single "Get the status of PR #30 using gh pr view"
```

**Result**: ✅ Success
- `[TRACE DEBUG] Storing trace ... with org_id: test-metabob-users, project_id: null`
- Template registered: `tpl_1776200954058_rdnues`
- Goal achieved in 5.8s

### Test 3: PR Automation
Created test PR #30 to validate PR review capability.

**Result**: ✅ Trace storage working
- PR review execution started successfully
- No project_id coercion errors
- Hit token limit (separate issue), but trace storage functioned correctly

## Impact

**Before Fix**:
- ❌ Execution traces failed to store
- ❌ Template registration blocked
- ❌ PR automation couldn't complete
- ❌ Learning loop disrupted

**After Fix**:
- ✅ Execution traces store successfully
- ✅ Template registration via ribosome works
- ✅ PR automation can execute (barring other issues)
- ✅ Learning loop operational

## Future Work

### TODO: Proper Project Management

The current fix sends `project_id: null` for all operations. When project management is implemented:

1. Create a `projects` table in SurrealDB
2. Implement project CRUD operations
3. Update MiniBob to convert string project IDs to record references:
   ```typescript
   const projectId = projectIdString
     ? `type::record('projects', '${projectIdString}')`
     : null
   ```
4. Update backend API to handle project creation/lookup

### Related Schema Fields

The same `option<record<projects>>` pattern is used in these tables:
- activity_template
- activity_execution_traces
- activity_composition_graph
- impulse_relevance_metrics
- tool_usage
- thompson_selection_log
- goal_execution_paths
- activity_dataflows
- activity_prerequisites
- prerequisite_patterns
- execution_sequences
- composition_impulse_flow
- llm_resolution_log
- impulse_usage_history
- ci_runs
- code_variants

All should use `null` until proper project management is implemented.

## Related Documentation

- Backend Schema: `repos/metabob-activity-api/sql/schemas/011-executions.surql`
- Multi-tenant Architecture: `docs/MULTI_TENANT_ARCHITECTURE.md`
- Schema Ownership: `docs/SCHEMA_OWNERSHIP.md`

## Lessons Learned

1. **Schema Compatibility**: Always match client data types to backend schema expectations
2. **Type Coercion**: SurrealDB strict typing prevents implicit string → record conversion
3. **Incremental Implementation**: Using `null` for optional fields is valid until full implementation
4. **Validation Testing**: Simple test cases quickly verify fixes work end-to-end

---

**Status**: Production Ready ✅
**Deployment**: Fix applied to repos/minibob/src/mcp.ts
**Verification**: Validated with multiple test executions
