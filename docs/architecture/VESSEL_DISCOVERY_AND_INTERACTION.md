# Vessel Discovery and Interaction Patterns

**Investigation Date:** 2026-04-08
**Status:** Architectural exploration and design proposal

This document answers four key questions about vessel architecture:
1. How do we do local vessel discovery?
2. How do we interact with other vessels?
3. How can we bundle multiple vessels together?
4. How does this interact with the impulse and activity system?

---

## 1. Local Vessel Discovery

### Current State: Three Discovery Mechanisms

#### A. Backend Registration (Terminal Vessel Pattern)

**Implementation:** `repos/terminal/src/index.ts:124`

```typescript
async function registerWithBackend(endpoint: string) {
  const registrationUrl = `${ACTIVITY_API_ENDPOINT}/v2/vessels/register`;

  await fetch(registrationUrl, {
    method: 'POST',
    body: JSON.stringify({
      vesselId: INSTANCE_ID,
      vesselName: 'Terminal Vessel',
      endpoint: 'http://localhost:9137',
      shapes: [
        'terminalState',
        'terminalCommand',
        'terminalOutput'
      ],
      metadata: {
        version: '1.0.0',
        capabilities: ['pty', 'multi-viewer', 'checkpoints', 'replay'],
        environment: process.env.NODE_ENV || 'development',
        serverMode: 'tcp'
      }
    })
  });
}
```

**What gets registered:**
- `vesselId` - Unique identifier
- `vesselName` - Human-readable name
- `endpoint` - HTTP URL or Unix socket path
- `shapes` - Impulse types this vessel can resolve
- `metadata` - Capabilities, version, environment

**Discovery flow:**
```
1. Vessel starts → registers with backend
2. Backend stores in vessel registry
3. MiniBob queries backend: "Which vessel resolves 'terminalState'?"
4. Backend returns: { endpoint: 'http://localhost:9137' }
5. MiniBob routes impulse resolution to that endpoint
```

#### B. Configuration-Based Discovery (MiniBob Pattern)

**Implementation:** `repos/minibob/src/config.ts` + `repos/minibob/src/types.ts:1114`

```typescript
// User config: ~/.metabob/config.json
{
  "vessels": {
    "terminal": {
      "type": "mcp",
      "endpoint": "http://localhost:9137",
      "capabilities": ["terminalState", "terminalCommand"]
    },
    "database": {
      "type": "http",
      "endpoint": "http://localhost:5432",
      "capabilities": ["query", "schema"]
    }
  }
}
```

**Discovery flow:**
```
1. MiniBob loads config files (priority: env → project → user)
2. Reads vessels map from config
3. For each vessel, stores: { endpoint, type, capabilities }
4. When resolving impulse, checks if any vessel declares that shape
5. Routes to vessel endpoint
```

**Priority chain:**
- **Priority 10** (highest): Environment variables (`VESSEL_TERMINAL_ENDPOINT`)
- **Priority 20**: Project config (`.metabob/config.json`)
- **Priority 30** (lowest): User config (`~/.metabob/config.json`)

#### C. Introspection-Based Discovery (Codebase as Vessel)

**Pattern:** `docs/architecture/IMPULSE_ACTIVITY_FOUNDATION.md:234`

```typescript
// Discover npm scripts as resolvers
const pkg = await fs.readJSON('package.json')
for (const [name, command] of Object.entries(pkg.scripts || {})) {
  vessel.registerResolver(`npm:${name}`, {
    type: 'command',
    command: `npm run ${name}`,
    canProduce: inferOutputs(name)  // test → test_results
  })
}

// Discover Makefile targets
const makefile = await fs.readFile('Makefile', 'utf-8')
const targets = makefile.match(/^([a-z-]+):/gm)
for (const target of targets) {
  vessel.registerResolver(`make:${target}`, {
    type: 'command',
    command: `make ${target}`
  })
}
```

**Discovery sources:**
- `package.json` scripts → `npm:test`, `npm:build`
- `Makefile` targets → `make:deploy`, `make:clean`
- `.github/workflows/*.yml` → `ci:validate`, `ci:release`
- `docker-compose.yml` services → `docker:up`, `docker:logs`

---

### Proposed: Unified Discovery Service

**Design goals:**
- Support all three patterns (backend, config, introspection)
- Lazy discovery (don't scan until needed)
- Caching (don't re-scan on every impulse)
- Health checking (verify vessels are reachable)

```typescript
// repos/minibob/src/vessel-discovery.ts
interface VesselDescriptor {
  id: string
  name: string
  endpoint: string
  protocol: 'http' | 'mcp' | 'unix'
  shapes: string[]
  capabilities: string[]
  health?: {
    lastCheck: number
    reachable: boolean
  }
  source: 'backend' | 'config' | 'introspection' | 'environment'
}

class VesselDiscoveryService {
  private vessels: Map<string, VesselDescriptor> = new Map()
  private shapeIndex: Map<string, string[]> = new Map() // shape → vesselIds

  async discover(): Promise<VesselDescriptor[]> {
    // 1. Load from backend
    await this.discoverFromBackend()

    // 2. Load from config files
    await this.discoverFromConfig()

    // 3. Introspect codebase (if in project directory)
    await this.discoverFromCodebase()

    // 4. Build shape index
    this.buildShapeIndex()

    return Array.from(this.vessels.values())
  }

  async resolveShape(shape: string): Promise<VesselDescriptor | null> {
    const vesselIds = this.shapeIndex.get(shape)
    if (!vesselIds || vesselIds.length === 0) return null

    // Try vessels in priority order
    for (const vesselId of vesselIds) {
      const vessel = this.vessels.get(vesselId)
      if (!vessel) continue

      // Check health
      if (await this.checkHealth(vessel)) {
        return vessel
      }
    }

    return null
  }

  private async discoverFromBackend() {
    try {
      const response = await fetch(`${BACKEND}/v2/vessels/list`)
      const vessels = await response.json()

      for (const v of vessels) {
        this.vessels.set(v.vesselId, {
          id: v.vesselId,
          name: v.vesselName,
          endpoint: v.endpoint,
          protocol: v.endpoint.startsWith('unix://') ? 'unix' : 'http',
          shapes: v.shapes || [],
          capabilities: v.metadata?.capabilities || [],
          source: 'backend'
        })
      }
    } catch (error) {
      // Backend unavailable - continue with other sources
    }
  }

  private async discoverFromConfig() {
    const config = await loadConfig()

    for (const [vesselId, vesselConfig] of Object.entries(config.vessels || {})) {
      this.vessels.set(vesselId, {
        id: vesselId,
        name: vesselId,
        endpoint: vesselConfig.endpoint,
        protocol: vesselConfig.type || 'http',
        shapes: vesselConfig.capabilities || [],
        capabilities: vesselConfig.capabilities || [],
        source: 'config'
      })
    }
  }

  private async discoverFromCodebase() {
    // Introspect package.json
    const npmResolvers = await this.discoverNpmScripts()

    // Introspect Makefile
    const makeResolvers = await this.discoverMakeTargets()

    // Introspect CI config
    const ciResolvers = await this.discoverCIWorkflows()

    // Create synthetic vessel for codebase
    this.vessels.set('codebase', {
      id: 'codebase',
      name: 'Current Codebase',
      endpoint: 'local://',
      protocol: 'http',
      shapes: [
        ...npmResolvers.map(r => `npm:${r.name}`),
        ...makeResolvers.map(r => `make:${r.name}`),
        ...ciResolvers.map(r => `ci:${r.name}`)
      ],
      capabilities: ['command', 'script', 'build', 'test'],
      source: 'introspection'
    })
  }
}
```

---

## 2. Vessel-to-Vessel Interaction

### Current Pattern: Impulse-Mediated Communication

Vessels **do not call each other directly**. They communicate through impulses:

```
┌─────────────┐                    ┌──────────────┐
│  Terminal   │                    │  Database    │
│  Vessel     │                    │  Vessel      │
└──────┬──────┘                    └──────┬───────┘
       │                                  │
       │ Produces impulse:                │
       │ { shape: 'terminalState' }       │
       │                                  │
       ▼                                  │
┌──────────────────────────────────────┐ │
│         Impulse Store                │ │
│  (Backend or Local Registry)         │ │
└──────────────┬───────────────────────┘ │
               │                          │
               │ Activity requests:       │
               │ "terminalState" impulse  │
               │                          │
               ▼                          │
┌─────────────────────────────────────┐  │
│         Activity Executor            │  │
│  - Loads terminal impulse            │  │
│  - Executes tasks                    │  │
│  - Needs to query database           │  │
│  - Creates query impulse             │  │
└──────────────┬──────────────────────┘  │
               │                          │
               │ Produces impulse:        │
               │ { shape: 'query' }       │
               │                          │
               └──────────────────────────▶ Resolves query
```

### Example: Terminal + Database Interaction

**Activity template:**
```json
{
  "id": "debug-db-query-from-terminal",
  "tasks": [
    {
      "id": "run-query-in-terminal",
      "resolver": "terminal",
      "config": {
        "command": "psql -c 'SELECT * FROM users LIMIT 5'"
      },
      "outputShapes": ["terminalState"]
    },
    {
      "id": "extract-query-from-output",
      "resolver": "llm",
      "inputShapes": ["terminalState"],
      "prompt": {
        "template": "Extract the SQL query from terminal output: {{impulses.terminal.buffer}}"
      },
      "outputShapes": ["extracted_query"]
    },
    {
      "id": "execute-in-database",
      "resolver": "database",
      "inputShapes": ["extracted_query"],
      "config": {
        "sql": "{{impulses.query.content}}"
      },
      "outputShapes": ["query_result"]
    },
    {
      "id": "analyze-results",
      "resolver": "llm",
      "inputShapes": ["query_result", "terminalState"],
      "prompt": {
        "template": "Compare terminal output to database results:\nTerminal: {{impulses.terminal.buffer}}\nDatabase: {{impulses.result.rows}}"
      }
    }
  ]
}
```

**Execution flow:**
```
1. Task 1 (terminal): Runs command → produces terminalState impulse
2. Task 2 (llm): Reads terminalState → produces extracted_query impulse
3. Task 3 (database): Reads extracted_query → produces query_result impulse
4. Task 4 (llm): Reads both impulses → produces analysis
```

**Key insight:** Vessels never know about each other. They only know about impulse shapes they can produce/consume.

### Vessel Capabilities Discovery

```typescript
// Query what shapes a vessel can produce
const terminalCapabilities = await fetch('http://localhost:9137/capabilities')
// Returns: { shapes: ['terminalState', 'terminalCommand', 'terminalOutput'] }

const databaseCapabilities = await fetch('http://localhost:5432/capabilities')
// Returns: { shapes: ['query', 'schema', 'query_result'] }

// Activity planner can now reason:
// "To debug a query, I need:
//  1. Terminal vessel (can produce terminalState)
//  2. Database vessel (can produce query_result)
//  3. LLM resolver (can compare impulses)"
```

---

## 3. Bundling Multiple Vessels

### Pattern A: Docker Compose (Infrastructure Bundle)

```yaml
# docker-compose.yml
services:
  terminal-vessel:
    build: ./repos/terminal
    ports:
      - "9137:9137"
    environment:
      - ACTIVITY_API_ENDPOINT=http://activity-api:8080

  database-vessel:
    build: ./repos/database-vessel
    ports:
      - "5432:5432"
    depends_on:
      - postgres

  file-vessel:
    build: ./repos/file-vessel
    volumes:
      - ./workspace:/workspace

  activity-api:
    build: ./repos/metabob-activity-api
    ports:
      - "8080:8080"
```

**Discovery:**
```bash
# All vessels register with activity-api on startup
docker-compose up -d

# MiniBob discovers via backend
minibob --single "list available vessels"
# Returns:
# - terminal-vessel (http://terminal-vessel:9137)
# - database-vessel (http://database-vessel:5432)
# - file-vessel (http://file-vessel:8000)
```

### Pattern B: Vessel Collection (Logical Bundle)

```json
// ~/.metabob/vessel-bundles.json
{
  "development": {
    "vessels": {
      "terminal": {
        "endpoint": "http://localhost:9137",
        "autoStart": true,
        "command": "bun run repos/terminal/src/index.ts"
      },
      "database": {
        "endpoint": "http://localhost:5432",
        "autoStart": false
      }
    }
  },
  "production": {
    "vessels": {
      "terminal": {
        "endpoint": "http://terminal.metabob.local",
        "autoStart": false
      }
    }
  }
}
```

**Usage:**
```bash
# Load development bundle
minibob --bundle development

# Starts terminal vessel automatically
# MiniBob discovers both vessels
```

### Pattern C: Monorepo Workspace (Code Bundle)

```
repos/
├── terminal/              # Terminal vessel
│   ├── src/index.ts
│   └── package.json
├── database-vessel/       # Database vessel
│   ├── src/index.ts
│   └── package.json
├── file-vessel/          # File vessel
│   ├── src/index.ts
│   └── package.json
└── vessel-launcher.ts    # Launches all vessels
```

**Launcher:**
```typescript
// repos/vessel-launcher.ts
async function startVessels(config: { vessels: string[] }) {
  const processes = []

  for (const vesselName of config.vessels) {
    const vesselDir = `repos/${vesselName}`
    const proc = Bun.spawn(['bun', 'run', 'src/index.ts'], {
      cwd: vesselDir,
      stdout: 'inherit',
      stderr: 'inherit'
    })

    processes.push({ name: vesselName, proc })
  }

  // Wait for all to register
  await waitForVesselRegistration(config.vessels)

  return processes
}

// Start all vessels
await startVessels({
  vessels: ['terminal', 'database-vessel', 'file-vessel']
})
```

**Auto-discovery:**
```typescript
// MiniBob discovers from monorepo structure
const vessels = await glob('repos/*/src/index.ts')
for (const vesselEntry of vessels) {
  const vesselName = path.basename(path.dirname(path.dirname(vesselEntry)))

  // Check if it has vessel manifest
  const manifest = await readVesselManifest(`repos/${vesselName}`)
  if (manifest) {
    registerVessel(vesselName, manifest)
  }
}
```

---

## 4. Impulse and Activity System Integration

### A. Shape-Based Routing

**Activities declare shapes they need:**
```json
{
  "id": "analyze-terminal-session",
  "inputSchema": {
    "required": [
      { "shape": "terminalState", "budget": 10000 }
    ]
  },
  "tasks": [
    {
      "id": "analyze",
      "inputShapes": ["terminalState"],
      "resolver": "llm"
    }
  ]
}
```

**Executor resolves shapes:**
```typescript
async function executeActivity(activity: ActivityTemplate) {
  // 1. Discover which vessel provides terminalState
  const vessel = await vesselDiscovery.resolveShape('terminalState')
  // Returns: { endpoint: 'http://localhost:9137' }

  // 2. Load impulse from vessel
  const impulse = await fetch(`${vessel.endpoint}/v2/impulses/resolve`, {
    method: 'POST',
    body: JSON.stringify({
      pointer: { type: 'terminalState', terminalId: 'term-123' }
    })
  })

  // 3. Pass to activity task
  return executeTask(activity.tasks[0], [impulse])
}
```

### B. Multi-Vessel Activities

**Activity using 3 vessels:**
```json
{
  "id": "debug-integration-test",
  "tasks": [
    {
      "id": "run-test-in-terminal",
      "resolver": "terminal",
      "outputShapes": ["terminalState"]
    },
    {
      "id": "query-test-database",
      "resolver": "database",
      "inputShapes": ["terminalState"],
      "outputShapes": ["query_result"]
    },
    {
      "id": "check-log-files",
      "resolver": "file",
      "outputShapes": ["file_content"]
    },
    {
      "id": "analyze-all",
      "resolver": "llm",
      "inputShapes": ["terminalState", "query_result", "file_content"],
      "prompt": {
        "template": "Analyze the test failure using:\n1. Terminal output: {{impulses.terminal.buffer}}\n2. Database state: {{impulses.db.rows}}\n3. Log file: {{impulses.log.content}}"
      }
    }
  ]
}
```

**Execution:**
```
Terminal Vessel → terminalState impulse
     ↓
Database Vessel → query_result impulse
     ↓
File Vessel → file_content impulse
     ↓
LLM Resolver → analysis impulse (final output)
```

### C. Vessel Capabilities in Thompson Sampling

```typescript
// Backend learns which vessel combinations succeed
{
  "activity_id": "debug-integration-test",
  "vessel_combination": ["terminal", "database", "file", "llm"],
  "success_count": 23,
  "failure_count": 2,
  "thompson_score": 0.89
}

// When planning activities, backend recommends combinations
const recommendations = await backend.recommend({
  goal: "debug test failure",
  availableVessels: ["terminal", "database", "file"]
})
// Returns activities that use these exact vessels
```

### D. Impulse Flow Across Vessels

```
┌────────────────────────────────────────────────────────┐
│                   Activity Execution                    │
├────────────────────────────────────────────────────────┤
│                                                         │
│  Task 1 (Terminal Vessel)                              │
│  ┌────────────────────────────┐                        │
│  │ Input: command              │                        │
│  │ Resolver: terminal          │                        │
│  │ Output: terminalState ─────┼─┐                      │
│  └────────────────────────────┘ │                      │
│                                  │                      │
│  Task 2 (LLM Resolver)           │                      │
│  ┌────────────────────────────┐ │                      │
│  │ Input: terminalState ◀─────┘ │                      │
│  │ Resolver: llm                │                      │
│  │ Output: extracted_data ─────┼─┐                    │
│  └────────────────────────────┘ │ │                    │
│                                  │ │                    │
│  Task 3 (Database Vessel)        │ │                    │
│  ┌────────────────────────────┐ │ │                    │
│  │ Input: extracted_data ◀────┘ │                      │
│  │ Resolver: database           │                      │
│  │ Output: query_result ────────┼─┐                    │
│  └────────────────────────────┘ │                      │
│                                  │                      │
│  Task 4 (File Vessel)            │                      │
│  ┌────────────────────────────┐ │                      │
│  │ Input: query_result ◀──────┘│                      │
│  │ Resolver: file               │                      │
│  │ Output: file_content ────────┼─┐                    │
│  └────────────────────────────┘   │                    │
│                                    │                    │
│  Task 5 (LLM Resolver - Final)     │                    │
│  ┌─────────────────────────────┐  │                    │
│  │ Input: all previous impulses ◀─┘                    │
│  │ Resolver: llm                                        │
│  │ Output: final_analysis                               │
│  └─────────────────────────────┘                        │
│                                                         │
└────────────────────────────────────────────────────────┘
```

---

## Implementation Roadmap

### Phase 1: Discovery Service (Current)
- ✅ Backend registration (terminal vessel)
- ✅ Config-based discovery (MiniBob)
- 🚧 Unified discovery service
- 🚧 Health checking

### Phase 2: Introspection Discovery
- 🔲 npm/Makefile scanning
- 🔲 Synthetic codebase vessel
- 🔲 CI workflow detection

### Phase 3: Vessel Bundling
- 🔲 Docker Compose support
- 🔲 Vessel bundle configs
- 🔲 Auto-start vessels
- 🔲 Monorepo launcher

### Phase 4: Multi-Vessel Activities
- 🔲 Shape-based routing
- 🔲 Vessel capability queries
- 🔲 Thompson Sampling for combinations
- 🔲 Impulse flow visualization

---

## Key Architectural Principles

1. **Vessels are discoverable** - Multiple discovery mechanisms (backend, config, introspection)
2. **Vessels communicate via impulses** - No direct vessel-to-vessel calls
3. **Shape is the contract** - Vessels declare what shapes they can resolve
4. **Activities compose vessels** - Tasks can use resolvers from any vessel
5. **Backend learns combinations** - Thompson Sampling for vessel selection
6. **Bundling is flexible** - Docker Compose, config files, or monorepo patterns

---

## References

- `repos/terminal/src/index.ts` - Vessel registration implementation
- `repos/minibob/src/config.ts` - Config-based discovery
- `repos/minibob/src/types.ts` - VesselManifest type definition
- `docs/architecture/IMPULSE_ACTIVITY_FOUNDATION.md` - Introspection patterns
- `TERMINAL_COMPLETE_GUIDE.md` - Terminal vessel integration
