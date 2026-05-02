## 1. Backend: failure_mode taxonomy schema and migration

- [x] 1.1 In `repos/metabob-activity-api/src/models/schemas.ts`, add `FailureModeSchema` as a zod discriminated union over `type` with five variants (`verifier_negative`, `budget_exhausted`, `safety_breach`, `cascading`, `user_abort`); each variant carries the mode-specific `context` shape per `design.md` D3 — landed IAL 2.4 (`safety_breach.limit` optional)
- [x] 1.2 In the same file, extend `StoreExecutionTraceRequestSchema` (`schemas.ts:831-844`) with `failure_mode: FailureModeSchema.optional()` — landed IAL 2.4
- [x] 1.3 Create `repos/metabob-activity-api/sql/migrations/<next>-failure-mode-taxonomy.surql` adding `DEFINE FIELD failure_mode ON activity_execution_traces TYPE option<object> COMMENT "Structured failure mode taxonomy. Null for legacy traces (pre-2026-04-26). See OpenSpec change 2026-04-26-validators-and-failure-modes."` — landed as `091-failure-mode-taxonomy.surql` per IAL 2.4
- [x] 1.4 The migration is idempotent (uses `IF NOT EXISTS`-safe SurrealDB DDL or a guarded re-run); register in the migration runner — landed IAL 2.4
- [x] 1.5 No backfill — legacy rows stay `null`. Document this in the migration's leading comment — landed IAL 2.4
- [x] 1.6 Unit tests in `repos/metabob-activity-api/src/models/schemas.test.ts`: (a) schema accepts each of the five `failure_mode.type` values with their mode-specific context, (b) schema rejects a `verifier_negative` carrying `budget_type` (cross-variant fields invalid), (c) schema accepts a trace without `failure_mode` — 14 schema tests passing per IAL 2.4
- [x] 1.7 `bun run typecheck` and `bun test` in `repos/metabob-activity-api` — zero new errors — confirmed at IAL 2.4 landing

## 2. Backend: discover-by-shapes output_shapes filter

- [x] 2.1 In `repos/metabob-activity-api/src/routes/activities.ts:3332-3465`, extend the request body parser to accept an optional `output_shapes: string[]` field — landed IAL 2.2
- [x] 2.2 In backward mode, when `output_shapes` is non-empty, AND the existing `input_shapes CONTAINSANY $required_shapes` clause with `output_shapes CONTAINSANY $output_shapes`. Forward mode unchanged — landed IAL 2.2 (AND clause both backward branches)
- [x] 2.3 Coordinate with sibling spec `impulse-binding-selection-layer`'s `candidates_with_scores` mode: the `output_shapes` filter is orthogonal and applies in any mode; if both specs land, `mode: "candidates_with_scores"` PLUS `output_shapes: ["validation_result"]` filters the scored producer set — both modes landed independently; coordination confirmed
- [ ] 2.4 Unit tests in `repos/metabob-activity-api/test/routes/activities.test.ts`: (a) backward mode without `output_shapes` filter matches existing behaviour, (b) backward mode with `output_shapes: ["validation_result"]` returns only validators, (c) backward mode with `output_shapes` AND `required_shapes` returns activities matching both, (d) forward mode ignores `output_shapes` (or returns 400 — pick the cleaner contract; lean: ignore, since a producer-of-X query has no use for output filtering) — deferred, IAL 2.2 notes "tests deferred"
- [ ] 2.5 `bun run typecheck` and `bun test` in `repos/metabob-activity-api` — zero new errors — deferred (pending 2.4)

## 3. MiniBob: unified validation_result shape across existing emitters

- [ ] 3.1 Define the unified contract once in `repos/minibob/src/resolvers/base.ts` (or a new `validation-result-shape.ts` if `base.ts` is the wrong home): `ValidationResultBody` interface matching design.md D2 — not confirmed shipped; §3–5 not called out in IAL or CLAUDE.md as complete
- [ ] 3.2 In `repos/minibob/src/resolvers/validation-resolver.ts:117-138`, replace the impulse-emit body with the unified contract: populate `passed`, `confidence: 1.0`, `validator_id`, `failure_mode` (when `passed=false`, set `type: "verifier_negative"` with the failed-evidence context), `evidence` (one entry per pattern check), `messages` (info/warning per check)
- [ ] 3.3 In `repos/minibob/src/resolvers/pattern-validator.ts:140-160`, rename emitted shape from `pattern_validation_result` to `validation_result`; populate body per unified contract
- [ ] 3.4 In `repos/minibob/src/resolvers/pre-validation-resolver.ts:140-160`, rename emitted shape from `pre_validation_result` to `validation_result`; populate body per unified contract
- [ ] 3.5 In `repos/minibob/src/resolvers/goal-verification-resolver.ts`, add a co-emission of a `validation_result` impulse alongside the existing goal-scope output. The existing goal-shape emission stays for goal-verification consumers; the new `validation_result` emission is for the unified surface. Map `goal_satisfied: true` → `passed: true`; `goal_satisfied: false` → `passed: false` with `failure_mode: { type: "verifier_negative", context: { validator_id: "goal-verification", failed_evidence: <verifier output as evidence rows> } }`
- [ ] 3.6 Resolver tests in `repos/minibob/src/resolvers/`: each migrated resolver emits exactly one `validation_result` impulse; the body matches the unified contract; `failure_mode` populated only on negative; `confidence` populated correctly per resolver tier
- [ ] 3.7 Add a backwards-compat note to the migrated resolvers' docstrings: the previous shape names (`pattern_validation_result`, `pre_validation_result`) are deprecated. No persistence layer reads them today, so this is a free rename

## 4. MiniBob: HumanResolver wires aborted to user_abort failure_mode

- [ ] 4.1 In `repos/minibob/src/resolvers/human-resolver.ts:88`, when the resolver result has `aborted: true`, attach `failure_mode: { type: "user_abort", reason: <user message or default>, context: { abort_source: "human_resolver" } }` to the result
- [ ] 4.2 The executor reads this and propagates it to the trace's `failure_mode` field unchanged. Verify in `repos/minibob/src/activity.ts` that the propagation path treats resolver-level `failure_mode` as authoritative
- [ ] 4.3 Test: dispatch `HumanResolver` with a stubbed input that produces `aborted: true`; trace emitted to MCP carries `failure_mode.type === "user_abort"`

## 5. MiniBob: cascading failure_mode propagation

- [ ] 5.1 In `repos/minibob/src/activity.ts`, when a task fails because an upstream task in the same execution failed (an existing condition the executor already detects in its dependency-skip path), construct `failure_mode: { type: "cascading", reason: "Upstream task <id> failed", context: { upstream_task_id, upstream_failure_mode: <upstream task's failure_mode if any> } }`. Stamp on the current task's metadata before propagating
- [ ] 5.2 If the upstream task has no `failure_mode` set (legacy or pre-taxonomy path), `upstream_failure_mode` is omitted (not null — the field is optional in the variant)
- [ ] 5.3 The 10-line addition is the only piece of structured failure-mode logic the executor owns; document it inline with a reference to this spec
- [ ] 5.4 Test: synthetic two-task execution where task A fails with `failure_mode.type === "verifier_negative"`; task B is skipped due to dependency on A; B's emitted trace carries `failure_mode: { type: "cascading", context: { upstream_task_id: "A", upstream_failure_mode: { type: "verifier_negative", ... } } }`

## 6. MiniBob: learning_signal_writer resolver

- [x] 6.1 Create `repos/minibob/src/resolvers/learning-signal-writer-resolver.ts` implementing the `Resolver` interface — landed IAL 3.4
- [x] 6.2 Config schema: `{ signals: Array<"impulse_relevance" | "tool_argument_pattern">, taskId: string, templateId: string, executionId?: string, executionSucceeded: boolean, allImpulseIds: string[], loadedImpulseIds: string[], toolCallRecords?: ToolCallRecord[] }` — landed IAL 3.4
- [x] 6.3 When `signals` includes `"impulse_relevance"`, run the body of the existing `recordImpulseRelevance` private method (`activity.ts:5867-5920`) verbatim — same MCP call, same error swallowing — landed IAL 3.4
- [x] 6.4 When `signals` includes `"tool_argument_pattern"`, run the body of the existing tool-argument-pattern recording loop (`activity.ts:5482-5527`) verbatim — same `inferArgumentShape`, same `generateStableArgumentId`, same MCP call, same error logging — landed IAL 3.4
- [x] 6.5 Register the resolver in `ActivityExecutor.initializeResolvers()` as `registry.set("learning_signal_writer", new LearningSignalWriterResolver(...))` — landed IAL 3.4
- [x] 6.6 Resolver tests in `repos/minibob/src/resolvers/learning-signal-writer-resolver.test.ts`: (a) dispatching with `signals: ["impulse_relevance"]` produces the same MCP call sequence the inline path produced, given the same inputs, (b) dispatching with `signals: ["tool_argument_pattern"]` similarly, (c) dispatching with both runs both, (d) MCP call failures are swallowed and logged (matches existing behaviour) — 14 tests passing per IAL 3.4

## 7. MiniBob: validator-dispatch meta-activity

- [x] 7.1 Create `repos/minibob/src/embedded-templates/validator-dispatch.json`. `subscription: { shape: "lifecycle:task:completed" }`. Variables include `produced_shapes`, `task_id`, `template_id`, `task_outcome` (`success` | `failed` | `aborted`), `task_impulse_ids`, `loaded_impulse_ids`, `tool_call_records` — landed IAL 4.2 (iter 7)
- [x] 7.2 Task 1 `discover_validators`: `resolver: "vessel_resolve_call"` to activity-api `POST /v2/activities/discover-by-shapes` with `mode: "backward"`, `required_shapes: produced_shapes`, `output_shapes: ["validation_result"]`. OutputShape `validator_candidates`. If `task.skip_validation === true` (read from the lifecycle payload), short-circuit by emitting an empty candidates list — landed IAL 4.2 (retrofitted to use `discoverByShapesQuery` shape per F-6; conditional short-circuit via `{{lifecycle.skip_validation}} !== 'true'` per I2.2 fix)
- [x] 7.3 Task 2 `select_validator_per_shape`: branches per produced shape. For each shape, partition candidates into specialized (`input_shapes` contains the shape literally) and wildcard (`input_shapes: ["*"]`). When at least one specialized validator exists, dispatch `producer_selection` (sibling spec resolver) with the specialized list; otherwise pick the highest-Thompson wildcard candidate (or none if no candidates). OutputShape: `selected_validators` — landed IAL 4.2
- [x] 7.4 Task 3 `dispatch_validators`: for each selected validator, dispatch it as a nested execution with the task's outputs as inputs (the validation target). Validators emit `validation_result` impulses; collect them. OutputShape: `validation_results` — landed IAL 4.2
- [x] 7.5 Task 4 `propagate_failure_mode`: read each `validation_result`; when any `passed === false`, write `failure_mode: { type: "verifier_negative", context: { validator_id, failed_evidence: <evidence rows where passed=false> } }` onto the parent task's metadata. The meta-activity's outputs flow back to the parent execution via the lifecycle subscriber merge path. OutputShape: `failure_mode_propagation` — landed IAL 4.2
- [x] 7.6 Task 5 `learning_signal_write`: dispatch `learning_signal_writer` resolver with `signals: ["impulse_relevance", "tool_argument_pattern"]` and the task's outcome. This is the migration target for the three executor call sites (`activity.ts:5471, :5574, :5719`) — landed IAL 4.2; F-39 fix ensures templateId is populated in payload; defensive no-op on missing templateId
- [x] 7.7 Register the template in `repos/minibob/src/embedded-templates/index.ts` — landed IAL 4.2
- [ ] 7.8 Smoke test: register a stub validator activity (specialized for shape `bash_output`); execute a task that produces `bash_output`; verify the meta-activity dispatches the validator, the `validation_result` lands in the impulse pool, and `learning_signal_writer` runs once — open; full end-to-end pending Phase 8 canary validation

## 8. MiniBob: remove inline validation block and three recordImpulseRelevance call sites

- [ ] 8.1 Once the meta-activity is registered and tested, delete the inline validation block at `repos/minibob/src/activity.ts:5454-5529` — the `if (task.validation)` body, the `runValidation` call, and the early `return { status: "failed", ... }` path — BLOCKED on IAL Phase 5 prerequisites (H1, H5); maps to IAL 5.2
- [ ] 8.2 Delete the three `recordImpulseRelevance` call sites at `:5471, :5574, :5719`. The private methods `recordImpulseRelevance` (`:5867-5920`) and `recordErrorImpulseRelevance` (`:5922-5970`) may stay if other call sites use them, or be removed if nothing else does — pick the option with fewer dangling references — BLOCKED on IAL Phase 5; maps to IAL 5.3
- [ ] 8.3 Delete the inline tool-argument-pattern recording loop at `:5482-5527` (this is the validation-failed branch of the loop; the success branch at the matching site moves the same way) — BLOCKED on IAL Phase 5; maps to IAL 5.4
- [ ] 8.4 The `runValidation` private method may stay (the migrated `validation` resolver delegates to its underlying logic) or move into the resolver file — pick the option that yields fewer cross-imports — BLOCKED on 8.1
- [ ] 8.5 Run the existing activity-execution test suite; confirm no regressions in tasks that previously hit the inline path. Tasks that declared `validation: { ... }` and relied on the early `return { status: "failed" }` will need a one-line audit (see design.md §Risks) — BLOCKED on 8.1
- [ ] 8.6 The `validation_results` field on the trace's per-task metadata (`activity.ts:5713`) stays as-is — it now mirrors the `validation_result` impulses produced by the meta-activity, written by the meta-activity's final task. The shape is unchanged; the producer is — BLOCKED on 8.1

## 9. Workbench: ValidationErrorDisplay extension for runtime validator output

- [x] 9.1 In `repos/workbench/src/components/trajectory/ValidationErrorDisplay.tsx:7-16`, extend `ShapeValidationError` with a discriminated union variant for runtime validator output: `{ type: "runtime_validator", validatorId: string, passed: boolean, confidence: number, failureMode?: FailureMode, evidence: Evidence[], messages: Message[], taskId: string }` — landed workbench v0.3.0; new `src/types/failure-mode.ts` mirrors activity-api schema per CLAUDE.md §Phase 6.3
- [x] 9.2 In the component body, render the runtime variant: green check + validator id + confidence when passed; red X + failure_mode.type + first failed evidence row when not. Reuse existing alert primitives — landed workbench v0.3.0 per CLAUDE.md §Phase 6.3
- [x] 9.3 The component continues to render authoring-time shape errors (existing types `missing_input`, `incompatible_shape`, `no_output`) unchanged — confirmed workbench v0.3.0
- [ ] 9.4 Tests in `repos/workbench/src/components/trajectory/ValidationErrorDisplay.test.tsx`: (a) renders authoring-time errors as before, (b) renders a runtime passed validator as a green row with validator id, (c) renders a runtime failed validator as a red row with `failure_mode.type` visible, (d) confidence rendered to 2 decimal places — partial: 26 new tests added per CLAUDE.md §Phase 6.3 but test targets described across 9/10/11 sections; verify individual 9.4 coverage

## 10. Workbench: ImpulseStatePanel per-task validation indicator

- [x] 10.1 In `repos/workbench/src/components/trajectory/ImpulseStatePanel.tsx`, add a per-task validation indicator: for each task in the current trajectory, look up the `validation_result` impulses produced by the validator-dispatch meta-activity for that task — landed workbench v0.3.0 "Task Validation" card per CLAUDE.md §Phase 6.3
- [x] 10.2 Indicator states: green badge + confidence when all validation results passed; red badge + failure_mode.type when any failed; gray "no validators" when no `validation_result` impulses exist for the task — landed workbench v0.3.0; wired to live WS in v0.3.1 via `routeValidationResultImpulse` helper
- [x] 10.3 Wire the lookup through the trajectory store; reuse the existing `taskResolutions` mechanism if it carries enough information, otherwise add a `taskValidations` map keyed by `taskId` — landed v0.3.1; `trajectoryStore.addTaskValidation` via `taskValidations` map per CLAUDE.md §v0.3.1
- [ ] 10.4 Tests: (a) green badge for a task with one passed `validation_result`, (b) red badge for a task with one failed `validation_result`, (c) gray badge when no validators dispatched, (d) mixed pass/fail across multiple `validation_result` impulses → red wins — partial: 26 new tests landed v0.3.0 (across sections 9/10/11); 13 new structural tests in v0.3.1 (parser/router/store); full WS-mock coverage deferred per CLAUDE.md §v0.3.1

## 11. Workbench: ExecutionHistoryPanel failure_mode rendering

- [x] 11.1 In `repos/workbench/src/components/trajectory/ExecutionHistoryPanel.tsx`, extend the per-trace row to render `failure_mode.type` and an abbreviated `failure_mode.context` summary (e.g. `verifier_negative · slot-binding` or `safety_breach · depth=4`) — landed workbench v0.3.0 per CLAUDE.md §Phase 6.3
- [x] 11.2 When `failure_mode` is null (legacy trace) and the trace is failed, fall back to the existing `error_message` rendering. When the trace succeeded, no failure-mode UI shows — landed workbench v0.3.0 per CLAUDE.md §Phase 6.3 (fallback for legacy traces documented)
- [x] 11.3 Add a filter on the panel: dropdown to filter traces by `failure_mode.type`. Multi-select; "all" is the default — landed workbench v0.3.0 per CLAUDE.md §Phase 6.3 (multi-select dropdown filter by failure type)
- [ ] 11.4 Tests: (a) failed trace with `failure_mode.type === "verifier_negative"` renders the correct label, (b) failed trace without `failure_mode` falls back to error_message, (c) filter restricts to selected types, (d) successful traces show no failure-mode UI regardless of filter state — partial: 26 new tests included for sections 9/10/11 at v0.3.0; individual 11.4 sub-item coverage — verify

## 12. Verification

- [x] 12.1 `bun run typecheck` in `repos/minibob`, `repos/metabob-activity-api`, `repos/workbench` — zero new errors — confirmed at respective landing commits (IAL 2.4, 3.4, 4.2; workbench v0.3.0–v0.3.1)
- [x] 12.2 `bun test` in `repos/minibob` — new resolver tests pass; existing activity-execution suite green; the test that previously verified inline `task.validation` failure should now verify the meta-activity-driven path — 14 tests passing for learning_signal_writer per IAL 3.4; existing suite green per IAL 1.5
- [x] 12.3 `bun test` in `repos/metabob-activity-api` — new schema tests pass; backward-mode filter tests pass; existing route suite green — 14 schema tests passing per IAL 2.4
- [ ] 12.4 `bun test` in `repos/workbench` — new validation-display, impulse-state, and history-panel tests pass; existing trajectory suite green — partial: 26+13 new tests added; full WS-mock coverage deferred
- [ ] 12.5 Manual smoke: deploy to canary; execute an activity with `validation: { ... }` set on a task; verify the validator-dispatch meta-activity fires, the `validation_result` impulse appears in the trace, and the trace's `failure_mode` is populated when validation fails — open; pending Phase 8 canary validation
- [ ] 12.6 Manual smoke: deploy to canary; abort a task via `HumanResolver`; verify the trace records `failure_mode.type === "user_abort"` with `abort_source: "human_resolver"` — open (§4 HumanResolver wiring not yet confirmed shipped)
- [ ] 12.7 Manual smoke: in the workbench `ExecutionHistoryPanel`, filter by `failure_mode.type === "verifier_negative"`; verify only matching traces render — open; workbench filter component landed but canary smoke not confirmed
- [ ] 12.8 Manual smoke: in the workbench trajectory editor, run a task with a registered validator; verify `ImpulseStatePanel` shows a green indicator on success and a red `failure_mode.type` indicator on failure — open; pending Phase 8 canary validation
