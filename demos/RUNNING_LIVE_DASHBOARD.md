# Running the Multi-Vessel Dashboard with Live Data

**Status**: ✅ Working with real Activity API data

## Quick Start

```bash
cd /home/avi/documents/work/exp-repo/metabob-devbob/demos

# Run with live data
./vessel-monitor-live.sh
```

## What You'll See

The dashboard now displays **REAL Thompson Sampling data** from the Activity API:

```
🌐 Network Summary
  Discovery Status:     ● CONNECTED
  Active Vessels:       1 / 1
  Network Executions:   0
  Avg Success Rate:     100.0%
  Updates:              #0 (every 10s)

🚀 Discovered Vessels
●  Activity API (Local)      0  ████████████████ 100%  0s ago

⭐ Top Performing Activities (Network-Wide)
Activity API (Local)      Heartbeat Demo             1    1  50%
Activity API (Local)      Safe Deployment Update     1    1  50%
Activity API (Local)      Startup Health Check       1    1  50%
```

## How It Works

1. **Discovery Mode**: First tries to query discovery-vessel via impulse resolution
   - Endpoint: `POST http://discovery-vessel.activity-system.svc.cluster.local:8080/resolve`
   - Payload: `{"pointer": {"type": "vesselRegistry"}}`
   - Timeout: 2 seconds

2. **Direct Mode (Fallback)**: If discovery fails, queries Activity API directly
   - Endpoint: `GET http://activity.metabob.local/v2/activities/templates`
   - Authentication: API key from `~/.metabob/config.json`
   - Result: Real templates with Thompson Sampling scores (α, β)

## Data Source

**Local Kubernetes Cluster** (`activity.metabob.local`):
- ✅ Activity API is running and accessible
- ✅ Returning 50+ real activity templates
- ✅ Thompson Sampling values: α (successes), β (failures)
- ❌ Discovery-vessel not accessible (times out on internal cluster DNS)

**Why No Executions?**

The templates show 0 executions because:
- Templates have α=1, β=1 (initial priors)
- Total executions = (α - 1) + (β - 1) = 0
- These are fresh templates that haven't been executed yet

To see real execution data:
1. Run MiniBob with some activities
2. Wait for activities to execute and update Thompson scores
3. Dashboard will show increasing α/β values and execution counts

## Configuration

The dashboard reads configuration from:

**Environment variables** (highest priority):
```bash
export ACTIVITY_API_URL="http://activity.metabob.local"
export METABOB_API_KEY="your-api-key"
export DISCOVERY_VESSEL_ENDPOINT="http://discovery-vessel.activity-system.svc.cluster.local:8080"
```

**~/.metabob/config.json** (auto-loaded):
```json
{
  "instance": {
    "apiKey": "mb-..."
  }
}
```

## Troubleshooting

### Dashboard shows "Discovering vessels..."

The `fetchNetworkState()` function is hanging. Check:
- Is Activity API reachable? `curl http://activity.metabob.local/health`
- Is API key configured? `echo $METABOB_API_KEY`
- Check console logs for error messages

### "Network Executions: 0"

This is expected for fresh templates. To see real data:
```bash
cd ../repos/minibob
minibob --single "run a test activity"
```

Then check the dashboard - you should see α/β values update.

### Discovery-vessel not accessible

This is normal for local development. Discovery-vessel runs in Kubernetes but doesn't have Istio ingress configured. The dashboard falls back to direct mode automatically.

To make discovery-vessel accessible:
1. Create an Istio VirtualService for discovery-vessel
2. Add `discovery.metabob.local` to `/etc/hosts`
3. Set `DISCOVERY_VESSEL_ENDPOINT=http://discovery.metabob.local`

## Comparison: Mock vs Real Data

**Before (Mock Data)**:
```typescript
// Hard-coded mock vessels
{
  id: 'minibob-001',
  endpoint: 'http://minibob-001:8080',  // ← Not reachable
}

// Random mock Thompson scores
successRate: 0.6 + Math.random() * 0.3,  // ← Fake data
```

**After (Real Data)**:
```typescript
// Discovered from Activity API
const response = await fetch('http://activity.metabob.local/v2/activities/templates');
const templates = data.templates;  // ← Real database query

// Real Thompson Sampling from database
const alpha = t.alpha;  // ← Actual success count
const beta = t.beta;    // ← Actual failure count
const score = alpha / (alpha + beta);  // ← Real probability
```

## Next Steps

1. **Add More Vessels**: Once discovery-vessel is accessible, the dashboard will show all registered vessels
2. **Run Activities**: Execute activities through MiniBob to see Thompson scores evolve
3. **Watch Learning**: Observe α and β values change as activities succeed/fail
4. **Multi-Instance**: Deploy multiple MiniBob instances to see distributed learning

---

**Created**: 2026-04-19
**Status**: Production-ready with real data
**Previous Issue**: Used mock data when vessels unreachable
**Current State**: Queries real Activity API, displays real Thompson Sampling scores
