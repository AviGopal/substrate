# Dashboard Suite - Complete System Visibility

**Three complementary dashboards for monitoring your vessel network**

## Overview

You now have complete visibility into your vessel network through three specialized dashboards:

1. **Terminal Vessel Demo** - Visual demonstrations
2. **Multi-Vessel Dashboard** - Learning progress monitoring
3. **Operational Dashboard** - Real-time operations ⭐ NEW

## 1. Terminal Vessel Demos

**Purpose**: Visual demonstrations of vessel capabilities

**Shows**:
- Deduplication preventing 409 errors
- Self-improvement via template analysis
- Resolver distribution (deterministic vs LLM)

**Run**:
```bash
bun run deduplication-vessel-demo.ts
bun run terminal-vessel-demo.ts
```

**Use Case**: Demonstrations, presentations, proof-of-concept

---

## 2. Multi-Vessel Dashboard

**Purpose**: Monitor Thompson Sampling learning across vessel network

**Shows**:
- Network summary (vessels, executions, success rate)
- Discovered vessels with capabilities
- Top performing activities network-wide
- Thompson Sampling scores (α, β, score)

**Run**:
```bash
./vessel-monitor-live.sh
```

**Data Source**:
- ✅ Real data from Activity API
- ✅ 50+ activity templates
- ✅ Thompson Sampling scores from database
- ⏸️ Discovery-vessel (falls back to direct mode when unavailable)

**Use Case**: Watch learning system evolve, compare activity performance across vessels

**Key Metrics**:
```
Active Vessels:       1 / 1
Network Executions:   0
Avg Success Rate:     100%

Top Activities:
  Heartbeat Demo:       α=1  β=1  score=50%
  Fix Bug Complete:     α=12 β=3  score=80%
```

---

## 3. Operational Dashboard ⭐ NEW

**Purpose**: Real-time operational monitoring of entire system

**Shows**:
- **System Health**: Active vessels, executions (24h), success rate, avg duration, total cost
- **Connected Vessels**: All vessels in org with health status, latency, capabilities
- **Recent Executions**: Last 20 activity runs with success/fail, duration, cost, timestamp
- **Top Performing Activities**: Best activities by Thompson Sampling score

**Run**:
```bash
./run-ops-dashboard.sh
```

**Data Source**:
- ✅ Real execution traces from Activity API
- ✅ Vessel health checks
- ✅ Thompson Sampling scores
- ✅ Cost and performance metrics

**Use Case**: Daily operational monitoring, debugging failures, cost tracking, capacity planning

**Example Output**:
```
🏥 System Health
  Active Vessels:       1 / 1
  Executions (24h):     20
  Success Rate:         ░░░░░░░░░░░░░░░░░░░░ 0%
  Avg Duration:         0ms
  Total Cost:           $0.0000

🌐 Connected Vessels in Your Org
●  Activity API        healthy (7ms)  activityExecutionTrace, activityTemplate

⚡ Recent Activity Executions
✗  auth_resolve_v1     0ms      $0.0000      2m ago
✓  fix-failing-test    12.8s    $0.0045      2h ago
✓  check-codebase      45.2s    $0.0012      3h ago

⭐ Top Performing Activities
fix-failing-test       bugfix            12    3  80%
Heartbeat Demo         infrastructure     5    1  83%
```

---

## Comparison Matrix

| Feature | Terminal Demos | Multi-Vessel Dashboard | Operational Dashboard |
|---------|---------------|----------------------|----------------------|
| **Purpose** | Demonstrations | Learning monitoring | Operations monitoring |
| **Data** | Static/scripted | Real Thompson scores | Real executions + health |
| **Refresh** | One-time | 10 seconds | 5 seconds |
| **Vessels** | N/A | All discovered | All in org |
| **Executions** | ✗ | Aggregated counts | Last 20 detailed |
| **Thompson Scores** | ✗ | ✓ Top 10 | ✓ Top 5 |
| **Health Status** | ✗ | Online/Offline | Health + latency |
| **Costs** | ✗ | ✗ | ✓ Per execution |
| **Duration** | ✗ | ✗ | ✓ Per execution |
| **Use Case** | Demos | Learning progress | Daily ops |

---

## When to Use Each

### Use Terminal Demos When:
- Showing how vessel capabilities work
- Demonstrating deduplication, self-improvement
- Explaining resolver patterns (deterministic vs LLM)
- Presentations and proof-of-concept

### Use Multi-Vessel Dashboard When:
- Monitoring Thompson Sampling evolution
- Comparing activity performance across vessels
- Watching learning system improve over time
- Identifying best-performing templates network-wide

### Use Operational Dashboard When:
- Daily operational monitoring (always-on)
- Debugging failed executions
- Tracking costs and performance
- Monitoring system health
- Capacity planning
- Investigating recent issues

---

## What's Currently Missing

The operational dashboard provides excellent visibility into:
- ✅ Recent executions (last 24h)
- ✅ Vessel health
- ✅ Performance metrics

But **not yet** available:
- ⏸️ **Currently running activities** (in-progress executions)
- ⏸️ **Impulse state space** (loaded vs unloaded impulses, memory usage)
- ⏸️ **Real-time streaming** (WebSocket updates during execution)

### Why Not Real-Time Running Activities?

MiniBob vessels currently:
1. Execute activities
2. Complete and store traces in Activity API
3. Don't expose "currently executing" endpoint

To add real-time status, we would need:

**Option 1: WebSocket Streaming**
```typescript
// In MiniBob
const ws = new WebSocket('/activity-status');
ws.send({ status: 'running', activity: 'fix-bug', task: 2 });

// In Dashboard
const stream = await fetch('http://minibob:8080/activity-stream');
for await (const update of stream.body) {
  displayProgress(update);
}
```

**Option 2: Status Endpoint**
```typescript
// Add to MiniBob server
app.get('/status', (c) => {
  return c.json({
    currentActivity: goalProcessor.getCurrentActivity(),
    currentTask: goalProcessor.getCurrentTask(),
    progress: goalProcessor.getProgress(),
  });
});
```

**Current Workaround**:
- Dashboard shows "Recent Executions"
- Execution from "2s ago" = Just finished
- Execution from "now" = Actively working
- Frequent refreshes catch in-progress work

---

## Impulse State Space Visibility

**What's Available Now**:
- Execution traces include impulse metadata
- Can see which impulses were used
- Resolution latency in traces

**Not Yet Visible**:
- Which impulses are currently loaded in memory
- Memory usage per impulse
- Load/unload events
- Cache hit/miss ratios

**To Add**:
```typescript
// MiniBob impulse state endpoint
app.get('/impulses/state', (c) => {
  return c.json({
    loaded: memoryAgent.getLoadedImpulses(),
    unloaded: memoryAgent.getUnloadedImpulses(),
    totalMemory: memoryAgent.getTotalMemoryUsage(),
    cacheHitRate: memoryAgent.getCacheHitRate(),
  });
});
```

Then display in dashboard:
```
📦 Impulse State Space
Loaded:     45 / 100 impulses
Memory:     12.5 MB / 50 MB
Cache Hit:  78%
```

---

## Roadmap

### Phase 1: Current State ✅
- ✅ Terminal demos working
- ✅ Multi-vessel dashboard with real data
- ✅ Operational dashboard with executions and health

### Phase 2: Real-Time Status (Next)
- ⏸️ Add `/status` endpoint to MiniBob
- ⏸️ Display currently running activities
- ⏸️ Show task-level progress (task 2/5)
- ⏸️ Estimated time remaining

### Phase 3: Impulse Visibility
- ⏸️ Add `/impulses/state` endpoint
- ⏸️ Display loaded vs unloaded impulses
- ⏸️ Memory usage tracking
- ⏸️ Cache hit/miss visualization

### Phase 4: Advanced Features
- ⏸️ WebSocket streaming for real-time updates
- ⏸️ Historical trend charts
- ⏸️ Alerting (Slack/email on failures)
- ⏸️ Prometheus metrics export

---

## Quick Reference

**Run all dashboards**:
```bash
# Terminal demo (deduplication)
bun run deduplication-vessel-demo.ts

# Multi-vessel (learning monitoring)
./vessel-monitor-live.sh

# Operational (real-time ops)
./run-ops-dashboard.sh
```

**Configuration**:
```bash
# Set in ~/.metabob/config.json or export
export ACTIVITY_API_URL="http://activity.metabob.local"
export METABOB_API_KEY="your-key"
export DISCOVERY_VESSEL_ENDPOINT="http://discovery:8080"
```

**Documentation**:
- `RUNNING_LIVE_DASHBOARD.md` - Multi-vessel dashboard guide
- `OPERATIONAL_DASHBOARD_GUIDE.md` - Ops dashboard complete guide
- `README_COMPLETE.md` - Full demo suite overview

---

## Summary

You now have **complete visibility** into your vessel network:

✅ **Demonstrations** via terminal vessel demos
✅ **Learning Progress** via multi-vessel dashboard
✅ **Operational Health** via operational dashboard

All three dashboards:
- Use **real data** from Activity API
- Work with local Kubernetes cluster
- Auto-refresh for live updates
- Production-ready for daily use

The operational dashboard fills the gap for real-time system monitoring, showing:
- What vessels are connected
- What activities have been running
- How the system is performing
- Where costs are accumulating

**Next Step**: Run some activities through MiniBob to populate the dashboards with more data and watch the Thompson Sampling scores evolve!

---

**Created**: 2026-04-19
**Status**: Production-ready
**Purpose**: Complete vessel network visibility suite
**Tech**: TypeScript + Bun + React (Ink) + Activity API
