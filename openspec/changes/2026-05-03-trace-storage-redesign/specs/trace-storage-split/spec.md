## ADDED Requirements

### Requirement: Execution-trace content SHALL be stored in a 1-to-1 child table

Every non-system execution trace SHALL produce one row in `execution_trace_content` keyed by `execution_id`. The child row SHALL carry the heavy-payload fields `tasks`, `state_snapshot`, `execution_trace`, `impulse_resolutions`, and `output_impulses`. The parent row in `activity_execution_traces` (legacy) or `execution` (paradigm) SHALL retain only the metadata needed for indexed lookup, including `output_impulse_shapes`.

#### Scenario: Non-system trace produces parent and child rows
- **WHEN** `storeExecutionTrace` is called with a non-system `activity_id` and a populated `execution_trace.tasks` array
- **THEN** exactly one row exists in `activity_execution_traces` with the metadata fields populated and the heavy fields absent
- **AND** exactly one row exists in `execution_trace_content` with the heavy fields populated and `execution_id` matching the parent

#### Scenario: System trace produces neither parent nor child
- **WHEN** `storeExecutionTrace` is called with a system `activity_id` (e.g. `_goal_resolve`)
- **THEN** no row is added to `activity_execution_traces`
- **AND** no row is added to `execution_trace_content`

#### Scenario: output_impulse_shapes stays on the metadata row
- **WHEN** a trace declares `output_impulse_shapes: ["sourceCode", "patch"]`
- **THEN** the field is readable from `activity_execution_traces` without a join to `execution_trace_content`

### Requirement: Read paths SHALL fall back to legacy fields during the transition window

During Phase C, GET handlers that materialise a full trace SHALL consult `execution_trace_content` first by `execution_id`. When that row is absent (legacy pre-split row), the handler SHALL fall back to reading the inline fields on `activity_execution_traces` and SHALL log `content_source: "legacy"`. After Phase D drops the inline fields, only the split path SHALL be reachable.

#### Scenario: Split-path row is read from execution_trace_content
- **WHEN** a Phase B trace is read via the GET handler
- **THEN** `tasks`, `state_snapshot`, `execution_trace`, `impulse_resolutions`, `output_impulses` come from `execution_trace_content`
- **AND** the response is logged with `content_source: "split"`

#### Scenario: Pre-Phase-B row falls back to inline fields
- **WHEN** a row stored before Phase B is read
- **THEN** the heavy fields come from `activity_execution_traces` directly
- **AND** the response is logged with `content_source: "legacy"`

### Requirement: Composite success indexes SHALL eliminate TableScans on the legacy table

`activity_execution_traces` SHALL carry `idx_aet_activity_success_time (activity_id, success, executed_at)` and `idx_aet_org_activity_success_time (org_id, activity_id, success, executed_at)`. The `execution` paradigm table SHALL additionally carry `idx_execution_activity_success_time (activity_id, success, executed_at)` to complement its existing `(org_id, success, executed_at)` index.

#### Scenario: Per-template success-history scan uses the index
- **WHEN** `EXPLAIN SELECT * FROM activity_execution_traces WHERE activity_id = $id AND success = true ORDER BY executed_at DESC LIMIT 20` runs after migration 113
- **THEN** the query plan references `idx_aet_activity_success_time` and does not contain a TableScan node
