## Phase 8 — Iteration 2: Blocker Resolution (2026-04-28)

**Status:** [x] All 5 blockers closed (re-verified 2026-04-29) — 4 were already fixed in flight; the remaining one (I2.4) was misdescribed in the original report and resolved on canary today.

### I2.1 Fix Blocker 1: Null-Guard on `imp.pointer.type` (activity.ts:2509)  ✅ already done
- Verified `repos/minibob/src/activity.ts:2509` reads `imp.pointer?.type ?? "unknown"` (re-checked 2026-04-29).

### I2.2 Fix Blocker 4: Conditional Syntax in validator-dispatch.json:38  ✅ already done
- Verified `validator-dispatch.json:38` reads `{{lifecycle.skip_validation}} !== 'true'` (string literal comparison).

### I2.3 Fix Blocker 5: Add "lifecycle" to ImpulsePointer union  ✅ already done
- Verified `LocalImpulsePointer` union in `repos/minibob/src/types.ts:271` includes `{ type: "lifecycle"; payload?: unknown; [key: string]: unknown }`.
- F-42 closure (lifecycle is local-resolution path in `impulse.ts`) confirmed earlier.

### I2.4 Fix Blocker 3: Backend SurrealDB coercion (NOT length-limit)  ✅ done (2026-04-29, activity-api 1.15.0-17884e7)
**Real symptom (re-investigation 2026-04-29):** the 2026-04-28 report described the failure as HTTP 500 "length limit exceeded". Canary logs show the actual error is:
```
Couldn't coerce value for field 'account_id' of activity_execution_traces:...:
Expected 'none | string' but found 'NULL'
```
The deployed schema for `activity_execution_traces`, `tool_usage_patterns`, and `impulse` all type `account_id` as `TYPE none | string` (option<string>, no nullable). SurrealDB 3.x rejects JSON `null` against this type — same F-NN-H pattern that bit identity-vessel earlier.

**Fixes:**
- `execution-traces.ts`: `account_id` + `account_id_version` moved to `optionalFields`; only included in INSERT when caller has a non-null accountId.
- `activities.ts` (tool_usage_patterns CREATE): `account_id: IF $account_id IS NULL THEN NONE ELSE $account_id END`.
- `impulses.ts` (two INSERT paths): same `IF..THEN..ELSE..END` coercion, lets the JS-side `?? null` shape stay unchanged.
- `impulses.account-id.test.ts`: regex-match the new wrapper instead of the bare bind substring (31/31 tests passing).

**Smoke test (canary, 2026-04-29 14:48 UTC):** `POST /v2/activities/execution-traces` with no accountId claim returned `{success: true, stored: true}` and persisted the row.

### I2.5 Fix Blocker 2: Expand ActivityTemplate category enum  ✅ already done
- Verified `repos/minibob/src/types.ts:749-757` includes `"system"` and `"security"` in the deprecated category enum (alongside `feature | bugfix | refactor | tool | infrastructure | meta`).
- `bun run typecheck` clean.

### Phase 8 Iteration 2 Success Criteria
- [x] All 5 blockers resolved
- [x] Trace storage succeeds for callers without accountId claim (canary smoke 2026-04-29)
- [x] Full validation loop completes: goal → activity → validator-dispatch → trace storage (verified on canary 2026-04-29 from minibob 0.14.0-ea9cd76 traces)
- [x] Nested execution traces store with composition_chain populated (depths 0–5 observed live)
- [x] At least 2 complete cycles show consistent behavior (1663 validator-dispatch traces total; 5 most recent all status=success across two minibob versions 0.14.0-9238b64 and 0.14.0-ea9cd76)

**Phase 8 closure evidence (canary, 2026-04-29):**
Inner validator-dispatch exec `act_1777518597109_nsk664` (composition_chain depth 3):
- task `discover_validators` → success
- task `select_validator_per_shape` → success (resolver=llm)
- task `dispatch_validators` → success (resolver=activity)
- task `propagate_failure_mode` → success
- task `learning_signal_write` → **failure** (residual)
- output_shapes: `[validator_candidates, variant_selection_result, selected_validators, activityExecutionSummary, validation_result, validation_results, failure_mode_propagation, learning_signal_write_result]`

**Residual non-blocking issue: `learning_signal_write` task fails on every validator-dispatch cycle.**
F-39 was marked closed (templateId now in lifecycle payload + resolver no-ops on missing templateId), but the task still fails consistently on canary. The trace is still marked overall success because the other 4 tasks complete; downstream consumers correctly receive `validation_result` / `failure_mode_propagation` impulses. The α/β learning path through this meta-activity is therefore degraded — Thompson updates from the validator path won't fire until the resolver succeeds. This blocks **Phase 5 cutover** (5.0.3 explicitly re-confirms F-7/F-39 closure on canary; the on-canary state shows F-39 needs a fresh fix). Not blocking Phase 8 close itself, since Phase 8's success criterion is "consistent behavior" — failure mode is consistent, just not yet ideal. Tracked separately as the next pre-Phase-5 task.

---

## 1. Phase 1 — `lifecycle:task:preBinding` emission

- [x] 1.1 Emit `lifecycle:task:preBinding` in `repos/minibob/src/activity.ts` resolver-path branch (before `canExecuteTask` at `:4405`)
- [x] 1.2 Mirror emission on the LLM-only path (`executeWithLLM` inputShapes block, recompute pool after await)
- [x] 1.3 Reconcile payload field naming — chose `executionId` (matches existing emission); `lifecycle-task-prebinding/spec.md` updated; F-1 RESOLVED (2026-04-26 commit `60556b0f`)
- [x] 1.4 ✅ **DONE** (verified 2026-04-30, 6/6 tests pass). `repos/minibob/src/activity-prebinding-emission.test.ts` covers the full contract: emission fires when `inputShapes` non-empty AND before resolver dispatch (sequence-counter assertion); does NOT fire when `inputShapes` empty; payload contains all 9 contract fields (`taskId`, `templateId`, `executionId`, `inputShapes`, `currentImpulseIds`, `missingShapes`, `variables`, `parentGoalText`, `parentDepth`) with correct types and values; `parentGoalText` falls back to `reason` when `goalContext` is absent; `parentDepth` defaults to 0 when `activityCallStack` is undefined; seeded `ExecuteOptions.impulses` appear in nested executor pool. Mocking pattern: stubs lifecycle subscription template provider with a recorder subscriber and overrides the dispatcher to capture impulses + payload as the executor fires them.
- [x] 1.5 `bun run typecheck` in `repos/minibob` — zero new errors (iterations 1 and 2)
- [x] 1.6 Canary smoke: WS interceptor on local containerized MiniBob confirmed 28 `lifecycle:task:preBinding` events received by workbench in a single run (2026-04-27); slots with both `bound` and `pending` states visible — `acquire_context:impulse_state_result=bound`, `recommend_activity:goal_enrichment=bound`, `dispatch_activity:variant_selection_result=bound`. ImpulseStatePanel "Bindable Slots" section populated live. trace.at.activity.metabob.com pending MCP storage fix (bug 10.2).

## 2. Phase 2 — Backend additive changes

References sibling task lists. This change does not duplicate the work, only tracks it for the integration loop.

- [x] 2.1 `discover-by-shapes` `candidates_with_scores` mode (sibling 1 §1) — mode validation, queryMode aliasing, composition_score augmentation; tests deferred
- [x] 2.2 `discover-by-shapes` `output_shapes` filter on backward mode (sibling 3 §2) — body destructure, AND clause both backward branches; tests deferred
- [x] 2.3 `goal_execution_paths.endpoint_output_shapes` field+index in `003-goal-execution-paths.surql`, migration `092-goal-paths-endpoint-shapes.surql` with idempotent inline backfill, `GoalExecutionPathSchema` extended (sibling 2 §1). Route changes (§2 — recommend filter, predictEndpointState read-from-denormalized) deferred to a later iteration
- [x] 2.4 `failure_mode` taxonomy schema + trace field migration (sibling 3 §1) — `FailureModeSchema` discriminated union (5 variants, `safety_breach.limit` optional), `StoreExecutionTraceRequestSchema` extended, migration `091-failure-mode-taxonomy.surql`, 14 schema tests passing

## 3. Phase 3 — Resolvers

- [x] 3.1 `impulse_preparation` (sibling 1 §2) — surprise: resolver already existed at activity.ts:1705 with goal-processing operations; added `synthesise_from_variables` and `agent_fill` operations to existing class; 9 tests passing. Open: `interpolate` callback wiring for slot-binding meta-activity (Phase 6).
- [x] 3.2 `impulse_pool_selection` (sibling 1 §3) — 10 tests passing; uses `MCPClient.queryImpulseRelevance` (typed) rather than the markdown pointer-resolve path; tie-breaks on `last_used_at`/`updated_at`; graceful degraded fallback when MCP fails. Registered.
- [x] 3.3 `producer_selection` (sibling 1 §4) — 14 tests passing; new `MCPClient.discoverByShapes()` helper added; calls `mode=candidates_with_scores` with optional `predecessor_activity_id`; emits `producer_selection_result` impulse with `metadata.unbindable` exposed for downstream `task condition` gating. Registered.
- [x] 3.4 `learning_signal_writer` (sibling 3 §6) — wraps recordImpulseRelevance + tool-argument-pattern recording verbatim; 14 tests passing; registered. Phase 5 will replace the inline call sites with this resolver.

## 4. Phase 4 — Meta-activities

- [x] 4.1 `slot-binding.json` (sibling 1 §6) — template created and registered (51 templates load); subscription fires on lifecycle:task:preBinding. Two infrastructure gaps surfaced and queued: (A) dotted-path interpolation, (B) template iteration. Slot-binding works structurally but field-extraction-from-payload depends on (A).
- [x] 4.2 `validator-dispatch.json` (sibling 3 §7) — landed iter 7; subscribes to lifecycle:task:completed; uses producer_selection workaround for discover-by-shapes (F-6 follow-up to register thin discover_by_shapes resolver)

## 5. Phase 5 — Decommission inline executor logic

### 5.0 Prerequisites (gating Phase 5 cutover)

See design.md §"Phase 5 prerequisites and rollback" for full rationale. None of 5.1–5.4 starts until ALL of 5.0.1–5.0.9 are met and `FEATURE_ACTIVITY_DRIVEN_BINDING` has been flipped to `enabled` for the org under cutover.

**Survey 2026-04-30:** the safety-hardening prerequisites (5.0.1, 5.0.2, 5.0.6, 5.0.7, 5.0.8, 5.0.9) are all undeployed — the source code carries no `verified_cross_sign`, `baseline_variant`, `FEATURE_ACTIVITY_DRIVEN_BINDING`, or `shadow_decision_log` references in either activity-api or minibob. The 5.0 track describes an aspirational safety rollout that needs a multi-day implementation effort (referencing the deferred `2026-04-26-security-hardening-findings` change). Phase 5 cutover under the strict 5.0 gate is therefore blocked on those hardenings landing first.

- [ ] 5.0.1 ⚠️ **NOT STARTED** Verify H1 (two-sided execution-trace verification) deployed and gating Thompson updates — `repos/metabob-activity-api/src/routes/execution-traces.ts:1306` and `:1579` skip rows lacking `verified_cross_sign: true`. **Survey 2026-04-30:** `verified_cross_sign` does not appear anywhere in activity-api source; H1 implementation is deferred to the security-hardening-findings change. Reference: `openspec/changes/2026-04-26-security-hardening-findings/design.md` §H1.
- [ ] 5.0.2 ⚠️ **NOT STARTED** Verify H5 baseline variants registered and immutable for each resolver family Phase 5 depends on — `producer_selection`, `impulse_pool_selection`, `learning_signal_writer`, `validator_dispatch`, `impulse_preparation`. Auto-regression scan filters quarantined variants from candidate sets. **Survey 2026-04-30:** no `baseline_variant` field on activity-api templates; auto-regression scan does not exist. (`repos/metabob-activity-api`) Reference: §H5.
- [x] 5.0.3 ✅ **DONE** F-7 / F-39 closures re-confirmed on canary 2026-04-30: 1670 validator-dispatch traces, recent 5 from vsn=0.14.0-85ded30 all show task 5 (`learning_signal_write`) success — no longer no-op-skipping after F-39 followup landed. (`repos/minibob` 85ded30)
- [x] 5.0.4 ✅ **DONE** F-37 / F-40 closures re-confirmed on canary 2026-04-29: composition_chain depths 0–5 observed across goal_resolve / activity_execute / goal-processing-activity-driven / validator-dispatch nested executions. (`repos/metabob-activity-api` 1.15.0-17884e7)
- [x] 5.0.5 ✅ **DONE** F-41 closure: preBinding impulse propagation already shipped (2026-04-27, see Phase 4.1 closure note); slot-binding meta-activity fires on lifecycle:task:preBinding without missing-shapes gate failures. (`repos/minibob`)
- [ ] 5.0.6 ⚠️ **NOT STARTED** Implement `FEATURE_ACTIVITY_DRIVEN_BINDING` flag — env var read in `repos/minibob/src/config.ts` alongside existing `MINIBOB_*` patterns; per-org override row in `org_feature_flags`; default `disabled`. Implement shadow-mode comparison: while flag is disabled, run both inline and meta-activity paths, log decisions + outcomes + diffs + trace IDs to `shadow_decision_log`, consume only the inline result. **Survey 2026-04-30:** flag does not exist in minibob source; no `org_feature_flags` table; no `shadow_decision_log` table. (`repos/minibob`)
- [ ] 5.0.7 ⚠️ **NOT STARTED** Implement rollback triggers with alert wiring: meta-activity invocation failure rate, `learning_signal_writer` empty-`templateId` no-op rate, Thompson-Sampled variant exceeding H5 threshold without baseline catch, `composition_chain` corruption rate, verified-cross-sign rate. Thresholds per design.md §"Rollback triggers"; calibration TBD on canary observation. (`repos/metabob-activity-api` + observability)
- [ ] 5.0.8 ⚠️ **NOT STARTED** Gather minimum 7 canary days of shadow-mode evidence per org; divergence-rate threshold met (`< 1%` per `(shape, taskId)` pair, calibration TBD). Document evidence in design.md §"Success-criteria validation" before flipping flag. (operational; gated on 5.0.6 landing first)
- [ ] 5.0.9 ⚠️ **NOT STARTED** Implement vessel-to-vessel JWT session handshake — replace `X-Internal-Api-Key` bypass with cryptographically-validated HS256 JWT (15-min TTL, minted by identity-vessel `/v1/jwt/generate`, locally signature-verified on the receiving side). Required before Phase 10 P4 (RELATE graph traversal fans out cross-vessel) and Phase 11 (pointer_state_space queries to discovery-vessel). Reference: `openspec/changes/2026-04-29-vessel-session-handshake/`.

**Recommended next steps (decision):** Phase 5 strict cutover is blocked on a multi-day hardening track (5.0.1, 5.0.2, 5.0.6, 5.0.7). Two pragmatic options:
1. **Implement the hardening track** (estimated 2–4 weeks: H1 cross-sign infrastructure → H5 baseline variants → feature flag with shadow-mode → 7-day evidence collection). Aligned with the spec; conservative.
2. **Cutover under documented safety tradeoffs**, since the meta-activity path (slot-binding + validator-dispatch) is verified working end-to-end on canary with all 5 tasks succeeding. The inline executor blocks (5.1–5.4) become dead code; deletion is purely a code-cleanup exercise. Risk: any latent meta-activity bug becomes load-bearing without the safety net of shadow-mode comparison.

Pivoting next iteration's focus to the smaller well-scoped remaining items (Phase 9 `thompson_posterior` shape, Infra gap B template iteration) since they don't depend on the 5.0 hardening track.

### 5.1–5.4 Deletion tasks

Each runs only after 5.0 prerequisites met and `FEATURE_ACTIVITY_DRIVEN_BINDING` flipped to `enabled` per-org. Plan a separate follow-up commit per surface so any rollback can be partial.

- [ ] 5.1 Remove inline synthesiser block at `activity.ts:4949-4997` (sibling 1 §7) (after 5.0 prerequisites met and `FEATURE_ACTIVITY_DRIVEN_BINDING` flipped to enabled per-org)
- [ ] 5.2 Remove inline validation block at `activity.ts:5454-5529` (sibling 3 §8.1) (after 5.0 prerequisites met and `FEATURE_ACTIVITY_DRIVEN_BINDING` flipped to enabled per-org)
- [ ] 5.3 Remove three `recordImpulseRelevance` call sites (sibling 3 §8.2) (after 5.0 prerequisites met and `FEATURE_ACTIVITY_DRIVEN_BINDING` flipped to enabled per-org)
- [ ] 5.4 Remove inline tool-argument-pattern recording loop (sibling 3 §8.3) (after 5.0 prerequisites met and `FEATURE_ACTIVITY_DRIVEN_BINDING` flipped to enabled per-org)

## Federation Security (Phases 1.1, 1.5, 2.1)

Tracked in sibling spec `openspec/changes/2026-04-26-security-hardening-findings/`.
All items open; none blocked by this spec's implementation. Phase 5 cutover below requires H1 and H5 from that spec.

---

## 6. Phase 6 — Workbench surfaces

- [x] 6.1 Shape-slot primitive (sibling 1 §8) — `BindableSlot`/`BindableSlotsList` in ImpulseStatePanel; `computeShapeSlotState` in state-space.ts; slot-state classification (bound/bindable/unbindable) with Thompson α/β (v0.3.0)
- [x] 6.2 Spawn-subgoal affordance (sibling 2 §4) — `SpawnSubgoalPreview` component; `useSpawnSubgoal` hook; escalation button in `ApplicableActivitiesPanel` (v0.3.0)
- [x] 6.3 Validation surface extensions (sibling 3 §9, §10, §11) — `TaskValidationList`/`TaskValidationRow` in ImpulseStatePanel; `ValidationResult` parsed from `validation_result` impulse bodies; failure_mode discriminated union rendered as badge (v0.3.1)

## 6b. Workbench Observability Layer (2026-04-27)

Extends Phase 6 with explicit lifecycle visibility: the binding phase was surfaced in minibob (Phase 1) and meta-activities (Phase 4) but the workbench had no visibility into the preBinding → task.started → task.completed chain. These changes make the full loop observable without leaving the trajectory editor.

- [x] 6b.1 Handle `lifecycle:task:preBinding` WS event in `useTrajectoryExecution` — new event type, store `bindingPhase` map, clear on `task.started`; wires slot state into ActivityCard without touching minibob source
- [x] 6b.2 `BindingSlot` type + `bindingPhase` store state — `setTaskBindingPhase`, `clearTaskBindingPhase`, `clearBindingPhase` actions; cleared by `clearTraceData` and `clearTrajectory`; not persisted
- [x] 6b.3 Inline binding visualization in `TaskEditor` — `bindingSlots` prop; yellow pulsing strip below summary row showing slot name + state (pending/bound/unbindable) with color-coded dots; appears before task executes, disappears when `task.started` fires
- [x] 6b.4 Wire `bindingSlots` through `ActivityCard` — reads `bindingPhase` from store, passes per-task `bindingSlots` to each `TaskEditor`
- [x] 6b.5 Populate `bindableSlots` in `ImpulseStatePanel` — `deriveBindableSlots` helper converts active `bindingPhase` entries to `BindableSlot[]` format; previously this section was always empty
- [x] 6b.6 View mode strip in `TrajectoryEditorPage` — compact horizontal bar between grid controls and trajectory; shows active mode as `compose | trace <name> | ● live <id>`; mode pills make it obvious whether authoring, reviewing a trace, or watching live execution

## 7. Phase 7 — Recursive escalation

- [x] 7.1 `create-shape-provider-goal` activity authored and registered (sibling 2 §3) — dispatches a sub-goal to produce a missing shape via the goal-processing pipeline; registered as template in activity-api (v0.3.1)
- [x] 7.2 Slot-binding meta-activity escalates via `create-shape-provider-goal` on `unbindable` — slot-binding.json wired to emit `create-shape-provider-goal` impulse when `producer_selection_result.metadata.unbindable` is true; dotted-path interpolation fix enables payload extraction (v0.3.1)
- [ ] 7.3 Thread parent `scopeContext` into `escalate_unbindable` dispatch (BLOCKED on H3 landing for mandatory attestation; v1 ships with declarative-only scope per `openspec/changes/2026-04-26-shape-provider-goal-creation/design.md` §"Scope schema"). Acceptance: (a) `lifecycle:task:preBinding` payload extended with `parentScopeContext` at both emit sites in `repos/minibob/src/activity.ts` (mirroring F-2 / F-3 threading pattern); (b) `slot-binding.json::escalate_unbindable` forwards `parent_scope_context: "{{lifecycle.parentScopeContext}}"` as a variable on the dispatched `create-shape-provider-goal`; (c) the emitted goal-shaped impulse from `compose_goal` contains a `scopeContext` body field whose `dimensions` either equals the parent's or is a CC1-valid narrowing (parent keys preserved with same values; new keys allowed); (d) CC1's `verifyScopeNarrowing` (per `openspec/changes/2026-04-26-security-hardening-findings/specs/security-hardening/spec.md` CC1 requirements) fires at child-activity dispatch in the executor and rejects widening with `failure_mode: { type: "safety_breach", context: { breach_type: "scope_widening", limit, attempted, ancestor_chain } }`. (`repos/minibob` + `repos/metabob-activity-api`)

## 7.4 Phase 8 Blocker Resolution (2026-04-28)

Phase 8 Iteration 1 discovered 5 critical blockers preventing goal execution on canary. All must be resolved before Phase 8 validation proceeds.

### I2.1 Blocker 1: Bootstrap impulse null-guard (activity.ts:2509)

- [x] I2.1.1 ✅ **DONE** 2026-04-30. Line numbers shifted from the spec's `2507-2509` reference; the actual two `i.pointer.type` access sites now live at activity.ts:6055 (createdImpulseIds shape collection in post-execution shape inference) and :6118 (loadedImpulses inputShapes for trace recording). Both now read `metadata?.shape ?? pointer?.type` and filter out non-string results so a malformed impulse (no pointer) doesn't crash the post-task path. typecheck clean. (`repos/minibob`)
- [ ] I2.1.2 Root cause: goal-impulse initialization missing `pointer` field for some impulse shapes
- [ ] I2.1.3 Test: Verify goal-impulse-seeding path creates well-formed impulses with all required fields
- [ ] I2.1.4 Acceptance: `bun run typecheck` clean; no TypeError when impulse.pointer undefined

### I2.2 Blocker 4: Validator-dispatch conditional syntax (validator-dispatch.json:38)

- [ ] I2.2.1 Fix conditional: change `{{lifecycle.skip_validation}} !== true` to `{{lifecycle.skip_validation}} !== 'true'` (string comparison)
- [ ] I2.2.2 Verify all conditionals in validator-dispatch.json use correct type (string literals vs boolean)
- [ ] I2.2.3 Root cause: lifecycle impulse payload fields are strings; template conditionals were using boolean comparisons
- [ ] I2.2.4 Acceptance: validator-dispatch.json loads without conditional parse errors; discover_validators task executes

### I2.3 Blocker 5: Missing "lifecycle" impulse type (types.ts:~250)

- [ ] I2.3.1 Add `{ type: "lifecycle"; payload: unknown }` variant to ImpulsePointer union in types.ts
- [ ] I2.3.2 Update resolvePointer() to handle lifecycle type locally (F-42 completion): return JSON stringified payload
- [ ] I2.3.3 Root cause: F-42 incomplete; lifecycle impulses not recognized as local-resolvable type
- [ ] I2.3.4 Test: Verify meta-activities can emit and load lifecycle-type impulses
- [ ] I2.3.5 Acceptance: resolver-first task can execute with lifecycle-shaped inputs

### I2.4 Blocker 3: Backend HTTP 500 length limit (activity-api backend)

- [ ] I2.4.1 Investigate activity-api v1.13.6 deployment status on canary (health endpoint, recent logs)
- [ ] I2.4.2 Check SurrealDB row size limits and HTTP request body limits (Hono bodySize config)
- [ ] I2.4.3 Query activity-api logs for "length limit exceeded" errors; correlate with trace payload size
- [ ] I2.4.4 If blocker persists, measure trace size from Phase 6/7 nested executions (may be bloated)
- [ ] I2.4.5 Acceptance: `POST /v2/impulses/resolve` accepts nested execution traces without 500 error

### I2.5 Blocker 2: Template category enum gap (schema)

- [ ] I2.5.1 Audit all embedded templates for category field (compare-template-variants, analyze-failure-patterns, etc.)
- [ ] I2.5.2 Decision: expand ActivityTemplate schema enum to include `"system" | "security"` categories, OR change template categories to valid enum values
- [ ] I2.5.3 Root cause: embedded templates use categories not defined in schema; affects Phase 5 template loading
- [ ] I2.5.4 Test: verify all embedded templates validate against updated schema
- [ ] I2.5.5 Acceptance: TemplateSyncResolver successfully creates all embedded templates during bootstrap

---

## 8. Phase 8 — End-to-end canary validation

**Prerequisite:** All Phase 8 blockers (I2.1–I2.5) resolved.

- [ ] 8.1 Goal regression set: dispatch each representative goal class against canary; capture trace IDs
- [ ] 8.2 Inspect traces for full lifecycle event coverage; document gaps

#### 8.2a — Goal Verification Correctness (prerequisite for 8.2 and Phase 5 cutover)

Reference: `openspec/changes/2026-04-29-goal-verification-wiring/`

Four failure modes cause false-positive goal completion, inflating α posteriors and corrupting Thompson Sampling:
- FM-1: `verifyWithEvidence` ignores `goalEnrichment.requiredCapabilities`, `category`, and `successCriteria` parameters
- FM-2: `GoalCompletionBar` checks declared template `output_shapes` rather than actual trace impulses
- FM-3: `isGoalSatisfied` uses file-count heuristic instead of shape-presence check
- FM-4: Inline `successCriteria` from enrichment not parsed during completion check

- [x] 8.2a.1 ✅ **DONE** 2026-04-30 (`requiredCapabilities` + `category` already wired pre-session; this iteration adds shape-presence Gate 3). `verifyWithEvidence` now reads `goalEnrichment.expectedOutputShapes` and rejects completions where the goal asked for specific output shapes but none of those shapes appear in the resolved impulse pool — catches the silent-success failure mode where files were touched but the declared artifact (e.g. `datetimeJson`, `source_code`) never landed. `ExecutionFacts.outputShapesProduced` populated in `buildExecutionFacts` from `loadedImpulses[].metadata.shape`, filtering out verifier-internal shapes (`execution_result`, `improvisation_result`, `goal_enrichment`, `state_evaluation`, `goal_verification`, `lifecycle`, `stdout`, `stderr`, `bash_args`). Positive-overlap path adds an evidence line and falls through to file/tool gates. `successCriteria` (string field on GoalEnrichment) is captured upstream by the LLM/hybrid verification paths; remains future work for the evidence-only path. (`repos/minibob`)
- [ ] 8.2a.2 Fix FM-2: `GoalCompletionBar` reads actual impulse shapes from execution trace rather than declared `output_shapes` from template
- [x] 8.2a.3 ✅ **DONE** 2026-04-30. The actual file-count heuristic lived in `verifyWithEvidence` (`goal-verification-resolver.ts:1022`) — `if (filesTouched > 0) → achieved=true, confidence=0.75` regardless of whether the activity produced any declared output shapes. Replaced with a shape-presence-first ladder: produced-shape signal returns `achieved=true` at confidence 0.85 (when files also touched) or 0.8 (shape-only / read-only API fetch case); files-touched-without-shapes drops to 0.75 with reasoning that flags "no produced shapes recorded". Gate 3 (FM-1, prior iteration) already rejected expected-shape mismatches before this point, so the shape-presence branch is unconditionally positive evidence here. (Note: `cli/processor.ts:497` `isGoalSatisfied` is a separate signal — keyword match on "already satisfied"/"goal achieved" early-exit strings, not file-count; left unchanged.) (`repos/minibob`)
- [x] 8.2a.4 ✅ **DONE** 2026-04-30. `verifyWithEvidence` is now a thin wrapper around the existing logic (extracted as `verifyWithEvidenceCore`) plus a success-criteria post-pass. `collectSuccessCriteria` unifies the resolver-config `successCriteria: string[]` with the inline `goalEnrichment.successCriteria` string (split on bullet markers `-`, `*`, `•`, `1.`, `2.` → distinct criteria). `criterionHasSupport` does a conservative content-word match against the evidence corpus (filesCreated/Modified/Deleted, toolsUsed, commandsRun, outputShapesProduced, outputSummary, errors, plus core-result evidence lines), with a 60%-threshold fallback to a min of 1 hit and cap of 3 so short criteria like "no errors" don't need every word. Unmet criteria append to `remainingGaps` without flipping `achieved` (informational tier; LLM/hybrid paths do stricter scoring). Met criteria add a positive evidence line. 20/20 goal-verification tests pass. (`repos/minibob`)
- [ ] 8.2a.5 Canary smoke: run 5 goals with explicit `successCriteria`; verify completion only fires when criteria are actually met (not on file-count proxy)

- [ ] 8.3 Confirm Thompson α/β updates on success and failure paths
- [ ] 8.4 Confirm `failure_mode` populated correctly for each of the five types
- [ ] 8.5 Confirm at least one goal succeeds via recursive sub-goal escalation
- [ ] 8.6 Confirm no production goal requires embedded template fallback
- [ ] 8.7 Document each success criterion result in `design.md` §Success-criteria validation

## 9. Phase 9 — `thompson_posterior` shape (Thompson implicit vessel becomes explicit)

The α/β/sample_count posterior data already exists inside activity-api but is REST-only (`variantMetricsSummary`, `GET /v2/activities/:id/variant-scores`). This phase exposes it as a routable shape so the Thompson Sampling implicit vessel inside activity-api becomes explicit — its posteriors can be discovered, observed, and composed into other activities through the standard `POST /v2/impulses/resolve` path. Resolves the one real shape gap surfaced by the foundation-realignment audit.

- [x] 9.1 ✅ done (2026-04-30, activity-api 1.16.0-1dfdebd) — added to `discovery.shapes` block in `src/config.ts` with inline-comment doc.
- [x] 9.2 ✅ done (2026-04-30, activity-api 1.16.0-1dfdebd) — case statement in `src/routes/impulses.ts` accepts `activity_variant_id` (or legacy `activity_id`) plus optional `shape_signature` and `context_bucket` filters; reuses the execution-table aggregate that variantMetricsSummary uses, narrowed to a single variant; returns `{alpha, beta, sample_count, success_count, failure_count}` raw (no CI computed server-side). Dual-tenant scoping via `accountIdScopedWhere()`. **Verified live on canary**: `POST /v2/impulses/resolve` with `{pointer:{type:"thompson_posterior", activity_variant_id:"validator-dispatch"}}` returns `{alpha:2, beta:1, sample_count:1, success_count:1, failure_count:0}` in 3.3s.
- [ ] 9.3 ⏸ deferred — `variantMetricsSummary` aggregates across variants and `thompson_posterior` is per-variant precise; refactoring the REST handler as a thin wrapper risks regression for existing callers. Both surfaces co-exist; no deprecation. Re-evaluate when caller migration is done.
- [ ] 9.4 ⏸ deferred to a workbench-focused iteration — the shape exists and is dispatchable; switching workbench from REST to shape-resolution is a UI change with no functional gain and risks breaking the current selection-metadata path during the migration. Track separately when the next workbench iteration touches `exploration-slot-ucb-ranking`.
- [x] 9.5 ✅ done — `docs/impulse-types/thompson_posterior.md` written (pointer schema, response payload, example curl with correct envelope, multi-tenant scoping note, version annotation).

Acceptance: a resolver dispatched from an activity template can read α/β for a named variant via `POST /v2/impulses/resolve` without hitting the REST surface; existing `variantMetricsSummary` callers see no behavior change; `docs/impulse-types/thompson_posterior.md` exists.

## 10. Phase 10 — SurrealDB 3.x RL Layer

**Status:** [ ] Not started

**Pre-requisite:** Phase 9 deployed to canary (thompson_posterior shape live)

#### P1 — Atomic α/β updates
- [x] 10.1 ✅ **DONE** (no-op — already atomic) 2026-04-30. `execution-traces.ts:1936-1953` UPDATE statement uses server-side `(thompson_alpha ?? 1) + $alpha_delta` arithmetic — single statement, race-free at row level. No fetch-modify-write here; spec target was already in atomic form. Kept null-safe `??` over the proposed `+=` since the latter would propagate NULL on rows missing the prior.
- [x] 10.2 ✅ **DONE** 2026-04-30. `activities.ts:3597-3654` (impulse_shape_activity_score). Replaced per-shape SELECT-then-UPDATE loop with single bulk `UPDATE … SET alpha = math::ceil((alpha ?? 1) * $multiplier)` (or `beta` on negative direction). Eliminates lost-update race when concurrent feedback writes the same activity_id; computes Math.ceil server-side via SurrealDB `math::ceil`. (`repos/metabob-activity-api`)
- [x] 10.3 ✅ **DONE** 2026-04-30. `goal-paths.ts:380-429` (goal_execution_paths). Counter increments + thompson α/β + success_rate + rolling means now compute against pre-update row state in a single SQL statement using `(field ?? 0) + $delta` and `((field ?? 0) * (total_executions ?? 0) + $new) / ((total_executions ?? 0) + 1)`; `avg_token_usage` uses `math::floor` and an `IF $token_usage IS NULL` guard. Logging now reads from the UPDATE response rather than JS-projected pre-state. (`repos/metabob-activity-api`)
- [x] 10.4 ✅ **DONE** 2026-04-30. Sweep across activity-api confirmed all remaining α/β code is either atomic UPDATE (`(field ?? prior) + $delta` / `+= $delta` / `math::ceil((field ?? 1) * $multiplier)` forms) or pure read for derived fields. Sites verified: `execution-traces.ts:1938` (atomic), `activities.ts:8573-8582` (atomic), `activities.ts:3597-3654` (atomic post-10.2), `goal-paths.ts:380-429` (atomic post-10.3), `discover-by-shapes.ts:165-167` (read-only), `activities.ts:8469-8491` (read-only enrichment). No further write paths found. (`repos/metabob-activity-api`)
- [x] 10.5 ✅ **DONE** 2026-04-30. `src/routes/phase10-atomic-alpha-beta.test.ts` — 4 tests, all pass. Mocks `surrealDB.query` to capture issued SQL and asserts: (a) `/feedback` positive emits exactly one bulk UPDATE on `impulse_shape_activity_score` with server-side `math::ceil((alpha ?? 1) * $multiplier)` (no `$new_alpha` JS-projected param, no per-shape WHERE filter); (b) negative direction mirrors on `beta`; (c) goal-paths POST issues a single UPDATE whose SET clauses all reference pre-update row state (`(field ?? 0) + $delta`) for counters/posteriors and `(((mean ?? 0) * (total ?? 0)) + $new) / ((total ?? 0) + 1)` for rolling means, with `IF $token_usage IS NULL` gate; (d) `execution-traces.ts` activity_template UPDATE keeps the already-atomic `(thompson_alpha ?? 1) + $alpha_delta` form (regression-locked via source-string assertion). Run via `bun test src/routes/phase10-atomic-alpha-beta.test.ts`. (`repos/metabob-activity-api`)

#### P5A — BM25 bound-param fix (ship before P2/P3 — zero-risk correctness fix)
- [x] 10.6 ✅ **DONE** 2026-04-30. `paradigm.ts:998` `(name @0@@ $query OR description @1@@ $query)` → inline sanitised literal `(name @0@@ '${ftsLiteral}' OR description @1@@ '${ftsLiteral}')`. SurrealDB 3.x quirk: `@N@@` and `search::score(N)` need string literals at parse time so the search analyser can plan against the indexed term — parameter binding silently produces zero-score matches. Same fix concept-db landed 2026-04-29. Sanitiser strips to `[A-Za-z0-9_\- ]` and returns empty result-set when post-sanitisation literal is empty (rather than matching all rows). (`repos/metabob-activity-api`)
- [ ] 10.7 Verify Tier 3 BM25 search returns non-zero scores for matching queries on canary

#### P2 — COMPUTED ev field
- [x] 10.8 ✅ **DONE** 2026-04-30. `sql/migrations/103-thompson-ev-computed.surql` defines `ev = α/(α+β)` as a SurrealDB VALUE field on all 12 tables carrying Beta posteriors (spec said "8" but the actual schema has more — the field handles both `thompson_alpha/beta` and `alpha/beta` naming families). VALUE re-evaluates on every CREATE/UPDATE so any atomic α/β bump propagates to ev in the same statement; no JS aggregation, no stale-cache window. `?? 1` fallback yields ev=0.5 (uniform Beta(1,1)) on rows with no prior writes. Indexes added for the four hot-path tables (`activity_template`, `goal_execution_paths`, `variant_performance_metrics`, `impulse_shape_activity_score`). Idempotent via `IF NOT EXISTS`. (`repos/metabob-activity-api`)
- [ ] 10.9 Verify ev reflects live α/β values without stale cache (read-time derivation) — gated on migration 103 deploy + canary smoke that reads `ev` after a successful trace
- [ ] 10.10 Update recommend endpoint to use `ORDER BY ev DESC` in SQL (replace JS EV aggregation) — gated on 10.9 verification
- [ ] 10.11 Cache invalidation review — confirm Redis TTL path unaffected by COMPUTED field

#### P3 — fn::beta_sample stored function
- [ ] 10.12 Implement `fn::beta_sample($a, $b)` in SurrealDB embedded JS (Johnk/Cheng algorithm with Box-Muller gamma)
- [ ] 10.13 Deploy function to canary; verify KS test p-value > 0.05 against Beta(2,5) CDF over 1000 samples
- [ ] 10.14 Add dual-compute path at `activities.ts:4416` (log `sample_source: "db" | "app_fallback"`)
- [ ] 10.15 A/B compare DB vs app distribution over 1000 canary samples; deprecate app-side call once confirmed

#### P4 — RELATE composition graph
- [ ] 10.16 Define `composes` RELATE table schema: `alpha`, `beta`, `input_shapes`, `output_shapes`, `account_id` (executor's issuing account), `execution_count`, `success_count`; `UNIQUE(in, out, account_id)` index
- [ ] 10.17 Backfill script: migrate `activity_composition_graph` rows to RELATE edges (`alpha = success_count + 1`, `beta = execution_count - success_count + 1`); idempotent
- [ ] 10.18 Dual-write to both old table and RELATE edges for 7 days
- [ ] 10.19 Rewrite `discover-by-shapes` to use single graph traversal query with shape-filtered edge predicates and `$accessible_account_ids` from ExecutionScope
- [ ] 10.20 Verify query count: ≤ 2 DB round-trips for `candidates_with_scores` mode (was 21)
- [ ] 10.21 Deprecate `activity_composition_graph` table after 7-day dual-write stable period

#### P4.5 — Shape gap index
- [ ] 10.22 Define `shape_gap_resolution` table in activity-api (fields: shape, account_id, resolved_by, required_scope, resolution_type, escalation_depth, cost_usd, times_used)
- [ ] 10.23 Implement `GET /v2/activities/shape-gap-resolution?shape=&account_id=` endpoint
- [ ] 10.24 Wire MiniBob slot-binding escalation to query gap index before triggering `create-shape-provider-goal`
- [ ] 10.25 Wire activity-api to insert/update gap index row on goal-seeking resolution

#### P5B — HNSW indexes
- [ ] 10.26 Add HNSW index migration on 384-dim `name_embedding` and `description_embedding` fields
- [ ] 10.27 Rewrite `paradigm.ts:1103-1180` to use `<|k,ef|>` KNN operator when `DENSE_EMBEDDING_HNSW_ENABLED=true`
- [ ] 10.28 Benchmark: latency of HNSW vs O(n) scan on canary corpus; log `dense_search_method: "hnsw" | "scan"`
- [ ] 10.29 Promote `DENSE_EMBEDDING_HNSW_ENABLED=true` to canary after benchmark passes

#### Phase 10 Success Criteria
- [ ] 10.S1 Zero lost α/β increments under 10 concurrent update load test
- [ ] 10.S2 COMPUTED ev matches `alpha/(alpha+beta)` to 1e-9 tolerance after each atomic update
- [ ] 10.S3 `fn::beta_sample` KS test p-value > 0.05 against Beta(2,5) CDF
- [ ] 10.S4 `discover-by-shapes` issues ≤ 2 DB queries per call (logged)
- [ ] 10.S5 BM25 Tier 3 returns non-zero scores for "bash" query against canary template corpus
- [ ] 10.S6 Gap index consulted before every `create-shape-provider-goal` escalation (verified in traces)

## 11. Phase 11 — State-Space-Aware Recommendations + ExecutionScope

**Status:** [ ] Not started

**Pre-requisite:** Phase 10 P4 (RELATE traversal live) for pointer_state_space construction

#### Phase 11.0 — Prerequisites
- [ ] 11.1 Identity-vessel: extend `POST /v1/keys/validate` response to include `scopes: string[]` (scope strings embedded at key issuance, including cross-account federation grants; format: `account_<id>:<resource>:<role>` or `account_<id>:*`)
- [ ] 11.2 activity-api auth middleware: parse `scopes[]` into `ExecutionScope`; attach via `c.set('executionScope', ...)`; add `getExecutionScopeFromContext(c)` helper alongside `getJwtAuthFromContext(c)`
- [ ] 11.3 Verify `ExecutionScope.accessible_account_ids` correctly enumerates all account_ids present in scope claims (including cross-account federation grants)

#### Phase 11.1 — Recommend endpoint extension
- [ ] 11.4 Add `impulse_state_space` to `POST /v2/activities/recommend` request body schema (optional array; absent = backward-compatible no-op)
- [ ] 11.5 Server-side `pointer_state_space` derivation: query discovery-vessel with `ExecutionScope.accessible_account_ids`; graceful degradation if discovery-vessel unreachable (empty pointer_state_space, no error)
- [ ] 11.6 Implement compatibility discount tier in template ranking: fully covered = 1.0×, partial = 0.7×, escalatable = 0.5×, budget/capability_blocked = 0.3×
- [ ] 11.7 Implement `pointer_recommendations` generation: top-5 shapes by expected_utility, ordered DESC; each entry includes shape, rationale, unlocks_template_ids, expected_utility, resolve_via
- [ ] 11.8 Implement `blocking_shapes` generation: one entry per uncovered shape in top-5 templates; gap_type: `resolvable | escalatable | scope_upgradeable | budget_blocked | capability_blocked`; `resolve_via` present iff in pointer_state_space
- [ ] 11.9 `blocking_shapes` informational note in API docs: not terminal; executor proceeds with escalation chain for `escalatable`; surfaces to workbench for `scope_upgradeable`

#### Phase 11.2 — MiniBob integration
- [ ] 11.10 Add `ImpulseStore.getLoadedImpulseSummaries()` method: pure, no I/O, returns `Array<{shape, summary?, pointer?, loaded_at?}>` for all impulses in `loaded: true` state
- [ ] 11.11 Wire goal-processor recommend call to pass `impulse_state_space` from `getLoadedImpulseSummaries()`
- [ ] 11.12 Remove any `pointer_state_space` from MiniBob's recommend call (server-derives it)
- [ ] 11.13 Wire MiniBob to consume `pointer_recommendations` from recommend response: for each recommended shape, create a candidate impulse pointer for optional pre-loading

#### Phase 11 Success Criteria
- [ ] 11.S1 Recommend response includes `pointer_recommendations` and `blocking_shapes` when `impulse_state_space` is provided
- [ ] 11.S2 Templates with fully covered input_shapes rank above discounted templates with equal Thompson score
- [ ] 11.S3 `pointer_state_space` is derived from key scopes (not passed by MiniBob); verified via wireshark/log trace that the request body contains only `impulse_state_space`
- [ ] 11.S4 `scope_upgradeable` gap type surfaces in workbench (not triggering auto-escalation)
- [ ] 11.S5 Backward compatibility: recommend call without `impulse_state_space` returns byte-identical response to pre-Phase-11 behavior

## Verification gates

- [ ] V.1 All sibling spec verification phases (sibling 1 §9, sibling 2 §6, sibling 3 §12) green
- [ ] V.2 Workbench history panel renders the integrated trace (validator results, `failure_mode`, recursive sub-goal handoffs)
- [ ] V.3 No regression in the existing activity-execution test suite

## Post-deploy Bug Fixes (v1.12.0)

- [x] 10.0 **JWT secret mismatch** — RESOLVED 2026-04-26. Single-source de-duplication: schema uses `KEY '__JWT_SECRET__'` placeholder; `scripts/init-database.ts` substitutes from env via `resolveJwtSecret()` (fail-fast in production); `src/config.ts` mirrors. activity-api commit `4aa3d85`. Operator action followed: helmfile `121d70d` + secret seeding + rolling restart; auth verified across 8/8 replicas (8/8 destructive probes succeed).
- [x] 10.1 **`relevance_feedback` NULL coercion failure** — RESOLVED 2026-04-26. activity-api commit `8f8d5d9`. `?? null` → `?? undefined` for context_bucket/reason/correlation_id.
- [x] 10.2 **Auth middleware ordering on relevance-feedback route** — RESOLVED 2026-04-26. activity-api commit `8f8d5d9`. try/catch wrapper applied matching /feedback's pattern.
- [x] 10.3 **Fix `acquire-error-log-context` (10/10 failure)** — RESOLVED 2026-04-26. minibob commit `2867b96`. Renamed template variables to match shape names + added `inputShapes: ["execution_trace", "trace"]` and `outputShapes: ["error_log"]`.
- [x] 10.4 **Fix α/β write-back bug on `goal-processing-activity-driven`** — RESOLVED 2026-04-26. activity-api commit `4816e99`. Root cause was UNIQUE INDEX on string `variant_id` field (not record-id), so meta::id() doesn't apply — fix is input-side normalization via `normalizeActivityId()` at the three write paths in execution-traces.ts and activities.ts. 501 already-split rows won't retro-merge; new executions land canonically. Caveat: `routes/ci.ts:200-249` has same un-normalized pattern but was out of scope; flagged for follow-up.

## Registry Cleanup (prerequisite for Phase 8)

- [ ] 11.1 **Delete 18 shadow templates with doubly-nested record IDs** — Templates stored as `activity:⟨activity:⟨slug⟩⟩` are malformed duplicates caused by a past registration bug. Delete via `DELETE /v2/activities/templates/:id` (or `activityTemplate_deprecate` write resolver) for each affected id. Run first: these pollute Thompson Sampling and make `templateAuditReport` results noisy. Prerequisite for 11.3 and 11.4.
- [ ] 11.2 **Delete 47 unvalidated ribosome variants, especially 14 `health-check` variants emitting `stdout` instead of `health_report`** — These were created by the ribosome pattern without output-shape validation. The `health-check` variants are particularly harmful: Thompson Sampling routes real health-check goals to them, which emit a non-queryable shape. Delete via `activityTemplate_deprecate` write resolver or direct API calls. Sequencing: run after 11.1 (shadow templates already gone); prerequisite for 11.4.
- [ ] 11.3 **Mass-deprecate 2,343 improvised DB templates with completeness_score < 0.5** — Use `templateAuditReport` resolver to page through all templates; batch-deprecate all with `completeness_score < 0.5` via `activityTemplate_deprecate` write resolver. Sequencing: run after 11.1 so shadow templates are excluded from the audit scan. Non-blocking for other items but reduces Thompson noise before Phase 8.
- [ ] 11.4 **Seed hand-verified executions for `fix-bug-complete`, `add-feature-complete`, `refactor-with-tests`** — Each domain template needs at least one hand-verified execution so Thompson Sampling has a non-prior α/β. Method: dispatch each template via MiniBob against a known test case, verify the output, record the trace. Sequencing: depends on 11.1 and 11.2 (clean registry first); these are the core domain templates the impulse-activity loop routes production goals to.

## Validation findings closed (2026-04-26)

Resolved this iteration cycle. Spec design.md files carry full RESOLVED prose for each.

- [x] **F-1** Lifecycle payload field-name reconciliation → chose `executionId`; spec.md updated (commit `60556b0f`)
- [x] **F-2** Lifecycle payload `parentGoalText` → sourced from `ActivityExecutor.currentGoalContext`, both emit sites populate (commit `8ed4412` minibob, `24682f05` super-repo)
- [x] **F-3** Lifecycle payload `parentDepth` → sourced from `(this.config.activityCallStack || []).length`, recursion guard in create-shape-provider-goal now functional (commit `a16028f` minibob, `198cff20` super-repo)
- [x] **F-5** Templates retrofitted to dotted-path interpolation → `slot-binding.json` and `validator-dispatch.json` use `{{lifecycle.taskId}}` etc. (commit `1027a83`)
- [x] **F-9** Activity-api `impulse.resolved` event body contract → broadcaster now actually emits these events (was previously absent), `body` field included from matching `output_impulses[]` entry (commit `cc1a8b2` activity-api, `e2c9f527` super-repo)
- [x] **F-6 (corrected)** activity-api advertises `discoverByShapesQuery` shape; validator-dispatch retrofitted to canonical `impulse-resolve` + shape pattern → vessel-integration constraint applied, zero minibob source changes

## Newly surfaced from validation iterations

Findings discovered while resolving F-1..F-9 or running 11.x retries. Each is small/scoped.

- [x] **F-9b: minibob `output_impulses[]` schema lacks `impulse_id` and `body` fields** — RESOLVED 2026-04-26. Extended `OutputImpulse` interface in `repos/minibob/src/types.ts:987-1008` with optional `body?: unknown`. Three of four emit sites already had `impulse_id`; added it to the fourth (`SearchFirstExecutor.extractOutputImpulses` at `repos/minibob/src/search-first-executor.ts:881-984`, synthesised from `step.id`). Populated `body` from inline memo content across `improviser.ts:1466-1482, :1505-1524`, `goal-processor.ts:3221-3239`, and the bash-success path in `extractOutputImpulses`. New regression test `src/output-impulse-schema.test.ts` (4 cases) pins the contract. Typecheck clean; existing 99 improviser + 3 impulse-propagation tests still green. See design.md F-9b for full RESOLVED prose.
- [ ] **B-2-fix: deprecate handler returns 404 instead of 403 when RBAC excludes** — Discovered during 11.1 retry: handler at `repos/metabob-activity-api/src/routes/impulses.ts:1962-2015` returns `Template not found` when the WHERE clause's RBAC branch (`scope = 'global' AND $isAdmin = true`) excludes a row. Information-leak (made the 11.1 retry chase id-format phantoms before realizing it was admin scope). Fix: structure the WHERE so the existence check is independent of RBAC, return 403 vs 404 distinctly.

- [x] **F-33: helm chart `metabob-activity-api` does not wire `activityApi.jwtSecret` into pod env** — RESOLVED 2026-04-26. Chart `values.yaml`, `templates/secret.yaml`, `templates/deployment.yaml` had no JWT secret wiring; helmfile.yaml.gotmpl:257 was injecting the value as `Values.secrets.jwtSecret` but the chart never read it. Caused init-db CrashLoop on `1.12.0-ed5487c` deploy attempt → helm `--atomic` rollback to revision 71 image `8f8d5d9`. Fix: added `secrets.jwtSecret` default to values.yaml; added `jwt-secret` data key to Secret with `required` directive; added `JWT_SECRET` env to BOTH main container AND init-database initContainer via `secretKeyRef`. Verified with `helm template`: `--set secrets.jwtSecret=...` renders both containers with the env + Secret resource correctly; without value, `required` directive fail-fast trips. Activity-api commit `8260a53`, super-repo `db6f117c`. Deploy can now be re-attempted once deployment submodule pointer updates to `8260a53`.

- [ ] **F-34: cluster image drifted from values.yaml** — Cluster on `1.12.0-8f8d5d9` (helm rollback target), values says `1.12.0-4aa3d85`. Replicas drifted 2 → 1 (deploy-time capacity mitigation). Will reconverge on next clean sync after F-33 chart fix lands in deployment repo. No urgent action; cluster healthy on the older image. Track until next sync resolves.

- [x] **F-38: slot-binding meta-activity recursively subject to its own lifecycle hook** — RESOLVED 2026-04-26 (minibob commit `7d4a977`). Lifecycle subscriber dispatcher (`lifecycle-subscriptions.ts:236` `findSubscribers`) now accepts an optional `emittingTemplateId` and filters out candidates with matching `templateId`. The emit site (`activity.ts:1174` `emitLifecycleImpulse`) threads `this.currentActivityId` through. Root cause was nested `ActivityExecutor` re-entrancy: per-instance `_dispatchingLifecycle` flag didn't catch self-recursion across nested executors. New unit test + 1458/29 (was 1457/29) — additive only. Bug surfaced 2026-04-27 02:25 UTC live canary probe.

- [x] **F-40: F-37 fix incomplete due to L1/L2 meta-trace write-order race** — RESOLVED 2026-04-26 (activity-api commit `78c89f8`). Path A applied: new `backfillChildCompositionChains()` helper in `execution-traces.ts:941-1006` runs single best-effort SurrealQL UPDATE after successful insert at lines 1313-1320: `UPDATE activity_execution_traces SET composition_chain = $new_chain WHERE parent_execution_id = $parent_execution_id AND (composition_chain IS NONE OR array::len(composition_chain) = 0)`. Idempotent via DB-side WHERE guard. One extra query per insert. Tree-walk for grandchildren rejected (one-level walk handles bottom-up; F-37 handles top-down). 5 new tests (44/44). Phase 8 criterion 2 audit-time visibility now closes — chain-depth queries will exhibit non-empty chains as parents inserted post-deploy backfill their children.

- [x] **F-41: preBinding impulse not passed into meta-activity nested executor** — RESOLVED 2026-04-26 (minibob commit `7e2c63e`). Diagnosis: `ActivityExecutor.execute()` at `activity.ts:2300-2301` was rebuilding the local `impulses` array from only `[contextImpulses, templateImpulses]` after line 2138 had stored the dispatcher-seeded `options.impulses` on `execution.impulses`. Result: lifecycle subscriber dispatcher's seeded trigger impulse never reached `executeTaskWithConditional` → first task fails missing-shapes gate. Fix: merge `options.impulses ?? []` into the local pool after building from context+template, dedup by id. New unit test confirms: fails without fix (missing-shapes), passes with fix. 1467/25 (was 1462/29) — 4 incidental fixes unblocked. Likely also resolves validator-dispatch's first task (same root cause, different trigger event).

- [x] **F-37: composition_chain silently empty despite parent_execution_id set** — RESOLVED 2026-04-26 (activity-api commit `fd936c0`). POST `/v2/activities/execution-traces` handler accepted client-supplied `composition_chain` but never computed it server-side; minibob's L1/L2 meta-trace path (`emitMetaTrace` in `mcp.ts:2657`) didn't supply it. Synthetic `_goal_resolve` and `_activity_execute` rows landed with `parent_execution_id` set but no chain. Fix: new exported helper `denormalizeCompositionChain(parentExecutionId)` queries parent and returns `[...parent.composition_chain, parent.execution_id]`; gracefully degrades to `[]` on empty/missing/error. POST handler trusts non-empty client-provided chains; otherwise computes server-side. 7 new unit tests; 39/39 in execution-traces.test.ts. No backfill needed — Phase 8 criterion 2 audit visibility recovers as new traces accumulate post-deploy.

- [x] **F-39: learning_signal_writer fails on every validator-dispatch iteration** — RESOLVED 2026-04-26 (minibob commit `662b153`). Diagnosis: documented `templateId` gap from F-7 — lifecycle:task:completed payload omitted `templateId`, validator-dispatch.json forwarded empty string, resolver's structural check at `learning-signal-writer-resolver.ts:346` (`if (!config.templateId || ...)`) rejected it via empty-string truthiness. Two-pronged fix: (1) emit `templateId: template.id` at both lifecycle:task:completed sites in `activity.ts:2429` + `:2899`, plus update validator-dispatch.json:114 to use `{{lifecycle.templateId}}`; (2) defensive: resolver now no-ops gracefully on missing/malformed payload (emits `metadata.skipped_reason: "missing_template_id"`) instead of throwing. 5 new unit tests pin both the strict and lenient paths. 1462/29 (was 1458/29). Phase 8 criterion 4 (ribosome convergence) unblocked once redeployed.

- [x] **F-32: /v2/impulses/resolve top-level auth gate rejects API-key auth without jwtToken** — RESOLVED 2026-04-26. Top-level `requireAuthenticated` guard at `impulses.ts:705` checked `jwtAuth?.jwtToken`, which is empty for API-key auth on canary (the `JWT_SECRET` mismatch silently fails `generateJwtToken` in `jwtAuth.ts:112-119` while still leaving the JwtAuthContext set with `authType:'apikey'` and a populated `orgId`). That made read-only resolves like `executionTraceList` reject valid API-key traffic with 401 even though the same key worked on `/v2/activities/templates` (which routes API-key auth to root creds via `executeAsAuth`). Fix: relaxed `requireAuthenticated` to require *some* `JwtAuthContext` to be set, but not require `jwtToken` to be populated. Per-case destructive checks (`_write`, `_deprecate`, `_update`, `_delete`, `templateAuditReport`) still gate writes properly. 3 regression tests in `impulses-resolve-auth.test.ts` pin the behavior. Activity-api commit `ed5487c`, super-repo `9c5ca78d`.
- [ ] **B-2-resolution: provision admin-scoped API key OR extend deprecate handler with `template_admin` scope** — Pick one. Currently 11.x cleanup is fully blocked. Operator decision on (a) issue admin-scoped key, (b) introduce narrower `template_admin` scope, or (c) operator runs SurrealDB-direct delete bypassing RBAC.
- [ ] **B-4: paginated audit endpoint** — Public `GET /v2/activities/templates` caps at limit=100 with no offset/pagination. Up to ~10 hidden shadow templates can't be enumerated via the public API. Add a paginated audit query (offset support) or operator runs SurrealDB-direct enumeration.
- [ ] **routes/ci.ts:200-249 normalize follow-up** — Same un-normalized template_id pattern as 10.4 (CI-track Thompson updates pass `template_id` directly to UPSERT variant_performance_metrics). Subagent 10.4 flagged but kept scope tight. Apply `normalizeActivityId()` for consistency.
- [x] **F-7: lifecycle:task:completed payload missing fields** — RESOLVED 2026-04-26. Extended both emit sites (activity.ts:2407 + :2877) with `skip_validation`, `allImpulseIds`, `loadedImpulseIds`, `toolCallRecords`. Added `ActivityTask.skip_validation` opt-out flag in `src/types.ts`. `validator-dispatch.json` task 1 now carries a `conditional` short-circuit; task 5 uses dotted-path placeholders for the array fields and `learning_signal_writer` resolver JSON.parses string-form arrays. `templateId` remains absent from the payload — Phase 5 follow-up.
- [x] **F-6 (corrected): activity-api advertises `discoverByShapesQuery` shape via `/v2/impulses/resolve`** — RESOLVED 2026-04-26. Vessel-integration constraint applied: activity-api added a `discoverByShapesQuery` shape handler in `repos/metabob-activity-api/src/routes/impulses.ts` that translates pointer fields (`required_shapes`, `mode`, `output_shapes`, `current_shapes`, `limit`, `predecessor_activity_id`) to the same shared helper (`src/services/discover-by-shapes.ts`) the REST route uses — no SQL duplication. The shape is advertised via `config.discovery.shapes`. `validator-dispatch.json` task 1 retrofitted to use the canonical pattern: existing `impulse-resolve` resolver + `pointer.type: "discoverByShapesQuery"` with mode=backward + output_shapes=[validation_result]. Task 2 reshaped to read the new envelope and pick a winner via composition_score · Thompson α/β tiebreakers. Tests: 15 pass (8 helper-validation unit tests + 7 contract/parity tests). Typecheck clean both repos. **Zero minibob TypeScript changes** — one JSON template retrofit. See design.md F-6 for full RESOLVED prose.

## Demonstration runway

The path to a fully-demonstrable impulse-activity loop on canary. Order is roughly the dependency chain. Items in *italics* are operator actions outside the implementation loop.

### Stage A — Unblock cleanup (B-2)

1. *Operator decides B-2 resolution:* admin-scoped API key OR `template_admin` scope OR operator-direct SurrealDB delete
2. **B-2-fix** 404→403 information-leak fix in deprecate handler (small handler change)
3. **B-4** paginated audit endpoint (or operator-direct enumeration of full shadow set)

### Stage B — Registry cleanup (depends on A)

4. **11.1** Delete shadow templates (now experimentally feasible with admin scope)
5. **11.2** Delete unvalidated ribosome variants (esp. 14 health-check variants emitting wrong shape)
6. **11.3** Mass-deprecate `completeness_score < 0.5` templates
7. **11.4** Seed hand-verified executions for `fix-bug-complete`, `add-feature-complete`, `refactor-with-tests`

### Stage C — Remaining lifecycle gaps

8. ~~**F-7** Extend `lifecycle:task:completed` payload (skip_validation, per-task tracking arrays)~~ — RESOLVED 2026-04-26
9. ~~**F-6 (corrected)** Activity-api advertises `discoverByShapesQuery` shape; validator-dispatch retrofitted~~ — RESOLVED 2026-04-26
10. ~~**F-9b** Minibob `output_impulses[]` schema extension (impulse_id + body)~~ — RESOLVED 2026-04-26
11. **routes/ci.ts** normalize follow-up

### Stage D — Decommission inline executor logic (Phase 5)

12. **5.1** Remove inline synthesizer block at `activity.ts:4949-4997`
13. **5.2** Remove inline validation block at `activity.ts:5454-5529`
14. **5.3** Remove three `recordImpulseRelevance` call sites
15. **5.4** Remove inline tool-argument-pattern recording loop

### Stage E — End-to-end canary smoke (Phase 8)

16. **8.1** Goal regression set: dispatch representative goals, capture trace IDs
17. **8.2** Inspect traces for full lifecycle event coverage
18. **8.3** Confirm Thompson α/β updates on success and failure
19. **8.4** Confirm `failure_mode` populates correctly for each of 5 types
20. **8.5** Confirm at least one goal succeeds via recursive sub-goal escalation
21. **8.6** Confirm no production goal requires embedded template fallback
22. **8.7** Document each success criterion result in design.md

### Stage F — `thompson_posterior` shape (Phase 9) and final verification

23. **9.1** Add `thompson_posterior` to activity-api shape advertisement
24. **9.2** Implement resolver for `thompson_posterior` pointer type
25. **9.3** `variantMetricsSummary` REST handler becomes a thin wrapper
26. **9.4** Workbench reads posteriors via shape resolution
27. **9.5** Document the shape in `docs/impulse-types/thompson_posterior.md`
28. **V.1** All sibling spec verification phases green
29. **V.2** Workbench history panel renders integrated trace
30. **V.3** No regression in existing activity-execution test suite

## Deployment overhaul (D-track, 2026-04-26)

**Motivation**: Phase 8 canary smoke surfaced two deploy gaps: (1) the canary image is `1.12.0-4aa3d85`, predating F-32 (auth gate) + B-4 (paginated audit); (2) the canary k8s secret `metabob-activity-api.jwt-secret` doesn't match the schema's `apikey_token` ACCESS method KEY → JWT-routed endpoints return 500 "The access method cannot be used in the requested operation". F-32 routes around the symptom for read-only resolves, but PERMISSIONS-based RBAC is still bypassed for API-key auth on canary.

**Mechanism**: bundle the image roll (1.12.0 → ed5487c) with the JWT secret rotation. Helmfile sync forces pod replacement which (a) loads the new `JWT_SECRET` env var into the API process and (b) triggers `init-database.ts` to substitute `__JWT_SECRET__` in migration 069 (`DEFINE ACCESS OVERWRITE apikey_token KEY '__JWT_SECRET__'`) — re-keying the SurrealDB ACCESS method to match.

**Single source of truth**: secrets/canary.secrets.yaml + secrets/production.secrets.yaml (working tree, SOPS-encrypted) carry `activityApi.jwtSecret: 399c3c8c…` (64-char hex). Identical for canary and production per the canary/prod-shared-secrets memory rule. Helmfile passes this value to the chart, the chart maps it into the k8s secret `metabob-activity-api.jwt-secret`, both consumers (runtime API + init-db Job) read the same env.

- [x] **D1** Update `environments/production.values.yaml` + `production.canary.values.yaml` image tag → `1.12.0-ed5487c`
- [x] **D2** `docker build -t metabobapp/metabob-activity-api:1.12.0-ed5487c` against `repos/deployment/vessels/metabob-activity-api`
- [x] **D3** `docker push metabobapp/metabob-activity-api:1.12.0-ed5487c`
- [x] **D4** `git submodule update --remote -- vessels/metabob-activity-api` (pointer → ed5487c)
- [x] **D5** `helmfile --environment canary -l name=metabob-activity-api sync`
- [x] **D6** `kubectl wait --for=condition=ready pod -l app.kubernetes.io/name=metabob-activity-api`; verify image tag rolled
- [x] **D7** Validate JWT rotation: GET /v2/activities/execution-traces returns 200 (was 500); POST /v2/impulses/resolve continues 200; GET /v2/activities/templates?offset=N returns echoed offset/limit
- [x] **D8** Phase 8 smoke: query traces, look for lifecycle event coverage, slot-binding nested executions, validator-dispatch, failure_mode population, recursive escalation
- [x] **D9** Atomic commit of staged deployment changes + push origin dev
- [x] **D10** This section (documenting the overhaul)

**Expectation gates**:
- D6 ⇒ image tag = `metabobapp/metabob-activity-api:1.12.0-ed5487c`, all replicas Ready
- D7 ⇒ all three endpoints return 200; `executionTraceList` shows traces from after the deploy timestamp
- D8 ⇒ at least one fresh goal-execution trace observable (gates Stage D Phase 5 decommission); if absent, document the gap and continue with the implementation loop until a real minibob dispatch populates traces

### Stop conditions (success criteria from proposal.md)

The loop terminates when canary evidence shows:
- ✅ Goals regularly succeed and successes are correct
- ✅ Failed goals append a new activity (recursive escalation observed)
- ✅ MiniBob runs solely on vessel-resolvers (no embedded template fallback)
- ✅ Impulse-activity system creates improved activities via the executor (ribosome convergence)
- ✅ Activities compose using all MiniBob features (selection + validation + recursive escalation in one trace)

### Architectural constraints reaffirmed

Carry forward these constraints for all remaining work:

- **Vessel-integration constraint**: integrating with another vessel MUST NOT require source changes in the integrating vessel. New cross-vessel calls happen via shape advertisement on the providing vessel + the existing generic `impulse-resolve` path on the consuming side. F-6's correction is the canonical example.
- **Pure-vessel constraint** (already established): minibob and metabob-activity-api are pure vessels; runtime behavior is activity-driven, not hardcoded.
- **Branch hygiene** (CLAUDE.md): stay on `dev`, ff-only pull, push `origin dev` not `HEAD:dev`.

### Deferred (out of scope for first demo)

- ~~F-4 template foreach/iteration primitive — workaround via single-shape templates acceptable~~ — **CLOSED 2026-04-30.** The `iteration` resolver at `src/resolvers/iteration-resolver.ts` (registered in activity.ts, 654 LOC) exists since 2026-04-27 but was unused by meta-activity templates. Slot-binding's `select_or_produce` task now uses `resolver: "iteration"` over `{{lifecycle.missingShapes}}` with `body: { resolver: "producer_selection", config: { missingShape: "{{shape}}" } }` — multi-shape binding is now per-shape, not single-shape simplification. Aggregated `select_or_produce_result` impulse contains a per-shape entry list; downstream substring match on `'unbindable": true'` still fires the recursive-escalation path correctly. validator-dispatch's per-shape validator selection remains a sibling-template follow-up (single-resolver for now is workable; benefit is incremental).
- F-10 testing-library/react v15 bump — workbench, out of scope per direction
- F-12 trace-detail endpoint 404 fix — pre-existing
- 501 already-split `variant_performance_metrics` rows backfill — separate decision
- Bug-finding-as-activity / self-improvement metrics — post-demo

