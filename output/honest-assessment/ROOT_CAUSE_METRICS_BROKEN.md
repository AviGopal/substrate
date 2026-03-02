# ROOT CAUSE: Metrics System is Broken

**Date**: 2026-03-02  
**Status**: **CRITICAL BUG FOUND**  
**Impact**: 100% of activity executions fail to record metrics

---

## Executive Summary

**The metrics post-back system exists in OpenCode but calls a non-existent MCP tool.**

All activity executions complete successfully but metrics are NEVER stored in SurrealDB because:
1. ✅ OpenCode DOES call `TemplateLoader.updateMetrics()` after every execution
2. ✅ `TemplateLoader.updateMetrics()` DOES call `TemplateServiceClient.updateTemplateMetrics()`
3. ✅ `TemplateServiceClient.updateTemplateMetrics()` DOES call `MetabobCLI.updateActivityMetrics()`
4. ❌ `MetabobCLI.updateActivityMetrics()` calls **NON-EXISTENT** MCP tool `update_activity_metrics`
5. ❌ The MCP tool `update_activity_metrics` **DOES NOT EXIST** in metabob-rpc-api

**Result**: Silent failure, metrics never reach SurrealDB, all templates show `metrics = null`

---

## The Broken Call Chain

### Call Stack (What Actually Happens)

```
Activity Execution Completes (activity.ts:1076)
  ↓
TemplateRepository.updateMetrics(template.id, {...}) ✅
  ↓
TemplateLoader.updateMetrics(id, metrics) ✅
  ↓
TemplateServiceClient.updateTemplateMetrics({templateId, metrics}) ✅
  ↓
MetabobCLI.updateActivityMetrics(templateId, metrics) ✅
  ↓
callMCPTool("update_activity_metrics", {activity_id, metrics}) ❌ TOOL DOES NOT EXIST
  ↓
SILENT FAILURE - Returns false
  ↓
Logs: "metabob metrics update failed" (but continues execution)
  ↓
Metrics NEVER reach SurrealDB
```

### Evidence: The Code Exists

**File**: `repos/metabob-opencode/packages/opencode/src/tool/activity.ts:1076`
```typescript
// Update template metrics using incremental weighted average
await TemplateRepository.updateMetrics(template.id, {
  executions: newExecutions,
  successRate: newSuccessRate,
  avgDuration: newAvgDuration,
  avgCost: newAvgCost,
  avgTokens: {
    input: safeAvgTokens.input + (result.totalTokens.input - safeAvgTokens.input) / newExecutions,
    output: safeAvgTokens.output + (result.totalTokens.output - safeAvgTokens.output) / newExecutions,
    cache: safeAvgTokens.cache + (result.totalTokens.cache - safeAvgTokens.cache) / newExecutions,
  },
  allocationWeight: newSuccessRate,
  improvementGradient,
})
```

**File**: `repos/metabob-opencode/packages/opencode/src/util/metabob.ts`
```typescript
export async function updateActivityMetrics(
  templateId: string,
  metrics: Partial<ActivityTemplate.Schema>,
): Promise<boolean> {
  log.debug("updateActivityMetrics called", { templateId, metrics })

  const result = await callMCPTool<{
    status: string
    message?: string
    error?: string
  }>("update_activity_metrics", {  // ❌ THIS TOOL DOES NOT EXIST
    activity_id: templateId,
    metrics,
  })

  if (!result || result.status !== "success") {
    log.debug("updateActivityMetrics failed", {
      hasResult: !!result,
      status: result?.status,
      error: result?.error,
    })
    return false
  }

  return true
}
```

### Evidence: The Tool Does NOT Exist

**Searched**:
- `repos/metabob-rpc-api` (entire codebase)
- `update_activity_metrics` → **NOT FOUND**
- `metabob_update_activity_metrics` → **NOT FOUND**

**Similar tools that DO exist**:
- `metabob_post_activity_result` (in boredom-manager.ts) → Also doesn't exist in RPC API
- `metabob_fetch_boredom_activities` → Exists in RPC API
- `metabob_search_activities` → Exists in RPC API

**Conclusion**: The metrics update MCP tool was **never implemented** in metabob-rpc-api

---

## Why This Breaks Everything

### No Metrics = No Learning Loop

| Component | Requires Metrics | Status |
|-----------|------------------|--------|
| Thompson Sampling | ✅ | ❌ BROKEN (all templates = 0 executions) |
| Boredom Detection | ✅ | ❌ BROKEN (no execution history) |
| Activity Improvement | ✅ | ❌ BROKEN (can't detect failures) |
| Variant Selection | ✅ | ❌ BROKEN (no success rates) |
| Performance Tracking | ✅ | ❌ BROKEN (no cost/duration data) |
| Learning Gradients | ✅ | ❌ BROKEN (no improvement scores) |

### Silent Failure Pattern

**Problem**: Errors are logged but NOT thrown

**Code**: `repos/metabob-opencode/packages/opencode/src/session/template-loader.ts`
```typescript
// Update in Metabob TemplateService
try {
  await TemplateServiceClient.updateTemplateMetrics({
    templateId: id,
    metrics,
  })
  log.info("metrics updated in metabob", { id })
} catch (error) {
  log.warn("metabob metrics update failed", { id, error })
  // ❌ ERROR IS SWALLOWED, EXECUTION CONTINUES
}
```

**Why This is Bad**:
- Activity completes "successfully"
- User sees ✅ SUCCESS
- But metrics never stored
- No indication anything is wrong
- Silent data loss

---

## The Fix

### Step 1: Create the Missing MCP Tool

**File**: `repos/metabob-rpc-api/server/actions/activity.py` (or new file in mcp_tools/)

**Implementation**:
```python
async def update_activity_metrics(activity_id: str, metrics: dict) -> dict:
    """
    Update activity template metrics after execution.
    
    Called by OpenCode after every activity execution to update:
    - total_executions
    - success_rate
    - avg_cost
    - avg_duration
    - avg_tokens
    - improvement_gradient
    
    Args:
        activity_id: Template ID (e.g., "add-feature-complete")
        metrics: Partial metrics update {
            executions: int,
            successRate: float,
            avgDuration: float,
            avgCost: float,
            avgTokens: {input, output, cache},
            improvementGradient: float
        }
    
    Returns:
        {status: "success", message: "Metrics updated"}
    """
    try:
        # 1. Find template by activity_id (may return multiple variants)
        templates = await get_templates_by_activity_id(activity_id)
        
        if not templates:
            return {
                "status": "error",
                "error": f"Template not found: {activity_id}"
            }
        
        # 2. Update metrics for ALL variants of this activity
        #    (Thompson Sampling needs metrics for all variants)
        for template in templates:
            variant_id = template["variant_id"]
            
            # 3. Increment execution counters
            current_executions = template.get("total_executions", 0)
            current_successes = template.get("success_count", 0)
            
            new_executions = metrics.get("executions", current_executions + 1)
            new_success_rate = metrics.get("successRate")
            
            if new_success_rate is not None:
                # Calculate new success_count from success_rate
                new_successes = int(new_executions * new_success_rate)
            else:
                new_successes = current_successes
            
            # 4. Update metrics in SurrealDB
            update_data = {
                "total_executions": new_executions,
                "success_count": new_successes,
                "avg_duration_ms": metrics.get("avgDuration"),
                "avg_cost": metrics.get("avgCost"),
                "avg_tokens_input": metrics.get("avgTokens", {}).get("input"),
                "avg_tokens_output": metrics.get("avgTokens", {}).get("output"),
                "avg_tokens_cache": metrics.get("avgTokens", {}).get("cache"),
                "improvement_gradient": metrics.get("improvementGradient"),
                "last_updated": datetime.utcnow().isoformat(),
            }
            
            # Remove None values
            update_data = {k: v for k, v in update_data.items() if v is not None}
            
            # Execute UPDATE query
            result = await surrealdb_client.query(
                f"UPDATE activity_templates:{variant_id} MERGE $data",
                {"data": update_data}
            )
            
            logging.info(f"Metrics updated for {variant_id}: {update_data}")
        
        return {
            "status": "success",
            "message": f"Metrics updated for {len(templates)} variant(s) of {activity_id}"
        }
        
    except Exception as e:
        logging.error(f"update_activity_metrics failed: {e}")
        return {
            "status": "error",
            "error": str(e)
        }
```

### Step 2: Register the Tool in MCP Server

**File**: `repos/metabob-rpc-api/server/mcp_server.py` (or wherever tools are registered)

```python
@mcp_server.tool()
async def update_activity_metrics(activity_id: str, metrics: dict) -> dict:
    """Update activity template metrics after execution"""
    from .actions.activity import update_activity_metrics as impl
    return await impl(activity_id, metrics)
```

### Step 3: Verify the Tool is Accessible

**Test from OpenCode**:
```bash
# Check tool is registered
opencode run "List available MCP tools" | grep update_activity_metrics

# Should see:
# - update_activity_metrics: Update activity template metrics after execution
```

### Step 4: Test End-to-End Metrics Flow

**Test Script**: `test-metrics-flow.sh`
```bash
#!/bin/bash
set -e

echo "=== Testing Metrics Flow E2E ==="

# 1. Create test template
echo "1. Registering test template..."
curl -X POST http://metabob-rpc-api:8000/v2/activities/templates \
  -H "Content-Type: application/json" \
  -d '{
    "variant_id": "test-metrics-flow-001",
    "activity_id": "test-metrics-flow",
    "name": "Test Metrics Flow",
    "tasks": [],
    "total_executions": 0,
    "success_count": 0
  }'

# 2. Execute activity (will trigger metrics update)
echo "2. Executing activity..."
opencode activity execute \
  --template test-metrics-flow \
  --variables '{}' \
  --reason "Test metrics flow"

# 3. Check metrics were updated
echo "3. Verifying metrics..."
RESULT=$(curl -s -X POST http://surrealdb:8000/sql \
  -H "NS: metabob" \
  -H "DB: production" \
  -u "root:metabob-secret" \
  -d "SELECT total_executions, success_count FROM activity_templates WHERE activity_id = 'test-metrics-flow'")

echo "$RESULT" | jq

# Expect: total_executions = 1, success_count = 1 (if success)
EXEC_COUNT=$(echo "$RESULT" | jq '.[0].result[0].total_executions')

if [ "$EXEC_COUNT" -eq 1 ]; then
  echo "✅ PASS: Metrics flow working"
  exit 0
else
  echo "❌ FAIL: Metrics not updated (total_executions = $EXEC_COUNT)"
  exit 1
fi
```

---

## Why This Bug Existed So Long

### Reason 1: Silent Failure
- Errors logged as WARN, not ERROR
- Execution continues normally
- No user-visible indication

### Reason 2: Local Storage Fallback
- `TemplateLoader.updateMetrics()` updates local storage
- Local storage shows metrics
- Didn't notice SurrealDB had none

### Reason 3: False Validation
- Validators checked "files exist"
- Didn't test actual metrics flow
- Claimed success when flow broken

### Reason 4: No Integration Tests
- Unit tests passed (mocked MCP calls)
- Never tested E2E with real RPC API
- Missing MCP tool never discovered

---

## Impact Analysis

### What Works Despite This Bug
- ✅ Activity execution (runs successfully)
- ✅ Local metrics (stored in ~/.local/share/opencode)
- ✅ Activity results (success/failure detection)
- ✅ Git commits (created properly)
- ✅ Validation (runs commands)

### What's Completely Broken
- ❌ Metrics in SurrealDB (always null/0)
- ❌ Thompson Sampling (no data to sample)
- ❌ Boredom detection (no execution history)
- ❌ Learning gradients (no improvement scores)
- ❌ Variant selection (random, not data-driven)
- ❌ Autonomous improvement (can't detect patterns)

### Cascading Failures
1. No metrics → Can't detect boredom
2. Can't detect boredom → No improvement activities triggered
3. No improvements → Templates never evolve
4. Templates never evolve → System doesn't learn
5. System doesn't learn → Just an LLM with fancy plumbing

---

## Validation That Should Have Caught This

### Real Validator (Should Exist)
```json
{
  "validation": {
    "commands": [
      "# Execute activity",
      "opencode activity execute --template test-template --variables '{}'",
      "# Wait for completion",
      "sleep 5",
      "# Check metrics in SurrealDB",
      "RESULT=$(curl -X POST http://surrealdb:8000/sql -d 'SELECT total_executions FROM activity_templates WHERE activity_id = \"test-template\"')",
      "# Verify metrics > 0",
      "echo \"$RESULT\" | jq -e '.[0].result[0].total_executions > 0'"
    ]
  }
}
```

**This validator would FAIL** because metrics never reach SurrealDB

### Fake Validator (What We Had)
```json
{
  "validation": {
    "requiredFiles": ["src/session/template-loader.ts"],
    "requiredPatterns": ["updateMetrics"]
  }
}
```

**This validator PASSES** because file exists and contains pattern (even though function is broken)

---

## Lessons Learned

### Lesson 1: Silent Failures Are Dangerous
**Problem**: Errors logged but not thrown  
**Solution**: Throw errors for critical failures, force visibility

### Lesson 2: Mocks Hide Integration Bugs
**Problem**: Unit tests pass with mocked MCP calls  
**Solution**: Integration tests with real RPC API required

### Lesson 3: Check Outputs, Not Proxies
**Problem**: Validated "code exists" not "functionality works"  
**Solution**: Validators must test actual data flow

### Lesson 4: Trust But Verify
**Problem**: Assumed MCP tool existed because OpenCode called it  
**Solution**: Verify both sides of integration exist

---

## Next Steps

### Priority 0: Fix The Bug
1. ✅ Identify root cause (DONE - this document)
2. Implement `update_activity_metrics` MCP tool in RPC API
3. Test with curl directly (bypass OpenCode)
4. Test from OpenCode (full E2E)
5. Verify metrics appear in SurrealDB

### Priority 1: Validate The Fix
1. Execute activity multiple times
2. Check metrics increment in SurrealDB
3. Verify Thompson Sampling uses metrics
4. Test boredom detection with new metrics
5. Confirm improvement gradient calculated

### Priority 2: Prevent Recurrence
1. Add integration tests for metrics flow
2. Create E2E validator for activity execution
3. Add alerts for missing MCP tools
4. Throw errors (not warnings) for critical paths
5. Document MCP tool contracts

---

## Success Criteria

### ✅ Bug is Fixed When:
1. Execute activity → Metrics appear in SurrealDB
2. Execute again → Metrics increment correctly
3. Thompson Sampling → Uses real success rates
4. Boredom detection → Sees execution history
5. No "metrics update failed" warnings in logs

### ✅ System is Learning When:
1. Template executed 5 times
2. SurrealDB shows `total_executions = 5`
3. Success rate calculated correctly
4. Improvement gradient computed
5. Boredom detector can query history
6. Thompson Sampling selects better variants

---

## Conclusion

**The learning system was broken from day one because of a single missing MCP tool.**

The code flow is correct. The architecture is sound. The math is right.

But a **single missing function** broke the entire learning loop.

**Good news**: Fix is simple - implement one MCP tool  
**Bad news**: We claimed production-ready without testing this critical path  
**Lesson**: Integration tests are not optional

---

**Root Cause**: Missing MCP tool `update_activity_metrics` in metabob-rpc-api  
**Fix Required**: Implement the tool, test E2E  
**Priority**: CRITICAL - blocks all learning functionality  
**Date**: 2026-03-02
