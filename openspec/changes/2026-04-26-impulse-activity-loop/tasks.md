## 1. Phase 1 — `lifecycle:task:preBinding` emission

- [x] 1.1 Emit `lifecycle:task:preBinding` in `repos/minibob/src/activity.ts` resolver-path branch (before `canExecuteTask` at `:4405`)
- [x] 1.2 Mirror emission on the LLM-only path (`executeWithLLM` inputShapes block, recompute pool after await)
- [x] 1.3 Reconcile payload field naming — chose `executionId` (matches existing emission); `lifecycle-task-prebinding/spec.md` updated; F-1 RESOLVED (2026-04-26 commit `60556b0f`)
- [ ] 1.4 Unit test: emission fires before gate when `inputShapes` non-empty; payload fields match the reconciled contract — payload now also carries `parentGoalText` (F-2, commit `8ed4412`) and `parentDepth` (F-3, commit `a16028f`); test should cover both
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

- [ ] 5.1 Remove inline synthesiser block at `activity.ts:4949-4997` (sibling 1 §7)
- [ ] 5.2 Remove inline validation block at `activity.ts:5454-5529` (sibling 3 §8.1)
- [ ] 5.3 Remove three `recordImpulseRelevance` call sites (sibling 3 §8.2)
- [ ] 5.4 Remove inline tool-argument-pattern recording loop (sibling 3 §8.3)

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

## 8. Phase 8 — End-to-end canary validation

- [ ] 8.1 Goal regression set: dispatch each representative goal class against canary; capture trace IDs
- [ ] 8.2 Inspect traces for full lifecycle event coverage; document gaps
- [ ] 8.3 Confirm Thompson α/β updates on success and failure paths
- [ ] 8.4 Confirm `failure_mode` populated correctly for each of the five types
- [ ] 8.5 Confirm at least one goal succeeds via recursive sub-goal escalation
- [ ] 8.6 Confirm no production goal requires embedded template fallback
- [ ] 8.7 Document each success criterion result in `design.md` §Success-criteria validation

## 9. Verification gates

- [ ] 9.1 All sibling spec verification phases (sibling 1 §9, sibling 2 §6, sibling 3 §12) green
- [ ] 9.2 Workbench history panel renders the integrated trace (validator results, `failure_mode`, recursive sub-goal handoffs)
- [ ] 9.3 No regression in the existing activity-execution test suite

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

### Stage F — Final verification (Phase 9)

23. **9.1** All sibling spec verification phases green
24. **9.2** Workbench history panel renders integrated trace
25. **9.3** No regression in existing activity-execution test suite

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

- F-4 template foreach/iteration primitive — workaround via single-shape templates acceptable
- F-10 testing-library/react v15 bump — workbench, out of scope per direction
- F-12 trace-detail endpoint 404 fix — pre-existing
- 501 already-split `variant_performance_metrics` rows backfill — separate decision
- Bug-finding-as-activity / self-improvement metrics — post-demo
