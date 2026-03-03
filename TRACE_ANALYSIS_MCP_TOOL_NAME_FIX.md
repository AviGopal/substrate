# Trace Analysis: Correct MCP Tool Name and Parameters

**Date:** 2026-03-02  
**Specification:** Correct MCP Tool Name and Parameters  
**Severity:** 🔴 CRITICAL  
**Impulse ID:** trace-Correct MCP Tool Name and Parameters  
**Status:** ✅ Traced, Ready for Enforcement

---

## Executive Summary

The MCP tool call in `template-metrics-client.ts` uses incorrect tool name `'post_activity_result'` but the actual registered tool is `'metabob_post_activity_result'` (with `metabob_` prefix). Additionally, parameter names are incorrect (`activityId` vs `activity_id`) and an invalid `backend` parameter is included.

**Impact:** Metrics recording fails silently, learning system cannot function, template executions not tracked.

---

## Specification

### Expected Behavior

1. Use correct tool name: `callMCPTool('metabob_post_activity_result', ...)` with the `metabob_` prefix
2. Use correct parameter names: `activity_id` not `activityId` (snake_case not camelCase)
3. Remove invalid parameters: no `backend` parameter in MCP tool signature
4. Match MCP tool signature exactly: `metabob_post_activity_result(activity_id: str, result: dict, ctx: Context)`
5. Tool successfully invoked, execution data recorded to database
6. Metrics updated in template_metrics table
7. Learning system receives execution data for Thompson sampling

---

## Component Analysis

### Component 1: OpenCode Template Metrics Client ❌ NEEDS FIX

**File:** `repos/metabob-opencode/packages/opencode/src/session/template-metrics-client.ts`  
**Lines:** 97-147  
**Component:** `TemplateMetricsClient.reportExecution`

**Current Behavior:**
```typescript
// Line 109
const result = await callMCPTool(
  "post_activity_result",  // ❌ WRONG: Missing 'metabob_' prefix
  {
    activityId: data.activity_id,  // ❌ WRONG: camelCase instead of snake_case
    result: {
      success: data.success,
      duration: data.duration,
      cost: data.cost,
      tokens: data.tokens ? { ... } : undefined,
    },
    backend: "all",  // ❌ WRONG: Invalid parameter not in MCP tool signature
  },
)
```

**Desired Behavior:**
```typescript
// Line 109
const result = await callMCPTool(
  "metabob_post_activity_result",  // ✅ CORRECT: With 'metabob_' prefix
  {
    activity_id: data.activity_id,  // ✅ CORRECT: snake_case parameter name
    result: {
      success: data.success,
      duration: data.duration,
      cost: data.cost,
      tokens: data.tokens ? { ... } : undefined,
    },
    // ✅ CORRECT: No 'backend' parameter
  },
)
```

**Gap:**
- Tool name missing `metabob_` prefix
- Parameter names in wrong case (camelCase vs snake_case)
- Extra invalid parameter (`backend`) not in MCP tool signature

---

### Component 2: MCP Tool Registration ✅ CORRECT (Source of Truth)

**File:** `repos/metabob-cli/src/metabob_cli/mcp/activity_template_tools.py`  
**Lines:** 300-420  
**Component:** `metabob_post_activity_result`

**Registration:**
```python
# Line 301
@mcp.tool(
    name="metabob_post_activity_result",  # ✅ Tool registered with prefix
    description="Post execution results..."
)
async def metabob_post_activity_result(
    activity_id: str,  # ✅ snake_case parameter
    result: dict,      # ✅ dict parameter
    ctx: Context = None,
):
```

**Status:** This component is CORRECT. No changes needed. This is the source of truth.

---

### Component 3: RPC API Backend Schema ✅ CORRECT

**File:** `repos/metabob-rpc-api/server/routes/learning_loop.py`  
**Lines:** 81-104  
**Component:** `ExecutionRequest` schema

**Schema:**
```python
class ExecutionRequest(BaseModel):
    activity_id: str
    template_id: str
    started_at: str
    duration_ms: int
    success: bool
    tokens_input: int
    tokens_output: int
    tokens_cache: int
    cost_usd: float
```

**Status:** Backend schema is correct. MCP tool transforms OpenCode data to match it.

---

## Data Flow Trace

### Step 1: Activity Completes
- **Component:** ActivityExecutor (OpenCode)
- **Action:** Activity execution finishes
- **Data:** `ActivityExecutionData { activity_id, template_id, success, duration, cost, tokens }`

### Step 2: Report Execution ❌ CURRENT FAILURE POINT
- **Component:** TemplateMetricsClient.reportExecution (OpenCode)
- **Action:** Calls MCP tool to report execution
- **Current Call:** `callMCPTool('post_activity_result', { activityId, result, backend })` ❌
- **Correct Call:** `callMCPTool('metabob_post_activity_result', { activity_id, result })` ✅
- **Issue:** Wrong tool name, wrong parameter names, extra parameter

### Step 3: MCP Client Request
- **Component:** MCP Client (OpenCode)
- **Action:** Sends tool call to metabob-cli MCP server
- **Current:** Sends request for unknown tool `'post_activity_result'` ❌
- **Expected:** Sends request for registered tool `'metabob_post_activity_result'` ✅

### Step 4: MCP Server Receives ❌ FLOW BREAKS HERE
- **Component:** MCP Server (metabob-cli)
- **Action:** Receives tool call request
- **Current:** Returns error: "Tool not found: post_activity_result" ❌
- **Expected:** Finds registered tool, invokes `metabob_post_activity_result(activity_id, result)` ✅

### Step 5: Transform and Forward (Never Executes)
- **Component:** metabob_post_activity_result (metabob-cli)
- **Action:** Transforms data and calls RPC API
- **Transforms:**
  - Extract template_id from activity_id
  - Calculate started_at from duration_ms
  - Flatten tokens to tokens_input, tokens_output, tokens_cache
  - Build ExecutionRequest payload
- **Endpoint:** `POST {api_base}/api/v1/learning-loop/executions`

### Step 6: Record and Update (Never Executes)
- **Component:** Learning Loop API (RPC API)
- **Action:** Records execution and updates metrics
- **Operations:**
  - Insert into activity_execution table
  - Update template_metrics aggregates
  - Calculate Thompson Sampling parameters (alpha, beta)
  - Record failure patterns if execution failed

### Step 7: Persist Data (Never Executes)
- **Component:** Database (SurrealDB)
- **Action:** Persists execution data and updated metrics
- **Tables:** activity_execution, template_metrics

---

## Flow Breakage Analysis

**Break Point:** Step 4 - MCP Server  
**Reason:** Tool name mismatch causes "Tool not found" error  
**Consequence:** Flow stops at step 4, steps 5-7 never execute  
**Graceful Degradation:** OpenCode logs warning and continues, metrics silently fail to record

**Result:**
- ❌ No execution data recorded
- ❌ Template metrics remain at 0 executions
- ❌ Thompson Sampling parameters not updated
- ❌ Learning system cannot function
- ❌ Boredom activity detection disabled

---

## Root Cause

### Incorrect Assumption During MCP-Only Enforcement

**History:**
1. Previous code used direct HTTP calls to backend (violated architecture)
2. `trace-enforce-validate-loop` activity fixed MCP boundary violation
3. Activity **incorrectly assumed** tool name was `'post_activity_result'` without prefix
4. Activity did not verify tool name against actual MCP server registration
5. Comment in code mentioned "wrong name" but referred to OLD direct HTTP approach
6. Activity misinterpreted comment and changed to wrong tool name

**Tool Naming Convention:**
All metabob-cli MCP tools use `'metabob_'` prefix:
- `metabob_search_activities` ✅
- `metabob_get_activity_template` ✅
- `metabob_post_activity_result` ✅
- `metabob_register_activity_template` ✅
- `metabob_list_activity_templates` ✅

---

## Required Changes

### Change 1: Tool Name
**File:** `repos/metabob-opencode/packages/opencode/src/session/template-metrics-client.ts`  
**Line:** 109  
**Before:** `"post_activity_result"`  
**After:** `"metabob_post_activity_result"`  
**Reason:** Must match MCP tool registration exactly

### Change 2: Parameter Name
**File:** `repos/metabob-opencode/packages/opencode/src/session/template-metrics-client.ts`  
**Line:** 111  
**Before:** `activityId: data.activity_id`  
**After:** `activity_id: data.activity_id`  
**Reason:** MCP tool signature expects snake_case parameters

### Change 3: Remove Invalid Parameter
**File:** `repos/metabob-opencode/packages/opencode/src/session/template-metrics-client.ts`  
**Line:** 124  
**Before:** `backend: "all",`  
**After:** (removed)  
**Reason:** MCP tool signature does not accept 'backend' parameter

### Change 4: Update Comment Documentation
**File:** `repos/metabob-opencode/packages/opencode/src/session/template-metrics-client.ts`  
**Line:** 87  
**Before:** `1. Used wrong tool name 'metabob_post_activity_result' (correct: 'post_activity_result')`  
**After:** (remove this line - it's incorrect)  
**Reason:** Comment contains incorrect information that caused the bug

### Change 5: Update MCP Tool Name in Comment
**File:** `repos/metabob-opencode/packages/opencode/src/session/template-metrics-client.ts`  
**Line:** 91  
**Before:** `MCP Tool: post_activity_result`  
**After:** `MCP Tool: metabob_post_activity_result`  
**Reason:** Documentation should reflect correct tool name

---

## Verification Evidence

### Code Inspection ✅
```bash
$ grep -n 'name=' repos/metabob-cli/src/metabob_cli/mcp/activity_template_tools.py | grep post_activity
301:    name="metabob_post_activity_result",
```
**Result:** ✅ VERIFIED - Tool registered as `'metabob_post_activity_result'`

### Parameter Validation ❌
**MCP Tool Signature:**
```python
async def metabob_post_activity_result(
    activity_id: str,  # ✅ snake_case
    result: dict,      # ✅ dict
    ctx: Context = None,
):
```

**Current Call:**
```typescript
{
  activityId: data.activity_id,  // ❌ camelCase (wrong)
  result: {...},                 // ✅ correct
  backend: "all",                // ❌ not in signature (wrong)
}
```

**Result:** ❌ MISMATCH - OpenCode uses wrong parameter names and includes invalid parameter

---

## Post-Fix Validation Strategy

### Unit Testing
Mock `callMCPTool` and verify:
- Tool name is `'metabob_post_activity_result'`
- Parameters use snake_case (`activity_id`, not `activityId`)
- No `backend` parameter passed

### Integration Testing
1. Start metabob-cli MCP server
2. Execute test activity in OpenCode
3. Check MCP server logs for successful tool call
4. Verify no "Tool not found" errors

### E2E Testing
1. Execute test activity
2. Query template_metrics table
3. Verify `total_executions` incremented
4. Verify Thompson Sampling parameters updated
5. Check activity_execution table for record

### Validation Harness Enhancement
Add check: "MCP tool names must match actual registrations in metabob-cli"

---

## Output Format (JSON)

```json
{
  "specificationName": "Correct MCP Tool Name and Parameters",
  "components": [
    {
      "file": "repos/metabob-opencode/packages/opencode/src/session/template-metrics-client.ts",
      "component": "TemplateMetricsClient.reportExecution",
      "currentBehavior": "Calls MCP tool 'post_activity_result' with camelCase params and invalid 'backend' param",
      "desiredBehavior": "Calls MCP tool 'metabob_post_activity_result' with snake_case params, no extra params",
      "gap": "Tool name missing 'metabob_' prefix, parameter names in wrong case, extra invalid parameter"
    },
    {
      "file": "repos/metabob-cli/src/metabob_cli/mcp/activity_template_tools.py",
      "component": "metabob_post_activity_result",
      "currentBehavior": "Tool registered with 'metabob_' prefix, expects snake_case parameters",
      "desiredBehavior": "Same - this component is CORRECT",
      "gap": "None - this is already correct"
    },
    {
      "file": "repos/metabob-rpc-api/server/routes/learning_loop.py",
      "component": "ExecutionRequest schema",
      "currentBehavior": "Backend schema expects snake_case fields",
      "desiredBehavior": "Same - this component is CORRECT",
      "gap": "None - this is already correct"
    }
  ],
  "dataFlow": "ActivityExecutor → TemplateMetricsClient.reportExecution (❌ FAILS HERE) → MCP Client → MCP Server (Tool not found) → (FLOW STOPS) → metabob_post_activity_result → Learning Loop API → Database",
  "traceImpulseId": "trace-Correct MCP Tool Name and Parameters"
}
```

---

## Impulse Created

✅ **Impulse ID:** `trace-Correct MCP Tool Name and Parameters`  
✅ **Type:** `templateDefinition`  
✅ **File:** `impulses/trace-mcp-tool-name-fix.json`  
✅ **Budget:** 5000 tokens  
✅ **Components Analyzed:** 3  
✅ **Changes Required:** 5

---

## Next Steps for Enforcement Task

1. ✅ **Traced** - This document
2. ⏳ **Enforce** - Apply the 5 required changes to template-metrics-client.ts
3. ⏳ **Validate** - Run validation harness to confirm fix
4. ⏳ **Test** - Execute test activity and verify metrics recording works

**File to modify:** `repos/metabob-opencode/packages/opencode/src/session/template-metrics-client.ts`

**Changes:**
1. Line 109: Tool name with prefix
2. Line 111: Parameter name to snake_case
3. Line 124: Remove backend parameter
4. Line 87: Remove incorrect comment
5. Line 91: Update comment documentation

**Source of truth:** `repos/metabob-cli/src/metabob_cli/mcp/activity_template_tools.py:301`

---

**Status:** ✅ TRACE COMPLETE - Ready for enforcement task
