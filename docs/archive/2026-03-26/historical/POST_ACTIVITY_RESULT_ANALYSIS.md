# Post Activity Result Tool Analysis

## Executive Summary

This document analyzes the current implementation of the `post_activity_result` tool and provides a detailed plan for updating it to use HTTP proxy to the Learning Loop API instead of in-memory storage.

**Status**: ✅ Tool exists and is fully functional - needs to be updated to proxy to Learning Loop API

---

## Current Implementation Flow

### 1. OpenCode Tool Layer
**File**: `repos/metabob-opencode/packages/opencode/src/tool/post-activity-result.ts`

```typescript
// Tool receives params from OpenCode activity execution
params = {
  activityId: string,
  result: {
    success: boolean,
    duration: number (ms),
    cost: number (USD),
    tokens?: { input, output, cache },
    errors?: string[]
  },
  backend: "local" | "metabob" | "all"
}

// Calls TemplateRepository.updateMetrics()
await TemplateRepository.updateMetrics(
  params.activityId,
  {
    executions: 1,
    successRate: params.result.success ? 1 : 0,
    avgCost: params.result.cost,
    avgDuration: params.result.duration,
    avgTokens: params.result.tokens,
  },
  backends: ["local", "metabob"] or [params.backend]
)
```

**Current behavior**: Direct call to TemplateRepository (in-memory storage)

---

### 2. Template Metrics Client Layer
**File**: `repos/metabob-opencode/packages/opencode/src/session/template-metrics-client.ts`

```typescript
export async function reportExecution(data: ActivityExecutionData): Promise<void> {
  const result = await callMCPTool<{ success: boolean; error?: string }>(
    "metabob_post_activity_result",
    {
      activity_id: data.activity_id,
      result: {
        success: data.success,
        duration: data.duration,
        cost: data.cost,
        tokens: data.tokens,
      },
    }
  )
}
```

**Note**: This is the proper MCP-based flow that should be used. The tool layer should delegate to this instead of calling TemplateRepository directly.

---

### 3. Python MCP Tool Layer
**File**: `repos/metabob-cli/src/metabob_cli/mcp/activity_template_tools.py:242-292`

```python
@mcp.tool(
    name="metabob_post_activity_result",
    description="Post execution results for activity template.",
)
async def metabob_post_activity_result(
    activity_id: str,
    result: dict,
    ctx: Context = None,
):
    """Post execution results for an activity."""
    # Extract template ID from activity ID
    template_id = (
        activity_id.rsplit("-", 1)[0] if "-" in activity_id else activity_id
    )
    
    # Current: Updates local file-based storage
    activity_templates.update_metrics(template_id, result)
    
    return {
        "status": "success",
        "activity_id": activity_id,
        "message": f"Result recorded for activity: {activity_id}"
    }
```

**Current behavior**: Calls `activity_templates.update_metrics()` which updates local JSON files

---

### 4. Activity Templates Storage Layer
**File**: `repos/metabob-cli/src/metabob_cli/mcp/activity_templates.py:265-360`

```python
def update_metrics(template_id: str, result: dict[str, Any]) -> bool:
    """Update template execution metrics with file locking."""
    # Current implementation:
    # 1. Loads template from ~/.metabob/activities/{template_id}.json
    # 2. Updates metrics (execution_count, success_count, avg_duration, avg_cost)
    # 3. Writes back to file with file locking
    
    storage_path = get_activity_storage_path()
    template_file = storage_path / f"{template_id}.json"
    
    # File-based storage with fcntl locking
    with open(template_file, "r+") as f:
        fcntl.flock(f.fileno(), fcntl.LOCK_EX)
        # Update metrics...
```

**Current behavior**: Local file-based storage with file locking

---

## Required Changes

### Phase 2.1 Goal
**Update metabob_post_activity_result MCP tool to proxy to Learning Loop API instead of using in-memory storage**

### Architecture Change
```
BEFORE:
OpenCode tool → TemplateRepository.updateMetrics() → Local file storage

AFTER:
OpenCode tool → MCP tool (metabob_post_activity_result) → HTTP POST → Learning Loop API
```

---

## Learning Loop API Specification

### Endpoint
```
POST /api/v1/learning-loop/executions
```

### Request Schema
**File**: `repos/metabob-rpc-api/server/routes/learning_loop.py:52-71`

```python
class ExecutionRequest(BaseModel):
    activity_id: str              # Unique activity instance ID
    template_id: str              # Template identifier
    started_at: str               # Start timestamp (ISO 8601)
    duration_ms: int              # Duration in milliseconds
    success: bool                 # Whether execution succeeded
    tokens_input: int = 0         # Input tokens consumed
    tokens_output: int = 0        # Output tokens generated
    tokens_cache: int = 0         # Cached tokens reused
    cost_usd: float = 0.0         # Execution cost in USD
    completed_at: Optional[str]   # Completion timestamp (ISO 8601)
    error_message: Optional[str]  # Error message if failed
    error_type: Optional[str]     # Error category
    failed_task_id: Optional[str] # Task ID where failure occurred
```

### Response Schema
```python
class ExecutionResponse(BaseModel):
    success: bool
    execution_id: str
    metrics_updated: bool
```

### Example Request
```json
{
  "activity_id": "act_abc123",
  "template_id": "add-feature-complete",
  "started_at": "2026-02-21T18:00:00Z",
  "duration_ms": 45000,
  "success": true,
  "tokens_input": 5000,
  "tokens_output": 1500,
  "tokens_cache": 2000,
  "cost_usd": 0.022
}
```

---

## httpx Pattern Reference

**File**: `repos/metabob-cli/src/metabob_cli/mcp/learning_tools.py`

### Pattern 1: Configuration Loading
```python
from metabob_cli.core.config import load_config

config = load_config()
api_base = getattr(config, "api_base_url", "http://localhost:8080")
```

### Pattern 2: HTTP POST with httpx
```python
import httpx
from datetime import datetime

async with httpx.AsyncClient(timeout=30.0) as client:
    response = await client.post(
        f"{api_base}/api/v1/learning-loop/executions",
        json=request_data,
        headers={"Content-Type": "application/json"},
    )
    
    if response.status_code == 201:  # Note: POST /executions returns 201
        result = response.json()
        logger.info(f"[LEARNING] Recorded execution: {activity_id}")
        return {
            "status": "success",
            "execution_id": result.get("execution_id"),
            "metrics_updated": result.get("metrics_updated"),
        }
    else:
        logger.warning(f"[LEARNING] API error {response.status_code}: {response.text}")
        return {
            "status": "error",
            "message": f"Failed to record execution: HTTP {response.status_code}",
        }
```

### Pattern 3: Error Handling
```python
try:
    # API call...
except Exception as e:
    logger.error(f"[LEARNING] Failed to record execution: {e}", exc_info=True)
    return {
        "status": "error",
        "message": f"Recording failed: {str(e)}",
    }
```

---

## Parameter Mapping

### Input (from OpenCode)
```python
activity_id: str
result: dict = {
    "success": bool,
    "duration": int,      # milliseconds
    "cost": float,        # USD
    "tokens": {
        "input": int,
        "output": int,
        "cache": int
    } | None
}
```

### Output (to Learning Loop API)
```python
request_data = {
    "activity_id": activity_id,
    "template_id": extract_template_id(activity_id),  # Extract from activity_id
    "started_at": datetime.now().isoformat() + "Z",   # Current time - started_at
    "duration_ms": result["duration"],
    "success": result["success"],
    "tokens_input": result.get("tokens", {}).get("input", 0),
    "tokens_output": result.get("tokens", {}).get("output", 0),
    "tokens_cache": result.get("tokens", {}).get("cache", 0),
    "cost_usd": result["cost"],
    "completed_at": datetime.now().isoformat() + "Z",  # Current time
    "error_message": result.get("errors", [None])[0] if not result["success"] else None,
    "error_type": "execution_error" if not result["success"] else None,
    "failed_task_id": None,  # Not available in current flow
}
```

### Timestamp Calculation
```python
# IMPORTANT: We need to calculate started_at from current time and duration
completed_at = datetime.now()
started_at = completed_at - timedelta(milliseconds=result["duration"])

request_data = {
    "started_at": started_at.isoformat() + "Z",
    "completed_at": completed_at.isoformat() + "Z",
    # ...
}
```

---

## Implementation Plan

### Step 1: Update metabob_post_activity_result MCP tool
**File**: `repos/metabob-cli/src/metabob_cli/mcp/activity_template_tools.py:242-292`

```python
@mcp.tool(
    name="metabob_post_activity_result",
    description="Post execution results for activity template to Learning Loop API.",
)
async def metabob_post_activity_result(
    activity_id: str,
    result: dict,
    ctx: Context = None,
):
    """Post execution results to Learning Loop API."""
    start_time = datetime.now()
    logger.info(f"[ACTIVITY_RESULT] Posting result for activity: {activity_id}")

    try:
        # Import config loader
        from metabob_cli.core.config import load_config
        import httpx
        from datetime import timedelta

        config = load_config()
        api_base = getattr(config, "api_base_url", "http://localhost:8080")

        # Extract template ID from activity ID
        template_id = (
            activity_id.rsplit("-", 1)[0] if "-" in activity_id else activity_id
        )

        # Calculate timestamps
        completed_at = datetime.now()
        duration_ms = result.get("duration", 0)
        started_at = completed_at - timedelta(milliseconds=duration_ms)

        # Build request data matching ExecutionRequest schema
        request_data = {
            "activity_id": activity_id,
            "template_id": template_id,
            "started_at": started_at.isoformat() + "Z",
            "duration_ms": duration_ms,
            "success": result.get("success", False),
            "tokens_input": result.get("tokens", {}).get("input", 0),
            "tokens_output": result.get("tokens", {}).get("output", 0),
            "tokens_cache": result.get("tokens", {}).get("cache", 0),
            "cost_usd": result.get("cost", 0.0),
            "completed_at": completed_at.isoformat() + "Z",
        }

        # Add error fields if execution failed
        if not result.get("success"):
            errors = result.get("errors", [])
            request_data["error_message"] = errors[0] if errors else "Execution failed"
            request_data["error_type"] = "execution_error"
            # failed_task_id not available in current flow

        # Call Learning Loop API
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                f"{api_base}/api/v1/learning-loop/executions",
                json=request_data,
                headers={"Content-Type": "application/json"},
            )

            if response.status_code == 201:
                result_data = response.json()
                elapsed = (datetime.now() - start_time).total_seconds()

                logger.info(
                    f"[ACTIVITY_RESULT] Posted result for {activity_id} in {elapsed:.2f}s"
                )

                return {
                    "status": "success",
                    "timestamp": datetime.now().isoformat(),
                    "activity_id": activity_id,
                    "execution_id": result_data.get("execution_id"),
                    "metrics_updated": result_data.get("metrics_updated", True),
                    "message": f"Result recorded in Learning Loop: {activity_id}",
                }
            else:
                logger.warning(
                    f"[ACTIVITY_RESULT] API error {response.status_code}: {response.text}"
                )
                return {
                    "status": "error",
                    "timestamp": datetime.now().isoformat(),
                    "error": f"Failed to post result: HTTP {response.status_code}",
                }

    except Exception as e:
        elapsed = (datetime.now() - start_time).total_seconds()
        logger.error(f"[ACTIVITY_RESULT] Failed after {elapsed:.2f}s: {e}", exc_info=True)
        return {
            "status": "error",
            "timestamp": datetime.now().isoformat(),
            "error": f"Failed to post result: {str(e)}",
        }
```

### Step 2: Add required imports
At the top of `activity_template_tools.py`:
```python
from datetime import datetime, timedelta  # Add timedelta
```

### Step 3: Update OpenCode tool layer (optional optimization)
**File**: `repos/metabob-opencode/packages/opencode/src/tool/post-activity-result.ts`

Currently calls `TemplateRepository.updateMetrics()` directly. Should delegate to MCP tool instead (already implemented in `template-metrics-client.ts`).

**Recommendation**: Keep current implementation for backward compatibility, but ensure MCP path is preferred.

---

## Testing Plan

### Unit Test
```python
# Test metabob_post_activity_result tool
activity_id = "add-feature-complete-1234567890"
result = {
    "success": True,
    "duration": 45000,
    "cost": 0.022,
    "tokens": {
        "input": 5000,
        "output": 1500,
        "cache": 2000,
    }
}

response = await metabob_post_activity_result(activity_id, result)
assert response["status"] == "success"
assert response["metrics_updated"] == True
```

### Integration Test
```bash
# 1. Start Learning Loop API
cd repos/metabob-rpc-api
python -m server.main

# 2. Execute activity and verify metrics are recorded
# 3. Query /api/v1/learning-loop/executions/{activity_id} to verify
```

### Validation Checks
- [ ] Tool receives correct parameters from OpenCode
- [ ] Timestamp calculation is accurate (started_at = completed_at - duration)
- [ ] Template ID extraction works correctly
- [ ] Token fields are properly mapped
- [ ] Error fields are populated when success=false
- [ ] HTTP response is parsed correctly
- [ ] Errors are logged appropriately
- [ ] Graceful degradation on API failure

---

## Migration Strategy

### Phase 1: Dual Write (Recommended)
1. Update MCP tool to write to BOTH local storage AND Learning Loop API
2. Monitor for inconsistencies
3. Validate API integration is working

### Phase 2: API Only
1. Remove local storage writes
2. Rely entirely on Learning Loop API
3. Update OpenCode to use MCP path exclusively

---

## Key Differences: Local Storage vs API

| Aspect | Local Storage | Learning Loop API |
|--------|---------------|-------------------|
| Location | `~/.metabob/activities/{template_id}.json` | PostgreSQL database |
| Concurrency | File locking (fcntl) | Database transactions |
| Metrics | Simple averaging | Advanced aggregation with time series |
| Failure tracking | None | Full failure pattern recording |
| Scalability | Single machine | Distributed |
| Query capability | File reads | SQL queries, analytics |

---

## Critical Notes

1. **Timestamp Calculation**: We must calculate `started_at` from `completed_at - duration` since the current flow only receives duration, not actual start time.

2. **Template ID Extraction**: Current logic splits on last hyphen: `activity_id.rsplit("-", 1)[0]`
   - Example: `add-feature-complete-1234567890` → `add-feature-complete`

3. **Error Handling**: Learning Loop API expects:
   - `error_message`: First error from errors array
   - `error_type`: Generic "execution_error" (can be enhanced later)
   - `failed_task_id`: Not available in current flow

4. **HTTP Status Code**: Learning Loop API returns `201 Created` for successful execution recording, not `200 OK`.

5. **Token Fields**: Must handle missing tokens gracefully (default to 0).

---

## Files to Modify

1. ✅ **Found**: `repos/metabob-cli/src/metabob_cli/mcp/activity_template_tools.py:242-292`
   - Update `metabob_post_activity_result` function to proxy to API

2. **Optional**: `repos/metabob-opencode/packages/opencode/src/tool/post-activity-result.ts`
   - Already delegates to MCP via TemplateMetricsClient
   - No changes needed if MCP tool is updated

3. **Reference**: `repos/metabob-cli/src/metabob_cli/mcp/learning_tools.py`
   - Use as pattern reference for httpx and error handling

4. **API Spec**: `repos/metabob-rpc-api/server/routes/learning_loop.py:52-71, 87-175`
   - Reference for request/response schema

---

## Success Criteria

- ✅ MCP tool proxies to Learning Loop API instead of local storage
- ✅ All execution data is correctly mapped to ExecutionRequest schema
- ✅ Timestamps are calculated correctly
- ✅ Error handling follows established patterns
- ✅ Integration test passes with real API
- ✅ Metrics are recorded in PostgreSQL database
- ✅ No breaking changes to OpenCode tool interface

---

## Next Steps

1. **Implement**: Update `metabob_post_activity_result` in `activity_template_tools.py`
2. **Test**: Verify HTTP proxy works with Learning Loop API
3. **Validate**: Check database records after execution
4. **Document**: Update tool description to reflect API integration
5. **Monitor**: Track API call success rates and latency

---

## Appendix: Related Files

### OpenCode Files
- `repos/metabob-opencode/packages/opencode/src/tool/post-activity-result.ts` - Tool definition
- `repos/metabob-opencode/packages/opencode/src/session/template-metrics-client.ts` - MCP client
- `repos/metabob-opencode/packages/opencode/src/session/activity-template-repository.ts` - Local storage (to be deprecated)

### MCP Files
- `repos/metabob-cli/src/metabob_cli/mcp/activity_template_tools.py` - MCP tool definitions
- `repos/metabob-cli/src/metabob_cli/mcp/activity_templates.py` - Storage layer (to be deprecated)
- `repos/metabob-cli/src/metabob_cli/mcp/learning_tools.py` - Pattern reference

### API Files
- `repos/metabob-rpc-api/server/routes/learning_loop.py` - Learning Loop API endpoints
- `repos/metabob-rpc-api/server/services/learning_loop_service.py` - Business logic (assumed)
- `repos/metabob-rpc-api/server/database/learning_loop_queries.py` - Database queries (assumed)

---

**Document Version**: 1.0  
**Date**: 2026-02-21  
**Author**: Analysis Agent  
**Status**: Ready for Implementation
