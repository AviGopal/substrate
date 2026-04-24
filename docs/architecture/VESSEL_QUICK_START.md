# Vessel Creation: Quick Start

> **Superseded (2026-04-24):** This doc shows registration against activity-api's `POST /v2/vessels/register`, which is deprecated (proxy mode until July 2026). New vessels should register with discovery-vessel directly. See [`TYPESCRIPT_VESSEL_TEMPLATE.md`](TYPESCRIPT_VESSEL_TEMPLATE.md) for the current pattern, and `repos/concept-db/` as a reference implementation.

## Your Question

> What is required to realize this? How are vessels created? How are they wired up?

## Short Answer

**Vessels are created** by implementing 3 things:
1. Resolver endpoint (POST /resolve)
2. Registration call (POST /v2/vessels/register)
3. Health reporting (POST /v2/vessels/heartbeat)

**Vessels are wired** through vessel discovery:
1. Register your shapes with activity-api
2. Other vessels discover you via /v2/vessels/discover?shape=X
3. They call your /resolve endpoint
4. You delegate to other vessels the same way

**The infrastructure already exists** - you just plug in.

## Minimal Viable Vessel (50 lines)

```typescript
import { Hono } from 'hono'

const app = new Hono()

// 1. Resolver endpoint (required)
app.post('/resolve', async (c) => {
  const { pointer } = await c.req.json()

  // Resolve your impulse types
  if (pointer.type === 'my_custom_type') {
    return c.json({
      content: { /* your resolved data */ }
    })
  }

  return c.json({ error: 'Unknown type' }, 400)
})

// 2. Health check (required)
app.get('/health', (c) => {
  return c.json({ status: 'ok' })
})

// 3. Startup: Register with activity-api
async function start() {
  const API = process.env.ACTIVITY_API_URL

  // Register capabilities
  await fetch(`${API}/v2/vessels/register`, {
    method: "POST",
    body: JSON.stringify({
      vesselId: "my-vessel-001",
      vesselName: "My Vessel",
      endpoint: "http://my-vessel:8080",
      shapes: ["my_custom_type"]
    })
  })

  // Start heartbeat
  setInterval(async () => {
    await fetch(`${API}/v2/vessels/heartbeat`, {
      method: "POST",
      body: JSON.stringify({
        pod_name: process.env.HOSTNAME,
        namespace: "activity-system",
        status: "idle"
      })
    })
  }, 30000)

  // Start server
  Bun.serve({ port: 8080, fetch: app.fetch })
  console.log("Vessel ready")
}

start()
```

That's it. Deploy this to Kubernetes and other vessels can discover and call it.

## Create React-Renderer Vessel (Step by Step)

### Step 1: Create codebase (2 minutes)

```bash
mkdir -p repos/react-renderer/{src,templates}
cd repos/react-renderer
bun init -y
bun add hono surrealdb nanoid
```

### Step 2: Implement resolvers (5 minutes)

```typescript
// src/index.ts
import { Hono } from 'hono'

const app = new Hono()

// Resolve UI component impulses
app.post('/resolve', async (c) => {
  const { pointer } = await c.req.json()

  if (pointer.type === 'ui_component') {
    // Your UI rendering logic
    return c.json({
      content: {
        component: pointer.component,
        props: pointer.props,
        rendered: true
      }
    })
  }

  if (pointer.type === 'terminal_snapshot') {
    // Delegate to terminal vessel
    const terminalEndpoint = await getVesselEndpoint('terminal_snapshot')
    const response = await fetch(`${terminalEndpoint}/resolve`, {
      method: "POST",
      body: JSON.stringify({ pointer })
    })
    return response
  }

  return c.json({ error: 'Unknown type' }, 400)
})

app.get('/health', (c) => c.json({ status: 'ok' }))

export default app
```

### Step 3: Add discovery helper (3 minutes)

```typescript
// src/discovery.ts
const ACTIVITY_API = process.env.ACTIVITY_API_URL

async function getVesselEndpoint(shape: string): Promise<string> {
  const response = await fetch(
    `${ACTIVITY_API}/v2/vessels/discover?shape=${shape}`
  )
  const { vessels } = await response.json()
  return vessels[0].endpoint
}
```

### Step 4: Register on startup (2 minutes)

```typescript
// src/startup.ts
const ACTIVITY_API = process.env.ACTIVITY_API_URL

await fetch(`${ACTIVITY_API}/v2/vessels/register`, {
  method: "POST",
  body: JSON.stringify({
    vesselId: "react-renderer-001",
    vesselName: "React Renderer",
    endpoint: "http://react-renderer:3000",
    shapes: ["ui_component", "ui_state", "ui_event"]
  })
})
```

### Step 5: Create Dockerfile (1 minute)

```dockerfile
FROM oven/bun:1.1.3
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install
COPY . .
EXPOSE 3000
CMD ["bun", "src/index.ts"]
```

### Step 6: Create Helm chart (5 minutes)

```bash
mkdir -p helm/charts/react-renderer/templates
```

```yaml
# helm/charts/react-renderer/values.yaml
replicaCount: 1
image:
  repository: react-renderer
  tag: latest
env:
  PORT: "3000"
  ACTIVITY_API_URL: "http://metabob-activity-api:8080"
```

```yaml
# helm/charts/react-renderer/templates/deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: react-renderer
spec:
  replicas: {{ .Values.replicaCount }}
  template:
    spec:
      containers:
      - name: react-renderer
        image: {{ .Values.image.repository }}:{{ .Values.image.tag }}
        ports:
        - containerPort: 3000
        env:
        {{- range $key, $value := .Values.env }}
        - name: {{ $key }}
          value: {{ $value | quote }}
        {{- end }}
```

### Step 7: Deploy (3 minutes)

```bash
# Build container
docker build -t react-renderer:latest repos/react-renderer

# Add to helmfile.yaml
releases:
  - name: react-renderer
    chart: ./charts/react-renderer

# Deploy
cd helm
helmfile sync
```

### Step 8: Verify (1 minute)

```bash
# Check registered
curl http://activity.metabob.local/v2/vessels/capabilities | jq

# Test resolver
curl -X POST http://ui.metabob.local/resolve \
  -d '{"pointer": {"type": "ui_component", "component": "Test"}}'
```

**Total time: ~22 minutes**

## How Terminal + React-Renderer + MiniBob Wire Together

### 1. All vessels register at startup

```
Terminal:
  POST /v2/vessels/register
  body: { shapes: ["terminal_snapshot"] }

React-Renderer:
  POST /v2/vessels/register
  body: { shapes: ["ui_component", "ui_state"] }

MiniBob:
  POST /v2/vessels/register
  body: { shapes: ["activityExecutionTrace"] }
```

### 2. MiniBob executes activity, creates impulse

```typescript
// MiniBob activity execution
const execution = await executeActivity("fix-bug")

// Create UI impulse
const uiImpulse = createImpulse({
  pointer: {
    type: "ui_component",
    component: "ExecutionViewer",
    props: { executionId: execution.id }
  }
})

// Notify react-renderer
await fetch("http://react-renderer:3000/impulses/notify", {
  body: JSON.stringify({ impulseId: uiImpulse.id })
})
```

### 3. React-renderer receives notification

```typescript
// React-renderer impulse notification handler
app.post('/impulses/notify', async (c) => {
  const { impulseId } = await c.req.json()

  // Execute render activity
  await executeActivity("render-impulse-collection", {
    impulses: [impulseId]
  })
})
```

### 4. React-renderer needs terminal data

```typescript
// During rendering, react-renderer encounters terminal impulse
const impulse = {
  pointer: {
    type: "terminal_snapshot",  // Not owned by react-renderer
    terminalId: "term_123"
  }
}

// Discover vessel
const response = await fetch(
  "http://activity-api/v2/vessels/discover?shape=terminal_snapshot"
)
const { vessels } = await response.json()
// Returns: [{ endpoint: "http://terminal:8080" }]

// Delegate to terminal
const terminalResponse = await fetch(`${vessels[0].endpoint}/resolve`, {
  method: "POST",
  body: JSON.stringify({ pointer: impulse.pointer })
})

const { content } = await terminalResponse.json()
// content = { output: "...", cursor: {...}, size: {...} }
```

### 5. React-renderer renders UI

```typescript
// Now has all data needed
const ui = renderComponent("ExecutionViewer", {
  execution: executionData,
  terminal: terminalData
})

// Send to browser
sendSSE({ type: "ui_updated", ui })
```

## Visual Flow

```
MiniBob Activity Execution
         ↓ creates
   UI Impulse (pointer)
         ↓ notifies
   React-Renderer
         ↓ resolves
   ┌──────┴──────┐
   ↓             ↓
Local         Needs terminal
(ui_component)  (terminal_snapshot)
   ↓             ↓ discovers
Resolve        Activity-API
locally        /v2/vessels/discover
   ↓             ↓ returns
   ↓          Terminal endpoint
   ↓             ↓ delegates
   ↓          Terminal Vessel
   ↓             ↓ resolves
   ↓          Terminal data
   ↓             ↓
   └──────┬──────┘
          ↓
    Render complete
          ↓
    Browser displays
```

## The Magic: No Hardcoded Integration

**Before (hardcoded)**:
```typescript
// React-renderer knows about terminal
import { resolveTerminal } from '@terminal/client'
const data = await resolveTerminal(terminalId)
```

**After (discovered)**:
```typescript
// React-renderer discovers terminal dynamically
const vesselEndpoint = await discoverVessel('terminal_snapshot')
const data = await fetch(`${vesselEndpoint}/resolve`, {...})
```

**Why this matters**:
1. Add new vessel → automatically discovered
2. Remove vessel → gracefully degrades
3. Upgrade vessel → zero downtime (new version registers)
4. Scale vessel → load balance across endpoints
5. Test vessel → mock by registering test instance

## What You Need to Know

### As a Vessel Developer

1. **Implement POST /resolve** - resolve your impulse types
2. **Call POST /v2/vessels/register** - announce your shapes
3. **Send POST /v2/vessels/heartbeat** - keep registration alive
4. **Query GET /v2/vessels/discover** - find other vessels
5. **Delegate** - call other vessels' /resolve endpoints

### Infrastructure Provides

- **Discovery**: GET /v2/vessels/discover?shape=X
- **Registry**: POST /v2/vessels/register
- **Health**: POST /v2/vessels/heartbeat
- **Monitoring**: GET /v2/vessels/status
- **DNS**: <vessel>.activity-system.svc.cluster.local
- **Service Mesh**: Istio routing, mTLS, observability

### You Don't Need

- ❌ Service discovery library
- ❌ Load balancer configuration
- ❌ Direct vessel-to-vessel knowledge
- ❌ Complex orchestration
- ❌ Custom protocol (just HTTP/JSON)

## Next Steps

1. **Read the guides**:
   - REACT_RENDERER_VESSEL.md - Full architecture
   - REACT_RENDERER_EXAMPLE.md - Detailed examples
   - VESSEL_CREATION_GUIDE.md - Step-by-step process
   - VESSEL_WIRING_PRACTICAL.md - Integration patterns

2. **Implement minimal vessel**:
   - Start with 50-line version above
   - Test locally with activity-api
   - Add resolvers incrementally

3. **Deploy to K8s**:
   - Create Dockerfile
   - Add Helm chart
   - Deploy with helmfile

4. **Verify wiring**:
   - Check /v2/vessels/capabilities
   - Test cross-vessel resolution
   - Monitor heartbeats

The infrastructure is ready. You just need to plug in your vessel.
