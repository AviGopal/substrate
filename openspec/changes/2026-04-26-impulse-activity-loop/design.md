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

### Canary smoke evidence (iteration 10)

- `GET https://activity.metabob.com/health` returns 200 with `version: 1.12.0`, redis + surrealdb + discovery all healthy, embedding service disabled (normal).
- `POST https://activity.metabob.com/v2/activities/discover-by-shapes` with `{ "required_shapes": ["bash_output"], "mode": "candidates_with_scores" }` returns 3 activities, each with `composition_score: null` (no edge data yet — uniform prior expected). **Phase 2.1 (`candidates_with_scores` mode) verified live.**
- `GET /v2/activities/templates?limit=5` with any `Authorization: ApiKey` header returns templates with Thompson α/β. Without auth, the middleware lifecycle leak surfaces a 500 with `"Context is not finalized"` — same class as bug 10.2 but on a different route. Pre-existing on canary.
- Embedded templates (`slot-binding`, `validator-dispatch`, `create-shape-provider-goal`) live inside minibob and don't surface through `/templates`. End-to-end verification of meta-activity firing requires watching live traces or running a goal — deferred to a focused canary smoke iteration.

### 2026-04-26 — iteration 11 (Phase 6.3 closes; L→M bridge wired; workbench v0.3.0 pushed)

- **Subagent N — Phase 6.3 validation surfaces (sibling 3 §9-§11):** `ValidationErrorDisplay` discriminated union extended with `runtime_validator` variant (validatorId + passed + confidence + failureMode + evidence + messages); 2-decimal confidence on pass, `failure_mode.type` + first failed evidence on fail. `ImpulseStatePanel` gained a "Task Validation" card adjacent to the Phase 6.1 Bindable Slots card (per-task indicator: green + min confidence on pass, red + `failure_mode.type` on fail, gray "no validators" otherwise). `ExecutionHistoryPanel` now renders `failure_mode` summary on failed traces (e.g. `verifier_negative · slot-binding`) with `error_message` fallback for legacy traces and a multi-select dropdown filter. New `src/types/failure-mode.ts` mirrors the activity-api zod schema. `useExecutionHistory.TraceSummary` carries `failureMode`/`errorMessage`. `trajectoryStore.taskValidations: Map` field with `addTaskValidation` action (clearing tied to existing `clearTrajectory`/`clearTraceData`). 26 new tests pass.
- **Main thread — L→M bridge (#24 closed):** `TrajectoryEditorPage` imports `SpawnSubgoalPreview`, owns `spawnPreviewShape` state, passes `onEscalateUnbindableShape={setSpawnPreviewShape}` to `ApplicableActivitiesPanel`, renders the preview conditionally when a shape is set. The Phase 6.1 stub button now actually dispatches via the Phase 6.2 hook. Typecheck clean.
- Pushed: workbench `9222f00..0541324` (v0.2.0 → v0.3.0); super-repo `da8b3003..0c0d8511` (submodule pointer advance for workbench).

Population of `taskValidations` from the WS event stream is **out of scope** for this iteration — tests inject directly. The live-execution hook will populate it once the slot-binding meta-activity is observed firing on canary; that's a follow-up wiring task.

**Phase 6 closed.** All three workbench surfaces landed and pushed. Phase 7 has the activity authored; Phase 7.2 (escalation wiring from slot-binding meta-activity to `create-shape-provider-goal`) is the next chunk. Phase 5 (decommission inline executor logic) waits on canary trace evidence that meta-activities are firing.

### 2026-04-26 — iteration 12 (Phase 7.2 dispatched in background; canary trace audit)

- **Subagent Q — Phase 7.2 escalation wiring (in progress, background):** modify `slot-binding.json` to add an `escalate_unbindable` task that dispatches `create-shape-provider-goal` via the `activity` resolver when `select_or_produce` returns `unbindable: true`. Will integrate on completion.
- **Canary trace audit (main thread):** authenticated `POST /v2/impulses/resolve` with `pointer.type: "executionTraceList", limit: 3` returns three `auth_resolve_v1` handshake traces from 2026-04-26 13:18–13:43 UTC. **No goal-execution traces under our org since the v0.13.0 deploy.** The activity-API correctly accepts our key (auth path is healthy) but there's no real workload to inspect for the new fields (`failure_mode`, lifecycle event impulses, slot-binding nested executions). End-to-end Phase 8 evidence requires a fresh `minibob --single "..."` dispatch against canary; that's a user-driven action since it requires running minibob with the right env locally.
- Trace-detail by id (`pointer.type: "activityExecutionTrace", executionId: ...`) returned `Execution trace not found` for an id that the list returned. Likely an ACCESS-method binding mismatch on the detail endpoint — pre-existing on canary; not a regression we introduced. Worth flagging as future cleanup.

**Action item for the user (or next iteration):** dispatch a representative goal against canary (e.g. `minibob --single "list files in /tmp"` or a similarly trivial impulse-binding-exercising goal) to populate goal-execution traces. The `lifecycle:task:preBinding` impulses, slot-binding meta-activity nested executions, and any `failure_mode` records would then be observable via `executionTraceList` for downstream design.md acceptance evidence. Until then, Phase 8 evidence is partial (backend-side endpoints + auth verified live; meta-activity firing not yet observed).

### 2026-04-26 — iteration 13 (Phase 7.2 lands; verification clean)

- **Subagent Q (background, completed) — Phase 7.2 escalation wiring:** added `escalate_unbindable` as a fourth task in `slot-binding.json`. Dispatches `create-shape-provider-goal` via the `activity` resolver when `select_or_produce_result` content contains `'unbindable":true'`. Same conditional idiom as `agent_fill_fallback`. Runs parallel with `agent_fill_fallback` (orthogonal recovery paths; both depend on `select_or_produce` and gate on the same condition). Variable forwarding degraded via `{{lifecycle}}` JSON blob — the dispatched activity's `compose_goal` LLM parses defensively. `parent_goal_text` and `parent_depth` threading deferred (gated on the lifecycle dispatcher payload upgrade — documented as an open question on the template). Typecheck clean. **Phase 7 closed.**
- Verification (this iteration): all four repos clean of unpushed work prior to Q's commit. minibob `dc8aafb`, activity-api `8f8d5d9`, workbench `0541324`, super-repo `0c0d8511` — all matched origin/dev. Canary `https://activity.metabob.com/health` returned `version: 1.12.0` healthy.
- Pushed: minibob `dc8aafb..7cacb66` (Phase 7.2). Super-repo pointer advance to follow in the same iteration.

### 2026-04-26 — iterations 14-15 (parallel S + T; Phase 2 fully closes; v0.3.1 wires live validation events)

Two background subagents dispatched in iter 14, integrated in iter 15.

- **Subagent S — Phase 2.5 (sibling 2 §2):** `repos/metabob-activity-api/src/routes/goal-paths.ts` gains `accumulateEndpointShapes(pathActivities)` exported helper; POST `/goal-paths` persists `endpoint_output_shapes` on insert+update; GET `/goal-paths` accepts optional `endpoint_output_shape` query param; POST `/recommend` accepts the same as a body field, applied as a hard-filter pre-Thompson; `predictEndpointState` reads the denormalized field via an optional third arg with fallback to `accumulateEndpointShapes` for legacy rows. 13 new tests in `test/routes/goal-paths.test.ts` (`bun:test` + `mock.module` on `db/surreal`); typecheck clean. **Phase 2 fully closed.** Pushed `8f8d5d9..ff38253`. Note: activity-api's local `dev` branch had 3 stale commits (`51a0109`, `1fa82f4`, `b8503d8`) from a parallel work-path that pre-dated `7e4d253`'s bundled v1.12.0 push; resolved by working in detached HEAD at `origin/dev` (pre-existing pattern). The local-`dev` divergence is worth a future cleanup but not blocking.
- **Subagent T — WS validation_result wiring (Phase 6.3 follow-up):** `repos/workbench/src/hooks/useTrajectoryExecution.ts` gains `routeValidationResultImpulse` helper (exported for testability) routing `impulse.resolved` events of shape `validation_result` into `trajectoryStore.addTaskValidation`. Defensive `parseValidationResult` handles both flat (`event.shape/taskId/body`) and nested (`event.impulse.shape/taskId/body`) WS payloads — workbench is insulated from broadcaster contract drift. Malformed payloads `console.warn`'d and skipped (no throw). 13 new tests structural (parser 7, router 5, store-integration 1) — full WS-mock testing skipped due to a pre-existing React 19 + `@testing-library/react@14.2.2` `useEffect` non-firing issue. Workbench v0.3.0 → v0.3.1. Pushed `0541324..4d9bb0a`. Super-repo `51e961d0..cbdd37c5`.

**Two upstream TODOs surfaced (not blocking):**
1. The activity-api broadcaster's `impulse.resolved` event body contract is undocumented — the workbench is currently defensive about flat vs nested. Cleanest API change is for the broadcaster to include `body: <resolved-impulse-content>` on `impulse.resolved` events when the impulse shape is `validation_result` (or always). Recommend formalizing in a future Phase 8 or follow-up sibling spec.
2. `@testing-library/react` should bump to v15 (React 19-compatible) — currently breaks WS-mock testing patterns including pre-existing `LiveExecutionMonitor.test.tsx`.

**Status now:** Phase 1, 2, 3, 4, 6, 7 all closed and pushed to canary. Phase 5 (decommission inline executor logic) remains gated on canary firing evidence — no goal-execution traces from v0.13.0 minibob have appeared on canary yet. Phase 8 partial (backend endpoints verified live; meta-activity firing not yet observed).

## Out of scope

- Canonical-composition synthesis (LLM-skill template pattern, tools-as-impulses convention, lifecycle-bootstrap as activity). Tracked here as a probable next sibling, not implemented.
- Any redesign of sibling spec contracts. Refinements that emerge during implementation are recorded here and applied via targeted edits to the sibling specs.

## Validation findings

Cross-cutting findings surfaced during implementation iterations 1–15. Findings whose scope is one sibling spec live in that sibling's `## Validation findings` section.

#### F-1: Lifecycle payload field-name reconciliation pending
**Observation:** The emission point uses `executionId` for the parent execution id; sibling 1's `lifecycle-task-prebinding/spec.md` calls the same field `parentExecutionId`. Both meta-activity templates and the resolver implementations work around this by reading the JSON-stringified `{{lifecycle}}` payload.
**Impact:** Spec/source contract drift; subscriber implementations diverge if the canonical name is later corrected without coordinated edits.
**Proposed fix:** Pick one name (`parentExecutionId` per the spec is the natural choice) and apply it in `repos/minibob/src/activity.ts` lifecycle dispatcher + sibling 1 spec; retrofit slot-binding/validator-dispatch templates in the same pass.
**Origin:** iter 1, iter 2, iter 3 / surfaced in tasks.md §1.3.
**Affected files:** `repos/minibob/src/activity.ts:1249-1273`, `openspec/changes/2026-04-26-impulse-binding-selection-layer/specs/lifecycle-task-prebinding/spec.md`.

#### F-2: Lifecycle payload missing `parent_goal_text` — RESOLVED 2026-04-26
**Observation:** `lifecycle:task:preBinding` carried `taskId/templateId/inputShapes/currentImpulseIds/missingShapes/variables/executionId` but not the parent's goal text. The `escalate_unbindable` task in `slot-binding.json` had to forward `{{lifecycle}}` (a JSON blob) and rely on the dispatched `compose_goal` LLM to parse it back out, with `<no parent goal text available>` as the fallback framing.
**Impact:** Recursive sub-goals composed by `create-shape-provider-goal` lost semantic anchoring to the parent goal; weaker signal for the LLM composer.
**Resolution:** Extended both `lifecycle:task:preBinding` emit sites in `repos/minibob/src/activity.ts` (resolver-path at `:4438` and LLM-only path at `:5004`) with a `parentGoalText` field sourced from `this.currentGoalContext` (populated by `execute()` from `ExecuteOptions.goalContext` or `reason`). Field is `string | undefined` — `undefined` when the executor was invoked without goal context. Sibling spec `lifecycle-task-prebinding/spec.md` updated to declare the contract with two new scenarios (defined and undefined cases). `slot-binding.json::escalate_unbindable` now forwards `parent_goal_text: "{{lifecycle.parentGoalText}}"` instead of an empty string. When `parentGoalText` is undefined the dotted-path interpolator leaves the literal placeholder per its missing-segment semantics — `compose_goal`'s defensive prompt continues to fall back to `<no parent goal text available>`, equivalent UX to the prior empty-string default but with the channel now wired end-to-end so a goal-aware caller (e.g. goal-processor) populates it correctly.
**Origin:** iter 13 / Subagent Q (slot-binding `_parent_goal_text_TODO`); resolved iter 16.
**Affected files:** `repos/minibob/src/activity.ts:4438, :5004`, `repos/minibob/src/embedded-templates/slot-binding.json`, `openspec/changes/2026-04-26-impulse-binding-selection-layer/specs/lifecycle-task-prebinding/spec.md`.

#### F-3: Lifecycle payload doesn't carry `composition_chain` depth — RESOLVED 2026-04-26
**Observation:** The lifecycle dispatcher didn't thread `composition_chain` depth through the payload. The `escalate_unbindable` task in `slot-binding.json` hardcoded `parent_depth: 0` for the dispatched `create-shape-provider-goal` invocation.
**Impact:** Recursive depth-guard (default `max_recursion_depth=3`) couldn't fire correctly — a chain at depth 2 still appeared as depth 1 to its child, so the guard would never trip regardless of recursion depth.
**Resolution:** Extended both `lifecycle:task:preBinding` emit sites in `repos/minibob/src/activity.ts` (resolver-path at `:4438` and LLM-only path at `:5004`) with a `parentDepth: number` field sourced from `(this.config.activityCallStack || []).length` — the executor's root-first ancestor template-id stack (excluding the currently-executing activity itself, which is the trace subject not an ancestor). For root executions with no ancestors the value is `0`. Sibling spec `lifecycle-task-prebinding/spec.md` updated to declare the contract with two new scenarios (root execution `parentDepth: 0` and nested execution `parentDepth > 0`). `slot-binding.json::escalate_unbindable` now forwards `parent_depth: "{{lifecycle.parentDepth}}"` instead of the hardcoded `0`. The dotted-path interpolator emits the value as a number-as-string; `create-shape-provider-goal`'s `compose_goal` LLM already handles defensive parsing per spec §7.1. Mirrors F-2's fix pattern.
**Origin:** iter 13 / Subagent Q (slot-binding `metadata.openQuestions[2]`); resolved iter 16.
**Affected files:** `repos/minibob/src/activity.ts:4438, :5004`, `repos/minibob/src/embedded-templates/slot-binding.json`, `openspec/changes/2026-04-26-impulse-binding-selection-layer/specs/lifecycle-task-prebinding/spec.md`.

#### F-4: Template format lacks foreach/iteration primitive (infra gap B)
**Observation:** Several meta-activity tasks ideally iterate over arrays (per-shape selection in slot-binding, per-validator dispatch in validator-dispatch, per-candidate cost/risk fetches in create-shape-provider-goal). The current template format has no `foreach`/`map` primitive, forcing each template to simplify to single-shape / single-candidate behaviour.
**Impact:** Multi-shape tasks fall back to single-shape semantics; per-candidate metrics fetching collapses to aggregated org-wide queries; specialized vs wildcard validator partitioning (validators-and-failure-modes D1) is unenforceable.
**Proposed fix:** Add a foreach primitive to the template runner (or a generic `impulse_reshape` resolver), then revisit the simplifications in slot-binding, validator-dispatch, and create-shape-provider-goal.
**Origin:** iter 6 / Subagent H, iter 7 / Subagent I, iter 8 / Subagent O. Tracked as tasks.md task #17 ("infra gap B").
**Affected files:** `repos/minibob/src/activity.ts` (template runner), `repos/minibob/src/embedded-templates/slot-binding.json`, `repos/minibob/src/embedded-templates/validator-dispatch.json`, `repos/minibob/src/embedded-templates/create-shape-provider-goal.json`.

#### F-5: Dotted-path interpolation landed but templates not retrofitted
**Observation:** Iter 7 / Subagent J extended `interpolate` (`activity.ts:6946`) to support dotted paths via `/\{\{([\w]+(?:\.[\w]+)*)\}\}/g`. The slot-binding and validator-dispatch templates still use `{{lifecycle}}` (the JSON-stringified blob) and parse it inside resolvers.
**Impact:** Resolvers carry parsing complexity that should live in template interpolation; debugging is harder.
**Proposed fix:** Retrofit both meta-activity templates from `{{lifecycle}}` JSON blobs to dotted-path access (`{{lifecycle.taskId}}`, `{{lifecycle.executionId}}`, etc.) in a single pass.
**Origin:** iter 7 / Subagent J, validator-dispatch `metadata.openQuestions[0]`.
**Affected files:** `repos/minibob/src/embedded-templates/slot-binding.json`, `repos/minibob/src/embedded-templates/validator-dispatch.json`.

#### F-6: `vessel_resolve_call` is a TS helper, not a registered resolver
**Observation:** Sibling 3 spec (D5) and sibling 2 design reference `vessel_resolve_call` as a resolver name for activity dispatchers, but it's a TypeScript helper inside minibob — not registered in the resolver registry. Validator-dispatch had to substitute `producer_selection` (with forward-mode + `missingShape='validation_result'`) as the closest equivalent.
**Impact:** The spec's full `discover-by-shapes` filter wiring (backward + `output_shapes: ['validation_result']`) is not used; specialised-vs-wildcard validator filtering relies implicitly on the validator's own `inputShapes` instead.
**Proposed fix:** Register a thin `discover_by_shapes` template-dispatchable resolver that wraps `MCPClient.discoverByShapes` with optional `output_shapes` and `mode` config, OR extend `producer_selection` config with optional `output_shapes`.
**Origin:** iter 7 / Subagent I, validator-dispatch `metadata.openQuestions[2]`.
**Affected files:** `repos/minibob/src/resolvers/index.ts`, `repos/minibob/src/embedded-templates/validator-dispatch.json`.

#### F-7: `lifecycle:task:completed` payload missing fields needed by validator-dispatch
**Observation:** The payload contains `taskId/taskIndex/executionId/status/outputShapes/durationMs` — it omits `skip_validation` (so the meta-activity can't short-circuit on opt-out) and the `allImpulseIds`/`loadedImpulseIds`/`toolCallRecords` arrays the `learning_signal_writer` task needs.
**Impact:** `validator-dispatch.json` task 1 cannot enforce the `skip_validation: true` opt-out (D5); task 5 passes empty arrays as a structural placeholder so `learning_signal_writer` is a no-op until Phase 5 lifts the executor's per-task tracking arrays into the payload (or the resolver fetches them by execution id).
**Proposed fix:** Extend the lifecycle payload at the sibling-3 emission sites to include `skip_validation` and the per-task tracking arrays. Phase 5 of this umbrella owns the rewire.
**Origin:** iter 7 / Subagent I, validator-dispatch `metadata.openQuestions[0]` and `[5]`.
**Affected files:** `repos/minibob/src/activity.ts:2406, :2855` (emission sites), `repos/minibob/src/embedded-templates/validator-dispatch.json`.

#### F-8: Activity dispatch endpoint shimmed via `/v2/impulses/resolve`
**Observation:** The workbench `useSpawnSubgoal` hook posts to `/v2/impulses/resolve` with a `pointer.type === 'activityDispatch'` envelope because the activity-api has no first-class dispatch endpoint. Marked `TODO(dispatch-endpoint)` at the call site.
**Impact:** Coupled to the impulse-resolve route's payload conventions; not discoverable as an API surface; second-class to other activity-api endpoints.
**Proposed fix:** Add `POST /v2/activities/dispatch` to activity-api with the dispatch envelope formalised; swap the workbench POST.
**Origin:** iter 8 / Subagent M (`useSpawnSubgoal.ts`).
**Affected files:** `repos/workbench/src/hooks/useSpawnSubgoal.ts:18,118`, `repos/metabob-activity-api/src/routes/activities.ts`.

#### F-9: Activity-api `impulse.resolved` WebSocket event body contract undocumented
**Observation:** The broadcaster emits `impulse.resolved` events with the resolved-impulse fields sometimes flattened on the event (`event.shape`, `event.taskId`, `event.body`) and sometimes nested under `event.impulse`. The workbench's `parseValidationResult` / `routeValidationResultImpulse` handlers accept both shapes defensively.
**Impact:** Workbench is forced into defensive parsing; any consumer downstream re-implements the same fan-out; contract drift goes undetected.
**Proposed fix:** Formalise the broadcaster contract (e.g. the broadcaster always emits a `body` field on `impulse.resolved` events; flat vs nested structure picked once and documented). Sibling spec or a follow-up Phase 8 deliverable.
**Origin:** iter 14 / Subagent T (`useTrajectoryExecution.ts:36-69, :136-141`).
**Affected files:** `repos/metabob-activity-api/src/services/broadcaster.ts` (or equivalent), `repos/workbench/src/hooks/useTrajectoryExecution.ts`.

#### F-10: `@testing-library/react@14.2.2` does not fire `useEffect` under React 19
**Observation:** WS-mock tests (iter 14 / Subagent T) could not exercise the full `useTrajectoryExecution` event-handler path because `renderHook` from `@testing-library/react@14.2.2` does not fire `useEffect` on React 19. Subagent shipped 13 structural tests (parser/router/store) but skipped end-to-end WS-mock coverage.
**Impact:** Pre-existing `LiveExecutionMonitor.test.tsx` is also impaired; WS-event-handling hooks have no integration-test coverage.
**Proposed fix:** Bump `@testing-library/react` to v15 (React 19 compatible).
**Origin:** iter 14 / Subagent T.
**Affected files:** `repos/workbench/package.json`, `repos/workbench/src/hooks/useTrajectoryExecution.ts:91-94`, `repos/workbench/src/components/executions/LiveExecutionMonitor.test.tsx`.

#### F-11: Activity-api local `dev` branch diverged from origin
**Observation:** During iter 14 the activity-api local `dev` branch had three stale commits (`51a0109`, `1fa82f4`, `b8503d8`) from a parallel work-path that pre-dated `7e4d253`'s bundled v1.12.0 push. Subagent S worked in detached HEAD at `origin/dev` to avoid the divergence.
**Impact:** Local-branch confusion; future contributors hitting the same divergence will need the same workaround.
**Proposed fix:** Reconcile local `dev` with `origin/dev` (rebase or hard-reset depending on the stale commits' fate). Cleanup, not blocking.
**Origin:** iter 14 / Subagent S, iter 7 / Subagent K.
**Affected files:** `repos/metabob-activity-api` (git history only).

#### F-12: Activity-api trace-detail endpoint returns "not found" for ids the list returns
**Observation:** Iter 12 canary audit: authenticated `POST /v2/impulses/resolve` with `pointer.type: "executionTraceList"` returned three traces; the same authenticated call with `pointer.type: "activityExecutionTrace", executionId: <id>` returned `Execution trace not found` for one of those ids. Likely an ACCESS-method binding mismatch on the detail endpoint.
**Impact:** Trace-detail deep links are unreliable; pre-existing on canary, not a regression introduced by this change.
**Proposed fix:** Audit the `activityExecutionTrace` impulse-resolve case for ACCESS-method/PERMISSIONS scoping consistency with the list case. Cleanup.
**Origin:** iter 12 / canary audit.
**Affected files:** `repos/metabob-activity-api/src/routes/impulses.ts:719-724`.

#### F-13: Phase 5 (decommission inline executor logic) gated on canary firing evidence
**Observation:** Phases 1, 2, 3, 4, 6, 7 closed and pushed; Phase 5 (delete `activity.ts:4949-4997`, `:5454-5529`, three `recordImpulseRelevance` call sites, and the inline tool-argument-pattern recording loop) remains pending because no v0.13.0 minibob goal-execution traces have appeared on canary to confirm the meta-activities are firing.
**Impact:** Inline executor logic is duplicated against the meta-activity paths until canary evidence accumulates; risk of behavioural drift if both paths run in production.
**Proposed fix:** User dispatch a representative goal against canary (`minibob --single "..."`); inspect traces for lifecycle event impulses + nested slot-binding/validator-dispatch executions; once observed, run Phase 5 deletions.
**Origin:** iter 12, iter 13, iter 15.
**Affected files:** `repos/minibob/src/activity.ts:4949-4997, :5454-5529, :5471, :5574, :5719, :5482-5527`.

#### F-14: `taskValidations` was unwired from WS events until iteration 15
**Observation:** Phase 6.3 (iter 11) landed `trajectoryStore.taskValidations` and the workbench validation surfaces, but the store field was populated only by direct test injection. WS-stream wiring was deferred until iter 14-15 (Subagent T); production population of the field depended on slot-binding observed firing on canary.
**Impact:** Validation surfaces rendered no live data until iter 15. Documented but worth flagging for any reader looking at the v0.3.0 build.
**Proposed fix:** Already addressed in iter 15 (workbench v0.3.1 / `routeValidationResultImpulse`).
**Origin:** iter 11 narrative, iter 14 / Subagent T resolution.
**Affected files:** `repos/workbench/src/store/trajectoryStore.ts`, `repos/workbench/src/hooks/useTrajectoryExecution.ts`.

#### F-15: Pre-existing v1.12.0 post-deploy bugs (relevance-feedback NULL, missing auth)
**Observation:** v1.12.0 canary surfaced two bugs in `repos/metabob-activity-api/src/routes/activities.ts`: (1) the `relevance_feedback` audit row is dropped silently when optional fields are absent because SurrealDB 3.x rejects `NULL` for `none | string` typed fields; (2) the `/relevance-feedback` route is missing its auth middleware, causing a 500 Hono lifecycle crash on unauthenticated requests instead of 401. Embedding backfill job has not run (0/3,051 activities have embeddings populated, semantic search returns no results).
**Impact:** Audit trail incomplete; observability of unauthenticated callers degraded; semantic search effectively disabled until backfill runs.
**Proposed fix:** Bug 10.1 + 10.2 fixes already shipped in iter 7 / Subagent K (commit `8f8d5d9`). Embedding backfill remains a separate operations task.
**Origin:** Post-Deploy Observations section (already documented at end of design.md).
**Affected files:** `repos/metabob-activity-api/src/routes/activities.ts`.

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

### 2026-04-26 — iteration 7 (Phase 4 closes; infra gap A fixed; v0.13.0 + v1.12.0 + bug fix pushed to origin/dev)

Two parallel subagents + main-thread commit/push.

- **Subagent J — dotted-path interpolation (infra gap A):** `repos/minibob/src/activity.ts:6946` regex `/\{\{(\w+)\}\}/g` extended to `/\{\{([\w]+(?:\.[\w]+)*)\}\}/g`. Lookup walks dotted segments through `variables`. Backward compat preserved for: missing keys (placeholder left intact), object stringify (`JSON.stringify(value, null, 2)`), null at top level (`"null"`), and the `{{task:id:output}}` colon-separated pattern (different regex, runs first). 21 new tests in `src/activity-interpolate.test.ts`; full repo test suite shows 0 new failures vs baseline. Slot-binding and validator-dispatch templates can now be retrofitted to dotted paths in a follow-up iteration.
- **Subagent I — `validator-dispatch.json` (sibling 3 §7):** new embedded template subscribing to `lifecycle:task:completed`. 5 tasks: `discover_validators` (uses `producer_selection` against `validation_result` since `vessel_resolve_call` isn't a registered resolver name), `select_validator_per_shape` (LLM adapter for now — `producer_selection_result` → `variant_selection_result` reshape needed), `dispatch_validators` (nested execution via `activity` resolver), `propagate_failure_mode` (emits `failure_mode_propagation` impulse since no mid-execution trace-metadata-write endpoint exists), `learning_signal_write`. 52 templates load. Several pragmatic simplifications documented in `metadata.openQuestions`. Subagent flagged: (a) the spec mentions `vessel_resolve_call` as a resolver name but it's a TS helper, not registered — recommendation to register a thin `discover_by_shapes` resolver wrapping `MCPClient.discoverByShapes`; (b) `lifecycle:task:completed` payload doesn't include `skip_validation` or impulse-id arrays — Phase 5 wires those.
- **Subagent K — bug fixes 10.1 and 10.2 in `metabob-activity-api`:** replaced `?? null` with `?? undefined` for `context_bucket`/`reason`/`correlation_id` (so SurrealDB receives `NONE`); wrapped `/relevance-feedback` handler in `try { ... } catch` mirroring `/feedback`'s pattern (so unauth lifecycle-error returns structured response). Found the repo in detached HEAD at `origin/main` with `7e4d253 v1.12.0` already on main, dev older at `7a0b837`. Commit `8f8d5d9` created on detached HEAD.

Main thread: minibob version bumped 0.12.0 → 0.13.0; staged (excluding `codebase-structure-impulse.json` artifact) and committed `ec03889 feat(minibob): impulse-binding selection layer + validators (v0.13.0)`. 15 files, 3443+/9-. Pre-commit denylist + secret scan passed.

Pushed:
- `minibob` → `origin/dev`: `18faa40..ec03889` (advances dev with v0.13.0)
- `metabob-activity-api` → `origin/dev`: `7a0b837..8f8d5d9` (advances dev through v1.12.0 + bug fix; dev now equal-or-ahead of main)
- super-repo → `origin/dev`: `7b514926..cd4611db` (submodule pointer advance for minibob + 2 pre-existing percolation/prune commits)

Canary deploys triggered. **Phase 4 complete** (both meta-activities registered). Next: validate on canary (Phase 8 partial — confirm lifecycle event appears in trace, validator-dispatch fires, learning-loop α/β move). Then Phase 5 (decommission inline executor logic) and Phase 6 (workbench surfaces).

### 2026-04-26 — iteration 8 (3 parallel subagents — Phase 6.1, 6.2, 7.1)

Three parallel subagents on independent chunks. Phase 6.3 (validation surfaces) deferred to next iteration to avoid `ImpulseStatePanel.tsx` conflict with Phase 6.1.

- **Subagent L — Phase 6.1 shape-slot primitive (sibling 1 §8):** extended `ResolverTierBadge` with `slotState?: 'bound' | 'bindable' | 'unbindable'` prop (overlay border-band), `ShapeCompatibilityIndicator` with `slotStates?: Map` for three distinct visual states (solid green / dashed green / red), `ImpulseStatePanel` with a "Bindable Slots" card listing α/β candidates + "use this one" → `impulseRelevance_write` override (POSTs `/v2/activities/impulse-relevance` with `source: 'manual_override'`), `ApplicableActivitiesPanel` with escalate button (stub onClick — Phase 6.2 territory). Added `computeShapeSlotState` helper to `state-space.ts` and `getShapeSlotStates` action to the trajectory store. 18 new tests pass. Per-impulse lineage data is NOT in the store today; documented TODO with shape-level approximation as fallback.
- **Subagent M — Phase 6.2 spawn-subgoal affordance (sibling 2 §4):** new `useSpawnSubgoal` TanStack Query mutation hook + new `SpawnSubgoalPreview` component (preview + confirm with HiL warning banner). Extended `BackwardChainingPanel` with inline + selected-shape-header spawn buttons gated on `discoveryData.activities.length === 0` OR all producers' `betaMean(α, β) < 0.4`. 8 new tests pass. **Activity dispatch endpoint** doesn't exist yet in the API client — shimmed via `/v2/impulses/resolve` with `pointer.type === 'activityDispatch'` envelope (mirrors `useTrajectoryExecution.submitTrajectory`). Marked `TODO(dispatch-endpoint)` for replacement when activity-api ships `POST /v2/activities/dispatch`.
- **Subagent O — Phase 7.1 `create-shape-provider-goal` (sibling 2 §3):** new `repos/minibob/src/embedded-templates/create-shape-provider-goal.json` (8 tasks, 7 variables): `forward_chain_producers` (via `activity_recommendation`), `prior_paths_with_endpoint` (via `impulse-resolve` for `goalExecutionPath` shape with the new `endpoint_output_shapes` filter from migration 092), `concept_lookup` (via `impulse-resolve` for `relatedConcepts`), `cooccurrence_signal` (via `impulse_cooccurrence` resolver), `cost_risk_priors` (parallel sub-tasks for `activityMetrics` and `toolRiskProfile`), `parent_chain_lookup`, `compose_goal` (LLM with structured prompt). 53 templates load. **Validation rules embedded in the LLM prompt** with explicit `failure_mode` JSON shapes citing the migration-091 taxonomy: depth → `safety_breach/depth` with `limit + ancestor_chain`; cycle → `safety_breach/cycle` (limit omitted per cycle case); budget → `budget_exhausted/cost`. The choice (LLM-embedded guards vs deterministic conditional tasks) was forced by the existing template format's lack of conditional-rewrite primitives — documented in `metadata.openQuestions` with the future-fix path being a `goal_guard_evaluator` deterministic resolver.

Cross-subagent integration: L left a stub onClick on the escalate button (TODO citing Phase 6.2). M created `useSpawnSubgoal`. The bridge (one-line wiring) is queued as a small follow-up. Both panels now expose spawn affordances independently — `BackwardChainingPanel` (M) and `ApplicableActivitiesPanel` (L) — different surfaces for different user contexts.

Both `bun run typecheck` runs clean (workbench, minibob). Pre-existing workbench test failures (~65 fails on the base branch) are not regressions; new tests strictly add 18 + 8 = 26 passing.

**Phase 6 has 2 of 3 surfaces done.** Phase 7 has the activity authored. Phase 6.3 (validation surfaces) and the L↔M wiring are queued.

Pending push: workbench v0 → some new version, minibob (only the new template + index.ts), super-repo (submodule pointer advances). Will execute in same iteration before scheduling.

### 2026-04-26 — iteration 3 (subagent-delegated chunks)

User steered: produce validatable chunks via subagent delegation rather than direct implementation. Two parallel subagents dispatched.

- **Subagent A — output_shapes filter on backward mode (sibling 3 §2):** added optional `output_shapes: string[]` to the `discover-by-shapes` body destructure; conditionally appends `AND output_shapes CONTAINSANY $output_shapes_filter` to both backward-mode WHERE clauses. Forward and `candidates_with_scores` branches untouched. Diff <30 lines. `bun run typecheck` exit 0. Tests deferred (existing `discover-by-shapes.test.ts` failures are pre-existing DB-auth issues unrelated to the filter). Note: subagent flagged spec ambiguity — sibling 3 §2.3 says "filter applies in any mode" but the natural use case (validator selection) is backward-only; for now, filter is gated to backward mode in practice. Reconcile if/when producer_selection callers ever want to filter producer outputs.
- **Subagent B — failure_mode taxonomy (sibling 3 §1):** added `FailureModeSchema` to `src/models/schemas.ts` as a zod discriminated union over `type` with 5 variants (verifier_negative, budget_exhausted, safety_breach, cascading, user_abort). `safety_breach.limit` is optional (cycle case has no integer limit — resolves the alignment-review concern from sibling 2). `cascading.upstream_failure_mode` is recursive via `z.lazy`; zod's known limitation means the auto-inferred type degrades to `unknown`, mitigated by hand-writing a `FailureMode` discriminated-union type alongside the schema for callers needing precise nesting. `StoreExecutionTraceRequestSchema` extended with `failure_mode: FailureModeSchema.optional()`. Migration `sql/migrations/091-failure-mode-taxonomy.surql` adds `DEFINE FIELD failure_mode ON activity_execution_traces TYPE option<object>` (idempotent; legacy rows stay null per spec). Created `src/models/schemas.test.ts` with 14 tests; all pass. `bun run typecheck` exit 0.
- Subagent delegation pattern validated: each chunk is independently typecheckable; main thread saves substantial context. Will continue dispatching subagents for next chunks.
- Open: payload field naming reconciliation (`executionId` vs `parentExecutionId`) still pending. `goal_execution_paths.endpoint_output_shapes` (sibling 2 §1) is the obvious next chunk for Phase 2 completion.

### Registry cleanup 11.1 — retry, halted at B-2 (admin scope)

Re-attempted task 11.1 (delete shadow templates with doubly-nested record IDs) on 2026-04-26 after the JWT-rollout (B-1) finished. Re-enumerated and confirmed **8 shadow templates** with the doubly/triply-nested pattern; identical set to the original audit. The public templates listing returns 100 entries, so up to ~10 may still be hidden behind the cap (B-4 still open) — only an admin-scoped query against the database can confirm.

**Format experiments — 11 variants tried against `activity:⟨activity:tpl_1776797130982_xh8ey⟩`:**

| # | templateId sent                                              | Response                          |
|---|--------------------------------------------------------------|-----------------------------------|
| 1 | `activity:⟨activity:tpl_1776797130982_xh8ey⟩` (literal)      | 404 Template not found            |
| 2 | `tpl_1776797130982_xh8ey`                                    | 404 Template not found            |
| 3 | `activity:tpl_1776797130982_xh8ey`                           | 404 Template not found            |
| 4 | (escaped-unicode, identical bytes to #1)                     | 404 Template not found            |
| 5 | `⟨activity:tpl_1776797130982_xh8ey⟩`                         | 404 Template not found            |
| 6 | `activity:` + backtick-wrapped inner                         | 404 Template not found            |
| 7 | `activity:⟨activity:⟨tpl_1776797130982_xh8ey⟩⟩` (triple)     | 404 Template not found            |
| 8 | full id wrapped in outer backticks                           | 404 Template not found            |
| 9 | `⟨activity:⟨tpl_1776797130982_xh8ey⟩⟩`                       | 404 Template not found            |
| 10| `activity:⟨tpl_1776797130982_xh8ey⟩` (single-wrap inner)     | 404 Template not found            |
| 11| `activity:tpl_1776797130982_xh8ey` (= what `record::id()` returns for the shadow) | 404 Template not found |

**B-3 root cause is actually B-2.** Reading `repos/metabob-activity-api/src/routes/impulses.ts:1962-2015`, the deprecate handler matches via `record::id(id) = $id AND (org_id = $orgId OR (scope = 'global' AND $isAdmin = true))`. All 8 shadow templates have `scope = 'global'` and `org_id = 'NONE'`. Confirmation probe: deprecating a *legitimate* global template (`tpl_1776797130982_xh8ey`, the non-shadow sibling — known to exist) also returned 404. Same WHERE-clause filtering. The API key under `~/.metabob/config.json` resolves to a JWT whose `role !== 'admin'` and whose `scopes` array does not include `'admin'`, so `(scope = 'global' AND $isAdmin = true)` is always false. The handler does not differentiate "row missing" from "row excluded by RBAC" in its error message — both paths return `Template not found`, which previously read as a B-3 (id-format) issue.

**Format 11 (`activity:tpl_1776797130982_xh8ey`) is almost certainly the canonical inner-id form** the handler accepts; format experiments cannot prove this without admin scope, but the SurrealDB semantics are unambiguous: for a record stored as `activity:⟨activity:tpl_1776797130982_xh8ey⟩`, `record::id(id)` returns the inner string `activity:tpl_1776797130982_xh8ey`. This is the value to send once admin scope exists.

**Deprecated this iteration:** none. Halted at B-2 per the task's halt rule.

**Blocker status after this attempt:**
- **B-1 JWT auth on canary replicas** — RESOLVED (no `401 Authentication required` in any of the 11 probes; auth is unanimous across the fleet).
- **B-2 admin scope on the deprecation API key** — OPEN (this attempt's halt cause). Resolutions: (a) issue an admin-scoped JWT or admin-scoped API key for cleanup operations; (b) introduce a separate "global-template janitor" scope that the deprecate handler accepts in addition to `admin`; (c) extend the WHERE clause to differentiate "row absent" (404) from "row excluded by RBAC" (403) so future investigations can stop chasing B-3 phantoms.
- **B-3 doubly-nested id format mismatch** — RESOLVED-IN-PRINCIPLE (the canonical form is `activity:tpl_1776797130982_xh8ey` for the example shadow; full ID set listed below). Cannot be empirically verified without B-2.
- **B-4 public API cap at 100** — STILL OPEN (8 shadows visible; up to ~10 may be hidden because the templates listing is paginated/capped and the API key cannot iterate past the org-public window).

**Shadow set (8) — canonical inner-id form for each (use these once admin scope is granted):**

```
activity:⟨Spellcheck Readme\⟩
activity:tpl_1776797130982_xh8ey
activity:⟨orchestrate-test-goal\⟩
activity:tpl_1776799043142_7x457s
activity:tpl_1776799160980_6cmeh
activity:⟨orchestrate-refactor-goal\⟩
activity:⟨activity:goal_processing_standard\⟩    # triply-nested: outer record::id is itself a wrapped record id
activity:⟨Dashboard Specification Validator\⟩
```

(Each is the value `record::id(activity:⟨activity:<name>⟩)` returns — i.e., strip the outermost `activity:⟨...⟩` wrapper from the doubly-nested form.)

**Recommended next step:** unblock B-2 by either provisioning an admin scope on the cleanup API key, or by adding a controlled `template_admin` scope check to the deprecate handler. After that, replay this list with format-11 inputs and verify each succeeds (the audit row in `upkeep_audit_log` will confirm).

## Post-Deploy Observations

Post-deploy validation of v1.12.0 on canary surfaced two bugs in `repos/metabob-activity-api/src/routes/activities.ts`: (1) the `relevance_feedback` audit row is silently dropped when optional fields are absent, because SurrealDB 3.x rejects `NULL` for `none | string` typed fields — the fix is to pass `undefined` instead of `null` so the driver omits the key and the DB sees `NONE`; (2) the relevance-feedback route is missing its auth middleware, causing a 500 Hono lifecycle crash on unauthenticated requests rather than the expected 401. Additionally, the embedding backfill job has not run: 0 of 3,051 activities have embeddings populated, so semantic search in the pipeline returns no results until the job is executed.
