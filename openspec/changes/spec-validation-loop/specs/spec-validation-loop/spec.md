## ADDED Requirements

### Requirement: define-specification activity
The system SHALL provide an activity `define-specification` that accepts `goal`, `codebase_structure`, and `requirements` impulses and produces a `specification` impulse describing the intent, expected behaviors, and success criteria for the goal.

#### Scenario: Specification from goal
- **WHEN** a `goal` impulse is available and `define-specification` is executed
- **THEN** a `specification` impulse is produced containing at minimum: goal summary, expected behaviors list, success criteria, and scope of applicable code components

#### Scenario: Specification includes testable criteria
- **WHEN** the specification is produced
- **THEN** the success criteria section SHALL contain at least one criterion that can be evaluated without LLM reasoning (file existence, pattern match, exit code, or URL response)

### Requirement: spec-to-enforcement-activity activity
The system SHALL provide an activity `spec-to-enforcement-activity` that accepts a `specification` impulse and produces an `activity_template` impulse representing an enforcement activity — one that runs the code or checks it against the specification and reports pass/fail.

#### Scenario: Enforcement activity has input/output shapes
- **WHEN** `spec-to-enforcement-activity` executes against a specification
- **THEN** the produced `activity_template` SHALL declare `input_shapes` and `output_shapes` including `validation_result` as an output shape

#### Scenario: Enforcement activity is executable
- **WHEN** the produced enforcement `activity_template` is registered and executed by MiniBob
- **THEN** it SHALL complete without error and produce a `validation_result` impulse

### Requirement: enforcement-to-validation-activity activity
The system SHALL provide an activity `enforcement-to-validation-activity` that accepts an `activity_template` (enforcement) impulse and produces an `activity_template` (validation) impulse that is idempotent and non-destructive.

#### Scenario: Validation variant is read-only
- **WHEN** the validation activity_template is executed
- **THEN** it SHALL NOT modify any files, write to git, or execute destructive commands; it SHALL only read, compare, and report

#### Scenario: Validation variant produces validation_result
- **WHEN** the validation activity executes
- **THEN** it SHALL produce a `validation_result` impulse with fields: `passed: boolean`, `component: string`, `spec_section: string`, `evidence: string`

### Requirement: map-components-to-validations activity
The system SHALL provide an activity `map-components-to-validations` that accepts `file` and `activity_template` (validation) impulses and produces a `validation_mapping` impulse describing which validation activity applies to which code components.

#### Scenario: Mapping covers all files in scope
- **WHEN** a directory tree and a validation activity_template are provided
- **THEN** the produced `validation_mapping` SHALL list every file or component relevant to the specification, each associated with the applicable validation activity ID

#### Scenario: Unmapped components are flagged
- **WHEN** a file exists in scope but no validation activity covers it
- **THEN** the `validation_mapping` SHALL include the file in an `unmapped_components` list

### Requirement: update-specs-from-validation activity
The system SHALL provide an activity `update-specs-from-validation` that accepts `validation_result` and `specification` impulses and produces an updated `specification` impulse reflecting what the validation revealed.

#### Scenario: Spec updated when validation fails
- **WHEN** a `validation_result` with `passed: false` is provided alongside a `specification`
- **THEN** the produced specification SHALL add or refine the relevant success criterion to reflect the failure

#### Scenario: Spec unchanged when validation passes
- **WHEN** all `validation_result` impulses have `passed: true`
- **THEN** the produced specification SHALL be semantically equivalent to the input specification

### Requirement: synchronize-spec-validation activity
The system SHALL provide an activity `synchronize-spec-validation` that accepts `specification` and `validation_mapping` impulses and produces a `sync_report` impulse describing alignment between them.

#### Scenario: Converged sync report
- **WHEN** all components in `validation_mapping` have corresponding spec sections and all pass validation
- **THEN** the `sync_report` SHALL include `converged: true`

#### Scenario: Diverged sync report
- **WHEN** any component is unmapped, any validation fails, or any spec section has no corresponding mapping
- **THEN** the `sync_report` SHALL include `converged: false` and a `divergences` list describing each gap

### Requirement: spec-validation-loop meta-activity
The system SHALL provide a meta-activity `spec-validation-loop` that accepts a `goal` impulse and orchestrates all six sub-activities in sequence, looping until convergence or a stopping condition is reached.

#### Scenario: Loop exits on convergence
- **WHEN** `synchronize-spec-validation` produces a `sync_report` with `converged: true`
- **THEN** the meta-activity SHALL exit the loop and produce the final `sync_report` as its output

#### Scenario: Loop exits on budget exhaustion
- **WHEN** the accumulated cost_usd of all executed activities reaches or exceeds the configured budget
- **THEN** the meta-activity SHALL exit the loop with a `sync_report` containing `stopped_reason: "budget"`

#### Scenario: Loop exits on max-sequences
- **WHEN** the number of completed activity sequences reaches the configured max_sequences limit
- **THEN** the meta-activity SHALL exit the loop with a `sync_report` containing `stopped_reason: "max_sequences"`

#### Scenario: Loop records composition chain
- **WHEN** the meta-activity executes sub-activities
- **THEN** each sub-activity execution trace SHALL include the meta-activity's execution ID in its `parent_execution_id` field

### Requirement: Specification is an external impulse, not an inline check
The system SHALL ensure that validation activities receive the `specification` as an input impulse rather than embedding specification content inside the template's task prompts.

#### Scenario: Validation activity accepts specification at runtime
- **WHEN** a validation activity_template is instantiated for execution
- **THEN** the `specification` impulse SHALL appear in its `input_shapes` and be resolved from the impulse pool, not hardcoded in the template

#### Scenario: Same validation template, different specifications
- **WHEN** the same validation activity_template is executed with two different `specification` impulses
- **THEN** it SHALL produce different `validation_result` outputs reflecting each specification's criteria
