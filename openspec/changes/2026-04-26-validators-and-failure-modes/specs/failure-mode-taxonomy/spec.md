## ADDED Requirements

### Requirement: failure_mode is a structured object with five enumerated types
The trace SHALL carry an optional `failure_mode` field as a structured object of the form `{ type, reason, context }`. The `type` SHALL be one of exactly five values: `verifier_negative`, `budget_exhausted`, `safety_breach`, `cascading`, `user_abort`. No other type values SHALL be accepted by the trace-ingestion schema.

#### Scenario: Schema accepts each of the five canonical types
- **WHEN** a trace is submitted with `failure_mode.type` set to any of `verifier_negative`, `budget_exhausted`, `safety_breach`, `cascading`, `user_abort`
- **THEN** the schema validation passes

#### Scenario: Schema rejects an unknown type
- **WHEN** a trace is submitted with `failure_mode.type: "unknown_failure"`
- **THEN** the schema validation fails with a discriminated-union error

### Requirement: Each type has a fixed mode-specific context shape
The `context` field of `failure_mode` SHALL be a discriminated union keyed by `type`. `verifier_negative.context: { validator_id: string, failed_evidence: Evidence[] }`. `budget_exhausted.context: { budget_type: "cost" | "duration", consumed: number, allowed: number }`. `safety_breach.context: { breach_type: "depth" | "cycle", limit: number, ancestor_chain: string[] }`. `cascading.context: { upstream_task_id: string, upstream_failure_mode?: FailureMode }`. `user_abort.context: { abort_source: "human_resolver" | "ctrl_c" | "workbench_button" }`.

#### Scenario: verifier_negative context shape
- **WHEN** a trace's `failure_mode.type` is `verifier_negative`
- **THEN** `context` MUST contain `validator_id` (string) and `failed_evidence` (array of Evidence rows); no other fields are required

#### Scenario: budget_exhausted context shape
- **WHEN** a trace's `failure_mode.type` is `budget_exhausted`
- **THEN** `context` MUST contain `budget_type` (one of `cost` | `duration`), `consumed` (number), and `allowed` (number)

#### Scenario: safety_breach context shape
- **WHEN** a trace's `failure_mode.type` is `safety_breach`
- **THEN** `context` MUST contain `breach_type` (one of `depth` | `cycle`), `limit` (number), and `ancestor_chain` (array of strings)

#### Scenario: cascading context shape with optional upstream_failure_mode
- **WHEN** a trace's `failure_mode.type` is `cascading` and the upstream task had no `failure_mode` set
- **THEN** `context.upstream_task_id` is present and `context.upstream_failure_mode` is omitted

#### Scenario: user_abort context shape
- **WHEN** a trace's `failure_mode.type` is `user_abort`
- **THEN** `context` MUST contain `abort_source` (one of the three enumerated values)

#### Scenario: Cross-variant fields rejected
- **WHEN** a trace is submitted with `failure_mode: { type: "verifier_negative", context: { budget_type: "cost", consumed: 5, allowed: 10 } }`
- **THEN** the schema validation fails (the `verifier_negative` variant does not allow `budget_type`)

### Requirement: failure_mode is optional and null for legacy traces
The `failure_mode` field on `activity_execution_traces` SHALL be optional. Traces stored before the field was added SHALL have `failure_mode: null`. No backfill SHALL be performed on legacy rows. New traces with `success: true` SHALL NOT carry a `failure_mode`.

#### Scenario: Legacy trace returns null failure_mode
- **WHEN** a trace stored before this change is read
- **THEN** the response carries `failure_mode: null`

#### Scenario: Successful new trace has no failure_mode
- **WHEN** a trace is submitted with `status: "success"`
- **THEN** `failure_mode` is null or omitted; the schema accepts both

#### Scenario: Failed new trace MAY carry failure_mode
- **WHEN** a trace is submitted with `status: "failure"` and a `failure_mode` populated
- **THEN** the schema validates and the field is persisted; if `failure_mode` is null on a failed trace, the schema still accepts it (no SHALL on populating failure_mode for newly failed traces — emitters that haven't yet adopted the taxonomy can still write traces)

### Requirement: failure_mode does not change Thompson update math in this spec
The Thompson Sampling α/β update path at `repos/metabob-activity-api/src/routes/execution-traces.ts:1306` and `:1579` SHALL remain unchanged. `failure_mode` SHALL be treated as metadata for stratified queries; no rules engine in this spec maps `failure_mode.type` to per-mode α/β deltas.

#### Scenario: Failed trace with verifier_negative produces same α/β delta as failed trace with cascading
- **WHEN** two failed traces are submitted, one with `failure_mode.type: "verifier_negative"` and one with `failure_mode.type: "cascading"`, both for the same `variant_id` and same shape match
- **THEN** the Thompson update applies the same `betaDelta` to both; the `failure_mode` does NOT alter the math

#### Scenario: Stratified query reads failure_mode without going through Thompson
- **WHEN** a downstream learning query asks "how many failures of type verifier_negative did this template have"
- **THEN** the query reads the `failure_mode.type` field directly from `activity_execution_traces`; no Thompson computation is involved

### Requirement: failure_mode is set at the source that detects the failure
`failure_mode` SHALL be set by the activity, resolver, or executor branch that detects the failure. The validator-dispatch meta-activity SHALL set `verifier_negative`. `HumanResolver` SHALL set `user_abort` when its `aborted` flag is true. The executor's cascading-skip path SHALL set `cascading`. Future budget-enforcement code SHALL set `budget_exhausted`. The sibling spec `shape-provider-goal-creation`'s depth/cycle guards SHALL set `safety_breach`. No post-task analyzer SHALL re-derive `failure_mode` from `error_message`.

#### Scenario: Validator-dispatch meta-activity stamps verifier_negative
- **WHEN** the validator-dispatch meta-activity collects a `validation_result` with `passed: false`
- **THEN** it stamps `failure_mode.type: "verifier_negative"` on the parent task's metadata before propagating completion

#### Scenario: HumanResolver aborted flag becomes user_abort
- **WHEN** `HumanResolver` returns a result with `aborted: true`
- **THEN** the resolver result carries `failure_mode: { type: "user_abort", context: { abort_source: "human_resolver" } }` and the executor propagates it to the trace unchanged

#### Scenario: Executor stamps cascading on dependency-skip
- **WHEN** task B is skipped because upstream task A failed
- **THEN** task B's metadata carries `failure_mode: { type: "cascading", context: { upstream_task_id: "A", upstream_failure_mode: <A's failure_mode if any> } }`

#### Scenario: upstream_failure_mode omitted when upstream had no failure_mode
- **WHEN** task B is skipped because upstream task A failed but A's trace lacks a `failure_mode` (legacy or pre-taxonomy)
- **THEN** task B's `failure_mode.context.upstream_failure_mode` is omitted (not set to null) — the optional field is simply absent
