## ADDED Requirements

### Requirement: An embedded activity template create-shape-provider-goal SHALL exist
MiniBob SHALL load an embedded activity template at `repos/minibob/src/embedded-templates/create-shape-provider-goal.json` that consumes a missing-shape signal and emits a goal-shaped impulse declaring the missing shape as its terminal output. The template SHALL be loaded at startup alongside `goal-processing-activity-driven.json` via the existing embedded-templates manifest.

#### Scenario: Template loads at startup
- **WHEN** minibob starts and embedded templates are loaded
- **THEN** `create-shape-provider-goal` appears in the loaded templates list with a valid task graph

#### Scenario: Template id is stable
- **WHEN** the template is referenced by id from the workbench dispatch endpoint
- **THEN** the id `create-shape-provider-goal` resolves to this template

### Requirement: The activity SHALL declare a fixed input contract
The activity SHALL declare these variables: `target_shape: string` (required), `parent_goal_text: string` (required), `available_shapes: array<string>` (required, may be empty), `parent_execution_id: string` (optional), `parent_depth: number` (default 0), `remaining_budget_usd: number` (optional), `max_recursion_depth: number` (default 3).

#### Scenario: Missing required variable rejects dispatch
- **WHEN** the activity is dispatched without `target_shape`
- **THEN** dispatch fails with a validation error before any task runs

#### Scenario: Optional variables get defaults
- **WHEN** the activity is dispatched without `parent_depth` or `max_recursion_depth`
- **THEN** the task chain runs with `parent_depth: 0` and `max_recursion_depth: 3`

### Requirement: The task chain SHALL dispatch five signal-source resolvers
The task graph SHALL dispatch, in order, tasks reading these resolvers: (1) `activity_recommendation` for forward-chain producers of `target_shape`; (2) `vessel_resolve_call` for prior `goalExecutionPath` rows with `endpoint_output_shape: target_shape`; (3) `vessel_resolve_call` to concept-db for `relatedConcepts` keyed on `target_shape`; (4) `impulse_cooccurrence` over the producer ids and `available_shapes`; (5) parallel `vessel_resolve_call`s for `activityMetrics` and `toolRiskProfile` over the producer ids. Each task SHALL emit one impulse with the shape declared in design.md, consumed by the final task.

#### Scenario: Each task dispatches a registered resolver by name
- **WHEN** the activity executes
- **THEN** each task's `resolver` field references an existing entry in `repos/minibob/src/resolvers/index.ts` (no new TypeScript resolvers are introduced by this change)

#### Scenario: Signal task failure does not block downstream
- **WHEN** task 3 (concept-db lookup) fails because concept-db is unreachable
- **THEN** the task chain continues; the final compose_goal task receives an empty/error impulse for that signal and proceeds with the remaining four

### Requirement: The compose_goal task SHALL emit a goal-shaped impulse with a fixed body
The final task `compose_goal` SHALL use the `llm` resolver with a structured prompt that ingests all five signal outputs and emits exactly one impulse of shape `goal`. The impulse body SHALL contain: `text` (string), `category` (one of feature/bugfix/refactor/tool/infrastructure/meta), `endpoint_output_shapes` (array containing at least `target_shape`), `scopeContext` (per the schema in design.md §"Scope schema"), `parent_execution_id` (passthrough from input), `depth` (= `parent_depth + 1`), `remaining_budget_usd` (passthrough), and optional `human_in_the_loop_required: boolean`.

#### Scenario: Output shape is goal
- **WHEN** the activity completes successfully
- **THEN** exactly one output impulse is emitted with shape `goal`

#### Scenario: endpoint_output_shapes contains target_shape
- **WHEN** the activity is dispatched with `target_shape: "sourceCode"`
- **THEN** the emitted goal impulse's `endpoint_output_shapes` contains `"sourceCode"` (and may contain other shapes the LLM identified as co-required)

#### Scenario: depth increments by one
- **WHEN** the activity is dispatched with `parent_depth: 1`
- **THEN** the emitted goal impulse's `depth` equals `2`

### Requirement: Depth-limit guard SHALL convert refusals to human-in-the-loop flags
When the computed depth (`parent_depth + 1`) exceeds `max_recursion_depth`, the activity SHALL still emit a goal-shaped impulse but with `human_in_the_loop_required: true`. The activity SHALL NOT fail the task chain or refuse emission. The trace SHALL carry `failure_mode: { type: "safety_breach", context: { breach_type: "depth", limit: max_recursion_depth, ancestor_chain: <composition_chain> } }` per the taxonomy defined in sibling change `validators-and-failure-modes`.

#### Scenario: Depth at limit emits with flag
- **WHEN** the activity is dispatched with `parent_depth: 3, max_recursion_depth: 3`
- **THEN** the emitted goal impulse has `depth: 4` and `human_in_the_loop_required: true`

#### Scenario: Depth below limit emits without flag from this guard
- **WHEN** the activity is dispatched with `parent_depth: 1, max_recursion_depth: 3` and the cycle and budget guards do not trip
- **THEN** the emitted goal impulse has `human_in_the_loop_required: false` (or omitted)

### Requirement: Cycle-detection guard SHALL flag goals whose ancestors target the same shape
The activity SHALL include a task `parent_chain_lookup` that resolves the parent's `composition_chain` and reads each ancestor's emitted goal-shaped impulse. If any ancestor's `endpoint_output_shapes` contains `target_shape`, the emitted goal SHALL have `human_in_the_loop_required: true`. The trace SHALL carry `failure_mode: { type: "safety_breach", context: { breach_type: "cycle", limit: 0, ancestor_chain: <composition_chain> } }` per the taxonomy defined in sibling change `validators-and-failure-modes`.

#### Scenario: Cycle detected through grandparent
- **WHEN** the parent execution's `composition_chain` references an ancestor whose own goal targeted the same `target_shape`
- **THEN** the emitted goal impulse has `human_in_the_loop_required: true` with a body field naming the offending ancestor execution id

#### Scenario: No ancestor matches target_shape
- **WHEN** no ancestor in `composition_chain` has a goal-shaped output declaring `target_shape`
- **THEN** the cycle guard does not set `human_in_the_loop_required`

#### Scenario: parent_execution_id absent skips cycle check
- **WHEN** the activity is dispatched without `parent_execution_id` (top-level dispatch from the workbench, no ancestry to walk)
- **THEN** the cycle guard is skipped without error

### Requirement: Budget-propagation guard SHALL flag goals exceeding remaining budget
When `remaining_budget_usd` is provided AND the cheapest producer surfaced by signal 1 has `avg_cost_usd > remaining_budget_usd / 2`, the emitted goal SHALL have `human_in_the_loop_required: true`. The trace SHALL carry `failure_mode: { type: "budget_exhausted", context: { budget_type: "cost", consumed: <cheapest_producer.avg_cost_usd>, allowed: <remaining_budget_usd> } }` per the taxonomy defined in sibling change `validators-and-failure-modes`.

#### Scenario: Budget exceeded sets flag
- **WHEN** `remaining_budget_usd: 0.10` and the cheapest known producer has `avg_cost_usd: 0.08`
- **THEN** the emitted goal impulse has `human_in_the_loop_required: true` (0.08 > 0.05)

#### Scenario: Budget not provided skips check
- **WHEN** `remaining_budget_usd` is omitted from the input
- **THEN** the budget guard does not set `human_in_the_loop_required`

#### Scenario: No producers found skips budget check
- **WHEN** signal 1 returns zero producers
- **THEN** the budget guard does not set `human_in_the_loop_required` (other guards may still apply)

### Requirement: Goal-shaped impulses SHALL carry a scopeContext body field
Every goal-shaped impulse emitted by `create-shape-provider-goal` SHALL carry a `scopeContext` body field of the form `{ dimensions: Record<string, string>, attestation: ScopeAttestation | null }` per design.md §"Scope schema". For top-level dispatches (no `parent_execution_id`), the field MAY be `{ dimensions: {}, attestation: null }`. For all other dispatches, the field SHALL be populated by copying the parent goal-shaped impulse's `scopeContext` into the child unchanged unless the activity input explicitly supplies narrowed `dimensions`.

#### Scenario: Child inherits parent scopeContext verbatim
- **WHEN** the activity is dispatched with a `parent_execution_id` whose goal-shaped output declares `scopeContext: { dimensions: { cluster_id: "alpha", branch: "main" }, attestation: null }` and no narrowed `dimensions` are supplied on the activity input
- **THEN** the emitted goal impulse's `scopeContext.dimensions` equals `{ cluster_id: "alpha", branch: "main" }`

#### Scenario: Top-level dispatch emits empty dimensions
- **WHEN** the activity is dispatched without `parent_execution_id` (workbench root dispatch)
- **THEN** the emitted goal impulse carries `scopeContext: { dimensions: {}, attestation: null }`

#### Scenario: Explicit narrowing preserves CC1
- **WHEN** the activity input supplies narrowed `dimensions` that retain every parent key with an equal value (and may add new keys)
- **THEN** the emitted goal impulse's `scopeContext.dimensions` is the narrowed set; CC1 verification at downstream dispatch passes

### Requirement: All recursion-safety guards SHALL live in activity JSON, not in source
The depth, cycle, and budget guards SHALL be expressed as activity JSON validation rules and conditional task dispatches reading impulse-content fields. No new TypeScript files in `repos/minibob/src/` SHALL be introduced by this change to enforce these guards. The activity JSON is the entire surface area for these rules.

#### Scenario: No new resolver source files
- **WHEN** the change is implemented
- **THEN** `repos/minibob/src/resolvers/index.ts` and the resolver source files are unchanged; the only new file in minibob is the embedded JSON template

#### Scenario: Guards expressed as task config
- **WHEN** inspecting the embedded template
- **THEN** the depth, cycle, and budget guards appear as task validation rules and impulse-content reads in the JSON, not as native resolver code
