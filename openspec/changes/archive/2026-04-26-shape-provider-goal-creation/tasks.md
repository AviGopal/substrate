## 1. Goal-execution-paths schema: endpoint_output_shapes field

- [x] 1.1 Edit `repos/metabob-activity-api/sql/003-goal-execution-paths.surql`: add `DEFINE FIELD endpoint_output_shapes ON goal_execution_paths TYPE option<array<string>> COMMENT "Denormalized terminal output shapes accumulated from path_activities[*].output_shapes. Indexed for shape-keyed lookup."` — landed IAL 2.3
- [x] 1.2 Add index in same file: `DEFINE INDEX idx_goal_paths_endpoint_shapes ON goal_execution_paths FIELDS endpoint_output_shapes` — landed IAL 2.3
- [x] 1.3 Create new forward migration `repos/metabob-activity-api/sql/migrations/<next>-goal-paths-endpoint-shapes.surql` that (a) adds the field and index idempotently, (b) backfills from existing `goal_execution_paths` rows by joining `activity` records via `path_activities` and accumulating `output_shapes` into a deduplicated array — landed as `092-goal-paths-endpoint-shapes.surql` per IAL 2.3 (idempotent inline backfill)
- [x] 1.4 Verify migration is idempotent (running twice produces same state); add migration to `repos/metabob-activity-api/sql/migrations/` and register in the migration runner — landed IAL 2.3
- [x] 1.5 Extend `GoalExecutionPathSchema` in `repos/metabob-activity-api/src/models/schemas.ts` (~lines 612-642) with `endpoint_output_shapes: z.array(z.string()).optional()` — landed IAL 2.3

## 2. Goal-execution-paths route: write + query

- [x] 2.1 In `repos/metabob-activity-api/src/routes/goal-paths.ts`, factor the shape-accumulation loop currently inside `predictEndpointState` (~lines 112-181) into an exported helper `accumulateEndpointShapes(pathActivities: string[]): Promise<string[]>` — landed Phase 2.5 per CLAUDE.md
- [x] 2.2 In the path insert/update handlers (`POST /goal-paths` and any update sites), call `accumulateEndpointShapes(path_activities)` and persist the result to the new `endpoint_output_shapes` field — landed Phase 2.5 per CLAUDE.md (POST persists on insert+update)
- [x] 2.3 Add an optional `endpoint_output_shape` query parameter on `GET /v2/goal-paths` (single-shape filter) that translates to a SurrealDB `WHERE endpoint_output_shapes CONTAINS $shape` clause — landed Phase 2.5 per CLAUDE.md
- [x] 2.4 Add an optional `endpoint_output_shape` parameter on `POST /v2/goal-paths/recommend` so recommendations can be shape-filtered as a hard constraint (not a re-rank) — landed Phase 2.5 per CLAUDE.md (hard-filter pre-Thompson Sampling)
- [x] 2.5 Update `predictEndpointState` to read directly from the denormalized field when present, falling back to the existing on-the-fly accumulation; this keeps reads cheap once backfilled — landed Phase 2.5 per CLAUDE.md
- [x] 2.6 Add unit tests: write path stores correct denormalized array; query parameter filters correctly; recommend honors shape filter; backfill produces same result as on-the-fly accumulation — 13 new tests per CLAUDE.md §Phase 2.5

## 3. Activity template: create-shape-provider-goal

- [x] 3.1 Author `repos/minibob/src/embedded-templates/create-shape-provider-goal.json` matching the structure of `goal-processing-activity-driven.json`. Variables: `target_shape` (required string), `parent_goal_text` (required string), `available_shapes` (array<string>), `parent_execution_id` (optional string), `parent_depth` (number, default 0), `remaining_budget_usd` (optional number), `max_recursion_depth` (number, default 3) — landed IAL 7.1 (`shape-provider-goal.json` in embedded-templates; v0.3.1)
- [x] 3.2 Task 1: `forward_chain_producers` — resolver `activity_recommendation`, config queries `discover-by-shapes` forward mode for `target_shape`, outputShape `activity_recommendations` — landed IAL 7.1
- [x] 3.3 Task 2: `prior_paths_with_endpoint` — resolver `vessel_resolve_call` to activity-api, shape `goalExecutionPath`, filter `endpoint_output_shape: target_shape`, outputShape `goal_execution_paths_subset` — landed IAL 7.1
- [x] 3.4 Task 3: `concept_lookup` — resolver `vessel_resolve_call` to concept-db, shape `relatedConcepts`, key `target_shape`, outputShape `related_concepts` — landed IAL 7.1
- [x] 3.5 Task 4: `cooccurrence_signal` — resolver `impulse_cooccurrence`, config consumes producer ids from task 1 and `available_shapes`, outputShape `cooccurrence_ranking` — landed IAL 7.1
- [x] 3.6 Task 5: `cost_risk_priors` — two parallel `vessel_resolve_call` tasks (one for `activityMetrics`, one for `toolRiskProfile`) keyed on producer ids from task 1, outputShapes `cost_summary` and `risk_summary` — landed IAL 7.1
- [x] 3.7 Task 6: `compose_goal` — resolver `llm` with structured prompt template ingesting all five signal outputs; emits one impulse of shape `goal` with body fields per design.md "Goal-as-shape-producer framing" — landed IAL 7.1
- [ ] 3.8 Add validation rule on `compose_goal` output: reject if `depth > max_recursion_depth`; on rejection, set `human_in_the_loop_required: true` instead of failing the task — declarative-only scope shipped v1; enforcement via IAL 7.3 BLOCKED on H3 (scope attestation)
- [ ] 3.9 Add validation rule: read parent's `composition_chain` via task `parent_chain_lookup` (resolver `vessel_resolve_call`, shape `activityExecutionTrace`, key `parent_execution_id`); for each ancestor execution, read its goal-shaped output impulse; if any ancestor's `endpoint_output_shapes` contains `target_shape`, set `human_in_the_loop_required: true` on the emitted goal — open; IAL 7.3 open
- [ ] 3.10 Add validation rule: if the cheapest producer's `avg_cost_usd` (from task 5) exceeds `remaining_budget_usd / 2`, set `human_in_the_loop_required: true` — open; IAL 7.3 open
- [x] 3.11 Register the template id in the embedded-templates manifest used at minibob startup so it loads alongside `goal-processing-activity-driven.json` — landed IAL 7.1 (registered as template in activity-api; v0.3.1)

## 4. Workbench: spawn-subgoal affordance

- [x] 4.1 Create `repos/workbench/src/hooks/useSpawnSubgoal.ts` — TanStack Query mutation hook that POSTs to the activity dispatch endpoint with `template_id: "create-shape-provider-goal"` and the slot context (`target_shape`, `parent_goal_text`, `available_shapes`, `parent_execution_id`, `parent_depth`, `remaining_budget_usd`) — landed workbench v0.3.0 / IAL 6.2 (`useSpawnSubgoal` hook exists)
- [x] 4.2 Create `repos/workbench/src/components/trajectory/SpawnSubgoalPreview.tsx` — renders the goal-shaped output impulse (text, `endpoint_output_shapes`, `depth`, signals summary, `human_in_the_loop_required` flag) with a Confirm Dispatch button — landed workbench v0.3.0 / IAL 6.2 (`SpawnSubgoalPreview` component)
- [x] 4.3 In `repos/workbench/src/components/trajectory/BackwardChainingPanel.tsx`, add a "Spawn sub-goal" button on each missing-shape row when `discoveryData.activities.length === 0` OR all returned producers have `confidence < 0.4` — landed workbench v0.3.0; button dispatches `create-shape-provider-goal` per CLAUDE.md §Phase L→M bridge
- [x] 4.4 Wire the button to open `SpawnSubgoalPreview` with the result of `useSpawnSubgoal`; on confirm, propagate the new sub-goal id back to the parent trajectory editor so the slot displays "awaiting sub-goal completion" state — landed workbench v0.3.0 per CLAUDE.md §Phase L→M bridge
- [x] 4.5 Visual placement: the new button sits beside (not replacing) the existing producer-add affordance; ResolverTierBadge or similar tag indicates this is a recursive escalation, not a direct add — landed workbench v0.3.0 per IAL 6.2

## 5. Tests

- [x] 5.1 Backend unit tests for `accumulateEndpointShapes` with empty path, single-activity path, multi-activity path with overlapping output shapes — landed Phase 2.5 (13 new tests per CLAUDE.md)
- [x] 5.2 Backend integration test: insert path → query by `endpoint_output_shape` → row returned; insert second path with different terminal shape → first query still returns only first row — landed Phase 2.5
- [x] 5.3 Backend integration test: backfill migration on a fixture DB with 3 pre-existing rows produces correct `endpoint_output_shapes` for each — landed Phase 2.5
- [ ] 5.4 Activity template smoke test in minibob: dispatch `create-shape-provider-goal` with synthetic inputs, verify it emits a single goal-shaped impulse with required body fields populated — open; not confirmed as unit-tested
- [ ] 5.5 Activity template recursion-safety test: dispatch with `parent_depth: 3, max_recursion_depth: 3` → emitted goal has `human_in_the_loop_required: true` — open; depends on 3.8 enforcement (IAL 7.3 BLOCKED)
- [ ] 5.6 Activity template cycle-detection test: dispatch with `parent_execution_id` whose ancestor chain already targets `target_shape` → emitted goal has `human_in_the_loop_required: true` — open; depends on 3.9 (IAL 7.3 BLOCKED)
- [ ] 5.7 Workbench unit test: `BackwardChainingPanel` shows Spawn sub-goal button when no producers returned — open; not individually confirmed as tested
- [ ] 5.8 Workbench unit test: `BackwardChainingPanel` does NOT show Spawn sub-goal button when at least one producer has `confidence >= 0.4` — open; not individually confirmed as tested
- [ ] 5.9 Workbench integration test: clicking Spawn sub-goal opens `SpawnSubgoalPreview` with the activity output rendered — open; not individually confirmed as tested

## 6. Typecheck and Smoke

- [x] 6.1 Run `bun run typecheck` in `repos/metabob-activity-api` — zero new errors — confirmed at Phase 2.5 landing (CLAUDE.md: "typecheck clean")
- [x] 6.2 Run `bun test` in `repos/metabob-activity-api` — no regressions — confirmed Phase 2.5 (13 new tests, existing suite green)
- [x] 6.3 Run `bun run typecheck` in `repos/minibob` — zero new errors — confirmed at IAL 7.1 landing (v0.3.1)
- [ ] 6.4 Run `bun test` in `repos/minibob` — no regressions — open; template smoke tests (§5.4–5.6) not yet written
- [x] 6.5 Run `npx tsc --noEmit` in `repos/workbench` — zero new errors — confirmed at workbench v0.3.0 landing
- [ ] 6.6 Run `npx vitest run` in `repos/workbench` — no regressions vs current baseline — open; workbench spawn-subgoal unit tests (§5.7–5.9) not confirmed written
