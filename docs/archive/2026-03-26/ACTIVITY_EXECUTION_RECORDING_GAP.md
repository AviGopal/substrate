## Activity Execution Recording Analysis

### Finding
The trace-enforce-validate-loop activity completed successfully but was NOT recorded in the backend database.

### Root Cause
OpenCode CLI does not call the POST /v2/activities/executions endpoint after activity completion.

### Evidence
1. ✅ Activity executed successfully (1103.8s, $2.77, 848k tokens)
2. ✅ Execution data stored locally in ~/.local/share/opencode/storage/activity/
3. ❌ No POST requests to /v2/activities/executions in RPC API logs
4. ❌ activity_execution table in SurrealDB is empty (0 records)
5. ❌ activity_executions table has old data (March 5) but not today's execution

### Required Schema (from server/routes/activity.py)
```json
{
  "activity_id": "act_abc123",
  "template_id": "trace-enforce-validate-loop", 
  "started_at": "2026-03-07T03:00:00Z",
  "completed_at": "2026-03-07T03:18:24Z",
  "duration_ms": 1103800,
  "success": true,
  "tokens": {"input": 848636, "output": 10555, "cache": 0},
  "cost_usd": 2.7677,
  "org_id": "default",
  "agent_id": "opencode-cli"
}
```

### Next Steps
1. Add execution recording to OpenCode CLI after activity finalization
2. Map local activity data to backend schema
3. Handle network failures gracefully (queue + retry)
4. Verify execution appears in dashboard

### Workaround
Manual recording via curl (for testing):
```bash
curl -X POST -H 'Authorization: Bearer TOKEN' \
  -H 'Content-Type: application/json' \
  -d '{...}' \
  http://api.metabob.local/v2/activities/executions
```

