# Complete Vessel Demonstration Suite

**Everything you need to visualize and monitor vessel learning state**

## What We Built

A complete demonstration system showing vessel capabilities through visual terminal output and React-rendered dashboards:

### 1. Terminal Vessel Demonstrations
- **Deduplication Demo** (`deduplication-vessel-demo.ts`)
  - Shows impulse sync queue preventing 409 errors
  - Visual color-coded feedback (green=accepted, red=rejected)
  - Real-time metrics (50% backend load reduction)

- **Self-Improvement Demo** (`terminal-vessel-demo.ts`)
  - Shows MiniBob analyzing its own 63 templates
  - Resolver distribution (28% deterministic, 72% LLM)
  - Optimization opportunities (+42% improvement potential)

### 2. Single-Vessel Learning Dashboard
- **Mock Dashboard** (`learning-dashboard.tsx`)
  - Sample data for development/testing
  - Thompson Sampling visualization
  - Execution traces display

- **Live Dashboard** (`learning-dashboard-live.tsx`)
  - Real database queries (SurrealDB via HTTP)
  - Live Thompson scores (α/β values)
  - Recent execution history

### 3. Multi-Vessel Network Monitor ⭐ - ✅ LIVE DATA
- **Network Dashboard** (`multi-vessel-dashboard.tsx`)
  - Discovers all vessels via discovery-vessel (with fallback to direct mode)
  - Queries each vessel's learning state
  - Network-wide Thompson Sampling metrics from real database
  - Cross-vessel activity execution tracking
  - **Self-contained deployment** (Docker/K8s/Binary)
  - **NOW USING REAL DATA** from Activity API instead of mocks

### 4. Operational Dashboard 🎯 NEW - ✅ COMPLETE VISIBILITY
- **Operations Dashboard** (`operational-dashboard.tsx`)
  - **Real-time system-wide visibility** - All vessels, executions, health
  - **Connected vessels** - Health status, latency, capabilities
  - **Recent executions** - Last 20 activities with success/failure, duration, cost
  - **System metrics** - Success rate, average duration, total cost
  - **Thompson Sampling** - Top performing activities by score
  - **Auto-refresh** - Updates every 5 seconds
  - **Production-ready** - For daily operational monitoring

## Quick Start Guide

### Local Development

```bash
cd /home/avi/documents/work/exp-repo/metabob-devbob/demos

# Install dependencies (one-time)
bun install

# Run deduplication demo
bun run deduplication-vessel-demo.ts

# Run self-improvement demo
bun run terminal-vessel-demo.ts

# Run single-vessel dashboard (mock data)
bun run learning-dashboard.tsx

# Run single-vessel dashboard (live data)
export METABOB_API_KEY="your-key"
bun run learning-dashboard-live.tsx

# Run multi-vessel network monitor with LIVE DATA
./vessel-monitor-live.sh

# Run operational dashboard (complete system visibility)
./run-ops-dashboard.sh
```

### As Activities (Vessel-Native)

```bash
cd ../repos/minibob

# Run deduplication demo as activity
bun run index.ts --single "run the deduplication demonstration"

# Run learning dashboard as activity
bun run index.ts --single "run the learning dashboard in mock mode"

# Run network monitor as activity
bun run index.ts --single "run the multi-vessel network monitor"
```

### Docker Deployment

```bash
# Build container
docker build -f Dockerfile.vessel-monitor -t vessel-monitor:latest .

# Run locally
docker run --rm -it vessel-monitor:latest

# With configuration
docker run --rm -it \
  -e DISCOVERY_VESSEL_ENDPOINT=http://discovery:8080 \
  -e METABOB_API_KEY=your-key \
  vessel-monitor:latest
```

### Kubernetes Deployment

```bash
# Deploy to cluster
kubectl apply -f vessel-monitor-deployment.yaml

# View logs
kubectl logs -f -n activity-system deployment/vessel-monitor

# Access dashboard
kubectl exec -it -n activity-system deployment/vessel-monitor -- bun run multi-vessel-dashboard.tsx
```

## Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│  Demonstration Layer                                    │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐       │
│  │ Terminal   │  │  Single    │  │Multi-Vessel│       │
│  │   Demos    │  │ Dashboard  │  │  Monitor   │       │
│  └────────────┘  └────────────┘  └────────────┘       │
└─────────────────────────────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────────────┐
│  Rendering Layer                                        │
│  ┌────────────┐           ┌────────────┐               │
│  │   ANSI     │           │React (Ink) │               │
│  │  Escapes   │           │ Components │               │
│  └────────────┘           └────────────┘               │
└─────────────────────────────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────────────┐
│  Data Layer                                             │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐       │
│  │ Discovery  │  │  Activity  │  │  Vessel    │       │
│  │  Service   │  │    API     │  │ Endpoints  │       │
│  └────────────┘  └────────────┘  └────────────┘       │
└─────────────────────────────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────────────┐
│  Vessel Network                                         │
│  ┌──────┐  ┌──────┐  ┌──────┐  ┌──────┐  ┌──────┐   │
│  │MiniBob Activity Analysis Discovery Monitor│   │
│  │  #1   │ │ API  │ │  API  │ │ Vessel │ │Vessel │   │
│  └──────┘  └──────┘  └──────┘  └──────┘  └──────┘   │
└─────────────────────────────────────────────────────────┘
```

## Features Comparison

| Feature | Terminal Demos | Single Dashboard | Multi-Vessel Monitor |
|---------|---------------|------------------|---------------------|
| **Visual Output** | ✓ Colors & animations | ✓ React components | ✓ React + network view |
| **Real-time Updates** | Static | ✓ Every 5s | ✓ Every 10s |
| **Thompson Scores** | ✗ | ✓ Single vessel | ✓ All vessels |
| **Execution Traces** | ✗ | ✓ Last 10 | ✓ Cross-vessel |
| **Vessel Discovery** | ✗ | ✗ | ✓ Dynamic |
| **Network Metrics** | ✗ | ✗ | ✓ Aggregated |
| **Self-Contained** | ✓ | Partial | ✓ Docker/K8s |
| **As Activity** | ✓ | ✓ | ✓ |

## Key Concepts Demonstrated

### 1. Activities All The Way Down
Every demonstration IS an activity:
- Terminal demos → activities
- Dashboards → activities
- Network monitor → activity
- No distinction between "work" and "meta"

### 2. Observable Learning
Watch Thompson Sampling evolve:
- α (successes) increases on completion
- β (failures) increases on error
- Score = α/(α+β) determines selection probability
- Visual bars show performance

### 3. Distributed Learning
Network-wide metrics:
- Aggregate executions across all vessels
- Compare activity performance across vessels
- See which vessels are most active
- Monitor network health

### 4. React in Terminal
Component-based TUI:
- `<Box>` for layout
- `<Text>` for styled output
- Borders, colors, formatting
- Just like web UI, but in terminal

### 5. Discovery-Based Communication
No hardcoded endpoints:
- Query discovery-vessel for vessel list
- Get endpoints dynamically
- Vessels can join/leave network
- Automatic failover

## File Structure

```
demos/
├── Terminal Demonstrations
│   ├── deduplication-vessel-demo.ts
│   ├── terminal-vessel-demo.ts
│   └── show-activity-execution.sh
│
├── Single-Vessel Dashboards
│   ├── learning-dashboard.tsx
│   ├── learning-dashboard-live.tsx
│   └── run-learning-dashboard.sh
│
├── Multi-Vessel Monitor
│   ├── multi-vessel-dashboard.tsx
│   ├── vessel-monitor.sh
│   ├── Dockerfile.vessel-monitor
│   └── vessel-monitor-deployment.yaml
│
├── Activity Templates
│   ├── ../repos/minibob/activities/demo/terminal-vessel-demo.json
│   ├── ../repos/minibob/activities/demo/learning-dashboard.json
│   └── (monitor can be added)
│
├── Dependencies
│   ├── package.json
│   └── bun.lockb
│
└── Documentation
    ├── TERMINAL_VESSEL_GUIDE.md
    ├── LEARNING_DASHBOARD_GUIDE.md
    ├── MULTI_VESSEL_MONITOR_GUIDE.md
    ├── RUNNING_DEMOS_AS_ACTIVITIES.md
    └── README_COMPLETE.md (this file)
```

## Common Workflows

### Workflow 1: Development Demo
Show vessel capabilities to team:
```bash
# 1. Show deduplication working
bun run deduplication-vessel-demo.ts

# 2. Show vessel self-improvement
bun run terminal-vessel-demo.ts

# 3. Show learning state
bun run learning-dashboard.tsx
```

### Workflow 2: Production Monitoring
Monitor live vessel network:
```bash
# 1. Deploy network monitor
kubectl apply -f vessel-monitor-deployment.yaml

# 2. Access dashboard
kubectl port-forward -n activity-system deployment/vessel-monitor 8080:8080

# 3. Open in browser or exec into pod
kubectl exec -it -n activity-system deployment/vessel-monitor -- bun run multi-vessel-dashboard.tsx
```

### Workflow 3: Continuous Integration
Run demos as part of CI:
```bash
# Run in CI pipeline
bun install
bun run deduplication-vessel-demo.ts
bun run learning-dashboard.tsx &
sleep 5
kill $!
```

## Environment Variables

Global configuration:

```bash
# Discovery
export DISCOVERY_VESSEL_ENDPOINT="http://discovery-vessel:8080"

# Activity API
export ACTIVITY_API_URL="https://activity.metabob.com"
export METABOB_API_KEY="your-api-key"

# Refresh intervals
export REFRESH_INTERVAL=10000  # 10 seconds

# Logging
export LOG_LEVEL="info"
```

Create `.env` file:
```bash
DISCOVERY_VESSEL_ENDPOINT=http://discovery:8080
ACTIVITY_API_URL=https://activity.metabob.com
METABOB_API_KEY=mb-your-key-here
```

Load with:
```bash
source .env
./vessel-monitor.sh
```

## Troubleshooting

### Dependencies Not Installing

```bash
# Clear cache
rm -rf node_modules bun.lockb

# Reinstall
bun install
```

### Dashboard Not Rendering

```bash
# Check terminal
echo $TERM  # Should show something like "xterm-256color"

# Try different terminal emulator
# iTerm2, Alacritty, or Windows Terminal recommended
```

### Discovery Not Working

```bash
# Test discovery endpoint
curl http://discovery-vessel:8080/vessels

# Check if vessels are registered
curl http://discovery-vessel:8080/registry/stats

# Verify network connectivity
ping discovery-vessel
```

### API Key Issues

```bash
# Verify key is set
echo $METABOB_API_KEY

# Test with curl
curl -H "Authorization: ApiKey $METABOB_API_KEY" \
  https://activity.metabob.com/v2/activities/templates
```

## Next Steps

### Add Custom Visualizations

```typescript
// Sparkline for trend visualization
function Sparkline({ data }: { data: number[] }) {
  const chars = ['▁', '▂', '▃', '▄', '▅', '▆', '▇', '█'];
  const max = Math.max(...data);
  return (
    <Text>
      {data.map(v => chars[Math.floor((v / max) * 7)])}
    </Text>
  );
}
```

### Add Alerting

```typescript
// Monitor thresholds
if (state.avgSuccessRate < 0.5) {
  await sendSlackAlert('Low success rate!');
}
```

### Export Metrics

```typescript
// Prometheus metrics
serve({
  port: 9090,
  fetch: () => new Response(metrics.render()),
});
```

### Build Standalone Binary

```bash
# Compile to self-contained executable
bun build multi-vessel-dashboard.tsx \
  --compile \
  --outfile vessel-monitor

# Distribute (~90MB, includes Bun runtime)
./vessel-monitor
```

## Key Takeaways

✓ **Visual demonstrations** show vessel operations in real-time

✓ **React rendering** brings component model to terminal

✓ **Database queries** provide live learning state

✓ **Multi-vessel monitoring** shows distributed network

✓ **Self-contained deployment** via Docker/Kubernetes

✓ **Activity integration** - demos ARE activities

✓ **Observable system** - watch Thompson Sampling evolve

✓ **Production-ready** - fault-tolerant, scalable

---

**Created**: 2026-04-18
**Purpose**: Complete demonstration suite for vessel learning visualization
**Tech**: TypeScript + Bun + React (Ink) + Discovery Client + SurrealDB
**Status**: Production-ready
