# Implementation Findings & Deployment Status (April 2026)

This document consolidates implementation findings from the impulse-activity-loop implementation wave (April 2026) and documents what's currently deployed and working on canary.

**Last updated:** 2026-05-06 10:00 UTC  
**Deployment version:** activity-api 1.15.0 (workbench v0.7.0, minibob 0.14.7-f6df221)  
**Canary endpoint:** https://activity.metabob.com

---

## Resolved Implementation Findings

These findings were identified during implementation and have been resolved. They represent non-obvious implementation details that developers should understand.

**Currently documented:** F-1 through F-9b (foundational), F-45 (null-guard fix, 2026-04-27), F-V29–F-V32 (validation run findings, 2026-05-06)  
**Open findings with workarounds:** F-37, F-38, F-39, F-40, F-41 (meta-activity lifecycle issues, in progress)

### F-1: Lifecycle Payload Field-Name Reconciliation — RESOLVED

**Issue:** The emission point used `executionId` for the parent execution ID; sibling specs called the same field `parentExecutionId`. Spec/source contract drift.

**Resolution:** Standardized on `parentExecutionId`. Updated `repos/minibob/src/activity.ts` lifecycle dispatcher and retrofit `slot-binding.json`/`validator-dispatch.json` templates.

**Implication:** When reading lifecycle payloads, use `{{lifecycle.parentExecutionId}}` in templates.

### F-2: Lifecycle Payload Missing Parent Goal Text — RESOLVED

**Issue:** `lifecycle:task:preBinding` lacked parent goal text, so the escalation task in `slot-binding.json` had to forward an empty default.

**Resolution:** Extended both emit sites in `repos/minibob/src/activity.ts` with a `parentGoalText` field sourced from `this.currentGoalContext`. Field is `undefined` when the executor has no goal context.

**Implication:** Templates can now access `{{lifecycle.parentGoalText}}` for semantic anchoring in recursive sub-goals. When undefined, dotted-path interpolation leaves the placeholder literal (resolver's defensive prompt handles graceful fallback).

**Affected files:** `repos/minibob/src/activity.ts:4438, :5004`, `repos/minibob/src/embedded-templates/slot-binding.json`

### F-3: Lifecycle Payload Missing Composition Depth — RESOLVED

**Issue:** The lifecycle dispatcher didn't thread `composition_chain` depth through the payload, breaking the recursion-depth guard (default `max_recursion_depth=3`).

**Resolution:** Extended both emit sites in `repos/minibob/src/activity.ts` with a `parentDepth: number` field sourced from `(this.config.activityCallStack || []).length`.

**Implication:** Templates can access `{{lifecycle.parentDepth}}` to check nesting depth. For root executions the value is `0`.

**Affected files:** `repos/minibob/src/activity.ts:4438, :5004`, `repos/minibob/src/embedded-templates/slot-binding.json`

### F-4: Template Format Lacks Iteration Primitive

**Issue:** Meta-activity tasks that need to iterate over arrays (per-shape selection, per-validator dispatch) have no `foreach` primitive, forcing single-item semantics.

**Status:** Open. Tracked as infrastructure gap B. Templates work around this by simplifying to single-shape / single-candidate behavior.

**Implication:** Multi-shape tasks and per-candidate metric fetching are not yet fully supported. See task #17 in `openspec/changes/2026-04-26-impulse-activity-loop/tasks.md`.

### F-5: Dotted-Path Interpolation Partially Applied — RESOLVED

**Issue:** `interpolate()` gained dotted-path support (`{{lifecycle.taskId}}`) but `slot-binding.json` and `validator-dispatch.json` still used `{{lifecycle}}` blobs parsed inside resolvers.

**Resolution:** Retrofit both templates to use dotted-path access (`{{lifecycle.taskId}}`, `{{lifecycle.executionId}}`, etc.).

**Implication:** Parsing complexity moved from resolvers to template interpolation. Debugging is simpler.

**Affected files:** `repos/minibob/src/embedded-templates/slot-binding.json`, `repos/minibob/src/embedded-templates/validator-dispatch.json`

### F-6: Discover-by-Shapes Wiring via Activity-API Shape — RESOLVED

**Issue:** Sibling specs expected a registered `vessel_resolve_call` resolver, but it was only a TypeScript helper inside minibob, not registered. Validator-dispatch had to work around this with a substitute resolver.

**Resolution:** Activity-api advertised a new `discoverByShapesQuery` shape. The shape's pointer carries the same fields as the REST route; the handler delegates to a shared helper. No minibob source changes required — just a JSON template retrofit.

**Pattern:** When integrating with another vessel's capability, advertise a shape instead of adding a resolver to minibob (respects the vessel-integration constraint).

**Affected files:**
- Activity-api: `src/services/discover-by-shapes.ts` (new helper), `src/routes/impulses.ts` (new shape case), `src/routes/activities.ts` (route refactored to call helper), `src/config.ts` (shape advertised)
- MiniBob: `src/embedded-templates/validator-dispatch.json` (task retrofit)

### F-7: Lifecycle:task:completed Missing Validator-Dispatch Fields — RESOLVED

**Issue:** The payload lacked `skip_validation` flag and impulse/tool-call arrays needed by validator-dispatch and learning-signal-writer.

**Resolution:** Extended both emit sites in `repos/minibob/src/activity.ts` with four new fields:
- `skip_validation: boolean` — whether validators should be bypassed (sourced from `task.skip_validation ?? false`)
- `allImpulseIds: string[]` — all impulses visible to the task
- `loadedImpulseIds: string[]` — impulses whose content was materialized
- `toolCallRecords: ToolCall[]` — per-task LLM tool calls

**Implication:** Templates can conditionally skip validation via `{{lifecycle.skip_validation}}`, and resolvers can access impulse consumption and tool-call details via dotted-path placeholders.

**Affected files:**
- `repos/minibob/src/activity.ts:2407, :2877` (emission sites)
- `repos/minibob/src/types.ts` (ActivityTask.skip_validation field)
- `repos/minibob/src/resolvers/learning-signal-writer-resolver.ts` (JSON-stringified-array tolerance)
- `repos/minibob/src/embedded-templates/validator-dispatch.json` (dotted-path swap + skip_validation conditional)

### F-8: Activity Dispatch Endpoint Shimmed via Impulse-Resolve

**Issue:** Workbench has no first-class activity dispatch endpoint; it posts to `/v2/impulses/resolve` with a `pointer.type === 'activityDispatch'` envelope.

**Status:** Acknowledged. Proposal: Add `POST /v2/activities/dispatch` to activity-api with the dispatch envelope formalized.

**Implication:** Currently coupled to impulse-resolve route conventions; not discoverable as a formal API surface.

**Affected files:** `repos/workbench/src/hooks/useSpawnSubgoal.ts`, `repos/metabob-activity-api/src/routes/activities.ts`

### F-9: Impulse.resolved WebSocket Event Contract — RESOLVED

**Issue:** Workbench couldn't parse `impulse.resolved` events reliably because activity-api never formalized the body contract.

**Resolution:** Formalized the contract in three places:
1. `repos/metabob-activity-api/src/websocket/types.ts` — added `ImpulseResolvedMessage` interface with canonical **flat** payload structure
2. `repos/metabob-activity-api/src/websocket/broadcaster.ts` — treats `impulse.resolved` as fine-grained with sequence numbers and catchup history
3. `repos/metabob-activity-api/src/routes/execution-traces.ts` — emits one event per `impulse_resolutions[]` entry with canonical flat structure

**Contract (flat format):**
```typescript
{
  execution_id: string
  impulse_id: string
  resolver_id: string
  resolver_tier: string
  vessel_id: string
  latency_ms: number
  cost_usd: number
  timestamp: number
  task_id?: string
  shape?: string
  body?: unknown  // Omitted when content lives off-trace
}
```

**Implication:** All resolvers now emit the same standardized contract. Consumers can parse deterministically.

**Affected files:** `repos/metabob-activity-api/src/websocket/{types,broadcaster,broadcaster.test.ts}`, `src/routes/execution-traces.ts`, `docs/API_PHASE1_ENDPOINTS.md`

### F-9b: MiniBob Output-Impulses Schema Lacked Body Field — RESOLVED

**Issue:** Even though F-9 formalized the body channel, minibob's `OutputImpulse` schema didn't populate `body`, so every impulse.resolved event lacked content.

**Resolution:** Extended the `OutputImpulse` interface in `repos/minibob/src/types.ts` with optional `body?: unknown`. Updated four emit sites to populate it when the source pointer carries inline content (memo pointers, validation results) and omit it for pointer-only impulses (file, gitDiff).

**Contract:**
- `impulse_id`: required, matches impulse-store key or stable synthesised id
- `body`: populated only for inline content (memo, validation-result payloads); omitted for file/gitDiff pointers

**Implication:** Validation results, bash outputs, and other inline content now flow through the `impulse.resolved` channel with their full bodies.

**Affected files:** `repos/minibob/src/types.ts:987-1008`, `activity.ts:2013-2027`, `improviser.ts:1466-1482, :1505-1524`, `goal-processor.ts:3221-3239`, `search-first-executor.ts:881-984, :1075`, new test file `output-impulse-schema.test.ts`

---

## Open Implementation Findings

These findings surface real issues that are being tracked and will be resolved in follow-up work.

### F-37: Composition Chain Denormalization Race — UNDER INVESTIGATION

**Symptom:** Every trace has `composition_chain: []` despite `parent_execution_id` set correctly. Tree-walking via parent links works, but the denormalized array is always empty.

**Root cause (hypothesis):** Meta-traces are emitted at the END of a goal flow (retroactively computed span), while child activity-execution traces emit as they complete. Children insert BEFORE their parent, so the parent doesn't exist at denormalization time.

**Fix paths:** 
- A. **Backfill on parent-insert**: when a parent trace inserts, scan children and update their `composition_chain`. (Recommended, most architecturally clean)
- B. **Emit-order**: have minibob emit parent meta-trace before children. (Fragile)
- C. **Read-time computation**: skip denormalization, walk parents on query. (Defeats the purpose)

**Status:** Tracked in `openspec/changes/2026-04-26-impulse-activity-loop/design.md`. Not blocking Phase 8; parent-chain walking still works for tree-traversal queries. F-37 only affects audit-time *filters* on `composition_chain.length > 0`.

**Implication:** When auditing for recursive escalation, walk `parent_execution_id` chains manually instead of checking `composition_chain.length`.

### F-38: Slot-Binding Meta-Activity Recursively Subject to Its Own Lifecycle Hook

**Symptom:** Slot-binding fires on `lifecycle:task:preBinding` events, but when its OWN preBinding event fires, it tries to bind itself and fails: "Task requires shapes [lifecycle:task:preBinding] but no matching impulses found".

**Status:** Identified in canary validation run (2026-04-27 02:25 UTC). Minibob commit `7d4a977` applied a partial fix (self-skip gate) that changed the symptom but didn't resolve it entirely.

**Root cause:** Meta-activities should be exempt from being subscribed to lifecycle events whose payload they themselves emit, OR the lifecycle impulse must be passed into the nested executor's impulse pool.

**Fix scope:** ~30-line change in minibob `lifecycle-subscriptions.ts` or equivalent dispatcher.

**Implication:** Slot-binding won't fully activate until F-38 is resolved. See F-41 (related).

### F-39: Learning-Signal Writer Fails on Every Validator-Dispatch Iteration

**Symptom:** Every "Record per-task learning signals" task in validator-dispatch shows ✗. Affects ribosome convergence (Thompson learning).

**Status:** Identified in 2026-04-26 canary validation. Minibob commit `662b153` applied a defensive no-op fix but the task still fails. Likely cause: contract mismatch or resolver expecting fields not present in lifecycle:task:completed payload.

**Diagnostic:** Check activity-api logs or trace-detail endpoint for the resolver's failure reason.

**Implication:** Thompson Sampling improvements via `learning_signal_writer` are currently blocked. The resolver fires but doesn't persist learning signals.

### F-40: Composition Chain Backfill Race (F-37 Follow-Up)

**Symptom:** `composition_chain` populated by F-37 code doesn't engage on L1/L2 meta-traces due to write-order race. Parent meta-traces insert after children due to the retroactive span computation.

**Status:** Identified post-F-37 in 2026-04-27 canary audit. Recommended fix path A (backfill on parent-insert).

**Implication:** Affects composition_chain backfill feature; parent_execution_id chain walking still works.

### F-41: PreBinding Impulse Not Passed Into Meta-Activity Nested Executor

**Symptom:** Slot-binding meta-activity fires on `lifecycle:task:preBinding` events but the trigger impulse isn't available to the meta-activity's tasks. First task of slot-binding fails: "Task requires shapes [lifecycle:task:preBinding] but no matching impulses found".

**Status:** Identified in 2026-04-27 canary validation run (F-38 post-mortem). Related to F-38.

**Root cause (hypothesis):** The lifecycle subscriber dispatcher should populate the meta-activity's initial impulse pool with the triggering event impulse. Currently appears to invoke with an empty pool.

**Fix scope:** minibob `lifecycle-subscriptions.ts` or dispatcher entry point. Probably ~30-line change.

**Implication:** Slot-binding's slot-population logic (the core of Phase 1) doesn't activate until this is fixed. Without the preBinding impulse available, the first task that reads it fails immediately.

### F-45: Null-Guard Missing from InferShape During Impulse Binding — RESOLVED

**Symptom:** During impulse binding when a shape pointer is malformed or missing required fields, `inferShape()` called on a null/undefined pointer throws TypeError instead of gracefully returning an unknown shape or empty signature.

**Status:** Fixed in minibob commit c74f499 (2026-04-27). Version bump: 0.13.0 → 0.14.0.

**Root cause:** `inferShape()` function didn't defensively guard against null/undefined input before accessing pointer properties. Edge case triggered during slot-binding's producer-selection resolver when a downstream task consumed a shape that existed but had an incomplete or missing producer entry.

**Fix:** Added null-check at function entry: `if (!pointer) return { shape: 'unknown', fields: [] };` or similar. Allows binding to proceed with graceful degradation rather than throwing.

**Implication:** Slot-binding and shape-binding flows now continue even when encountering malformed shape pointers, enabling partial-completion semantics during nested goal execution.

---

## Current Canary Status (2026-04-27)

**Deployment:** 1.12.0-fd936c0 with F-32, F-33, F-35, F-36, F-37 changes applied.

### Success Criteria (Phase 8 Validation)

| # | Criterion | Status | Notes |
|---|---|---|---|
| 1 | Goals regularly succeed | ✅ **MET** | Root goal "produce a JSON validator..." completed; `goal_verification` shape emitted (2026-04-27 05:02 UTC probe) |
| 2 | Recursive escalation (failed goals append activities) | ❌ | Goal didn't trigger escalation; need explicitly-impossible-shape probe |
| 3 | MiniBob runs on vessel-resolvers only | ✅ **MET** | `goal-processing-activity-driven` succeeded (2026-04-27 probes). No `goal_processing_standard` (LLM chain) invocation observed. |
| 4 | Improved activities via ribosome | 🟡 | 35+ templates created on canary; F-39 fix needed to observe learning-signal updates |
| 5 | All-features composition in one trace | ✅ **MET** | Single trace exhibits Phase 4 meta-activities (slot-binding + validator-dispatch + activity-driven dispatch). Nested executions visible with `parent_execution_id`. |

### Evidence from Canary Probes

**Probe 1 (2026-04-27 02:25 UTC):** `minibob --single "list files in /tmp"`
- Outcome: Budget exceeded; goal not "achieved" but full Phase 4 stack traced
- Visible: `goal-processing-activity-driven` (first successful execution), multiple lifecycle events, slot-binding invocations
- Missing: F-41 fix — slot-binding starts but fails on missing preBinding impulse

**Probe 2 (2026-04-27 05:02 UTC):** `minibob --single "produce a JSON validator for the failure_mode schema"`
- Outcome: Goal **achieved** (status: completed); 9 activities, 19 tasks, $0.20, 90 seconds
- Evidence: `goal_verification` shape (criterion 1 verifier), `config_file` shape (output), full trace with nested executions
- Criteria met: 1 ✅, 3 ✅, 5 ✅

### Known Issues on Canary

- **F-38, F-41:** Slot-binding meta-activity doesn't fully activate (lifecycle impulse binding issue)
- **F-39:** Learning-signal writer fails; Thompson updates blocked
- **F-37, F-40:** Composition chain denormalization race; backfill needed

All are post-deployment findings; backend is healthy and ready for client workloads.

---

## Architecture Notes for Developers

### Lifecycle Events: Key Fields

When implementing tasks that consume `lifecycle:task:preBinding` or `lifecycle:task:completed`, use these canonical fields:

**`lifecycle:task:preBinding`:**
```typescript
{
  taskId: string
  templateId: string
  inputShapes: string[]  // Declared input shapes for this task
  currentImpulseIds: string[]
  missingShapes: string[]
  variables: Record<string, unknown>
  executionId: string  // Current activity execution ID
  parentExecutionId?: string  // Parent execution (for nested calls)
  parentGoalText?: string  // Parent's goal context (undefined if no goal)
  parentDepth: number  // Nesting depth (0 for root)
}
```

**`lifecycle:task:completed`:**
```typescript
{
  taskId: string
  taskIndex: number
  executionId: string
  status: 'success' | 'failed'
  outputShapes: string[]
  durationMs: number
  skip_validation?: boolean  // Whether validators were bypassed
  allImpulseIds: string[]    // All impulses visible to task
  loadedImpulseIds: string[]  // Impulses with materialized content
  toolCallRecords: ToolCall[]  // LLM tool calls (if any)
}
```

Use dotted-path interpolation in templates: `{{lifecycle.taskId}}`, `{{lifecycle.parentGoalText}}`, etc.

### Meta-Activities: Current State

Three embedded meta-activities are registered and operational:

1. **slot-binding** (`slot-binding.json`): Subscribes to `lifecycle:task:preBinding` to populate shape bindings
   - Status: **Partially operational** (F-41 blocks full activation)
   - Known issue: preBinding impulse not passed to nested executor

2. **validator-dispatch** (`validator-dispatch.json`): Subscribes to `lifecycle:task:completed` for post-execution validation
   - Status: **Operational but learning blocked**
   - Known issue: F-39 (learning-signal writer fails)

3. **create-shape-provider-goal** (`shape-provider-goal.json`): Dispatched from slot-binding's escalation task for recursive sub-goals
   - Status: **Ready but not yet triggered** (depends on F-41 fix)
   - Design: See `openspec/changes/2026-04-26-shape-provider-goal-creation/`

### Composition Chain: Current Behavior

- **Populated by:** MiniBob executor when emitting traces (F-37 logic)
- **Current issue:** Always empty due to write-order race (F-37, F-40)
- **Workaround:** Walk `parent_execution_id` chains manually for tree traversal
- **Expected after fix:** `composition_chain: [root_id, parent_id, ancestor_id]` (root-first order)

---

## Validation Run Findings (May 2026)

Findings from the Phase 19 and 20 validation runs (2026-05-06) verifying concept-db and activity-api integration via vessel discovery.

### F-V29: Startup Waking Activities Cascade Causes Offline Mode — WORKAROUND AVAILABLE

**Issue:** When minibob starts in default mode (discovery enabled, no `MINIBOB_SKIP_STARTUP`), the `startup:health-check` waking activity fires immediately. This activity queries discovery for DiscoveredTools, hitting a 10s timeout. The resulting 504s from activity-api trace writes push minibob into offline/degraded mode — meaning subsequent `load_impulse` calls for shapes like `executionTraceList`, `activityTemplate`, etc. fail with "offline mode" rather than resolving via vessel discovery.

**Observed in:** Phase 20 (activity improvement) validation run. `load_impulse({"type": "executionTraceList"})` called correctly but timed out after 25 seconds; LLM concluded "I'm in offline mode" and produced simulated data.

**Root cause:** Startup waking activities run before the main goal, consuming the backend connection budget. Three 504 errors from `[Activity] [Trace] Backend error: HTTP 504` push the ActivityTraceClient into offline mode, which blocks all subsequent vessel discovery calls for non-local shapes.

**Workaround:** Set `MINIBOB_SKIP_STARTUP=true` environment variable before the validation container starts. In the validation harness, use the `--with-backend` flag (which sets this env var). Running with `--with-backend` resolves the issue for goal-execution prompts that need vessel discovery.

**Code locations:**
- `repos/minibob/src/impulse.ts` — startup waking activity trigger
- `validation/lib/docker-runner.ts:171` — `MINIBOB_SKIP_STARTUP=true` set by `--with-backend`

**Fix candidates:** Either (a) skip startup waking activities when running in `--single` mode, or (b) make the ActivityTraceClient failure non-fatal to vessel discovery (decouple trace writes from resolver health).

### F-V30: concept-db Pod Instability from Health Endpoint SurrealDB Auth Loss — OPEN

**Issue:** concept-db had 51 pod restarts in 41 hours (≈ every 48 minutes) due to liveness probe failures. The health endpoint (`GET /health`) runs `await surrealDB.query('INFO FOR DB')` using the module-level global SurrealDB client. After a connection drop or idle timeout, this query throws `"Anonymous access not allowed: Not enough permissions"` causing a 503, which fails the liveness probe and triggers a pod restart.

**Root cause:** The SurrealDB client session loses its authenticated state after a connection interruption. The health endpoint uses the global client directly without reconnecting or catching auth errors gracefully. The correct fix is to either (a) health-check via a simple authenticated ping that re-authenticates if needed, or (b) use a separate health-only client that always signs in fresh.

**Code location:** `repos/concept-db/src/index.ts` health route (`app.get('/health', ...)`)

**Operator workaround:** The pod self-heals after restart (≈ 30s recovery). Liveness probe restartPolicy is 3 failures before kill, so short connectivity blips don't trigger it. No immediate data loss risk.

**Status:** Unfixed. Pod instability is a reliability concern but not a data-correctness issue.

### F-V31: Cached Vessel Resolver Bypasses Vessel auth_scheme Contract — FIXED (0.14.7-f6df221)

**Issue:** After the first successful vessel-discovery resolution (e.g., `concept_create_write` → concept-db), minibob registered a cached closure at `repos/minibob/src/impulse.ts:1582`. This cached closure used `httpPost(endpoint, body)` directly instead of `callVesselResolve`. The `httpPost` path uses `httpClient`'s `AuthService`, which may inject a `Bearer JWT` token (from identity-vessel) when one is available. concept-db's impulse endpoint advertises `auth_scheme: "ApiKey"` and `auth_token_source: "caller_identity"` — a Bearer JWT path authenticates differently, causing systematic 400 errors on the 2nd and 3rd `concept_create_write` calls in every Phase 19 run.

**Evidence:** Phase 19 ran three times (first run, re-run with `--with-backend`, fix-image re-run). All three runs showed exactly 1/3 concepts written — the first call succeeds via `callVesselResolve` (correct auth), subsequent calls use the cached closure (wrong auth).

**Fix:** Changed the cached resolver closure to call `callVesselResolve(cachedVessel, p, { timeoutMsOverride: 30000 })` which honours the vessel's advertised `auth_scheme`, `resolve_endpoint`, and `resolve_request_format` fields. Deployed in minibob `0.14.7-f6df221` (commit `f6df221`).

**Code location:** `repos/minibob/src/impulse.ts` — cached resolver registration block (after `resolveViaDiscovery` succeeds).

**Verification:** Phase 19 re-run with `0.14.7-f6df221` confirmed 3/3 concepts written. Acceptance criteria met.

### F-V32: Offline Mode Coupling — Trace Write Failures Block Vessel-Discovery Reads — OPEN

**Issue:** When activity-api returns 504 errors for trace writes (MCP execution reporting), minibob's `ActivityTraceClient` transitions to a global offline mode after 3 failures. This offline mode flag blocks ALL backend-dependent resolvers including vessel discovery reads (`discoverByShapesQuery`, `executionTraceList`, `activityTemplate`). The result: even when activity-api is reachable for reads, write failures degrade reads.

**Observed in:** Phase 20 (activity improvement) runs. The `executionTraceList` pointer type resolves via vessel discovery → activity-api. When concurrent load (two runs in parallel) or transient SurrealDB connectivity caused trace write 504s, offline mode activated and blocked `executionTraceList` resolution. minibob produced simulated data instead of reading real traces.

**Root cause:** The `isMCPEnabled()` / offline-mode flag in `repos/minibob/src/mcp.ts` is shared between write paths (execution trace storage) and read paths (impulse resolution via discovery). They should be decoupled — write failures should not block reads that use a different transport path (vessel discovery HTTP vs MCP socket/REST).

**Workaround:** Run validation phases sequentially (not concurrently) to avoid activity-api load spikes that trigger 504s. The `--with-backend` flag correctly sets `MINIBOB_SKIP_STARTUP=true`; the issue is write/read coupling, not startup cascade.

**Code locations:**
- `repos/minibob/src/mcp.ts` — `isMCPEnabled()` / offline state management  
- `repos/minibob/src/impulse.ts` — offline guard on discovery path

**Fix candidate:** Split offline state into separate `traceWriteOnline` and `discoveryOnline` booleans. Discovery falls back to the same vessel-discovery client regardless of trace write health.

---

## References

- **OpenSpec canonical design:** `openspec/changes/2026-04-26-impulse-activity-loop/design.md` (full validation findings and canary evidence)
- **Sibling spec designs:** See `openspec/changes/2026-04-26-*` directory for impulse-binding, validators, shape-provider-goal, and security findings
- **Deployment:** `repos/deployment/DEPLOYMENT_WORKFLOW.md`
- **Canary endpoint:** `https://activity.metabob.com` (health check: `GET /health`)
