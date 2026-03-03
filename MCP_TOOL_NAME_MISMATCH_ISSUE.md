# MCP Tool Name Mismatch Issue

**Date:** 2026-03-02  
**Status:** ❌ **CRITICAL BUG**  
**Impact:** Execution recording will fail silently

---

## Problem

The recent activity (commit cf849c9) "fixed" the MCP-only communication but introduced a **tool name mismatch**:

### What the Code Calls:
```typescript
// repos/metabob-opencode/packages/opencode/src/session/template-metrics-client.ts:109
const result = await callMCPTool(
  "post_activity_result",  // ❌ WRONG NAME
  {
    activityId: data.activity_id,
    result: {...},
    backend: "all",
  },
)
```

### What's Actually Registered:
```python
# repos/metabob-cli/src/metabob_cli/mcp/activity_template_tools.py:301
@mcp.tool(
    name="metabob_post_activity_result",  # ✅ CORRECT NAME
    description="Post execution results..."
)
async def metabob_post_activity_result(
    activity_id: str,
    result: dict,
    ctx: Context = None,
):
```

---

## Root Cause

The trace-enforce-validate-loop activity **incorrectly assumed** the tool was named `post_activity_result` (without `metabob_` prefix) based on a comment in the code that said the previous implementation used the wrong name.

However, checking the **actual MCP server registration**, ALL MCP tools have the `metabob_` prefix:
- `metabob_search_activities`
- `metabob_get_activity_template`
- `metabob_register_activity_template`
- `metabob_list_activity_templates`
- `metabob_post_activity_result` ✅
- `update_activity_metrics` (exception: internal tool)
- `metabob_fetch_boredom_activities`

---

## Impact

**Current State:**
1. metabob-opencode calls `callMCPTool("post_activity_result", ...)`
2. MCP server receives request for unknown tool `post_activity_result`
3. MCP returns error: "Tool not found"
4. Graceful degradation logs warning, continues execution
5. **Metrics are NOT recorded** ❌
6. Template metrics remain at 0 executions ❌
7. Learning system cannot adapt ❌

**Expected State:**
1. metabob-opencode calls `callMCPTool("metabob_post_activity_result", ...)`
2. MCP server finds registered tool ✅
3. MCP tool calls backend API ✅
4. Metrics recorded to database ✅
5. Learning system functional ✅

---

## Evidence

### MCP Tool Registration (Source of Truth):
```bash
$ grep -n 'name=' repos/metabob-cli/src/metabob_cli/mcp/activity_template_tools.py
26:    name="metabob_search_activities",
103:    name="metabob_get_activity_template",
174:    name="metabob_register_activity_template",
238:    name="metabob_list_activity_templates",
301:    name="metabob_post_activity_result",  ← THIS IS THE CORRECT NAME
423:    name="update_activity_metrics",
522:    name="metabob_fetch_boredom_activities",
```

### Code Call (Incorrect):
```bash
$ grep "callMCPTool" repos/metabob-opencode/packages/opencode/src/session/template-metrics-client.ts
const result = await callMCPTool<{ success: boolean; execution_id?: string; metrics_updated?: boolean }>(
  "post_activity_result",  ← WRONG! Missing "metabob_" prefix
```

---

## Fix Required

### Change Needed:
**File:** `repos/metabob-opencode/packages/opencode/src/session/template-metrics-client.ts`  
**Line:** 109

**Before:**
```typescript
const result = await callMCPTool<{ success: boolean; execution_id?: string; metrics_updated?: boolean }>(
  "post_activity_result",  // ❌ Wrong
  {
    activityId: data.activity_id,
    result: {...},
    backend: "all",
  },
)
```

**After:**
```typescript
const result = await callMCPTool<{ success: boolean; execution_id?: string; metrics_updated?: boolean }>(
  "metabob_post_activity_result",  // ✅ Correct
  {
    activity_id: data.activity_id,  // Note: also fix param name
    result: {...},
  },
)
```

### Additional Parameter Name Fix:

The MCP tool signature expects `activity_id` (snake_case), but the call uses `activityId` (camelCase).

**MCP Tool Signature:**
```python
async def metabob_post_activity_result(
    activity_id: str,  # ← snake_case
    result: dict,
    ctx: Context = None,
):
```

**Current Call (Wrong):**
```typescript
{
  activityId: data.activity_id,  // ❌ Wrong key name
  result: {...},
  backend: "all",  // ❌ Extra param not in signature
}
```

**Correct Call:**
```typescript
{
  activity_id: data.activity_id,  // ✅ Correct key name
  result: {...},
  // backend: "all" removed (not in MCP tool signature)
}
```

---

## Additional Issues Found

### 1. Parameter Mismatch: `backend`

The code passes `backend: "all"` parameter, but the MCP tool signature doesn't accept it:

**MCP Tool:**
```python
async def metabob_post_activity_result(
    activity_id: str,
    result: dict,
    ctx: Context = None,  # Only 2 params + context
):
```

**Call:**
```typescript
{
  activityId: data.activity_id,
  result: {...},
  backend: "all",  // ❌ This parameter doesn't exist in MCP tool
}
```

This will cause the MCP tool to reject the call or ignore the extra parameter.

---

## Why This Wasn't Caught

1. **Validation harness** tested for "no direct HTTP calls" ✅
2. But **didn't test** that MCP tool call actually works
3. Graceful degradation hides the error
4. No integration test with live MCP server
5. Activity used static analysis only, not runtime testing

---

## Recommended Fix Strategy

### Approach 1: Manual Fix (Fast)
1. Edit `template-metrics-client.ts` line 109
2. Change tool name: `"post_activity_result"` → `"metabob_post_activity_result"`
3. Fix param names: `activityId` → `activity_id`
4. Remove invalid param: `backend: "all"`
5. Test with live MCP server
6. Commit fix

### Approach 2: Activity-Based Fix (Thorough)
1. Run another `trace-enforce-validate-loop` activity
2. Specification: "MCP tool calls must use correct registered names"
3. Let activity trace and fix all mismatches
4. Includes validation harness with runtime testing
5. Documents the fix comprehensively

---

## Correct Implementation

```typescript
/**
 * Report activity execution to backend for metrics aggregation.
 * Uses MCP tool 'metabob_post_activity_result' (note: includes metabob_ prefix).
 */
export async function reportExecution(data: ActivityExecutionData): Promise<void> {
  try {
    log.debug("reporting activity execution via MCP", {
      activityId: data.activity_id,
      templateId: data.template_id,
    })

    // Call MCP tool with CORRECT name and parameters
    const result = await callMCPTool<{
      status: string;
      execution_id?: string;
      metrics_updated?: boolean;
    }>(
      "metabob_post_activity_result",  // ✅ Correct name with prefix
      {
        activity_id: data.activity_id,  // ✅ snake_case param name
        result: {
          success: data.success,
          duration: data.duration,
          cost: data.cost,
          tokens: data.tokens
            ? {
                input: data.tokens.input,
                output: data.tokens.output,
                cache: data.tokens.cache,
              }
            : undefined,
        },
        // ✅ No extra 'backend' parameter
      },
    )

    if (!result || result.status !== "success") {
      log.warn("metrics reporting failed via MCP", {
        activityId: data.activity_id,
        status: result?.status,
      })
      return
    }

    log.info("metrics reporting successful via MCP", {
      activityId: data.activity_id,
      executionId: result.execution_id,
      metricsUpdated: result.metrics_updated,
    })
  } catch (error) {
    log.warn("metrics reporting failed (graceful degradation)", {
      activityId: data.activity_id,
      error: error instanceof Error ? error.message : String(error),
    })
  }
}
```

---

## Testing Strategy

After fixing, verify with:

1. **Unit Test:**
   ```typescript
   // Verify tool name is correct
   expect(callMCPTool).toHaveBeenCalledWith(
     "metabob_post_activity_result",
     expect.objectContaining({ activity_id: expect.any(String) })
   )
   ```

2. **Integration Test:**
   - Start metabob-cli MCP server
   - Run activity that calls reportExecution()
   - Verify MCP tool receives call
   - Verify backend receives execution data
   - Verify database shows updated metrics

3. **E2E Test:**
   - Execute test activity
   - Check template_metrics table
   - Verify total_executions incremented
   - Verify success_rate calculated
   - Verify Thompson sampling parameters updated

---

## Priority

**CRITICAL** - This bug prevents the entire learning system from functioning. Must fix immediately.

---

## Next Steps

1. ✅ Document the issue (this file)
2. ⏳ Choose fix strategy (manual vs activity-based)
3. ⏳ Apply the fix
4. ⏳ Test with live MCP server
5. ⏳ Verify metrics recording works
6. ⏳ Update validation harness to catch this in future

---

**Conclusion:** The MCP-only enforcement was correct in principle, but used the wrong tool name. Simple fix: add `metabob_` prefix and fix parameter names.
