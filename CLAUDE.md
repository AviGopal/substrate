# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Foundational Reference

> **CRITICAL**: Before implementing anything, read [`docs/architecture/IMPULSE_ACTIVITY_FOUNDATION.md`](docs/architecture/IMPULSE_ACTIVITY_FOUNDATION.md)
>
> This is the canonical document that defines the entire system. All other architecture documents, implementations, and changes must align with it. If you find yourself adding endpoints, creating single-use access patterns, or treating the backend as a universal resolver, you are drifting from the foundation.

**The Core Model (summary):**
- **Impulses** = Data in any form (text, structured data, signals, commands) with metadata for reasoning
- **Activities** = Constrained state transitions that link input impulse sets to output impulse sets
- **Vessels** = Bundles of activities + resolvers that provide capabilities where data lives
- **Backend** = Trace store + pattern learner (NOT a universal resolver)
- **Learning** = Thompson Sampling for activities, relevance scores for impulses, ribosome for extraction
- **LLMs** = One resolver type among many, used only when reasoning about ambiguous input is needed

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
1. **Discussions** (active work): User provides instructions, activities execute
2. **Boredom** (autonomous improvement): System improves itself when idle (5+ min threshold)

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
   127.0.0.1  api.metabob.local app.metabob.local activity.metabob.local
   127.0.0.1  graph.metabob.local internal.metabob.local surql.metabob.local minibob.metabob.local
   ```
4. Set environment variables:
   ```bash
   export ANTHROPIC_API_KEY="sk-ant-your-key-here"
   export SURREALDB_USERNAME="root"  # Optional, defaults to root
   export SURREALDB_PASSWORD="surrealdb-local-dev-123"  # Optional
   ```

**Build Docker Images:**

Use the build script to build all vessels with correct contexts:

```bash
# Build all vessels
./scripts/build-vessels.sh

# Or build specific vessel
./scripts/build-vessels.sh minibob
./scripts/build-vessels.sh metabob-activity-api
./scripts/build-vessels.sh activity-dashboard
```

**Important:** The `metabob-activity-api` image requires a multi-repo build context:

```bash
# Automated (recommended)
./scripts/build-vessels.sh metabob-activity-api

# Manual
cd repos
docker build -f metabob-activity-api/Dockerfile -t metabob-activity-api:latest .
```

This includes metabob-proto schemas for automated database migrations. **Do not build from `repos/metabob-activity-api/`** - the Dockerfile requires access to the parent repos/ directory.

**Deploy to Development Cluster:**

Using the minimal activity system helmfile:

```bash
cd helm
helmfile -f activity-system-minimal.yaml.gotmpl sync
```

This deploys (in order):
1. **Valkey** (Redis-compatible cache) in `activity-system` namespace
2. **SurrealDB 3.x** (persistent learning database)
3. **Schema Migration Job** (hook-weight: 5) - Applies all database schemas automatically
4. **Init-Data Job** (hook-weight: 10) - Creates default org and MiniBob instance
5. **metabob-activity-api** (MCP backend with Thompson Sampling)
6. **MiniBob** (3 replicas for boredom activities)
7. **Activity Dashboard** (React UI)
8. **Istio Gateway** (networking with virtual services)

**Automated Schema Deployment:**
- Schemas are applied automatically via Helm hooks
- No manual schema application required
- Migration Job creates namespace, applies core + activity schemas, backfills org_id
- Init-Data Job creates organizations:metabob_internal and minibob-local-001 instance
- Both Jobs are idempotent (safe to redeploy)

**Verify Deployment:**

```bash
# Check Helm hook Jobs completed
kubectl get jobs -n activity-system
# Expected: surrealdb-schema-migration (1/1), surrealdb-init-data (1/1)

# View migration logs
kubectl logs -n activity-system job/surrealdb-schema-migration
# Expected: ✓ Applied core schemas, ✓ Applied activity schemas, ✓ Data migrations completed

# View init-data logs
kubectl logs -n activity-system job/surrealdb-init-data
# Expected: ✓ Organization metabob_internal created, ✓ MiniBob instance minibob-local-001 created

# Check all pods are running
kubectl get pods -n activity-system
# Expected: surrealdb-0, metabob-activity-api, minibob-x3, activity-dashboard, redis-valkey

# Check API health
curl http://api.minibob.local/health
# Expected: {"status": "ok"}

# Verify MiniBob authentication
curl -X POST http://api.minibob.local/v2/auth/minibob/signin \
  -H "Content-Type: application/json" \
  -d '{"instance_id":"minibob-local-001","api_key":"test-api-key-123"}' | jq
# Expected: {"token": "eyJ...", "org_id": "metabob_internal"}

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

**Backend API:** `http://activity.metabob.local` (external) / `http://metabob-activity-api.activity-system.svc.cluster.local:8080` (internal)
- `GET /health`: Health check
- `POST /v2/activities/recommend`: Thompson Sampling recommendations
- `GET /v2/activities/templates`: List templates
- `POST /v2/impulses/resolve`: Resolve impulse pointers
- `POST /v2/activities/execution-traces`: Store execution trace
- `POST /v2/activities/composition`: Record activity composition
- `POST /v2/activities/impulse-relevance`: Track impulse relevance
- `POST /v2/activities/tool-usage`: Record tool usage patterns
- `POST /v2/activities/execution-sequences`: Store execution sequences

**SurrealDB:** `http://surql.metabob.local` (external) / `http://surrealdb.activity-system.svc.cluster.local:8000` (internal)
- Namespace: `activity-system`
- Database: `learning_loop`
- Auth: Username and password from environment variables

### Development Network Mapping

All services use the `.metabob.local` TLD for local development. Traffic routes through Istio ingress gateway on port 80.

**Service Hostname Matrix:**

| Hostname | Service | Port | Purpose | Notes |
|----------|---------|------|---------|-------|
| `app.metabob.local` | metabob-cloud-dashboard | 3000 | SaaS frontend | WebSocket at `/ws` |
| `activity.metabob.local` | metabob-activity-api | 8080 | Learning backend | Thompson Sampling, traces |
| `api.metabob.local` | metabob-analysis-api | 8080 | Code analysis | Problem detection |
| `graph.metabob.local` | activity-dashboard | 3000 | Observability UI | Dev only |
| `internal.metabob.local` | metabob-internal-dashboard | 3001 | Internal UI | WebSocket at `/ws` |
| `surql.metabob.local` | surrealdb | 8000 | Database | Headers auto-injected |
| `minibob.metabob.local` | minibob | 8080 | Autonomous vessel | 3 replicas |

**SurrealDB Access Notes:**

Istio automatically injects headers for `surql.metabob.local`:
```yaml
headers:
  request:
    set:
      surreal-ns: activity-system
      surreal-db: learning_loop
      Accept: application/json
```

This means API calls work without specifying namespace/database:
```bash
# Works - headers injected by Istio
curl -X POST http://surql.metabob.local/sql \
  -u 'root:surrealdb-local-dev-123' \
  -d 'SELECT * FROM activity LIMIT 5'

# Root path redirects to Surrealist (intentional SurrealDB behavior)
# Use https://surrealdb.com/surrealist for browser-based DB access
```

**`.local` TLD Considerations:**

The `.local` TLD is reserved for mDNS (Multicast DNS). On some systems:
- mDNS may intercept `.local` queries before checking `/etc/hosts`
- Linux with `systemd-resolved`: Check `resolvectl status` for mDNS settings
- macOS: May have conflicts with Bonjour

If resolution fails, verify with:
```bash
getent hosts surql.metabob.local  # Should return 127.0.0.1
resolvectl query surql.metabob.local  # Check resolver path
```

## Configuration

### Environment Variables

**MiniBob (configured via Helm values):**
```bash
ANTHROPIC_API_KEY           # Required: Anthropic API key (from secret)
ACTIVITY_API_ENDPOINT       # Activity API (default: https://activity.metabob.com)
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

## Commit Practices

**Commit early and often once a feature is working.** Don't accumulate large uncommitted changes.

### When to Commit

1. **After demonstrating a working codepath in the deployed environment**
   - You've verified the feature works via API calls, tests, or the dashboard
   - The deployment is healthy and the feature behaves as expected

2. **After completing a logical unit of work**
   - A new route or endpoint is functional
   - A schema migration has been deployed and verified
   - A bug fix has been tested

3. **Before making destructive changes**
   - Before deleting a namespace and redeploying
   - Before major refactoring
   - Before switching to a different approach

### Commit Scope

Keep commits reasonably sized and focused:
- **One feature per commit** (e.g., "Add API key auth endpoint")
- **Related changes together** (e.g., route + middleware + schema)
- **Separate concerns** (don't mix unrelated features)

### Commit Message Format

```
<type>(<scope>): <subject>

<body - explain why, not what>

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
```

Types: `feat`, `fix`, `refactor`, `test`, `docs`, `chore`

Scopes: `activity-api`, `analysis-api`, `minibob`, `dashboard`, `helm`, `schema`

### Before Redeploying from Scratch

Always audit before `helmfile destroy` or namespace deletion:
1. Check `git status` for uncommitted changes
2. Verify schema files match deployed database (`INFO FOR DB`)
3. Ensure no manual database workarounds that aren't in migration scripts

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

**Canonical reference (read this first):**
- [`docs/architecture/IMPULSE_ACTIVITY_FOUNDATION.md`](docs/architecture/IMPULSE_ACTIVITY_FOUNDATION.md): The foundational model defining impulses, activities, vessels, and learning

**Complementary architecture docs:**
- `COMPOSITION_AND_CONTROL_FLOW.md`: Activity composition patterns and hooks
- `ACTIVITY_BASED_IMPROVISATION.md`: VM-as-executor philosophy
- `DEPLOYMENT_GUIDE.md`: Kubernetes deployment procedures

**Multi-tenant & RBAC:**
- `docs/MULTI_TENANT_ARCHITECTURE.md`: Tenancy model and authentication
- `docs/RBAC_GUIDE.md`: PERMISSIONS patterns and best practices
- `docs/AUTH_JWT_CLAIMS.md`: JWT token structure
- `docs/SCHEMA_OWNERSHIP.md`: Service-to-table ownership

**Archived docs** (superseded by foundation doc):
- `docs/archive/2026-03-27-superseded/`: Historical design documents

## RBAC and Multi-Tenant Isolation

The system uses SurrealDB PERMISSIONS for database-level RBAC enforcement:

**Authentication Methods:**
- **JWT External**: Dashboard users (15 min tokens)
- **API Key**: IDE integrations like metabob-mcp (auto-refresh)
- **MiniBob Record**: Autonomous vessel instances (24h tokens)

**Data Isolation:**
- All multi-tenant tables have `org_id` field
- PERMISSIONS clauses enforce `WHERE org_id = $auth.org_id`
- No application-level filtering needed - SurrealDB handles it

**Usage Pattern:**
```typescript
// Use authenticated connection - PERMISSIONS enforced automatically
const db = await createAuthenticatedClient(jwtToken);
const templates = await db.query(`SELECT * FROM activity_template`);
// Returns only templates for $auth.org_id
```

**Key Points:**
- Never bypass PERMISSIONS with root credentials
- Always use `createAuthenticatedClient()` or `queryWithAuth()`
- The `$auth` variable is populated from JWT claims
- Public templates have `public = true` and are visible to all orgs

## Key Design Principles

> See [`docs/architecture/IMPULSE_ACTIVITY_FOUNDATION.md`](docs/architecture/IMPULSE_ACTIVITY_FOUNDATION.md) for the complete foundational model.

1. **Impulses Are Universal Data**: Everything is an impulse (text, structured data, signals, commands). Metadata describes shape; resolvers access content.
2. **Activities Constrain Search**: Without activities, infinite options. With activities, ranked finite options. Learning improves ranking.
3. **Resolvers Live Where Data Lives**: Don't centralize resolution. Vessels resolve what they have access to. Backend only stores traces.
4. **Metadata First, Content Later**: Reasoners see metadata to decide. Resolvers load content to execute.
5. **Record Everything**: Every execution is traced. This is the raw material for learning.
6. **Learn From Traces**: Thompson Sampling for activities. Relevance scores for impulses. Ribosome for extraction.
7. **Reserve Improvisation**: When nothing matches, try something new. But record it. Learn from it.
8. **LLMs Are Tools, Not Controllers**: Use LLMs for reasoning and generation. Use deterministic resolvers for everything else.

### Implementation Alignment Checklist

Before implementing any feature, verify alignment with the foundation:

- [ ] Does it treat data as impulses with metadata?
- [ ] Does it use activities to constrain the search space?
- [ ] Do resolvers live where the data is?
- [ ] Does it record traces for learning?
- [ ] Does it avoid unnecessary LLM usage?
- [ ] Does it allow improvisation with recording?
- [ ] Is the backend limited to trace storage and pattern learning?
- [ ] Can this pattern be extracted and reused?

**Red flags** (signs of drift):
- Adding new REST endpoints for single-use queries
- Treating the backend as a universal resolver
- LLM processing raw data instead of reasoning about metadata
- Activities that don't record traces
- Resolvers that don't live where data lives

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
