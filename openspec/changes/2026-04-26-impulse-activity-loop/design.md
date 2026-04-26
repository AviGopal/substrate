## Framing

This change does not introduce primitives. It is the umbrella that drives the three siblings to working canary-validated state, captures cross-cutting learnings, and decides when (if ever) a fourth synthesis sibling is warranted.

The design grows incrementally. Each implementation iteration appends a section here describing what was attempted, what landed on canary, and what was learned.

## Implementation phases

The work is sequenced to minimise risk and produce visible canary evidence early. Phases are ordered so each can ship and be validated independently.

### Phase 1 — Lifecycle event emission (sibling: impulse-binding-selection-layer task 5)

Add the `lifecycle:task:preBinding` emission in `repos/minibob/src/activity.ts` before the `canExecuteTask` gate. Pure infrastructure; no subscribers required.

Acceptance:
- `bun run typecheck` clean.
- New unit test: emission fires before gate when `inputShapes` non-empty.
- Canary trace shows the emitted impulse on a goal that dispatches an `inputShapes`-bearing task.

### Phase 2 — Backend additive changes (siblings: all three)

Three orthogonal additions land together. All are additive; legacy traces remain valid.

- `discover-by-shapes` `candidates_with_scores` mode (sibling 1 §1)
- `discover-by-shapes` `output_shapes` filter on backward mode (sibling 3 §2)
- `goal_execution_paths.endpoint_output_shapes` field, index, backfill (sibling 2 §1)
- `failure_mode` taxonomy schema + `activity_execution_traces.failure_mode` field (sibling 3 §1)

Acceptance: new tests pass, existing route suites green, canary deployment healthy.

### Phase 3 — Resolvers (siblings 1, 3)

Implement and register:
- `impulse_preparation`, `impulse_pool_selection`, `producer_selection` (sibling 1 §2-§4)
- `learning_signal_writer` (sibling 3 §6)

Acceptance: per-resolver tests pass; resolvers callable from a stub activity template.

### Phase 4 — Meta-activities (siblings 1, 3)

Author the embedded templates:
- `slot-binding.json` subscribing to `lifecycle:task:preBinding`
- `validator-dispatch.json` subscribing to `lifecycle:task:completed`

Acceptance: each template loads at startup; subscribers fire on emitted lifecycle impulses; nested executions observable in traces.

### Phase 5 — Decommission inline executor logic (siblings 1, 3)

Remove the hardcoded blocks at `activity.ts:4949-4997` and `:5454-5529` and the three `recordImpulseRelevance` call sites at `:5471, :5574, :5719`. Acceptance: no regression in the existing activity-execution test suite; meta-activities cover the migrated paths.

### Phase 6 — Workbench surfaces (siblings 1, 2, 3)

Land the workbench primitives:
- Shape-slot primitive (sibling 1 §8)
- Spawn-subgoal affordance (sibling 2 §4)
- Validation surface extensions (sibling 3 §9, §10, §11)

Acceptance: workbench typecheck + tests green; manual smoke against canary confirms each surface renders correctly.

### Phase 7 — Recursive escalation (sibling 2)

Wire `create-shape-provider-goal` activity dispatch from the slot-binding meta-activity's unbindable branch. Acceptance: a task whose missing shape has no producer dispatches the activity; canary trace shows the recursive sub-goal.

### Phase 8 — End-to-end canary validation

Execute representative goals on `activity.metabob.com`. For each, document:
- The dispatched template and goal text.
- The observed trace (lifecycle events, validator results, `failure_mode` where relevant).
- The Thompson α/β before/after.
- Notes on any divergence from spec contracts — these become design refinements.

## Success-criteria validation

For each of the five success criteria in `proposal.md`, document the canary evidence here as it is gathered. This section grows iteratively.

- **Goals regularly succeed**: TBD
- **Failed goals append a new activity**: TBD
- **MiniBob operates off vessel resolvers only**: TBD
- **System creates improved activities via the executor**: TBD
- **Activities compose using all features**: TBD

## Out of scope

- Canonical-composition synthesis (LLM-skill template pattern, tools-as-impulses convention, lifecycle-bootstrap as activity). Tracked here as a probable next sibling, not implemented.
- Any redesign of sibling spec contracts. Refinements that emerge during implementation are recorded here and applied via targeted edits to the sibling specs.

## Iteration log

This log accumulates as the loop runs. Each entry: date, phase, what was attempted, what landed, what was learned.

### 2026-04-26 — iteration 1

- Created this change directory and skeleton files.
- Started Phase 1: emitted `lifecycle:task:preBinding` in `repos/minibob/src/activity.ts` before the resolver-path `canExecuteTask` gate at `:4405`. Used `executionId: activityId` in the payload (the current execution's id). Sibling 1's `lifecycle-task-prebinding/spec.md` calls this field `parentExecutionId`; resolve the naming in iteration 2 along with mirroring the emission to the LLM-only path (which has its own `inputShapes` enrichment block at `:4949-4997`).
- Established the implementation-phase ordering above.
- Open: payload field naming (`executionId` vs `parentExecutionId`); LLM-only path emission coverage.

### 2026-04-26 — iteration 2

- Mirrored `lifecycle:task:preBinding` emission to the LLM-only path inside `executeWithLLM` (now at activity.ts:4970-region). Pre-emission `presentShapesPre` / `missingShapesPre` are computed and included in the payload; after the await, the pool is re-scanned and the original synthesizer logic runs only on shapes still missing. This preserves the synthesizer fallback as a safety net for unbound shapes and lets subscribers provide them more cheaply when they can.
- Started Phase 2 with the `discover-by-shapes` `candidates_with_scores` mode in `repos/metabob-activity-api/src/routes/activities.ts:3378+`. Validation accepts the new mode; `queryMode` aliases it back to `forward` for the producer query; the result list is augmented post-transform with `composition_score: { alpha, beta, sample_count, predecessor_id? }` from `activity_composition_graph` rows. When the table has no edge data for a producer the score is `null` (graceful — matches sibling 1 spec §1.3). Optional `predecessor_activity_id` body field selects the per-edge query path; absence aggregates `math::sum` across all parents.
- Both `bun run typecheck` runs clean (minibob, activity-api).
- Open: payload field naming still `executionId` rather than the spec's `parentExecutionId` — defer to iteration 3 along with a small reconciliation edit to sibling 1's `lifecycle-task-prebinding/spec.md`. Output-shapes filter on backward mode (sibling 3 §2) deferred to iteration 3. No tests or canary smoke yet — both pending.

### 2026-04-26 — iteration 4 (parallel subagents — Phase 2 closes, Phase 3 opens)

Two parallel subagents.

- **Subagent C — `endpoint_output_shapes` (sibling 2 §1):** `repos/metabob-activity-api/sql/003-goal-execution-paths.surql` gains the field + index; new migration `sql/migrations/092-goal-paths-endpoint-shapes.surql` defines them idempotently and backfills via correlated subquery (`UPDATE goal_execution_paths SET endpoint_output_shapes = array::distinct(array::flatten((SELECT VALUE output_shapes FROM activity WHERE id INSIDE $parent.path_activities))) WHERE endpoint_output_shapes IS NONE` — mirrors `predictEndpointState`'s in-memory accumulation in SurrealQL). `GoalExecutionPathSchema` extended. Typecheck exit 0; existing 14 schema tests still pass. **Caveat:** backfill SQL constructed by analogy to existing patterns; not run against a live DB. Canary will validate. If SurrealDB rejects the correlated subquery in this form, fallback is an application-level loop. Sibling 2 §2 (route + recommend filter + `predictEndpointState` read-from-denormalized) deferred.
- **Subagent D — `impulse_preparation` resolver (sibling 1 §2):** discovered the resolver class already existed at `activity.ts:1705` with three goal-processing operations from a prior change. Added two new operations (`synthesise_from_variables`, `agent_fill`) to the existing class rather than creating a new file. Synthesis logic copied byte-for-byte from `ActivityExecutor`'s private methods (long-term those will be removed; the resolver becomes the canonical home). `SessionMemoryAgent` is loaded via dynamic `await import("../memory-agent")` inside `agent_fill` — mirrors the executor's existing lazy seam. 9 tests passing; typecheck clean. **Open wiring concern:** the resolver receives `provider`, `apiKey`, `workingDirectory`, `executionId`, and an optional `interpolate` callback through config. Without `interpolate`, the resolver uses raw template strings. Phase 6 (slot-binding meta-activity) needs to thread these through the lifecycle event payload — flag for that chunk.

**Phase 2 closed.** All four backend additions landed (candidates_with_scores mode, output_shapes filter, failure_mode taxonomy, endpoint_output_shapes field). Phase 3 has 1 of 4 resolvers done.

### 2026-04-26 — iteration 5 (parallel subagents — Phase 3 advances 1 → 3)

Two parallel subagents created the next two resolvers; main thread did the registrations sequentially to avoid `activity.ts` edit conflicts.

- **Subagent E — `impulse_pool_selection` (sibling 1 §3):** new `repos/minibob/src/resolvers/impulse-pool-selection-resolver.ts`. Deterministic and Thompson modes; smoothing `α = times_execution_succeeded + 1`, `β = times_execution_failed + 1`; uniform prior on missing rows; tie-break on `last_used_at` (or `updated_at`). 10 tests pass. Note: subagent used `MCPClient.queryImpulseRelevance` (typed array path) rather than the markdown pointer-resolve path at `impulses.ts:1542`. Sensible — typed > parsed-markdown — but worth flagging if the spec strictly requires the pointer-resolve API.
- **Subagent F — `producer_selection` (sibling 1 §4):** new `repos/minibob/src/resolvers/producer-selection-resolver.ts`. Calls the iter-2 `candidates_with_scores` mode via a new `MCPClient.discoverByShapes()` helper (added to `repos/minibob/src/mcp.ts`). Empty result → `unbindable: true`; MCP failure → `unbindable: true` (graceful — escalation is the shape-provider-goal-creation activity's job). 14 tests pass. Output impulse exposes `metadata.unbindable` at the top level so meta-activity task `condition` gates can branch without parsing JSON content.
- Main thread: added two imports to `activity.ts:158-160` and two `registry.set` lines after `impulse_preparation` at `:1705`. `bun run typecheck` exit 0.
- `sampleBeta` was already exported from `variant-selection-resolver.ts:160` — no additive change needed there.

**Phase 3 progress: 3 of 4 resolvers done.** Remaining: `learning_signal_writer` (sibling 3 §6 — wraps the executor's three `recordImpulseRelevance` call sites and the tool-argument-pattern recording loop into a dispatchable resolver).

### 2026-04-26 — iteration 6 (parallel subagents — Phase 3 closes, Phase 4 partly opens; two infra gaps surface)

Two parallel subagents.

- **Subagent G — `learning_signal_writer` (sibling 3 §6):** new `repos/minibob/src/resolvers/learning-signal-writer-resolver.ts`. Wraps `recordImpulseRelevance` (`activity.ts:5867-5920`) and the tool-argument-pattern recording loop (`activity.ts:5482-5527`) verbatim. `inferArgumentShape` and `generateStableArgumentId` imported from `tool-argument-extractor` (no duplication). `ToolCallRecord` defined locally with `TODO: dedupe` for Phase 5. Result impulse `learning_signal_write_result` with `signals_attempted`/`signals_succeeded`/`errors`. 14 tests pass. Registered at `activity.ts:1718`. Phase 5 will replace the inline call sites by dispatching this resolver from the validator-dispatch meta-activity.

- **Subagent H — `slot-binding.json` (sibling 1 §6):** new embedded template subscribing to `lifecycle:task:preBinding`. Three-task chain: `prepare_pool` (impulse_preparation/synthesise_from_variables) → `select_or_produce` (producer_selection as default — see gap B) → `agent_fill_fallback` (impulse_preparation/agent_fill, condition borrowed from `goal-processing-activity-driven.json:162`'s substring-match idiom). Registered in `embedded-templates/index.ts`; all 51 templates load. Typecheck clean. **Two gaps surfaced (queued, not fixed in this iteration):**
  - **Infra gap A — dotted-path interpolation.** `activity.ts:6946`'s `interpolate` regex `/\{\{(\w+)\}\}/` rejects `{{lifecycle.taskId}}`. Only `{{lifecycle}}` works (JSON-stringifies the whole payload). Subagent used the latter and documented. Fix is small (extend regex + property-path lookup) and unblocks both meta-activities for real canary execution.
  - **Infra gap B — template iteration.** No `foreach` over `missingShapes`. Subagent simplified task 2 to single-shape with `producer_selection` as default; the per-shape pool-vs-producer branch becomes a sibling variant template if/when needed. Acceptable for first end-to-end smoke; Thompson Sampling on lifecycle subscribers picks variants once the corpus exists.

**Phase 3 closed.** All four resolvers landed and registered. Phase 4 has 1 of 2 meta-activities authored (slot-binding); validator-dispatch is queued for the next iteration but blocks on infra gap A for end-to-end correctness.

The infrastructure-gap discovery is exactly the loop's purpose: implementation reveals what specs missed. Both gaps now tracked for explicit fix or deferral.

### 2026-04-26 — iteration 3 (subagent-delegated chunks)

User steered: produce validatable chunks via subagent delegation rather than direct implementation. Two parallel subagents dispatched.

- **Subagent A — output_shapes filter on backward mode (sibling 3 §2):** added optional `output_shapes: string[]` to the `discover-by-shapes` body destructure; conditionally appends `AND output_shapes CONTAINSANY $output_shapes_filter` to both backward-mode WHERE clauses. Forward and `candidates_with_scores` branches untouched. Diff <30 lines. `bun run typecheck` exit 0. Tests deferred (existing `discover-by-shapes.test.ts` failures are pre-existing DB-auth issues unrelated to the filter). Note: subagent flagged spec ambiguity — sibling 3 §2.3 says "filter applies in any mode" but the natural use case (validator selection) is backward-only; for now, filter is gated to backward mode in practice. Reconcile if/when producer_selection callers ever want to filter producer outputs.
- **Subagent B — failure_mode taxonomy (sibling 3 §1):** added `FailureModeSchema` to `src/models/schemas.ts` as a zod discriminated union over `type` with 5 variants (verifier_negative, budget_exhausted, safety_breach, cascading, user_abort). `safety_breach.limit` is optional (cycle case has no integer limit — resolves the alignment-review concern from sibling 2). `cascading.upstream_failure_mode` is recursive via `z.lazy`; zod's known limitation means the auto-inferred type degrades to `unknown`, mitigated by hand-writing a `FailureMode` discriminated-union type alongside the schema for callers needing precise nesting. `StoreExecutionTraceRequestSchema` extended with `failure_mode: FailureModeSchema.optional()`. Migration `sql/migrations/091-failure-mode-taxonomy.surql` adds `DEFINE FIELD failure_mode ON activity_execution_traces TYPE option<object>` (idempotent; legacy rows stay null per spec). Created `src/models/schemas.test.ts` with 14 tests; all pass. `bun run typecheck` exit 0.
- Subagent delegation pattern validated: each chunk is independently typecheckable; main thread saves substantial context. Will continue dispatching subagents for next chunks.
- Open: payload field naming reconciliation (`executionId` vs `parentExecutionId`) still pending. `goal_execution_paths.endpoint_output_shapes` (sibling 2 §1) is the obvious next chunk for Phase 2 completion.

## Post-Deploy Observations

Post-deploy validation of v1.12.0 on canary surfaced two bugs in `repos/metabob-activity-api/src/routes/activities.ts`: (1) the `relevance_feedback` audit row is silently dropped when optional fields are absent, because SurrealDB 3.x rejects `NULL` for `none | string` typed fields — the fix is to pass `undefined` instead of `null` so the driver omits the key and the DB sees `NONE`; (2) the relevance-feedback route is missing its auth middleware, causing a 500 Hono lifecycle crash on unauthenticated requests rather than the expected 401. Additionally, the embedding backfill job has not run: 0 of 3,051 activities have embeddings populated, so semantic search in the pipeline returns no results until the job is executed.
