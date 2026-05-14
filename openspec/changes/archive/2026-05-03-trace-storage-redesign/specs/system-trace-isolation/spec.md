## ADDED Requirements

### Requirement: Activity templates SHALL carry an observed `learning_track` classification

Each row in `activity_template` and `activity` SHALL carry a `learning_track` field with one of three values:

- `unclassified` — default; the template has not yet been observed enough to classify, or the classifier has not run since the template was created.
- `learning` — the template's traces are full learning material; writes go to `activity_execution_traces` / `execution`, and the trace participates in Thompson Sampling α/β updates.
- `system` — the template's traces have been observed not to contribute learning signal (no tasks, no declared output shapes, near-zero output-shape diversity); writes go to `execution_system_traces`, and the trace is excluded from Thompson Sampling.

The field is set by a periodic classifier (Requirement: Classifier observes per-template signals), never by hand-edited configuration. A new template starts at `unclassified` and remains there until the classifier has enough samples (default: at least 5 executions) to assign a track.

#### Scenario: New template defaults to unclassified
- **WHEN** a new row is INSERTed into `activity_template` without an explicit `learning_track`
- **THEN** `learning_track` is `unclassified`
- **AND** trace writes for that template route to the standard tables (per the fall-through guarantee below)

#### Scenario: Template promoted to learning track
- **WHEN** the classifier observes 10 executions of `template_x` with avg `task_count = 4` and avg `output_impulse_shapes` length `2.5`
- **THEN** the classifier UPDATEs `template_x.learning_track` to `learning`
- **AND** subsequent traces for `template_x` continue routing to `activity_execution_traces`

#### Scenario: Template demoted to system track
- **WHEN** the classifier observes 10 executions of `template_y` with avg `task_count = 0` and avg `output_impulse_shapes` length `0`
- **THEN** the classifier UPDATEs `template_y.learning_track` to `system`
- **AND** subsequent traces for `template_y` route to `execution_system_traces`

#### Scenario: Template re-classified after structural change
- **WHEN** `template_z` was previously `system` (zero-task variants) and a refactor adds tasks producing output shapes
- **AND** the next 5 executions show non-zero task and shape signals
- **THEN** the classifier UPDATEs `template_z.learning_track` back to `learning`

### Requirement: Classifier SHALL observe per-template signals on a fixed cadence

A periodic job in `repos/metabob-activity-api/src/jobs/learning-track-classifier.ts` SHALL re-evaluate every `activity_template` and `activity` row whose stored `last_classified_at` is older than the re-evaluation interval (default: every 6 hours; tunable via `LEARNING_TRACK_CADENCE_MS`).

The signals consulted, all averaged over the most recent `LEARNING_TRACK_SAMPLE_WINDOW` executions (default: 50, minimum-required: 5):

- `avg_task_count` — mean number of tasks recorded on `trace_digest.task_summaries` for the template's executions.
- `avg_output_shape_count` — mean length of `trace_digest.output_impulse_shapes` for the template's executions.
- `declared_output_shapes_count` — `array::len(activity.output_shapes)` from the template row itself (zero when undeclared).
- `output_shape_diversity` — count of distinct shape strings observed across the window (low diversity over many executions is a system-bookkeeping signal, e.g., a lifecycle wrapper that always emits the same single shape).

Default thresholds (all tunable):

- `learning` track when `avg_task_count >= 1` AND (`avg_output_shape_count >= 1` OR `declared_output_shapes_count >= 1`).
- `system` track when `avg_task_count < 0.5` AND `avg_output_shape_count < 0.5` AND `declared_output_shapes_count == 0`.
- `unclassified` otherwise (insufficient signal, or signals straddle the thresholds).

These thresholds are knobs; the spec does not pin them. They live as `const LEARNING_TRACK_THRESHOLDS` in the classifier module.

#### Scenario: Classifier respects sample-window minimum
- **WHEN** a template has fewer than 5 executions in the window
- **THEN** the classifier leaves `learning_track` at its current value (or `unclassified` for new templates)
- **AND** does not promote or demote on insufficient evidence

#### Scenario: Classifier records timestamp
- **WHEN** the classifier evaluates a template
- **THEN** `activity_template.last_classified_at` is updated to `time::now()`
- **AND** the next cycle skips templates whose `last_classified_at` is younger than the cadence

### Requirement: Trace write path SHALL consult `learning_track` to choose target table, with fall-through

`storeExecutionTrace` and the paradigm `insertExecution` write paths SHALL look up the executing template's `learning_track` and route as follows:

- `learning_track = 'system'` → write to `execution_system_traces` (lightweight row; no `tasks`, `state_snapshot`, or `impulse_resolutions`).
- `learning_track = 'learning'` or `'unclassified'` or any other value → write to `activity_execution_traces` / `execution` (full trace, plus `trace_digest` and `execution_trace_content`).

If the lookup fails for any reason (template row missing, classifier field absent on a legacy row, query error, RPC timeout), the write SHALL fall through to the default `activity_execution_traces` / `execution` path. The classifier is advisory; it never blocks a write.

#### Scenario: Classifier lookup error falls through to default
- **WHEN** the `learning_track` lookup throws or returns NONE
- **THEN** the write proceeds to `activity_execution_traces`
- **AND** an operator-visible warn-log records the lookup failure (rate-limited so a sustained outage does not flood logs)
- **AND** the trace is not lost

#### Scenario: System-classified template lookup succeeds
- **WHEN** `storeExecutionTrace` resolves `template_y.learning_track = 'system'`
- **THEN** one row lands in `execution_system_traces`
- **AND** no row lands in `activity_execution_traces`, `trace_digest`, or `execution_trace_content`

#### Scenario: Unknown template id falls through to default
- **WHEN** `storeExecutionTrace` is called with an `activity_id` that has no row in `activity_template` or `activity`
- **THEN** the write proceeds to `activity_execution_traces` (the default path)
- **AND** the trace is preserved for the next classifier cycle to act on once the template row is created

### Requirement: Thompson Sampling SHALL skip system-track templates

The Thompson Sampling write path that updates `thompson_alpha` and `thompson_beta` (atomic `+=` UPDATE sites established under `2026-04-29-surrealdb-rl-layer` Phase 1) SHALL only consider rows from `activity_execution_traces` and `execution`. Because system-track templates' traces are routed to `execution_system_traces` at write time, the existing UPDATE sites already exclude them structurally; no additional skip predicate is required at the UPDATE site.

The exclusion is therefore a property of trace routing, not of the Thompson code path. If a system-track template later transitions back to `learning`, only its post-transition traces feed posteriors; pre-transition rows in `execution_system_traces` are not retroactively replayed.

#### Scenario: System-track trace produces no posterior change
- **WHEN** a trace for a `system`-classified template is stored
- **THEN** the template's `thompson_alpha` and `thompson_beta` are unchanged

#### Scenario: Re-classified template's new traces feed posteriors
- **WHEN** `template_z` transitions from `system` to `learning`
- **AND** a subsequent successful execution is recorded
- **THEN** `template_z.thompson_alpha` increases by the configured success delta atomically

### Requirement: Family growth and rename SHALL not require code changes

When new template families are introduced (e.g., `auth_resolve_v1` is joined by `auth_resolve_v2`, or a family is renamed), no source code change SHALL be required to classify the new ids correctly. The classifier reads `activity_template` rows; new rows are evaluated on the next cycle by the same threshold logic as existing rows. There is no hardcoded id list to update.

#### Scenario: New family member auto-classified
- **WHEN** `auth_resolve_v2` is registered with the same zero-task, zero-output-shape shape as `auth_resolve_v1`
- **AND** the classifier runs after the minimum sample window is satisfied
- **THEN** `auth_resolve_v2.learning_track` is set to `system` without any code edit
- **AND** its traces route to `execution_system_traces` thereafter

#### Scenario: Family rename preserved across cycles
- **WHEN** `validator-dispatch` is renamed to `validator-dispatch-2026q2` (a new template row, distinct id)
- **THEN** the new row starts at `unclassified`
- **AND** is classified on the same signals as the original
- **AND** routing converges to the same track without operator intervention

### Requirement: Classifier SHALL be observable

The classifier SHALL emit metrics on each cycle: number of templates evaluated, number transitioned to `learning`, number transitioned to `system`, number left `unclassified`, and number skipped due to insufficient samples. A `GET /v2/admin/learning-tracks` endpoint SHALL return the current per-template classification with the underlying signal values, so operators can audit drift and tune thresholds.

#### Scenario: Operator audits classifier output
- **WHEN** an operator calls `GET /v2/admin/learning-tracks?activity_id=template_y`
- **THEN** the response contains `learning_track`, `last_classified_at`, `avg_task_count`, `avg_output_shape_count`, `declared_output_shapes_count`, `sample_count`
- **AND** the operator can use the response to decide whether to retune the threshold constants
