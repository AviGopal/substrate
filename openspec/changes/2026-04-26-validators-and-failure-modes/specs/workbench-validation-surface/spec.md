## ADDED Requirements

### Requirement: ValidationErrorDisplay renders runtime validator output
`repos/workbench/src/components/trajectory/ValidationErrorDisplay.tsx` SHALL accept a discriminated `runtime_validator` variant of `ShapeValidationError` carrying `validatorId`, `passed`, `confidence`, optional `failureMode`, `evidence[]`, `messages[]`, and `taskId`. The component SHALL continue to render existing authoring-time variants (`missing_input`, `incompatible_shape`, `no_output`) without behavioural change.

#### Scenario: Authoring-time errors unchanged
- **WHEN** the component is rendered with only authoring-time `ShapeValidationError` entries
- **THEN** the rendering matches existing behaviour byte-for-byte (no new badges, no new sections)

#### Scenario: Runtime passed validator renders as success row
- **WHEN** the component receives a `runtime_validator` entry with `passed: true` and `confidence: 0.95`
- **THEN** a green check, the `validatorId`, and the confidence (rendered to two decimal places) appear

#### Scenario: Runtime failed validator renders failure_mode.type
- **WHEN** the component receives a `runtime_validator` entry with `passed: false` and `failureMode: { type: "verifier_negative", ... }`
- **THEN** a red X, the `validatorId`, the failure_mode.type label (`verifier_negative`), and the first failed evidence row's details appear

#### Scenario: Mixed authoring and runtime entries
- **WHEN** the component receives both authoring-time and runtime entries
- **THEN** both render in the same panel; runtime entries appear in a section labeled "Runtime validation" beneath authoring entries

### Requirement: ImpulseStatePanel shows per-task validation indicator
`repos/workbench/src/components/trajectory/ImpulseStatePanel.tsx` SHALL render a per-task validation indicator for each task in the current trajectory. The indicator SHALL be derived from the `validation_result` impulses associated with that task in the current execution.

#### Scenario: All passed renders green badge with confidence
- **WHEN** a task has one or more `validation_result` impulses, all with `passed: true`
- **THEN** the indicator is a green badge showing the minimum confidence across the results, e.g. `Validated · 0.95`

#### Scenario: Any failed renders red badge with failure_mode.type
- **WHEN** a task has at least one `validation_result` with `passed: false`
- **THEN** the indicator is a red badge showing the failed validator's `failure_mode.type`, e.g. `verifier_negative`

#### Scenario: No validators dispatched renders gray "no validators"
- **WHEN** a task has zero `validation_result` impulses associated with it
- **THEN** the indicator is a gray badge labeled `no validators` (or equivalent low-key label)

#### Scenario: Indicator updates as live execution progresses
- **WHEN** an execution is live and a `validation_result` impulse arrives via WebSocket for the current task
- **THEN** the indicator transitions from `no validators` (or `pending`) to the appropriate green/red state without a page reload

### Requirement: ExecutionHistoryPanel renders failure_mode taxonomy
`repos/workbench/src/components/trajectory/ExecutionHistoryPanel.tsx` SHALL render `failure_mode.type` and an abbreviated `failure_mode.context` summary for each failed trace. When `failure_mode` is null on a failed trace, the panel SHALL fall back to the existing `error_message` rendering. Successful traces SHALL show no failure-mode UI regardless of state.

#### Scenario: verifier_negative renders with validator_id
- **WHEN** a failed trace carries `failure_mode: { type: "verifier_negative", context: { validator_id: "schema-validator", ... } }`
- **THEN** the row renders `verifier_negative · schema-validator`

#### Scenario: budget_exhausted renders with budget_type and consumed/allowed
- **WHEN** a failed trace carries `failure_mode: { type: "budget_exhausted", context: { budget_type: "cost", consumed: 1.2, allowed: 1.0 } }`
- **THEN** the row renders `budget_exhausted · cost (1.2/1.0)` (formatting may vary; the three values are present)

#### Scenario: safety_breach renders with breach_type and limit
- **WHEN** a failed trace carries `failure_mode: { type: "safety_breach", context: { breach_type: "depth", limit: 3, ancestor_chain: [...] } }`
- **THEN** the row renders `safety_breach · depth (limit 3)`

#### Scenario: cascading renders with upstream_task_id
- **WHEN** a failed trace carries `failure_mode: { type: "cascading", context: { upstream_task_id: "task-A", ... } }`
- **THEN** the row renders `cascading · upstream task-A`

#### Scenario: user_abort renders with abort_source
- **WHEN** a failed trace carries `failure_mode: { type: "user_abort", context: { abort_source: "human_resolver" } }`
- **THEN** the row renders `user_abort · human_resolver`

#### Scenario: Legacy failed trace falls back to error_message
- **WHEN** a failed trace carries `failure_mode: null` and `error_message: "Some message"`
- **THEN** the row renders `Some message` (existing behaviour) without any `failure_mode` decoration

#### Scenario: Successful trace shows no failure-mode UI
- **WHEN** a trace carries `status: "success"`
- **THEN** the row shows no failure-mode label regardless of any incidental fields

### Requirement: ExecutionHistoryPanel filter by failure_mode type
`ExecutionHistoryPanel` SHALL provide a filter (multi-select dropdown) for `failure_mode.type`. The default state SHALL be "all" (no filter). When the user selects one or more types, the panel SHALL show only traces matching one of the selected types. Traces with `failure_mode: null` SHALL appear only when the special "no taxonomy" option (or "all") is selected.

#### Scenario: Default "all" shows every trace
- **WHEN** the filter is at its default
- **THEN** the panel shows successful traces, failed traces with failure_mode, and failed traces without failure_mode

#### Scenario: Filter to verifier_negative only
- **WHEN** the user selects `verifier_negative`
- **THEN** only traces with `failure_mode.type === "verifier_negative"` are shown

#### Scenario: Multi-select filter
- **WHEN** the user selects `verifier_negative` and `cascading`
- **THEN** only traces matching either type are shown

#### Scenario: Legacy traces hidden when filtering
- **WHEN** the user selects `verifier_negative` and a failed trace has `failure_mode: null`
- **THEN** the legacy trace is hidden from the filtered view (it does NOT match the selection)
