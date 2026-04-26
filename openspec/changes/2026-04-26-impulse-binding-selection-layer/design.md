## Context

MiniBob and metabob-activity-api are supposed to be pure vessels: their runtime behaviour is driven by activities, not by source. Two binding decisions currently break that invariant.

Inside `ActivityExecutor`, when a task declares `inputShapes` and the impulse pool doesn't satisfy them, the executor does this directly (`repos/minibob/src/activity.ts:4949-4997`):

1. Walk `task.inputShapes`, collect the missing ones.
2. Call `this.synthesizeShapeImpulsesFromVariables(missingShapes, variables)` (`:4172`) — wraps same-named variable values in memo-pointer impulses.
3. For shapes still missing, call `this.fillMissingShapesViaMemoryAgent(task, variables, stillMissing, impulses)` (`:4212`) — invokes `SessionMemoryAgent` (`repos/minibob/src/memory-agent.ts`), which in turn calls an LLM to fabricate impulses from session memory.
4. Concatenate, dedupe by id, push into the shared `impulses` array.

Pool selection (when multiple impulses already match a shape) isn't even a function — `canExecuteTask` (`:4406`) just sees the array and downstream tools take whichever impulse the LLM happens to reference.

Both decisions are first-order: they directly determine which input the next task sees. Neither is observable in the trace beyond the resulting impulse list, neither can learn, and neither can be edited or overridden from the workbench.

The lifecycle infrastructure to fix this already exists. Activities subscribe to lifecycle impulses via `template.subscription` (`repos/minibob/src/types.ts:752`). The executor emits five lifecycle events today (`lifecycle:execution:tick`, `:activity:preExecution`, `:activity:postExecution`, `:activity:failure`, `:task:started`, `:task:completed`); subscribers fire as nested executions ranked by the same Thompson + relevance machinery as primary selection. We add one event and three resolvers, and rewire the executor to emit-not-call.

## Goals / Non-Goals

**Goals**

- Pool selection becomes a resolver call. Multiple candidates for a shape are ranked, the choice is recorded in the trace, and the workbench can show alternatives.
- Producer selection becomes a resolver call. When no impulse exists, the chosen producer activity is recorded and the workbench can show alternatives.
- The hardcoded synthesiser paths in `ActivityExecutor` move into a template-dispatchable resolver. The executor calls no selection code directly; it emits a lifecycle event and a meta-activity does the work.
- The workbench gains a slot-binding primitive that renders the three states (bound / bindable / unbindable) and surfaces override controls.
- Adding a new selection strategy (e.g. cost-aware producer ranking) requires only a new resolver and a new variant of the meta-activity. No edits to `activity.ts`.

**Non-Goals**

- Goal-creation when a shape is unbindable belongs to the sibling spec `shape-provider-goal-creation`. This spec only signals the escalation point; it does not propose, generate, or store a goal.
- No changes to the shape system itself. Shapes are still learned, open-ended strings; we don't pin a registry or change the metadata contract.
- No changes to the canonical executor flow outside the new lifecycle emit and the deletion of the two call sites.
- No new HTTP endpoints. The `discover-by-shapes` extension is a new mode on the existing route.
- No client SDK changes; resolvers consume `MCPClient` the same way `VariantSelectionResolver` does.
- No multi-tenant or RBAC changes. The new mode reads the same tables under the same PERMISSIONS clauses.

## Decisions

### D1: New lifecycle event `lifecycle:task:preBinding` (Path 1, full pure-vessel)

**Decision**: Add one emission point in `ActivityExecutor` between the task-group entry at `repos/minibob/src/activity.ts:2315` and the `canExecuteTask` gate at `:4406`. The payload includes `taskId`, `templateId`, `inputShapes`, `currentImpulseIds`, `missingShapes`, `variables`, and the parent execution id. Subscribers (the slot-binding meta-activity and any future variants) run as nested executions before the gate; their output impulses are merged into the pool exactly as `lifecycle:activity:preExecution` subscribers do today (`:2280`).

**Why**: The existing lifecycle pipeline already merges nested-execution outputs back into the parent pool. Reusing it costs ~5 lines in `activity.ts` and zero new infrastructure. The alternative — calling resolvers directly from the executor — would re-couple selection logic to the executor.

**Alternatives considered**:

- *Option A: keep selection inline, add config knobs* — minimum churn, but every new strategy still edits the executor. Rejected: violates pure-vessel.
- *Option B: emit at `lifecycle:task:started` and let the started subscriber correct mid-task* — simpler emit point, but the gate at `:4406` already runs before the first subscriber output can land. Rejected: subscribers must run before `canExecuteTask`, not after.
- *Option C (selected): new event between group entry and the gate* — minimal, ordered correctly, reuses every existing pipeline.

### D2: Two selection resolvers, not one

**Decision**: Ship `impulse_pool_selection` (chooses among existing impulses for a shape) and `producer_selection` (chooses an activity to produce a missing shape) as separate resolvers. Both follow the canonical pattern at `repos/minibob/src/resolvers/variant-selection-resolver.ts:160-230` (deterministic Beta sample, optional thompson mode, MCP-backed score lookup).

**Why**: They consult different backend shapes (`impulseRelevance` vs `compositionSuccess`), have different inputs (impulse list vs missing shape + goal), and have different outputs (impulse id vs activity reference). Forcing them into one interface obscures the asymmetry. Their config schemas are similar enough (`{ selectionMethod: "deterministic" | "thompson", taskId, shape }`) that templates can chain them with the same idioms.

### D3: `discover-by-shapes` gets a new mode, not a new endpoint

**Decision**: Extend the existing `POST /v2/activities/discover-by-shapes` route (`repos/metabob-activity-api/src/routes/activities.ts:3355-3499`) with a third `mode` value: `candidates_with_scores`. In this mode the handler runs the same forward query (find producers for `required_shapes`) but joins each result with the producer's `compositionSuccess` edge weights against the caller-supplied `predecessor_activity_id` (when present) or the unconditional success rate otherwise. Response shape: existing fields plus a `composition_score: { alpha, beta, sample_count, predecessor_id?: string }` per row.

**Why**: We never want a single-purpose query endpoint — that's the foundation drift the project explicitly warns about. The `mode` parameter already discriminates `forward` vs `backward`; one more value is idiomatic. Reading `compositionSuccess` (which the route doesn't currently touch) reuses the impulse-resolver code path at `:1488-1540`.

**Alternatives considered**:

- New endpoint `POST /v2/activities/rank-producers` — rejected, adds surface area for one query.
- Separate `compositionSuccess` resolver call from `producer_selection` — rejected, doubles the round-trip count for every binding decision.

### D4: `impulse_preparation` resolver wraps the existing synthesisers

**Decision**: The two private methods at `repos/minibob/src/activity.ts:4172` and `:4212` move out of `ActivityExecutor` and into `repos/minibob/src/resolvers/impulse-preparation-resolver.ts`. The resolver's config supports two operations:

- `synthesise_from_variables` — pure, byte-for-byte equivalent to `synthesizeShapeImpulsesFromVariables`.
- `agent_fill` — wraps `SessionMemoryAgent.fillMissingShapes` (or whatever method the agent exposes today). The agent itself is *not* an executor field anymore; the resolver constructs it lazily from the shared `ImpulseStateManager`, the same pattern `ImpulseStateAnalysisResolver` uses (`activity.ts:1595`).

**Why**: Migration over rewrite. The math is preserved; only the call site changes. `SessionMemoryAgent` is left in place so the LLM-backed intent analysis still has a home — it just stops being a private method of the executor.

### D5: Slot-binding meta-activity is the wiring template

**Decision**: A new embedded template `slot-binding.json` subscribes to `lifecycle:task:preBinding` and dispatches three tasks:

1. `prepare_pool` — `resolver: "impulse_preparation"`, op `synthesise_from_variables`. Cheap, deterministic, runs unconditionally.
2. `select_or_produce` — branches:
   - If `missingShapes` is empty after prepare, call `impulse_pool_selection` per shape with multiple candidates (no-op when only one candidate).
   - If `missingShapes` is non-empty, call `producer_selection` for each missing shape. If the resolver returns a producer activity ref, dispatch it as a nested execution; if it returns `unbindable`, emit a `shape:unbindable` impulse for the workbench to render and the sibling spec's goal-creation activity to consume.
3. `agent_fill_fallback` — `resolver: "impulse_preparation"`, op `agent_fill`. Runs only when `missingShapes` remained after step 2 and the producer-selection resolver yielded no candidate. Bounded LLM cost: this is the LLM-resolver-of-last-resort.

The template structure mirrors `goal-processing-activity-driven.json`. Task chaining uses the same `inputShapes` / `outputShapes` flow the trajectory editor already understands.

**Why**: One template, three swappable resolvers. New strategies (e.g. cost-weighted producer choice) ship as new variants of this template; Thompson Sampling on `subscription`-matched activities (the existing mechanism) picks the variant.

**Success/failure recording**: `select_or_produce` records its own outcome via the unified `validation_result` shape defined by sibling spec `validators-and-failure-modes` — `passed: true` when binding resolves, `passed: false` with `failure_mode: { type: "verifier_negative", context: { validator_id: "slot-binding", ... } }` when no candidate could be selected. The `shape:unbindable` impulse remains the workbench escalation signal; the `validation_result` is the learning-signal record.

### D6: Workbench slot primitive extends existing components

**Decision**: No new component tree. The three slot states render via attribute additions to existing trajectory primitives:

- `ResolverTierBadge.tsx` — already shows resolver tier; extend with a `slotState?: "bound" | "bindable" | "unbindable"` prop that drives a colour band on the badge.
- `ShapeCompatibilityIndicator.tsx` — already renders the green/red shape match. Extend the green case to differentiate `bound` (lineage-match) from `bindable` (candidates exist, no lineage yet) using a gradient/dashed treatment.
- `ImpulseStatePanel.tsx` — already shows the impulse pool per column. Add a candidate-list expansion when the user clicks a `bindable` slot: lists each candidate impulse with its `impulseRelevance` α/β and a "use this one" button. Clicking writes via `impulseRelevance_write` (existing endpoint, see §`Backend dependencies` below) and re-runs `impulse_pool_selection` on next execution.
- `ApplicableActivitiesPanel.tsx` — already shows producers. For `unbindable` slots, surface an "escalate to goal-creation" button; the click hands off to the sibling spec's `shape-provider-goal-creation` flow.

**Why**: The trajectory editor already encodes shape lineage. Reusing its primitives keeps the binding UI co-located with the rest of the slot rendering. A new component would fragment the visual language.

## Risks / Trade-offs

- **Risk**: Subscribers to `lifecycle:task:preBinding` accumulate cost on every task entry, even when the pool already satisfies all shapes. **Mitigation**: the meta-activity's first task is the cheap `synthesise_from_variables` op; the producer-selection branch only runs when `missingShapes` is non-empty. Templates with no `inputShapes` skip the event entirely (mirror the existing condition at `activity.ts:4405`).
- **Risk**: Pool-selection α/β tracked per `(shape, taskId)` requires a new index on `impulseRelevance`. **Mitigation**: the existing schema already keys relevance by `(impulse_id, task_id)`. We aggregate at read time; no migration needed in the first pass. If aggregation hot-spots, add a denormalised view in a follow-up.
- **Risk**: `SessionMemoryAgent` LLM call inside `impulse_preparation.agent_fill` is still inside MiniBob source. **Mitigation**: it's now behind a resolver boundary, so swapping it for a different agent (or calling a remote vessel) is a one-resolver change, not an executor edit. The LLM-as-tool principle is preserved.
- **Risk**: The slot-binding meta-activity is a single point of failure: if it crashes, every task inheriting `inputShapes` gates fail. **Mitigation**: the `canExecuteTask` gate at `:4406` is unchanged. If the subscriber fails to enrich the pool, the existing LLM-fallback path at `:4408` still runs. The new behaviour is strictly additive.
- **Trade-off**: The new mode on `discover-by-shapes` joins composition-success per row, which is more expensive than the current bare query. Acceptable: producer selection is the rarer path (synthesise_from_variables handles most cases), and the join is a small fan-out per request.

## Backend dependencies

- `POST /v2/impulses/resolve` with `pointer.type = "impulseRelevance"` (`repos/metabob-activity-api/src/routes/impulses.ts:1542-1626`) — read by `impulse_pool_selection`.
- `POST /v2/impulses/resolve` with `pointer.type = "compositionSuccess"` (`:1488-1540`) — read by `producer_selection`.
- `POST /v2/activities/discover-by-shapes` with `mode: "candidates_with_scores"` (new; this spec) — read by `producer_selection`.
- `POST /v2/impulses/resolve` with `pointer.type = "impulseRelevance_write"` — written by the workbench manual-override path (existing endpoint, see learning-loop write resolvers list in root CLAUDE.md).

No new endpoints, no new tables, no schema migrations.

## Open Questions

- **Selection-method default**: should the slot-binding meta-activity default to `deterministic` (highest relevance wins) or `thompson` (Beta sample) on first ship? Argument for deterministic: reproducible traces, easier to debug. Argument for thompson: faster learning, matches the rest of the system. *Lean: deterministic in the embedded template; expose `thompson` as a variant.*
- **`shape:unbindable` impulse shape**: is this a new shape, or do we reuse an existing escalation shape? Sibling spec owns the answer; flagged here so we don't ship a name conflict.
- **Pool-selection telemetry granularity**: do we record one Thompson update per pool decision, or aggregate per task? Per-decision gives faster learning but explodes the trace. *Lean: per-decision, but add a backend coalescing pass when the relevance write rate exceeds N/sec.*
- **Should `impulse_preparation.agent_fill` run inside the meta-activity, or be promoted to its own subscriber template?** Promotion would let Thompson choose between the cheap and expensive paths. *Lean: keep inside the same template for the first ship; promote to its own subscriber if the trace shows the agent_fill branch dominating cost.*

## Validation findings

Findings specific to this sibling spec's scope. Cross-cutting findings live in the umbrella `impulse-activity-loop` spec.

#### F-16: `select_or_produce` simplified to producer_selection only (no per-shape branching)
**Observation:** Sibling spec D5 calls for `select_or_produce` to branch between `impulse_pool_selection` (when candidates exist for a missing shape) and `producer_selection` (when none exist). The shipped template (`slot-binding.json`) uses `producer_selection` as the single default branch — the per-shape pool-vs-producer distinction isn't expressible in the current template format and is collapsed to a single resolver call.
**Impact:** When the impulse pool already contains candidates for a missing shape, slot-binding still queries producers rather than ranking the existing candidates. The pool branch is documented but deferred.
**Proposed fix:** Either (a) ship a sibling variant template `slot-binding-pool` that runs `impulse_pool_selection` first, OR (b) wait for foreach (umbrella F-4) and run both per-shape inside one template. Thompson Sampling on lifecycle subscribers will pick the variant that wins.
**Origin:** iter 6 / Subagent H (slot-binding `metadata.openQuestions[1]` and task description).
**Affected files:** `repos/minibob/src/embedded-templates/slot-binding.json`.

#### F-17: `agent_fill_fallback` conditional uses substring-match on resolver result content
**Observation:** The `agent_fill_fallback` task gates on `{{impulse:select_or_produce_result}} contains 'unbindable": true'` — a substring match against the JSON-stringified resolver output. Same pattern used by the `escalate_unbindable` task.
**Impact:** Tightly couples the conditional to the resolver result format; any change to `producer_selection`'s output JSON breaks the fallback path silently.
**Proposed fix:** Expose typed conditional primitives (e.g. `condition: { impulse_field: 'unbindable', equals: true }`), OR introduce a deterministic flag-extraction resolver that emits a top-level boolean impulse the conditional can match cleanly.
**Origin:** iter 6 / Subagent H, iter 13 / Subagent Q (slot-binding `metadata.limitations`).
**Affected files:** `repos/minibob/src/embedded-templates/slot-binding.json`.

#### F-18: `impulse_pool_selection` reads via typed MCP helper, not the markdown pointer-resolve
**Observation:** Sibling spec D2 / §3 references the `impulseRelevance` impulse pointer-resolve path at `repos/metabob-activity-api/src/routes/impulses.ts:1542`. The shipped resolver uses the typed `MCPClient.queryImpulseRelevance` helper instead of the markdown pointer-resolve route — sensible (typed > parsed-markdown) but worth flagging if the spec strictly requires the pointer-resolve API.
**Impact:** Reads same backend data; differs only in serialisation path. Concern is purely contract-fidelity.
**Proposed fix:** Update the spec's §3 wording to allow either path, OR refactor the resolver to use the markdown pointer-resolve route.
**Origin:** iter 5 / Subagent E.
**Affected files:** `repos/minibob/src/resolvers/impulse-pool-selection-resolver.ts`, `openspec/changes/2026-04-26-impulse-binding-selection-layer/specs/...`.

#### F-19: `impulse_preparation.interpolate` callback wiring not yet threaded
**Observation:** The `impulse_preparation` resolver accepts an optional `interpolate` callback through config. When absent (the current state for slot-binding's invocations), the resolver uses raw template strings. Phase 6 / Phase 7.2 ideally thread the executor's interpolate function through.
**Impact:** Synthesised impulses from `synthesise_from_variables` may carry un-interpolated `{{...}}` placeholders if the template variable values themselves are interpolation expressions.
**Proposed fix:** Have the lifecycle dispatcher pass the executor's `interpolate` bound to the parent execution's variable scope into the resolver config when invoking `impulse_preparation`.
**Origin:** iter 4 / Subagent D, tasks.md §3.1 "Open" note.
**Affected files:** `repos/minibob/src/resolvers/impulse-preparation-resolver.ts`, `repos/minibob/src/activity.ts:1249-1273`.
