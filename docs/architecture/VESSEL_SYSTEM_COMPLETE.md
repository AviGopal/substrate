# Complete Vessel System Architecture

## Overview

This document synthesizes all vessel architecture concepts into a complete, implementable system.

## Core Concepts

### 1. Impulses with Routing
Every impulse pointer contains routing metadata:

```typescript
interface ImpulsePointer {
  type: string                    // What kind of data
  [key: string]: any              // Type-specific fields

  routing?: {
    instanceId?: string           // Preferred instance
    instanceEndpoint?: string     // Direct endpoint
    fallback?: FallbackStrategy   // What to do if unavailable
    persistence?: PersistenceInfo // Where data is stored
    system?: SystemLocation       // Cross-system routing
    authorization?: AuthInfo      // Access control
    strategy?: RoutingStrategy    // Load balancing strategy
  }
}
```

### 2. Vessels with Capabilities
Vessels register what they can resolve:

```typescript
interface VesselRegistration {
  vesselId: string              // Vessel type identifier
  instanceId: string            // Specific instance identifier
  vesselName: string            // Human-readable name
  endpoint: string              // HTTP endpoint for resolution

  shapes: string[]              // Impulse types this vessel resolves

  instance: {
    ownedStates?: string[]      // States owned by this instance
    stateful: boolean           // Does this vessel maintain state?
    ephemeral: boolean          // Is state lost on restart?
    routing: {
      strategy: RoutingStrategy // How to route to this vessel
      fallback: FallbackStrategy
    }
  }

  system: {
    cluster: string             // Kubernetes cluster
    namespace: string           // K8s namespace
    region: string              // Cloud region
    organization: string        // Org/tenant
  }
}
```

### 3. Discovery with Filters
Find vessels with sophisticated queries:

```
GET /v2/vessels/discover?shape=X&stateId=Y&cluster=Z&region=R
```

Returns vessels matching ALL criteria.

## Complete Flow: MiniBob → Terminal → React-Renderer

### Step 1: Terminal Creates Session (Stateful)

```typescript
// Terminal vessel (pod-abc)
app.post('/terminal/create', async (c) => {
  const terminalId = nanoid()
  const terminal = new Terminal()

  terminals.set(terminalId, terminal)

  // Register state ownership
  await fetch(`${ACTIVITY_API}/v2/vessels/register`, {
    method: "POST",
    body: JSON.stringify({
      vesselId: "terminal",
      instanceId: process.env.HOSTNAME,  // terminal-pod-abc
      endpoint: `http://${process.env.POD_IP}:8080`,
      shapes: ["terminal_snapshot"],
      instance: {
        ownedStates: [terminalId],
        stateful: true,
        ephemeral: true,
        routing: {
          strategy: "affinity",
          fallback: "fail"
        }
      }
    })
  })

  // Return pointer with routing
  return c.json({
    terminalId,
    pointer: {
      type: "terminal_snapshot",
      terminalId,
      routing: {
        instanceId: process.env.HOSTNAME,
        instanceEndpoint: `http://${process.env.POD_IP}:8080`,
        fallback: "fail"
      }
    }
  })
})
```

### Step 2: MiniBob Executes Activity

```typescript
// MiniBob (any pod)
async function executeActivity(templateId: string) {
  const execution = {
    id: nanoid(),
    activityId: templateId,
    tasks: [],
    status: "in_progress"
  }

  // Create terminal for this execution
  const terminalResponse = await fetch("http://terminal/terminal/create", {
    method: "POST"
  })

  const { terminalId, pointer: terminalPointer } = await terminalResponse.json()
  execution.terminalId = terminalId

  // Execute activity (produces terminal output)
  for (const task of template.tasks) {
    const result = await executeTask(task, terminalId)
    execution.tasks.push(result)
  }

  // Store execution trace (persistent)
  const db = await getSurrealDBClient()
  await db.query(`CREATE activity_execution_trace CONTENT $execution`, {
    execution
  })

  // Create execution trace pointer (persistent with fallback)
  const executionPointer = {
    type: "activityExecutionTrace",
    executionId: execution.id,
    routing: {
      instanceId: process.env.HOSTNAME,
      instanceEndpoint: `http://${process.env.POD_IP}:8080`,
      fallback: "any-instance",
      persistence: {
        layer: "database",
        location: `surrealdb://activity_execution_trace:${execution.id}`
      }
    }
  }

  // Create UI impulse combining execution + terminal
  const uiPointer = {
    type: "ui_component",
    component: "ExecutionViewer",
    props: {
      executionPointer,
      terminalPointer
    }
  }

  // Notify react-renderer
  await fetch("http://react-renderer/impulses/notify", {
    method: "POST",
    body: JSON.stringify({ pointer: uiPointer })
  })

  return execution
}
```

### Step 3: React-Renderer Resolves Everything

```typescript
// React-renderer receives notification
app.post('/impulses/notify', async (c) => {
  const { pointer } = await c.req.json()

  // Execute render activity
  await executeActivity("render-execution-viewer", {
    impulses: [{ pointer }]
  })

  return c.json({ status: "rendering" })
})

// Render activity resolves nested pointers
async function renderExecutionViewer(uiPointer: ImpulsePointer) {
  const { executionPointer, terminalPointer } = uiPointer.props

  // Resolve execution trace (persistent, can use any MiniBob)
  const execution = await resolveWithRouting({
    pointer: executionPointer,
    requester: { vesselId: "react-renderer" }
  })

  // Resolve terminal snapshot (stateful, must use specific pod)
  const terminal = await resolveWithRouting({
    pointer: terminalPointer,
    requester: { vesselId: "react-renderer" }
  })

  // Render component
  const component = renderComponent("ExecutionViewer", {
    execution: execution.content,
    terminal: terminal.content
  })

  // Stream to browser
  sendSSE({ type: "ui_updated", component })
}

// Resolution with routing
async function resolveWithRouting(context: ResolutionContext) {
  const { pointer } = context
  const { routing } = pointer

  // Step 1: Try preferred instance
  if (routing?.instanceEndpoint) {
    try {
      return await fetch(`${routing.instanceEndpoint}/resolve`, {
        method: "POST",
        body: JSON.stringify({ pointer })
      }).then(r => r.json())
    } catch (error) {
      console.warn(`Preferred instance unavailable`, error)
    }
  }

  // Step 2: Check fallback strategy
  if (routing?.fallback === "fail") {
    throw new Error("Preferred instance unavailable and fallback disabled")
  }

  // Step 3: Try persistent store
  if (routing?.fallback === "persistent-store" && routing.persistence) {
    try {
      return await resolveFromPersistence(routing.persistence)
    } catch (error) {
      console.warn("Persistence resolution failed", error)
    }
  }

  // Step 4: Try any instance
  if (routing?.fallback === "any-instance") {
    const vessels = await discoverVessels(pointer.type, routing.system)

    for (const vessel of vessels) {
      try {
        return await fetch(`${vessel.endpoint}/resolve`, {
          method: "POST",
          body: JSON.stringify({ pointer })
        }).then(r => r.json())
      } catch (error) {
        console.warn(`Instance ${vessel.instanceId} failed`, error)
      }
    }
  }

  throw new Error("Unable to resolve impulse")
}
```

### Step 4: Browser Receives Update

```typescript
// Browser-side React component
function ExecutionViewer() {
  const [execution, setExecution] = useState(null)
  const [terminal, setTerminal] = useState(null)

  useEffect(() => {
    // Subscribe to SSE updates
    const eventSource = new EventSource("/events")

    eventSource.addEventListener("ui_updated", (event) => {
      const { component } = JSON.parse(event.data)

      if (component.type === "ExecutionViewer") {
        setExecution(component.props.execution)
        setTerminal(component.props.terminal)
      }
    })

    return () => eventSource.close()
  }, [])

  if (!execution || !terminal) {
    return <div>Loading...</div>
  }

  return (
    <div className="execution-viewer">
      <h2>{execution.activity.name}</h2>

      <TaskList tasks={execution.tasks} />

      <TerminalOutput>
        {terminal.output}
      </TerminalOutput>

      <Progress
        value={execution.completedTasks}
        max={execution.tasks.length}
      />
    </div>
  )
}
```

## Resolution Paths

### Path A: Ephemeral State (Terminal)
```
1. Pointer includes instanceId: terminal-pod-abc
2. Try direct endpoint: http://10.0.1.5:8080/resolve
3. SUCCESS or FAIL (no fallback)
```

### Path B: Persistent State (Execution)
```
1. Pointer includes instanceId: minibob-pod-def
2. Try direct endpoint: http://10.0.1.8:8080/resolve
3. FAIL (pod crashed)
4. Fallback: any-instance
5. Discover: GET /v2/vessels/discover?shape=activityExecutionTrace
6. Try minibob-pod-ghi: http://10.0.1.9:8080/resolve
   - Check cache → miss
   - Query DB → hit
7. SUCCESS (from database)
```

### Path C: No Routing Hint (State Discovery)
```
1. Pointer has terminalId but no instanceId
2. Discover by state: GET /v2/vessels/discover?shape=terminal_snapshot&stateId=term_123
3. Registry returns: terminal-pod-abc (owns term_123)
4. Resolve: http://10.0.1.5:8080/resolve
5. SUCCESS
```

### Path D: Cross-System (Different Cluster)
```
1. Pointer includes system.cluster: analysis-us-west
2. Check local cluster → not found
3. Query regional registry: https://registry.us-west.acme.internal/discover
4. Returns: analysis-pod-abc (endpoint: https://analysis.acme.internal)
5. Resolve with auth token: https://analysis.acme.internal/resolve
6. SUCCESS
```

## Database Schema

```sql
-- vessel_capabilities table (updated)
DEFINE TABLE vessel_capabilities SCHEMALESS;

DEFINE FIELD vessel_id ON vessel_capabilities TYPE string;
DEFINE FIELD instance_id ON vessel_capabilities TYPE string;
DEFINE FIELD vessel_name ON vessel_capabilities TYPE string;
DEFINE FIELD endpoint ON vessel_capabilities TYPE string;
DEFINE FIELD pod_name ON vessel_capabilities TYPE option<string>;
DEFINE FIELD pod_ip ON vessel_capabilities TYPE option<string>;

DEFINE FIELD shapes ON vessel_capabilities TYPE array;
DEFINE FIELD owned_states ON vessel_capabilities TYPE option<array>;

DEFINE FIELD routing ON vessel_capabilities TYPE option<object>;
-- routing.strategy: "affinity" | "round-robin" | "consistent-hash"
-- routing.fallback: "any-instance" | "persistent-store" | "fail"
-- routing.stateful: boolean
-- routing.ephemeral: boolean

DEFINE FIELD system ON vessel_capabilities TYPE option<object>;
-- system.cluster, system.namespace, system.region, system.organization

DEFINE FIELD metadata ON vessel_capabilities TYPE object DEFAULT {};
DEFINE FIELD registered_at ON vessel_capabilities TYPE datetime;
DEFINE FIELD last_seen ON vessel_capabilities TYPE datetime;

DEFINE INDEX instance_id_idx ON vessel_capabilities FIELDS instance_id UNIQUE;
DEFINE INDEX shapes_idx ON vessel_capabilities FIELDS shapes;
DEFINE INDEX owned_states_idx ON vessel_capabilities FIELDS owned_states;
DEFINE INDEX last_seen_idx ON vessel_capabilities FIELDS last_seen;
```

## API Endpoints (Complete)

### Vessel Registration
```
POST /v2/vessels/register
Body: VesselRegistration (see above)
Response: { success: true, vesselId, timestamp }
```

### Vessel Discovery
```
GET /v2/vessels/discover?shape=X&stateId=Y&cluster=Z&region=R
Response: { vessels: VesselInstance[], found: boolean }
```

### Vessel Heartbeat
```
POST /v2/vessels/heartbeat
Body: { pod_name, namespace, status, current_activity, metrics }
Response: { success: true, timestamp }
```

### Vessel Status
```
GET /v2/vessels/status
Response: { vessels: VesselStatus[], total: number }
```

### Vessel Capabilities
```
GET /v2/vessels/capabilities
Response: { vessels: VesselCapability[], total: number }
```

### Impulse Resolution
```
POST /resolve
Body: { pointer: ImpulsePointer }
Response: { content: any }
```

## Deployment Configuration

### Helm Values (Complete)

```yaml
# Terminal vessel
terminal:
  replicaCount: 3
  env:
    PORT: "8080"
    ACTIVITY_API_URL: "http://metabob-activity-api:8080"
    POD_IP:
      valueFrom:
        fieldRef:
          fieldPath: status.podIP
    HOSTNAME:
      valueFrom:
        fieldRef:
          fieldPath: metadata.name
    CLUSTER_NAME: "production-us-east"
    REGION: "us-east-1"

# MiniBob vessel
minibob:
  replicaCount: 3
  env:
    PORT: "8080"
    ACTIVITY_API_URL: "http://metabob-activity-api:8080"
    SURREALDB_URL: "http://surrealdb:8000"
    POD_IP:
      valueFrom:
        fieldRef:
          fieldPath: status.podIP
    HOSTNAME:
      valueFrom:
        fieldRef:
          fieldPath: metadata.name
    CLUSTER_NAME: "production-us-east"
    REGION: "us-east-1"

# React-renderer vessel
reactRenderer:
  replicaCount: 1
  env:
    PORT: "3000"
    ACTIVITY_API_URL: "http://metabob-activity-api:8080"
    CLUSTER_NAME: "production-us-east"
    REGION: "us-east-1"
```

## Implementation Checklist

### For Stateful Vessels (e.g., Terminal)

- [ ] Track state ownership in memory
- [ ] Register owned states with activity-api on state creation
- [ ] Update registry when state is deleted
- [ ] Include routing.instanceId in created pointers
- [ ] Set routing.fallback = "fail" for ephemeral state
- [ ] Validate instance ownership in /resolve endpoint
- [ ] Return 404 if state not owned by this instance

### For Stateless Vessels (e.g., Analysis Service)

- [ ] Register vessel capabilities on startup
- [ ] Set routing.fallback = "any-instance"
- [ ] Implement /resolve without instance affinity
- [ ] Support resolution from any instance
- [ ] (Optional) Use consistent hashing for cache efficiency

### For Persistent Vessels (e.g., MiniBob)

- [ ] Store state in SurrealDB/Postgres
- [ ] Include persistence info in pointers
- [ ] Set routing.fallback = "any-instance" or "persistent-store"
- [ ] Try in-memory cache first, fallback to DB
- [ ] Return data with source indicator (cache/database)

### For All Vessels

- [ ] Implement POST /resolve endpoint
- [ ] Implement GET /health endpoint
- [ ] Call POST /v2/vessels/register on startup
- [ ] Send POST /v2/vessels/heartbeat every 30s
- [ ] Handle routing in resolution (respect instanceId hints)
- [ ] Query /v2/vessels/discover for delegation
- [ ] Include POD_IP and HOSTNAME in environment
- [ ] Add system.cluster and system.region to registration

## Verification

### Test Stateful Routing

```bash
# Create terminal session
curl -X POST http://terminal:8080/terminal/create
# Returns: { terminalId, pointer: { routing: { instanceId: "terminal-pod-abc" } } }

# Verify state ownership in registry
curl "http://activity-api:8080/v2/vessels/discover?shape=terminal_snapshot&stateId=<terminalId>"
# Returns: vessel with instanceId: "terminal-pod-abc"

# Resolve via routing
curl -X POST http://react-renderer:3000/resolve \
  -d '{"pointer": { "type": "terminal_snapshot", "terminalId": "...", "routing": {...} }}'
# Should route to terminal-pod-abc specifically
```

### Test Fallback

```bash
# Create execution in minibob-pod-abc
curl -X POST http://minibob-pod-abc:8080/activity/execute -d '{...}'
# Returns: pointer with instanceId: "minibob-pod-abc", fallback: "any-instance"

# Kill minibob-pod-abc
kubectl delete pod minibob-pod-abc

# Resolve from react-renderer
curl -X POST http://react-renderer:3000/resolve \
  -d '{"pointer": { "type": "activityExecutionTrace", "executionId": "...", "routing": {...} }}'
# Should fallback to minibob-pod-def or minibob-pod-ghi, fetch from DB
```

### Test Cross-System

```bash
# Query for vessel in different cluster
curl "http://activity-api:8080/v2/vessels/discover?shape=code_analysis&cluster=analysis-us-west"
# Returns: vessel in different cluster with external endpoint
```

## Summary

**Complete vessel system with**:
1. ✅ Stateful routing (instance affinity)
2. ✅ Persistent fallback (any instance + DB)
3. ✅ Cross-system discovery (multi-cluster, multi-region)
4. ✅ State-based discovery (find vessel owning state)
5. ✅ Authorization (org isolation)
6. ✅ Graceful degradation (multi-level fallback)
7. ✅ Load balancing (consistent hashing, round-robin)
8. ✅ Hierarchical discovery (local → cluster → region → global)

**All using existing infrastructure** - vessels just need to:
- Register with instance-level metadata
- Include routing hints in pointers
- Respect routing during resolution
- Track state ownership (for stateful vessels)
