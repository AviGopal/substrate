# Discovery-Vessel Integration Guide

This guide explains how to integrate vessels with discovery-vessel for dynamic service discovery and intelligent routing.

## Table of Contents

- [Overview](#overview)
- [Quick Start](#quick-start)
- [Architecture](#architecture)
- [Integration Patterns](#integration-patterns)
- [Configuration](#configuration)
- [Testing](#testing)
- [Troubleshooting](#troubleshooting)

## Overview

**Discovery-vessel** is the vessel registry that enables:
- **Dynamic service discovery**: Vessels advertise their capabilities (shapes they can resolve)
- **Intelligent routing**: Health scoring + circuit breakers select the best vessel
- **Automatic failover**: If one vessel fails, route to healthy alternatives
- **Gradual rollouts**: Test new vessel versions with production traffic splitting

### Before Discovery-Vessel

```
MiniBob → HTTP call to hardcoded Activity-API endpoint → Resolve impulse
          (single point of failure, no load balancing)
```

### After Discovery-Vessel

```
MiniBob → Query discovery for "activityTemplate" shape
          ↓
       [activity-api-1, activity-api-2, activity-api-3]
          ↓
       Filter by health score (>= 0.3) and circuit state (not OPEN)
          ↓
       Select using Thompson Sampling (health-weighted)
          ↓
       Direct HTTP call to selected vessel
```

## Quick Start

### 1. Install Discovery Client Package

```bash
cd repos/{your-vessel}
bun add @metabob/vessel-discovery-client
```

### 2. Add Discovery Integration

```typescript
import { VesselClient } from '@metabob/vessel-discovery-client';

// Define shapes your vessel can resolve
const shapes = ['activityTemplate', 'activityExecutionTrace', 'activityMetrics'];

// Create discovery client
const discoveryClient = new VesselClient({
  vesselId: `activity-api-${process.env.HOSTNAME}`,
  endpoint: process.env.VESSEL_ENDPOINT || 'http://localhost:8080',
  shapes,
  discoveryEndpoint: process.env.DISCOVERY_VESSEL_ENDPOINT || 'http://discovery-vessel:8080',
  heartbeatInterval: 120000, // 2 minutes
  onRegistrationSuccess: () => {
    console.log('Registered with discovery-vessel');
  },
  onRegistrationFailure: (error) => {
    console.error('Discovery registration failed', error);
  },
});

// Register on startup (async, non-blocking)
await discoveryClient.start();

// Add graceful shutdown
process.on('SIGTERM', async () => {
  await discoveryClient.stop();
  process.exit(0);
});
```

### 3. Update Health Endpoint

```typescript
app.get('/health', async (c) => {
  const discovery = discoveryClient.getStatus();

  return c.json({
    service: 'my-vessel',
    status: 'healthy',
    discovery: {
      enabled: discovery.enabled,
      registered: discovery.registered,
      lastHeartbeat: discovery.lastHeartbeat,
      nextHeartbeat: discovery.nextHeartbeat,
    },
  });
});
```

### 4. Configure Environment

```bash
# Enable discovery
export DISCOVERY_ENABLED=true
export DISCOVERY_VESSEL_ENDPOINT=http://discovery-vessel:8080
export VESSEL_ID=my-vessel-${HOSTNAME}
export VESSEL_ENDPOINT=http://my-vessel:8080

# Shapes (comma-separated)
export VESSEL_SHAPES=shape1,shape2,shape3

# Optional: Heartbeat interval (default: 120000ms = 2min)
export DISCOVERY_HEARTBEAT_INTERVAL_MS=120000
```

## Architecture

### Components

```
┌─────────────┐        ┌──────────────────┐        ┌─────────────┐
│   Vessel    │        │ Discovery-Vessel │        │   Vessel    │
│  (Client)   │        │   (Registry)     │        │  (Client)   │
└─────────────┘        └──────────────────┘        └─────────────┘
      │                         │                         │
      │ 1. POST /register       │                         │
      ├────────────────────────>│                         │
      │    vesselId, endpoint,  │                         │
      │    shapes, ttl          │                         │
      │                         │                         │
      │ 2. 201 Created          │                         │
      │<────────────────────────┤                         │
      │    registration_id      │                         │
      │                         │                         │
      │ 3. POST /heartbeat      │                         │
      ├────────────────────────>│ (every 2 min)           │
      │    (keep TTL alive)     │                         │
      │                         │                         │
      │ 4. POST /resolve        │                         │
      │    { shape: "X" }       │                         │
      ├────────────────────────>│                         │
      │                         │                         │
      │ 5. 200 OK               │                         │
      │<────────────────────────┤                         │
      │ [{ vessel_id, endpoint }]                         │
      │                         │                         │
      │ 6. Direct HTTP call     │                         │
      ├────────────────────────────────────────────────────>│
      │    GET /impulses/resolve│                         │
      │                         │                         │
      │ 7. DELETE /vessels/:id  │                         │
      ├────────────────────────>│ (on shutdown)           │
      │                         │                         │
```

### Data Flow

1. **Startup**: Vessel registers with discovery-vessel
2. **Heartbeat**: Vessel sends heartbeat every 2 minutes to refresh TTL
3. **Discovery**: Other vessels query discovery-vessel for capable vessels
4. **Routing**: Discovery-vessel returns eligible vessels (health + circuit state)
5. **Execution**: Requester calls selected vessel directly
6. **Shutdown**: Vessel deregisters from discovery-vessel

### TTL-Based Expiry

Vessels are automatically removed if they miss heartbeats:

| Event | TTL Remaining |
|-------|---------------|
| **Registration** | 5 minutes |
| **Heartbeat (2 min)** | Reset to 5 minutes |
| **Missed heartbeat** | TTL decreases |
| **TTL expires** | Vessel removed from registry |

## Integration Patterns

### Pattern 1: Standard Integration (Most Vessels)

**Use for**: Activity-API, Analysis-API, User-Vessel, Terminal-Vessel

```typescript
import { VesselClient } from '@metabob/vessel-discovery-client';

// Single client instance (singleton pattern)
export const discoveryClient = new VesselClient({
  vesselId: `${process.env.VESSEL_NAME}-${process.env.HOSTNAME}`,
  endpoint: process.env.VESSEL_ENDPOINT,
  shapes: process.env.VESSEL_SHAPES?.split(',') || [],
  discoveryEndpoint: process.env.DISCOVERY_VESSEL_ENDPOINT,
  heartbeatInterval: parseInt(process.env.DISCOVERY_HEARTBEAT_INTERVAL_MS || '120000'),
});

// Start on server startup (async, non-blocking)
await discoveryClient.start();

// Shutdown handler
process.on('SIGTERM', async () => {
  await discoveryClient.stop();
  process.exit(0);
});
```

### Pattern 2: Bootstrap Delay (Circular Dependencies)

**Use for**: Identity-Vessel (depends on discovery-vessel which needs identity)

```typescript
import { VesselClient } from '@metabob/vessel-discovery-client';

export const discoveryClient = new VesselClient({
  vesselId: 'identity-vessel',
  endpoint: 'http://identity-vessel:8080',
  shapes: ['userProfile', 'apiKey', 'jwtToken'],
  discoveryEndpoint: 'http://discovery-vessel:8080',
  heartbeatInterval: 120000,
  bootstrapDelay: 30000, // Wait 30s for discovery to be ready
});

// Start with delay
await discoveryClient.start();
```

### Pattern 3: Self-Registration (Discovery-Vessel Itself)

**Use for**: Discovery-vessel (registers itself on startup)

```typescript
// Discovery-vessel registers with itself
export const selfRegistration = async () => {
  const response = await fetch('http://localhost:8080/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      vessel_id: 'discovery-vessel',
      endpoint: 'http://discovery-vessel:8080',
      shapes: ['vesselCapability', 'vesselEndpoint'],
      ttl: 300000,
    }),
  });

  if (!response.ok) {
    console.error('Self-registration failed');
  }
};

// Register after server starts
server.listen(8080, async () => {
  await selfRegistration();
});
```

### Pattern 4: Conditional Discovery (MiniBob)

**Use for**: Vessels that can operate with or without discovery

```typescript
import { VesselClient } from '@metabob/vessel-discovery-client';

const discoveryEnabled = process.env.DISCOVERY_ENABLED === 'true';

let discoveryClient: VesselClient | null = null;

if (discoveryEnabled) {
  discoveryClient = new VesselClient({
    vesselId: `minibob-${process.env.HOSTNAME}`,
    endpoint: process.env.VESSEL_ENDPOINT,
    shapes: ['file', 'memo', 'directoryTree', 'gitDiff'],
    discoveryEndpoint: process.env.DISCOVERY_VESSEL_ENDPOINT,
  });

  await discoveryClient.start();
}

// Shutdown (only if enabled)
process.on('SIGTERM', async () => {
  if (discoveryClient) {
    await discoveryClient.stop();
  }
  process.exit(0);
});
```

## Configuration

### Required Environment Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `DISCOVERY_ENABLED` | Enable discovery integration | `true` |
| `DISCOVERY_VESSEL_ENDPOINT` | Discovery service URL | `http://discovery-vessel:8080` |
| `VESSEL_ID` | Unique vessel identifier | `activity-api-pod-1` |
| `VESSEL_ENDPOINT` | This vessel's HTTP endpoint | `http://activity-api:8080` |
| `VESSEL_SHAPES` | Comma-separated shapes | `activityTemplate,activityMetrics` |

### Optional Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `DISCOVERY_HEARTBEAT_INTERVAL_MS` | Heartbeat interval | `120000` (2 min) |
| `DISCOVERY_RETRY_ATTEMPTS` | Max retry attempts | `3` |
| `DISCOVERY_BOOTSTRAP_DELAY_MS` | Delay before first registration | `0` |

### Helm Values

```yaml
# environments/production.values.yaml
discovery:
  enabled: true
  endpoint: "http://discovery-vessel.activity-system.svc.cluster.local:8080"
  heartbeatInterval: 120000
  ttl: 300000
  bootstrapDelay: 0

vessels:
  activityApi:
    shapes:
      - activityTemplate
      - activityExecutionTrace
      - activityMetrics
    discovery:
      enabled: true

  analysisApi:
    shapes:
      - problem_detection
      - error_log
      - source_code
    discovery:
      enabled: true
```

## Testing

### Unit Tests

```typescript
import { describe, test, expect, mock } from 'bun:test';
import { VesselClient } from '@metabob/vessel-discovery-client';

describe('Discovery Integration', () => {
  test('should register on start', async () => {
    const client = new VesselClient({
      vesselId: 'test-vessel',
      endpoint: 'http://localhost:8080',
      shapes: ['test_shape'],
      discoveryEndpoint: 'http://localhost:9000',
    });

    const mockFetch = mock(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ registration_id: 'test-123' }),
      })
    );
    global.fetch = mockFetch;

    await client.start();

    expect(mockFetch).toHaveBeenCalledWith(
      'http://localhost:9000/register',
      expect.objectContaining({
        method: 'POST',
      })
    );

    await client.stop();
  });
});
```

### Integration Tests

```bash
# Start discovery-vessel locally
cd repos/discovery-vessel
bun run dev

# Start test vessel
cd repos/metabob-activity-api
DISCOVERY_ENABLED=true \
DISCOVERY_VESSEL_ENDPOINT=http://localhost:8080 \
VESSEL_ID=test-vessel \
VESSEL_ENDPOINT=http://localhost:8081 \
bun run dev

# Verify registration
curl http://localhost:8080/vessels

# Query for shape
curl -X POST http://localhost:8080/resolve \
  -H "Content-Type: application/json" \
  -d '{"shape": "activityTemplate"}'

# Should return test vessel
```

### End-to-End Tests

Located in `repos/metabob-activity-api/tests/discovery-integration.test.ts`:

```bash
# Run against local cluster
bun test tests/discovery-integration.test.ts

# Run against canary
DISCOVERY_VESSEL_ENDPOINT=https://discovery.metabob.com \
bun test tests/discovery-integration.test.ts
```

## Troubleshooting

### Vessel Not Registering

**Symptoms**: `discovery.registered: false` in `/health` endpoint

**Diagnosis**:
```bash
# Check vessel logs for registration errors
kubectl logs -n activity-system deploy/{vessel-name} | grep -i discovery

# Check discovery-vessel logs
kubectl logs -n activity-system deploy/discovery-vessel | grep -i register

# Verify environment variables
kubectl exec -it deploy/{vessel-name} -n activity-system -- env | grep DISCOVERY
```

**Common causes**:
- Discovery-vessel not running: `kubectl get pods -n activity-system -l app=discovery-vessel`
- Incorrect endpoint URL: Check `DISCOVERY_VESSEL_ENDPOINT`
- Network policy blocking traffic: Check Istio/NetworkPolicy rules

### Registration Expired (TTL)

**Symptoms**: Vessel was registered but now shows as unregistered

**Diagnosis**:
```bash
# Check heartbeat logs
kubectl logs -n activity-system deploy/{vessel-name} --tail=100 | grep heartbeat

# Query discovery for vessel
curl http://discovery-vessel:8080/vessels | jq '.vessels[] | select(.vessel_id == "my-vessel")'
```

**Common causes**:
- Heartbeat manager stopped: Restart vessel
- Network issues preventing heartbeats: Check network connectivity
- TTL too short: Increase `DISCOVERY_HEARTBEAT_INTERVAL_MS`

### Discovery Queries Failing

**Symptoms**: Impulse resolution falls back to MCP backend

**Diagnosis**:
```bash
# Test discovery query directly
kubectl port-forward -n activity-system svc/discovery-vessel 8080:8080

curl -X POST http://localhost:8080/resolve \
  -H "Content-Type: application/json" \
  -d '{"shape": "activityTemplate"}'

# Check if vessels are registered
curl http://localhost:8080/vessels
```

**Common causes**:
- No vessels registered for shape: Check `VESSEL_SHAPES` configuration
- All vessels filtered out by health/circuit: Check vessel health scores
- Discovery-vessel unhealthy: Check discovery health endpoint

### Graceful Shutdown Not Working

**Symptoms**: Vessel remains registered after pod termination

**Diagnosis**:
```bash
# Check if shutdown handler is registered
kubectl logs deploy/{vessel-name} | grep -i shutdown

# Verify SIGTERM is received
kubectl delete pod {vessel-pod-name} --grace-period=30
kubectl logs {vessel-pod-name} | grep -i sigterm
```

**Common causes**:
- Shutdown handler not registered: Add `process.on('SIGTERM', ...)` handler
- Kubernetes grace period too short: Set `terminationGracePeriodSeconds: 30`
- Async shutdown not awaited: Use `await client.stop()`

## Routing Trace Recording

When MiniBob resolves impulses via discovery-vessel, it records routing decisions for learning.

**Tracked Information:**
- `shape`: Impulse shape being resolved
- `candidates`: List of vessel IDs considered
- `selected`: Vessel ID that successfully resolved
- `latency_ms`: Time taken for successful resolution
- `success`: Whether resolution succeeded

**Implementation:**
```typescript
// In vessel-discovery.ts
const routingDecision = {
  shape: 'error_log',
  candidates: ['analysis-api-abc', 'analysis-api-xyz'],
  selected: 'analysis-api-abc',
  latency_ms: 245,
  success: true
};

await mcp.recordRoutingTrace(routingDecision);
```

**Backend Endpoint:**
- `POST /v2/routing-traces`
- Non-blocking (fire-and-forget)
- Enables learning vessel performance

**Use Cases:**
- Learn which vessels are faster for which shapes
- Detect vessel performance degradation
- Optimize vessel selection algorithm
- Enable Thompson Sampling for vessel routing

**Data Flow:**
```
MiniBob discovers vessels for shape
  ↓
Try vessels in order (health-weighted)
  ↓
First successful resolution wins
  ↓
Record routing decision
  ↓
Send to Activity-API (async, non-blocking)
  ↓
Backend stores in routing_trace table
  ↓
Thompson Sampling learns best vessels per shape
```

**Example Trace:**
```json
{
  "shape": "activityExecutionTrace",
  "candidates": [
    "activity-api-pod-1",
    "activity-api-pod-2",
    "activity-api-pod-3"
  ],
  "selected": "activity-api-pod-2",
  "latency_ms": 180,
  "success": true,
  "timestamp": "2026-04-16T10:30:00Z"
}
```

**Learning Applications:**
- **Vessel ranking**: Vessels with better latency/success rates ranked higher
- **Circuit breaking**: Repeated failures trigger circuit breaker
- **Load balancing**: Distribute load based on performance history
- **Anomaly detection**: Detect when vessel performance degrades

## Related Documentation

- [Vessel Discovery Client Package](packages/vessel-discovery-client/README.md)
- [Discovery-Vessel CLAUDE.md](repos/discovery-vessel/CLAUDE.md)
- [DEPLOYMENT_WORKFLOW.md](repos/deployment/DEPLOYMENT_WORKFLOW.md)
- [IMPULSE_ACTIVITY_FOUNDATION.md](docs/architecture/IMPULSE_ACTIVITY_FOUNDATION.md)
- [RESOLVER_TRACKING.md](docs/architecture/RESOLVER_TRACKING.md)
