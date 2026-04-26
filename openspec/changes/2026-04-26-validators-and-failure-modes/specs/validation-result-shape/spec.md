## ADDED Requirements

### Requirement: validation_result is a single canonical shape with a passed boolean
The system SHALL emit a single canonical `validation_result` shape carrying a `passed: boolean` field as the discriminator between positive and negative outcomes. The system SHALL NOT split into separate `validation_passed` and `validation_failed` shapes.

#### Scenario: Positive validation produces a passed=true validation_result
- **WHEN** a validator activity completes its checks with all evidence rows passing
- **THEN** it emits exactly one impulse of shape `validation_result` with `passed: true`

#### Scenario: Negative validation produces a passed=false validation_result
- **WHEN** a validator activity completes its checks with at least one evidence row failing
- **THEN** it emits exactly one impulse of shape `validation_result` with `passed: false`

### Requirement: validation_result body has a fixed structure
The body of a `validation_result` impulse SHALL contain the fields `passed: boolean`, `confidence: number` (0..1), `validator_id: string`, optional `failure_mode: FailureMode` (present only when `passed === false`), `evidence: Array<{ check_id: string, passed: boolean, details?: string, location?: string }>`, and `messages: Array<{ severity: "info" | "warning" | "error", text: string }>`.

#### Scenario: All required fields present on a passed result
- **WHEN** a validator emits a passed result
- **THEN** the body has `passed: true`, a numeric `confidence`, a `validator_id` matching the validator activity's id, an `evidence` array (possibly empty), and a `messages` array (possibly empty); `failure_mode` is absent or null

#### Scenario: failure_mode populated only on negative
- **WHEN** a validator emits a failed result
- **THEN** the body's `failure_mode` is present and matches the `FailureMode` discriminated union; on a passed result `failure_mode` is absent

#### Scenario: validator_id matches the validator activity's id
- **WHEN** a validator activity with template id `pattern-validator-canonical` emits a `validation_result`
- **THEN** the body's `validator_id` equals `pattern-validator-canonical`

### Requirement: confidence semantics by resolver tier
Pattern-based and schema-based validators (deterministic resolver tier) SHALL set `confidence: 1.0`. LLM semantic validators (LLM resolver tier) SHALL set `confidence` to the model's self-reported confidence when available, or to a fixed prior of `0.7` when absent.

#### Scenario: Pattern validator reports confidence 1.0
- **WHEN** a pattern-based validator emits a `validation_result`
- **THEN** the body's `confidence` is exactly `1.0`

#### Scenario: LLM validator with model self-report
- **WHEN** an LLM semantic validator's response carries a confidence number
- **THEN** the body's `confidence` equals that number, clamped to `[0, 1]`

#### Scenario: LLM validator without self-report uses 0.7 prior
- **WHEN** an LLM semantic validator's response does not carry a confidence number
- **THEN** the body's `confidence` is `0.7`

### Requirement: Existing validation emitters migrate to the unified shape
The three existing emission sites SHALL be migrated to emit `validation_result` with the unified body. `repos/minibob/src/resolvers/validation-resolver.ts:128` already emits `validation_result` and SHALL adopt the unified body. `repos/minibob/src/resolvers/pattern-validator.ts:155` SHALL rename emitted shape from `pattern_validation_result` to `validation_result`. `repos/minibob/src/resolvers/pre-validation-resolver.ts:156` SHALL rename emitted shape from `pre_validation_result` to `validation_result`. `repos/minibob/src/resolvers/goal-verification-resolver.ts` SHALL co-emit a `validation_result` impulse alongside its existing goal-shape output.

#### Scenario: ValidationResolver emits unified shape
- **WHEN** `ValidationResolver` finishes its check run
- **THEN** the emitted impulse's `metadata.shape` is `validation_result` and its body matches the unified contract

#### Scenario: PatternValidator emits unified shape (renamed from pattern_validation_result)
- **WHEN** `PatternValidator` finishes its check run
- **THEN** the emitted impulse's `metadata.shape` is `validation_result` (not `pattern_validation_result`) and its body matches the unified contract

#### Scenario: pre-validation-resolver emits unified shape (renamed from pre_validation_result)
- **WHEN** the pre-validation resolver finishes
- **THEN** the emitted impulse's `metadata.shape` is `validation_result` (not `pre_validation_result`)

#### Scenario: goal-verification-resolver co-emits validation_result
- **WHEN** the goal verification resolver completes its goal-scope check
- **THEN** in addition to its existing goal-shape impulse, it emits one `validation_result` impulse whose `passed` mirrors `goal_satisfied`

### Requirement: validation_result is persisted via the impulse store
A `validation_result` impulse SHALL be written to the impulse store via the same path as any other emitted impulse. No bespoke persistence layer SHALL be added for `validation_result`. Workbench and learning queries SHALL read it via the same impulse-resolution paths used for other shapes.

#### Scenario: validation_result impulse is queryable via the impulse store
- **WHEN** a validator emits a `validation_result` and the trace is stored
- **THEN** querying the impulse store by impulse id returns the impulse with the unified body intact

#### Scenario: No new table is added for validation_result
- **WHEN** a fresh activity-api deployment runs migrations
- **THEN** no `validation_result_table` (or similarly named bespoke table) exists; `validation_result` impulses are stored alongside other impulses
