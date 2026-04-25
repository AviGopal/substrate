# Stateful Vessel Routing

## The Problem

Not every vessel instance can resolve every impulse, even if it advertises that capability.

### Problem 1: Instance Affinity
```
Terminal vessel has 3 replicas:
- terminal-pod-abc → owns terminal sessions T1, T2
- terminal-pod-def → owns terminal sessions T3, T4
- terminal-pod-ghi → owns terminal sessions T5, T6

Impulse: { type: "terminal_snapshot", terminalId: "T3" }
Must route to: terminal-pod-def (not abc or ghi)
```

### Problem 2: Cross-System Discovery
```
Organization has vessels across multiple systems:
- MiniBob in AWS cluster
- Terminal in on-prem datacenter
- React-renderer in GCP cluster

How does MiniBob discover Terminal across system boundaries?
```

### Problem 3: Authorization
```
Vessel A (org: acme) requests impulse
Vessel B (org: umbrella) has the data

Should B resolve for A? Org isolation? Access control?
```

### Problem 4: Ephemeral vs Persistent State
```
MiniBob pod crashes mid-execution.
Execution trace was in memory (ephemeral).
New pod can't resolve it.

Should impulse pointer indicate persistence layer?
```

## Solution Architecture

### Layer 1: Pointer-Based Routing

**The impulse pointer itself carries routing hints:**

```typescript
interface ImpulsePointer {
  // Standard fields
  type: string

  // Routing metadata
  routing?: {
    // Preferred instance (if stateful)
    instanceId?: string
    instanceEndpoint?: string

    // Fallback strategy
    fallback?: "any-instance" | "persistent-store" | "fail"

    // Persistence hint
    persistence?: {
      layer: "memory" | "database" | "filesystem" | "cache"
      location?: string  // SurrealDB table, Redis key, etc.
    }

    // Cross-system routing
    system?: {
      cluster?: string
      region?: string
      organization?: string
    }

    // Authorization
    authorization?: {
      orgId: string
      permissions: string[]
    }
  }
}
```

**Example: Stateful terminal pointer**

```typescript
{
  type: "terminal_snapshot",
  terminalId: "term_abc123",
  routing: {
    // This specific pod owns this terminal
    instanceId: "terminal-pod-abc123",
    instanceEndpoint: "http://10.0.1.5:8080",

    // If pod is gone, don't fallback (terminal state is ephemeral)
    fallback: "fail",

    persistence: {
      layer: "memory",
      location: null
    }
  }
}
```

**Example: Persistent execution trace pointer**

```typescript
{
  type: "activityExecutionTrace",
  executionId: "exec_xyz789",
  routing: {
    // Prefer the pod that created it (might have in-memory cache)
    instanceId: "minibob-pod-def456",
    instanceEndpoint: "http://10.0.1.8:8080",

    // But any MiniBob can fetch from DB if preferred instance unavailable
    fallback: "any-instance",

    persistence: {
      layer: "database",
      location: "surrealdb://activity_execution_trace:exec_xyz789"
    }
  }
}
```

**Example: Cross-system pointer**

```typescript
{
  type: "code_analysis",
  analysisId: "analysis_123",
  routing: {
    // Analysis lives in different cluster
    system: {
      cluster: "analysis-cluster-us-west",
      region: "us-west-2",
      organization: "acme-corp"
    },

    // Route via federated discovery
    instanceEndpoint: "https://analysis.acme.internal/api",

    fallback: "persistent-store",

    persistence: {
      layer: "database",
      location: "postgres://analysis_results:123"
    },

    authorization: {
      orgId: "acme-corp",
      permissions: ["analysis:read"]
    }
  }
}
```

### Layer 2: Instance-Aware Registry

**Vessels register instance-level capabilities:**

```typescript
// POST /v2/vessels/register
{
  vesselId: "terminal",
  instanceId: "terminal-pod-abc123",  // NEW: instance identifier
  podName: "terminal-pod-abc123",
  endpoint: "http://10.0.1.5:8080",

  shapes: ["terminal_snapshot", "terminal_command"],

  // NEW: Instance-specific metadata
  instance: {
    // What states this instance owns
    ownedStates: ["term_abc123", "term_def456"],

    // Instance capabilities
    stateful: true,
    ephemeral: true,  // State lives only in memory

    // Routing strategy
    routing: {
      strategy: "affinity",  // Route based on state ownership
      fallback: "fail"       // Don't route to other instances
    },

    // System location
    system: {
      cluster: "production-us-east",
      namespace: "activity-system",
      nodeSelector: { "zone": "us-east-1a" }
    }
  }
}
```

**Query for specific instance:**

```bash
GET /v2/vessels/discover?shape=terminal_snapshot&stateId=term_abc123
```

Response:
```json
{
  "vessels": [
    {
      "vesselId": "terminal",
      "instanceId": "terminal-pod-abc123",
      "endpoint": "http://10.0.1.5:8080",
      "ownedStates": ["term_abc123", "term_def456"],
      "routing": {
        "strategy": "affinity",
        "fallback": "fail"
      }
    }
  ],
  "routingHint": "This state is owned by a specific instance"
}
```

### Layer 3: Routing Resolver

**Intelligent resolution chain that respects routing:**

```typescript
// src/resolvers/routing.ts

interface ResolutionContext {
  pointer: ImpulsePointer
  requester: {
    vesselId: string
    instanceId: string
    orgId: string
  }
}

export async function resolveWithRouting(
  context: ResolutionContext
): Promise<any> {
  const { pointer, requester } = context
  const routing = pointer.routing || {}

  // Step 1: Check authorization
  if (routing.authorization) {
    if (routing.authorization.orgId !== requester.orgId) {
      throw new Error(
        `Access denied: impulse belongs to org ${routing.authorization.orgId}`
      )
    }
  }

  // Step 2: Try preferred instance (if specified)
  if (routing.instanceId && routing.instanceEndpoint) {
    try {
      return await resolveFromInstance(
        routing.instanceEndpoint,
        pointer
      )
    } catch (error) {
      console.warn(
        `[Routing] Preferred instance ${routing.instanceId} unavailable`,
        error
      )

      // Check fallback strategy
      if (routing.fallback === "fail") {
        throw new Error(
          `Instance ${routing.instanceId} unavailable and fallback disabled`
        )
      }
    }
  }

  // Step 3: Try persistent store (if specified)
  if (routing.fallback === "persistent-store" && routing.persistence) {
    try {
      return await resolveFromPersistence(routing.persistence)
    } catch (error) {
      console.warn("[Routing] Persistence resolution failed", error)
    }
  }

  // Step 4: Try any instance (if fallback allows)
  if (routing.fallback === "any-instance") {
    // Discover any vessel that can resolve this shape
    const vessels = await discoverVessels(pointer.type, {
      system: routing.system
    })

    if (vessels.length === 0) {
      throw new Error(`No vessels found for type ${pointer.type}`)
    }

    // Try instances in order (could add health checks, load balancing)
    for (const vessel of vessels) {
      try {
        return await resolveFromInstance(vessel.endpoint, pointer)
      } catch (error) {
        console.warn(
          `[Routing] Instance ${vessel.instanceId} failed, trying next`,
          error
        )
      }
    }
  }

  throw new Error(`Unable to resolve impulse: ${pointer.type}`)
}

async function resolveFromInstance(
  endpoint: string,
  pointer: ImpulsePointer
): Promise<any> {
  const response = await fetch(`${endpoint}/resolve`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ pointer })
  })

  if (!response.ok) {
    throw new Error(`Resolution failed: ${response.statusText}`)
  }

  const { content } = await response.json()
  return content
}

async function resolveFromPersistence(
  persistence: { layer: string, location: string }
): Promise<any> {
  switch (persistence.layer) {
    case "database":
      return await resolveFromDatabase(persistence.location)

    case "cache":
      return await resolveFromCache(persistence.location)

    case "filesystem":
      return await resolveFromFilesystem(persistence.location)

    default:
      throw new Error(`Unknown persistence layer: ${persistence.layer}`)
  }
}

async function resolveFromDatabase(location: string): Promise<any> {
  // Parse location: "surrealdb://table:id"
  const [_, table, id] = location.match(/surrealdb:\/\/(.+):(.+)/) || []

  if (!table || !id) {
    throw new Error(`Invalid database location: ${location}`)
  }

  const db = await getSurrealDBClient()
  const [record] = await db.query(`SELECT * FROM ${table} WHERE id = $id`, {
    id
  })

  if (!record) {
    throw new Error(`Record not found: ${table}:${id}`)
  }

  return record
}
```

### Layer 4: State Ownership Tracking

**Vessels track what states they own:**

```typescript
// In terminal vessel

class StateRegistry {
  private ownedStates = new Set<string>()

  registerState(stateId: string) {
    this.ownedStates.add(stateId)

    // Update vessel registration with activity-api
    this.syncWithRegistry()
  }

  unregisterState(stateId: string) {
    this.ownedStates.delete(stateId)
    this.syncWithRegistry()
  }

  ownsState(stateId: string): boolean {
    return this.ownedStates.has(stateId)
  }

  private async syncWithRegistry() {
    await fetch(`${ACTIVITY_API}/v2/vessels/register`, {
      method: "POST",
      body: JSON.stringify({
        vesselId: "terminal",
        instanceId: process.env.HOSTNAME,
        endpoint: `http://${process.env.POD_IP}:8080`,
        shapes: ["terminal_snapshot"],
        instance: {
          ownedStates: Array.from(this.ownedStates),
          stateful: true,
          ephemeral: true
        }
      })
    })
  }
}

const stateRegistry = new StateRegistry()

// When creating terminal session
app.post('/terminal/create', async (c) => {
  const terminalId = nanoid()
  const terminal = createTerminal()

  terminals.set(terminalId, terminal)

  // Register ownership
  stateRegistry.registerState(terminalId)

  return c.json({ terminalId })
})

// When resolving terminal snapshot
app.post('/resolve', async (c) => {
  const { pointer } = await c.req.json()

  if (pointer.type === 'terminal_snapshot') {
    const { terminalId } = pointer

    // Check if we own this state
    if (!stateRegistry.ownsState(terminalId)) {
      return c.json({
        error: 'State not found on this instance',
        hint: 'Try discovering the correct instance via registry'
      }, 404)
    }

    const terminal = terminals.get(terminalId)
    return c.json({
      content: {
        output: terminal.buffer,
        cursor: terminal.cursor
      }
    })
  }
})
```

### Layer 5: Cross-System Discovery

**Federated vessel registry:**

```typescript
// Discovery hierarchy
const discoveryHierarchy = [
  "local",      // Same pod/process
  "pod",        // Same K8s pod (different containers)
  "namespace",  // Same K8s namespace
  "cluster",    // Same K8s cluster
  "region",     // Same cloud region
  "global"      // Across all systems
]

async function discoverVessels(
  shape: string,
  options: {
    stateId?: string
    scope?: "local" | "pod" | "namespace" | "cluster" | "region" | "global"
    system?: { cluster?: string, region?: string }
  } = {}
): Promise<VesselInstance[]> {
  const scope = options.scope || "cluster"

  // Try local scope first
  if (scope === "local") {
    const local = await discoverLocal(shape)
    if (local) return [local]
  }

  // Try cluster registry
  if (scope === "cluster" || scope === "namespace") {
    const clusterVessels = await discoverInCluster(shape, options)
    if (clusterVessels.length > 0) return clusterVessels
  }

  // Try regional registry (multi-cluster)
  if (scope === "region") {
    const regionalVessels = await discoverInRegion(shape, options)
    if (regionalVessels.length > 0) return regionalVessels
  }

  // Try global registry (cross-region, cross-org)
  if (scope === "global") {
    return await discoverGlobal(shape, options)
  }

  return []
}

async function discoverInCluster(
  shape: string,
  options: { stateId?: string }
): Promise<VesselInstance[]> {
  const ACTIVITY_API = process.env.ACTIVITY_API_URL

  const params = new URLSearchParams({ shape })
  if (options.stateId) {
    params.set("stateId", options.stateId)
  }

  const response = await fetch(
    `${ACTIVITY_API}/v2/vessels/discover?${params}`
  )

  const { vessels } = await response.json()
  return vessels || []
}

async function discoverInRegion(
  shape: string,
  options: { system?: { region?: string } }
): Promise<VesselInstance[]> {
  // Query regional registry service
  const REGIONAL_REGISTRY = process.env.REGIONAL_REGISTRY_URL

  if (!REGIONAL_REGISTRY) {
    return []
  }

  const response = await fetch(
    `${REGIONAL_REGISTRY}/discover?shape=${shape}&region=${options.system?.region}`
  )

  const { vessels } = await response.json()
  return vessels || []
}
```

### Layer 6: Pointer Creation Helpers

**Helpers for creating properly-routed pointers:**

```typescript
// src/utils/pointers.ts

export function createStatefulPointer(
  type: string,
  stateId: string,
  options: {
    persistence?: { layer: string, location: string }
    fallback?: "any-instance" | "persistent-store" | "fail"
  } = {}
): ImpulsePointer {
  const instanceId = process.env.HOSTNAME || "unknown"
  const podIP = process.env.POD_IP || "localhost"

  return {
    type,
    [type + "Id"]: stateId,
    routing: {
      instanceId,
      instanceEndpoint: `http://${podIP}:8080`,
      fallback: options.fallback || "fail",
      persistence: options.persistence
    }
  }
}

export function createPersistentPointer(
  type: string,
  recordId: string,
  options: {
    table: string
    fallback?: "any-instance" | "persistent-store"
  }
): ImpulsePointer {
  return {
    type,
    [type + "Id"]: recordId,
    routing: {
      fallback: options.fallback || "persistent-store",
      persistence: {
        layer: "database",
        location: `surrealdb://${options.table}:${recordId}`
      }
    }
  }
}

export function createCrossSystemPointer(
  type: string,
  resourceId: string,
  system: {
    cluster: string
    endpoint: string
    organization: string
  },
  authorization: {
    orgId: string
    permissions: string[]
  }
): ImpulsePointer {
  return {
    type,
    [type + "Id"]: resourceId,
    routing: {
      system,
      instanceEndpoint: system.endpoint,
      fallback: "persistent-store",
      authorization
    }
  }
}
```

**Usage in vessels:**

```typescript
// Terminal vessel creates stateful pointer
const terminalPointer = createStatefulPointer(
  "terminal_snapshot",
  terminalId,
  {
    fallback: "fail"  // Ephemeral - don't fallback
  }
)

// MiniBob creates persistent pointer
const executionPointer = createPersistentPointer(
  "activityExecutionTrace",
  executionId,
  {
    table: "activity_execution_trace",
    fallback: "any-instance"  // Any MiniBob can fetch from DB
  }
)

// Cross-system pointer
const analysisPointer = createCrossSystemPointer(
  "code_analysis",
  analysisId,
  {
    cluster: "analysis-us-west",
    endpoint: "https://analysis.metabob.internal",
    organization: "acme-corp"
  },
  {
    orgId: "acme-corp",
    permissions: ["analysis:read"]
  }
)
```

## Database Schema Updates

Add instance tracking to vessel registry:

```sql
-- sql/schemas/024-vessel-capabilities.surql (updated)

DEFINE TABLE vessel_capabilities SCHEMALESS;

-- Existing fields
DEFINE FIELD vessel_id ON vessel_capabilities TYPE string;
DEFINE FIELD vessel_name ON vessel_capabilities TYPE string;
DEFINE FIELD endpoint ON vessel_capabilities TYPE string;
DEFINE FIELD shapes ON vessel_capabilities TYPE array;

-- NEW: Instance-level fields
DEFINE FIELD instance_id ON vessel_capabilities TYPE option<string>;
DEFINE FIELD pod_name ON vessel_capabilities TYPE option<string>;
DEFINE FIELD pod_ip ON vessel_capabilities TYPE option<string>;

-- NEW: State ownership tracking
DEFINE FIELD owned_states ON vessel_capabilities TYPE option<array>;

-- NEW: Routing metadata
DEFINE FIELD routing ON vessel_capabilities TYPE option<object>;
-- routing.strategy: "affinity" | "round-robin" | "consistent-hash"
-- routing.fallback: "any-instance" | "persistent-store" | "fail"
-- routing.stateful: boolean
-- routing.ephemeral: boolean

-- NEW: System location
DEFINE FIELD system ON vessel_capabilities TYPE option<object>;
-- system.cluster: string
-- system.namespace: string
-- system.region: string

-- Existing fields
DEFINE FIELD metadata ON vessel_capabilities TYPE object DEFAULT {};
DEFINE FIELD registered_at ON vessel_capabilities TYPE datetime;
DEFINE FIELD last_seen ON vessel_capabilities TYPE datetime;

-- NEW: Index on instance_id
DEFINE INDEX instance_id_idx ON vessel_capabilities FIELDS instance_id;

-- NEW: Index on owned_states for state-based discovery
DEFINE INDEX owned_states_idx ON vessel_capabilities FIELDS owned_states;
```

## API Updates

Update discovery endpoint to support state-based routing:

```typescript
// POST /v2/vessels/discover (updated)

app.get('/discover', async (c) => {
  const shape = c.req.query('shape')
  const stateId = c.req.query('stateId')  // NEW
  const cluster = c.req.query('cluster')  // NEW
  const region = c.req.query('region')    // NEW

  if (!shape) {
    return c.json({ error: 'Missing shape parameter' }, 400)
  }

  let query = `
    SELECT
      vessel_id,
      instance_id,
      vessel_name,
      endpoint,
      shapes,
      owned_states,
      routing,
      system,
      last_seen
    FROM vessel_capabilities
    WHERE $shape IN shapes
      AND last_seen >= $since
  `

  const params: any = {
    shape,
    since: new Date(Date.now() - 5 * 60 * 1000).toISOString()
  }

  // NEW: Filter by state ownership
  if (stateId) {
    query += ` AND $stateId IN owned_states`
    params.stateId = stateId
  }

  // NEW: Filter by system location
  if (cluster) {
    query += ` AND system.cluster = $cluster`
    params.cluster = cluster
  }

  if (region) {
    query += ` AND system.region = $region`
    params.region = region
  }

  query += ` ORDER BY last_seen DESC`

  const vessels = await surrealDB.query(query, params)

  return c.json({
    vessels: vessels || [],
    shape,
    found: vessels && vessels.length > 0,
    routingHint: stateId
      ? "Filtered to vessels owning the specified state"
      : "All vessels capable of resolving this shape"
  })
})
```

## Summary: Routing Decision Tree

```
Impulse needs resolution
    ↓
Does pointer have routing.instanceId?
    ↓ YES
Try preferred instance
    ↓ SUCCESS → return
    ↓ FAIL
Check routing.fallback
    ↓ "fail" → error
    ↓ "persistent-store"
        ↓
    Try persistence layer
        ↓ SUCCESS → return
        ↓ FAIL → continue
    ↓ "any-instance"
        ↓
    Discover vessels (shape + filters)
        ↓ stateId → vessels owning state
        ↓ cluster → vessels in cluster
        ↓ region → vessels in region
        ↓
    Try instances in order
        ↓ SUCCESS → return
        ↓ ALL FAIL → error
```

This architecture solves:
- ✅ Instance affinity for stateful vessels
- ✅ Cross-system discovery
- ✅ Authorization and org isolation
- ✅ Ephemeral vs persistent state handling
- ✅ Graceful fallbacks
- ✅ State ownership tracking
