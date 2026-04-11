# @metabob/vessel-discovery-client

Shared TypeScript package for standardized vessel registration and discovery in the Metabob ecosystem.

## Features

- ✅ **Automatic Registration** - Simple one-line vessel registration
- ✅ **Auto-Heartbeat** - Keeps vessel alive with configurable intervals
- ✅ **Exponential Backoff** - Intelligent retry logic for failures
- ✅ **Graceful Shutdown** - Automatic cleanup on SIGTERM/SIGINT
- ✅ **Health Middleware** - Drop-in health endpoints for Hono/Express
- ✅ **Discovery Client** - Query vessels by capability with caching
- ✅ **Metrics Emission** - Built-in observability hooks
- ✅ **TypeScript First** - Full type safety and IntelliSense

## Installation

```bash
bun add @metabob/vessel-discovery-client
```

## Quick Start

### Basic Registration

```typescript
import { register } from "@metabob/vessel-discovery-client"

const client = await register({
  vesselId: "my-vessel-1",
  vesselName: "My Vessel",
  endpoint: "http://my-vessel:8080",
  shapes: ["my-shape"],
  discoveryEndpoint: "http://discovery:8080",
})

// That's it! Vessel is now registered and heartbeat is running
```

### With Hono Health Endpoint

```typescript
import { Hono } from "hono"
import { register } from "@metabob/vessel-discovery-client"
import { createHonoHealthMiddleware } from "@metabob/vessel-discovery-client/middleware"

const client = await register({
  vesselId: "my-vessel",
  vesselName: "My Vessel",
  endpoint: "http://my-vessel:8080",
  shapes: ["my-shape"],
  discoveryEndpoint: "http://discovery:8080",
})

const app = new Hono()

// Add health endpoint
app.get("/health", createHonoHealthMiddleware(client))

export default app
```

### With Express

```typescript
import express from "express"
import { register } from "@metabob/vessel-discovery-client"
import { createExpressHealthMiddleware } from "@metabob/vessel-discovery-client/middleware"

const client = await register({
  vesselId: "my-vessel",
  vesselName: "My Vessel",
  endpoint: "http://my-vessel:8080",
  shapes: ["my-shape"],
  discoveryEndpoint: "http://discovery:8080",
})

const app = express()
app.get("/health", createExpressHealthMiddleware(client))

app.listen(8080)
```

## Configuration

### Full Configuration Options

```typescript
import { register } from "@metabob/vessel-discovery-client"

const client = await register({
  // === Required ===
  vesselId: "my-vessel-1",
  vesselName: "My Vessel",
  endpoint: "http://my-vessel:8080",
  shapes: ["shape1", "shape2"],
  discoveryEndpoint: "http://discovery:8080",

  // === Optional ===
  version: "1.0.0", // Default: "0.0.0"
  ttl: 300, // Registration TTL in seconds, default: 300
  heartbeatIntervalMs: 120000, // 2 minutes, default: 120000
  protocol: "http", // "http" | "grpc" | "ws" | "unix", default: "http"
  orgId: "my-org", // For multi-tenant isolation
  authToken: "your-token", // Authentication token
  authType: "Bearer", // "Bearer" | "ApiKey", default: "Bearer"

  // Domain-specific metadata (not validated by package)
  metadata: {
    environment: "k8s-cluster",
    podId: "my-vessel-abc123",
    customField: "customValue",
  },

  // Retry configuration
  maxConsecutiveFailures: 3, // Default: 3
  initialRetryDelayMs: 1000, // Default: 1000
  maxRetryDelayMs: 30000, // Default: 30000

  // Observability
  enableMetrics: true, // Default: true
  metricsEmitter: customEmitter, // Custom metrics emitter
  logger: customLogger, // Custom logger
})
```

## Discovery Client

Query vessels by capability:

```typescript
import { discoverByShape } from "@metabob/vessel-discovery-client"

const result = await discoverByShape({
  shape: "code-analysis",
  discoveryEndpoint: "http://discovery:8080",
  authToken: "your-token",
  cacheTtlMs: 60000, // Cache for 1 minute
})

if (result.found) {
  console.log(`Found ${result.vessels.length} vessels:`)
  result.vessels.forEach((vessel) => {
    console.log(`  - ${vessel.vesselName} at ${vessel.endpoint}`)
  })
}
```

Discover all vessels:

```typescript
import { discoverVessels } from "@metabob/vessel-discovery-client"

const { vessels, totalCount } = await discoverVessels({
  discoveryEndpoint: "http://discovery:8080",
  authToken: "your-token",
})

console.log(`Total vessels: ${totalCount}`)
```

## Advanced Usage

### Manual Control

```typescript
import { VesselClient } from "@metabob/vessel-discovery-client"

const client = new VesselClient({
  vesselId: "my-vessel",
  vesselName: "My Vessel",
  endpoint: "http://my-vessel:8080",
  shapes: ["my-shape"],
  discoveryEndpoint: "http://discovery:8080",
})

// Manual registration
await client.register()

// Manual heartbeat
await client.heartbeat({ executionsCompleted: 42 })

// Start auto-heartbeat
client.startHeartbeat()

// Get health status
const health = client.getHealthStatus()
console.log(health)
/*
{
  status: "ok",
  vessel: "my-vessel",
  version: "0.0.0",
  uptime: 3600,
  heartbeat: {
    lastSuccess: "2026-04-11T12:00:00.000Z",
    consecutiveFailures: 0,
    isRunning: true
  },
  shapes: ["my-shape"]
}
*/

// Graceful shutdown
await client.shutdown()
```

### Custom Metrics Emitter

```typescript
import type { MetricsEmitter } from "@metabob/vessel-discovery-client"

const customEmitter: MetricsEmitter = {
  emit(metric: string, value?: number, tags?: Record<string, string>) {
    // Send to your metrics backend (Prometheus, DataDog, etc.)
    console.log(`[Metric] ${metric}=${value}`, tags)
  },
}

const client = await register({
  vesselId: "my-vessel",
  vesselName: "My Vessel",
  endpoint: "http://my-vessel:8080",
  shapes: ["my-shape"],
  discoveryEndpoint: "http://discovery:8080",
  metricsEmitter: customEmitter,
})
```

### Custom Logger

```typescript
import type { Logger } from "@metabob/vessel-discovery-client"

const customLogger: Logger = {
  info: (msg, ...args) => myLogger.info(msg, ...args),
  warn: (msg, ...args) => myLogger.warn(msg, ...args),
  error: (msg, ...args) => myLogger.error(msg, ...args),
  debug: (msg, ...args) => myLogger.debug(msg, ...args),
}

const client = await register({
  vesselId: "my-vessel",
  vesselName: "My Vessel",
  endpoint: "http://my-vessel:8080",
  shapes: ["my-shape"],
  discoveryEndpoint: "http://discovery:8080",
  logger: customLogger,
})
```

## Health Response Format

The health endpoint returns:

```json
{
  "status": "ok",
  "vessel": "my-vessel",
  "version": "1.0.0",
  "uptime": 3600,
  "heartbeat": {
    "lastSuccess": "2026-04-11T12:00:00.000Z",
    "consecutiveFailures": 0,
    "isRunning": true
  },
  "shapes": ["shape1", "shape2"]
}
```

Status values:

- `ok` - Vessel healthy, heartbeat running
- `degraded` - Heartbeat running but has failures
- `unhealthy` - Heartbeat not running

HTTP status codes:

- `200` - Status is `ok`
- `503` - Status is `degraded` or `unhealthy`

## Metrics

Standard metrics emitted:

| Metric                          | Type    | Description                 |
| ------------------------------- | ------- | --------------------------- |
| `vessel.registration.success`   | Counter | Successful registrations    |
| `vessel.registration.failure`   | Counter | Failed registrations        |
| `vessel.heartbeat.success`      | Counter | Successful heartbeats       |
| `vessel.heartbeat.failure`      | Counter | Failed heartbeats           |
| `vessel.heartbeat.latency_ms`   | Gauge   | Heartbeat latency           |
| `vessel.shutdown.clean`         | Counter | Clean shutdowns             |
| `vessel.discovery.success`      | Counter | Successful discoveries      |
| `vessel.discovery.cache_hit`    | Counter | Discovery cache hits        |
| `vessel.discovery.failure`      | Counter | Failed discoveries          |

## Behavior

### Heartbeat Lifecycle

1. **Registration** - Initial registration attempted
2. **Auto-heartbeat** - Heartbeat sent every `heartbeatIntervalMs`
3. **Failure tracking** - Consecutive failures counted
4. **Re-registration** - After `maxConsecutiveFailures`, re-register with backoff
5. **Graceful shutdown** - On SIGTERM/SIGINT, deregister and exit

### Exponential Backoff

Failed operations retry with exponential backoff:

```
Delay = min(initialDelay * 2^failures, maxDelay)
```

Example with defaults (1000ms initial, 30000ms max):

- Attempt 1: 1000ms
- Attempt 2: 2000ms
- Attempt 3: 4000ms
- Attempt 4: 8000ms
- Attempt 5: 16000ms
- Attempt 6+: 30000ms (capped)

### Discovery Caching

Discovery results cached with configurable TTL:

- Cache hit: Return cached result immediately
- Cache miss: Query discovery service, cache result
- Cache expired: Query discovery service, update cache
- Query fails: Return stale cache if available, otherwise empty result

## TypeScript Types

All types are fully exported:

```typescript
import type {
  DiscoveryConfig,
  VesselRegistration,
  HeartbeatResponse,
  HealthStatus,
  VesselCapability,
  DiscoveryResult,
  Logger,
  MetricsEmitter,
} from "@metabob/vessel-discovery-client"
```

## Testing

Run tests with Bun:

```bash
bun test
```

## License

MIT
