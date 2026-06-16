# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Philosophy: MiniBob First, Substrate-Aware

> **CRITICAL**: Use MiniBob for development tasks. Validate changes against the active substrate endpoint configured in `~/.metabob/config.json`.

> **Hook-enforced (2026-06-16).** Direct `Write`/`Edit`/`MultiEdit` on vessel source under `repos/<vessel>/src/**` is gated by the `substrate-vessel-edit-gate` PreToolUse hook. The default path for code changes is to **dispatch through the substrate** — `minibob --single "<goal>"` (delegates to `goal-host-vessel` on `:8210`) — so the work produces a trace and feeds the learning loop, rather than an untraced manual edit. The gate **fails open** when the substrate is unreachable (you can't route through a dead substrate). Conscious one-off direct edits set `SUBSTRATE_ALLOW_DIRECT_EDIT=1` in the environment to bypass. Edits to `docs/`, `scripts/`, `openspec/`, `.claude/`, tests, and config are never gated — only vessel runtime source.

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

### Substrate-Aware Development

The system is designed to operate identically on any substrate. A **substrate** is one full deployment of the vessel fleet (discovery-vessel + activity-api + identity-vessel + minibob + supporting infrastructure). Substrate examples: local Kubernetes cluster, canary cloud deployment, production cloud deployment. Each substrate:

- Has its own discovery-vessel as a fixed point (all vessel-to-vessel routing is dynamic via it)
- Builds its own Thompson learning state from its own execution traces (by design — "resolvers live where data lives")
- Uses the same Helmfile charts, just with a different `environments/*.values.yaml` overlay

**Configure your substrate in `~/.metabob/config.json`:**
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

Replace `endpoint` with your substrate's activity-api URL. All validation harnesses and tooling read this config; none hardcode a substrate URL.

**Known substrate endpoints:**
- `http://localhost:18080` — **local single-container substrate** (Phase 26, complete 2026-05-23). Primary development target. All inter-vessel calls are localhost; no Kubernetes required. Bootstrap: `make -C scripts/substrate substrate-run` → `docker exec substrate-live bun /vessels/seed-identity.ts` → `scripts/substrate/configure-local.sh`. See `docs/SUBSTRATE.md`.
- `https://activity.metabob.com` — canary / pre-prod (current `kubectx metabob-production`). Used for canary validation and production promotion.
- Local cluster — configure via `helmfile --environment local sync` + set endpoint to your in-cluster address (legacy; superseded by single-container substrate)

**Helmfile environments** (in `repos/deployment/`):
- `environments/local.values.yaml` — local cluster overrides
- `environments/canary.overrides.yaml` — canary-specific image tags and replicas
- `environments/production.values.yaml` — production image tags

**SOPS secrets** (one set per substrate):
- `secrets/local.secrets.yaml`, `secrets/canary.secrets.yaml`, `secrets/production.secrets.yaml`

### The Development Loop

**Local substrate (Phase 26+, primary):**
```
0. First time: make -C scripts/substrate substrate-run
              docker exec substrate-live bun /vessels/seed-identity.ts
              scripts/substrate/configure-local.sh
1. Edit vessel source in repos/<vessel>/
2. make -C scripts/substrate substrate-restart-<vessel>   ← hot-reloads vessel in container
3. bun run validation/scripts/failure-mode-harness.ts    ← validates against localhost:18080
   minibob --single "<goal>"                             ← verify trace lands
4. Commit + push to dev → CI/CD deploys to canary for integration validation
5. Promote canary → production via /deploy skill
```

**Canary-first (pre-Phase 26, or when validating against live data):**
```
1. Describe goal → MiniBob executes activity (on configured substrate)
2. Activity succeeds/fails → Trace stored in substrate backend
3. Push code changes → CI/CD deploys to canary
4. Validate via MiniBob → More traces, more learning
5. Repeat
```

After Phase 27 (lift), step 1 of the local loop is substrate-initiated: the topology-discovery activities measure, probe, and escalate without human input. Human developers intervene only when the substrate flags a gap it cannot resolve.

**After lift (S2 — substrate-authored, supervised):**
The IAL terminal condition (§27.S.4) marks the S1 → S2 transition: the substrate has lifted from operator-authored to substrate-authored development. The operator role transforms — no longer the feature author, but anchor maintainer (rotating anchors when justified, reviewing H5 baselines) and adversarial tester (introducing probes, hostile peers, untrusted external sources). New specs are authored by the substrate's own propose-spec / verify-merge-candidate pipeline; see IAL §27.S.5 for the post-lift agenda (security, authenticity, cooperation, federation, self-recovery).

**Toward S3 (distributed-stable, adversarial-resistant):**
S3 has no acceptance gate. It is emergent and operator-measured by **active push-away** — substrate gates refusing operator interventions with cited evidence (`interventionRefused` impulses), not by passive intervention-absence. Measured over a sustained window of adversarial exposure; see IAL §27.S.6. When every reasonable intervention is either refused with sound rationale or absorbed without harm, the operator's role has become structurally non-load-bearing.

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

## Current Implementation Status & Known Issues

**Deployed versions** (canary, source of truth = each repo's `package.json`):
- `metabob-activity-api` 1.20.9 — chain-credit F-V56/F-V57 fixed, F-V58 ONNX path fix (dense search now active), migration tracking, stratified posteriors
- `minibob` 0.14.11 — embedded meta-activities (slot-binding, validator-dispatch, shape-provider-goal), iteration resolver, make-activity, goal-impulse seeding, enrichment-gated verification; `GOAL_RUNTIME=ias-executor` gate wires `GoalHost` (ias-executor-ts) as the canonical execution path via `goal-host-bridge.ts` — default ActivityExecutor path unchanged
- `workbench` 0.3.1 — trajectory editor, live execution overlay, weight-influence feedback, stagnation detection, oracle corpus wiring
- `identity-vessel` 0.2.8 — HMAC API keys + JWT issuance (canonical auth resolver)
- `discovery-vessel` 0.4.0 — vessel registry with resolver contracts and per-mutation auth
- `development-vessel` (local only, not in Helm) — meta-vessel for substrate self-development. 19 shapes, 7 seed templates (including `harness-check-scenario`, `draft-gap-closing-activity`), noop resolver, failure-mode harness. Runs as a systemd unit inside the single-container substrate (Phase 26). See `repos/development-vessel/`.

**Recent stabilisation** (most-recent first):

*Phase 18 — Learning loop measurement + dense search (2026-05-13)*
- **Dense semantic search active**: `all-MiniLM-L6-v2` ONNX model (INT8, 22MB) bundled in the activity-api image at `src/assets/models/`. `POST /v2/activities/recommend` returns `fallback_tier: "fts_hybrid"` confirming `queryActivitiesByDense` + `mergeByRRF` are active. O(n) cosine-similarity scan (not HNSW — indexes were dropped in migration 110 due to pod CPU spikes; HNSW is gated on infra stabilization). **F-V58 fix (2026-05-18)**: `EMBEDDING_MODEL_DIR` env was missing from Dockerfile runtime stage, causing `embedding.status=disabled` on all pods since Phase 18.5; fixed in `1.20.9-66fb99c`.
- **G5 embedding backfill complete**: 1640/3135 templates updated from 1536-dim OpenAI → 384-dim MiniLM vectors via `scripts/backfill-embeddings.ts`. 1495 double-prefix records (`activity:⟨activity:⟨…⟩⟩`) skipped (unreachable via `type::record()`; excluded from dense scan by `length === 384` guard). Post-backfill MRR: 0.1542 (FTS-only; dense was disabled). Post-F-V58-fix MRR: **0.2361** (+0.0819), `improvise_health.success_rate=1.0` (3/3). Report: `validation/results/2026-05-18-reuse-report.json`. Prior FTS-only report: `validation/results/2026-05-13-post-g5-backfill-reuse-report.json`.
- **Migration 128**: added `times_failed` field to `impulse_relevance_metrics` (SCHEMAFULL table was silently dropping `writeImpulseRelevancePenalty` UPDATEs). Verified via 18.3.5 integration test: two `verifier_negative` traces → `times_failed` increments by 2.
- **Migration tracking** (`init_migrations` table): `scripts/init-database.ts` now records each applied migration filename and skips already-applied ones on future pod restarts. `REBUILD INDEX` migrations (111, 126, 127) blocked SurrealDB's HTTP `/sql` endpoint for 27+ minutes on large corpora — re-running them on every pod restart caused helm `--atomic` rollback timeouts. Bootstrap: if `init_migrations` is empty on first run but `activity_execution_traces` has rows, all current migrations are pre-marked applied. Activity-api 1.20.1-c2d0d96.
- **Failure-mode stratified Thompson updates**: verifier_negative → full β penalty; budget_exhausted → half penalty; safety_breach → full β; cascading → no double-count; user_abort → neutral. `writeImpulseRelevancePenalty` fires on verifier_negative to increment per-impulse failure counters.
- **Composition-chain credit propagation**: `propagateCreditAlongChain` writes α/β deltas to ancestors in the composition chain when a composed execution succeeds/fails (spec 18.4). Two bugs blocked end-to-end: **F-V56** — `variant_performance_metrics` INSERT was silently denied via `queryWithAuth` because `FOR create WHERE $auth != NONE` (migration 099) is always false for TYPE JWT access (JWT claims go to `$token`, not `$auth`); fixed by switching to root path `surrealDB.query()` for that table + migration 129 rewrites PERMISSIONS to `$token`; **F-V57** — the AET exec→variant lookup did `rows?.[0]` but `surrealDB.query()` (see `src/db/surreal.ts`) already extracts `result[0]` before returning, so `rows` is the array of rows — doing `rows[0]` grabbed the first row object and threw `{} is not iterable`; fixed by `Array.isArray(rows) ? rows : []`. Integration test 18.4.7 PASS on 1.20.9-dd83aa5 (Δα=0.30, raw 0.25).
- **Baselines**: pre-Phase-18 MRR=0.1042; post-G5-backfill (FTS-only) MRR=0.1542; post-F-V58-fix (dense active) MRR=0.2361. Weekly re-run 2 needed ~2026-05-25 for time-gated criterion.

*Reliability and auth*
- Activity-API auth middleware now finalises Hono context correctly on 401 and stops rejecting `X-Internal-Api-Key` before route handlers can opt-in. This unblocked the minibob pending-sync queue.
- Activity-API accepts the legacy `activity_id` field on `POST /v2/activities/impulse-relevance` and coerces to `activity_variant_id` for backward compatibility (logged as a deprecation warning).
- MiniBob synthesises a degraded `authenticated: false` impulse when activity-api returns intermittent 401 on `/v2/impulses/resolve`, so resolver failures are non-fatal. The intermittent-401 root cause (likely identity-vessel rate-limit on `/v1/auth/resolve`) is still under investigation.
- MiniBob improviser hardened against null pointer types.

*Registry hygiene*
- Six-pack of registry-quality activities landed in minibob's embedded templates (`core-activity-audit`, `prune-activity`, `replace-activity`, plus lifecycle wrappers for the same). `prune-activity` defaults to `dryRun=true`; `dispatch_write_succeeded` no-ops on 403 so the pipeline runs without admin scope.
- Ribosome (template extraction) reorganised as a lifecycle meta-activity that listens on `lifecycle:execution:succeeded` and writes via the standard resolver path.
- Speculative-template-pollution paths (improviser, fallback-template shim, hardcoded shape defaults, bypass-on-error) no longer write into the registry.
- `activity_template` UPSERT sanitises ids before write, preventing new doubled-prefix wrap rows. (≈800 pre-existing wrapped rows still require operator-run DELETE with root creds.)
- Shape provenance (`produced_by`, `produced_at_task_id`) is wired through emission paths to give co-occurrence learning full ground truth.

*Schema and storage*
- Migration 093 + 094 introduce `DEFINE FIELD OVERWRITE` for `impulse_resolutions.*`, letting resolvers persist arbitrary metadata without pre-declaring every field.
- Migration 101 adds `goal_verification_labels` for the oracle corpus (human verdicts + high-confidence automated labels).
- Unlisted-template resolver fixed to never leak private templates into discovery results.

*Execution-tree visibility*
- `executionTraceList` GET handler walks `composition_chain` at read time when storage is empty (per-request memoised), so legacy traces get a usable chain without a write-back migration.
- The execution tree spans both `activity_execution_traces` and `execution` tables; the GET handler currently returns the first non-empty result set, leaving a silent union gap. Workbench compensates with a one-level recursive walk; server-side union is still pending.

**Operator-blocked items** (require user action; full diagnostics in [`openspec/changes/2026-04-26-impulse-activity-loop/design.md`](openspec/changes/2026-04-26-impulse-activity-loop/design.md)):
- **Admin scope** for global template writes (`activityTemplate_update` / `_deprecate`). Current canary keys are `read,write`. Two seeding paths failed: (a) init-data Helm SurrealQL passes `org_id = organizations:metabob` (record ref) into a `TYPE string` field and silently no-ops via `IF !$existing_key`; (b) `validateKeyFormat()` in identity-vessel returns no `scopes`, and `resolveAPIKey()` hardcodes `['read','write']`, so no API-key path yields `admin`. **Recommended workaround:** Bearer JWT admin auth via dashboard login (the JWT carries `role: admin`).
- **Wrapped template ids**: ≈800 pre-existing rows with doubled-prefix or descriptive-name wrapping (`activity:⟨activity:⟨…⟩⟩`). Forward-fix prevents new occurrences; existing rows need an operator-run DELETE.
- **Canary key format drift**: existing `mb_inst_canary_*` and `self-canary` keys use underscore-separated form with no HMAC suffix, yet authenticate against activity-api despite identity-vessel's validator requiring `mb-{b64}-{hmac32}`. Three hypotheses (deploy drift / bypass path / unenforced auth); investigate before relying on key-format constraints for security.

**Detailed diagnostics:** see [`docs/archive/2026-05-27/IMPLEMENTATION_FINDINGS_2026_04.md`](docs/archive/2026-05-27/IMPLEMENTATION_FINDINGS_2026_04.md) and the per-change `design.md` files under `openspec/changes/`. CLAUDE.md describes behaviour, not ticket IDs — when you need root-cause history, follow the links.

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
- Vessel registration with shape advertisement and resolver contract
- TTL-based expiration (5 min default, 60s cleanup)
- Heartbeat management (60-120s intervals)
- Capability queries (find vessels by shape)
- Self-registration (discovery is just another vessel)
- Circuit breaker and health scoring
- Routing trace recording
- **Resolver contract fields** (Wave 1A, 2026-04-24): vessels advertise `resolve_endpoint`, `resolve_request_format`, `auth_scheme`, `resolve_timeout_ms` for automated dispatch
- **Authentication on mutations** (v0.3.0, 2026-04-25): registration, heartbeat, and deregistration require API key authentication
- **Tenant isolation** (v0.3.0, 2026-04-25): registry queries scoped to caller's org_id
- **Auth token source declaration** (v0.4.0, 2026-04-25): vessels declare `auth_token_source` (e.g., `caller_identity`, `user_identity`) and `auth_delegation_mode` (e.g., `forward`) to specify which credential to use for resolution

**Endpoints:**
- `POST /register` - Register vessel with shapes and resolver contract (requires API key)
- `POST /heartbeat` - Refresh TTL (requires API key)
- `DELETE /vessels/:id` - Graceful deregistration (requires API key)
- `POST /resolve` - Query vessels by capability
- `GET /health`, `/shapes`, `/registry/stats` - Observability

**Deployment:** Singleton (1 replica) with in-memory registry

### 2. MiniBob (`repos/minibob`)
**Planned for deprecation.** Thin CLI wrapper (298 LOC in `index.ts`) that delegates all goal execution to `goal-host-vessel` (port 8210) over HTTP. No in-process execution engine; the substrate-hosted vessels (§6) handle all execution, LLM calls, template selection, and ribosome extraction.

**Key Files:**
- `index.ts`: entry point — `--single`, `--daemon`, `--idle`, REPL mode
- `src/cli/processor.ts`: `processGoal()` — HTTP dispatch to `GOAL_HOST_VESSEL_ENDPOINT` + REPL slash-command handlers (`/auth`, `/config`, `/status`)
- `src/repl.ts`: readline REPL loop with slash commands; `handleStatus` probes goal-host-vessel `/health`
- `src/config.ts`: config loading (user + project config, API key resolution)
- `src/logger.ts`, `src/version.ts`: logging and version cache

**Goal dispatch:**
`processGoal(message)` POSTs `{ goal, variables }` to `GOAL_HOST_VESSEL_ENDPOINT/run-goal` (default `http://127.0.0.1:8210`) with `Authorization: ApiKey <METABOB_API_KEY>`. Returns `{ executionId, status, selectedTemplateId }`. Exit code 0 on `status=success|completed`, 1 otherwise.

**What moved to substrate vessels (Phase 8, 2026-05-24):**
- `ActivityExecutor`, goal-processor, all resolvers → `goal-host-vessel` (§6)
- LLM calls → `llm-resolver-vessel` (§6)
- Boredom / autonomous loop → `boredom-vessel` (§6)
- Template extraction (ribosome) → `ribosome-vessel` (§6)
- File/process tools → `local-tools-vessel` (§6)
- Bootstrap template seeding → `bootstrap-seeder.service` (§6)

**Deprecation path:** once boredom-vessel, goal-host-vessel, and ribosome-vessel cover the full execution surface, minibob's binary is retired. No rename (`repos/minibob` stays as-is until deletion).

### 3. metabob-activity-api (`repos/metabob-activity-api`)
TypeScript / Bun / Hono backend. Trace store + Thompson-Sampling learner + activity-related impulse resolver. **Not a universal resolver** — only resolves shapes it owns (traces, templates, metrics, goal paths, composition stats); everything else routes through discovery.

**Key Files:**
- `src/index.ts`: server entry point + middleware
- `src/routes/activities.ts`: template endpoints, recommend, discover-by-shapes, validate-composition
- `src/routes/impulses.ts`: `/v2/impulses/resolve` dispatcher + write resolvers
- `src/routes/goal-paths.ts`: goal-to-trajectory recommendation, endpoint-shape persistence
- `src/services/discovery-client.ts`: discovery-vessel integration
- `src/services/auth.ts`: identity-vessel-backed validator
- `src/models/schemas.ts`: SurrealDB schemas (incl. `FailureModeSchema`)
- `sql/migrations/`: ordered migration files

**Capabilities:**

*Storage and learning*
- Persistent execution traces with per-task `input_impulse_ids` / `output_impulse_ids`, resolver tier per task, vessel id, parent execution id, denormalised composition chain, and `failure_mode` taxonomy.
- Thompson Sampling for template selection across variant families. β-on-failure updates both the directly-executed variant and any dispatched template recorded in meta-trace metadata, so failure attribution does not drift from success attribution.
- Per-template, per-variant, and per-resolver metrics (success rate, cost, duration, latency). Impulse-relevance and tool-usage feedback loops feed Thompson posteriors.
- BM25 full-text search over templates, traces, and metrics (`/v2/activities/search`); same engine drives Tier-3 recommendation fallback. `GET /v2/activities/templates?q=` exposes the FTS index directly, bypassing Redis cache.

*Discovery integration*
- Registers on startup with discovery-vessel; heartbeats every 60s; registration is non-blocking (vessel is functional even if discovery is down).
- Advertises resolver contract: `resolve_endpoint=/v2/impulses/resolve`, `resolve_request_format=pointer`, `auth_scheme=ApiKey`, `resolve_timeout_ms=10000`.
- Owns and advertises ~30 read shapes (traces, templates, metrics, goal records, composition success, impulse relevance, pre-validation results, audit reports, cost metrics, mcpTool, …) and 14 `*_write` shapes (`activityExecutionTrace_write`, `activityFeedback_write`, `impulseRelevance_write`, …) plus admin-only `activityTemplate_update` / `_deprecate` / `activityExecutionTrace_delete`. Legacy `/v2/vessels/*` endpoints remain in proxy mode through July 2026.

*Selection-layer support*
- `discover-by-shapes candidates_with_scores` mode returns matches with Thompson `alpha`, `beta`, `sample_count`, and optional `composition_score` from edge data. Null scores fall back to a uniform prior.
- `discover-by-shapes` backward mode accepts an `output_shapes` filter for constraint-driven producer discovery.
- Goal-paths track `endpoint_output_shapes` (denormalised, accumulated via `accumulateEndpointShapes`); `POST /v2/goal-paths/recommend` accepts the field as a hard pre-Thompson filter, enabling shape-provider-goal creation without exhaustive chain traversal.

*WebSocket events*
- Standard event channel `wss://activity.metabob.com/ws` with handshake (`{type:"authenticate",token}`) and replay (`{type:"catchup",lastSeenSequence:n}`).
- `task.started`, `task.completed`, `task.failed`, `tool.call`, `impulse.resolved`. `task.completed` carries per-task input/output impulse ids in real-time. `impulse.resolved` uses a unified body contract `{ shape, taskId, body }` for all shapes; bodies > 50 KB return `{ truncated: true, summary }` instead of the full payload.

*Read-time helpers*
- `GET /v2/activities/execution-traces?parent_execution_id=…` returns direct child executions for nested-tree expansion without full traversal.
- When stored `composition_chain` is empty but `parent_execution_id` is set, GET handlers walk the parent chain at read time (capped at 16 levels with cycle guard, never writes back). Per-request `CompositionChainCache` collapses sibling DB walks; concurrent requests share an in-flight promise.
- `executionTraceWithSignatures` returns hydrated traces with per-impulse pointer/shape signatures and `impulses_by_id` map, enabling deterministic co-occurrence extraction without LLM reshaping.

*Backward-compatibility coercions*
- `POST /v2/activities/impulse-relevance` accepts a legacy `activity_id` field and maps to `activity_variant_id` (with deprecation warning); explicit `activity_variant_id` wins.

*Auth*
- All non-public routes call `validateApiKeyWithFallback` against identity-vessel `/v1/auth/resolve`; failure short-circuits with 401, no fallback validator. (See **Authentication** section.)

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
Human-in-the-loop authoring + live-control surface for activities, executions, and learning-loop state. React + Vite, Vitest + Playwright, shadcn/ui primitives.

**Key Files:**
- `src/App.tsx`: Root shell
- `src/pages/`: `TemplatesPage`, `ExecutionsPage`, `GoalsPage`, `ShapesPage`, `CompositionPage`, `TrajectoryEditorPage`
- `src/hooks/`: React Query data hooks; `useWebSocket.ts`, `useTrajectoryExecution.ts`, `useImpulseContent.ts`, `useShapes.ts`
- `src/lib/`: API client, query setup, format utilities
- `src/components/ui/`: Base shadcn/ui primitives (do not modify in-place)
- `src/components/trajectory/`: `TaskEditor`, `ImpulseStatePanel`, `ApplicableActivitiesPanel`, `ShapeProvenanceTree`, `NestedTrajectoryNode`, `GhostActivityCard`, `OutputLayer`, `BindableSlots`, `GoalCompletionBar`

**Surfaces:**

- **Templates / executions / goals / shapes browsers** — TemplatesPage uses activity-api full-text search via `?q=` (FTS results badged distinct from cache hits); ShapesPage is fully live (resolver→vessel mapping from discovery-vessel registry, usage counts from templates, impulse-content examples lazy-loaded on expand); no static shape registry.
- **Composition builder (React Flow)** — drag activities from palette, connect output→input ports with shape-compatibility validation, cycle detection, gap-free deletion (auto-connect predecessor→successor on remove), seed-shape declaration via InitialPoolBar, real-time validation through `POST /v2/activities/validate-composition`, localStorage autosave, export to template.
- **Trajectory editor** — primary authoring surface. Horizontal CSS-Grid layout with drag-reorder, parallel rows per column, save-as-variant with genealogy, inline task editing (resolver picker first, then prompt + variables, validation rules, retry, Thompson α/β sliders). Backward-chaining for missing shapes; productive-vs-infinite cycle detection. Routes `/compositions` and `/studio` redirect here.
- **Resolver-first TaskEditor** — every task summary shows resolver id, tier (deterministic / pattern / llm), and predicted confidence; expanded panel exposes per-task resolver picker with autocomplete filtered by available impulses. Output impulse ids + shapes inline in OutputLayer; expandable bodies (live mode reads from `impulseContentMap`, recalled mode fetches via `useImpulseContent`, > 500 chars truncates with "Show more"; bodies > 50 KB return `{ truncated: true, summary }`).
- **Live execution overlay** — WebSocket subscription with exponential-backoff reconnect and event-catchup. Inline execution status bar replaces sheet overlay; gap indicators flag unbound input shapes; resolver-prediction badge shows tier + confidence pre-execution; per-task impulse-resolved markers colored by tier; cross-scope `↗ext` badges mark impulses produced by other vessels. NestedTrajectoryNode renders child executions on demand via `parent_execution_id` GET.
- **Multi-trace diff** — render two or more execution traces side-by-side with amber outcome strip per task; useful for variant A/B diagnosis.
- **Validation surfaces** — `lifecycle:task:preBinding` events populate the live `BindableSlots` card with slot shapes and binding state (`{{lifecycle.taskId}}` and other dotted-path placeholders flow through). `lifecycle:task:completed` + `validation_result` impulse events populate the Task Validation card per task (green + min confidence on pass, red + `failure_mode.type` on fail). ExecutionHistoryPanel renders failure-mode summary with multi-select filter.
- **Goal completion + stagnation** — GoalCompletionBar runs in compose mode (declarative shape check) when no execution is loaded, and trace mode (actual produced shapes from `impulseContentMap` + per-task impulse ids, with 50-byte stub detection) when one is. Stagnation detector flags same-template repetition (≥ 3) or zero goal-shape progress as an amber warning alongside cycle detection.
- **Subgoal escalation (L→M bridge)** — `ApplicableActivitiesPanel` exposes "spawn subgoal" when a required input shape has no producer; the click dispatches `create-shape-provider-goal` against the binding-layer hook, recursively producing the missing shape.
- **Vessel selector** — top-bar compact variant for routing tasks to a specific vessel; sidebar tab strip exposes History (ExecutionHistoryPanel) and Palette (ApplicableActivities + Activity palette + New) tabs, with `Ctrl+I` cycling and auto-switch to History on execution attach. Header Row 2 holds GoalInputBox + GoalSubmissionPanel + vessel selector; GoalCompletionBar and BackwardChainingPanel render inline below.
- **Trace flame graph + state diff** — `ExecutionFlameGraph` (D3, cost or duration mode, resolver-tier coloring, drill-down, PNG/SVG export); `StateDiffViewer` (split or unified, file-list with change counts, syntax highlighting, cumulative vs incremental).
- **Provenance & weight influence** — `ShapeProvenanceTree` shows resolver chain and per-activity ↑ useful / ↓ not-useful buttons. Clicks call `POST /v2/activities/impulse-relevance` and write into `humanVerdictOverrides`; verification badges degrade or upgrade accordingly. High-confidence verdicts also feed the `goal_verification_labels` oracle corpus (migration 101) for future calibration.

**Distinct from activity-dashboard:** the dashboard is a read-only observability surface; the workbench is authoring + correction + live control. Both talk to the same activity-api.

**Recent UX/observability work** (2026-04-28 → 2026-04-29, deeper detail in [`openspec/changes/`](openspec/changes/)):
- Trajectory observability — Thompson Δα/Δβ badges on activity cards in recalled-trace mode, pool-shape-count headers per column, connector-badge legibility, per-task shape-delta indicators, live-mode `discover-by-shapes` ghost preview using current pool, `[hook]` labels on slot-binding / validator-dispatch nested nodes.
- Left panel — live pool snapshot (vessel + active goal + shape count + active task) above ExecutionHistoryPanel; palette and ImpulsePoolView contrast pass.
- Right panel — goal-impulse + provenance-tree contrast pass; weight-influence ↑/↓ row on every activity entry; cross-scope badges for impulses sourced from other vessels.
- Omnibar — placeholder dual-purpose hint (goal or impulse target), executing-activity line in vessel button, action-group spacing.
- Goal-verification wiring — enrichment-gated `verifyWithEvidence` (mutation goal with zero file edits → reject; missing required capability → low-confidence), trace-reality completion bar, stagnation warning, human verdict → relevance write, oracle-corpus capture.

**Docs:** local `INDEX.md`, `OPENSPEC.md`, `docs/` in-repo (this super-repo tracks only the pointer).

### 6. Adjacent Vessels (brief)

Additional vessels tracked in this super-repo with less CLAUDE.md coverage — each owns its own `CLAUDE.md` / `README.md`:

**Substrate-hosted vessels** (Phase 23, `scripts/substrate/units/`; run as systemd units inside the single-container substrate):

- **goal-host-vessel** (`repos/goal-host-vessel`, port 8210): wraps `GoalHost` from `ias-executor-ts`. Exposes `POST /run-goal` and `POST /resolve` (`goal_execution`, `activity_execution` shapes). Primary dispatch target for all goal execution — minibob and boredom-vessel both POST here. Uses `DiscoveryRegistrationLoop` on startup; `parent_execution_id` and `composition_chain` thread through `ExecuteOptions`.
- **llm-resolver-vessel** (`repos/llm-resolver-vessel`, port 8220): `llm_completion` resolver backed by Anthropic SDK. Decouples LLM credentials from other vessels. `GoalHost`'s `HttpLLMPort` implementation calls this when `LLM_VESSEL_ENDPOINT` is set; in-process `InProcessLLMPort` remains as test fallback.
- **local-tools-vessel** (`repos/local-tools-vessel`, port 8230): re-exports `BunFileSystemAdapter` and `BunProcessAdapter` resolvers behind discovery-advertised shapes. Lowest blast-radius vessel; added first.
- **ribosome-vessel** (`repos/ribosome-vessel`, port 8240): WebSocket client to `activity-api:8080/ws`; subscribes to `task.completed` and `execution:succeeded`; calls `assembleTemplateFromExecution`; writes via `activityTemplate_update` impulse. Replaces the inline ribosome lifecycle path that was in minibob.
- **boredom-vessel** (`repos/boredom-vessel`): systemd timer (`OnUnitActiveSec=5min`) that POSTs rotating topology-discovery goals to `goal-host-vessel:8210/run-goal`. Idle check queries activity-api for recent external traces. Goal rotation: measurement, probing, health, escalation, coverage. Replaces minibob's `boredom.ts`.
- **concept-db** (`repos/concept-db`, port 8260): resolves concept-graph shapes (also substrate-hosted; see below).
- **bootstrap-seeder** (`scripts/substrate/units/bootstrap-seeder.service`): `Type=oneshot` unit that POSTs `SHARED_TEMPLATES` from `@avigopal/ias-executor-ts` to `POST /v2/activities/templates` on startup. UPSERT semantics; idempotent.

- **concept-db** (`repos/concept-db`): resolves concept-graph shapes. As of `04157b1` (2026-04-23) registers with discovery-vessel and advertises five shapes — `concept`, `conceptGraph`, `relatedConcepts`, `conceptUsageStats`, `conceptSequence` — all routed through `POST /v2/impulses/resolve` by `pointer.type`. Legacy `VesselHeartbeat` targeting the deprecated activity-api `/v2/vessels/register` endpoint is no longer invoked from startup (removed in `faa7d8e`). As of `8399767`, an `ExecutionObserver` WebSocket client subscribes to activity-api's `/ws` broadcaster, listens for `task.completed` / `tool.call` events across all vessels (standardized in activity-api `ec493b8d`), and calls `recordUsage` locally when a concept-referencing `impulse_resolutions` entry appears — cross-vessel passive learning without explicit calls. Handshake: `{type:"authenticate", token:apiKey}` first, then optionally `{type:"catchup", lastSeenSequence:n}` on reconnect. Exponential backoff 1s→30s; all handlers swallow and log so the observer never throws into the WS loop or startup. **Deployment status:** Helm plumbing for the discovery client and observer landed in `deployment/6c8746e` (env-var surface + `METABOB_API_KEY` via `secretKeyRef` + `POD_NAME` via `fieldRef` for stable `VESSEL_ID` + `needs:` dependency on `activity-system/discovery-vessel`). **Pending before canary activation:** add a `conceptDb` block to `deployment/scripts/generate-secrets.sh`, sops-edit `canary.secrets.yaml` with `conceptDb.apiKey` (openssl rand -hex 32, prefix `mb_concept_canary_`), and register the key in identity-vessel seed.
- **conversation-vessel** (`repos/conversation-vessel`): new lightweight vessel (v0.1.0, 2026-04-23) for LLM conversations using Vercel `ai-sdk` (`@ai-sdk/anthropic`, `@ai-sdk/openai`, `ai`, `zod`). Builds up impulse system, AI provider, tools, context management, and resolver server. As of `002144b`, resolver server exposes four endpoints: `POST /resolve/impulse` (resolve impulses), `POST /resolve/tool` (execute tools), `POST /resolve/llm` (LLM resolution with tool calling), `GET /resolve/health` (health check). Adds multi-LLM conversation support via `callLLM` tool for relaying messages between LLMs.
- **identity-vessel** (`repos/identity-vessel`): API-key + JWT issuer used by every other vessel. See `docs/AUTH_JWT_CLAIMS.md`, `docs/API_KEY_VALIDATION_ENDPOINT.md`.
- **discovery-vessel** (`repos/discovery-vessel`): documented under §1 above.
- **activity-monitor** (`repos/activity-monitor`): Real-time monitoring dashboard for MiniBob activity system. Polls activity-api every 3 seconds to display recent executions (last 50), activity templates with Thompson scores, and impulse resolution patterns. Single-page Bun application with clean UI; useful for observing MiniBob activity in development. Provides `/api/data` and `/api/health` endpoints. Configuration via `METABOB_API_KEY` and `ACTIVITY_API_URL` env vars. Complements the workbench (authoring) and activity-dashboard (canary observability) as a lightweight monitoring vessel.
- **Other vessels under `repos/`** (`metabob-analysis-api`, `metabob-rpc-api`, `metabob-mcp`, `metabob-opencode`, `metabob-cli`, `metabob-cloud-dashboard`, `metabob-internal-dashboard`, `minibob-tui`, `obsidian-vessel`, `user-vessel`, `terminal`, `react-renderer`, `cpg-inference` / `cpg-inference-ts`, `k8s-activity-executor`, `platform`, `vessels`, `metabob-proto`): tracked in the super-repo (some as git submodules, some as direct file trees); consult each vessel's own docs.

### 7. Helm Deployment (`repos/deployment/`) — canary/production only

> **Legacy for local work.** Local development runs on the single-container substrate
> (`substrate-live`), which has no Helm, no Istio, and no Kubernetes. Helmfile applies
> only to the **downstream** canary/production substrates. Do not reach for `helm` /
> `kubectl` in the local loop — use `make -C scripts/substrate ...` instead.

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
Structured, measured templates that constrain the search space for a goal. Without activities, an agent faces infinite options; an activity declares which input shapes it consumes, which output shapes it produces, and which resolver steps execute the transformation. Learning improves ranking and template generation over time.

**Structure** (canonical: [`docs/architecture/IMPULSE_ACTIVITY_FOUNDATION.md`](docs/architecture/IMPULSE_ACTIVITY_FOUNDATION.md)):
```typescript
{
  id: string
  name: string
  description: string
  tags: string[]                  // hierarchical classification, e.g. "bugfix.auth.tokens"

  // Shape contract — what this activity consumes and produces
  input_shapes?: string[]         // optional; activities accept any input by default
  output_shapes: string[]         // required

  tasks: Array<{
    id: string
    description: string
    resolver: string              // e.g. "bash", "git", "llm", "validation", or any registered resolver id
    config?: Record<string, unknown>     // resolver-specific configuration
    prompt?: { template: string, variables?: Variable[] }   // alternative to config when resolver is "llm"
    validation?: {
      requiredFiles?: string[]
      requiredPatterns?: string[]
      forbiddenPatterns?: string[]
      commands?: ValidationCommand[]
    }
    retry?: { max_attempts: number, strategy: string }
  }>

  // Learning state (Thompson Sampling)
  metrics?: {
    total_executions: number
    successful_executions: number
    failed_executions: number
    success_rate: number
    thompson_alpha: number
    thompson_beta: number
  }
}
```

**Key Points:**
- Tasks dispatch to **resolvers**, not LLM prompts. The LLM is one resolver among many.
- Output shapes feed downstream activities; the system learns which sequences succeed for which input combinations.
- Execution is measured (success rate, cost, duration); variants are created on failure (trailblazing) and selected via Thompson Sampling.

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

  // NEW: Vessel tracking (migration 086, 2026-04-22)
  vessel_id: string              // Vessel that executed this activity (sender of trace)
  resolved_by_vessel_id: string  // Vessel that resolved impulses (typically same as vessel_id)
  vessel_version: string         // Vessel version (semver-sha7, e.g., 0.3.3-f24a329)

  // NEW: Per-impulse resolution details (migration 086, 2026-04-22)
  impulse_resolutions: [{
    impulse_id: string           // Impulse that was resolved
    resolver_id: string          // Resolver used (bash, git, llm, etc.)
    resolver_tier: string        // deterministic, pattern, llm
    vessel_id: string            // Vessel that executed resolver
    latency_ms: number           // Resolution duration
    cost_usd: number            // Resolution cost
  }]

  // NEW: Per-task resolver fields (minibob 6f8c727, activity-api 1.8.0, 2026-04-24)
  // Per-task impulse arrays are also broadcast live on WebSocket task.completed events (2026-04-25)
  tasks: [{
    // ... existing task fields ...
    resolver_id: string          // Resolver used by this task (bash, git, llm, etc.)
    resolver_tier: string        // deterministic, pattern, llm
    success: boolean             // Task succeeded
    cost_usd: number            // Task resolution cost
    input_impulse_ids: string[]    // Impulses that fed this specific task
    output_impulse_ids: string[]   // Impulses produced by this specific task
  }]

  // NEW: Composition tracking (minibob → activity-api v1.5.5, April 2026)
  parent_execution_id: string    // Direct parent in the composition tree (nested invocations)
  composition_chain: string[]    // Denormalized ancestor chain, ordered root-first

  // Failure mode taxonomy (migration 091)
  // Canonical schema: FailureModeSchema in activity-api/src/models/schemas.ts;
  // spec: openspec/changes/2026-04-26-validators-and-failure-modes/specs/failure-mode-taxonomy/spec.md
  failure_mode: {
    type: "verifier_negative" | "budget_exhausted" | "safety_breach" | "cascading" | "user_abort"
    reason: string
    // Discriminated `context` payload — shape depends on `type`:
    context:
      | { validator_id: string, failed_evidence: Evidence[] }                                  // verifier_negative
      | { budget_type: "cost" | "duration", consumed: number, allowed: number }                // budget_exhausted
      | { breach_type: "depth" | "cycle", limit: number, ancestor_chain: string[] }            // safety_breach
      | { upstream_task_id: string, upstream_failure_mode?: FailureMode }                      // cascading
      | { abort_source: "human_resolver" | "ctrl_c" | "workbench_button" }                     // user_abort
  } | null  // null for legacy traces; populated at failure detection point
}
```

**Purpose:**
- **Per-task impulse grouping**: Track which impulses were consumed and produced by each task for co-occurrence analysis
- **Deterministic co-occurrence extraction**: ImpulseCooccurrenceResolver can extract task-scoped signal without LLM reshaping (via executionTraceWithSignatures)
- **Learn which resolvers work best** for which impulses
- **Track vessel-level performance** and resolver selection success rates
- **Identify optimization opportunities** through resolver tier analysis
- **Stratify failures by type** (mutation validation, budget exhaustion, safety guards, cascading, user action) for targeted improvement

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

### Primary Workflow: dispatch through the running substrate

> The default is **not** to hand-edit a file and run `bun test`. The default is to
> dispatch the change as a goal so it produces a trace and feeds the learning loop.
> The local substrate (`substrate-live`, Phase 26+) is the development target;
> canary/production K8s is a downstream promotion target, not where you work.

```bash
# 0. Confirm the substrate is up (host-mapped ports; see §"Substrate endpoints")
curl -s http://localhost:18080/health   # activity-api (trace store + learner)
curl -s http://localhost:18210/health   # goal-host-vessel (goal dispatch)

# 1. Dispatch development goals through the substrate. minibob is the entry
#    point; it POSTs to goal-host-vessel and the work is traced.
minibob --single "fix the failing tests in metabob-activity-api"
minibob --single "add input validation to the impulse endpoint"

# 2. Hot-reload the edited vessel inside the container and re-validate.
make -C scripts/substrate substrate-restart-<vessel>
bun run validation/scripts/failure-mode-harness.ts   # validates against :18080
minibob --single "verify the change works"            # confirms a trace lands

# 3. Conscious one-off direct edits (rare) bypass the edit-gate explicitly:
SUBSTRATE_ALLOW_DIRECT_EDIT=1   # set in env for a deliberate manual edit

# 4. Commit + push to dev. CI/CD deploys to canary for integration validation;
#    promote canary → production via the /deploy skill (both are K8s, downstream).
git add . && git commit -m "feat(activity-api): ..."
git push origin dev
```

### Branch hygiene (avoid forking)

All spec work flows through a single `dev` branch per repo. To prevent divergent local branches and detached-HEAD commits going stale:

```bash
# At the start of any work in a vessel repo:
cd repos/<vessel>
git fetch origin
git checkout dev
git pull --ff-only origin dev   # fails loudly if local has diverged
# do work, commit on dev
git push origin dev
```

For the super-repo, additionally `git submodule update --init` after the pull so submodule pointers stay aligned.

Three properties this enforces:
- **Stay on `dev`, not detached.** Detached HEADs hide work behind unreachable refs.
- **`pull --ff-only` refuses divergent merges.** Any divergence forces explicit triage instead of silent drift.
- **Push `origin dev`, not `HEAD:dev`.** Same branch name on both sides; no detour through ad-hoc refspecs.

If `pull --ff-only` fails, audit the divergence (`git log dev..origin/dev` and `git log origin/dev..dev`) and decide between rebase, cherry-pick, or reset — don't merge by default.

---

> **Legacy: canary / production Kubernetes deployment.** Everything from here to the
> end of this section concerns the **downstream** K8s substrates (canary, production),
> not local development. You do not run these in the normal substrate-first loop —
> CI/CD deploys to canary on push to `dev`, and the `/deploy` skill promotes canary →
> production. Kept for reference when operating those environments.

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
├── vessels/                         # Vessel source code (synced submodules, used to tag releases to deployment manifests)
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

**API Documentation:**
See `repos/metabob-activity-api/docs/API_PHASE1_ENDPOINTS.md` for comprehensive Phase 1 API reference covering:
- WebSocket real-time events (`wss://activity.metabob.com/ws`) with authentication and catchup protocol
- Activity discovery by shapes (forward/backward chaining modes)
- Goal-to-trajectory recommendations with endpoint prediction
- State transition analysis
- Error handling and testing procedures

### Substrate endpoints (local development — USE THESE)

The local single-container substrate (`substrate-live`, Phase 26+) is the primary
development target. Vessels run as systemd units inside the container; each is
host-mapped on port `18xxx → 8xxx`. Confirm with `docker ps --filter name=substrate`.

| Host port | Vessel | Role |
|---|---|---|
| `http://localhost:18080` | activity-api | trace store + Thompson learner + activity-shape resolver |
| `http://localhost:18090` | development-vessel | `memoryNote` resolver (authoritative memory) + dev meta-activities |
| `http://localhost:18210` | goal-host-vessel | `POST /run-goal` (goal dispatch), `POST /resolve` |
| `http://localhost:18260` | concept-db | concept-graph shapes + dense (MiniLM) search |
| `http://localhost:18100`, `18250` | (supporting units) | resolver / tooling units as wired in `scripts/substrate/units/` |

activity-api on `:18080` exposes the full API surface (`/health`,
`/v2/activities/recommend`, `/v2/activities/templates`, `/v2/goal-paths/recommend`,
`/v2/impulses/resolve`, `/v2/activities/execution-traces`, `discover-by-shapes`,
`validate-composition`, `/ws` WebSocket events, …). LLM credentials are decoupled
into `llm-resolver-vessel` (`:8220` in-container). Bootstrap and iteration:
`make -C scripts/substrate substrate-run` / `substrate-restart-<vessel>`; full guide in
[`docs/SUBSTRATE.md`](docs/SUBSTRATE.md).


## Authentication

**identity-vessel is the single source of truth for authentication.** Every other vessel — minibob, activity-api, discovery-vessel, workbench, cloud-dashboard, and any new vessel — validates credentials by asking identity-vessel. There is no fallback to direct SurrealDB validation, no per-vessel ACCESS method, no instance-signin endpoint. Earlier patterns (`minibob_record` ACCESS, `POST /v2/auth/minibob/signin`, direct API-key checks against the `api_key` table) are removed.

### Two credential types, one validator

| Credential | Form | Issued by | Used by |
|---|---|---|---|
| **HMAC API key** | `Authorization: ApiKey <key>` where `<key>` is `mb_<env>-<org>-<user>-<keyid>-<HMAC-SHA256>` | identity-vessel `/v1/keys/issue` (admin) | service-to-service: minibob, vessel-side resolvers |
| **HMAC-signed JWT** | `Authorization: Bearer <jwt>` (HS256/HS512, signed with `JWT_SECRET`) | identity-vessel `/v1/auth/login`, `/v1/jwt/generate` | browser sessions: workbench, cloud-dashboard |

### Validation paths

Idiomatic vessels (Hono / Bun stack) validate by **calling identity-vessel's resolver** through the discovery contract:

```
POST {identity_resolve_endpoint}/v1/auth/resolve
{ "impulse": { "type": "authentication", "pointer": { "type": "apiKey" | "session", ... } } }
```

The resolver returns `{ authenticated, orgId, userId, keyId, scopes, projectIds, accountId }`. Activity-API's `validateApiKeyWithFallback` is the reference implementation; on identity-vessel transport failure it fails the request rather than substituting a weaker validator.

Non-idiomatic stacks (browser app like cloud-dashboard, workbench during login flow) hit identity-vessel's HTTP service directly:
- `POST /v1/auth/login` → JWT (15 min lifetime, role + org claims)
- `POST /v1/keys/validate` → API-key validation (used by discovery-vessel today)
- `GET /v1/auth/me` → user record from a Bearer token

### Multi-tenant isolation via SurrealDB PERMISSIONS

Org scoping is enforced at the database, not the application. Every multi-tenant table carries `org_id` and uses a PERMISSIONS clause:

```sql
PERMISSIONS FOR select, update, delete WHERE org_id = $token.org_id
```

Use `$token.org_id` everywhere — it is populated for both API-key resolution (via the JWT identity-vessel mints during `/v1/auth/resolve`) and direct dashboard JWTs. `$auth.org_id` works only for dashboard sessions and should be avoided.

**Project-scoped tables** (e.g. `activity_execution_traces`, `goal_execution_paths`) handle three cases — record has no project restriction, user has explicit project list, user has empty/null project list (admin / cross-project view):

```sql
WHERE org_id = $token.org_id
  AND (
    project_id IS NONE
    OR project_id IN $token.project_ids
    OR $token.project_ids IS NONE
    OR array::len($token.project_ids) = 0
  )
```

### Application-side usage

```typescript
// PERMISSIONS enforced automatically — no application-level org filter
const db = await createAuthenticatedClient(token);   // token = JWT minted by identity-vessel
const templates = await db.query(`SELECT * FROM activity_template`);
```

See [`docs/RBAC_GUIDE.md`](docs/RBAC_GUIDE.md) for the `$auth` vs `$token` rules and [`docs/AUTH_JWT_CLAIMS.md`](docs/AUTH_JWT_CLAIMS.md) for the claim shape.

## Security Hardening (forward-looking)

These are hardening properties not yet implemented; the schema reserves space and degraded behaviour ships graceful fallbacks. Source: [`openspec/changes/2026-04-26-security-hardening-findings/design.md`](openspec/changes/2026-04-26-security-hardening-findings/design.md).

- **Two-sided execution traces (H1)**: cross-vessel traces must carry counterparty signatures proving both producer and consumer agreed on the trace contents. Until shipped, Thompson posterior writes (`impulseRelevance_write`, `toolArgumentPattern_write`, validator α/β deltas) stay advisory-only and unverified traces do not pollute the binding-layer distribution.
- **Vessel identity via pubkey multihash (H2)**: `vessel_id` is derived from a vessel-held public key via multihash, with a self-signed registration challenge proving keypair possession. Discovery-vessel reserves `pubkey_hash` on the registration payload.
- **EIP-712-style signed scope attestations (H3)**: scopes are issued as signed attestations (org → user, user → vessel) rather than DB-stored strings, so revocation and delegation are auditable.
- **Tailnet-Lock-equivalent vessel ratification (H4)**: vessel registration requires a quorum of authority signatures before the registry treats it as trusted. Depends on H2.
- **Immutable-baseline selector with auto-regression (H5)**: selector logic ships with a signed baseline; deviations trigger automatic regression mode.
- **Sub-goal scope narrowing (CC1)**: `create-shape-provider-goal` child tasks must declare `outputShapes ⊆ parent.endpoint_output_shapes`. Out-of-scope shapes convert to a `human_in_the_loop_required` flag rather than executing. Source: [`openspec/changes/2026-04-26-shape-provider-goal-creation/design.md`](openspec/changes/2026-04-26-shape-provider-goal-creation/design.md).

**Until these land:** Thompson Sampling converges more slowly on unverified data, vessels cannot prove identity cryptographically, AUM (Authority Use Mediator) attestations are advisory, and recursive sub-goal scope is enforced by client-side checks rather than authoritative ratification.

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

> **Important**: Use `http://localhost:18080` for local substrate development (Phase 26+, host-mapped port); use `https://activity.metabob.com` for canary validation. Never use `.local` (Kubernetes internal) endpoints from outside the cluster.

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

Validate against the local substrate (`:18080`), not a `.local` K8s endpoint. The
substrate-first validation path is the failure-mode harness plus a confirming dispatch:

```bash
# Validate vessel behavior against the local substrate
bun run validation/scripts/failure-mode-harness.ts        # targets localhost:18080
minibob --single "verify <the change> works"              # confirms a trace lands

# Direct learning-system integration (point MCP_ENDPOINT at the local substrate)
MCP_ENDPOINT=http://localhost:18080 bun run test-learning-system-integration.ts
```

## Commit Practices

**Commit early and often once a feature is working.** Don't accumulate large uncommitted changes.

### Super-repo placement rules

The super-repo is a thin coordinator over `repos/*` (submodule pointers), `docs/` (stateless documentation), `openspec/` (future-change proposals), `scripts/` (operational tooling), and `packages/` (shared TypeScript packages). Anything else accumulates as cruft.

A pre-commit hook at `scripts/git-hooks/pre-commit` enforces placement rules on newly-added or renamed-into entries (modifications to existing tracked files are never blocked). Install for a fresh clone with `scripts/git-hooks/install.sh`. Full rules and rationale: [`scripts/git-hooks/README.md`](scripts/git-hooks/README.md). Summary:

- Files at the super-repo root are limited to a small allowlist of project metadata (CLAUDE.md, README.md, .gitignore, .gitmodules, lockfiles, dotfile configs).
- New top-level markdown belongs in `docs/` (stateless reference) or `openspec/changes/<date>-<slug>/` (future-change proposals + designs + tasks + specs). Writeups that only matter for one commit go in the **commit message**, not the tree.
- Tests live under `repos/<vessel>/test{,s}/` alongside their code; the super-repo never holds tests.
- Image / video / archive files belong in `repos/<vessel>/` or `docs/assets/`. Screenshots and playwright output should be gitignored, not committed.
- Ad-hoc shell / TS / Python scripts at root are rejected; reusable tooling goes in `scripts/`, one-shot operations live in commit history rather than the tree.

The super-repo's prior pre-commit hook (which ran `helmfile` against the local cluster on every commit) was removed; deployment runs from CI on push to `dev`, not from the developer's laptop.

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
```

Types: `feat`, `fix`, `refactor`, `test`, `docs`, `chore`

Scopes: `activity-api`, `analysis-api`, `minibob`, `dashboard`, `helm`, `schema`

### Before Restarting the Substrate

The local substrate restarts a single container, not a cluster. Before
`make -C scripts/substrate substrate-restart` (or restarting a unit):
1. Check `git status` for uncommitted changes.
2. Confirm no long-running activity is mid-flight (`curl -s http://localhost:18080/health`;
   inspect recent traces before pulling the rug). The learning state is persisted in
   the container's volume — back it up per [`docs/SUBSTRATE.md`](docs/SUBSTRATE.md)
   before any destructive reset.
3. Never hand-edit the database; schema changes ship as migrations and apply on unit start.

## Common Operations

### Troubleshooting the local substrate

The local substrate is one container (`substrate-live`) running vessels as systemd
units. Diagnose with `docker` + `systemctl`, not `kubectl`:

```bash
# Container up? Ports mapped?
docker ps --filter name=substrate

# Is a vessel's unit active? (run systemctl inside the container)
docker exec substrate-live systemctl is-active goal-host-vessel
docker exec substrate-live systemctl status llm-resolver-vessel --no-pager

# Tail a vessel's logs
docker exec substrate-live journalctl -u activity-api -n 100 --no-pager
docker logs substrate-live --tail 100

# Hot-reload a vessel after editing its source
make -C scripts/substrate substrate-restart-<vessel>

# Health probes (host-mapped ports)
for p in 18080 18090 18210 18260; do curl -s -o /dev/null -w "$p %{http_code}\n" localhost:$p/health; done
```

**Common issues:** vessel unit failed to start → `journalctl -u <unit>`; goal dispatch
hangs → check `llm-resolver-vessel` is active and `~/.metabob/config.json` has a valid
Anthropic key; memory/concept reads empty → confirm `:18090`/`:18260` are healthy (hooks
fail open and fall back to the cache when they are not).

> **K8s troubleshooting (canary/production only):** `kubectl get pods -n activity-system`,
> `kubectl logs -l app.kubernetes.io/name=<vessel> -f`, `kubectl rollout restart deployment …`,
> `kubectl get events --sort-by='.lastTimestamp'`. These apply to the downstream cluster,
> never to local work.

### Querying Backend Data

```bash
# Against the local substrate's activity-api (:18080)
curl -s "http://localhost:18080/v2/activities/composition/graph?limit=10" | jq .
curl -s "http://localhost:18080/v2/activities/tool-usage?limit=10" | jq .
curl -s "http://localhost:18080/v2/activities/execution-sequences?limit=10" | jq .
```

## Architecture Documentation

**Canonical reference (read this first):**
- [`docs/architecture/IMPULSE_ACTIVITY_FOUNDATION.md`](docs/architecture/IMPULSE_ACTIVITY_FOUNDATION.md): The foundational model defining impulses, activities, vessels, and learning
- [`docs/PRODUCT_BOUNDARIES.md`](docs/PRODUCT_BOUNDARIES.md): Standalone product surface (cloud-dashboard + metabob-mcp + frozen rpc-api 0.16.13) — env-var matrix, auth flow, coupling audit, adapter-layer principle

**Discovery System:**
- [`DISCOVERY_INTEGRATION.md`](DISCOVERY_INTEGRATION.md): Complete vessel discovery integration guide
- [`packages/vessel-discovery-client/README.md`](packages/vessel-discovery-client/README.md): VesselClient package documentation

**Vessel construction:**
- [`docs/architecture/TYPESCRIPT_VESSEL_TEMPLATE.md`](docs/architecture/TYPESCRIPT_VESSEL_TEMPLATE.md): Current canonical template for building a TypeScript vessel — file layout, the three invariants, discovery-client + observer + auth patterns, Helm wiring, and what NOT to do (2026-04-24). Supersedes `VESSEL_QUICK_START.md` and `VESSEL_WIRING_PRACTICAL.md` for new work.
- `docs/archive/2026-04-26/VESSEL_CONSTRUCTION_PATTERNS.md` (archived 2026-04-26): Cross-vessel pattern analysis (2026-04-08). Registration path superseded by discovery-vessel; see TYPESCRIPT_VESSEL_TEMPLATE.md for current patterns.

**Complementary architecture docs:**
- [`docs/SUBSTRATE.md`](docs/SUBSTRATE.md): Local single-container substrate — quick-start, iteration loop, backing up learning state, switching between local and canary (Phase 26+)
- [`repos/deployment/DEPLOYMENT_WORKFLOW.md`](repos/deployment/DEPLOYMENT_WORKFLOW.md): Kubernetes deployment procedures (canary / production)
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

1. **Vessels**: Building and improving execution environments (MiniBob variants)
2. **Activities**: Creating and optimizing templates for development work

**Success criteria:** Dashboard shows continuous activity creation and execution, with success rates improving over time through autonomous optimization.

### Activity Registry Quality Pass (2026-04-27 Roadmap)

The 2,500+ existing activity templates accumulated organically and need systematic review. The activity-registry-quality-pass initiative provides the pipeline:

**Capability:** 6-activity main pipeline for audit → review → prune → replace → extract → concept, plus 5 sibling helper activities (2026-04-27):

**Main pipeline activities:**
- **core-activity-audit** (READY): Catalogue & rank load-bearing activities by Thompson α, recency-decayed execution count, and downstream-dependency count. Emits `coreActivitySet` (top-N, default 20) + `auditReport` summary. Core template for the entire quality-pass workflow.
- **review-activity** (ROADMAP): Score one template against idiomatic alignment + foundation rules. Emits `activityReview` + `failure_mode` impulses.
- **prune-activity** (ROADMAP): Soft-deprecate via `activityTemplate_deprecate` when score < threshold.
- **replace-activity** (ROADMAP): Generate better variant; dispatches make-activity as a child.
- **extract-pattern** (ROADMAP): Mine traces for recurring task graphs and shape-flow signatures. Emits `pattern` + `patternFrequency` impulses.
- **concept-from-pattern** (ROADMAP): Promote a pattern to a concept via concept-db.

**Sibling helper activities (2026-04-27, embedded in minibob):** Five supporting activities for decomposition and task distribution within the quality-pass flow. Callable from main activities via composition-dispatch to enable parallel review/prune/replace operations across activity template clusters.

**Trace summarization primitives:** (1) `executionTraceWithSignatures` — already exists; pulls per-impulse pointer/shape signatures without full content. (2) `traceDigest` — new shape; structured summary: `{activity_id, status, duration_ms, tasks: [{id, status, duration_ms, resolver_tier}], failure_mode, output_shapes}` (3) `traceCluster` — new shape; groups traces by `(activity_id, failure_mode_type, output_shapes_intersection)` for representative sampling.

**Dependencies:** make-activity resolver, lifecycle events + validators, Thompson Sampling (production-ready), iteration resolver.

See [`openspec/changes/2026-04-27-activity-registry-quality-pass/proposal.md`](openspec/changes/2026-04-27-activity-registry-quality-pass/proposal.md) for detailed specification and success criteria.

## Important Implementation Notes

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

## Memory: The Substrate Is The Source Of Truth (LIVE, hook-enforced)

> **Status as of 2026-06-16: the cutover is done.** The `memoryNote` / `memoryNote_write` resolvers are **live** on `development-vessel` (host `http://localhost:18090`, container `:8090`), the 169-file operator cache has been imported (store now holds 171 notes), and **harness hooks enforce the read/write flow automatically** — you rarely invoke it by hand. This section is the executive summary every session needs at load. Full operational guide: [`docs/MEMORY_AS_SUBSTRATE.md`](docs/MEMORY_AS_SUBSTRATE.md).

### The principle

Memory about this system belongs to the system. The substrate is the authoritative store; the operator-side files under `~/.claude/.../memory/` are a derived read-cache. The shape contract is `memoryNote`; the owning vessel is `development-vessel`.

### The flow is automatic (you don't have to remember to do it)

- **Session start** — the `substrate-session-start` hook queries the `memoryNote` resolver and injects recent + high-confidence notes into your context. You begin every session reading from the substrate, not from a truncated `MEMORY.md`.
- **On memory write** — when you Write/Edit any file under `~/.claude/.../memory/`, the `substrate-memory-mirror` PostToolUse hook emits the corresponding `memoryNote_write` to the substrate. Writing the file is still fine (habit, manual recall), but the substrate copy is authoritative and is written for you.
- **Session end** — the `substrate-session-end` hook dispatches a memory-consolidation goal to the substrate so this session's learnings are absorbed by the loop.

All three hooks **fail open**: if `localhost:18090` is unreachable they no-op and you fall back to the cache.

### Saving a memory by hand (not via a file)

Emit `memoryNote_write` directly — note the `impulse` envelope and the `.note` body:

```bash
curl -s -X POST http://localhost:18090/v2/impulses/resolve -H 'Content-Type: application/json' \
  -d '{"impulse":{"type":"memoryNote_write","note":{"id":"<kebab-slug>","type":"finding|feedback|reference|project","title":"...","body":"...","confidence_weight":0.7}}}'
```

The four types map directly onto `memoryNote.type`: `finding` (recent conclusions/percolations), `feedback` (user corrections, conventions), `reference` (project orientation), `project` (ongoing-work state). Upsert is by `id`.

### Recalling a memory (the verification target is the substrate, not the file)

```bash
curl -s -X POST http://localhost:18090/v2/impulses/resolve -H 'Content-Type: application/json' \
  -d '{"impulse":{"type":"memoryNote","note_type":"feedback","limit":20}}'
# filters: id | note_type | title_prefix | provenance_tag | limit
```

The response is authoritative. Read `MEMORY.md` / cache files only when the substrate is unreachable — and say so, so the user can audit drift.

### What NOT to save (unchanged)

- Information available by reading a current file (read it instead)
- Speculative claims without provenance
- Secrets, credentials, PII
- Workflow state that belongs in `openspec/changes/`, not memory

### Migration record + degraded-mode recovery

The one-shot import ran 2026-06-16 via `scripts/substrate/import-operator-memory.ts` (`make -C scripts/substrate import-memory`, HTTP path with `DEV_VESSEL_ENDPOINT=http://localhost:18090`): 169 files → substrate, store now 171 notes (63 finding / 76 project / 31 feedback / 1 reference). The script is idempotent (upsert-by-id, `operator-import:<stem>` ids, provenance tag `operator-import-2026-05-25`). If the substrate was down during a stretch of work, re-run that import to reconcile the cache back into the substrate once it returns. (This supersedes the stale reference to `validation/scripts/migrate-memory-to-substrate.ts`, which never existed.)
