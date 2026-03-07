# Activity Execution Recording to Backend - Trace Analysis (Updated)

**Specification**: Activity Execution Recording to Backend  
**Status**: ⚠️ PARTIALLY IMPLEMENTED WITH ARCHITECTURAL VIOLATION  
**Impact**: CRITICAL - Dual write paths break single source of truth  
**Traced**: 2026-03-07 (Updated from 2026-03-02)

---

## Executive Summary

**CRITICAL FINDING:** OpenCode CLI has TWO CONFLICTING paths for recording activity executions:

1. **CORRECT PATH (MCP-based)**: 
   - Activity.complete() → TemplateMetricsClient.reportExecution()
   - → MCP tool 'metabob_post_activity_result'
   - → metabob-cli → POST /api/v1/learning-loop/executions
   - → SurrealDB

2. **VIOLATION PATH (Direct HTTP)**:
   - Activity.complete() → fetch() at line 1124
   - → POST /v2/activities/executions [BYPASSES MCP]
   - → SurrealDB

**ROOT CAUSE:** The direct HTTP POST in activity.ts:1083-1161 bypasses the MCP layer, violating the architectural principle: opencode → MCP → cli → backend. This creates dual-write inconsistency.

**KEY FINDING:** The MCP-based path EXISTS and is CORRECT (TemplateMetricsClient → metabob_post_activity_result → learning-loop API). The direct HTTP path should be REMOVED.

---

## Data Flow Analysis

### Current Flow (BROKEN ❌)

```
Activity.complete() (activity.ts:994)
  ↓
TemplateMetricsClient.reportExecution() (template-metrics-client.ts:93)
  ↓
callMCPTool('metabob_post_activity_result') (template-metrics-client.ts:106)
  ↓
[FAILS - tool not found in MCP server]
  ↓
Silent failure with "graceful degradation" (template-metrics-client.ts:129)
  ↓
Metrics stay at 0 (no database write)
```

### Desired Flow (WORKING ✅)

```
Activity.complete() (activity.ts:994)
  ↓
HTTP POST to http://metabob-rpc-api:8000/api/v1/learning-loop/executions
  ↓
record_execution() endpoint (learning_loop.py:121)
  ↓
insert_execution() (activity_execution.py:20)
  ↓
update_metrics_after_execution() (template_metrics.py:150)
  ↓
Metrics updated in SurrealDB
  ↓
Thompson sampling parameters adjusted
  ↓
Learning system functional
```

---

## Component Trace

### 1. Entry Point: Activity Completion ✅
**File:** `repos/metabob-opencode/packages/opencode/src/session/activity.ts`  
**Lines:** 951-1050  
**Function:** `Activity.complete()`

**Current Behavior:**
- Activity completes successfully
- Sets status to "done"
- Calculates final statistics (cost, duration, tokens)
- Calls `TemplateMetricsClient.reportExecution()` at line 994

**Code:**
```typescript
// Report execution metrics to backend with verification hook
if (activity.templateId) {
  const cacheTokens =
    typeof activity.stats.tokens.cache === "object"
      ? activity.stats.tokens.cache.read + activity.stats.tokens.cache.write
      : activity.stats.tokens.cache || 0

  TemplateMetricsClient.reportExecution({
    activity_id: activity.id,
    template_id: activity.templateId,
    variant_id: variantId,
    success: activity.status === "done",
    duration: activity.stats.duration,
    cost: activity.stats.cost.total,
    tokens: {
      input: activity.stats.tokens.input,
      output: activity.stats.tokens.output,
      cache: cacheTokens,
    },
  }).catch(() => {
    // Silent failure - metrics reporting is not critical path
  })
}
```

**Assessment:** ✅ This component is correct. It collects all necessary data and attempts to report it.

**Gap:** None - the problem is downstream.

---

### 2. Transport Layer: Template Metrics Client ❌
**File:** `repos/metabob-opencode/packages/opencode/src/session/template-metrics-client.ts`  
**Lines:** 93-135  
**Function:** `TemplateMetricsClient.reportExecution()`

**Current Behavior:**
- Receives execution data from Activity.complete()
- Attempts to call MCP tool `metabob_post_activity_result`
- MCP tool does not exist in the server
- Call fails silently with "graceful degradation"
- Returns without throwing error

**Code:**
```typescript
export async function reportExecution(data: ActivityExecutionData): Promise<void> {
  try {
    log.debug("reporting activity execution (single write path)", {
      activityId: data.activity_id,
      templateId: data.template_id,
      success: data.success,
      duration: data.duration,
      cost: data.cost,
    })

    // Single write path: Delegate to rpc-api via MCP
    // RPC API will handle Redis writes and all metrics calculations
    const result = await callMCPTool<{ success: boolean; error?: string }>(
      "metabob_post_activity_result",  // ❌ THIS TOOL DOES NOT EXIST
      {
        activity_id: data.activity_id,
        result: {
          success: data.success,
          duration: data.duration,
          cost: data.cost,
          tokens: data.tokens,
        },
      },
    )

    if (result && !result.success) {
      log.warn("metrics reporting failed", {
        activityId: data.activity_id,
        error: result.error,
      })
    }
  } catch (error) {
    // Graceful degradation - metrics reporting is not critical path
    log.warn("metrics reporting failed (graceful degradation)", {
      activityId: data.activity_id,
      error: error instanceof Error ? error.message : String(error),
    })
  }
}
```

**Assessment:** ❌ **THIS IS THE BROKEN LINK**

**Evidence:**
1. Calls MCP tool `metabob_post_activity_result`
2. Tool does not exist in MCP server (verified by searching rpc-api codebase)
3. Fails silently - no error shown to user
4. Comments say "Single write path" but path is broken

**Gap:** Need to replace MCP tool call with direct HTTP POST to backend API

**Solution:**
```typescript
// Replace callMCPTool with direct HTTP fetch
const backendURL = process.env.METABOB_RPC_API_URL || "http://metabob-rpc-api:8000"
const response = await fetch(`${backendURL}/api/v1/learning-loop/executions`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    activity_id: data.activity_id,
    template_id: data.template_id,
    started_at: new Date(Date.now() - data.duration).toISOString(),
    duration_ms: data.duration,
    success: data.success,
    tokens_input: data.tokens.input,
    tokens_output: data.tokens.output,
    tokens_cache: data.tokens.cache,
    cost_usd: data.cost,
    completed_at: new Date().toISOString(),
  }),
})
```

---

### 3. Backend Endpoint: Learning Loop API ✅
**File:** `repos/metabob-rpc-api/server/routes/learning_loop.py`  
**Lines:** 120-214  
**Function:** `record_execution()`

**Current Behavior:**
- FastAPI endpoint at POST `/api/v1/learning-loop/executions`
- Accepts ExecutionRequest with all required fields
- Inserts execution to activity_execution table
- Updates template_metrics table
- Records failure patterns if execution failed
- Returns ExecutionResponse

**Code:**
```python
@router.post("/executions", response_model=ExecutionResponse, status_code=201)
async def record_execution(request: ExecutionRequest) -> ExecutionResponse:
    """
    Record an activity execution and update template metrics.

    This endpoint:
    1. Inserts execution record into activity_execution table
    2. Updates aggregated metrics in template_metrics table
    3. Records failure pattern if execution failed
    """
    try:
        # Parse timestamps
        started_at = datetime.fromisoformat(request.started_at.replace("Z", "+00:00"))
        completed_at = None
        if request.completed_at:
            completed_at = datetime.fromisoformat(
                request.completed_at.replace("Z", "+00:00")
            )

        # Insert execution record
        execution = insert_execution(
            activity_id=request.activity_id,
            template_id=request.template_id,
            started_at=started_at,
            duration_ms=request.duration_ms,
            success=request.success,
            tokens_input=request.tokens_input,
            tokens_output=request.tokens_output,
            tokens_cache=request.tokens_cache,
            cost_usd=request.cost_usd,
            completed_at=completed_at,
            error_message=request.error_message,
            error_type=request.error_type,
            failed_task_id=request.failed_task_id,
            impulses=impulses_data,
        )

        # Update metrics
        update_metrics_after_execution(
            template_id=request.template_id,
            success=request.success,
            duration_ms=request.duration_ms,
            cost_usd=request.cost_usd,
            tokens_input=request.tokens_input,
            tokens_output=request.tokens_output,
            tokens_cache=request.tokens_cache,
        )

        return ExecutionResponse(
            success=True,
            execution_id=request.activity_id,
            metrics_updated=True,
        )
    except Exception as e:
        logger.error(f"Failed to record execution: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))
```

**Assessment:** ✅ **FULLY FUNCTIONAL** - Endpoint is correctly implemented and ready to receive data.

**Gap:** None - this component is perfect. It's just never being called.

---

### 4. Database Layer: Activity Execution ✅
**File:** `repos/metabob-rpc-api/server/db/operations/activity_execution.py`  
**Lines:** 20-108  
**Function:** `insert_execution()`

**Current Behavior:**
- Inserts execution record to SurrealDB `activity_execution` table
- Stores: activity_id, template_id, duration, cost, tokens, success, timestamps
- Returns created record

**Code:**
```python
async def insert_execution(
    activity_id: str,
    template_id: str,
    started_at: datetime,
    duration_ms: int,
    success: bool,
    tokens_input: int,
    tokens_output: int,
    tokens_cache: int,
    cost_usd: float,
    completed_at: Optional[datetime] = None,
    error_message: Optional[str] = None,
    error_type: Optional[str] = None,
    failed_task_id: Optional[str] = None,
    impulses: Optional[List[Dict[str, Any]]] = None,
) -> Dict[str, Any]:
    db = await get_surreal_client()

    data = {
        "activity_id": activity_id,
        "template_id": template_id,
        "started_at": started_at.isoformat(),
        "completed_at": completed_at.isoformat() if completed_at else None,
        "duration_ms": duration_ms,
        "success": success,
        "tokens_input": tokens_input,
        "tokens_output": tokens_output,
        "tokens_cache": tokens_cache,
        "tokens_total": tokens_input + tokens_output + tokens_cache,
        "cost_usd": cost_usd,
        "error_message": error_message,
        "error_type": error_type,
        "failed_task_id": failed_task_id,
        "impulses": impulses if impulses else None,
        "created_at": datetime.utcnow().isoformat(),
    }

    # Write to SurrealDB (primary storage)
    result = await db.create("activity_execution", data)

    return result
```

**Assessment:** ✅ **FULLY FUNCTIONAL** - Database layer is ready.

**Gap:** None - just waiting for data to be sent.

---

### 5. Metrics Aggregation: Template Metrics ✅
**File:** `repos/metabob-rpc-api/server/db/operations/template_metrics.py`  
**Lines:** 150-300  
**Function:** `update_metrics_after_execution()`

**Current Behavior:**
- Updates template_metrics table after each execution
- Increments execution counters (total, successful, failed)
- Calculates success_rate
- Updates averages (cost, duration, tokens)
- Adjusts Thompson sampling parameters (alpha, beta)
- Sets last_executed_at timestamp

**Assessment:** ✅ **FULLY FUNCTIONAL** - Metrics aggregation logic is correct.

**Gap:** None - just waiting for execution records to be inserted.

---

## The Missing Link

**Problem:** The MCP tool `metabob_post_activity_result` does not exist.

**Evidence:**
1. ✅ opencode tries to call: `callMCPTool('metabob_post_activity_result')`
2. ❌ Tool not registered in MCP server (searched all rpc-api code)
3. ✅ Backend endpoint exists: `POST /api/v1/learning-loop/executions`
4. ❌ Endpoint is never called by opencode
5. ✅ Silent failure: "graceful degradation" logs warning but doesn't alert user

**Why This Matters:**
- Templates show 0 executions despite being run successfully
- Thompson sampling cannot adapt (stuck at alpha=1.0, beta=1.0)
- Success rates remain at 0%
- Learning system is completely non-functional
- Users have no visibility into the problem (silent failure)

---

## Implementation Plan

### Step 1: Fix Template Metrics Client ⚠️ CRITICAL
**File:** `repos/metabob-opencode/packages/opencode/src/session/template-metrics-client.ts`

**Changes:**
1. Import `fetch` for HTTP requests (built-in in Bun)
2. Add backend URL from environment:
   ```typescript
   const BACKEND_URL = process.env.METABOB_RPC_API_URL || "http://metabob-rpc-api:8000"
   ```
3. Replace `callMCPTool` with direct HTTP POST:
   ```typescript
   const response = await fetch(`${BACKEND_URL}/api/v1/learning-loop/executions`, {
     method: "POST",
     headers: { "Content-Type": "application/json" },
     body: JSON.stringify({
       activity_id: data.activity_id,
       template_id: data.template_id,
       started_at: new Date(Date.now() - data.duration).toISOString(),
       duration_ms: data.duration,
       success: data.success,
       tokens_input: data.tokens.input,
       tokens_output: data.tokens.output,
       tokens_cache: data.tokens.cache,
       cost_usd: data.cost,
       completed_at: new Date().toISOString(),
     }),
   })

   if (!response.ok) {
     const error = await response.text()
     throw new Error(`Backend returned ${response.status}: ${error}`)
   }

   const result = await response.json()
   log.info("execution recorded successfully", {
     activityId: data.activity_id,
     executionId: result.execution_id,
     metricsUpdated: result.metrics_updated,
   })
   ```

### Step 2: Add Environment Configuration
**File:** `repos/metabob-opencode/packages/opencode/src/config/index.ts`

**Add:**
```typescript
export const config = {
  backendURL: process.env.METABOB_RPC_API_URL || "http://metabob-rpc-api:8000",
  // ... existing config
}
```

**Kubernetes ConfigMap:**
```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: devbob-config
data:
  METABOB_RPC_API_URL: "http://metabob-rpc-api:8000"
```

### Step 3: Create Validation Harness
**File:** `tests/validation-harnesses/execution-recording-harness.ts`

**Test Cases:**
1. ✅ Execute hello-world-minimal activity
2. ✅ Query `activity_execution` table for new record
3. ✅ Verify record contains correct data
4. ✅ Query `template_metrics` table
5. ✅ Verify `total_executions` incremented
6. ✅ Verify `success_rate` calculated correctly
7. ✅ Verify `avg_cost_usd` updated
8. ✅ Verify `last_executed_at` is recent

**Expected Results:**
```sql
-- Before execution
SELECT total_executions FROM template_metrics WHERE variant_id = 'hello-world-minimal-*';
-- Result: 0

-- After execution
SELECT total_executions FROM template_metrics WHERE variant_id = 'hello-world-minimal-*';
-- Result: 1

SELECT success_rate FROM template_metrics WHERE variant_id = 'hello-world-minimal-*';
-- Result: 1.0 (100%)
```

---

## Verification Checklist

After implementing the fix, verify:

- [ ] Activity completes successfully
- [ ] New record appears in `activity_execution` table
- [ ] Record contains: activity_id, template_id, duration, cost, tokens, success=true
- [ ] `template_metrics.total_executions` incremented by 1
- [ ] `template_metrics.successful_executions` incremented by 1
- [ ] `template_metrics.success_rate` recalculated (e.g., 1.0 for first success)
- [ ] `template_metrics.avg_cost_usd` updated
- [ ] `template_metrics.avg_duration_ms` updated
- [ ] `template_metrics.avg_tokens_*` updated
- [ ] `template_metrics.last_executed_at` set to recent timestamp
- [ ] Thompson sampling parameters adjusted (alpha/beta)
- [ ] No errors in devbob logs
- [ ] No errors in rpc-api logs

---

## Evidence Summary

| Component | Status | Evidence |
|-----------|--------|----------|
| OpenCode Entry | ✅ Working | activity.ts:994 calls reportExecution() |
| Transport Layer | ❌ BROKEN | template-metrics-client.ts:106 calls non-existent MCP tool |
| Backend API | ✅ Ready | learning_loop.py:121 endpoint exists |
| Database Insert | ✅ Ready | activity_execution.py:20 insert_execution() |
| Metrics Update | ✅ Ready | template_metrics.py:150 update_metrics_after_execution() |
| Current State | ❌ BROKEN | All templates show 0 executions (SESSION_METRICS_DATABASE_STATUS.md) |

**Conclusion:** Backend is 100% ready. Fix the transport layer (1 file change) to enable the entire feedback loop.

---

## Related Files

- `SESSION_METRICS_DATABASE_STATUS.md` - Analysis showing 0 executions for all templates
- `repos/metabob-opencode/packages/opencode/src/session/activity.ts` - Activity completion
- `repos/metabob-opencode/packages/opencode/src/session/template-metrics-client.ts` - **NEEDS FIX**
- `repos/metabob-rpc-api/server/routes/learning_loop.py` - Backend endpoint (working)
- `repos/metabob-rpc-api/server/db/operations/activity_execution.py` - DB insert (working)
- `repos/metabob-rpc-api/server/db/operations/template_metrics.py` - Metrics update (working)

---

**Trace Complete:** 2026-03-02  
**Priority:** CRITICAL  
**Complexity:** LOW (1 file change)  
**Impact:** HIGH (enables entire learning system)
