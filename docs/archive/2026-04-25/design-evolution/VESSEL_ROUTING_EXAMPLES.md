# Stateful Vessel Routing: Practical Examples

## Example 1: Terminal Session Routing

### Problem
You have 3 terminal vessel replicas. Terminal session T1 lives on pod-abc. React-renderer needs to display T1's output. How does it route to the correct pod?

### Solution: Pointer with Instance Routing

```typescript
// Terminal vessel (pod-abc) creates terminal session
app.post('/terminal/create', async (c) => {
  const terminalId = nanoid()

  // Create terminal
  const terminal = new Terminal()
  terminals.set(terminalId, terminal)

  // Register state ownership with activity-api
  await fetch(`${ACTIVITY_API}/v2/vessels/register`, {
    method: "POST",
    body: JSON.stringify({
      vesselId: "terminal",
      instanceId: process.env.HOSTNAME,  // "terminal-pod-abc"
      endpoint: `http://${process.env.POD_IP}:8080`,
      shapes: ["terminal_snapshot"],
      instance: {
        ownedStates: [terminalId],  // This instance owns T1
        stateful: true,
        ephemeral: true
      }
    })
  })

  // Create impulse pointer with routing
  const pointer = {
    type: "terminal_snapshot",
    terminalId,
    routing: {
      // Direct this instance
      instanceId: process.env.HOSTNAME,
      instanceEndpoint: `http://${process.env.POD_IP}:8080`,

      // Terminal state is ephemeral - don't fallback
      fallback: "fail",

      persistence: {
        layer: "memory",
        location: null
      }
    }
  }

  return c.json({ terminalId, pointer })
})
```

### React-Renderer Resolves with Routing

```typescript
// React-renderer needs terminal snapshot
async function resolveTerminal(pointer: ImpulsePointer) {
  const { routing } = pointer

  // Step 1: Try preferred instance (pod-abc)
  if (routing?.instanceEndpoint) {
    try {
      const response = await fetch(`${routing.instanceEndpoint}/resolve`, {
        method: "POST",
        body: JSON.stringify({ pointer })
      })

      if (response.ok) {
        const { content } = await response.json()
        return content
      }
    } catch (error) {
      console.warn(`Instance ${routing.instanceId} unavailable`, error)
    }
  }

  // Step 2: Check fallback strategy
  if (routing?.fallback === "fail") {
    throw new Error(
      `Terminal session ${pointer.terminalId} not available ` +
      `(instance ${routing.instanceId} is down)`
    )
  }

  // No fallback for ephemeral state
  throw new Error("Terminal session unavailable")
}
```

## Example 2: Execution Trace (Persistent with Fallback)

### Problem
MiniBob pod creates execution trace. Pod crashes. Another MiniBob needs to resolve the trace. How?

### Solution: Persistent Pointer with Any-Instance Fallback

```typescript
// MiniBob creates execution trace
async function recordExecution(execution: Execution) {
  // Store in SurrealDB (persistent)
  const db = await getSurrealDBClient()
  await db.query(`
    CREATE activity_execution_trace CONTENT $execution
  `, { execution })

  // Create pointer with persistence info
  const pointer = {
    type: "activityExecutionTrace",
    executionId: execution.id,
    routing: {
      // Prefer this instance (might have in-memory cache)
      instanceId: process.env.HOSTNAME,
      instanceEndpoint: `http://${process.env.POD_IP}:8080`,

      // But allow fallback to any MiniBob + DB
      fallback: "any-instance",

      persistence: {
        layer: "database",
        location: `surrealdb://activity_execution_trace:${execution.id}`
      }
    }
  }

  return pointer
}

// Any MiniBob can resolve (tries preferred, falls back to DB)
app.post('/resolve', async (c) => {
  const { pointer } = await c.req.json()

  if (pointer.type === 'activityExecutionTrace') {
    const { executionId } = pointer

    // Try in-memory cache first (fast path)
    if (executionCache.has(executionId)) {
      return c.json({
        content: executionCache.get(executionId),
        source: "cache"
      })
    }

    // Fallback to database (slow path)
    const db = await getSurrealDBClient()
    const [trace] = await db.query(`
      SELECT * FROM activity_execution_trace WHERE id = $id
    `, { id: executionId })

    if (!trace) {
      return c.json({ error: "Execution trace not found" }, 404)
    }

    // Cache for future requests
    executionCache.set(executionId, trace)

    return c.json({
      content: trace,
      source: "database"
    })
  }
})
```

### Resolution Flow

```
React-renderer needs execution trace
    ↓
Pointer has instanceId: minibob-pod-abc
    ↓
Try pod-abc (preferred)
    ↓ FAIL (pod crashed)
Fallback: any-instance
    ↓
Discover: GET /v2/vessels/discover?shape=activityExecutionTrace
    ↓ Returns: [minibob-pod-def, minibob-pod-ghi]
Try pod-def
    ↓ Check cache → miss
    ↓ Query DB → hit
    ↓ Return trace
SUCCESS
```

## Example 3: Cross-System Discovery

### Problem
MiniBob in AWS needs code analysis from on-prem analysis service. Different clusters, different networks.

### Solution: Cross-System Pointer with Authorization

```typescript
// In AWS MiniBob
async function requestCodeAnalysis(filePath: string) {
  // Trigger analysis in on-prem cluster
  const analysisId = await triggerRemoteAnalysis(filePath)

  // Create cross-system pointer
  const pointer = {
    type: "code_analysis",
    analysisId,
    routing: {
      // Point to on-prem cluster
      system: {
        cluster: "onprem-us-east",
        region: "us-east-1",
        organization: "acme-corp"
      },

      // Direct endpoint (bypasses local discovery)
      instanceEndpoint: "https://analysis.acme.internal/api",

      // Authorization required
      authorization: {
        orgId: "acme-corp",
        permissions: ["analysis:read"]
      },

      // Fallback to persistent store if service unavailable
      fallback: "persistent-store",

      persistence: {
        layer: "database",
        location: "postgres://analysis_results:123"
      }
    }
  }

  return pointer
}

// Resolution respects authorization
async function resolveWithAuth(pointer: ImpulsePointer) {
  const { routing } = pointer

  // Check authorization
  if (routing?.authorization) {
    const token = await getServiceToken(routing.authorization.orgId)

    const response = await fetch(`${routing.instanceEndpoint}/resolve`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ pointer })
    })

    if (response.status === 403) {
      throw new Error(
        `Access denied: insufficient permissions ` +
        `(required: ${routing.authorization.permissions.join(", ")})`
      )
    }

    return response.json()
  }
}
```

## Example 4: State-Based Discovery

### Problem
You have terminal pointer but it doesn't include instance routing. How do you find which pod owns the terminal session?

### Solution: Query Registry by State ID

```typescript
// Pointer without routing hint
const pointer = {
  type: "terminal_snapshot",
  terminalId: "term_abc123"
  // No routing field!
}

// Discover vessel by state ownership
async function discoverByState(
  shape: string,
  stateId: string
): Promise<VesselInstance | null> {
  const response = await fetch(
    `${ACTIVITY_API}/v2/vessels/discover?shape=${shape}&stateId=${stateId}`
  )

  const { vessels } = await response.json()

  if (vessels.length === 0) {
    return null
  }

  // Return instance that owns this state
  return vessels[0]
}

// Use in resolution
async function resolveTerminal(pointer: ImpulsePointer) {
  const { terminalId } = pointer

  // No routing hint - discover by state
  const vessel = await discoverByState("terminal_snapshot", terminalId)

  if (!vessel) {
    throw new Error(`No vessel found owning terminal ${terminalId}`)
  }

  // Now resolve via discovered instance
  const response = await fetch(`${vessel.endpoint}/resolve`, {
    method: "POST",
    body: JSON.stringify({ pointer })
  })

  return response.json()
}
```

### Registry Query

```sql
-- Activity-API executes this query
SELECT
  vessel_id,
  instance_id,
  endpoint,
  owned_states,
  routing
FROM vessel_capabilities
WHERE 'terminal_snapshot' IN shapes
  AND 'term_abc123' IN owned_states
  AND last_seen >= $since
ORDER BY last_seen DESC
LIMIT 1
```

## Example 5: Multi-Region Routing

### Problem
Organization has vessels across US, EU, and APAC. How does MiniBob in EU discover vessels in APAC?

### Solution: Hierarchical Discovery with Region Hint

```typescript
// MiniBob in EU needs to resolve impulse
const pointer = {
  type: "user_profile",
  userId: "user_apac_123",
  routing: {
    // Hint: user data is in APAC region
    system: {
      region: "ap-southeast-1",
      organization: "acme-corp"
    },

    fallback: "persistent-store",

    persistence: {
      layer: "database",
      location: "postgres://users_apac:user_apac_123"
    }
  }
}

// Hierarchical discovery
async function discoverHierarchical(
  shape: string,
  system?: { region?: string, cluster?: string }
): Promise<VesselInstance[]> {
  // Try local cluster first
  let vessels = await discoverInCluster(shape)
  if (vessels.length > 0) {
    return vessels
  }

  // Try same region
  if (system?.region) {
    vessels = await discoverInRegion(shape, system.region)
    if (vessels.length > 0) {
      return vessels
    }
  }

  // Try global registry
  vessels = await discoverGlobal(shape, system)
  return vessels
}

async function discoverInRegion(
  shape: string,
  region: string
): Promise<VesselInstance[]> {
  // Query regional registry
  const REGIONAL_REGISTRY = getRegistryForRegion(region)

  const response = await fetch(
    `${REGIONAL_REGISTRY}/v2/vessels/discover?shape=${shape}`
  )

  const { vessels } = await response.json()
  return vessels || []
}

function getRegistryForRegion(region: string): string {
  const registryMap = {
    "us-east-1": "https://registry.us.acme.internal",
    "eu-west-1": "https://registry.eu.acme.internal",
    "ap-southeast-1": "https://registry.apac.acme.internal"
  }

  return registryMap[region] || process.env.GLOBAL_REGISTRY_URL
}
```

## Example 6: Consistent Hashing (Stateless Load Balancing)

### Problem
Stateless vessel with multiple replicas. Route deterministically based on impulse ID for cache efficiency.

### Solution: Consistent Hashing in Pointer

```typescript
// Cache vessel (stateless but benefits from consistent routing)
const pointer = {
  type: "cached_data",
  cacheKey: "analysis_result_xyz",
  routing: {
    // Use consistent hashing for routing
    strategy: "consistent-hash",
    hashKey: "analysis_result_xyz",

    // No instance preference
    instanceId: null,

    // Any instance can handle, but prefer consistent routing
    fallback: "any-instance"
  }
}

// Resolution uses consistent hashing
async function resolveWithConsistentHash(pointer: ImpulsePointer) {
  const { routing } = pointer

  if (routing?.strategy === "consistent-hash") {
    // Discover all instances
    const vessels = await discoverVessels(pointer.type)

    if (vessels.length === 0) {
      throw new Error(`No vessels found for ${pointer.type}`)
    }

    // Hash to select instance
    const hash = simpleHash(routing.hashKey)
    const index = hash % vessels.length
    const selectedVessel = vessels[index]

    console.log(
      `[ConsistentHash] Routing ${routing.hashKey} to ` +
      `instance ${index + 1}/${vessels.length} (${selectedVessel.instanceId})`
    )

    return await resolveFromInstance(selectedVessel.endpoint, pointer)
  }
}

function simpleHash(str: string): number {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i)
    hash = hash & hash // Convert to 32-bit integer
  }
  return Math.abs(hash)
}
```

## Example 7: Org Isolation

### Problem
Multi-tenant system. Vessel should only resolve impulses from same org.

### Solution: Authorization in Pointer

```typescript
// Create pointer with org context
function createOrgIsolatedPointer(
  type: string,
  resourceId: string,
  orgId: string
): ImpulsePointer {
  return {
    type,
    [type + "Id"]: resourceId,
    routing: {
      authorization: {
        orgId,
        permissions: ["resource:read"]
      }
    }
  }
}

// Vessel enforces org isolation
app.post('/resolve', async (c) => {
  const { pointer } = await c.req.json()
  const requesterOrgId = c.get('auth')?.org_id  // From JWT

  // Check authorization
  if (pointer.routing?.authorization) {
    const { orgId } = pointer.routing.authorization

    if (orgId !== requesterOrgId) {
      return c.json({
        error: "Access denied",
        message: `Resource belongs to org ${orgId}, ` +
                 `but requester is from org ${requesterOrgId}`
      }, 403)
    }
  }

  // Resolve resource (org is validated)
  const resource = await resolveResource(pointer)
  return c.json({ content: resource })
})
```

## Example 8: Graceful Degradation

### Problem
Preferred instance is down. Fallback to stale cache rather than failing completely.

### Solution: Multi-Level Fallback

```typescript
const pointer = {
  type: "realtime_metrics",
  metricsId: "dashboard_123",
  routing: {
    // Prefer live metrics service
    instanceId: "metrics-live-pod-abc",
    instanceEndpoint: "http://metrics-live:8080",

    // Fallback chain
    fallback: "persistent-store",

    persistence: {
      // Try hot cache first
      layer: "cache",
      location: "redis://metrics:dashboard_123",

      // Then cold storage
      fallbackLayers: [
        {
          layer: "database",
          location: "surrealdb://metrics_archive:dashboard_123",
          staleAfter: 300  // 5 minutes stale is acceptable
        }
      ]
    }
  }
}

// Resolution with multi-level fallback
async function resolveWithFallbacks(pointer: ImpulsePointer) {
  const { routing } = pointer

  // Level 1: Try preferred instance (live metrics)
  if (routing?.instanceEndpoint) {
    try {
      return await resolveFromInstance(routing.instanceEndpoint, pointer)
    } catch (error) {
      console.warn("Live metrics unavailable, trying cache", error)
    }
  }

  // Level 2: Try hot cache (Redis)
  if (routing?.persistence?.layer === "cache") {
    try {
      const cached = await resolveFromCache(routing.persistence.location)
      if (cached) {
        return {
          ...cached,
          _stale: false,
          _source: "cache"
        }
      }
    } catch (error) {
      console.warn("Cache miss, trying database", error)
    }
  }

  // Level 3: Try cold storage (DB)
  if (routing?.persistence?.fallbackLayers) {
    for (const fallback of routing.persistence.fallbackLayers) {
      try {
        const data = await resolveFromPersistence(fallback)

        // Check staleness
        const age = Date.now() - new Date(data.timestamp).getTime()
        const stale = age > (fallback.staleAfter * 1000)

        return {
          ...data,
          _stale: stale,
          _source: "database",
          _age: age
        }
      } catch (error) {
        console.warn(`Fallback ${fallback.layer} failed`, error)
      }
    }
  }

  throw new Error("All resolution attempts failed")
}
```

## Summary: Routing Patterns

| Pattern | Use Case | Fallback | Example |
|---------|----------|----------|---------|
| **Instance Affinity** | Ephemeral state | Fail | Terminal sessions |
| **Persistent with Preference** | Cached data | Any instance + DB | Execution traces |
| **Cross-System** | Multi-cluster | Remote DB | Analysis in different cluster |
| **State-Based Discovery** | Unknown instance | Registry lookup | Find terminal by session ID |
| **Consistent Hashing** | Stateless load balance | Any instance | Cache sharding |
| **Org Isolation** | Multi-tenant | Authorization check | Tenant data separation |
| **Multi-Level Fallback** | High availability | Cache → DB → Stale | Real-time metrics |

Each pattern uses the same `routing` metadata structure but with different combinations of:
- `instanceId` / `instanceEndpoint` (preferred instance)
- `fallback` strategy ("fail", "any-instance", "persistent-store")
- `persistence` layers (cache, database, filesystem)
- `system` location (cluster, region, organization)
- `authorization` (orgId, permissions)
- `strategy` (affinity, consistent-hash, round-robin)
