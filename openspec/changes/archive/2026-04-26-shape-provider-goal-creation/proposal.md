## Why

When a task in a trajectory needs an impulse of shape `X` and the binding cascade can find neither (a) an existing impulse of shape `X` in the pool nor (b) an in-scope producer activity that emits shape `X`, the system today silently drops to LLM improvisation, variable synthesis, or memory-agent guessing. There is no first-class mechanism to **dispatch a sub-goal whose declared endpoint is shape `X`** — i.e., to use the impulse-activity machinery recursively to fill its own shape gaps.

The sibling change `impulse-binding-selection-layer` covers the first two cascade rungs (pool selection, in-scope producer selection). When both fail, the slot is `unbindable`. This change adds the third rung: **goal creation as a shape-provider operation**, executed by the same activity-driven dispatch path everything else uses. No new ontological category — creating a goal is just running an activity whose output shape is `goal`, with `endpoint_output_shapes: [target_shape]` declared on the emitted goal-shaped impulse.

## What Changes

- Add `endpoint_output_shapes: array<string>` field to the `goal_execution_paths` table in `metabob-activity-api` so completed paths are queryable by terminal shape; backfill from existing `path_activities[*].output_shapes` accumulation; index for shape lookup
- Add a new embedded activity template `create-shape-provider-goal` to `minibob` that consumes `(target_shape, parent_goal_text, available_shapes, constraints)` and emits a goal-shaped impulse with `endpoint_output_shapes: [target_shape]`. The task chain is purely resolver-dispatched — five signal sources (forward-chain, prior goal paths, concept lookup, co-occurrence, cost/risk priors) feed an LLM-driven goal-text composer
- Add recursion-safety guards on the emitted goal: depth counter, cycle detection over `composition_chain`, budget propagation from parent. When a guard trips, the activity stamps the appropriate `failure_mode` (`safety_breach` for depth/cycle, `budget_exhausted` for budget) per the taxonomy defined in sibling change `validators-and-failure-modes`, and continues with `human_in_the_loop_required: true` rather than hard-failing (auto-flag-not-fail semantics)
- Add a "spawn sub-goal for shape X" affordance to the workbench `BackwardChainingPanel` that dispatches `create-shape-provider-goal` for the selected unbindable shape slot

## Capabilities

### New Capabilities
- `goal-execution-paths-endpoint-shapes`: Goal execution paths queryable by terminal output shape; backfill + index over existing rows
- `create-shape-provider-goal-activity`: Resolver-chained activity that produces a shape-targeted sub-goal; emits a goal-shaped impulse declaring `endpoint_output_shapes`
- `workbench-spawn-subgoal-affordance`: Workbench UI to dispatch the activity from an unbindable shape slot in the trajectory editor

### Modified Capabilities
- `impulse-binding-selection-layer` (sibling change): the cascade meta-activity falls through to `create-shape-provider-goal` when producer selection fails. This proposal references that contract; the sibling change owns it
- `failure-mode-taxonomy` (sibling change `validators-and-failure-modes`): this proposal is one of the failure-detecting sources that stamp `failure_mode` — the depth/cycle/budget guards set `safety_breach` and `budget_exhausted` with the context shapes that sibling change defines. No interface change to the taxonomy; this proposal is a consumer/emitter

## Impact

- `repos/metabob-activity-api/sql/003-goal-execution-paths.surql` — add `endpoint_output_shapes` field + index
- `repos/metabob-activity-api/sql/migrations/<next>-goal-paths-endpoint-shapes.surql` — new migration adding field, backfilling from joined activity outputs, defining index
- `repos/metabob-activity-api/src/models/schemas.ts` — extend `GoalExecutionPathSchema` (~lines 612-642) with optional `endpoint_output_shapes`; extend `RecommendedPathSchema` endpoint_prediction (~lines 680-684) is unchanged (already carries `expected_shapes`)
- `repos/metabob-activity-api/src/routes/goal-paths.ts` — write path stores denormalized `endpoint_output_shapes` on path insert/update; new query parameter `endpoint_output_shape` on `GET /v2/goal-paths`
- `repos/minibob/src/embedded-templates/create-shape-provider-goal.json` — new embedded activity template (resolver-chained, no bespoke code)
- `repos/minibob/src/resolvers/index.ts` — no new resolvers; all five signal sources reuse existing registered resolvers (`activity_recommendation`, `impulse_cooccurrence`, vessel-resolve to `concept-db`, vessel-resolve to `activityMetrics`/`toolRiskProfile`, plus an LLM goal-text composer using `llm` resolver with a structured prompt template)
- `repos/workbench/src/components/trajectory/BackwardChainingPanel.tsx` — add a "Spawn sub-goal" button on each missing-shape row when no in-scope producer is available
- No source changes in `minibob`'s or `metabob-activity-api`'s runtime selection logic — everything new is data + activity templates
