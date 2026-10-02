# Quick Start Guide

## Installation

```bash
bun add @metabob/vessel-discovery-client
```

## Minimal Example

```typescript
import { register } from "@metabob/vessel-discovery-client"
import { createHonoHealthMiddleware } from "@metabob/vessel-discovery-client/middleware"
import { Hono } from "hono"

// Register vessel
const client = await register({
  vesselId: "my-vessel-1",
  vesselName: "My Vessel",
  endpoint: "http://my-vessel:8080",
  shapes: ["my-shape"],
  discoveryEndpoint: "http://discovery:8080",
})

// Add health endpoint
const app = new Hono()
app.get("/health", createHonoHealthMiddleware(client))

export default app
```

That's it! Your vessel is now:
- ✅ Registered with discovery service
- ✅ Sending heartbeats every 2 minutes
- ✅ Handling graceful shutdown (SIGTERM/SIGINT)
- ✅ Exposing health endpoint

## Common Patterns

### With Environment Variables

```typescript
const client = await register({
  vesselId: process.env.VESSEL_ID!,
  vesselName: process.env.VESSEL_NAME!,
  endpoint: process.env.VESSEL_ENDPOINT!,
  shapes: process.env.VESSEL_SHAPES!.split(","),
  discoveryEndpoint: process.env.DISCOVERY_ENDPOINT!,
  orgId: process.env.ORG_ID,
  authToken: process.env.DISCOVERY_AUTH_TOKEN,
})
```

### With Kubernetes Metadata

```typescript
const client = await register({
  vesselId: `${process.env.VESSEL_NAME}-${process.env.POD_ID}`,
  vesselName: process.env.VESSEL_NAME!,
  endpoint: `http://${process.env.POD_IP}:8080`,
  shapes: ["my-shape"],
  discoveryEndpoint: "http://discovery:8080",
  metadata: {
    environment: "k8s-cluster",
    podId: process.env.POD_ID,
    namespace: process.env.NAMESPACE,
  },
})
```

### Discovery Usage

```typescript
import { discoverByShape } from "@metabob/vessel-discovery-client"

// Find vessels that can resolve a shape
const result = await discoverByShape({
  shape: "code-analysis",
  discoveryEndpoint: "http://discovery:8080",
})

if (result.found) {
  // Use first available vessel
  const vessel = result.vessels[0]
  const response = await fetch(`${vessel.endpoint}/analyze`, {
    method: "POST",
    body: JSON.stringify({ code: "..." }),
  })
}
```

### Custom Logger

```typescript
import pino from "pino"

const logger = pino()

const client = await register({
  vesselId: "my-vessel",
  vesselName: "My Vessel",
  endpoint: "http://my-vessel:8080",
  shapes: ["my-shape"],
  discoveryEndpoint: "http://discovery:8080",
  logger: {
    info: (msg, ...args) => logger.info({ msg, args }),
    warn: (msg, ...args) => logger.warn({ msg, args }),
    error: (msg, ...args) => logger.error({ msg, args }),
    debug: (msg, ...args) => logger.debug({ msg, args }),
  },
})
```

## Health Endpoint Response

```json
{
  "status": "ok",
  "vessel": "my-vessel-1",
  "version": "1.0.0",
  "uptime": 3600,
  "heartbeat": {
    "lastSuccess": "2026-04-11T12:00:00.000Z",
    "consecutiveFailures": 0,
    "isRunning": true
  },
  "shapes": ["my-shape"]
}
```

## Troubleshooting

### Registration fails silently
- Check that `discoveryEndpoint` is reachable
- Verify `authToken` if using authentication
- Check logs for detailed error messages

### Heartbeat failures
- Verify network connectivity to discovery service
- Check if discovery service is healthy
- Review `maxConsecutiveFailures` setting

### Health endpoint returns 503
- Status is `degraded` (heartbeat has failures) or `unhealthy` (heartbeat stopped)
- Check heartbeat status in response
- Review vessel logs for errors

## Full Documentation

See [README.md](./README.md) for complete documentation and advanced usage.
