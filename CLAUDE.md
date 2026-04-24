# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Philosophy: MiniBob First, Canary Always

> **CRITICAL**: Use MiniBob for development tasks. Validate changes against the canary deployment at `activity.metabob.com`, not local clusters.

### Why MiniBob First

MiniBob is not just a tool we're building - it's how we build. Every development task should go through MiniBob when possible:

```bash
# Use MiniBob for development goals
minibob --single "fix the failing tests in metabob-activity-api"
minibob --single "add input validation to the impulse endpoint"
minibob --single "refactor the Thompson Sampling implementation"
```

**Benefits:**
- Execution traces feed the learning loop
- Successful patterns become reusable templates
- Thompson Sampling improves over time
- We dogfood our own system

### Why Canary First

**Do NOT develop against local Kubernetes clusters.** Instead:

1. **Write code locally** - Use your IDE, run tests with `bun test`
2. **Push to `dev` branch** - CI/CD automatically deploys to canary
3. **Validate against canary** - Test at `https://activity.metabob.com`
4. **Promote to production** - After canary validation succeeds

**Production Endpoints (use these, not .local):**
- `https://activity.metabob.com` - Activity API (learning backend)
- `https://identity.metabob.com` - Identity/auth service
- `https://discovery.metabob.com` - Discovery-vessel (capability registry) - if exposed

**MiniBob Config** (`~/.metabob/config.json`):
```json
{
  "metabob": {
    "apiKey": "your-api-key-here",
    "endpoint": "https://activity.metabob.com"
  },
  "providers": {
    "anthropic": { "apiKey": "sk-ant-..." }
  }
}
```

### The Development Loop

```
1. Describe goal → MiniBob executes activity
2. Activity succeeds/fails → Trace stored in canary backend
3. Push code changes → CI/CD deploys to canary
4. Validate via MiniBob → More traces, more learning
5. Repeat
```

---

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

### 1. Discovery-Vessel (`repos/discovery-vessel`)
Vessel capability registry and resolver (~1,500 LOC TypeScript/Bun):

**Key Files:**
- `src/index.ts`: HTTP server entry point
- `src/registry.ts`: In-memory vessel registry with TTL
- `src/types.ts`: Registration, heartbeat, and query types

**Capabilities:**
- Vessel registration with shape advertisement
- TTL-based expiration (5 min default, 60s cleanup)
- Heartbeat management (60-120s intervals)
- Capability queries (find vessels by shape)
- Self-registration (discovery is just another vessel)
- Circuit breaker and health scoring
- Routing trace recording

**Endpoints:**
- `POST /register` - Register vessel with shapes
- `POST /heartbeat` - Refresh TTL
- `DELETE /vessels/:id` - Graceful deregistration
- `POST /resolve` - Query vessels by capability
- `GET /health`, `/shapes`, `/registry/stats` - Observability

**Deployment:** Singleton (1 replica) with in-memory registry

### 2. MiniBob (`repos/minibob`)
Lightweight autonomous vessel (~3,000 LOC TypeScript/Bun):

**Key Files:**
- `index.ts`: Entry point, HTTP server, CLI
- `src/types.ts`: Core type definitions
- `src/llm.ts`: LLM client (Anthropic/OpenAI) with tool calling
- `src/tools.ts`: Built-in tools (bash, read, write, edit, git)
- `src/impulse.ts`: Impulse system for context management
- `src/activity.ts`: Activity template executor
- `src/goal-processor.ts`: Goal-seeking activity recommendations (12 resolvers extracted 2026-04-23; shrunk 7752 → 5982 LOC -22.8%)
- `src/mcp.ts`: MCP client for backend integration
- `src/vessel-discovery.ts`: Discovery-vessel integration (optional)

**Capabilities:**
- Execute activities with LLM
- Capture execution traces with state snapshots
- Create impulses from executions
- Resolve LOCAL impulse types (`memo`, `file`, `directoryTree`, `gitDiff`)
- Enhanced resolution: local → discovery → MCP backend (when discovery enabled)
- Self-development via ribosome pattern
- Optional vessel registration and discovery
- **Activity-driven goal processing** (2026-04-24): Default goal-processing now uses a meta-activity (goal_processing_activity_driven) that chains template-dispatchable resolvers for goal verification, enrichment, decomposition, and activity selection. User interacts with the DAG (divergence asks, fallback decision) via HumanResolver when on TTY. Non-interactive pipes skip UI. Backward-compatible: goal_processing_standard (LLM chain) remains loadable by ID.
- **Template-dispatchable resolvers** (2026-04-23): 14 registered resolvers (impulse analysis, context acquisition, LLM selectors, goal verification/enrichment/decomposition, activity recommendation, orchestration detection, keyword extraction, relevance scoring) callable from activity JSON via `"resolver": "<name>"` in task config. Goal-processor shrunk 7752→5833 LOC (−24.8%) by resolver extraction
- **Output-shape gating for variants** (2026-04-24): Goal enrichment now infers `expectedOutputShapes` from goal keywords (e.g., "write markdown" → `markdown_document`, "bash" → `bash_output`). Variant selection filters Thompson-Sampling recommendations by shape compatibility; if all candidates are incompatible, falls back to `execute-shell-command`. Prevents silent failures from routing "write file" goals to bash-only templates. Opt-in: empty `expectedOutputShapes` preserves existing selection behavior.

### 3. metabob-activity-api (`repos/metabob-activity-api`)
TypeScript/Bun/Hono backend - Learning system and trace storage:

**Key Files:**
- `src/index.ts`: Server entry point
- `src/routes/activities.ts`: Activity template endpoints
- `src/routes/impulses.ts`: Impulse resolution endpoints
- `src/services/discovery-client.ts`: Discovery-vessel integration
- `src/models/schemas.ts`: SurrealDB schemas

**Capabilities:**
- Store execution traces persistently
- Resolve activity-related impulse types (traces, templates, metrics)
- Thompson Sampling for template selection
- Pattern recognition and learning
- Impulse relevance tracking
- Tool usage analysis
- Register with discovery-vessel (advertises 7 activity-related shapes)

**Discovery Integration:**
- Registers on startup, heartbeats every 60s
- Non-blocking registration (graceful degradation)
- Health endpoint includes discovery status
- Legacy `/v2/vessels/*` endpoints deprecated (proxy mode until July 2026)

### 4. Activity Dashboard (`repos/activity-dashboard`)
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
- Vessel registry visualization (discovery integration)

### 5. Workbench (`repos/workbench`)
Human-in-the-loop development interface for activities, executions, and learning-loop state. React + Vite, Vitest + Playwright, shadcn/ui primitives. **Alpha (v0.1.0) landed 2026-04-22; composition-builder + trace-viz surfaces landed 2026-04-23.**

**Key Files:**
- `src/App.tsx`: Root shell
- `src/pages/`: `TemplatesPage`, `ExecutionsPage`, `GoalsPage`, `ShapesPage`, `CompositionPage`
- `src/hooks/`: React Query data hooks for templates/executions/goals/shapes; `useWebSocket.ts` for live execution streams
- `src/lib/`: API client, query setup, format utilities
- `src/components/ui/`: Base shadcn/ui primitives (do not modify in-place)
- `src/components/executions/`: `LiveExecutionMonitor`, `GanttTimeline`, `ExecutionFlameGraph`, `StateDiffViewer`

**Features:**
- Interactive activity template editing and variant management
- Execution inspection with real-time updates
- Goal and shape browsers
- **Composition builder** (`23e8b94`): node-based editor on React Flow — drag activities from a searchable palette, connect output→input ports with shape-compatibility validation, cycle detection, localStorage autosave, export to activity template, minimap + zoom. Real-time validation via POST `/v2/activities/validate-composition` (DFS-based cycle detection, shape compatibility checking, added `ec493b8d`)
- **Live execution monitor + Gantt timeline** (`3a1ca84`): WebSocket connection with reconnect and event-catchup protocol for missed events; Gantt bars with expand/collapse for nested tool calls and impulse-resolution markers by resolver tier
- **Flame graph** (`75b7a46`): D3-rendered hierarchical flame with cost and duration modes, resolver-tier color coding (deterministic / pattern / LLM), drill-down into tool calls, PNG/SVG export, time-aware mode
- **State diff viewer** (`1235867`): split/unified diff modes on task state transitions, file-list navigation with change counts, syntax highlighting (TS/JS/JSON), task-based grouping with expand/collapse, cumulative vs incremental toggle, auto-collapse of unchanged sections
- **Trajectory editor** (`f134aaf` → `035af79` → `b2edb1d2`): horizontal CSS-Grid layout for an activity sequence (ActivityCard with expand/collapse, zustand store, localStorage autosave, keyboard nav), drag-and-drop reordering via `@dnd-kit`, insert/remove/reorder activities, parallel execution via multi-row columns, shape-validation indicators, goal-to-trajectory with Thompson Sampling (POST `/v2/goal-paths/recommend` → `/v2/activities/discover-by-shapes` for shape-based activity discovery, confidence scores, endpoint prediction, "suggest next activity"), inline task editor (prompt editing with variable highlighting, validation rules, retry config, Thompson α/β + selection-strength sliders, save-as-variant with genealogy tracking)

**Distinct from activity-dashboard:** the dashboard is a read-only observability surface; the workbench is authoring + correction + live control (template editing, retries, manual trace curation, composition authoring, trace drill-down). Both talk to the same activity-api.

**Docs:** local `INDEX.md`, `OPENSPEC.md`, `docs/` in-repo (this super-repo tracks only the pointer).

### 6. Adjacent Vessels (brief)

Additional vessels tracked in this super-repo with less CLAUDE.md coverage — each owns its own `CLAUDE.md` / `README.md`:

- **concept-db** (`repos/concept-db`): resolves concept-graph shapes. As of `04157b1` (2026-04-23) registers with discovery-vessel and advertises five shapes — `concept`, `conceptGraph`, `relatedConcepts`, `conceptUsageStats`, `conceptSequence` — all routed through `POST /v2/impulses/resolve` by `pointer.type`. Legacy `VesselHeartbeat` targeting the deprecated activity-api `/v2/vessels/register` endpoint is no longer invoked from startup (removed in `faa7d8e`). As of `8399767`, an `ExecutionObserver` WebSocket client subscribes to activity-api's `/ws` broadcaster, listens for `task.completed` / `tool.call` events across all vessels (standardized in activity-api `ec493b8d`), and calls `recordUsage` locally when a concept-referencing `impulse_resolutions` entry appears — cross-vessel passive learning without explicit calls. Handshake: `{type:"authenticate", token:apiKey}` first, then optionally `{type:"catchup", lastSeenSequence:n}` on reconnect. Exponential backoff 1s→30s; all handlers swallow and log so the observer never throws into the WS loop or startup. **Deployment status:** Helm plumbing for the discovery client and observer landed in `deployment/6c8746e` (env-var surface + `METABOB_API_KEY` via `secretKeyRef` + `POD_NAME` via `fieldRef` for stable `VESSEL_ID` + `needs:` dependency on `activity-system/discovery-vessel`). **Pending before canary activation:** add a `conceptDb` block to `deployment/scripts/generate-secrets.sh`, sops-edit `canary.secrets.yaml` with `conceptDb.apiKey` (openssl rand -hex 32, prefix `mb_concept_canary_`), and register the key in identity-vessel seed.
- **conversation-vessel** (`repos/conversation-vessel`): new lightweight vessel (v0.1.0, 2026-04-23) for LLM conversations using Vercel `ai-sdk` (`@ai-sdk/anthropic`, `@ai-sdk/openai`, `ai`, `zod`). Builds up impulse system, AI provider, tools, context management, and resolver server. As of `002144b`, resolver server exposes four endpoints: `POST /resolve/impulse` (resolve impulses), `POST /resolve/tool` (execute tools), `POST /resolve/llm` (LLM resolution with tool calling), `GET /resolve/health` (health check). Adds multi-LLM conversation support via `callLLM` tool for relaying messages between LLMs.
- **identity-vessel** (`repos/identity-vessel`): API-key + JWT issuer used by every other vessel. See `docs/AUTH_JWT_CLAIMS.md`, `docs/API_KEY_VALIDATION_ENDPOINT.md`.
- **discovery-vessel** (`repos/discovery-vessel`): documented under §1 above.
- **Other vessels under `repos/`** (`metabob-analysis-api`, `metabob-rpc-api`, `metabob-mcp`, `metabob-opencode`, `metabob-cli`, `metabob-cloud-dashboard`, `metabob-internal-dashboard`, `minibob-tui`, `obsidian-vessel`, `user-vessel`, `terminal`, `react-renderer`, `cpg-inference` / `cpg-inference-ts`, `k8s-activity-executor`, `activity-monitor`, `platform`, `vessels`, `metabob-proto`): tracked in the super-repo (some as git submodules, some as direct file trees); consult each vessel's own docs.

### 7. Helm Deployment (`repos/deployment/`)
Kubernetes orchestration via Helmfile:

**Key Files:**
- `helmfile.yaml`: Main deployment configuration
- `charts/discovery-vessel/`: Discovery-vessel Helm chart
- `charts/*/`: Per-vessel Helm charts
- `environments/*.values.yaml`: Environment configurations
- `scripts/build_changed.sh`: Build and tag changed vessels
- `scripts/promote-canary-to-production.sh`: Production promotion

**Infrastructure:**
- Discovery-Vessel (vessel registry)
- SurrealDB 3.x (persistent storage)
- Valkey/Redis (cache)
- Istio (service mesh)

**Deployment Order:**
1. Infrastructure (SurrealDB, Valkey)
2. Discovery-Vessel
3. Application vessels (Activity-API, Analysis-API, MiniBob, etc.)

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
Universal data access mechanism - lazy-loaded pointers with metadata and resource budgets.

**Lifecycle:**
```typescript
// 1. CREATE: Define pointer (unloaded state)
{
  id: "errorFile",
  pointer: { type: "file", path: "src/tool/bash.ts", offset: 40, limit: 20 },
  budget: 2000,  // Resource budget (could be rows, bytes, time, tokens depending on resolver)
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
- `directoryTree`: Directory structure
- `gitDiff`: Git diff output

**Discovery-Vessel** (capability queries):
- `vesselCapability`: Find vessels by shape
- `vesselEndpoint`: Get vessel endpoint by ID
- `vesselHealth`: Get vessel health status
- `vesselRegistry`: Query full registry

**Activity-API** (learning backend):

Read resolvers (as advertised via discovery; see `repos/metabob-activity-api/src/config.ts`):
- `activityExecutionTrace`: Full execution trace with state
- `executionTraceWithSignatures`: Hydrated trace with per-impulse pointer/shape signatures; supports `since`, `limit`, `activity_template_id`, `success_only`, `min_duration_ms` filters; response carries `impulses_by_id` map and per-task `input_impulse_ids`/`output_impulse_ids` arrays. Enables deterministic impulse co-occurrence extraction without LLM reshaping (see minibob ImpulseCooccurrenceResolver).
- `activityTemplate`: Template structure and metadata
- `activityMetrics`: Performance data
- `executionTraceList`: Paginated list of executions for browse/inspect
- `variantMetricsSummary`: Thompson Sampling summary per variant
- `activityTemplateRecommendation`: Recommendation output of the recommend path
- `activityTemplatesByMetrics`: Templates filtered/ordered by performance
- `executionTraces`: Query-able slice of execution trace rows
- `goal`: Goal records (used by orchestrator / goal-seeking flows)
- `toolRiskProfile`: Per-tool risk signals extracted from traces
- `compositionSuccess`: Composition-edge success statistics (renamed from `activityCompositionGraph`)
- `impulseRelevance`: Impulse relevance scores (renamed from `impulseRelevanceMetrics`)
- `preValidationResult`: Pattern-based pre-validation verdicts for tool arguments
- `templateAuditReport`: Per-template deficiency reports — missing shapes, weak descriptions, all-LLM task graphs, hardcoded URLs, alias-cluster proposals. Descriptive (reads templates from both paradigm `activity` and legacy `activity_template` views); writes nothing. Feeds the upcoming audit-and-backfill activity that calls the `activityTemplate_update` write resolver.

Write/destructive resolvers (v1.5.0+, invoked via `POST /v2/impulses/resolve`):
- `*_write` — 14 learning-loop writes exposed as impulse shapes (e.g. `activityExecutionTrace_write`, `activityFeedback_write`, `impulseRelevance_write`). Each delegates to the equivalent REST endpoint so activities can invoke writes without hardcoding REST knowledge.
- `activityTemplate_update` / `activityTemplate_deprecate` — whitelisted mutations and soft-delete. Admin-only via SurrealDB PERMISSIONS; each emits an `upkeepAuditLog` impulse.
- `activityExecutionTrace_delete` — hard delete with audit log.

See [`docs/impulse-types/LEARNING_LOOP_WRITE_RESOLVERS.md`](docs/impulse-types/LEARNING_LOOP_WRITE_RESOLVERS.md) for the full list and contract.

Cost & metrics (separate family, resolved by activity-api):
- `executionCostSummary`: Aggregate cost metrics for executions (grouped by activity/vessel)
- `resolverCostAnalysis`: Cost breakdown by resolver tier and resolver ID
- `vesselPerformanceMetrics`: Performance and cost metrics for specific vessels
- `costByActivity`: Cost breakdown grouped by activity template
- `resolverPerformanceByShape`: Resolver performance metrics grouped by impulse shape
- `costTrendOverTime`: Time-series cost data for trend analysis

**Analysis-API** (code analysis):
- `problem_detection`: Code quality issues
- `error_log`: Error log analysis
- `source_code`: Source code content
- `code_quality`: Quality metrics

**Enhanced Resolution** (when discovery enabled):
1. Try local resolvers
2. Try custom registered resolvers
3. **Query discovery-vessel** for capable vessels
4. Direct HTTP call to discovered vessel
5. Fallback to MCP backend delegation

**Key Points:**
- Impulses are NOT instructions - they're **universal data access** with metadata
- Metadata-first reasoning: reasoners see shape/summary, resolvers load content
- Resource budgets manage data volume (DB rows, file bytes, API calls, LLM tokens)
- Resolvers live where data lives (vessels own their data)
- Discovery enables dynamic vessel routing without hardcoded endpoints
- Lazy loading for efficiency (load only what's needed, when it's needed)

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
- ✅ Resolve activity-related impulse types (traces, templates, metrics)
- ✅ Thompson sampling
- ✅ Pattern recognition
- ✅ Metrics aggregation
- ❌ NOT: Universal resolver for arbitrary data
- ❌ NOT: Resolve impulses owned by other vessels

### Execution Trace Model

Execution traces capture complete information about activity execution for learning.

**New Fields (April 2026):**

```typescript
execution {
  // ... existing fields ...

  // NEW: Vessel tracking
  resolved_by_vessel_id: string  // Which vessel resolved impulses

  // NEW: Per-impulse resolution details
  impulse_resolutions: [{
    impulse_id: string           // Impulse that was resolved
    resolver_id: string          // Resolver used (bash, git, llm, etc.)
    resolver_tier: string        // deterministic, pattern, llm
    vessel_id: string            // Vessel that executed resolver
    latency_ms: number           // Resolution duration
    cost_usd: number            // Resolution cost
  }]

  // NEW: Composition tracking (minibob → activity-api v1.5.5, April 2026)
  parent_execution_id: string    // Direct parent in the composition tree (nested invocations)
  composition_chain: string[]    // Denormalized ancestor chain, ordered root-first

  // NEW: Per-task impulse grouping (minibob 3d537c8 → activity-api 2a7984e, April 2026)
  tasks: [{
    // ... existing task fields ...
    input_impulse_ids: string[]    // Impulses that fed this specific task
    output_impulse_ids: string[]   // Impulses produced by this specific task
  }]
}
```

**Purpose:**
- **Per-task impulse grouping**: Track which impulses were consumed and produced by each task for co-occurrence analysis
- **Deterministic co-occurrence extraction**: ImpulseCooccurrenceResolver can extract task-scoped signal without LLM reshaping (via executionTraceWithSignatures)
- **Learn which resolvers work best** for which impulses
- **Track vessel-level performance** and resolver selection success rates
- **Identify optimization opportunities** through resolver tier analysis

**Backward Compatibility:**
- Existing traces without these fields still valid
- Fields optional (not breaking change)
- Queries handle null values gracefully

**Resolver Tiers:**
- `deterministic`: No LLM, fast, zero cost (bash, git, file)
- `pattern`: Pattern matching from history (PreValidationResolver)
- `llm`: LLM reasoning required (LLMResolver with tool calling)

**Learning Applications:**
1. **Resolver Selection**: Track success rate per resolver per shape
2. **Impulse Co-Occurrence**: Determine which impulses are semantically related (e.g., "file contents" + "git diff" frequently co-occur)
3. **Vessel Performance**: Measure latency per vessel, detect degradation
4. **Cost Optimization**: Identify expensive patterns, prefer deterministic resolvers
5. **Task-Level Signal**: Extract per-task semantics for activity variant optimization (which impulse combinations work best for specific tasks)

**See also**: [`docs/architecture/RESOLVER_TRACKING.md`](docs/architecture/RESOLVER_TRACKING.md)

## Development Workflows

### Primary Workflow: MiniBob + Canary CI/CD

**This is how we develop.** Don't set up local Kubernetes - use the canary deployment.

```bash
# 1. Use MiniBob for development tasks
minibob --single "implement the new feature"
minibob --single "fix the bug in impulse resolution"

# 2. Run tests locally before pushing
cd repos/metabob-activity-api
bun test
bun run typecheck

# 3. Push to dev branch - CI/CD deploys to canary automatically
git add . && git commit -m "feat(activity-api): add new feature"
git push origin dev

# 4. Validate against canary
curl https://activity.metabob.com/health
minibob --single "verify the new feature works"

# 5. Monitor CI/CD
gh run list --limit 5
gh run view <run-id> --log
```

### Local Testing (Tests Only, Not Full Deployment)

```bash
# MiniBob
cd repos/minibob
bun test               # Run tests
bun run typecheck      # Type checking

# metabob-activity-api
cd repos/metabob-activity-api
bun test               # Run tests
bun run typecheck      # Type checking

# Activity Dashboard
cd repos/activity-dashboard
bun test               # Run tests
```

### CI/CD Pipeline (Canary First)

> **Canonical Documentation**: See [`repos/deployment/DEPLOYMENT_WORKFLOW.md`](repos/deployment/DEPLOYMENT_WORKFLOW.md)

**The Flow:**
```
Write Code → bun test → Push to dev → Canary (auto) → Validate → Production
   (local)    (local)    (triggers)    (activity.metabob.com)   (promote)
```

**CI/CD Commands:**
```bash
# Push triggers canary deployment automatically
git push origin dev

# Monitor deployment
gh run list --repo MetabobProject/deployment --limit 5
gh run view <run-id> --log

# Production promotion (after canary validation)
./scripts/promote-canary-to-production.sh
```

### Local Kubernetes (Advanced - Usually Not Needed)

> **Note**: Prefer using the canary deployment at `activity.metabob.com` instead of local Kubernetes. Only set up local clusters for infrastructure changes or offline development.

**Prerequisites (if you really need local):**
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
   export SURREALDB_PASSWORD="surrealdb-local-dev-123"
   ```

**Deployment Repository Structure:**

```
repos/deployment/
├── .github/workflows/
│   ├── deploy-canary.yml           # Auto-deploy on push to dev (runs tests + lint)
│   └── promote-to-production.yml   # Daily/manual production promotion (health gates)
├── environments/
│   ├── local.values.yaml           # Local dev cluster config
│   ├── production.canary.values.yaml  # Canary image tags
│   └── production.values.yaml      # Production image tags
├── scripts/
│   ├── build_changed.sh            # Build script (--dev or --canary)
│   ├── promote-canary-to-production.sh  # Manual promotion with health checks
│   └── health-check.sh             # Environment health validation
├── vessels/                         # Vessel source code (synced from main workspace)
├── helmfile.yaml                    # Main helmfile with environments
└── DEPLOYMENT_WORKFLOW.md          # Complete deployment documentation
```

**Verify Deployment:**

```bash
# Check all pods are running
kubectl get pods -n activity-system

# Check API health
curl http://activity.metabob.local/health

# Verify API key authentication (MiniBob Phase 2)
curl http://activity.metabob.local/v2/activities/templates \
  -H "Authorization: ApiKey <your-api-key>"
```

**Rollback:**

```bash
# Helm rollback
helm rollback metabob-activity-api -n activity-system

# Or use rollback script
./scripts/rollback-production.sh <previous-tag>
```
3. Verifies health endpoints
4. Runs integration tests

**Helmfile Configuration:**

The main deployment file is `helm/activity-system-minimal.yaml.gotmpl` which uses:
- Template syntax for environment variable interpolation
- Dependency ordering (needs: clause)
- Health checks and resource limits
- Istio injection enabled on namespace

### Service Endpoints

**Production/Canary (USE THESE):**
- **Activity API**: `https://activity.metabob.com`
- **Identity API**: `https://identity.metabob.com`

**Local Development (if using local K8s):**
- **Backend API:** `http://activity.metabob.local` (external) / `http://metabob-activity-api.activity-system.svc.cluster.local:8080` (internal)
- `GET /health`: Health check
- `POST /v2/activities/recommend`: Thompson Sampling recommendations with optional `expected_output_shapes` filter for shape-compatible variants
- `GET /v2/activities/templates`: List templates
- `POST /v2/goal-paths/recommend`: Goal-to-trajectory generation with Thompson Sampling
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

### Development Network Mapping (Local K8s Only)

> **Note**: This section is for local Kubernetes development only. For normal development, use `https://activity.metabob.com`.

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

## Authentication

### API Key Authentication (Current)

All MiniBob instances and clients authenticate using standard API keys managed by the identity service.

**Authentication Flow:**
```
1. Client sends: Authorization: ApiKey <key>
2. Activity-API validates via identity service (primary)
3. If identity service unavailable, fallback to direct SurrealDB validation
4. Identity service returns: org_id, user_id, key_id, scopes
5. Activity-API uses key_id for audit trails
```

**Request Example:**
```bash
curl -X GET https://activity.metabob.com/v2/activities/templates \
  -H "Authorization: ApiKey <your-api-key>"
```

**Response:**
```json
{
  "templates": [...]
}
```

**Key Points:**
- **No instance_id required** - API key is sufficient
- **Identity service manages keys** - Centralized key lifecycle
- **Automatic fallback** - Direct SurrealDB validation when identity service unavailable
- **Audit trails use key_id** - All operations tracked by API key ID

### Deprecated: MiniBob Instance Authentication

**Prior to 2026-04-08**, MiniBob instances authenticated using:
- `instance_id` + `api_key` via `POST /v2/auth/minibob/signin`
- `minibob_record` SurrealDB ACCESS method
- `minibob_instance` table

**Migration 052** deprecated this approach:
- Removed `minibob_record` ACCESS method
- Made `minibob_instance` table read-only
- All new authentication uses API keys only

**Rollback:** If needed, uncomment the ACCESS method in `sql/000-auth-schema.surql`

### Multi-Tenant Isolation

Authentication automatically enforces multi-tenant isolation via SurrealDB PERMISSIONS:

**Core Pattern:**
- All multi-tenant tables enforce org scoping at the database level
- No application-level filtering needed — isolation is automatic
- Migrations 079, 080, 083 (2026-04) fixed org-scoping to use `$token.org_id` for API-key auth (where `$auth` is unavailable)
- Migrations 084, 085 (2026-04-24) fixed project-scoped access for dashboard users with empty `project_ids` claims (allow-all-traces pattern)

**Usage Pattern:**
```typescript
// Use authenticated connection - PERMISSIONS enforced automatically
const db = await createAuthenticatedClient(jwtToken);
const templates = await db.query(`SELECT * FROM activity_template`);
// Returns only templates for authenticated caller's org
```

**Important:** For PERMISSIONS clauses, use `$token.org_id` (works for both dashboard and API-key auth) rather than `$auth.org_id` (only works for dashboard). See [`docs/RBAC_GUIDE.md`](docs/RBAC_GUIDE.md) §`$auth` vs `$token` for details.

**Project-Scoped Access Pattern (Migrations 084, 085):**
Tables using project-scoping must handle three cases: user has specific projects, user has no restriction (empty/null `project_ids`), or record has no project restriction. Pattern:
```
WHERE org_id = $auth.org_id
AND (
  project_id IS NONE                    // Record has no project restriction
  OR project_id IN $auth.project_ids   // User has access to this project
  OR $auth.project_ids IS NONE         // User has no project restriction
  OR array::len($auth.project_ids) = 0 // Same as above (defensive)
)
```
Applies to: `activity_execution_traces` (084), `goal_execution_paths` (085), and other multi-project tables.

**Authentication Methods:**
| Method | Use Case | Token Lifetime | Scopes |
|--------|----------|----------------|--------|
| **API Key** | MiniBob, IDE integrations | Auto-refresh | read, write |
| **JWT External** | Dashboard users | 15 minutes | Varies by role |

## Configuration

### MiniBob Configuration Priority

MiniBob resolves configuration from multiple sources (highest to lowest priority):

1. **Environment variables** (e.g., `ANTHROPIC_API_KEY`, `METABOB_API_KEY`)
2. **Project config** (`.metabob/config.json` in project root)
3. **User config** (`~/.metabob/config.json`)
4. **Defaults** (hardcoded in MiniBob)

**Recommended user config** (`~/.metabob/config.json`):
```json
{
  "metabob": {
    "apiKey": "your-metabob-api-key",
    "endpoint": "https://activity.metabob.com"
  },
  "providers": {
    "anthropic": { "apiKey": "sk-ant-..." }
  },
  "defaults": {
    "provider": "anthropic",
    "model": "claude-sonnet-4-20250514"
  }
}
```

> **Important**: Always use production endpoints (`https://activity.metabob.com`), not `.local` endpoints.

### Secrets Management (SOPS + Age)

Secrets are managed via SOPS encryption with Age keys:

```
repos/deployment/secrets/
├── local.secrets.yaml           # ENCRYPTED - local dev
├── canary.secrets.yaml          # ENCRYPTED - canary
└── production.secrets.yaml      # ENCRYPTED - production
```

**Setup:**
```bash
# Generate Age key (one-time)
age-keygen -o ~/.config/sops/age/keys.txt

# Generate secrets for environment
./scripts/generate-secrets.sh local

# Encrypt secrets
sops -e -i secrets/local.secrets.yaml

# Deploy (auto-decrypts)
./scripts/deploy-local.sh
```

### Environment Variables

**MiniBob:**
```bash
ANTHROPIC_API_KEY           # Required: Anthropic API key for LLM
METABOB_API_KEY             # Required: Metabob backend API key
METABOB_ENDPOINT            # Backend API (default: https://activity.metabob.com)
MINIBOB_PROVIDER            # LLM provider: anthropic | openai
MINIBOB_MODEL               # Model to use (default: claude-sonnet-4-20250514)
MINIBOB_WORKDIR             # Working directory
```

**metabob-activity-api:**
```bash
SURREALDB_URL               # Full SurrealDB URL with protocol
SURREALDB_NAMESPACE         # Namespace (activity-system)
SURREALDB_DATABASE          # Database (learning_loop)
SURREALDB_USERNAME          # Auth username
SURREALDB_PASSWORD          # Auth password
REDIS_URL                   # Redis connection string
```

**Activity Dashboard:**
```bash
PORT                        # Server port (default: 3000)
ACTIVITY_API_URL            # Backend API URL
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

**Discovery System:**
- [`DISCOVERY_INTEGRATION.md`](DISCOVERY_INTEGRATION.md): Complete vessel discovery integration guide
- [`packages/vessel-discovery-client/README.md`](packages/vessel-discovery-client/README.md): VesselClient package documentation

**Vessel construction:**
- [`docs/architecture/TYPESCRIPT_VESSEL_TEMPLATE.md`](docs/architecture/TYPESCRIPT_VESSEL_TEMPLATE.md): Current canonical template for building a TypeScript vessel — file layout, the three invariants, discovery-client + observer + auth patterns, Helm wiring, and what NOT to do (2026-04-24). Supersedes `VESSEL_QUICK_START.md` and `VESSEL_WIRING_PRACTICAL.md` for new work.
- [`docs/architecture/VESSEL_CONSTRUCTION_PATTERNS.md`](docs/architecture/VESSEL_CONSTRUCTION_PATTERNS.md): Cross-vessel pattern analysis (2026-04-08). Idioms remain current; registration path is superseded by the template above.

**Complementary architecture docs:**
- [`repos/deployment/DEPLOYMENT_WORKFLOW.md`](repos/deployment/DEPLOYMENT_WORKFLOW.md): Kubernetes deployment procedures
- [`docs/archive/2026-04-11-jiggle-and-prune/ACTIVITY_BASED_IMPROVISATION.md`](docs/archive/2026-04-11-jiggle-and-prune/ACTIVITY_BASED_IMPROVISATION.md): VM-as-executor philosophy (archived)

**Multi-tenant & RBAC:**
- `docs/MULTI_TENANT_ARCHITECTURE.md`: Tenancy model and authentication
- `docs/RBAC_GUIDE.md`: PERMISSIONS patterns and best practices
- `docs/AUTH_JWT_CLAIMS.md`: JWT token structure
- `docs/SCHEMA_OWNERSHIP.md`: Service-to-table ownership

**Template Patterns & Learning:**
- [`docs/guides/TEMPLATE_DISPATCHABLE_RESOLVERS.md`](docs/guides/TEMPLATE_DISPATCHABLE_RESOLVERS.md): Resolver dispatch pattern (resolvers callable from activity JSON)
- [`docs/guides/CONCEPT_INTEGRATION_TEMPLATES.md`](docs/guides/CONCEPT_INTEGRATION_TEMPLATES.md): Concept-consuming templates (prime-context, extract-concepts, link-composition)
- [`docs/guides/TEMPLATE_UPKEEP.md`](docs/guides/TEMPLATE_UPKEEP.md): Template audit and backfill pipeline

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

### Use MiniBob for Everything

```bash
# Feature development
minibob --single "add Thompson Sampling decay to old templates"

# Bug fixes
minibob --single "fix the schema mismatch error in execution traces"

# Refactoring
minibob --single "extract the impulse resolution logic into a separate module"

# Documentation
minibob --single "update the API documentation for the new endpoints"
```

### Track Progress via Dashboard

- **Canary Dashboard**: https://internal.metabob.com (when deployed)
- **Activity API Health**: https://activity.metabob.com/health
- **Execution Traces**: Stored automatically by MiniBob

### Two Parallel Tracks

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
