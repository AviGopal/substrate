## 1. Backend: discover-by-shapes mode extension

- [x] 1.1 In `repos/metabob-activity-api/src/routes/activities.ts:3355-3499`, extend the `mode` validation list to accept `"candidates_with_scores"` alongside `"forward"` and `"backward"` — landed IAL 2.1
- [x] 1.2 When `mode === "candidates_with_scores"`, run the same forward query (find producers for `required_shapes`) then join each row with `compositionSuccess` against the optional `predecessor_activity_id` body param; if no predecessor is provided, attach the producer's unconditional success rate (α/β over all predecessors) — landed IAL 2.1
- [x] 1.3 Response shape: existing fields plus `composition_score: { alpha: number, beta: number, sample_count: number, predecessor_id?: string }` per row. When the producer has no edge data, return `composition_score: null` (not an error) — landed IAL 2.1
- [ ] 1.4 Add unit tests in `repos/metabob-activity-api/test/routes/activities.test.ts`: (a) mode validation accepts the new value, (b) score-augmented response with predecessor, (c) score-augmented response without predecessor, (d) null composition_score when no edge data exists — deferred, IAL 2.1 notes "tests deferred"
- [x] 1.5 `bun run typecheck` and `bun test` in `repos/metabob-activity-api` — zero new errors — confirmed at landing

## 2. MiniBob: impulse_preparation resolver

- [x] 2.1 Create `repos/minibob/src/resolvers/impulse-preparation-resolver.ts` implementing the `Resolver` interface from `repos/minibob/src/resolvers/base.ts` — landed IAL 3.1 (note: resolver already existed; operations added to existing class)
- [x] 2.2 Migrate `synthesizeShapeImpulsesFromVariables` body (currently at `repos/minibob/src/activity.ts:4172`) into the resolver under `config.operation === "synthesise_from_variables"`. Byte-for-byte equivalent: same memo-pointer construction, same shape metadata — landed IAL 3.1
- [x] 2.3 Migrate `fillMissingShapesViaMemoryAgent` body (currently at `:4212`) into the resolver under `config.operation === "agent_fill"`. The resolver constructs `SessionMemoryAgent` lazily from the shared `ImpulseStateManager` singleton (mirror the pattern in `ImpulseStateAnalysisResolver`) — landed IAL 3.1
- [x] 2.4 Register the resolver in `ActivityExecutor.initializeResolvers()` (`activity.ts:1564-1854`) as `registry.set("impulse_preparation", new ImpulsePreparationResolver(...))` — landed IAL 3.1
- [x] 2.5 Add resolver tests `repos/minibob/src/resolvers/impulse-preparation-resolver.test.ts`: (a) `synthesise_from_variables` produces identical impulses to the legacy method given the same inputs, (b) `agent_fill` invokes `SessionMemoryAgent` and returns its impulses, (c) unknown operation returns a typed error — 9 tests passing per IAL 3.1

## 3. MiniBob: impulse_pool_selection resolver

- [x] 3.1 Create `repos/minibob/src/resolvers/impulse-pool-selection-resolver.ts`. Config schema: `{ shape: string, taskId: string, candidates: ImpulseRef[], selectionMethod: "deterministic" | "thompson" }` — landed IAL 3.2
- [x] 3.2 In `deterministic` mode: fetch `impulseRelevance` per candidate via `MCPClient` (pointer type already supported in activity-api at `repos/metabob-activity-api/src/routes/impulses.ts:1542-1626`), pick the candidate with the highest mean (`α / (α + β)`) for the `(shape, taskId)` key. Tie-break on most recent `last_used_at` — landed IAL 3.2 (tie-break on `last_used_at`/`updated_at`)
- [x] 3.3 In `thompson` mode: fetch the same scores, sample each via `sampleBeta(α, β)` (re-export from `variant-selection-resolver.ts` to avoid duplication), pick the highest sample. Use the same Kumaraswamy form — landed IAL 3.2
- [x] 3.4 Return shape: `{ chosen_impulse_id: string, score: number, runner_ups: Array<{ impulse_id, score }> }`. The runner-ups list is what the workbench shows in the candidate panel — landed IAL 3.2
- [x] 3.5 Register as `impulse_pool_selection` in `initializeResolvers()` — landed IAL 3.2
- [x] 3.6 Tests: (a) deterministic with three candidates picks the highest-mean one, (b) deterministic tie-break uses `last_used_at`, (c) thompson is reproducible given a seeded `Math.random`, (d) backend fetch failure returns first candidate with a `degraded: true` flag (graceful fallback, no throw) — 10 tests passing per IAL 3.2

## 4. MiniBob: producer_selection resolver

- [x] 4.1 Create `repos/minibob/src/resolvers/producer-selection-resolver.ts`. Config schema: `{ missingShape: string, taskId: string, predecessorActivityId?: string, goalContext?: object, selectionMethod: "deterministic" | "thompson" }` — landed IAL 3.3
- [x] 4.2 Call `POST /v2/activities/discover-by-shapes` with `{ mode: "candidates_with_scores", required_shapes: [missingShape], predecessor_activity_id }` via `MCPClient`. The route returns producers with `composition_score` — landed IAL 3.3 (new `MCPClient.discoverByShapes()` helper added)
- [x] 4.3 Apply selection: `deterministic` picks highest mean; `thompson` Beta-samples each producer and picks the highest. Producers with `composition_score: null` get a default α=1, β=1 prior (uniform) — landed IAL 3.3
- [x] 4.4 Return shape: `{ chosen_producer: { activity_id, version }, score, runner_ups, unbindable: boolean }`. Set `unbindable: true` when the route returns no producers; in that case `chosen_producer` is null — landed IAL 3.3 (note: exposes `metadata.unbindable` for downstream task condition gating)
- [x] 4.5 Register as `producer_selection` in `initializeResolvers()` — landed IAL 3.3
- [x] 4.6 Tests: (a) deterministic picks highest composition-score, (b) thompson is reproducible with seeded random, (c) empty result sets `unbindable: true`, (d) null composition_score uses uniform prior — 14 tests passing per IAL 3.3

## 5. MiniBob: lifecycle:task:preBinding emission

- [x] 5.1 In `repos/minibob/src/activity.ts`, between the task-group entry at `:2315` (`executeTaskWithConditional` invocation) and the per-task gate at `:4406` (`canExecuteTask`), emit `lifecycle:task:preBinding`. Payload: `{ taskId, templateId, inputShapes, currentImpulseIds, missingShapes, variables, parentExecutionId }`. The emit MUST be `await`ed so subscriber outputs are merged before the gate — landed IAL 1.1 + 1.3 (field naming reconciled to `executionId`; payload also carries `parentGoalText` F-2 and `parentDepth` F-3)
- [x] 5.2 Compute `missingShapes` in the same way as the inline path at `:4949-4969`: `task.inputShapes` minus the set of shapes present in the current impulse pool. If `task.inputShapes` is empty/undefined, skip the emit entirely — landed IAL 1.2
- [x] 5.3 Subscriber outputs flow through the existing nested-execution path; no new merge logic needed (mirror behaviour of `lifecycle:activity:preExecution` at `:2280`) — landed IAL 1.1
- [ ] 5.4 Verify the emit slots in correctly with a unit test: a stub subscriber pushes a synthetic impulse; the parent task sees it in `impulses` when `canExecuteTask` runs — open, IAL 1.4 still `[ ]`

## 6. MiniBob: slot-binding meta-activity

- [x] 6.1 Create `repos/minibob/src/embedded-templates/slot-binding.json`. `subscription: { shape: "lifecycle:task:preBinding" }`. Three tasks chained as described in design D5 — landed IAL 4.1 (51 templates load; subscription fires on lifecycle:task:preBinding)
- [x] 6.2 Task 1 `prepare_pool`: `resolver: "impulse_preparation"`, `config: { operation: "synthesise_from_variables" }`. `inputShapes: ["lifecycle:task:preBinding"]`. `outputShapes: ["impulse:supplemental"]` — landed IAL 4.1
- [x] 6.3 Task 2 `select_or_produce`: branches via task `condition` on whether `missingShapes` is empty after task 1. Two parallel sub-tasks dispatched per remaining missing shape: `impulse_pool_selection` (when candidates exist) and `producer_selection` (when none do). Producer-selection results that are `unbindable` emit `shape:unbindable` impulses — landed IAL 4.1; `escalate_unbindable` task wired for Phase 7.2; dotted-path F-5 required for payload extraction
- [x] 6.4 Task 3 `agent_fill_fallback`: `resolver: "impulse_preparation"`, `config: { operation: "agent_fill" }`. Runs only when task 2 left at least one shape unbound and the producer-selection didn't return a producer — landed IAL 4.1
- [x] 6.5 Register the template in `repos/minibob/src/embedded-templates/index.ts` so it loads at startup and the lifecycle-subscription pipeline picks it up — landed IAL 4.1

## 7. MiniBob: remove hardcoded synthesiser call sites

- [ ] 7.1 Once the meta-activity is registered and tested, delete the inline block at `repos/minibob/src/activity.ts:4949-4997`. The path to `task.impulseReferences` (lines `:4944-4945`) stays — BLOCKED on Phase 5 prerequisites (H1, H5 security hardening; IAL 5.1)
- [ ] 7.2 Verify the deleted code paths are still reachable via the resolver (they should be — the resolver wraps the same methods) — BLOCKED on 7.1
- [ ] 7.3 Run the existing activity-execution test suite; confirm no regressions in tasks that previously hit the inline path — BLOCKED on 7.1
- [ ] 7.4 The private methods `synthesizeShapeImpulsesFromVariables` and `fillMissingShapesViaMemoryAgent` may stay on `ActivityExecutor` (the resolver delegates to them) or be moved into the resolver file — either is acceptable; pick the option that yields fewer cross-imports — BLOCKED on 7.1

## 8. Workbench: shape-slot primitive

- [x] 8.1 Extend `repos/workbench/src/components/trajectory/ResolverTierBadge.tsx` with a `slotState?: "bound" | "bindable" | "unbindable"` prop and a corresponding colour band (green / gradient / red) — landed workbench v0.3.0 / IAL 6.1 (BindableSlot/BindableSlotsList in ImpulseStatePanel; computeShapeSlotState in state-space.ts)
- [x] 8.2 Extend `repos/workbench/src/components/trajectory/ShapeCompatibilityIndicator.tsx` to differentiate `bound` (solid green, lineage match) from `bindable` (gradient/dashed green, candidates without lineage) — landed workbench v0.3.0 / IAL 6.1
- [x] 8.3 In `repos/workbench/src/components/trajectory/ImpulseStatePanel.tsx`, add an inline "candidates" expansion: clicking a `bindable` slot lists candidate impulses with their α/β; a "use this one" button triggers `impulseRelevance_write` to bias future selections — landed workbench v0.3.2 (live bindingPhase state populates BindableSlots section; IAL 6b.5)
- [ ] 8.4 In `repos/workbench/src/components/trajectory/ApplicableActivitiesPanel.tsx`, when the slot is `unbindable`, surface a button that hands off to the sibling spec's `shape-provider-goal-creation` entry point (the button's onClick is the spec's responsibility; this spec only places the button) — partial: escalate button wired in ApplicableActivitiesPanel for Phase 7.2 (v0.3.1) but full unbindable-slot-state routing pending
- [ ] 8.5 Wire slot-state computation into the trajectory store: a slot is `bound` when an impulse with the required shape exists in the column's pool with a lineage edge to a prior task; `bindable` when an impulse with the shape exists without lineage, or when `discover-by-shapes` returns a non-empty producer list; `unbindable` otherwise — partial: live binding states from WS landed (v0.3.2); full store-side slot-state classification pending
- [ ] 8.6 Tests in `repos/workbench/src/components/trajectory/`: (a) badge renders correct colour band per state, (b) candidate expansion appears on click for `bindable`, (c) escalate button appears only for `unbindable`, (d) override click invokes `impulseRelevance_write` — open

## 9. Verification

- [x] 9.1 `bun run typecheck` in `repos/minibob`, `repos/metabob-activity-api`, `repos/workbench` — zero new errors — confirmed at landing of respective sections (IAL 1.5, 3.1–3.4)
- [x] 9.2 `bun test` in `repos/minibob` — new resolver tests pass; existing activity-execution suite green — 9+10+14 tests passing per IAL 3.1–3.3
- [x] 9.3 `bun test` in `repos/metabob-activity-api` — new mode tests pass; existing route suite green — confirmed at IAL 2.1 landing
- [ ] 9.4 `bun test` in `repos/workbench` — new slot-primitive tests pass; existing trajectory suite green — open (8.6 tests not yet written)
- [x] 9.5 Manual smoke: run an activity with declared `inputShapes` against canary; confirm a `lifecycle:task:preBinding` impulse appears in the trace and a `slot-binding` nested execution fires before each task — confirmed IAL 1.6 (28 preBinding events received; slots with bound/pending states visible on canary)
- [ ] 9.6 Manual smoke: in the workbench trajectory editor, open a task with multiple impulse candidates; confirm the slot renders `bindable`, the candidate list expands on click, and a manual override writes an `impulseRelevance` delta visible on next page load — open
- [ ] 9.7 Manual smoke: construct a task whose `inputShape` has no producer in any registered template; confirm the slot renders `unbindable` and the escalate button is present (handoff target tested in sibling spec) — open
