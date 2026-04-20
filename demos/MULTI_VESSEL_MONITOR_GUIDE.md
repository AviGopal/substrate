#Multi-Vessel Network Monitor - Complete Guide

**Self-contained vessel that discovers and monitors the entire vessel network**

## Overview

The Multi-Vessel Monitor is a **self-contained vessel** that:
- Discovers all vessels via discovery-vessel
- Queries each vessel's learning state
- Displays network-wide Thompson Sampling metrics
- Shows cross-vessel activity execution
- Visualizes distributed learning in real-time

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  Multi-Vessel Monitor (This Vessel)                        │
│  ┌───────────────────────────────────────────────────────┐ │
│  │  React Terminal UI (Ink)                              │ │
│  └───────────────────────────────────────────────────────┘ │
│                          ↓                                  │
│  ┌───────────────────────────────────────────────────────┐ │
│  │  Vessel Discovery Client                              │ │
│  │  • Query discovery-vessel for vessel list             │ │
│  │  • Get vessel endpoints and capabilities              │ │
│  └───────────────────────────────────────────────────────┘ │
│                          ↓                                  │
│  ┌───────────────────────────────────────────────────────┐ │
│  │  State Aggregator                                     │ │
│  │  • Query each vessel in parallel                      │ │
│  │  • Fetch Thompson scores                              │ │
│  │  • Calculate network metrics                          │ │
│  └───────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│  Vessel Network                                             │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  │
│  │ MiniBob  │  │Activity  │  │Analysis  │  │Discovery │  │
│  │   #1     │  │   API    │  │   API    │  │  Vessel  │  │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘  │
└─────────────────────────────────────────────────────────────┘
```

## Quick Start

### Method 1: Local Execution

```bash
cd /home/avi/documents/work/exp-repo/metabob-devbob/demos

# Install dependencies (one-time)
bun install

# Run the monitor
./vessel-monitor.sh
```

### Method 2: Docker Container

```bash
# Build the container
docker build -f Dockerfile.vessel-monitor -t vessel-monitor:latest .

# Run locally
docker run --rm -it \
  -e DISCOVERY_VESSEL_ENDPOINT=http://discovery:8080 \
  -e METABOB_API_KEY=your-key \
  vessel-monitor:latest

# Run in network mode (can reach other containers)
docker run --rm -it --network=host vessel-monitor:latest
```

### Method 3: Kubernetes Deployment

```bash
# Build and load image
docker build -f Dockerfile.vessel-monitor -t vessel-monitor:latest .
kubectl load docker-image vessel-monitor:latest  # For local k8s

# Deploy to cluster
kubectl apply -f vessel-monitor-deployment.yaml

# View logs
kubectl logs -f -n activity-system deployment/vessel-monitor

# Port forward to access locally
kubectl port-forward -n activity-system deployment/vessel-monitor 8080:8080
```

## What It Shows

### 1. Network Summary

```
🌐 Network Summary
  Discovery Status:     ● CONNECTED
  Active Vessels:       4 / 4
  Network Executions:   156
  Avg Success Rate:     78.5%
  Updates:              #12 (every 10s)
```

- **Discovery Status**: Connected to discovery-vessel or offline
- **Active Vessels**: Vessels responding / total discovered
- **Network Executions**: Total executions across all vessels
- **Avg Success Rate**: Network-wide success rate

### 2. Discovered Vessels

```
🚀 Discovered Vessels
Status  Vessel Name              Exec    Success Rate        Last Activity
─────────────────────────────────────────────────────────────────────────
●       MiniBob Instance 1         45    ███████████████░ 75%    2m ago
●       Activity API              89    ████████████████░ 80%    1m ago
●       Analysis API              22    ████████████░░░░░ 60%    5m ago
○       Discovery Vessel           0    ░░░░░░░░░░░░░░░░░  0%    --
```

- **Status**: ● online / ○ offline
- **Vessel Name**: Human-readable vessel identifier
- **Exec**: Total executions on this vessel
- **Success Rate**: Visual bar + percentage
- **Last Activity**: Time since last execution

### 3. Top Performing Activities (Network-Wide)

```
⭐ Top Performing Activities (Network-Wide)
Vessel                    Activity                 α    β    Score
────────────────────────────────────────────────────────────────────
MiniBob Instance 1        terminal-vessel-demo     8    1    89%
Activity API              store-execution-trace   15    2    88%
MiniBob Instance 1        fix-bug-complete        12    3    80%
Analysis API              problem-detection       10    3    77%
```

Shows best-performing activities across ALL vessels, sorted by Thompson score.

### 4. Vessel Capabilities

```
🔧 Vessel Capabilities (Advertised Shapes)
● MiniBob Instance 1
  file, memo, directoryTree, gitDiff
  Endpoint: http://minibob-001:8080

● Activity API
  activityExecutionTrace, activityTemplate, activityMetrics
  Endpoint: https://activity.metabob.com
```

Shows what data types each vessel can resolve.

## Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `DISCOVERY_VESSEL_ENDPOINT` | `http://discovery-vessel.activity-system.svc.cluster.local:8080` | Discovery service URL |
| `ACTIVITY_API_URL` | `https://activity.metabob.com` | Activity API for querying templates |
| `METABOB_API_KEY` | (none) | API key for authenticated queries |
| `REFRESH_INTERVAL` | 10000 (10s) | Update interval in milliseconds |

### Configuration File

Create `demos/.env`:
```bash
DISCOVERY_VESSEL_ENDPOINT=http://discovery:8080
ACTIVITY_API_URL=https://activity.metabob.com
METABOB_API_KEY=your-api-key-here
```

Then run:
```bash
source demos/.env
./vessel-monitor.sh
```

## How It Works

### Discovery Flow

```
1. Monitor starts
   ↓
2. Query discovery-vessel: GET /vessels
   ↓
3. Receive vessel list with endpoints
   ↓
4. For each vessel in parallel:
   ↓
5. Query vessel: GET /v2/activities/templates
   ↓
6. Parse Thompson scores (α, β)
   ↓
7. Calculate metrics
   ↓
8. Aggregate network state
   ↓
9. Render to terminal
   ↓
10. Wait 10 seconds
   ↓
11. Repeat from step 2
```

### Fault Tolerance

**Discovery Unavailable:**
- Falls back to mock vessel list
- Shows "● OFFLINE" status
- Continues monitoring with cached data

**Vessel Unavailable:**
- Marks vessel as offline (○)
- Excludes from network metrics
- Retries on next refresh

**API Key Missing:**
- Queries work for public endpoints
- Authenticated endpoints return mock data
- Dashboard shows warning

## Deployment Scenarios

### Scenario 1: Local Development

```bash
# Terminal 1: Run MiniBob
cd repos/minibob
bun run index.ts

# Terminal 2: Run monitor
cd demos
./vessel-monitor.sh
```

Watch monitor update as MiniBob executes activities.

### Scenario 2: Kubernetes Cluster

```bash
# Deploy monitor as a pod
kubectl apply -f vessel-monitor-deployment.yaml

# Access via port-forward
kubectl port-forward -n activity-system deployment/vessel-monitor 8080:8080

# Or exec into pod for terminal view
kubectl exec -it -n activity-system deployment/vessel-monitor -- bun run multi-vessel-dashboard.tsx
```

### Scenario 3: Docker Compose

Create `docker-compose.yml`:
```yaml
version: '3.8'
services:
  vessel-monitor:
    build:
      context: .
      dockerfile: Dockerfile.vessel-monitor
    environment:
      DISCOVERY_VESSEL_ENDPOINT: http://discovery:8080
      ACTIVITY_API_URL: http://activity-api:8080
    networks:
      - vessel-network

  discovery:
    image: discovery-vessel:latest
    ports:
      - "8080:8080"
    networks:
      - vessel-network

networks:
  vessel-network:
```

Run:
```bash
docker-compose up vessel-monitor
```

## Building a Self-Contained Binary

Use Bun's compiler to create a standalone executable:

```bash
# Compile to binary
bun build multi-vessel-dashboard.tsx --compile --outfile vessel-monitor

# Run the binary (no Bun required!)
./vessel-monitor
```

This creates a **truly self-contained** vessel monitor that:
- Includes Bun runtime
- No dependencies needed
- Single executable file
- ~90MB (compressed)

## Integration with Vessel Network

### Register as a Vessel

The monitor can register itself with discovery-vessel:

```typescript
// Add to multi-vessel-dashboard.tsx
await fetch(`${DISCOVERY_ENDPOINT}/register`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    id: 'vessel-monitor',
    name: 'Network Monitor',
    endpoint: 'http://vessel-monitor:8080',
    shapes: ['network_state', 'vessel_metrics'],
  }),
});
```

Now other vessels can query the monitor for network state!

### Expose HTTP Endpoint

Add an HTTP server to serve network state:

```typescript
import { serve } from 'bun';

serve({
  port: 8080,
  fetch(req) {
    if (req.url.endsWith('/state')) {
      return Response.json({
        vessels: state.vessels,
        totalExecutions: state.totalExecutions,
        avgSuccessRate: state.avgSuccessRate,
      });
    }
    return new Response('Vessel Monitor', { status: 200 });
  },
});
```

## Troubleshooting

### No Vessels Discovered

**Symptoms:**
```
Active Vessels: 0 / 0
Discovery Status: ● OFFLINE
```

**Solutions:**
1. Check discovery endpoint: `curl $DISCOVERY_VESSEL_ENDPOINT/health`
2. Verify network connectivity
3. Check if discovery-vessel is running: `kubectl get pods -n activity-system`

### Permission Denied Errors

**Symptoms:**
```
Error querying vessel: HTTP 401 Unauthorized
```

**Solutions:**
1. Set `METABOB_API_KEY` environment variable
2. Check API key validity
3. Ensure vessel allows anonymous queries for public endpoints

### React/Ink Rendering Issues

**Symptoms:**
```
Terminal shows garbled characters or no output
```

**Solutions:**
1. Ensure terminal supports ANSI colors: `echo $TERM`
2. Try different terminal emulator
3. Run in Docker with `--tty` flag: `docker run -it vessel-monitor`

## Advanced Features

### Add Custom Metrics

```typescript
// Add to NetworkState interface
interface NetworkState {
  // ... existing fields
  deterministicRatio: number;
  totalCost: number;
}

// Calculate in fetchNetworkState()
const deterministicRatio = calculateDeterministicRatio(vessels);
const totalCost = calculateTotalCost(vesselStates);

// Display in dashboard
<Text>Deterministic Ratio: {(state.deterministicRatio * 100).toFixed(0)}%</Text>
<Text>Total Network Cost: ${state.totalCost.toFixed(2)}</Text>
```

### Add Alerting

```typescript
// Monitor for issues
if (state.avgSuccessRate < 0.5) {
  console.error('⚠ ALERT: Network success rate below 50%');
  await sendAlert('Low success rate detected');
}

if (state.activeVessels < state.vessels.length * 0.5) {
  console.error('⚠ ALERT: More than 50% vessels offline');
}
```

### Export Metrics

```typescript
// Add Prometheus metrics
import { Counter, Gauge, Registry } from 'prom-client';

const registry = new Registry();
const execCounter = new Counter({
  name: 'vessel_executions_total',
  help: 'Total executions across network',
  registers: [registry],
});

// Update on each refresh
execCounter.inc(state.totalExecutions);

// Serve metrics
serve({
  port: 9090,
  fetch() {
    return new Response(registry.metrics(), {
      headers: { 'Content-Type': registry.contentType },
    });
  },
});
```

## Key Takeaways

✓ **Self-contained** - Single vessel, no complex setup

✓ **Network-aware** - Discovers and monitors all vessels

✓ **Real-time** - Live updates every 10 seconds

✓ **Fault-tolerant** - Graceful degradation when vessels offline

✓ **Visual** - React-rendered terminal UI with colors and charts

✓ **Distributed** - Shows learning state across entire network

✓ **Observable** - See Thompson Sampling evolve network-wide

✓ **Deployable** - Docker, Kubernetes, or standalone binary

✓ **Composable** - Can be queried by other vessels

---

**Created**: 2026-04-18
**Purpose**: Monitor distributed vessel network learning state
**Tech**: React (Ink) + Discovery Client + Multi-Vessel State Aggregation
**Status**: Ready to deploy
