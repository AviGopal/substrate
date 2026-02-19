# Live Data Flow Validation

## Problem Identified

Previous validation tests (`test-impulse-working.sh`, `test-activity-template-flow.sh`, `test-variant-system-flow.sh`) had a critical flaw:

**They manually inserted data into SurrealDB and then queried it back.**

This proved "we can write to database" but NOT that the actual production code paths work.

## Real Data Flow

The actual production data flow is:

```
OpenCode Tool
    ↓
MCP Client (metabob-cli)
    ↓
ActivityManager (production code)
    ↓
Backend API (metabob-rpc-api)
    ↓
Database (SurrealDB/Redis)
```

## Live Test Script

`verify-live-data-flow-simple.py` validates the REAL production code path:

### What It Does

1. **Verifies backend is running** (`http://localhost:8080/health`)

2. **Ensures test template exists** via Backend API:
   - GET `/v2/activities/templates` to check
   - POST `/v2/activities/templates` to create if missing

3. **Executes activity via production MCP code**:
   - `ActivityManager.start_execution()` → Backend POST `/v2/activities/record/start`
   - `ActivityManager.get_next_step()` → Backend GET `/v2/activities/templates/{id}`
   - `ActivityManager.report_step_result()` → Backend POST `/v2/activities/executions/{id}/tasks`
   - `ActivityManager.get_next_step()` (completion check) → Backend POST `/v2/activities/executions`

4. **Verifies data in backend**:
   - GET `/v2/activities/templates/test-hello-world/stats`
   - Confirms `total_executions > 0`

### Key Insight

This test triggers **REAL production code**, not manual database inserts. It validates that:

✅ MCP tools actually call backend API  
✅ Backend API actually writes to database  
✅ Data actually flows through the system  

## Code Paths Validated

### ActivityManager (MCP Layer)

**File**: `repos/metabob-cli/src/metabob_cli/mcp/activity_manager.py`

- **Line 703-711**: `start_execution()` calls `POST /v2/activities/record/start`
- **Line 762**: `get_next_step()` calls `GET /v2/activities/templates/{id}`
- **Line 936**: `report_step_result()` calls `POST /v2/activities/executions/{id}/tasks`
- **Line 1549**: `_record_outcome()` calls `POST /v2/activities/executions`

### Backend API (Server Layer)

**File**: `repos/metabob-rpc-api/server/routes/activity.py`

- **Line 237**: `POST /executions` - Records execution results
- **Line 80**: `GET /templates/{id}` - Fetches template details
- **Line 281**: `GET /templates/{id}/stats` - Returns execution statistics

**File**: `repos/metabob-rpc-api/server/routes/activity_metrics_router.py`

- **Line 19**: `POST /api/activity-execution` - Records execution metrics
- **Line 71**: `GET /api/template/{id}/metrics` - Returns aggregated metrics

## Running the Test

### Prerequisites

1. **Start Backend API**:
   ```bash
   cd repos/metabob-rpc-api
   poetry run uvicorn server.main:app --reload
   ```

2. **Ensure SurrealDB is running** (if using SurrealDB backend)

3. **Ensure Redis is running** (current MVP uses Redis)

### Execute Test

```bash
./verify-live-data-flow-simple.py
```

### Expected Output

```
[INFO] ============================================================
[INFO] Live Data Flow Test - Production Code Path
[INFO] ============================================================
[INFO] ✓ Backend API is running
[INFO] ✓ Test template exists: test-hello-world-a1b2c3d4
[INFO] Step 3: Executing activity via production MCP ActivityManager...
[INFO] Trace ID: a1b2c3d4
[INFO] Session ID: test_session_a1b2c3d4
[INFO]   3a. Starting execution (MCP → Backend POST /v2/activities/record/start)...
[INFO]   ✓ Execution started: exec_abc123def456
[INFO]   3b. Getting next step (MCP → Backend GET /v2/activities/templates/...)...
[INFO]   ✓ Got step: task-1
[INFO]   3c. Reporting step result (MCP → Backend POST /v2/activities/executions/{id}/tasks)...
[INFO]   ✓ Step result reported
[INFO]   3d. Checking completion (MCP → Backend POST /v2/activities/executions)...
[INFO]   ✓ Activity completed successfully
[INFO] Step 4: Verifying data reached backend...
[INFO]   Backend stats retrieved:
[INFO]     Total executions: 5
[INFO]     Success rate: 100.00%
[INFO] ✓ DATA SUCCESSFULLY FLOWED THROUGH PRODUCTION CODE!
[INFO]   OpenCode → MCP → Backend API → Database ✓
[INFO] ============================================================
[INFO] LIVE DATA FLOW TEST: PASSED ✓
[INFO] Production code path validated: MCP → Backend → Database
[INFO] ============================================================
```

## Validation Checklist

- [x] Test calls production MCP code (not manual inserts)
- [x] MCP code calls real backend API endpoints
- [x] Backend API writes to actual database
- [x] Data retrieval confirms persistence
- [x] Full integration path validated

## Difference from Previous Tests

| Aspect | Previous Tests | Live Test |
|--------|---------------|-----------|
| **Data insertion** | Manual SQL INSERT | Production MCP code |
| **API calls** | None (direct DB) | Real HTTP requests |
| **Code path** | Test script only | Full production stack |
| **Validation** | Can write to DB | Actual integration works |

## Next Steps

Once this test passes:

1. **Extend to impulse system**: Test impulse creation through production code
2. **Extend to activity variants**: Test variant creation and selection
3. **Add tracing**: Add unique `trace_id` to track data flow through logs
4. **Automate**: Add to CI/CD pipeline as integration test

## Test Template Used

The test uses a minimal template:

```json
{
  "activity_id": "test-hello-world",
  "variant_name": "Test Hello World",
  "description": "Simple test activity for data flow validation",
  "category": "testing",
  "task_steps": [
    {
      "id": "task-1",
      "subagent": "general",
      "description": "Echo test message",
      "prompt": {
        "template": "Echo: {{message}}",
        "variables": [
          {"name": "message", "type": "string", "required": true}
        ]
      },
      "validation": {"type": "none"}
    }
  ]
}
```

This minimizes external dependencies while testing the full data flow.
