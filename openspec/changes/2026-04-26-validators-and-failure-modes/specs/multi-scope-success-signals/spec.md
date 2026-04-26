## ADDED Requirements

### Requirement: Four scopes are formally defined
The system SHALL recognize four scopes of success signal: **task-level**, **activity-level**, **goal-level**, **downstream-level**. Each scope SHALL have a single normative definition that learning queries and workbench surfaces consult. The definitions SHALL be:

- **task-level**: a task is task-level successful when its resolver/LLM emits a structurally valid output (the existing `taskResult.status === "completed"` condition) AND every dispatched validator emits a `validation_result` with `passed: true`. A task with no validators dispatched is task-level successful when its `taskResult.status === "completed"`.
- **activity-level**: an activity is activity-level successful when every required task in its template completed task-level successfully AND every shape declared in `output_shapes` was produced (at least one impulse with that shape emitted). This is computed downstream from the trace.
- **goal-level**: a goal is goal-level successful when the `goal_verification` resolver emits a `validation_result` with `passed: true` (per the unified shape; goal-verification co-emits `validation_result`) for the goal's terminal state.
- **downstream-level**: a task's output is downstream-level successful when at least one downstream task in any subsequent execution consumes that output's impulses and runs task-level successfully. This is a learning-query result computed across multiple traces; it is NOT emitted at execution time.

#### Scenario: task-level success requires both completion and validator pass
- **WHEN** a task completes (`status: "completed"`) and its dispatched validator emits `validation_result` with `passed: true`
- **THEN** the task is task-level successful

#### Scenario: task-level fail when validator fails despite completion
- **WHEN** a task completes (`status: "completed"`) but its validator emits `validation_result` with `passed: false`
- **THEN** the task is task-level unsuccessful; the trace records both the completed `status` and the failed validation

#### Scenario: task-level success without validator
- **WHEN** a task completes and no validator is dispatched (no specialized or wildcard match for any produced shape)
- **THEN** the task is task-level successful by completion alone

### Requirement: Activity-level and goal-level signals are computed downstream, not emitted at execution time
Validators SHALL emit `validation_result` impulses at task scope only. Activity-level and goal-level success rollups SHALL be computed by learning queries on the trace's per-task validation results plus the existing `goal_verification` output. The system SHALL NOT introduce per-execution emission of activity-level or goal-level `validation_result` impulses.

#### Scenario: No activity-scope validation_result emitted at execution
- **WHEN** an activity completes
- **THEN** the trace contains zero `validation_result` impulses with `validator_id` corresponding to an "activity-rollup" validator (no such validator exists by convention)

#### Scenario: Activity-level success computed by learning query
- **WHEN** a learning query asks "did this activity execution succeed at the activity level"
- **THEN** the query reads the trace's per-task `validation_result` impulses and the per-task `status`, applies the activity-level definition, and returns a boolean — without expecting a stored activity-scope field

#### Scenario: Goal-level success consults goal-verification's validation_result
- **WHEN** a learning query asks "did this goal succeed at the goal level"
- **THEN** the query reads the goal-verification resolver's emitted `validation_result` impulse for the trace's terminal task and consults its `passed` field

### Requirement: Downstream-level signals are read from composition_chain across traces
Downstream-level success SHALL be computed by learning queries that join the current trace's output impulses to subsequent traces' input impulses via the `composition_chain` field on `activity_execution_traces`. The current trace SHALL NOT emit a downstream-scope success signal at execution time, because the downstream traces do not yet exist when the current execution completes.

#### Scenario: Downstream signal requires at least one descendant trace
- **WHEN** task X completes and produces impulses Y and Z, but no later trace consumes Y or Z
- **THEN** task X has no downstream-level signal yet; the learning query returns "no downstream signal" (not false)

#### Scenario: Downstream signal computed when descendant trace exists
- **WHEN** task X's output impulse Y is consumed by task X' in a later trace, and X' is task-level successful
- **THEN** the learning query returns `downstream_success: true` for task X with respect to impulse Y

### Requirement: Thompson updates remain uniform across scopes
The Thompson Sampling α/β update path SHALL remain at task-level granularity per the existing implementation (`repos/metabob-activity-api/src/routes/execution-traces.ts:1306, 1579`). Activity-level and goal-level rollups SHALL be available as stratified queries, but SHALL NOT influence the per-template α/β state in this spec.

#### Scenario: Activity-level rollup does not write Thompson state
- **WHEN** a learning query computes activity-level success across many traces
- **THEN** the query reads `activity_execution_traces` and computes the rollup; it does NOT write to `activity_metrics` or any other Thompson-state table

#### Scenario: Goal-level signal is a read, not a write
- **WHEN** a learning query computes goal-level success for a goal across its constituent activities
- **THEN** the query reads goal-verification `validation_result` impulses; it does not invoke a Thompson update path

### Requirement: Workbench surfaces render scope explicitly when available
Workbench surfaces (specifically `ImpulseStatePanel.tsx` and `ExecutionHistoryPanel.tsx`) SHALL label success signals with their scope when that scope is non-task. Task-level signals MAY render without explicit scope labels (the default). Activity-level and goal-level rollups, when displayed, SHALL be labeled `activity` and `goal` respectively. Downstream-level signals SHALL be labeled `downstream` and SHALL NOT mix with task-level signals in the same indicator.

#### Scenario: Task-level indicator renders without scope label
- **WHEN** a task's `validation_result` is shown in `ImpulseStatePanel`
- **THEN** the indicator displays the validator id and pass/fail state without a "task-level" prefix

#### Scenario: Activity-level rollup renders with scope label
- **WHEN** the workbench computes and displays an activity-level rollup for an activity
- **THEN** the indicator carries an explicit `activity` scope label so users can distinguish task vs activity verdicts

#### Scenario: Downstream signal not mixed with task signal
- **WHEN** the workbench shows a task's downstream-level success rate alongside the task's own pass/fail
- **THEN** the two are rendered in distinct UI elements with distinct labels (`task` and `downstream`); they are not collapsed into a single number
