# Vessel Creation and Wiring Guide

> **Superseded (2026-04-24):** Portions of this guide describe the deprecated activity-api `/v2/vessels/*` registration path (proxy mode until July 2026). See [`TYPESCRIPT_VESSEL_TEMPLATE.md`](TYPESCRIPT_VESSEL_TEMPLATE.md) for the current discovery-vessel pattern. The conceptual sections below (what a vessel is, impulse-driven design, capability-based architecture) remain accurate.

## Overview

A **vessel** is an independently deployable service that:
1. Resolves specific impulse types (owns data)
2. Exposes activities (owns capabilities)
3. Records traces (participates in learning)
4. Discovers other vessels (delegates resolution)

## Vessel Creation Process

### Phase 1: Create Codebase Structure

```bash
# 1. Create vessel repository
mkdir -p repos/react-renderer
cd repos/react-renderer

# 2. Initialize with Bun
bun init

# 3. Create standard structure
mkdir -p src/{resolvers,activities,routes,integrations}
mkdir -p templates
mkdir -p sql/schemas
```

### Phase 2: Implement Core Components

#### A. Vessel Manifest (`vessel.json`)

Every vessel needs a manifest that declares its capabilities:

```json
{
  "id": "react-renderer",
  "version": "0.1.0",
  "name": "React Renderer",
  "description": "UI rendering and impulse visualization vessel",

  "resolvers": [
    {
      "type": "ui_component",
      "description": "Renders React components from component pointers",
      "protocol": "http",
      "endpoint": "/resolve/ui_component"
    },
    {
      "type": "ui_state",
      "description": "Resolves UI application state",
      "protocol": "http",
      "endpoint": "/resolve/ui_state"
    }
  ],

  "activities": [
    {
      "id": "render-impulse-collection",
      "category": "ui",
      "description": "Render a collection of impulses as UI",
      "templatePath": "templates/render-impulse-collection.json"
    },
    {
      "id": "update-from-execution-trace",
      "category": "ui",
      "description": "Update UI from execution trace",
      "templatePath": "templates/update-from-execution-trace.json"
    }
  ],

  "dependencies": {
    "vessels": ["terminal"],
    "services": ["activity-api", "surrealdb"]
  },

  "endpoints": {
    "http": "http://react-renderer.activity-system.svc.cluster.local:3000",
    "health": "/health",
    "resolve": "/resolve",
    "activities": "/activities"
  }
}
```

#### B. Resolver Implementation (`src/resolvers/index.ts`)

```typescript
import { Surreal } from 'surrealdb'

// Resolver registry
const resolvers = new Map<string, ResolverFunction>()

export type ResolverFunction = (pointer: ImpulsePointer) => Promise<any>

// Register a resolver for an impulse type
export function registerResolver(
  type: string,
  resolver: ResolverFunction
) {
  resolvers.set(type, resolver)
  console.log(`[Resolver] Registered: ${type}`)
}

// Resolve an impulse pointer
export async function resolve(pointer: ImpulsePointer): Promise<any> {
  const resolver = resolvers.get(pointer.type)

  if (!resolver) {
    throw new Error(`No resolver for impulse type: ${pointer.type}`)
  }

  return await resolver(pointer)
}

// UI Component resolver
registerResolver("ui_component", async (pointer) => {
  const { component, props } = pointer

  // Load component template from database
  const db = new Surreal()
  await db.connect(process.env.SURREALDB_URL!)

  const [template] = await db.query(`
    SELECT * FROM ui_component_template
    WHERE component = $component
  `, { component })

  if (!template) {
    throw new Error(`Unknown component: ${component}`)
  }

  return {
    component: template.component,
    props: props,
    layout: template.defaultLayout,
    styles: template.styles
  }
})

// UI State resolver
registerResolver("ui_state", async (pointer) => {
  const { path, query } = pointer

  // Resolve state from application state store
  const state = await getApplicationState(path, query)
  return state
})
```

#### C. Delegation to Other Vessels (`src/integrations/terminal.ts`)

```typescript
// Delegate terminal_snapshot resolution to terminal vessel
import { registerResolver } from '../resolvers'

const TERMINAL_VESSEL_URL = process.env.TERMINAL_VESSEL_URL ||
  "http://terminal.activity-system.svc.cluster.local:8080"

registerResolver("terminal_snapshot", async (pointer) => {
  // Delegate to terminal vessel
  const response = await fetch(`${TERMINAL_VESSEL_URL}/resolve`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ pointer })
  })

  if (!response.ok) {
    throw new Error(
      `Terminal resolution failed: ${response.statusText}`
    )
  }

  const { content } = await response.json()
  return content
})
```

#### D. Activity Executor (`src/activities/executor.ts`)

```typescript
import { nanoid } from 'nanoid'
import { resolve } from '../resolvers'

export async function executeActivity(
  templateId: string,
  options: { impulses: Impulse[] }
): Promise<Execution> {
  // Load activity template
  const template = await loadTemplate(templateId)

  const execution: Execution = {
    id: nanoid(),
    activityId: templateId,
    vesselId: "react-renderer",
    status: "in_progress",
    tasks: [],
    impulses: options.impulses,
    startedAt: new Date()
  }

  try {
    // Execute each task
    for (const task of template.tasks) {
      const taskResult = await executeTask(task, execution)
      execution.tasks.push(taskResult)

      if (!taskResult.success) {
        execution.status = "failed"
        break
      }
    }

    if (execution.status === "in_progress") {
      execution.status = "success"
    }
  } catch (error) {
    execution.status = "failed"
    execution.error = String(error)
  } finally {
    execution.completedAt = new Date()
  }

  // Record trace to activity-api
  await recordTrace(execution)

  return execution
}

async function executeTask(
  task: ActivityTask,
  execution: Execution
): Promise<TaskResult> {
  const result: TaskResult = {
    taskId: task.id,
    status: "running",
    toolCalls: [],
    startedAt: new Date()
  }

  try {
    // Resolve impulses for this task
    const resolvedImpulses = await Promise.all(
      execution.impulses
        .filter(imp => task.impulseRefs.includes(imp.id))
        .map(imp => resolve(imp.pointer))
    )

    // Execute task logic (tool calls, state changes)
    const output = await task.execute(resolvedImpulses)

    result.status = "success"
    result.output = output
    result.completedAt = new Date()
  } catch (error) {
    result.status = "failed"
    result.error = String(error)
    result.completedAt = new Date()
  }

  return result
}
```

#### E. HTTP Server (`src/index.ts`)

```typescript
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { resolve } from './resolvers'
import { executeActivity } from './activities/executor'
import vesselManifest from '../vessel.json'

const app = new Hono()

// Enable CORS for browser access
app.use('*', cors())

// Health check
app.get('/health', (c) => {
  return c.json({
    status: 'ok',
    vessel: vesselManifest.id,
    version: vesselManifest.version
  })
})

// Vessel manifest (for discovery)
app.get('/manifest', (c) => {
  return c.json(vesselManifest)
})

// Resolve impulse
app.post('/resolve', async (c) => {
  const { pointer } = await c.req.json()

  try {
    const content = await resolve(pointer)
    return c.json({ content })
  } catch (error) {
    return c.json(
      { error: String(error) },
      400
    )
  }
})

// Execute activity
app.post('/activities/execute', async (c) => {
  const { templateId, impulses } = await c.req.json()

  try {
    const execution = await executeActivity(templateId, { impulses })
    return c.json({ execution })
  } catch (error) {
    return c.json(
      { error: String(error) },
      500
    )
  }
})

// SSE event stream for real-time updates
app.get('/events', (c) => {
  return streamSSE(c, async (stream) => {
    // Subscribe to impulse updates
    const subscription = impulseStore.subscribe((impulse) => {
      stream.writeSSE({
        data: JSON.stringify({ impulse }),
        event: "impulse_updated"
      })
    })

    // Cleanup
    c.req.raw.signal.addEventListener("abort", () => {
      subscription.unsubscribe()
    })
  })
})

const port = Number(process.env.PORT) || 3000
console.log(`[Vessel] react-renderer starting on port ${port}`)

export default {
  port,
  fetch: app.fetch
}
```

### Phase 3: Database Schema

Vessels can define their own tables for state they own:

```sql
-- sql/schemas/001-ui-state.surql

-- UI component templates
DEFINE TABLE ui_component_template SCHEMAFULL
  PERMISSIONS FOR select WHERE true
               FOR create, update, delete WHERE $auth.role = 'admin';

DEFINE FIELD component ON ui_component_template TYPE string;
DEFINE FIELD version ON ui_component_template TYPE string;
DEFINE FIELD defaultLayout ON ui_component_template TYPE object;
DEFINE FIELD styles ON ui_component_template TYPE object;
DEFINE FIELD requiredProps ON ui_component_template TYPE array;

-- UI interaction metrics (for learning)
DEFINE TABLE ui_interaction SCHEMAFULL
  PERMISSIONS FOR select, create WHERE org_id = $auth.org_id;

DEFINE FIELD org_id ON ui_interaction TYPE string;
DEFINE FIELD execution_id ON ui_interaction TYPE string;
DEFINE FIELD template_id ON ui_interaction TYPE string;
DEFINE FIELD variant ON ui_interaction TYPE string;
DEFINE FIELD outcome ON ui_interaction TYPE string
  ASSERT $value IN ['success', 'failure'];
DEFINE FIELD time_to_action ON ui_interaction TYPE int;
DEFINE FIELD impulse_utilization ON ui_interaction TYPE float;
DEFINE FIELD created_at ON ui_interaction TYPE datetime DEFAULT time::now();
```

### Phase 4: Deployment Configuration

#### A. Dockerfile

```dockerfile
# Dockerfile
FROM oven/bun:1.1.3

WORKDIR /app

# Copy package files
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

# Copy source
COPY . .

# Expose port
EXPOSE 3000

# Run
CMD ["bun", "run", "start"]
```

#### B. Helm Chart (`helm/charts/react-renderer/Chart.yaml`)

```yaml
apiVersion: v2
name: react-renderer
description: React renderer vessel for UI visualization
type: application
version: 0.1.0
appVersion: "0.1.0"
```

#### C. Helm Values (`helm/charts/react-renderer/values.yaml`)

```yaml
replicaCount: 1

image:
  repository: react-renderer
  pullPolicy: IfNotPresent
  tag: "latest"

service:
  type: ClusterIP
  port: 3000

env:
  PORT: "3000"
  SURREALDB_URL: "http://surrealdb.activity-system.svc.cluster.local:8000"
  ACTIVITY_API_URL: "http://metabob-activity-api.activity-system.svc.cluster.local:8080"
  TERMINAL_VESSEL_URL: "http://terminal.activity-system.svc.cluster.local:8080"
  LOG_LEVEL: "info"

resources:
  requests:
    memory: "256Mi"
    cpu: "100m"
  limits:
    memory: "512Mi"
    cpu: "500m"

# Istio virtual service for ingress
virtualService:
  enabled: true
  hosts:
    - "ui.metabob.local"
  gateway: "activity-system-gateway"
```

#### D. Kubernetes Deployment (`helm/charts/react-renderer/templates/deployment.yaml`)

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: {{ include "react-renderer.fullname" . }}
  labels:
    {{- include "react-renderer.labels" . | nindent 4 }}
spec:
  replicas: {{ .Values.replicaCount }}
  selector:
    matchLabels:
      {{- include "react-renderer.selectorLabels" . | nindent 6 }}
  template:
    metadata:
      labels:
        {{- include "react-renderer.selectorLabels" . | nindent 8 }}
    spec:
      containers:
      - name: {{ .Chart.Name }}
        image: "{{ .Values.image.repository }}:{{ .Values.image.tag }}"
        imagePullPolicy: {{ .Values.image.pullPolicy }}
        ports:
        - name: http
          containerPort: {{ .Values.env.PORT }}
          protocol: TCP
        env:
        {{- range $key, $value := .Values.env }}
        - name: {{ $key }}
          value: {{ $value | quote }}
        {{- end }}
        livenessProbe:
          httpGet:
            path: /health
            port: http
          initialDelaySeconds: 10
          periodSeconds: 30
        readinessProbe:
          httpGet:
            path: /health
            port: http
          initialDelaySeconds: 5
          periodSeconds: 10
        resources:
          {{- toYaml .Values.resources | nindent 12 }}
```

## Vessel Discovery and Wiring

### Discovery Mechanism

Vessels discover each other through **three mechanisms**:

#### 1. Static Configuration (Environment Variables)

```yaml
# In helmfile or values.yaml
env:
  TERMINAL_VESSEL_URL: "http://terminal.activity-system.svc.cluster.local:8080"
  MINIBOB_VESSEL_URL: "http://minibob.activity-system.svc.cluster.local:8080"
```

Used for: Direct vessel-to-vessel communication

#### 2. Vessel Registry (Centralized Discovery)

```typescript
// src/integrations/registry.ts

interface VesselInfo {
  id: string
  version: string
  endpoints: {
    http: string
    health: string
    resolve: string
  }
  resolvers: Array<{
    type: string
    endpoint: string
  }>
}

class VesselRegistry {
  private vessels = new Map<string, VesselInfo>()

  async register(manifest: VesselManifest) {
    // Register vessel with activity-api
    await fetch("http://activity-api/v2/vessels/register", {
      method: "POST",
      body: JSON.stringify(manifest)
    })

    this.vessels.set(manifest.id, {
      id: manifest.id,
      version: manifest.version,
      endpoints: manifest.endpoints,
      resolvers: manifest.resolvers
    })
  }

  async discover(vesselId: string): Promise<VesselInfo | null> {
    // Check local cache
    if (this.vessels.has(vesselId)) {
      return this.vessels.get(vesselId)!
    }

    // Query activity-api registry
    const response = await fetch(
      `http://activity-api/v2/vessels/${vesselId}`
    )

    if (response.ok) {
      const vessel = await response.json()
      this.vessels.set(vesselId, vessel)
      return vessel
    }

    return null
  }

  async findResolverForType(type: string): Promise<string | null> {
    // Query all vessels for resolver
    const response = await fetch(
      `http://activity-api/v2/vessels/resolver/${type}`
    )

    if (response.ok) {
      const { vesselId, endpoint } = await response.json()
      const vessel = await this.discover(vesselId)
      return vessel ? vessel.endpoints.http + endpoint : null
    }

    return null
  }
}

export const vesselRegistry = new VesselRegistry()
```

#### 3. DNS Service Discovery (Kubernetes)

All vessels are accessible via predictable DNS:

```
<vessel-name>.activity-system.svc.cluster.local:<port>
```

Example:
- `terminal.activity-system.svc.cluster.local:8080`
- `minibob.activity-system.svc.cluster.local:8080`
- `react-renderer.activity-system.svc.cluster.local:3000`

### Wiring Pattern: Resolver Chain

When an impulse needs resolution, it flows through a chain:

```
1. Local Resolution Attempt
   ↓ (not found)
2. Vessel Registry Lookup
   ↓ (found: terminal vessel)
3. HTTP Request to Vessel
   ↓
4. Vessel Resolves Locally
   ↓
5. Response Returns
```

Implementation:

```typescript
// src/resolvers/chain.ts

export async function resolveImpulse(
  impulse: Impulse
): Promise<any> {
  // Step 1: Try local resolvers
  if (resolvers.has(impulse.pointer.type)) {
    const resolver = resolvers.get(impulse.pointer.type)!
    return await resolver(impulse.pointer)
  }

  // Step 2: Find resolver via registry
  const resolverUrl = await vesselRegistry.findResolverForType(
    impulse.pointer.type
  )

  if (!resolverUrl) {
    throw new Error(
      `No resolver found for impulse type: ${impulse.pointer.type}`
    )
  }

  // Step 3: Delegate to remote vessel
  const response = await fetch(resolverUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ pointer: impulse.pointer })
  })

  if (!response.ok) {
    throw new Error(`Resolution failed: ${response.statusText}`)
  }

  const { content } = await response.json()
  return content
}
```

## Vessel Lifecycle

### Startup Sequence

```typescript
// src/index.ts

async function startVessel() {
  console.log("[Vessel] Starting react-renderer...")

  // 1. Load vessel manifest
  const manifest = await import('../vessel.json')

  // 2. Connect to infrastructure
  await connectToSurrealDB()
  await connectToRedis()

  // 3. Load resolvers
  await import('./resolvers')
  await import('./integrations/terminal')

  console.log(`[Vessel] Loaded ${resolvers.size} resolvers`)

  // 4. Load activity templates
  const templates = await loadActivityTemplates()
  console.log(`[Vessel] Loaded ${templates.length} activity templates`)

  // 5. Register with vessel registry
  await vesselRegistry.register(manifest)
  console.log("[Vessel] Registered with vessel registry")

  // 6. Start HTTP server
  const port = Number(process.env.PORT) || 3000
  Bun.serve({
    port,
    fetch: app.fetch
  })

  console.log(`[Vessel] Listening on port ${port}`)

  // 7. Health check loop
  setInterval(async () => {
    await vesselRegistry.heartbeat(manifest.id)
  }, 30000)
}

startVessel().catch(err => {
  console.error("[Vessel] Failed to start:", err)
  process.exit(1)
})
```

### Shutdown Sequence

```typescript
// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log("[Vessel] Received SIGTERM, shutting down...")

  // 1. Deregister from registry
  await vesselRegistry.deregister(manifest.id)

  // 2. Close connections
  await surrealDB.close()
  await redis.disconnect()

  // 3. Exit
  process.exit(0)
})
```

## Communication Protocols

### HTTP/JSON (Primary)

Used for:
- Impulse resolution
- Activity execution
- Vessel discovery

Example request:
```bash
curl -X POST http://terminal.activity-system.svc.cluster.local:8080/resolve \
  -H "Content-Type: application/json" \
  -d '{
    "pointer": {
      "type": "terminal_snapshot",
      "terminalId": "term_abc123",
      "includeScrollback": true
    }
  }'
```

### Server-Sent Events (Real-time Updates)

Used for:
- Live execution updates
- Impulse change notifications
- Activity progress

Example:
```typescript
// Client subscribes to events
const eventSource = new EventSource(
  "http://react-renderer:3000/events"
)

eventSource.addEventListener("impulse_updated", (event) => {
  const { impulse } = JSON.parse(event.data)
  updateUI(impulse)
})
```

### MCP Protocol (Optional, Future)

For structured inter-vessel communication:

```typescript
// Send MCP message
await mcpClient.send({
  method: "impulse/resolve",
  params: {
    pointer: { type: "terminal_snapshot", terminalId: "term_xyz" }
  }
})
```

## Complete Example: Wiring React-Renderer

### Step 1: Create Vessel

```bash
cd repos/
./scripts/create-vessel.sh react-renderer
```

### Step 2: Implement Resolvers

```bash
cd react-renderer
bun add hono surrealdb nanoid
```

Create files as shown in Phase 2.

### Step 3: Build Container

```bash
cd repos/deployment
./scripts/build-vessel.sh react-renderer
```

### Step 4: Add to Helmfile

```yaml
# helm/helmfile.yaml

releases:
  # ... existing releases ...

  - name: react-renderer
    namespace: activity-system
    chart: ./charts/react-renderer
    values:
      - ./charts/react-renderer/values.yaml
    needs:
      - surrealdb
      - metabob-activity-api
```

### Step 5: Deploy

```bash
cd helm
helmfile -e local sync
```

### Step 6: Verify

```bash
# Check vessel is running
kubectl get pods -n activity-system -l app=react-renderer

# Check health
curl http://ui.metabob.local/health

# Check manifest
curl http://ui.metabob.local/manifest

# Test resolver
curl -X POST http://ui.metabob.local/resolve \
  -H "Content-Type: application/json" \
  -d '{
    "pointer": {
      "type": "ui_component",
      "component": "TaskList",
      "props": {}
    }
  }'
```

## Summary: Vessel Creation Checklist

- [ ] Create vessel codebase in `repos/<vessel-name>`
- [ ] Add `vessel.json` manifest
- [ ] Implement resolvers for owned impulse types
- [ ] Implement activity executor
- [ ] Add HTTP server with standard endpoints
- [ ] Create database schemas if needed
- [ ] Write Dockerfile
- [ ] Create Helm chart in `helm/charts/<vessel-name>`
- [ ] Add to helmfile deployment
- [ ] Build container image
- [ ] Deploy to Kubernetes
- [ ] Verify health and resolver endpoints
- [ ] Test impulse resolution
- [ ] Test activity execution
- [ ] Record first traces for learning

Vessels are discovered via DNS, communicate via HTTP/JSON, and learn via traces recorded to activity-api. Each vessel independently versions, deploys, and evolves.
