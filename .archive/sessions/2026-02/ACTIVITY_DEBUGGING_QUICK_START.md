# Activity Debugging Quick Start

**TL;DR**: How to debug and fix failing activities right now (before self-healing is implemented)

---

## Current Problem

Activities fail with no error details:
- Backend shows: `{ tasks: 0, success: false }`
- No indication of which task failed
- No error messages or context
- Cannot learn from failures

---

## Immediate Debugging Steps

### 1. Check Backend Execution Record

```bash
# Find recent executions
curl -H "Authorization: Bearer $(cat .metabob/state | grep session_token | cut -d'"' -f4)" \
  http://localhost:8080/v2/activities/executions?limit=10 | jq

# Get specific execution
curl -H "Authorization: Bearer $(cat .metabob/state | grep session_token | cut -d'"' -f4)" \
  http://localhost:8080/v2/activities/executions/exec_XXXXX | jq
```

**What to look for**:
- `success: false` → Activity failed
- `duration: 0` → Failed immediately (likely variable missing)
- `duration: >30000` → Failed mid-execution (likely tool/LLM issue)
- `tasks: 0` → Task-level tracking not working (known issue)

### 2. Check RPC API Logs

```bash
# View last 50 lines of backend logs
docker logs devbob-rpc-api --tail 50

# Follow logs in real-time
docker logs -f devbob-rpc-api
```

**What to look for**:
- `ERROR` lines near execution timestamp
- Stack traces
- `activity_service.py` errors
- Database query failures

### 3. Check OpenCode Session Logs

```bash
# Find OpenCode process
ps aux | grep opencode | grep -v grep

# View OpenCode output (running in pts/4 terminal)
# Unfortunately OpenCode logs go to terminal, not file
# Future: Add file logging to OpenCode
```

### 4. Enable Verbose Logging (Manual)

**OpenCode**:
Edit `repos/metabob-opencode/packages/opencode/src/session/enhanced-activity-integration.ts`

Add console.log statements:
```typescript
async executeTask(task: ActivityTask) {
  console.log(`[ACTIVITY] Starting task ${task.name}`);
  console.log(`[ACTIVITY] Variables:`, this.variables);
  console.log(`[ACTIVITY] Impulses:`, this.loadedImpulses);
  
  try {
    const result = await this.runSubagent(task);
    console.log(`[ACTIVITY] Task succeeded:`, result);
    return result;
  } catch (error) {
    console.error(`[ACTIVITY] Task failed:`, error);
    console.error(`[ACTIVITY] Error stack:`, error.stack);
    throw error;
  }
}
```

**CLI MCP Server**:
Edit `repos/metabob-cli/src/metabob_cli/mcp/activity_manager.py`

Change logging level:
```python
import logging
logging.basicConfig(level=logging.DEBUG)
```

---

## Manual Failure Analysis

### Step 1: Reproduce Failure

```javascript
// In OpenCode Activity Mode session
const result = await activity({
  activityId: "other-97e440b7",  // The failing activity
  variables: {
    // Use same variables that caused failure
    resource_name: "users"
  },
  reason: "Debug failure"
});

// Note the execution_id from error message
```

### Step 2: Inspect Execution State

```bash
# Query backend for execution record
EXEC_ID="exec_XXXXX"  # From step 1
TOKEN=$(cat .metabob/state | grep session_token | cut -d'"' -f4)

curl -H "Authorization: Bearer $TOKEN" \
  "http://localhost:8080/v2/activities/executions/$EXEC_ID" | jq
```

### Step 3: Categorize Error

**Immediate Failure (duration ~0ms)**:
- ❌ **Variable missing**: Required variable not provided
- ❌ **Impulse not found**: Referenced impulse doesn't exist
- ❌ **Permission denied**: Backend auth failure

**Mid-Execution Failure (duration >30s)**:
- ❌ **Tool not found**: Metabob tool unavailable in session
- ❌ **Timeout**: LLM or tool call took too long
- ❌ **Test failure**: Generated code doesn't pass tests
- ❌ **Syntax error**: Generated code has syntax issues

**Partial Completion (2/6 tasks)**:
- ❌ **Task-specific error**: One task failed, rest skipped
- Check which task by counting task duration (task N failed if sum of durations = failure time)

### Step 4: Apply Manual Fix

Based on error category, apply fix to activity template:

#### Variable Missing
```bash
# Clone variant and add default value
# Currently requires SQL:
docker exec -it devbob-db surreal sql --namespace metabob --database devbob

# In SurrealDB shell:
LET $variant = (SELECT * FROM activity_variants WHERE variant_id = "other-97e440b7");
LET $new_variant = $variant[0];
UPDATE $new_variant SET 
  variables += { "endpoint_path": "/api/resource" },
  variant_id = "other-97e440b7-fixed-v1",
  metadata.healed_from = "other-97e440b7";
```

#### Tool Not Found
- Check if Metabob tool is available in session:
  ```javascript
  await metabob_search_codebase_issues({ query: "test", limit: 1 });
  // If error → Tool not available, need to fix MCP connection
  ```

#### Timeout
- Increase task timeout in template (not currently exposed, needs implementation)

#### Test Failure
- Review generated code in workspace
- Fix test or fix code generation prompt in template

---

## Common Failure Patterns

### Pattern 1: "Variable not provided"

**Symptom**: Immediate failure (0ms duration)

**Root Cause**: Activity template references variable that wasn't passed

**Fix**: Add variable to activity call OR add default to template

**Example**:
```javascript
// Before (fails)
activity({
  activityId: "other-97e440b7",
  variables: { resource_name: "users" },  // Missing endpoint_path!
  reason: "..."
});

// After (works)
activity({
  activityId: "other-97e440b7",
  variables: { 
    resource_name: "users",
    endpoint_path: "/api/users"  // Added
  },
  reason: "..."
});
```

### Pattern 2: "Metabob tool not found"

**Symptom**: Mid-execution failure, error mentions tool name

**Root Cause**: MCP connection dropped or tool not registered

**Fix**: Restart MCP server and OpenCode

**Steps**:
```bash
# 1. Check MCP connection
# In OpenCode:
const result = await metabob_search_codebase_issues({ query: "test", limit: 1 });

# 2. If fails, restart MCP server
pkill -f "metabob-cli mcp"
cd repos/metabob-cli
metabob-cli mcp --transport stdio &

# 3. Restart OpenCode (exit and relaunch)
# 4. Retry activity
```

### Pattern 3: "Partial completion (2/6 tasks)"

**Symptom**: Some tasks complete, then failure

**Root Cause**: Mid-execution error in specific task

**Debug**:
1. Count completed tasks from logs
2. Identify which task failed (task index = completed + 1)
3. Review that task's prompt in template
4. Check if task requires unavailable tool or data

**Fix**: Modify task prompt or split into smaller tasks

---

## Workarounds Until Self-Healing Implemented

### Workaround 1: Use Simple Templates Only

**Problem**: Complex templates (6-8 tasks) fail

**Workaround**: Break into multiple simple activities

```javascript
// Instead of:
activity({ 
  activityId: "complex-8-tasks",  // Fails
  variables: {...} 
});

// Do:
activity({ activityId: "simple-step-1", variables: {...} });  // 2 tasks
activity({ activityId: "simple-step-2", variables: {...} });  // 2 tasks
activity({ activityId: "simple-step-3", variables: {...} });  // 2 tasks
```

### Workaround 2: Provide All Variables Explicitly

**Problem**: Missing variables cause immediate failure

**Workaround**: Always provide full variable set

```javascript
// Check template variables first:
const template = await search_activities({ query: "add-rest-endpoint" });
console.log(template.activities[0].variables);
// ["resource_name", "endpoint_path", "http_method", ...]

// Provide ALL variables:
activity({
  activityId: "other-97e440b7",
  variables: {
    resource_name: "users",
    endpoint_path: "/api/users",
    http_method: "GET",
    // ... all variables
  },
  reason: "..."
});
```

### Workaround 3: Test in Isolation First

**Problem**: Don't know which component causes failure

**Workaround**: Test Metabob tools separately before activity

```javascript
// Before running activity, test tools it uses:
await metabob_search_codebase_issues({ query: "endpoint", limit: 5 });
await metabob_list_file_components({ file_path: "src/api.ts" });

// If tools work, activity should work (assuming variables correct)
```

---

## Next Steps

1. **Immediate** (Today):
   - Add verbose logging to OpenCode executor (see above)
   - Test simple activity with logging enabled
   - Verify task-level data captured

2. **This Week**:
   - Implement Phase 1 of self-healing (state capture)
   - Test that task results persist to backend
   - Verify `tasks: [...]` array populated

3. **Next Week**:
   - Implement failure analyzer
   - Test manual failure analysis workflow
   - Document common error categories

4. **Following Week**:
   - Implement self-healing system
   - Test auto-healing with known failure patterns
   - Measure improvement in success rates

---

## Support

**If stuck**, check:
1. `ACTIVITY_SYSTEM_OPERATIONAL_FEB15.md` - System status
2. `LOCAL_DEVELOPMENT_ARCHITECTURE.md` - Component details
3. `ACTIVITY_DEBUGGING_AND_SELF_HEALING.md` - Full design doc
4. Backend logs: `docker logs devbob-rpc-api --tail 100`
5. SurrealDB data: `docker exec -it devbob-db surreal sql`

---

**Created**: February 15, 2026  
**Status**: 🚀 Ready for use  
**Priority**: 🚨 Essential for activity development
