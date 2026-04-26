## 1. Phase 1 — `lifecycle:task:preBinding` emission

- [x] 1.1 Emit `lifecycle:task:preBinding` in `repos/minibob/src/activity.ts` resolver-path branch (before `canExecuteTask` at `:4405`)
- [x] 1.2 Mirror emission on the LLM-only path (`executeWithLLM` inputShapes block, recompute pool after await)
- [ ] 1.3 Reconcile payload field naming (`executionId` vs `parentExecutionId`) with sibling 1's `lifecycle-task-prebinding/spec.md`
- [ ] 1.4 Unit test: emission fires before gate when `inputShapes` non-empty; payload fields match the reconciled contract
- [x] 1.5 `bun run typecheck` in `repos/minibob` — zero new errors (iterations 1 and 2)
- [ ] 1.6 Canary smoke: dispatch a goal whose first task has `inputShapes`; confirm a `lifecycle:task:preBinding` impulse is visible in the trace at `activity.metabob.com`

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
- [ ] 4.2 `validator-dispatch.json` (sibling 3 §7) — queued; depends on infra gap A fix to be useful end-to-end

## 5. Phase 5 — Decommission inline executor logic

- [ ] 5.1 Remove inline synthesiser block at `activity.ts:4949-4997` (sibling 1 §7)
- [ ] 5.2 Remove inline validation block at `activity.ts:5454-5529` (sibling 3 §8.1)
- [ ] 5.3 Remove three `recordImpulseRelevance` call sites (sibling 3 §8.2)
- [ ] 5.4 Remove inline tool-argument-pattern recording loop (sibling 3 §8.3)

## 6. Phase 6 — Workbench surfaces

- [ ] 6.1 Shape-slot primitive (sibling 1 §8)
- [ ] 6.2 Spawn-subgoal affordance (sibling 2 §4)
- [ ] 6.3 Validation surface extensions (sibling 3 §9, §10, §11)

## 7. Phase 7 — Recursive escalation

- [ ] 7.1 `create-shape-provider-goal` activity authored and registered (sibling 2 §3)
- [ ] 7.2 Slot-binding meta-activity escalates via `create-shape-provider-goal` on `unbindable`

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

- [ ] 10.1 **`relevance_feedback` NULL coercion failure** — `POST /v2/activities/relevance-feedback` returns 204 but the audit row is never written when optional fields (`context_bucket`, `reason`, `correlation_id`) are absent. Fix: change `?? null` to `?? undefined` for those three fields in the `CREATE relevance_feedback` params so SurrealDB 3.x receives `NONE` instead of a rejected `NULL` value. File: `repos/metabob-activity-api/src/routes/activities.ts`.
- [ ] 10.2 **Auth middleware ordering on relevance-feedback route** — unauthenticated `POST /v2/activities/relevance-feedback` returns `500` with a Hono context lifecycle error instead of `401 Unauthorized`. Fix: apply the API-key auth middleware to this route before the handler, consistent with `/feedback` and `/recommend`. File: `repos/metabob-activity-api/src/routes/activities.ts`.
- [ ] 10.3 **Fix `acquire-error-log-context` (10/10 failure)** — Root cause: task variables named `executionTraceId`/`logFilePath` do not match declared input shapes `execution_trace`/`trace`, so binding always fails. Fix: add a resolver task at the front that reads `activityExecutionTrace` shape and binds the correct variable names, OR rename the template's internal variables to match shape names. Template registration is in activity-api or minibob embedded templates. No dependency on other items.
- [ ] 10.4 **Fix α/β write-back bug on `goal-processing-activity-driven`** — 501 executions are not reflected in the template record's `thompson_alpha`/`thompson_beta` fields. Root cause: SurrealDB record ID format mismatch in the `UPSERT variant_performance_metrics` path (documented in CLAUDE.md §Bug fix: Variant family lookup). Fix: use `meta::id(id) = $base_id` pattern in the variant-performance upsert query, mirroring the fix already applied to `getVariantFamily`. File: `repos/metabob-activity-api/src/routes/activities.ts` or the relevant SurrealDB query helper. Sequencing: blocks Thompson Sampling convergence; fix before Phase 8 canary validation.

## Registry Cleanup (prerequisite for Phase 8)

- [ ] 11.1 **Delete 18 shadow templates with doubly-nested record IDs** — Templates stored as `activity:⟨activity:⟨slug⟩⟩` are malformed duplicates caused by a past registration bug. Delete via `DELETE /v2/activities/templates/:id` (or `activityTemplate_deprecate` write resolver) for each affected id. Run first: these pollute Thompson Sampling and make `templateAuditReport` results noisy. Prerequisite for 11.3 and 11.4.
- [ ] 11.2 **Delete 47 unvalidated ribosome variants, especially 14 `health-check` variants emitting `stdout` instead of `health_report`** — These were created by the ribosome pattern without output-shape validation. The `health-check` variants are particularly harmful: Thompson Sampling routes real health-check goals to them, which emit a non-queryable shape. Delete via `activityTemplate_deprecate` write resolver or direct API calls. Sequencing: run after 11.1 (shadow templates already gone); prerequisite for 11.4.
- [ ] 11.3 **Mass-deprecate 2,343 improvised DB templates with completeness_score < 0.5** — Use `templateAuditReport` resolver to page through all templates; batch-deprecate all with `completeness_score < 0.5` via `activityTemplate_deprecate` write resolver. Sequencing: run after 11.1 so shadow templates are excluded from the audit scan. Non-blocking for other items but reduces Thompson noise before Phase 8.
- [ ] 11.4 **Seed hand-verified executions for `fix-bug-complete`, `add-feature-complete`, `refactor-with-tests`** — Each domain template needs at least one hand-verified execution so Thompson Sampling has a non-prior α/β. Method: dispatch each template via MiniBob against a known test case, verify the output, record the trace. Sequencing: depends on 11.1 and 11.2 (clean registry first); these are the core domain templates the impulse-activity loop routes production goals to.
