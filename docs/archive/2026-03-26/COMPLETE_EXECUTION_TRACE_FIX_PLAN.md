# Complete Fix Plan: Execution Trace Storage

**Date**: 2026-03-22
**Status**: Ready to implement
**Complexity**: Medium (4 files to modify)

## Issues Summary

### Issue 1: MiniBob Never Initializes executionTrace ❌ CRITICAL
**Location**: `repos/minibob/src/activity.ts:383-391`
**Impact**: `storeExecutionTrace()` is never called
**Fix**: Initialize `executionTrace` field when creating ActivityExecution

### Issue 2: MiniBob Never Populates executionTrace ❌ CRITICAL
**Location**: `repos/minibob/src/activity.ts` (throughout task execution)
**Impact**: Even if initialized, trace would be empty
**Fix**: Populate trace with task details, tool calls, state transitions

### Issue 3: No POST Endpoint for Execution Traces ❌ BLOCKER
**Location**: `repos/metabob-activity-api/src/routes/execution-traces.ts`
**Impact**: MiniBob can't store traces even if it wanted to
**Fix**: Add POST handler

### Issue 4: Conflicting Schema Definitions ⚠️ CONFUSION
**Location**:
- `sql/004-execution-traces.surql` → defines `execution_traces`
- `sql/005-dashboard-components.surql` → defines `activity_execution_traces`

**Impact**: Route queries `activity_execution_traces`, MiniBob sends to wrong endpoint
**Fix**: Reconcile schema naming

## Detailed Fixes

### Fix 1: Initialize executionTrace in MiniBob

**File**: `repos/minibob/src/activity.ts`
**Line**: 383-391

**Before**:
```typescript
const execution: ActivityExecution = {
  id: activityId,
  templateId: template.id,
  status: "executing",
  variables,
  impulses: [],
  taskResults: [],
  startedAt: Date.now(),
}
```

**After**:
```typescript
const execution: ActivityExecution = {
  id: activityId,
  templateId: template.id,
  status: "executing",
  variables,
  impulses: [],
  taskResults: [],
  startedAt: Date.now(),
  executionTrace: {
    tasks: [],
    impulsesCreated: [],
    filesModified: [],
    goalContext: goalContext ? { goal: goalContext } : undefined,
  },
}
```

### Fix 2: Populate executionTrace During Execution

**File**: `repos/minibob/src/activity.ts`
**Location**: Inside task execution loop (around line 430-450)

**Add after each task completes**:
```typescript
// After task completes successfully
if (execution.executionTrace) {
  execution.executionTrace.tasks.push({
    taskId: task.id,
    description: task.description,
    status: taskResult.status,
    prompt: messages[messages.length - 2]?.content || '', // User message
    response: messages[messages.length - 1]?.content || '', // Assistant message
    toolCalls: [], // TODO: Extract from ToolResult
    duration: taskResult.completedAt && taskResult.startedAt
      ? taskResult.completedAt - taskResult.startedAt
      : 0,
    inputState: {
      filesAvailable: [], // TODO: Capture available files
      environment: {},
      impulses: execution.impulses.map(i => i.id),
      variables: execution.variables,
    },
    outputState: {
      filesModified: [], // TODO: Detect modified files
      filesCreated: [],
      filesDeleted: [],
    },
    stateTransition: {
      before: {}, // TODO: File hashes before
      after: {},  // TODO: File hashes after
      workingDirectory: this.config.workingDirectory,
    },
  })
}
```

### Fix 3: Add POST Endpoint for Execution Traces

**File**: `repos/metabob-activity-api/src/routes/execution-traces.ts`
**Add after line 260** (after GET endpoints)

```typescript
/**
 * POST /v2/activities/execution-traces
 *
 * Store execution trace for future reference
 */
app.post('/', async (c) => {
  try {
    const session = c.get('session') as SessionData;
    const body = await c.req.json();

    // Validate required fields
    if (!body.execution_id || !body.template_id) {
      return c.json({
        error: 'Missing required fields',
        required: ['execution_id', 'template_id'],
      }, 400);
    }

    // Map MiniBob's field names to database schema
    const trace = {
      execution_id: body.execution_id,
      variant_id: body.template_id, // MiniBob sends template_id, we store as variant_id
      activity_id: body.activity_id || body.template_id, // Default to template_id if not provided
      success: body.status === 'completed' || body.success === true,
      duration_ms: body.duration_ms || 0,
      cost: body.cost_usd || body.cost || 0,
      tokens: body.tokens || {
        input: 0,
        output: 0,
        cache: 0,
      },
      // Optional fields
      error_message: body.error_message,
      error_type: body.error_type,
      failed_task_id: body.failed_task_id,
      impulses_used: body.impulses_used || [],
      component_changes: body.component_changes || [],
      tasks: body.execution_trace?.tasks || [],
      state_snapshot: body.execution_trace ? {
        input_state: body.execution_trace.tasks?.[0]?.inputState,
        output_state: body.execution_trace.tasks?.[body.execution_trace.tasks.length - 1]?.outputState,
        stateTransition: body.execution_trace.tasks?.[body.execution_trace.tasks.length - 1]?.stateTransition,
      } : undefined,
      org_id: session.org_id || null,
      project_id: session.project_id || null,
      executed_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
    };

    // Insert into database
    const query = `
      INSERT INTO activity_execution_traces $trace
      RETURN AFTER
    `;

    const result = await surrealDB.query(query, { trace });

    logger.info('Execution trace stored', {
      execution_id: trace.execution_id,
      variant_id: trace.variant_id,
      success: trace.success,
    });

    return c.json({
      success: true,
      execution_id: trace.execution_id,
      stored: true,
    });

  } catch (error) {
    logger.error('Failed to store execution trace', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });

    return c.json({
      error: 'Failed to store execution trace',
      message: error instanceof Error ? error.message : 'Unknown error',
    }, 500);
  }
});
```

### Fix 4: Reconcile Schema Naming

**Two options**:

#### Option A: Use activity_execution_traces (Recommended)
- Schema `005-dashboard-components.surql` already defines this
- Route already queries this table
- More descriptive name

**Action**: Update MiniBob to match:

**File**: `repos/minibob/src/mcp.ts:593`
```typescript
// No change needed - MiniBob posts to endpoint, not table
// Backend will handle table naming
```

#### Option B: Use execution_traces
- Schema `004-execution-traces.surql` defines this
- Need to update route queries

**Not recommended** - would require more changes

### Fix 5: Update MiniBob's storeExecutionTrace Payload

**File**: `repos/minibob/src/mcp.ts:591-618`

**Current**:
```typescript
const response = await this.request("POST", "/v2/activities/execution-traces", {
  execution_id: execution.id,
  template_id: execution.templateId,
  status: execution.status,
  duration_ms: execution.metrics?.duration || 0,
  cost_usd: execution.metrics?.cost || 0,
  execution_trace: execution.executionTrace || {
    tasks: [],
    impulsesCreated: [],
    filesModified: [],
  },
})
```

**Enhanced**:
```typescript
const response = await this.request("POST", "/v2/activities/execution-traces", {
  execution_id: execution.id,
  template_id: execution.templateId,
  activity_id: execution.templateId, // Add activity_id field
  status: execution.status,
  success: execution.status === "completed",
  duration_ms: execution.metrics?.duration || 0,
  cost_usd: execution.metrics?.cost || 0,
  tokens: {
    input: execution.metrics?.totalTokens?.input || 0,
    output: execution.metrics?.totalTokens?.output || 0,
    cache: 0,
  },
  execution_trace: execution.executionTrace || {
    tasks: [],
    impulsesCreated: [],
    filesModified: [],
  },
})
```

## Implementation Order

1. ✅ **Backend POST endpoint** (Fix 3) - Unblocks storage
2. ✅ **MiniBob payload update** (Fix 5) - Ensures correct data format
3. ✅ **Initialize executionTrace** (Fix 1) - Enables trace collection
4. ⚠️ **Populate executionTrace** (Fix 2) - Can be incremental

## Testing Plan

### Phase 1: Minimal Viable Fix (Fixes 1, 3, 5)

```bash
# 1. Implement backend POST endpoint
cd repos/metabob-activity-api
# Edit src/routes/execution-traces.ts
# Add POST handler

# 2. Restart backend
# (In Kubernetes or locally)

# 3. Update MiniBob
cd repos/minibob
# Edit src/activity.ts - add executionTrace initialization
# Edit src/mcp.ts - enhance payload

# 4. Test execution
bun run index.ts run templates/hello-world.json

# 5. Verify storage
curl -s 'http://api.minibob.local/v2/activities/execution-traces?limit=1' | jq .

# Expected: { "total": 1, "executions": [...] }
```

### Phase 2: Full Trace Population (Fix 2)

After Phase 1 works, incrementally add:
- Task details capture
- Tool call recording
- State transition tracking
- File change detection

## Success Criteria

### Immediate (Phase 1)
- [ ] POST endpoint responds 200
- [ ] Execution traces appear in database
- [ ] Dashboard shows execution history
- [ ] `total` > 0 when querying traces

### Complete (Phase 2)
- [ ] Traces include task-by-task details
- [ ] Tool calls recorded
- [ ] State transitions captured
- [ ] File changes tracked
- [ ] Ribosome can extract patterns from traces

## Rollback Plan

If issues occur:

1. **Backend crashes**: Remove POST endpoint, restart
2. **Database errors**: Check SurrealDB schema migration status
3. **MiniBob fails**: Revert executionTrace initialization
4. **Data corruption**: Clear `activity_execution_traces` table

## Monitoring

After deployment, monitor:

```bash
# Check trace count growing
watch -n 5 'curl -s "http://api.minibob.local/v2/activities/execution-traces?limit=1" | jq .total'

# Check for errors
kubectl logs -n activity-system -l app.kubernetes.io/name=metabob-activity-api -f | grep -i "execution.trace"

# Verify MiniBob logs
kubectl logs -n activity-system -l app.kubernetes.io/name=minibob -f | grep -i "trace stored"
```

## Expected Timeline

- **Backend POST endpoint**: 30 minutes
- **MiniBob initialization**: 15 minutes
- **Testing & verification**: 30 minutes
- **Total for Phase 1**: ~1.5 hours

- **Trace population**: 2-3 hours (incremental)
- **Complete validation**: 1 hour
- **Total for Phase 2**: ~4 hours

**Total project**: ~5-6 hours to full functionality

## Dependencies

None - all fixes are isolated to:
- MiniBob codebase (no external dependencies)
- Backend API (Hono/SurrealDB already configured)
- Schema already exists in `005-dashboard-components.surql`

## Risk Assessment

**Low Risk**:
- Changes are additive (new POST endpoint, new field initialization)
- Existing functionality unaffected
- Can be rolled back easily
- No breaking changes to existing APIs

**Medium Risk**:
- Schema naming confusion (mitigated by using existing `activity_execution_traces`)
- Potential for large trace payloads (mitigated by schema limits)

**High Risk**:
- None identified

## Questions to Resolve

1. ❓ Should we deprecate `004-execution-traces.surql` (old schema)?
2. ❓ Should traces be retained indefinitely or pruned after N days?
3. ❓ Should trace storage failures block activity execution?
4. ❓ What's the max trace size we should accept?

**Recommendations**:
1. Yes - mark 004 as deprecated, use 005 schema
2. Prune after 30 days (configurable)
3. No - log warning but continue
4. 10MB per trace (reject larger)

## Next Steps

1. Review this plan
2. Confirm approach
3. Implement Phase 1 (minimal viable fix)
4. Test and verify
5. Proceed with Phase 2 if needed
