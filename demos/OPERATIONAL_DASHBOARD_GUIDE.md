# Operational Dashboard - Complete System Visibility

**Real-time view of your entire vessel network, activity executions, and system health**

## What You Get

The operational dashboard provides complete visibility into:

1. **System Health Metrics**
   - Active vessels vs total vessels
   - Execution count (last 24 hours)
   - Overall success rate
   - Average execution duration
   - Total cost

2. **Connected Vessels**
   - All vessels registered in your org
   - Real-time health status
   - Response latency
   - Advertised capabilities (shapes)

3. **Recent Activity Executions**
   - Last 20 executions across all vessels
   - Success/failure status
   - Duration and cost per execution
   - When each execution ran

4. **Top Performing Activities**
   - Best activities by Thompson Sampling score
   - Alpha (successes) and Beta (failures)
   - Category classification

## Quick Start

```bash
cd /home/avi/documents/work/exp-repo/metabob-devbob/demos

# Run the operational dashboard
./run-ops-dashboard.sh
```

## What You'll See

```
╔═══════════════════════════════════════════════════════════════════╗
║         Operational Dashboard - System-Wide Visibility           ║
╚═══════════════════════════════════════════════════════════════════╝

🏥 System Health
  Active Vessels:       1 / 1
  Executions (24h):     20
  Success Rate:         ░░░░░░░░░░░░░░░░░░░░ 0%
  Avg Duration:         0ms
  Total Cost:           $0.0000
  Last Update:          10:59:12 PM (#2)

🌐 Connected Vessels in Your Org
Status  Vessel Name                    Health      Capabilities
─────────────────────────────────────────────────────────────────────
●  Activity API                    healthy (7ms)  activityExecutionTrace,
                                                  activityTemplate,
                                                  activityMetrics

⚡ Recent Activity Executions
Status   Activity ID                  Duration    Cost        When
─────────────────────────────────────────────────────────────────────
✗  auth_resolve_v1                0ms         $0.0000      2m ago
✗  auth_resolve_v1                0ms         $0.0000      1d ago
✓  check-codebase-health          45.2s       $0.0012      3h ago
✓  fix-failing-test               12.8s       $0.0045      2h ago

⭐ Top Performing Activities (Thompson Sampling)
Activity Name                   Category          α    β     Score
─────────────────────────────────────────────────────────────────────
Heartbeat Demo                infrastructure    5    1  83%
fix-failing-test              bugfix           12    3  80%
Safe Deployment Update        infrastructure    4    2  67%
```

## Understanding the Data

### System Health Section

**Active Vessels**: How many vessels are currently online and responding to health checks
- ● Green = Healthy and responsive
- ○ Red = Offline or unresponsive

**Executions (24h)**: Total number of activity executions in the last 24 hours
- Includes both successful and failed executions
- Refreshes in real-time

**Success Rate**: Percentage of successful executions
- Green bar (>80%) = Healthy system
- Yellow bar (50-80%) = Some issues
- Red bar (<50%) = Many failures

**Avg Duration**: Average time per execution
- Lower is better for most activities
- Useful for spotting performance degradation

**Total Cost**: Sum of all execution costs (LLM API costs)
- $0 for deterministic activities (bash, git)
- Costs accumulate for LLM-based activities

### Connected Vessels Section

Shows **all vessels in your org** that are:
1. Registered with discovery-vessel OR
2. Known to the system (like Activity API)

**Health Status**:
- **healthy** - Vessel responding normally
- **degraded** - Slow response times
- **offline** - Not responding

**Latency**: Response time for health check
- <50ms = Excellent
- 50-200ms = Good
- >200ms = Slow (may indicate issues)

**Capabilities**: What impulse types this vessel can resolve
- `file`, `memo` = Local data access
- `activityExecutionTrace` = Learning backend
- `problem_detection` = Code analysis
- `code_review` = Review capabilities

### Recent Executions Section

**Real execution traces** from the last 24 hours:

**Status Icons**:
- ✓ Green = Success
- ✗ Red = Failure

**Activity ID**: The template that was executed
- `auth_resolve_v1` = Authentication activity
- `fix-failing-test` = Bug fix activity
- `check-codebase-health` = Health check

**Duration**: How long the execution took
- 0ms = Deterministic (bash script, no LLM)
- Seconds = LLM reasoning involved
- Minutes = Complex multi-task activities

**Cost**: LLM API costs for this execution
- $0.0000 = Deterministic or cached
- $0.0001-$0.001 = Single LLM call
- $0.001-$0.01 = Multiple LLM calls
- >$0.01 = Complex reasoning

**When**: Time since execution
- "2m ago" = 2 minutes ago
- "1d ago" = 1 day ago

### Top Performing Activities

**Thompson Sampling** learns which activities work best:

**α (Alpha)**: Number of successful executions + 1
- Higher = More successful completions

**β (Beta)**: Number of failed executions + 1
- Higher = More failures

**Score**: Probability of success = α / (α + β)
- 50% = Untested (α=1, β=1)
- >80% = Highly reliable
- <50% = Needs improvement

**Example**:
```
Activity: fix-failing-test
α = 12, β = 3
Score = 12 / (12 + 3) = 80%
Interpretation: Has run 14 times (11 successes, 3 failures)
```

## Use Cases

### 1. Monitor System Health

Watch the dashboard during development to ensure vessels stay healthy:
```bash
./run-ops-dashboard.sh
# Leave running while working
```

### 2. Debug Failed Executions

When you see failures (✗ red), investigate:
1. Note the activity_id
2. Check execution traces in Activity API
3. Look at error messages
4. Fix the activity template

### 3. Track Learning Progress

Watch Thompson scores evolve as activities execute:
- New activities start at 50% (α=1, β=1)
- Successful executions increase α
- Failed executions increase β
- Score stabilizes around actual success rate

### 4. Monitor Costs

Track total_cost to understand LLM API spending:
- Identify expensive activities
- Optimize to use deterministic resolvers
- Budget for LLM usage

### 5. Capacity Planning

Monitor execution counts and durations:
- High execution count → May need more vessel replicas
- Long durations → Activities may be too complex
- Uneven distribution → Load balancing issues

## Configuration

**Environment Variables**:
```bash
export ACTIVITY_API_URL="http://activity.metabob.local"
export DISCOVERY_VESSEL_ENDPOINT="http://discovery-vessel:8080"
export METABOB_API_KEY="your-api-key"
```

**Config File** (`~/.metabob/config.json`):
```json
{
  "instance": {
    "apiKey": "mb-..."
  }
}
```

**Refresh Interval**: Edit `operational-dashboard.tsx`:
```typescript
const REFRESH_INTERVAL = 5000; // 5 seconds (default)
```

## Currently Running Activities

**Important Note**: The current implementation shows **recent executions** (last 24h), not real-time running activities.

### Why?

MiniBob vessels don't currently expose a "currently executing" endpoint. Execution state is:
1. Captured in traces when activities complete
2. Stored in Activity API database
3. Not streamed in real-time during execution

### To Get Real-Time Activity Status

You would need to:

1. **Add WebSocket support** to MiniBob:
   ```typescript
   // In MiniBob server
   const ws = new WebSocket('/activity-status');
   ws.send({ status: 'running', task: 'task-1' });
   ```

2. **Stream execution progress**:
   ```typescript
   // Dashboard subscribes
   const updates = await fetch(`${vessel}/activity-stream`);
   for await (const chunk of updates.body) {
     updateDashboard(chunk);
   }
   ```

3. **Query vessel endpoints** directly:
   ```bash
   curl http://minibob-001:8080/status
   {
     "currentActivity": "fix-bug-complete",
     "currentTask": "task-2-validate-fix",
     "startedAt": "2026-04-19T10:30:00Z"
   }
   ```

### Current Workaround

The dashboard shows the **most recent** executions as a proxy for "what's happening":
- Execution from "2s ago" → Likely just finished
- Execution from "2m ago" → Recent activity
- If you see many executions from "now", vessel is actively working

## Impulse State Space Visibility

**Current State**: The dashboard shows execution traces, which include:
- What impulses were used (in trace metadata)
- Which resolvers executed
- Resolution latency and cost

**Not Yet Visible**:
- Loaded vs unloaded impulses
- Memory usage per impulse
- Impulse resolution cache hit/miss ratios

### To Add Impulse Visibility

Would require:

1. **Impulse State Endpoint** in MiniBob:
   ```typescript
   app.get('/impulses/state', (c) => {
     return c.json({
       loaded: memoryAgent.getLoadedImpulses(),
       unloaded: memoryAgent.getUnloadedImpulses(),
       totalMemory: memoryAgent.getTotalMemoryUsage(),
     });
   });
   ```

2. **Query in Dashboard**:
   ```typescript
   const impulseState = await fetch(`${vessel}/impulses/state`);
   ```

3. **Display Section**:
   ```
   📦 Impulse State Space
   Loaded Impulses:     45 / 100
   Memory Usage:        12.5 MB / 50 MB
   Cache Hit Rate:      78%
   ```

## Extending the Dashboard

### Add Custom Metrics

Edit `operational-dashboard.tsx`:

```typescript
// Fetch custom data
const customMetrics = await fetch(`${ACTIVITY_API}/v2/custom/metrics`);

// Display in dashboard
<Box>
  <Text>Custom Metric: {customMetrics.value}</Text>
</Box>
```

### Add Alerts

```typescript
if (state.successRate < 0.5) {
  console.error('⚠ ALERT: Success rate below 50%!');
  // Send notification
  await sendSlackAlert('Low success rate');
}
```

### Export to Prometheus

```typescript
import { Counter, Gauge, Registry } from 'prom-client';

const executionCounter = new Counter({
  name: 'vessel_executions_total',
  help: 'Total executions',
});

// Serve metrics
serve({
  port: 9090,
  fetch: () => new Response(registry.metrics()),
});
```

## Comparison: Multi-Vessel vs Operational Dashboard

| Feature | Multi-Vessel Dashboard | Operational Dashboard |
|---------|----------------------|----------------------|
| **Focus** | Thompson Sampling learning | System operations |
| **Vessels** | Discovery + aggregate scores | Individual health status |
| **Activities** | Top 10 by score | Recent 20 executions |
| **Metrics** | Learning progress | System health |
| **Refresh** | 10 seconds | 5 seconds |
| **Use Case** | Watch learning evolve | Monitor production |

**Use Both**:
- Operational Dashboard → Daily monitoring
- Multi-Vessel Dashboard → Learning progress

## Troubleshooting

### No Executions Shown

**Symptom**: "Executions (24h): 0"

**Solutions**:
1. Run some activities through MiniBob
2. Check Activity API is accessible
3. Verify API key is valid
4. Check org_id matches

### All Executions Failed

**Symptom**: Success rate 0%, all red ✗

**Common Causes**:
- Auth failures (`auth_resolve_v1`) - These are expected, ignore them
- Template errors - Check activity template JSON
- Missing dependencies - Install required tools
- Network issues - Verify vessel connectivity

### Vessels Show Offline

**Symptom**: ○ Red status indicators

**Solutions**:
1. Check vessel is running: `kubectl get pods -n activity-system`
2. Verify health endpoint: `curl http://vessel:8080/health`
3. Check network connectivity
4. Restart vessel if needed

### High Costs

**Symptom**: Total Cost > $1.00

**Analysis**:
1. Identify expensive activities (highest cost per execution)
2. Check if they use LLM unnecessarily
3. Consider deterministic resolvers (bash, git)
4. Add caching for repeated queries

## Next Steps

1. **Run Activities**: Execute some activities through MiniBob to populate the dashboard with real data
2. **Watch Learning**: Observe Thompson scores evolve as activities succeed/fail
3. **Add Vessels**: Deploy more vessel types to see network growth
4. **Monitor Production**: Keep dashboard running to catch issues early

---

**Created**: 2026-04-19
**Status**: Production-ready
**Purpose**: Real-time operational visibility into vessel network
**Tech**: React (Ink) + Activity API + Discovery Client
