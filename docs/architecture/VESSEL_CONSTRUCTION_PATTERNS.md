# Vessel Construction Patterns: A Cross-Vessel Analysis

**Date:** 2026-04-08
**Investigation:** Obsidian-vessel, React-renderer, MiniBob, Activity-API
**Focus:** Construction patterns, impulse usage, hook registration

---

## Executive Summary

Investigation of four production vessels reveals **consistent architectural patterns** that embody the impulse-activity foundation. All vessels follow the same core idioms:

1. **Shape-based contracts** - Vessels declare what impulse shapes they can resolve
2. **Resolver-per-shape** - Each shape has a dedicated resolver function
3. **Lifecycle hooks** - Extensible execution with non-blocking hooks
4. **Vessel registration** - Backend registration with TTL-based heartbeat
5. **Lazy-loaded impulses** - Metadata-first, content on-demand

---

## Part 1: Vessel Construction Patterns

### Pattern 1: 12-Phase Bootstrap Sequence

**Observed in:** Obsidian-vessel, MiniBob
**Purpose:** Establish vessel identity, connect to backend, enable capabilities

**Standard Sequence:**
```
1. Load Configuration (env → project → user → defaults)
2. Environment Detection (cluster mode, backend availability)
3. Initialize Core Services (formatters, clients, stores)
4. Setup Vessel Identity (vesselId, version, capabilities)
5. Start HTTP Server (impulse resolution endpoint)
6. Register with Backend (vessel manifest + shapes)
7. Initialize Sync/Learning (bidirectional trace sync)
8. Setup UI/Commands (integration layer)
9. Start Heartbeat (keep registration alive)
10. Initialize Boredom/Autonomous Work (if applicable)
11. Load Waking Activities (startup tasks)
12. Signal Ready (health endpoint responds "ok")
```

**MiniBob Implementation:**
```typescript
// repos/minibob/index.ts
async function bootstrap() {
  console.log('=== Bootstrap Sequence (Phase 2: API-key-only) ===')

  // 1. Config
  const config = await loadConfig()

  // 2. Environment
  const env = detectEnvironment()

  // 3. MCP Client
  const mcp = await initializeMCP(config)

  // 4. Auth Service
  const auth = new AuthService(config.apiKey)

  // 5. Vessel Registration
  await registerVessel(mcp, getVesselManifest())

  console.log('=== Bootstrap Complete ===')
}
```

**Obsidian-vessel Implementation:**
```typescript
// repos/obsidian-vessel/src/main.ts
async onload() {
  // Phase 1-2: Settings and formatters
  await this.loadSettings()
  this.formatters = { execution: new ExecutionFormatter(), ... }

  // Phase 3-4: API clients and vessel identity
  this.apiClient = new ActivityAPIClient(this.settings)
  this.vesselClient = new VesselClient(this.settings)

  // Phase 5: HTTP Server
  if (this.settings.serverEnabled) {
    this.httpServer = await startHTTPServer(...)
  }

  // Phase 6: Registration
  await this.registerVessel()

  // Phase 7-8: Sync and UI
  this.syncService = new SyncService(...)
  this.addSettingTab(...)

  // Phase 9: Heartbeat
  this.vesselClient.startHeartbeat()

  // Phase 12: Initial sync (delayed 2s)
  setTimeout(() => this.syncService.sync(), 2000)
}
```

### Pattern 2: Dual-Mode Server (HTTP + WebSocket)

**Observed in:** React-renderer, MiniBob (daemon mode), Terminal-vessel
**Purpose:** Enable both request-response and real-time bidirectional communication

**Architecture:**
```
┌─────────────────────────────────────────────────────────┐
│                    Bun Server                            │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  HTTP (Hono)              WebSocket (Bun Native)        │
│  ├─ GET /health           ├─ upgrade: WebSocket        │
│  ├─ GET /manifest         ├─ handleOpen(ws)            │
│  ├─ POST /resolve         ├─ handleMessage(ws, data)   │
│  └─ POST /impulses   ────┬┴─ Broadcaster               │
│                          │    ├─ impulse_create        │
│  ImpulseStore            │    ├─ impulse_update        │
│  └─ subscribe() ─────────┘    └─ state_sync            │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

**React-renderer Implementation:**
```typescript
// repos/react-renderer/src/index.ts
const server = Bun.serve({
  port: 3000,

  // HTTP routes via Hono
  fetch(req, server) {
    // WebSocket upgrade check
    if (server.upgrade(req)) {
      return // WebSocket connection
    }

    // HTTP routes
    return app.fetch(req)
  },

  // WebSocket handlers
  websocket: {
    open(ws) {
      handleOpen(ws)
    },
    message(ws, data) {
      handleMessage(ws, data)
    },
    close(ws) {
      handleClose(ws)
    }
  }
})
```

**Benefits:**
- HTTP for stateless operations (health, resolve)
- WebSocket for real-time updates (impulse creation, state sync)
- Single port, unified deployment

### Pattern 3: Vessel Manifest Declaration

**Observed in:** All vessels
**Purpose:** Declare capabilities for vessel discovery

**Standard Fields:**
```typescript
interface VesselManifest {
  id: string                    // Unique identifier
  name: string                  // Human-readable name
  version: string               // Semver version
  shapes: string[]              // Impulse shapes this vessel resolves
  capabilities: string[]        // High-level capabilities
  endpoint: string              // HTTP endpoint for resolution
  metadata: {
    environment: string         // local | kubernetes | hybrid
    clusterMode?: boolean       // true if part of cluster
    codebase?: {                // Code location
      repo_url: string
      path: string              // e.g., "repos/terminal-vessel"
      access_level: string      // none | read-only | read-write
      modifiable_by?: string    // Vessel ID that can modify this vessel
    }
  }
}
```

**Obsidian-vessel Example:**
```json
{
  "id": "obsidian-vault-1",
  "name": "Obsidian Vault Vessel",
  "version": "1.0.0",
  "shapes": [
    "obsidian:note",
    "obsidian:search",
    "obsidian:canvas",
    "obsidian:backlinks",
    "obsidian:frontmatter",
    "obsidian:daily_note",
    "obsidian:graph_query"
  ],
  "capabilities": ["markdown", "knowledge-graph", "bidirectional-sync"],
  "endpoint": "http://localhost:27182",
  "metadata": {
    "vaultPath": "/Users/avi/Documents/vault",
    "obsidianVersion": "1.5.3"
  }
}
```

**MiniBob Example:**
```typescript
// Dynamically generated at runtime
function getVesselManifest(): VesselManifest {
  return {
    id: process.env.MINIBOB_INSTANCE || 'minibob-dev-1',
    name: 'MiniBob Development Vessel',
    version: require('../package.json').version,
    shapes: ['memo', 'file', 'directoryTree', 'gitDiff'],
    capabilities: detectCapabilities(), // activities, impulses, git, boredom
    endpoint: `http://localhost:${process.env.MINIBOB_PORT || 8080}`,
    metadata: {
      environment: detectEnvironment(),
      clusterMode: isClusterMode(),
      workingDirectory: process.cwd()
    }
  }
}
```

---

## Part 2: Impulse Usage Patterns

### Pattern 1: Shape-Based Resolver Registry

**Observed in:** All vessels
**Purpose:** Enable extensible impulse resolution without modifying core

**Registry Pattern:**
```typescript
// Central registry
const resolvers = new Map<string, ResolverFunction>()

// Registration function
export function registerResolver<T extends ImpulsePointer>(
  type: string,
  resolver: ResolverFunction<T>
) {
  resolvers.set(type, resolver)
  console.log(`[Resolver] Registered: ${type}`)
}

// Resolution dispatch
export async function resolve(pointer: ImpulsePointer): Promise<ResolverResult> {
  const resolver = resolvers.get(pointer.type)
  if (!resolver) {
    throw new Error(`No resolver for type: ${pointer.type}`)
  }
  return await resolver(pointer)
}
```

**MiniBob Multi-Step Dispatch:**
```typescript
// repos/minibob/src/impulse.ts
async function resolvePointer(pointer: ImpulsePointer): Promise<string> {
  // STEP 1: Built-in local resolvers
  if (pointer.type === 'memo') {
    return pointer.content
  }
  if (pointer.type === 'file') {
    return await readFileWithOffsetLimit(pointer.path, pointer.offset, pointer.limit)
  }

  // STEP 2: Custom registered resolvers
  const custom = customResolvers.get(pointer.type)
  if (custom) {
    return await custom(pointer)
  }

  // STEP 3: Vessel discovery (network routing)
  const discovery = await discoverVesselsForShape(pointer.type)
  if (discovery.found) {
    const vessel = discovery.vessels[0]
    const result = await httpPost(`${vessel.endpoint}/resolve`, { pointer })

    // Cache resolver for future use
    registerResolver(pointer.type, async (p) => {
      return await httpPost(`${vessel.endpoint}/resolve`, { pointer: p })
    })

    return result.content
  }

  // STEP 4: Backend MCP fallback
  if (mcp) {
    return await mcp.resolveImpulse(pointer)
  }

  // STEP 5: Graceful degradation
  throw new Error(`No resolver found for ${pointer.type} (offline mode)`)
}
```

**Obsidian-vessel Resolver:**
```typescript
// repos/obsidian-vessel/src/resolvers/note-resolver.ts
registerResolver<ObsidianNotePointer>('obsidian:note', async (pointer, app) => {
  // 1. Path resolution
  const normalizedPath = normalizePath(pointer.path)

  // 2. File lookup
  const file = app.vault.getAbstractFileByPath(normalizedPath)
  if (!file) throw new Error('File not found')

  // 3. Content extraction
  let content = await app.vault.read(file)

  // 4. Heading extraction (if specified)
  if (pointer.heading) {
    content = extractHeadingSection(content, pointer.heading)
  }

  // 5. Offset/limit
  if (pointer.offset !== undefined || pointer.limit !== undefined) {
    const lines = content.split('\n')
    const offset = pointer.offset || 0
    const limit = pointer.limit || lines.length
    content = lines.slice(offset, offset + limit).join('\n')
  }

  // 6. Metadata construction
  const metadata = {
    shape: 'obsidian_note',
    rowCount: content.split('\n').length,
    summary: `Note: ${file.name} (${content.length} chars)`
  }

  return { content, metadata }
})
```

### Pattern 2: Lazy-Loaded Impulses with Budget Management

**Observed in:** MiniBob, Activity-API
**Purpose:** Optimize context window usage, enable learning

**Impulse Lifecycle:**
```
1. CREATE (unloaded)
   impulse = { id, pointer, budget: 2000, loaded: false, content: null }

2. LOAD (resolve pointer, truncate to budget)
   content = await resolvePointer(pointer)
   tokens = estimateTokens(content)  // 4 chars = 1 token

   if (tokens > budget) {
     content = truncate(content, budget)
     budgetMetadata.wasTruncated = true
   }

   impulse.content = content
   impulse.loaded = true
   impulse.tokenCount = tokens

3. USE (inject into prompt)
   <impulse id="{{id}}" tokens={{tokenCount}}/{{budget}}>
     {{content}}
   </impulse>

4. UNLOAD (free memory)
   impulse.content = null
   impulse.loaded = false
```

**Budget Learning:**
```typescript
// repos/minibob/src/impulse.ts
interface ImpulseBudgetMetadata {
  originalTokenCount: number      // Before truncation
  wasTruncated: boolean           // Did we cut content?
  truncationRatio: number         // original / budget
  budgetRequested: number         // Budget at load time
  priorityLevel: string           // Importance
}

// Stored after load for learning
budgetMetadata.set(impulse.id, {
  originalTokenCount: 15000,
  wasTruncated: true,
  truncationRatio: 7.5,          // 15000 / 2000
  budgetRequested: 2000,
  priorityLevel: 'high'
})

// Backend learns: "This impulse type needs 5000 tokens minimum"
// Thompson Sampling optimizes budgets over time
```

### Pattern 3: Dual-Mode Context (Metadata vs Content)

**Observed in:** MiniBob, Activity-API, React-renderer
**Purpose:** LLM reasons about data without loading full content

**Metadata-First Pattern:**
```xml
<!-- Phase 1: LLM sees metadata -->
<available_impulses>
  <impulse_ref id="error-log" type="file" shape="error_log">
    <metadata>
      <summary>Last 50 application errors</summary>
      <rowCount>1247</rowCount>
      <columns>timestamp, level, message, stack_trace</columns>
      <sample>
        {"timestamp": "2026-04-08T10:15:23Z", "level": "ERROR", ...}
      </sample>
      <availableOps>filter_by_level, search, group_by_error_type</availableOps>
    </metadata>
  </impulse_ref>
</available_impulses>

<!-- LLM decides: "I need error-log for debugging" -->
<tool_call>
  <load_impulse id="error-log" />
</tool_call>

<!-- Phase 2: Content loaded and injected -->
<impulse id="error-log" tokens=850/2000>
  [actual error log content loaded here]
</impulse>
```

**Benefits:**
- **Selective Loading**: Only load what LLM actually needs
- **Budget Optimization**: Avoid context window waste
- **Learning Data**: Track which metadata triggers loading

---

## Part 3: Hook Registration Patterns

### Pattern 1: Non-Blocking Lifecycle Hooks

**Observed in:** MiniBob, Obsidian-vessel
**Purpose:** Extend execution without blocking core flow

**Hook Interface:**
```typescript
interface LifecycleHooks {
  onBeforePrompt?: (context: TaskContext) => Promise<void>
  onAfterPrompt?: (context: TaskContext, result: TaskResult) => Promise<void>
  onActivityComplete?: (execution: ActivityExecution) => Promise<void>
  onActivityFailed?: (execution: ActivityExecution, error: Error) => Promise<void>
  onPromotionCheck?: (context: PromotionContext) => Promise<PromotionDecision>
  onTemplateRegistered?: (templateId: string, vesselId: string) => Promise<void>
}
```

**Registration:**
```typescript
LifecycleHooks.register({
  onBeforePrompt: async (context) => {
    // Pre-execution hook
    console.log(`[Hook] Preparing task: ${context.taskId}`)
    await sessionMemoryAgent.analyze(context)
  },

  onActivityComplete: async (execution) => {
    // Post-execution hook
    console.log(`[Hook] Activity completed: ${execution.id}`)
    await notifyUser(execution)
    await extractTemplate(execution)  // Ribosome pattern
  }
})
```

**Execution with Error Handling:**
```typescript
export async function executeBeforePrompt(context: TaskContext): Promise<void> {
  if (!registeredHooks.onBeforePrompt) return

  try {
    await registeredHooks.onBeforePrompt(context)
  } catch (error) {
    console.warn('[LifecycleHooks] onBeforePrompt failed (non-blocking):', error)
    // Continue execution - hook failure doesn't block task
  }
}
```

**Key Principle:** Hooks are **enhancements**, not **gates**. Execution continues even if hooks fail.

### Pattern 2: Event Subscription (Stigmergy)

**Observed in:** React-renderer, Activity-API
**Purpose:** Indirect coordination through shared state changes

**Stigmergy Pattern:**
```typescript
// ImpulseStore emits events when state changes
class ImpulseStore {
  private listeners = new Set<Listener>()

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  private emit(event: ImpulseEvent): void {
    for (const listener of this.listeners) {
      try {
        listener(event)
      } catch (error) {
        console.error('[ImpulseStore] Listener error:', error)
      }
    }
  }

  create(primitive, options): UIComponentImpulse {
    const impulse = { ...primitive, ...options }
    this.impulses.set(impulse.id, impulse)

    // Emit event - all subscribers react independently
    this.emit({ type: 'created', impulse })

    return impulse
  }
}

// Broadcaster subscribes and propagates via WebSocket
impulseStore.subscribe((event) => {
  switch (event.type) {
    case 'created':
      broadcaster.broadcastImpulseCreated(event.impulse)
      break
    case 'updated':
      broadcaster.broadcastImpulseUpdated(event.id, event.patch)
      break
    case 'deleted':
      broadcaster.broadcastImpulseDeleted(event.id)
      break
  }
})
```

**Benefits:**
- **Decoupling**: ImpulseStore doesn't know about WebSocket
- **Extensibility**: Add new subscribers without modifying store
- **Coordination**: Vessels coordinate through state, not direct calls

### Pattern 3: Callback-Based Activity Hooks

**Observed in:** MiniBob (ExecutorConfig)
**Purpose:** Stream execution events to UI/integrations

**Callback Interface:**
```typescript
interface ExecutorConfig {
  onActivityStarted?: (
    executionId: string,
    templateId: string,
    templateName?: string,
    reason?: string
  ) => void

  onActivityTaskCompleted?: (
    executionId: string,
    taskId: string,
    taskDescription: string,
    status: 'completed' | 'failed',
    output?: string,
    error?: string
  ) => void

  onActivityCompleted?: (execution: ActivityExecution) => void
  onActivityFailed?: (executionId: string, templateId: string, error: string) => void
}
```

**Usage in Server Mode:**
```typescript
// repos/minibob/index.ts (daemon mode)
const executor = new ActivityExecutor({
  onActivityStarted: (exId, tplId, name, reason) => {
    // Broadcast to WebSocket clients
    broadcastToClients({
      type: 'activity_started',
      executionId: exId,
      templateId: tplId,
      name,
      reason
    })
  },

  onActivityTaskCompleted: (exId, taskId, desc, status, output, error) => {
    // Stream task progress
    broadcastToClients({
      type: 'task_completed',
      executionId: exId,
      taskId,
      description: desc,
      status,
      output,
      error
    })
  },

  onActivityCompleted: (execution) => {
    // Final result
    broadcastToClients({
      type: 'activity_completed',
      execution
    })
  }
})
```

---

## Part 4: Common Vessel Idioms

### Idiom 1: "Shapes Are the Contract"

**Principle:** Vessels declare shapes, not implementations. Activities request shapes, not specific vessels.

**Evidence:**
```typescript
// Vessel declares shapes it can resolve
vesselManifest.shapes = [
  'terminalState',
  'terminalCommand',
  'terminalOutput'
]

// Activity declares shapes it needs
activityTemplate.inputSchema = {
  required: [
    { shape: 'terminalState', budget: 10000 }
  ]
}

// Discovery routes by shape
const vessels = await discoverVesselsForShape('terminalState')
// → Returns [terminal-vessel-1, terminal-vessel-2]

// System picks best vessel based on:
// - Health (expires_at > now)
// - Recency (last_heartbeat DESC)
// - Success rate (learned via Thompson Sampling)
```

**Benefits:**
- Activities work with any vessel providing the shape
- Vessels can be swapped without code changes
- New vessels auto-discovered when they register

### Idiom 2: "Resolvers Live Where Data Lives"

**Principle:** Don't centralize resolution. Each vessel resolves what it owns.

**Distribution of Responsibilities:**
```
MiniBob resolves:          Local filesystem data
├─ memo                    (embedded in pointer)
├─ file                    (read from disk)
├─ directoryTree           (scan filesystem)
└─ gitDiff                 (git command)

Terminal-vessel resolves:  Terminal session data
├─ terminalState           (PTY buffer + state)
├─ terminalCommand         (command history)
└─ terminalOutput          (output lines)

Obsidian-vessel resolves:  Vault data
├─ obsidian:note           (note content)
├─ obsidian:search         (vault search)
├─ obsidian:canvas         (canvas files)
└─ obsidian:graph_query    (graph queries)

Activity-API resolves:     Execution data
├─ activityExecutionTrace  (stored traces)
├─ activityTemplate        (template definitions)
└─ activityMetrics         (aggregated stats)

React-renderer resolves:   UI primitives
└─ ui_component            (validates embedded primitive)
```

**Anti-Pattern:** Universal resolver that can resolve all types.

### Idiom 3: "Registration with TTL-Based Heartbeat"

**Principle:** Vessels register with backend, heartbeat to stay alive, auto-expire if unhealthy.

**Standard Registration Flow:**
```typescript
// Initial registration
POST /v2/vessels/register
{
  vesselId: "terminal-vessel-1",
  endpoint: "http://localhost:9137",
  shapes: ["terminalState", "terminalCommand"],
  ttl: 300  // 5 minutes
}

// Response stores:
registered_at = now()
expires_at = now() + (ttl * 1000ms)

// Heartbeat (every ttl/2 seconds = 150 seconds)
setInterval(async () => {
  await registerWithBackend()  // Re-register updates last_heartbeat
}, ttl / 2 * 1000)

// Backend query (discovery)
SELECT * FROM vessel
WHERE 'terminalState' IN shapes
  AND expires_at > time::now()  // Only active vessels
ORDER BY last_heartbeat DESC
```

**Graceful Degradation:**
```typescript
// If backend unavailable
try {
  await registerWithBackend()
  console.log('✅ Registered with backend')
} catch (error) {
  console.warn('⚠️  Backend unavailable, continuing in offline mode')
  // Vessel still functional for local resolution
}
```

### Idiom 4: "Record Everything for Learning"

**Principle:** Every execution creates a trace. Learning emerges from traces, not from LLM reasoning.

**Trace Structure:**
```typescript
interface ActivityExecution {
  id: string
  activity_id: string
  variant_id: string

  // Input/Output State
  input_impulses: string[]           // IDs of consumed impulses
  output_impulses: string[]          // IDs of produced impulses
  input_impulse_shapes: string[]     // Shapes consumed
  output_impulse_shapes: string[]    // Shapes produced

  // Execution Metadata
  success: boolean
  duration_ms: number
  cost: number
  tokens: { input: number, output: number, cache: number }

  // Error Tracking
  error_message?: string
  failed_task_id?: string

  // Tool Usage
  tool_calls: Array<{
    tool: string
    duration_ms: number
    success: boolean
  }>

  // State Transitions
  state_before: Record<string, string>  // File → hash
  state_after: Record<string, string>   // File → hash
  files_modified: string[]
  files_created: string[]
  files_deleted: string[]

  // Vessel Context
  vessel_id: string
  vessel_version: string
  improvisation: boolean               // Was this a novel attempt?

  // Timestamps
  created_at: string
  updated_at: string
}
```

**Learning From Traces:**
```typescript
// Thompson Sampling: Which activity works best for shape X?
UPDATE impulse_shape_activity_score
SET alpha = alpha + 1          // Success
WHERE activity_id = $activityId
  AND shape = $shape

// Composition Learning: Which activities work well together?
UPDATE activity_composition_graph
SET success_count = success_count + 1,
    weight = (success_count + 1) / (success_count + failure_count + 2)
WHERE parent_activity_id = $parent
  AND child_activity_id = $child

// Budget Learning: How much context does this impulse need?
UPDATE impulse_budget_metadata
SET avg_tokens = (avg_tokens * count + new_tokens) / (count + 1),
    max_tokens = GREATEST(max_tokens, new_tokens),
    truncation_rate = truncation_count / total_loads
WHERE impulse_type = $type
```

### Idiom 5: "Offline-First with MCP Fallback"

**Principle:** Vessels work standalone, use MCP for coordination/learning.

**Capability Layers:**
```
Layer 1: Standalone Operation
├─ Local impulse resolution (memo, file)
├─ Activity execution (LLM + resolvers)
└─ Result production (files, outputs)

Layer 2: MCP-Enhanced Operation
├─ Template discovery (from backend registry)
├─ Thompson Sampling (activity recommendations)
├─ Trace storage (for learning)
└─ Vessel discovery (find capable vessels)

Layer 3: Cluster Coordination
├─ Boredom queue (autonomous work distribution)
├─ Cross-vessel composition (multi-vessel activities)
└─ Template promotion (vessel→backend→cluster)
```

**Fallback Strategy:**
```typescript
// Try MCP, fall back to local
async function recommendActivities(goal: string): Promise<Activity[]> {
  if (mcp && await mcp.isHealthy()) {
    // Use backend Thompson Sampling
    return await mcp.recommendActivities({ goal })
  } else {
    // Fall back to local cache
    const cached = await loadCachedTemplates()
    return filterByGoal(cached, goal)
  }
}
```

---

## Part 5: Synthesis - The Vessel Pattern

### What Makes a Vessel?

A vessel is **a collection of ideas and intent in the instructional state** that:

1. **Declares Shapes** - What impulse types it can resolve
2. **Registers Resolvers** - How to resolve each shape
3. **Implements Lifecycle Hooks** - When to extend execution
4. **Exposes HTTP API** - `/health`, `/resolve`, `/manifest`
5. **Heartbeats to Backend** - Maintains active registration
6. **Records Executions** - Stores traces for learning
7. **Works Offline** - Gracefully degrades when backend unavailable

### Vessel Template (New Vessel Checklist)

```typescript
// 1. Vessel Manifest
export const VESSEL_MANIFEST = {
  id: 'my-vessel-1',
  name: 'My Custom Vessel',
  version: '1.0.0',
  shapes: ['myShape1', 'myShape2'],
  capabilities: ['custom-capability'],
  endpoint: 'http://localhost:9999'
}

// 2. Shape Resolvers
registerResolver<MyShape1Pointer>('myShape1', async (pointer) => {
  const content = await fetchMyData(pointer.param)
  return {
    content,
    metadata: {
      shape: 'myShape1',
      summary: `My data: ${pointer.param}`
    }
  }
})

// 3. HTTP Server
const server = Bun.serve({
  port: 9999,

  fetch: async (req) => {
    const url = new URL(req.url)

    // Health endpoint
    if (url.pathname === '/health') {
      return Response.json({
        status: 'ok',
        vessel: VESSEL_MANIFEST.id,
        shapes: VESSEL_MANIFEST.shapes
      })
    }

    // Manifest endpoint
    if (url.pathname === '/manifest') {
      return Response.json(VESSEL_MANIFEST)
    }

    // Impulse resolution
    if (url.pathname === '/resolve' && req.method === 'POST') {
      const { pointer } = await req.json()
      const result = await resolve(pointer)
      return Response.json(result)
    }

    return new Response('Not found', { status: 404 })
  }
})

// 4. Backend Registration
async function registerWithBackend() {
  await fetch(`${ACTIVITY_API_ENDPOINT}/v2/vessels/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(VESSEL_MANIFEST)
  })
}

// 5. Heartbeat
setInterval(registerWithBackend, 150_000) // Every 2.5 minutes (ttl=300s)

// 6. Lifecycle Hooks (optional)
LifecycleHooks.register({
  onActivityComplete: async (execution) => {
    console.log(`[MyVessel] Activity completed: ${execution.id}`)
  }
})
```

---

## Part 6: Key Architectural Insights

### Insight 1: Vessels Don't Call Each Other Directly

**Pattern:** Impulse-mediated communication

```
Terminal Vessel produces → terminalState impulse
                            ↓
                    Impulse Store (backend)
                            ↓
Activity Executor loads  ← terminalState impulse
                            ↓
LLM Resolver processes   → analysis impulse
                            ↓
File Vessel loads        ← analysis impulse
                            ↓
File Vessel writes       → file with analysis
```

**Benefits:**
- Loose coupling (vessels don't know about each other)
- Testable (mock impulse store)
- Composable (mix any vessels)
- Learnable (backend tracks combinations)

### Insight 2: Shape Is the Only Contract

**No rigid schemas:** Activities don't specify field-level requirements

```typescript
// WRONG: Rigid schema
activityTemplate.inputSchema = {
  required: [
    {
      type: 'terminalState',
      fields: ['buffer', 'pid', 'running'],  // Too specific!
      validation: { buffer: { minLength: 100 } }
    }
  ]
}

// RIGHT: Shape-based
activityTemplate.inputSchema = {
  required: [
    {
      shape: 'terminalState',   // Flexible contract
      budget: 10000
    }
  ]
}
```

**Reasoning:** Shapes evolve. Vessels may add fields without breaking activities.

### Insight 3: Metadata Enables Reasoning, Content Enables Execution

**Dual-Mode Design:**

```typescript
// Metadata (lightweight, always available)
impulseMetadata = {
  shape: 'terminalState',
  summary: 'Terminal session with 247 lines of output',
  rowCount: 247,
  columns: ['timestamp', 'command', 'output'],
  sample: [{ timestamp: '...', command: 'ls', output: '...' }],
  availableOps: ['filter_by_command', 'search', 'get_errors']
}

// Content (heavy, loaded on-demand)
impulseContent = `
[full 247 lines of terminal output]
...
`
```

**Usage:**
- LLM sees metadata → decides what to load
- Executor loads content → processes with resolver
- Learning tracks: Which metadata triggered loading? Was content useful?

### Insight 4: Thompson Sampling Replaces Configuration

**Traditional Approach:** Manual configuration

```yaml
# config.yaml - BRITTLE!
activity_routing:
  - goal: "debug error"
    template: debug-activity-v3
  - goal: "fix bug"
    template: fix-bug-activity-v1
```

**Vessel Approach:** Learning from executions

```typescript
// No config needed - system learns from traces
execution_trace = {
  activity_id: 'debug-activity-v3',
  goal: 'debug login error',
  input_shapes: ['error', 'source_code'],
  success: true,
  duration_ms: 12000,
  cost: 0.05
}

// Thompson Sampling updates:
// - Global scores (all goals)
// - Shape-conditioned scores (goals with specific shapes)
// - Composition patterns (which activities chain well)

// Next similar goal automatically prefers debug-activity-v3
```

**Benefits:**
- Self-optimizing (no manual tuning)
- Variant competition (A/B testing built-in)
- Context-aware (shape-conditioned scores)

### Insight 5: The Process-of-Becoming Is the System

**Vessels** (instructional state) → **Executions** (transient state) → **Traces** (functional state) → **Learned Templates** (new vessels)

```
Cycle 1:
  Template A (vessel) → Execution 1 (process) → Trace 1 (instance)

Cycle 2:
  Trace 1 analyzed → Template A.1 extracted (ribosome)
  Template A.1 (vessel) → Execution 2 (process) → Trace 2 (instance)

Cycle 3:
  Trace 1 + Trace 2 → Thompson Sampling scores updated
  Template A vs A.1 compete → Better variant emerges

Cycle N:
  System continuously transforms templates → executions → learning
  "Becoming" never stops
```

**Key Insight:** MiniBob isn't just a tool - it's the manifestation of the process-of-becoming itself.

---

## Conclusion

All vessels follow the same core patterns:

1. **Shape-based contracts** for flexibility
2. **Resolver-per-shape** for modularity
3. **Lifecycle hooks** for extensibility
4. **Vessel registration** for discoverability
5. **Lazy-loaded impulses** for efficiency
6. **Offline-first** for resilience
7. **Record everything** for learning

These patterns aren't arbitrary - they embody the **Impulse-Activity Foundation** principles:

- ✅ Impulses are universal data (shapes, not schemas)
- ✅ Activities constrain search (ranked by learning)
- ✅ Resolvers live where data lives (distributed resolution)
- ✅ Metadata first, content later (lazy loading)
- ✅ Record everything (traces enable learning)
- ✅ LLMs are tools (used for reasoning, not control)
- ✅ Learn from traces (Thompson Sampling, not config)

**Next Steps:**
1. Document vessel-to-vessel composition patterns
2. Create vessel SDK with template code
3. Implement cross-vessel shape registry
4. Build vessel health dashboard
