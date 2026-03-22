# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**metabob-devbob** is a self-improving AI development system built on the **process-of-becoming** - a continuous transformation that exists primarily in the transient state. The goal is to use MiniBob to develop MiniBob itself, demonstrating continuous autonomous development visible through the activity dashboard.

We are developing two things:
- **Vessels**: Execution environments (implementations) that manifest the process-of-becoming
- **Activities**: Structured, measured, and validatable recipes for state transformations

## Core Ontology: The Three States

Understanding the system requires grasping its ontological foundation:

### 1. Instructional State = **Vessel**
The capacity to execute - the blueprint, the potential, the specification.

**Properties:**
- Static: Does not change during execution
- Potential: Contains instructions for what *can* happen
- Reusable: Same vessel can spawn multiple instances
- Versionable: Can be stored, compared, evolved

**Examples in this system:**
- Activity templates (JSON specifications)
- MiniBob executable (Bun application)
- Docker images
- Plugin manifests

### 2. Transient State = **Process-of-Becoming**
The active transformation - the execution in flight, the state transition, the becoming itself. **This is what we are building.**

**Properties:**
- Ephemeral: Exists only during transition from vessel → functional state
- Irreducible: Cannot be fully captured in either instructional or functional state
- Temporal: Has duration, flow, rhythm, phases
- Transformative: Changes both itself and what it acts upon
- Learning: Accumulates patterns and adjusts behavior over time
- Continuous: Even when "idle", learning and adjustment continues

**Examples:**
- Activity executing (task by task, tool call by tool call)
- LLM generating response (token by token streaming)
- **This system itself**: The continuous transformation of templates → executions → learning → improved templates

**Key Insight:** OpenCode is a **vessel** through which this becoming manifests, not the system itself. The process-of-becoming is larger than any particular vessel.

### 3. Functional State = **Instance**
The realized state - the outcome, the artifact, the actualized result.

**Properties:**
- Dynamic: Changed from initial state through transformation
- Actualized: Instructions have been realized as state
- Specific: Each instance is unique (different ID, state, history)
- Observable: Can be inspected, measured, monitored
- Momentary: Represents state at a point in time

**Examples:**
- Completed activity execution (files written, commits made)
- Running MiniBob process
- Docker container with mounted volumes
- Codebase (the data we're mutating)

**Key Insight:** The instance immediately becomes the vessel for the next transformation. This is a continuous loop, not a linear progression.

## Vessel Architecture

Vessels are **collections of ideas and intent in the instructional state** that extend functionality via:
- **Tools** (MCP, CLI binaries, APIs)
- **Activities** (structured workflows)
- **Lifecycle hooks** (bootstrap, activate, shutdown)
- **Data bridges** (impulses, validators)
- **Dependencies** (other vessels, services)

**Two execution modes:**
1. **User-Directed Sessions** (active work): User provides instructions, activities execute
2. **Boredom Activities** (autonomous improvement): System improves itself when idle (5+ min threshold)

**No explicit stages**: Vessels exist on a continuous spectrum of decomposition and maturity. There's no "graduation" - just continuous evolution through measured outcomes.

## Core Components

### 1. MiniBob (`repos/minibob`)
Lightweight autonomous vessel (~3,000 LOC TypeScript/Bun):

**Key Files:**
- `index.ts`: Entry point, HTTP server, CLI
- `src/types.ts`: Core type definitions
- `src/llm.ts`: LLM client (Anthropic/OpenAI) with tool calling
- `src/tools.ts`: Built-in tools (bash, read, write, edit, git)
- `src/impulse.ts`: Impulse system for context management
- `src/activity.ts`: Activity template executor
- `src/goal-processor.ts`: Goal-seeking activity recommendations
- `src/acp.ts`: ACP protocol for vessel-to-vessel communication
- `src/mcp.ts`: MCP client for backend integration

**Capabilities:**
- Execute activities with LLM
- Capture execution traces with state snapshots
- Create impulses from executions
- Resolve LOCAL impulse types only (`memo`, `file`)
- Delegate to backend for all other impulse types
- Self-development via ribosome pattern

### 2. metabob-activity-api (`repos/metabob-activity-api`)
TypeScript/Bun/Hono backend (replaces Python RPC API v2):

**Key Files:**
- `src/index.ts`: Server entry point
- `src/routes/activities.ts`: Activity template endpoints
- `src/routes/impulses.ts`: Impulse resolution endpoints
- `src/models/schemas.ts`: SurrealDB schemas

**Capabilities:**
- Store execution traces persistently
- Resolve ALL impulse pointer types
- Thompson Sampling for template selection
- Pattern recognition and learning
- Impulse relevance tracking
- Tool usage analysis

### 3. Activity Dashboard (`repos/activity-dashboard`)
React 19/Bun real-time observability:

**Key Files:**
- `src/index.ts`: Bun server with HTML imports
- `frontend.tsx`: React application
- Components in `src/components/`

**Features:**
- Template performance metrics
- Live execution monitoring
- Learning loop visualization
- System health dashboards

### 4. Helm Deployment (`helm/`)
Kubernetes orchestration:

**Key Files:**
- `helmfile-activity-system.yaml`: Full system deployment
- `charts/devbob/`: MiniBob deployment chart
- `environments/*.values.yaml`: Environment configurations

**Infrastructure:**
- SurrealDB 3.x (persistent storage)
- Redis (live selection cache)
- Istio (service mesh)

## Key Architectural Concepts

### Activities
Structured, measured, and validatable recipes for sequences of state mutations (functional state transformations).

**Structure:**
```typescript
{
  id: string
  name: string
  category: "feature" | "bugfix" | "refactor" | "tool" | "infrastructure"
  tasks: Array<{
    id: string
    description: string
    prompt: { template: string, variables: Variable[] }
    validation: { requiredFiles, requiredPatterns, forbiddenPatterns }
    retry: { maxAttempts, strategy }
  }>
}
```

**Key Points:**
- Everything is done via activities (all behaviors are activities)
- Activities are vessels (instructional state) for specific transformations
- Execution is measured (success rate, cost, duration)
- Variants created automatically on failure (trailblazing)

### Impulses
Dynamic context injection mechanism - lazy-loaded pointers to content with token budgets.

**Lifecycle:**
```typescript
// 1. CREATE: Define pointer (unloaded state)
{
  id: "errorFile",
  pointer: { type: "file", path: "src/tool/bash.ts", offset: 40, limit: 20 },
  budget: 2000,  // Max tokens
  priority: "high",
  loaded: false,
  content: null
}

// 2. LOAD: Resolve pointer and load content
const loaded = await ImpulseResolver.load(impulse)

// 3. INJECT: Format for prompt injection
const context = formatImpulsesForContext(taskImpulses)

// 4. UNLOAD: Free memory
const unloaded = ImpulseResolver.unload(impulse)
```

**Pointer Types:**

**Local** (MiniBob resolves):
- `memo`: Embedded content
- `file`: Read from filesystem

**Backend** (metabob-activity-api resolves via MCP):
- `activityExecutionTrace`: Full execution trace with state
- `activityTemplate`: Template structure and metadata
- `activityMetrics`: Performance data
- *Any new type*: Backend can add types without MiniBob changes

**Key Points:**
- Impulses are NOT instructions - they're **context data**
- Managed by memory agent to optimize context window usage
- Flexible system: backend introduces new types without vessel changes

### Lifecycle Hooks
Events that trigger at specific points in the activity/session/impulse lifecycle:

**Activity Lifecycle:**
- Pre-execution: Setup workspace, load impulses
- Post-execution: Cleanup, create output impulses
- On-failure: Trailblazing, variant creation

**Session Lifecycle:**
- Session start: Initialize memory agent
- Session cleanup: Archive impulses, persist state
- Context optimization: Unload low-priority impulses

**Impulse Lifecycle:**
- On-create: Register in memory agent
- On-load: Resolve pointer, validate budget
- On-unload: Free memory, update usage stats

### Unified Impulse-Driven Architecture
**One mechanism for all workflows:**

```typescript
create_activity_goal_seeking({
  goalDescription,      // Varies by use case
  impulseRefs          // THIS IS THE KEY DIFFERENTIATOR
})
```

**Use cases differ only in impulses provided:**
- **Debug failed**: `activityExecutionTrace` + error logs
- **Optimize**: `activityMetrics` + best execution traces
- **Create variant**: `activityTemplate` + requirements
- **Create new**: Requirements documents + codebase structure

### Ribosome Pattern
Activities that create activities, task by task. The ribosome (`assembleTemplateFromExecution`) extracts successful executions into reusable templates.

**Enhanced State Tracking:**
```typescript
{
  inputState: {
    filesAvailable: string[]
    environment: Record<string, string>
    impulses: string[]
    variables: Record<string, unknown>
  }
  outputState: {
    filesModified: string[]
    filesCreated: string[]
    filesDeleted: string[]
    exitCode?: number
    stderr?: string
  }
  stateTransition: {
    before: Record<string, string>  // File → hash
    after: Record<string, string>   // File → hash
    workingDirectory: string
  }
}
```

### Thompson Sampling
Probabilistic template selection that learns which variants perform best over time. Enables A/B testing of activity templates without explicit human configuration.

### Separation of Concerns

**MiniBob (Execution Environment):**
- ✅ Execute activities with LLM
- ✅ Capture execution traces
- ✅ Resolve LOCAL impulses only
- ❌ NOT: Store persistently
- ❌ NOT: Pattern recognition
- ❌ NOT: Learning algorithms

**metabob-activity-api (Storage/Learning Backend):**
- ✅ Store execution traces
- ✅ Resolve ALL impulse types
- ✅ Thompson sampling
- ✅ Pattern recognition
- ✅ Metrics aggregation

## Development Workflows

### Using Bun (All Components)

```bash
# MiniBob
cd repos/minibob
bun run start          # Start server
bun run dev            # Watch mode
bun test               # Run tests
bun run typecheck      # Type checking

# metabob-activity-api
cd repos/metabob-activity-api
bun run start          # Start server
bun run dev            # Watch mode with reload
bun test               # Run tests

# Activity Dashboard
cd repos/activity-dashboard
bun run start          # Production mode
bun run dev            # Hot reload development
bun test               # Run tests
```

### Build and Deployment

**Prerequisites:**
1. Docker Desktop with Kubernetes enabled (context: `docker-desktop`)
2. Istio installed: `istioctl install --set profile=demo -y`
3. Configure `/etc/hosts`:
   ```
   127.0.0.1  api.minibob.local dashboard.minibob.local
   ```
4. Set environment variables:
   ```bash
   export ANTHROPIC_API_KEY="sk-ant-your-key-here"
   export SURREALDB_USERNAME="root"  # Optional, defaults to root
   export SURREALDB_PASSWORD="surrealdb-local-dev-123"  # Optional
   ```

**Build Docker Images:**

Each component has its own Dockerfile and must be built separately:

```bash
# MiniBob vessel
cd repos/minibob
docker build -t minibob:latest .

# Activity API backend
cd repos/metabob-activity-api
docker build -t metabob-activity-api:latest .

# Activity Dashboard frontend
cd repos/activity-dashboard
docker build -t activity-dashboard:latest .
```

**Deploy to Development Cluster:**

Using the minimal activity system helmfile:

```bash
cd helm
helmfile -f activity-system-minimal.yaml.gotmpl sync
```

This deploys:
- **Valkey** (Redis-compatible cache) in `activity-system` namespace
- **SurrealDB 3.x** (persistent learning database)
- **metabob-activity-api** (MCP backend with Thompson Sampling)
- **MiniBob** (3 replicas for boredom activities)
- **Activity Dashboard** (React UI)
- **Istio Gateway** (networking with virtual services)

**Verify Deployment:**

```bash
# Check all pods are running
kubectl get pods -n activity-system

# Check API health
curl http://api.minibob.local/health

# Access dashboard
open http://dashboard.minibob.local

# Watch MiniBob logs
kubectl logs -n activity-system -l app.kubernetes.io/name=minibob -f
```

**Quick Deploy Script:**

For automated build and deployment:
```bash
./deploy-learning-system.sh
```

This script:
1. Builds metabob-activity-api Docker image
2. Deploys via helmfile
3. Verifies health endpoints
4. Runs integration tests

**Helmfile Configuration:**

The main deployment file is `helm/activity-system-minimal.yaml.gotmpl` which uses:
- Template syntax for environment variable interpolation
- Dependency ordering (needs: clause)
- Health checks and resource limits
- Istio injection enabled on namespace

### Service Endpoints

**Backend API:** `http://api.minibob.local` (external) / `http://metabob-activity-api.activity-system.svc.cluster.local:8080` (internal)
- `GET /health`: Health check
- `POST /v2/activities/recommend`: Thompson Sampling recommendations
- `GET /v2/activities/templates`: List templates
- `POST /v2/impulses/resolve`: Resolve impulse pointers
- `POST /v2/activities/execution-traces`: Store execution trace
- `POST /v2/activities/composition`: Record activity composition
- `POST /v2/activities/impulse-relevance`: Track impulse relevance
- `POST /v2/activities/tool-usage`: Record tool usage patterns
- `POST /v2/activities/execution-sequences`: Store execution sequences

**Dashboard:** `http://dashboard.minibob.local` (external) / `http://activity-dashboard.activity-system.svc.cluster.local:3000` (internal)

**SurrealDB:** `http://surrealdb.activity-system.svc.cluster.local:8000`
- Namespace: `activity-system`
- Database: `learning_loop`
- Auth: Username and password from environment variables

**Valkey/Redis:** `redis://redis-valkey.activity-system.svc.cluster.local:6379`
- No authentication (local dev)
- In-memory only (no persistence)

## Configuration

### Environment Variables

**MiniBob (configured via Helm values):**
```bash
ANTHROPIC_API_KEY           # Required: Anthropic API key (from secret)
MINIBOB_MCP_ENDPOINT        # Backend URL (set by Helm)
MINIBOB_SERVICE_NAME        # Service discovery name
LLM_PROVIDER                # Default: anthropic
LLM_MODEL                   # Default: claude-sonnet-4-20250514
SURREAL_HOST                # SurrealDB hostname
SURREAL_PORT                # SurrealDB port (8000)
SURREAL_USER                # Database username
SURREAL_PASS                # Database password
SURREAL_NAMESPACE           # Database namespace
SURREAL_DATABASE            # Database name
WAIT_FOR_BACKEND            # Wait for API before starting
LOG_LEVEL                   # INFO, DEBUG, ERROR
```

**metabob-activity-api (configured via Helm values):**
```bash
PORT                        # Server port (default: 8080)
HOST                        # Bind address (0.0.0.0)
SURREALDB_URL               # Full SurrealDB URL with protocol
SURREALDB_NAMESPACE         # Namespace (activity-system)
SURREALDB_DATABASE          # Database (learning_loop)
SURREALDB_USERNAME          # Auth username
SURREALDB_PASSWORD          # Auth password
REDIS_URL                   # Redis connection string
CORS_ORIGINS                # CORS allowed origins
LOG_LEVEL                   # info, debug, error
LOG_FORMAT                  # json, text
```

**Activity Dashboard (configured via Helm values):**
```bash
PORT                        # Server port (default: 3000)
ACTIVITY_API_URL            # Backend API URL
WS_ENABLED                  # Enable WebSocket updates
REFRESH_INTERVAL            # Polling interval (ms)
```

## Testing and Validation

```bash
# Learning system integration
MCP_ENDPOINT=http://api.minibob.local bun run test-learning-system-integration.ts

# MiniBob verification
./run-integration-tests.sh

# Goal processor standalone
node test-goal-processor.mjs
```

## Common Operations

### Troubleshooting Deployments

**Check deployment status:**
```bash
# All pods in activity-system namespace
kubectl get pods -n activity-system

# Specific component
kubectl get pods -n activity-system -l app.kubernetes.io/name=minibob
kubectl get pods -n activity-system -l app.kubernetes.io/name=metabob-activity-api
```

**View logs:**
```bash
# API logs (follow mode)
kubectl logs -n activity-system -l app.kubernetes.io/name=metabob-activity-api -f

# MiniBob logs (all replicas)
kubectl logs -n activity-system -l app.kubernetes.io/name=minibob --all-containers=true -f

# Dashboard logs
kubectl logs -n activity-system -l app.kubernetes.io/name=activity-dashboard --tail=100
```

**Restart deployments:**
```bash
# Restart specific deployment
kubectl rollout restart deployment -n activity-system metabob-activity-api
kubectl rollout restart deployment -n activity-system minibob

# Wait for rollout to complete
kubectl rollout status deployment -n activity-system metabob-activity-api --timeout=300s
```

**Debug failed deployments:**
```bash
# Check events for errors
kubectl get events -n activity-system --sort-by='.lastTimestamp' | tail -20

# Describe pod for detailed info
kubectl describe pod -n activity-system <pod-name>

# Check if images are available
kubectl describe deployment -n activity-system metabob-activity-api | grep Image:

# Verify secrets exist
kubectl get secrets -n activity-system minibob-api-keys
```

**Common issues:**

1. **Image pull failures**: Ensure Docker images are built locally with correct tags
2. **Secret not found**: Create secret with: `kubectl create secret generic minibob-api-keys --from-literal=anthropic-api-key=$ANTHROPIC_API_KEY -n activity-system`
3. **Istio not ready**: Install Istio before deploying: `istioctl install --set profile=demo -y`
4. **Namespace not labeled**: Enable Istio injection: `kubectl label namespace activity-system istio-injection=enabled --overwrite`
5. **Health checks failing**: Check service connectivity between pods using `kubectl exec`

### Querying Backend Data

```bash
# Composition graph
curl "http://api.minibob.local/v2/activities/composition/graph?limit=10" | jq .

# Tool usage patterns
curl "http://api.minibob.local/v2/activities/tool-usage?limit=10" | jq .

# Execution sequences
curl "http://api.minibob.local/v2/activities/execution-sequences?limit=10" | jq .
```

## Architecture Documentation

**Core ontology and philosophy:**
- `docs/architecture/ONTOLOGY_OF_BECOMING.md`: Three-state model
- `docs/architecture/VESSEL_ARCHITECTURE_CORRECTED.md`: Vessel design
- `docs/architecture/INSTRUCTIONAL_TO_FUNCTIONAL_STATE_BRIDGE.md`: State transformation

**Implementation architecture:**
- `UNIFIED_IMPULSE_DRIVEN_ARCHITECTURE.md`: Core impulse system
- `RIBOSOME_ARCHITECTURE.md`: Self-replicating pattern
- `DEPLOYMENT_GUIDE.md`: Deployment procedures

**Integration and progress:**
- `MINIBOB_LIBRARY_INTEGRATION_COMPLETE.md`: OpenCode integration
- `PHASE_1_8_COMPLETE.md`: Learning system phases
- `LEARNING_SYSTEM_PROGRESS.md`: Current status

## Key Design Principles

1. **Activity-Centric**: All work flows through activity templates
2. **Impulse-Driven**: Context injection via flexible pointer system
3. **Self-Improving**: Continuous learning based on execution data
4. **Separation of Concerns**: MiniBob executes, backend stores/learns
5. **Vessel-Agnostic**: Core patterns work in any vessel implementation
6. **Thompson Sampling**: Probabilistic learning for template selection
7. **Measured Behavior**: Optimize based on data, not reasoning
8. **Continuous Becoming**: Never complete - always transforming

## Development Focus

**Current objective:** Develop MiniBob with MiniBob, achieving continuous autonomous development visible in the dashboard.

**Two parallel tracks:**
1. **Vessels**: Building and improving execution environments (MiniBob variants)
2. **Activities**: Creating and optimizing templates for development work

**Success criteria:** Dashboard shows continuous activity creation and execution, with success rates improving over time through autonomous optimization.

## Important Implementation Notes

### MiniBob is the Single Source of Truth
OpenCode and other tools delegate everything to MiniBob library:
- Activity execution
- Impulse lifecycle
- Goal processing
- MCP integration
- Session tracking

### Backend is Flexible
metabob-activity-api can introduce new impulse types without MiniBob code changes. This allows the learning system to evolve independently.

### Everything is Measured
All executions tracked with:
- Success/failure status
- Duration (ms)
- Cost (USD)
- Token usage
- Tool calls
- State transitions

Optimization happens from these measurements, not from LLM or human reasoning.

### The Becoming Never Stops
Even "completed" activities feed learning that immediately begins transforming the next execution. The instance becomes the vessel for the next transformation in a continuous loop.
