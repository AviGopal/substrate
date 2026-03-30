# Vessel Wiring: Practical Guide

The vessel discovery infrastructure **already exists** in activity-api. This guide shows you how to wire new vessels into the system using existing APIs.

## What Already Exists

### Activity-API Endpoints

```
POST /v2/vessels/register         - Register vessel capabilities
GET  /v2/vessels/discover?shape=X - Find vessels that resolve shape X
GET  /v2/vessels/capabilities     - List all registered vessels
POST /v2/vessels/heartbeat        - Vessel health reporting
GET  /v2/vessels/status           - Vessel execution status
```

### Database Tables

- `vessel_capabilities`: Vessel registrations with shapes they resolve
- `vessel_heartbeats`: Real-time vessel status and metrics

## Step-by-Step: Wire a New Vessel

### Step 1: Register on Startup

When your vessel starts, register its capabilities:

```typescript
// repos/react-renderer/src/index.ts

async function registerWithActivityAPI() {
  const ACTIVITY_API_URL = process.env.ACTIVITY_API_URL ||
    "http://metabob-activity-api.activity-system.svc.cluster.local:8080"

  const registration = {
    vesselId: "react-renderer-001",
    vesselName: "React Renderer",
    endpoint: `http://react-renderer.activity-system.svc.cluster.local:3000`,
    shapes: [
      "ui_component",
      "ui_state",
      "ui_event"
    ],
    metadata: {
      version: "0.1.0",
      environment: process.env.NODE_ENV,
      capabilities: ["ssr", "streaming", "viewport-management"]
    }
  }

  try {
    const response = await fetch(`${ACTIVITY_API_URL}/v2/vessels/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(registration)
    })

    if (!response.ok) {
      throw new Error(`Registration failed: ${response.statusText}`)
    }

    const result = await response.json()
    console.log("[Vessel] Registered successfully:", result)

    // Keep registration alive with periodic updates
    setInterval(() => {
      fetch(`${ACTIVITY_API_URL}/v2/vessels/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(registration)
      }).catch(err => {
        console.error("[Vessel] Failed to refresh registration:", err)
      })
    }, 60000) // Refresh every minute

  } catch (error) {
    console.error("[Vessel] Failed to register:", error)
    throw error
  }
}

// Call during startup
await registerWithActivityAPI()
```

### Step 2: Discover Other Vessels

When you need to resolve an impulse from another vessel:

```typescript
// repos/react-renderer/src/resolvers/delegate.ts

async function discoverVesselForShape(shape: string): Promise<string | null> {
  const ACTIVITY_API_URL = process.env.ACTIVITY_API_URL ||
    "http://metabob-activity-api.activity-system.svc.cluster.local:8080"

  try {
    const response = await fetch(
      `${ACTIVITY_API_URL}/v2/vessels/discover?shape=${shape}`
    )

    if (!response.ok) {
      // No vessel found for this shape
      return null
    }

    const { vessels, found } = await response.json()

    if (!found || vessels.length === 0) {
      return null
    }

    // Return first vessel's endpoint
    // In future: could implement load balancing, health checks, etc.
    return vessels[0].endpoint

  } catch (error) {
    console.error(`[Vessel] Discovery failed for shape ${shape}:`, error)
    return null
  }
}

// Cache vessel endpoints to avoid repeated lookups
const vesselCache = new Map<string, { endpoint: string, expiresAt: number }>()

export async function getVesselEndpoint(shape: string): Promise<string | null> {
  const cached = vesselCache.get(shape)
  if (cached && cached.expiresAt > Date.now()) {
    return cached.endpoint
  }

  const endpoint = await discoverVesselForShape(shape)
  if (endpoint) {
    // Cache for 5 minutes
    vesselCache.set(shape, {
      endpoint,
      expiresAt: Date.now() + 5 * 60 * 1000
    })
  }

  return endpoint
}
```

### Step 3: Implement Resolution Chain

Chain local → discovered vessel resolution:

```typescript
// repos/react-renderer/src/resolvers/index.ts

import { getVesselEndpoint } from './delegate'

// Local resolvers (owned by this vessel)
const localResolvers = new Map<string, ResolverFunction>()

export function registerResolver(
  shape: string,
  resolver: ResolverFunction
) {
  localResolvers.set(shape, resolver)
}

// Resolution chain
export async function resolveImpulse(impulse: Impulse): Promise<any> {
  const { type } = impulse.pointer

  // Step 1: Try local resolver
  if (localResolvers.has(type)) {
    const resolver = localResolvers.get(type)!
    return await resolver(impulse.pointer)
  }

  // Step 2: Discover vessel that can resolve this shape
  const vesselEndpoint = await getVesselEndpoint(type)

  if (!vesselEndpoint) {
    throw new Error(
      `No resolver found for impulse type: ${type}. ` +
      `Registered vessels: ${Array.from(localResolvers.keys()).join(", ")}`
    )
  }

  // Step 3: Delegate to discovered vessel
  const response = await fetch(`${vesselEndpoint}/resolve`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ pointer: impulse.pointer })
  })

  if (!response.ok) {
    throw new Error(
      `Resolution failed at ${vesselEndpoint}: ${response.statusText}`
    )
  }

  const { content } = await response.json()
  return content
}
```

### Step 4: Send Heartbeats

Report vessel status periodically:

```typescript
// repos/react-renderer/src/monitoring/heartbeat.ts

interface VesselMetrics {
  executionsCompleted: number
  totalCostUsd: number
  uptimeSeconds: number
}

class HeartbeatManager {
  private metrics: VesselMetrics = {
    executionsCompleted: 0,
    totalCostUsd: 0,
    uptimeSeconds: 0
  }

  private startTime = Date.now()
  private intervalId?: Timer

  start() {
    const ACTIVITY_API_URL = process.env.ACTIVITY_API_URL ||
      "http://metabob-activity-api.activity-system.svc.cluster.local:8080"

    const POD_NAME = process.env.HOSTNAME || "react-renderer-local"
    const NAMESPACE = process.env.NAMESPACE || "activity-system"

    this.intervalId = setInterval(async () => {
      try {
        const heartbeat = {
          pod_name: POD_NAME,
          namespace: NAMESPACE,
          status: this.getCurrentStatus(),
          current_activity: this.getCurrentActivity(),
          metrics: {
            executions_completed: this.metrics.executionsCompleted,
            total_cost_usd: this.metrics.totalCostUsd,
            uptime_seconds: Math.floor((Date.now() - this.startTime) / 1000)
          }
        }

        await fetch(`${ACTIVITY_API_URL}/v2/vessels/heartbeat`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(heartbeat)
        })

      } catch (error) {
        console.error("[Heartbeat] Failed to send:", error)
      }
    }, 30000) // Every 30 seconds
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId)
    }
  }

  private getCurrentStatus(): 'idle' | 'executing' | 'error' {
    // Implement based on your vessel's state
    return 'idle'
  }

  private getCurrentActivity() {
    // Return current activity if executing, null otherwise
    return null
  }

  recordExecution(cost: number) {
    this.metrics.executionsCompleted++
    this.metrics.totalCostUsd += cost
  }
}

export const heartbeat = new HeartbeatManager()
```

### Step 5: Full Vessel Startup

Put it all together:

```typescript
// repos/react-renderer/src/index.ts

import { Hono } from 'hono'
import { registerResolver } from './resolvers'
import { resolveImpulse } from './resolvers'
import { heartbeat } from './monitoring/heartbeat'
import './resolvers/ui-component'  // Local resolvers
import './resolvers/ui-state'

const app = new Hono()

// Health check
app.get('/health', (c) => {
  return c.json({ status: 'ok', vessel: 'react-renderer' })
})

// Resolve endpoint
app.post('/resolve', async (c) => {
  const { pointer } = await c.req.json()

  try {
    const content = await resolveImpulse({ pointer })
    return c.json({ content })
  } catch (error) {
    return c.json({ error: String(error) }, 400)
  }
})

// Startup sequence
async function start() {
  console.log("[Vessel] Starting react-renderer...")

  // 1. Connect to infrastructure
  await connectToSurrealDB()
  console.log("[Vessel] Connected to SurrealDB")

  // 2. Register with activity-api
  await registerWithActivityAPI()
  console.log("[Vessel] Registered with activity-api")

  // 3. Start heartbeat
  heartbeat.start()
  console.log("[Vessel] Heartbeat started")

  // 4. Start HTTP server
  const port = Number(process.env.PORT) || 3000
  Bun.serve({
    port,
    fetch: app.fetch
  })

  console.log(`[Vessel] Listening on port ${port}`)
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log("[Vessel] Shutting down...")
  heartbeat.stop()

  // Deregister (optional - TTL will expire naturally)
  // await deregisterFromActivityAPI()

  process.exit(0)
})

start().catch(err => {
  console.error("[Vessel] Failed to start:", err)
  process.exit(1)
})
```

## Example: Terminal Vessel Wiring

Let me show how Terminal vessel would wire into the system:

```typescript
// repos/terminal/src/index.ts

import { Hono } from 'hono'

const app = new Hono()

// Local state
const terminals = new Map<string, TerminalState>()

// Register resolver for terminal_snapshot
app.post('/resolve', async (c) => {
  const { pointer } = await c.req.json()

  if (pointer.type !== 'terminal_snapshot') {
    return c.json({ error: 'Unknown pointer type' }, 400)
  }

  const terminal = terminals.get(pointer.terminalId)
  if (!terminal) {
    return c.json({ error: 'Terminal not found' }, 404)
  }

  const snapshot = {
    output: terminal.buffer,
    scrollback: pointer.includeScrollback ? terminal.scrollback : [],
    cursor: terminal.cursor,
    size: terminal.size
  }

  return c.json({ content: snapshot })
})

// Startup
async function start() {
  const ACTIVITY_API_URL = process.env.ACTIVITY_API_URL

  // Register with activity-api
  await fetch(`${ACTIVITY_API_URL}/v2/vessels/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      vesselId: "terminal-001",
      vesselName: "Terminal",
      endpoint: "http://terminal.activity-system.svc.cluster.local:8080",
      shapes: [
        "terminal_snapshot",
        "terminal_command",
        "terminal_output"
      ]
    })
  })

  console.log("[Terminal] Registered with activity-api")

  // Start server
  Bun.serve({ port: 8080, fetch: app.fetch })
  console.log("[Terminal] Listening on port 8080")
}

start()
```

## Example: React-Renderer Delegating to Terminal

```typescript
// repos/react-renderer/src/components/TerminalViewer.tsx

import { useImpulse } from '../hooks/useImpulse'

function TerminalViewer({ terminalId }: { terminalId: string }) {
  // This impulse will be automatically resolved via vessel discovery
  const terminal = useImpulse({
    type: "terminal_snapshot",  // React-renderer doesn't own this
    terminalId,
    includeScrollback: true
  })

  // Resolution chain:
  // 1. useImpulse calls resolveImpulse()
  // 2. resolveImpulse checks local resolvers (not found)
  // 3. resolveImpulse calls getVesselEndpoint("terminal_snapshot")
  // 4. getVesselEndpoint queries activity-api: /v2/vessels/discover?shape=terminal_snapshot
  // 5. Activity-api returns: { vessels: [{ endpoint: "http://terminal..." }] }
  // 6. resolveImpulse delegates to terminal vessel: POST http://terminal:8080/resolve
  // 7. Terminal vessel resolves and returns snapshot
  // 8. useImpulse receives content and renders

  if (!terminal) {
    return <div>Loading terminal...</div>
  }

  return (
    <pre className="terminal">
      {terminal.content.output}
    </pre>
  )
}
```

## Deployment Wiring (Helm)

### Add to helmfile.yaml

```yaml
releases:
  # ... existing releases ...

  - name: terminal
    namespace: activity-system
    chart: ./charts/terminal
    values:
      - ./charts/terminal/values.yaml
    needs:
      - surrealdb
      - metabob-activity-api

  - name: react-renderer
    namespace: activity-system
    chart: ./charts/react-renderer
    values:
      - ./charts/react-renderer/values.yaml
    needs:
      - metabob-activity-api
      - terminal  # Optional: only if react-renderer requires terminal
```

### Service Discovery via DNS

Kubernetes DNS automatically creates:
- `terminal.activity-system.svc.cluster.local`
- `react-renderer.activity-system.svc.cluster.local`
- `metabob-activity-api.activity-system.svc.cluster.local`

No additional configuration needed - vessels discover via activity-api registry.

## Verification

### 1. Check vessel registered

```bash
curl http://activity.metabob.local/v2/vessels/capabilities | jq
```

Expected:
```json
{
  "vessels": [
    {
      "vesselId": "react-renderer-001",
      "vesselName": "React Renderer",
      "endpoint": "http://react-renderer.activity-system.svc.cluster.local:3000",
      "shapes": ["ui_component", "ui_state", "ui_event"],
      "lastSeen": "2026-03-30T20:15:00Z"
    },
    {
      "vesselId": "terminal-001",
      "vesselName": "Terminal",
      "endpoint": "http://terminal.activity-system.svc.cluster.local:8080",
      "shapes": ["terminal_snapshot", "terminal_command"],
      "lastSeen": "2026-03-30T20:15:30Z"
    }
  ]
}
```

### 2. Test discovery

```bash
curl "http://activity.metabob.local/v2/vessels/discover?shape=terminal_snapshot" | jq
```

Expected:
```json
{
  "vessels": [
    {
      "vesselId": "terminal-001",
      "vesselName": "Terminal",
      "endpoint": "http://terminal.activity-system.svc.cluster.local:8080",
      "shapes": ["terminal_snapshot", "terminal_command", "terminal_output"]
    }
  ],
  "shape": "terminal_snapshot",
  "found": true
}
```

### 3. Test cross-vessel resolution

```bash
# From react-renderer, resolve terminal impulse
curl -X POST http://ui.metabob.local/resolve \
  -H "Content-Type: application/json" \
  -d '{
    "pointer": {
      "type": "terminal_snapshot",
      "terminalId": "term_123"
    }
  }' | jq
```

Expected flow:
```
1. Request hits react-renderer
2. React-renderer checks local resolvers (not found)
3. React-renderer queries activity-api for "terminal_snapshot"
4. Activity-api returns terminal vessel endpoint
5. React-renderer delegates to terminal vessel
6. Terminal vessel resolves and returns snapshot
7. React-renderer returns content to client
```

### 4. Monitor heartbeats

```bash
curl http://activity.metabob.local/v2/vessels/status | jq
```

Expected:
```json
{
  "vessels": [
    {
      "pod_name": "react-renderer-abc123",
      "namespace": "activity-system",
      "status": "idle",
      "metrics": {
        "executions_completed": 42,
        "total_cost_usd": 0.15,
        "uptime_seconds": 3600
      },
      "last_heartbeat": "2026-03-30T20:15:45Z",
      "ready": true,
      "phase": "Running"
    }
  ]
}
```

## Summary: Wiring Checklist

When adding a new vessel:

1. **Implement resolver endpoint** - POST /resolve accepts pointer, returns content
2. **Register on startup** - POST /v2/vessels/register with shapes
3. **Implement discovery** - Query /v2/vessels/discover?shape=X for delegation
4. **Send heartbeats** - POST /v2/vessels/heartbeat every 30s
5. **Add Helm chart** - Kubernetes deployment config
6. **Add to helmfile** - Deploy with system
7. **Verify registration** - Check /v2/vessels/capabilities
8. **Test resolution** - Verify cross-vessel impulse resolution works

The infrastructure already exists - you just need to implement the endpoints and register your vessel!
