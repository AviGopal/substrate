# Vessel System: Responsibilities Analysis

## Current State vs Required Changes

### What Already Exists ✅

#### MiniBob (Vessel - Executor)
**Current implementation**:
- ✅ Vessel discovery client (`src/vessel-discovery.ts`)
- ✅ Resolution chain: LOCAL → CUSTOM → VESSEL DISCOVERY → MCP fallback
- ✅ Queries `GET /v2/vessels/discover?shape=X`
- ✅ Delegates to discovered vessels via HTTP

**Responsibilities** (CORRECT):
- Execute activities with LLM
- Resolve LOCAL impulses (memo, file, directoryTree, gitDiff, packageConfig, toolList)
- Discover other vessels for non-local resolution
- Create traces and send to activity-api
- NO universal knowledge of other vessels

**What works**: MiniBob already does vessel discovery correctly!

#### Activity-API (Infrastructure - NOT a Vessel)
**Current implementation**:
- ✅ Vessel registry endpoints (`/v2/vessels/register`, `/v2/vessels/discover`, `/v2/vessels/capabilities`)
- ✅ Impulse resolution endpoint (`/v2/impulses/resolve`)
- ✅ Database schema for vessel_capabilities

**Responsibilities** (MOSTLY CORRECT):
- Store execution traces ✓
- Store activity templates ✓
- Store performance metrics ✓
- Thompson Sampling ✓
- Vessel registry (discovery service) ✓
- Resolve impulse types IT OWNS:
  - `activityExecutionTrace` ✓ (owns traces)
  - `activityTemplate` ✓ (owns templates)
  - `activityMetrics` ✓ (owns metrics)
  - `recentExecutions` ✓ (queries its traces)
  - `failurePatterns` ✓ (analyzes its traces)
  - `successPatterns` ✓ (analyzes its traces)
  - `templateComparison` ✓ (analyzes its metrics)

**What works**: Activity-API correctly resolves data it owns and hosts the vessel registry!

### What Exists But Needs Registration

#### Terminal Vessel
**Status**: Exists in `repos/terminal` but may not register with activity-api

**What needs to change**:
```typescript
// repos/terminal/src/index.ts - ADD THIS

async function registerWithActivityAPI() {
  const ACTIVITY_API_URL = process.env.ACTIVITY_API_URL ||
    "http://metabob-activity-api:8080"

  await fetch(`${ACTIVITY_API_URL}/v2/vessels/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      vesselId: "terminal",
      instanceId: process.env.HOSTNAME || "terminal-local",
      vesselName: "Terminal",
      endpoint: `http://${process.env.POD_IP || 'localhost'}:8080`,
      shapes: [
        "terminal_snapshot",
        "terminal_command",
        "terminal_output"
      ],
      instance: {
        ownedStates: [], // Updated as terminals are created
        stateful: true,
        ephemeral: true,
        routing: {
          strategy: "affinity",
          fallback: "fail"
        }
      }
    })
  })
}

// Call on startup
await registerWithActivityAPI()

// Send heartbeats every 30s
setInterval(async () => {
  await fetch(`${ACTIVITY_API_URL}/v2/vessels/heartbeat`, {
    method: "POST",
    body: JSON.stringify({
      pod_name: process.env.HOSTNAME,
      namespace: "activity-system",
      status: "idle"
    })
  })
}, 30000)
```

**Expose resolution endpoint**:
```typescript
// repos/terminal/src/index.ts - ADD THIS

app.post('/resolve', async (c) => {
  const { pointer } = await c.req.json()

  if (pointer.type === 'terminal_snapshot') {
    const terminal = terminals.get(pointer.terminalId)
    if (!terminal) {
      return c.json({ error: 'Terminal not found' }, 404)
    }

    return c.json({
      content: {
        output: terminal.buffer,
        cursor: terminal.cursor,
        size: terminal.size
      }
    })
  }

  return c.json({ error: 'Unknown pointer type' }, 400)
})
```

### What Doesn't Exist Yet

#### React-Renderer Vessel
**Status**: Doesn't exist, needs to be created

**Required implementation**: See `TYPESCRIPT_VESSEL_TEMPLATE.md` for step-by-step guide (canonical template for new vessels)

### The Proxy Pattern Issue

#### Analysis-API Integration
**Current**:
```
MiniBob requests analysisResult
  ↓
Vessel discovery: no vessels found
  ↓
Fallback to MCP (activity-api)
  ↓
Activity-API proxies to analysis-api
  ↓
Returns result
```

**Problems**:
1. MiniBob's vessel discovery fails (no vessels registered)
2. Falls back to activity-api via MCP
3. Activity-API acts as proxy (lines 848-974 in impulses.ts)
4. Analysis-API never registers its capabilities

**Should be**:
```
MiniBob requests analysisResult
  ↓
Vessel discovery finds analysis-api
  ↓
Direct HTTP call to analysis-api
  ↓
Returns result
```

**Fix required**: Analysis-API should register with vessel registry

```typescript
// repos/metabob-analysis-api - ADD vessel registration

async function registerWithActivityAPI() {
  await fetch(`${ACTIVITY_API_URL}/v2/vessels/register`, {
    method: "POST",
    body: JSON.stringify({
      vesselId: "analysis-api",
      vesselName: "Analysis API",
      endpoint: "http://metabob-analysis-api:8080",
      shapes: [
        "analysisResult",
        "cochangeSuggestions",
        "impactAnalysis",
        "codebaseSearch",
        "problemCluster"
      ]
    })
  })
}
```

**Then activity-api can remove proxy code** (lines 848-1069 in impulses.ts)

### Stateful Routing Implementation

#### Current State
**Missing**: No support for `routing` metadata in impulse pointers

**Required changes**:

1. **MiniBob's vessel discovery** - Already supports it! Lines 251-292 in vessel-discovery.ts show HTTP delegation working.

2. **Activity-API's discovery endpoint** - Needs to support `stateId` filter:

```typescript
// repos/metabob-activity-api/src/routes/vessels.ts
// CURRENT: Lines 385-456 - Basic discovery
// ADD: Filter by state ownership

app.get('/discover', async (c) => {
  const shape = c.req.query('shape')
  const stateId = c.req.query('stateId')  // NEW
  const cluster = c.req.query('cluster')  // NEW

  let query = `
    SELECT * FROM vessel_capabilities
    WHERE $shape IN shapes
  `

  if (stateId) {
    query += ` AND $stateId IN owned_states`
  }

  if (cluster) {
    query += ` AND system.cluster = $cluster`
  }

  // ... rest of implementation
})
```

3. **Terminal creates stateful pointers**:

```typescript
// repos/terminal/src/index.ts

function createTerminalPointer(terminalId: string) {
  return {
    type: "terminal_snapshot",
    terminalId,
    routing: {
      instanceId: process.env.HOSTNAME,
      instanceEndpoint: `http://${process.env.POD_IP}:8080`,
      fallback: "fail",
      persistence: {
        layer: "memory",
        location: null
      }
    }
  }
}
```

4. **MiniBob's resolver respects routing**:

```typescript
// repos/minibob/src/vessel-discovery.ts
// UPDATE: Line 207-243 resolveViaDiscovery()

async resolveViaDiscovery(pointer: ImpulsePointer): Promise<ResolverResult> {
  // NEW: Check for routing hints
  if (pointer.routing?.instanceEndpoint) {
    try {
      return await this.resolveViaEndpoint(
        pointer.routing.instanceEndpoint,
        pointer
      )
    } catch (error) {
      // Check fallback strategy
      if (pointer.routing.fallback === "fail") {
        throw error
      }
      // Continue to discovery fallback
    }
  }

  // Existing discovery logic...
  const shape = this.inferShapeFromPointer(pointer)
  const discovery = await this.discoverVesselsForShape(shape)
  // ...
}
```

## Summary: What Needs to Change

### Immediate Actions Required

1. **Terminal Vessel** - Add registration & heartbeat
   - File: `repos/terminal/src/index.ts`
   - Add: `registerWithActivityAPI()` on startup
   - Add: Heartbeat interval
   - Add: `/resolve` endpoint

2. **Analysis-API** - Register as vessel
   - File: `repos/metabob-analysis-api/src/index.ts` (or equivalent)
   - Add: `registerWithActivityAPI()` on startup
   - Remove proxy code from activity-api

3. **Activity-API** - Support stateful discovery
   - File: `repos/metabob-activity-api/src/routes/vessels.ts`
   - Update: `/discover` endpoint to support `stateId` and `cluster` filters
   - Update: `/register` to accept `instance.ownedStates`

4. **MiniBob** - Support routing hints
   - File: `repos/minibob/src/vessel-discovery.ts`
   - Update: `resolveViaDiscovery()` to try `routing.instanceEndpoint` first
   - Add: Fallback logic based on `routing.fallback` strategy

5. **Create React-Renderer** - New vessel
   - Location: `repos/react-renderer/`
   - Implement: Full vessel structure (see TYPESCRIPT_VESSEL_TEMPLATE.md)

### Long-Term Enhancements

6. **Database Schema** - Add instance-level tracking
   - File: `repos/metabob-activity-api/sql/schemas/024-vessel-capabilities.surql`
   - Add fields: `instance_id`, `owned_states`, `routing`, `system`
   - Add indexes: `instance_id_idx`, `owned_states_idx`

7. **Cross-System Discovery** - Federated registry
   - Future: Regional registries for multi-cluster deployments

## Division of Responsibilities (Corrected)

### Activity-API (Infrastructure)
**Should**:
- ✅ Store traces (what happened - functional state)
- ✅ Store templates (activity blueprints)
- ✅ Store metrics (performance data)
- ✅ Thompson Sampling (learning)
- ✅ Vessel registry (discovery service)
- ✅ Resolve impulses for data IT OWNS (traces, templates, metrics)

**Should NOT**:
- ❌ Proxy to other vessels (use discovery instead)
- ❌ Resolve impulses for data it doesn't own

### MiniBob (Vessel)
**Should**:
- ✅ Execute activities
- ✅ Resolve LOCAL impulses (memo, file, gitDiff)
- ✅ Discover other vessels via registry
- ✅ Delegate to discovered vessels
- ✅ Create and send traces to activity-api

**Should NOT**:
- ❌ Know about all vessels statically
- ❌ Implement resolvers for data it doesn't own
- ❌ Only talk to activity-api

### Terminal (Vessel)
**Should**:
- ✅ Own terminal sessions
- ✅ Resolve terminal_snapshot impulses
- ✅ Register with activity-api
- ✅ Track state ownership
- ✅ Report heartbeats

**Should NOT**:
- ❌ Know about MiniBob or other vessels
- ❌ Store traces (that's activity-api's job)

### Analysis-API (Vessel)
**Should**:
- ✅ Own analysis data (problems, CPG)
- ✅ Resolve analysis impulses
- ✅ Register with activity-api
- ✅ Expose `/resolve` endpoint

**Should NOT**:
- ❌ Be proxied through activity-api
- ❌ Know about MiniBob

### React-Renderer (Vessel - To Be Created)
**Should**:
- ✅ Own UI state
- ✅ Resolve ui_component impulses
- ✅ Discover other vessels (terminal, minibob)
- ✅ Delegate nested impulse resolution
- ✅ Register with activity-api

**Should NOT**:
- ❌ Know about terminal statically
- ❌ Store execution traces

## Verification Checklist

After making changes, verify:

- [ ] Terminal registers on startup (`GET /v2/vessels/capabilities` shows terminal)
- [ ] Terminal responds to discovery (`GET /v2/vessels/discover?shape=terminal_snapshot`)
- [ ] MiniBob can resolve terminal impulses via discovery
- [ ] Analysis-API registers on startup
- [ ] Analysis-API responds to discovery
- [ ] MiniBob resolves analysis impulses directly (not via proxy)
- [ ] Activity-API discovery supports `stateId` filter
- [ ] Terminal creates pointers with `routing.instanceId`
- [ ] MiniBob respects `routing.instanceEndpoint` hints
- [ ] React-renderer exists and registers

## Files to Modify

| File | Change Required | Priority |
|------|----------------|----------|
| `repos/terminal/src/index.ts` | Add registration & /resolve endpoint | High |
| `repos/metabob-analysis-api/src/index.ts` | Add registration | High |
| `repos/metabob-activity-api/src/routes/vessels.ts` | Support stateId filter | Medium |
| `repos/metabob-activity-api/src/routes/impulses.ts` | Remove proxy code (lines 848-1069) | Medium |
| `repos/minibob/src/vessel-discovery.ts` | Support routing hints | Medium |
| `repos/metabob-activity-api/sql/schemas/024-vessel-capabilities.surql` | Add instance fields | Low |
| `repos/react-renderer/` | Create new vessel | Low (future) |

## The Good News

**Most of the architecture is correct!**

- ✅ MiniBob already has vessel discovery
- ✅ Activity-API already has vessel registry
- ✅ Resolution chain already works
- ✅ Activity-API correctly resolves data it owns

**Only 3 things need fixing**:
1. Terminal needs to register
2. Analysis-API needs to register (remove proxy)
3. Add stateful routing support (routing hints)

The foundation is solid - just need to wire up the existing vessels properly!
