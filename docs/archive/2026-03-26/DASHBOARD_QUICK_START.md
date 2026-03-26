# Dashboard Components Quick Start Guide

Quick reference for using the new dashboard observability features.

## Setup

### 1. Apply Database Schema

```bash
# From repository root
cd repos/metabob-activity-api

# Apply schema migration
bun run surreal import --conn http://localhost:8000 \
  --user root --pass surrealdb-local-dev-123 \
  --ns activity-system --db learning_loop \
  sql/005-dashboard-components.surql
```

Or manually via SurrealDB shell:

```bash
surreal sql --conn http://localhost:8000 \
  --user root --pass surrealdb-local-dev-123 \
  --ns activity-system --db learning_loop \
  --file sql/005-dashboard-components.surql
```

### 2. Start Backend

```bash
cd repos/metabob-activity-api
bun run dev
```

Backend will be available at: `http://api.minibob.local:8080`

### 3. Start Dashboard

```bash
cd repos/activity-dashboard
bun run dev
```

Dashboard will be available at: `http://dashboard.minibob.local:3000`

## Using the Dashboard

### Executions Tab

**View execution history:**
1. Navigate to "Executions" tab
2. See timeline of all activity executions
3. Green badges = success, Red badges = failure

**Filter executions:**
- Use status dropdown: "All Status", "Success", "Failure"
- Search by variant ID, activity ID, or error message
- Click "Refresh" to reload

**View execution details:**
1. Click any execution row to expand
2. See task breakdown with tool calls
3. View files modified
4. Check impulses used
5. See token usage and costs

**Pagination:**
- Use "Previous" / "Next" buttons at bottom
- Shows 50 executions per page
- Total count displayed in header

### Variants Tab

**View code variants:**
1. Navigate to "Variants" tab
2. See all variants sorted by Thompson score
3. Color-coded scores:
   - Green (>= 70%) = High performer
   - Yellow (>= 40%) = Average performer
   - Red (< 40%) = Low performer

**Filter variants:**
- Category dropdown: Feature, Bugfix, Refactor, Tool, Infrastructure
- Promotion status: Promoted, Candidate, Staging, Rejected
- Sort by: Thompson Score, Success Rate, Total Executions, Created Date

**Interpret metrics:**
- **Thompson Score**: Bayesian probability of success (0-100%)
- **Alpha/Beta**: Thompson Sampling parameters
- **Success Rate**: Historical success percentage
- **Executions**: Total runs (success + failure)
- **Avg Duration**: Mean execution time in seconds
- **Avg Cost**: Mean LLM cost per execution

### Vessels Tab

**Monitor MiniBob pods:**
1. Navigate to "Vessels" tab
2. See summary stats at top:
   - Total vessels
   - Currently executing
   - Total executions (all pods)
   - Cumulative cost

**View pod details:**
- Green pulsing dot = Ready and connected
- Gray dot = Not ready (stale heartbeat)
- Status badge: Executing, Idle, Bored, Error

**Current activity (when executing):**
- Variant name and activity ID
- Current task description
- Progress bar (if available)
- Started timestamp

**Pod metrics:**
- CPU usage percentage
- Memory usage in MB
- Executions completed
- Total cost spent
- Uptime duration

**Heartbeat status:**
- Shows "Last heartbeat: Xm ago"
- Auto-refreshes every 10 seconds
- Pod marked stale after 1 minute

## API Endpoints

### Execution Traces

```bash
# List recent executions
curl "http://api.minibob.local/v2/activities/execution-traces?limit=10"

# Filter by success status
curl "http://api.minibob.local/v2/activities/execution-traces?success=true"

# Filter by variant
curl "http://api.minibob.local/v2/activities/execution-traces?variant_id=fix-bug-v1"

# Filter by date range
curl "http://api.minibob.local/v2/activities/execution-traces?start_date=2026-03-01T00:00:00Z&end_date=2026-03-22T23:59:59Z"

# Get specific trace
curl "http://api.minibob.local/v2/activities/execution-traces/exec_20260322_001"
```

### Code Variants

```bash
# List variants sorted by Thompson score
curl "http://api.minibob.local/v2/activities/code-variants?sort_by=thompson_score&sort_order=desc"

# Filter by category
curl "http://api.minibob.local/v2/activities/code-variants?category=feature"

# Filter by promotion status
curl "http://api.minibob.local/v2/activities/code-variants?promotion_status=candidate"

# Filter by minimum Thompson score
curl "http://api.minibob.local/v2/activities/code-variants?min_score=0.7"

# Get specific variant
curl "http://api.minibob.local/v2/activities/code-variants/fix-bug-v1"
```

### Vessel Status

```bash
# List all vessels
curl "http://api.minibob.local/v2/vessels/status"

# Get specific vessel
curl "http://api.minibob.local/v2/vessels/minibob-0/status"

# Send heartbeat (from MiniBob pod)
curl -X POST "http://api.minibob.local/v2/vessels/heartbeat" \
  -H "Content-Type: application/json" \
  -d '{
    "pod_name": "minibob-0",
    "namespace": "activity-system",
    "status": "executing",
    "current_activity": {
      "variant_id": "fix-bug-v1",
      "activity_id": "fix-null-pointer",
      "variant_name": "Fix Null Pointer Bug",
      "started_at": "2026-03-22T10:00:00Z",
      "current_task": "Running unit tests",
      "progress": 75
    },
    "metrics": {
      "cpu_usage": 23.5,
      "memory_usage": 256.8,
      "executions_completed": 12,
      "total_cost_usd": 0.78,
      "uptime_seconds": 7200
    }
  }'
```

## MiniBob Integration

### Storing Execution Traces

MiniBob should store execution traces after each activity completion:

```typescript
// In MiniBob after activity execution
const executionTrace = {
  execution_id: `exec_${Date.now()}`,
  variant_id: activity.variant_id,
  activity_id: activity.activity_id,
  success: executionResult.success,
  duration_ms: executionResult.duration,
  cost: executionResult.cost,
  tokens: {
    input: executionResult.tokens.input,
    output: executionResult.tokens.output,
    cache: executionResult.tokens.cache,
  },
  tasks: executionResult.tasks, // Task breakdown with tool calls
  state_snapshot: {
    input_state: executionResult.inputState,
    output_state: executionResult.outputState,
  },
  impulses_used: executionResult.impulsesUsed,
  org_id: session.org_id,
  project_id: session.project_id,
  executed_at: new Date().toISOString(),
};

// POST to API
await fetch('http://api.minibob.local/v2/activities/execution-traces', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(executionTrace),
});
```

### Sending Heartbeats

MiniBob should send heartbeats every 30 seconds:

```typescript
// In MiniBob main loop
setInterval(async () => {
  const heartbeat = {
    pod_name: process.env.POD_NAME || 'minibob-local',
    namespace: process.env.POD_NAMESPACE || 'activity-system',
    status: currentStatus, // 'idle' | 'executing' | 'bored' | 'error'
    current_activity: currentActivity ? {
      variant_id: currentActivity.variant_id,
      activity_id: currentActivity.activity_id,
      variant_name: currentActivity.variant_name,
      started_at: currentActivity.started_at,
      current_task: currentActivity.current_task,
      progress: currentActivity.progress,
    } : null,
    metrics: {
      cpu_usage: getCPUUsage(),
      memory_usage: getMemoryUsageMB(),
      executions_completed: totalExecutionsCompleted,
      total_cost_usd: cumulativeCost,
      uptime_seconds: Math.floor(process.uptime()),
    },
  };

  await fetch('http://api.minibob.local/v2/vessels/heartbeat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(heartbeat),
  });
}, 30000); // Every 30 seconds
```

## WebSocket Real-time Updates

The dashboard automatically connects to WebSocket for live updates.

**Connection status:**
- Green "Live" indicator in top-right = Connected
- Gray "Reconnecting..." = Disconnected

**Events handled:**
- `execution_completed` → Refreshes Executions tab
- `pod_status_changed` → Refreshes Vessels tab
- `template_updated` → Refreshes variants (future)

**Connection details:**
- URL: `ws://api.minibob.local/ws`
- Auto-reconnect on disconnect (max 10 attempts)
- Reconnect interval: 5 seconds

## Troubleshooting

### No executions showing

1. Check if execution traces are being stored:
   ```bash
   curl "http://api.minibob.local/v2/activities/execution-traces" | jq
   ```

2. Verify database table exists:
   ```bash
   surreal sql --conn http://localhost:8000 \
     --user root --pass surrealdb-local-dev-123 \
     --ns activity-system --db learning_loop

   > SELECT * FROM activity_execution_traces LIMIT 5;
   ```

3. Check MiniBob is storing traces after execution

### No variants showing

1. Check if variants exist in database:
   ```bash
   curl "http://api.minibob.local/v2/activities/code-variants" | jq
   ```

2. Verify activity templates are registered

3. Check if metrics are being calculated

### No vessels showing

1. Check if vessels are sending heartbeats:
   ```bash
   curl "http://api.minibob.local/v2/vessels/status" | jq
   ```

2. Verify MiniBob pods have heartbeat sending enabled

3. Check vessel_heartbeats table:
   ```sql
   SELECT * FROM vessel_heartbeats WHERE last_heartbeat >= time::now() - 5m;
   ```

### WebSocket not connecting

1. Check API logs for WebSocket errors
2. Verify API is accessible: `curl http://api.minibob.local/health`
3. Check browser console for WebSocket errors
4. Ensure CORS is configured correctly in API

### Build errors

1. Backend build error:
   ```bash
   cd repos/metabob-activity-api
   bun build src/index.ts --outfile=/tmp/test.js
   ```

2. Frontend build error:
   ```bash
   cd repos/activity-dashboard
   bun run dev
   # Check console for errors
   ```

## Analytics Queries

Useful SurrealDB queries for debugging and analysis:

```sql
-- Execution success rate by variant
SELECT
  variant_id,
  count() as total,
  math::sum(success::int) as successful,
  (math::sum(success::int) / count()) * 100 as success_rate
FROM activity_execution_traces
GROUP BY variant_id;

-- Average execution duration by activity
SELECT
  activity_id,
  count() as executions,
  math::mean(duration_ms) as avg_duration_ms,
  math::mean(cost) as avg_cost_usd
FROM activity_execution_traces
GROUP BY activity_id;

-- Active vessels with current work
SELECT
  pod_name,
  status,
  current_activity.variant_name as working_on,
  metrics.executions_completed as completed
FROM vessel_heartbeats
WHERE status = 'executing'
  AND last_heartbeat >= time::now() - 1m;

-- Recent failed executions
SELECT
  execution_id,
  variant_id,
  error_message,
  failed_task_id,
  executed_at
FROM activity_execution_traces
WHERE success = false
ORDER BY executed_at DESC
LIMIT 10;

-- Vessel utilization
SELECT
  count() as total_vessels,
  math::sum(IF status = 'executing' THEN 1 ELSE 0 END) as executing,
  math::sum(IF status = 'idle' THEN 1 ELSE 0 END) as idle,
  (math::sum(IF status = 'executing' THEN 1 ELSE 0 END) / count()) * 100 as utilization
FROM vessel_heartbeats
WHERE last_heartbeat >= time::now() - 1m;
```

## Performance Tips

1. **Pagination**: Use limit/offset for large result sets
2. **Filtering**: Filter server-side for better performance
3. **Heartbeat frequency**: 30 seconds is optimal (don't go below 10s)
4. **Trace storage**: Archive old traces to keep table size manageable
5. **Indexes**: Ensure indexes exist on frequently queried fields

## Next Steps

1. Implement MiniBob heartbeat sending
2. Store execution traces after activity completion
3. Test WebSocket real-time updates
4. Add CI integration for variant metrics
5. Implement staging deployment tracking
6. Add Kubernetes API integration for pod metrics
