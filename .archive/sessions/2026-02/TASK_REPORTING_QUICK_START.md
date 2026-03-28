# Task Reporting Integration - Quick Start

**Status**: ✅ **OPERATIONAL** (as of Feb 16, 2026)

## What It Does

Activity manager reports individual task results to the backend as they complete, enabling:
- Task-level debugging (see which task failed)
- Performance analysis (duration, tokens per task)
- Cost tracking per task
- Foundation for failure analysis and self-healing

## How to Test

```bash
cd /home/avi/documents/work/exp-repo/metabob-devbob
python3 test_task_reporting.py
```

Expected output:
```
✅ Task reported: {'complete': True, 'message': 'Activity completed successfully'}
```

## Integration Location

**File**: `repos/metabob-cli/src/metabob_cli/mcp/activity_manager.py`
- **Line 866**: `await self._report_task_to_backend(execution, result)`
- **Lines 904-953**: Implementation of `_report_task_to_backend()`

## Payload Structure

```python
{
    "execution_id": "exec_...",
    "task_index": 0,
    "task_name": "step-id",
    "status": "success",
    "duration_ms": 0.0,
    "tokens": {"input": 100, "output": 50, "total": 150},
    "cost": 0.001,
    "error": null,
    "tool_calls": 3  # COUNT (not array!)
}
```

## Schema: `tool_calls` is INTEGER

**IMPORTANT**: `tool_calls` stores the **count** of tools used, not the array of tool names.

- ✅ Correct: `"tool_calls": 3`
- ❌ Wrong: `"tool_calls": ["read", "edit", "bash"]`

## Files Modified

1. **Backend API**: `repos/metabob-rpc-api/server/routes/v2_activities.py`
   - Line 298: `tool_calls: Optional[int]`

2. **Python Client**: `repos/metabob-cli/src/metabob_cli/mcp/activity_manager.py`
   - Line 866: Call to `_report_task_to_backend()`
   - Line 933: `len(result.tool_calls)` instead of array

## Troubleshooting

### 422 Error
If you get `422 Unprocessable Content`, check:
1. Backend restarted after schema change? → `docker restart metabob-rpc-api-server-dev-1`
2. Sending `tool_calls` as int? → Check line 933 in activity_manager.py

### No 200 OK in Logs
```bash
docker logs metabob-rpc-api-server-dev-1 2>&1 | grep "POST /v2/activities/executions" | tail -5
```
Should see `200 OK` responses.

## Known Limitations

1. **Duration is 0**: OpenCode doesn't track task duration yet
2. **No GET endpoint**: Can't query tasks[] array via API (use logs)
3. **Tool details lost**: Only count stored, not individual tool names

## More Info

See `TASK_REPORTING_INTEGRATION_COMPLETE.md` for full documentation.
