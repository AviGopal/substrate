## Approach

Goal creation is treated as a shape-producer activity, not a special control-flow primitive. The activity `create-shape-provider-goal` consumes a missing-shape signal and emits an impulse whose shape is `goal` and whose body declares `endpoint_output_shapes: [target_shape]`. When that goal is dispatched, the existing variant-selection mechanism (already filtering by `expectedOutputShapes` per `repos/minibob/src/embedded-templates/goal-processing-activity-driven.json`) picks an activity that produces the target shape. The recursion bottoms out when an executable producer exists in scope.

This keeps the system activity-driven: minibob and metabob-activity-api stay pure vessels. No new TypeScript runtime path is introduced for "goal creation"; the new behavior lives in (a) one embedded JSON template and (b) one denormalized SurrealDB field with backfill.

## Goal-as-shape-producer framing

A goal is an impulse of shape `goal`. Today the body is mostly opaque text plus category. This change formalizes one body field on the emitted goal-shaped impulse:

```
goal {
  text: string                          // human-readable goal text (LLM-composed)
  category: 'feature' | ... | 'meta'    // existing
  endpoint_output_shapes: string[]      // NEW: terminal shapes the dispatched path must produce
  parent_execution_id?: string          // for composition_chain tracking
  depth: number                         // recursion depth counter
  remaining_budget_usd?: number         // propagated from parent
}
```

The `endpoint_output_shapes` field is consumed by the existing variant-selection step in `goal-processing-activity-driven` — it is the same `expectedOutputShapes` filter that already routes "write markdown" goals away from `execute-shell-command`. No new selection logic; the field just travels through the existing pipe with a stronger constraint.

## Five signal sources (the resolver chain)

The activity's task chain is ordered by signal strength. Each task is a resolver dispatch; outputs accumulate as impulses that feed the final LLM goal-text composer.

### Signal 1: Forward chain via `discover-by-shapes`

`POST /v2/activities/discover-by-shapes` at `repos/metabob-activity-api/src/routes/activities.ts:3355-3499` already returns activities that produce a given shape, with Thompson α/β attached. The first task in `create-shape-provider-goal` calls `activity_recommendation` resolver scoped to `required_shapes: [target_shape]` in forward mode. If the response contains high-confidence producers (`confidence > 0.6`), the goal text composer can be terse — selection downstream picks one. If the response is empty or low-confidence, the chain falls through to the remaining signals to enrich the goal text so an LLM-driven decomposer downstream has more to work with.

### Signal 2: Existing goal paths with terminal output = `target_shape`

Goal paths today track `path_activities[*]` and recompute endpoint state on the fly via `predictEndpointState` at `repos/metabob-activity-api/src/routes/goal-paths.ts:112-181`. That works for inferring "what does this path produce" from the activity outputs but is not queryable by output shape — every lookup is text-keyword based via `inferShapesFromGoal` at `repos/metabob-activity-api/src/routes/goal-paths.ts:187-217`.

The schema change in `goal-execution-paths-endpoint-shapes` adds:

- A new field `endpoint_output_shapes: array<string>` on `goal_execution_paths` (extends `repos/metabob-activity-api/sql/003-goal-execution-paths.surql`)
- An index on `endpoint_output_shapes` for `CONTAINSANY` queries
- A backfill that, for each existing row, joins to `activity` records via `path_activities`, accumulates `output_shapes`, and writes the denormalized union into the new field
- Path-recording code in `goal-paths.ts` writes the field on insert/update using the same accumulation as `predictEndpointState` (factor it into a shared helper rather than duplicating the loop)

The second task in `create-shape-provider-goal` issues a `vessel_resolve_call` to activity-api with shape `goalExecutionPath` and filter `endpoint_output_shapes CONTAINSANY [target_shape]`. Successful prior paths are signal that this shape gap has been closed before; the goal text can reference the canonical path.

### Signal 3: Concept-db lookup

The third task calls `concept-db` (vessel at `repos/concept-db/`) via `vessel_resolve_call` with shape `relatedConcepts` and key `target_shape`. Concept-db returns related concepts, sibling shapes, and usage contexts. This is enrichment for the LLM composer — it grounds the goal text in the conceptual neighborhood of the missing shape so an LLM-driven decomposer downstream can produce a more specific subgoal than "produce shape X."

### Signal 4: Impulse co-occurrence

The fourth task dispatches `ImpulseCooccurrenceResolver` (at `repos/minibob/src/resolvers/impulse-cooccurrence-resolver.ts`, registered via `repos/minibob/src/resolvers/index.ts`). It identifies which `available_shapes` historically co-occur as inputs to producers of `target_shape` — i.e., which of the parent goal's already-bound impulses are likely useful to feed into the sub-goal. The resolver reads from `executionTraceWithSignatures` (per `metabob-activity-api`) which already exposes per-task `input_impulse_ids` / `output_impulse_ids` (see CLAUDE.md §`Execution Trace Model`). Output: a ranked list of input shapes to surface to the sub-goal.

### Signal 5: Cost/risk priors

The fifth task does two parallel `vessel_resolve_call`s:
- Shape `activityMetrics` for each candidate producer from signal 1: get `avg_cost_usd`, success rate
- Shape `toolRiskProfile` for the producers' declared tools: detect destructive ops

If the cheapest known producer's `avg_cost_usd` exceeds `remaining_budget_usd / 2` (heuristic: leave headroom for parent's other tasks), or if any producer carries high-risk tools without prior human approval, the activity emits a `human_in_the_loop_required: true` flag on the goal-shaped output rather than auto-dispatching. The cascade meta-activity in `impulse-binding-selection-layer` honors this flag.

### Composing the goal text

The final task is an `llm` resolver call with a structured prompt that ingests all five signals and produces the goal-shaped impulse. The prompt template lives in the activity JSON; no source code is needed. The output is validated against the goal-shape schema (text, category, endpoint_output_shapes, depth, remaining_budget_usd, parent_execution_id, optional human_in_the_loop_required).

## Recursion safety

Three guards on the emitted goal-shaped impulse, all enforced as activity validation rules (no source code). When a guard trips, the activity stamps a `failure_mode` on the trace per the taxonomy in sibling change `validators-and-failure-modes` and continues with `human_in_the_loop_required: true` rather than hard-failing — the auto-flag-not-fail semantics that sibling change formalizes.

1. **Depth counter**. The activity's input contract requires `parent_depth: number`. The emitted goal sets `depth: parent_depth + 1`. A validation rule on the activity rejects emission if `depth > max_depth_default` (default 3, configurable via the `max_recursion_depth` variable on the activity template). Rejection produces a `human_in_the_loop_required: true` goal instead of refusing — the human gets a chance to approve deeper recursion. The trace's `failure_mode` is set to `{ type: "safety_breach", context: { breach_type: "depth", limit: max_recursion_depth, ancestor_chain: composition_chain } }`.

2. **Cycle detection over `composition_chain`**. CLAUDE.md §`Execution Trace Model` describes `composition_chain: string[]` as the denormalized ancestor chain on every execution, root-first. The activity reads the parent execution's `composition_chain` (via `vessel_resolve_call` shape `activityExecutionTrace` keyed by `parent_execution_id`), then for each ancestor consults its goal-shaped output impulse (one hop) to read that ancestor's `endpoint_output_shapes`. If `target_shape` appears in any ancestor's `endpoint_output_shapes`, emission is refused — that ancestor is already trying to produce this shape, and recursing would be redundant. The refusal is again converted to `human_in_the_loop_required` rather than a hard error, because the user may have a legitimate reason to retry. The trace's `failure_mode` is set to `{ type: "safety_breach", context: { breach_type: "cycle", limit: 0, ancestor_chain: composition_chain } }`.

3. **Budget propagation**. The activity's input contract requires `remaining_budget_usd: number` from the parent. If `remaining_budget_usd < cheapest_producer.avg_cost_usd` (from signal 5), the activity sets `human_in_the_loop_required: true` on the emitted goal. Auto-dispatch downstream checks this flag before invoking variant selection. The trace's `failure_mode` is set to `{ type: "budget_exhausted", context: { budget_type: "cost", consumed: cheapest_producer.avg_cost_usd, allowed: remaining_budget_usd } }`.

All three guards live in the activity JSON, not in TypeScript. They are validation rules on task outputs and conditional task dispatches based on impulse-content fields. The `failure_mode` field, its discriminated-union context shapes, and the auto-flag-not-fail semantics are owned by sibling change `validators-and-failure-modes`; this change is a consumer/emitter.

## Bootstrap

Until traces exist of "shape gap filled by sub-goal succeeded," `create-shape-provider-goal` is mostly an LLM template — signals 1-4 may all return empty or low-confidence results, and the LLM composer carries most of the weight. Each successful invocation produces a trace; Thompson Sampling will eventually converge. Variants (e.g., one that omits concept-db lookup for cheaper exec, one that skips signal 5 for trusted single-tenant orgs) can be authored via the existing save-as-variant pathway in the workbench. The cold start should not be over-engineered — the activity itself records traces of which signals it used and which produced useful goal text, and the learning loop optimizes from there.

## Cascade integration

The sibling change `impulse-binding-selection-layer` defines a slot-binding meta-activity that orders attempts: pool → in-scope producer → goal creation. When the meta-activity reaches the third rung, it dispatches `create-shape-provider-goal` with `(target_shape, parent_goal_text, available_shapes, constraints)`.

There is one undecided policy question: **should the meta-activity dispatch the resulting sub-goal automatically, or always require explicit human dispatch from the workbench?**

Two positions:
- **Auto-dispatch with budget check**: faster, fully autonomous; relies on the budget guard and `human_in_the_loop_required` flag to stop runaway recursion. Best when traces are abundant and confidence is high.
- **Human-only dispatch**: every shape-provider goal surfaces in the workbench's spawn-subgoal panel for human review. Safer for early adoption; slower; useful while the system has thin traces.

This change does not pick a side. It implements both code paths so the meta-activity in `impulse-binding-selection-layer` can choose by configuration. The default in this proposal is **human-only dispatch** (workbench-mediated) with auto-dispatch reserved for goals where `human_in_the_loop_required: false` AND `confidence_top_producer > 0.8` AND `depth == 1`. Sibling change owns the final policy.

## Workbench integration

`repos/workbench/src/components/trajectory/BackwardChainingPanel.tsx` already exists for prerequisite discovery — it queries `discover-by-shapes` and surfaces existing producer activities. This change extends it: when the discovery returns no producers (or only low-confidence ones), a "Spawn sub-goal for shape X" button appears beside the missing-shape row. Clicking it dispatches `create-shape-provider-goal` with the slot's `target_shape` and current trajectory state as the impulse pool. The resulting goal-shaped impulse is rendered in a preview pane (text, declared endpoint shapes, depth, signals used) before the user confirms dispatch.

This stays consistent with the existing pattern: `BackwardChainingPanel` only suggests existing activities; the new affordance is the explicit recursive escalation, kept visually adjacent so the user can choose between the two without context-switching.

## Files Changed

| File | Change |
|---|---|
| `repos/metabob-activity-api/sql/003-goal-execution-paths.surql` | Add `endpoint_output_shapes` field + index definition |
| `repos/metabob-activity-api/sql/migrations/<next>-goal-paths-endpoint-shapes.surql` | New migration: field + index + backfill from `path_activities[*].output_shapes` |
| `repos/metabob-activity-api/src/models/schemas.ts` | Extend `GoalExecutionPathSchema` (~lines 612-642) with optional `endpoint_output_shapes: array<string>` |
| `repos/metabob-activity-api/src/routes/goal-paths.ts` | Write `endpoint_output_shapes` on insert/update; accept `endpoint_output_shape` query parameter on `GET /` and `GET /recommend`; factor `predictEndpointState` accumulation (~lines 112-181) into shared helper used by both write and read paths |
| `repos/minibob/src/embedded-templates/create-shape-provider-goal.json` | New embedded activity template, resolver-chained, recursion-safety validation rules |
| `repos/workbench/src/components/trajectory/BackwardChainingPanel.tsx` | Add "Spawn sub-goal" button + preview pane on rows with no in-scope producer |
| `repos/workbench/src/hooks/useSpawnSubgoal.ts` (new) | Hook that POSTs to the activity dispatch endpoint with `create-shape-provider-goal` and the slot context |
| `repos/workbench/src/components/trajectory/SpawnSubgoalPreview.tsx` (new) | Preview pane for the goal-shaped impulse before confirm-dispatch |

## Out of scope

- Picking the auto-dispatch vs human-only-dispatch policy (left to sibling change)
- Authoring variant templates of `create-shape-provider-goal` (e.g., cost-optimized variant skipping concept-db). The save-as-variant pathway already supports this; producing the variants is a downstream learning-loop activity, not a spec deliverable
- Cross-org goal-path sharing (`endpoint_output_shapes` is queried within the caller's org_id; see `repos/metabob-activity-api/sql/migrations/085-fix-goal-paths-permissions.surql` for the existing project-scope pattern)
- Cleanup of orphaned shape-provider goals where the parent execution failed before consuming the sub-goal output. The trace store keeps these; a separate maintenance activity can prune
- A dedicated `goalShapeProvider` impulse pointer type. Reusing the existing `goal` shape with the `endpoint_output_shapes` body field avoids inventing a new shape category
