## ADDED Requirements

### Requirement: Pre-validation check before LLM execution

The system SHALL check validation rules that can be evaluated against current filesystem state BEFORE calling the LLM. Pre-checkable rules include `requiredFiles` (file existence) and `forbiddenPatterns` (pattern absence in existing files).

#### Scenario: Skip LLM when required files already exist
- **WHEN** a task has `validation.requiredFiles` specifying files that already exist in the filesystem
- **AND** no other validation rules require task output
- **THEN** the system SHALL skip the LLM call and return success with `metadata.preValidationPassed: true`

#### Scenario: Skip LLM when no forbidden patterns found
- **WHEN** a task has `validation.forbiddenPatterns` specifying patterns to check in existing files
- **AND** none of the forbidden patterns are found in the specified files
- **AND** no other validation rules require task output
- **THEN** the system SHALL skip the LLM call and return success

#### Scenario: Continue to LLM when pre-validation fails
- **WHEN** pre-validation check fails (required file missing or forbidden pattern found)
- **THEN** the system SHALL continue to LLM execution (task may fix the issue)
- **AND** the system SHALL NOT fail the task based on pre-validation alone

#### Scenario: Continue to LLM when validation requires task output
- **WHEN** a task has `validation.requiredPatterns` that need to match task output
- **OR** a task has `validation.commands` that need to execute
- **THEN** the system SHALL proceed to LLM execution regardless of pre-checkable rules

### Requirement: Pre-validation result tracking

The system SHALL track pre-validation results for observability and cost optimization metrics.

#### Scenario: Track token savings from skipped LLM calls
- **WHEN** pre-validation passes and LLM is skipped
- **THEN** the system SHALL record `estimatedTokenSavings` in task result metadata
- **AND** the system SHALL log the skip with reason

#### Scenario: Include pre-validation in execution trace
- **WHEN** pre-validation is performed (pass or fail)
- **THEN** the execution trace SHALL include `preValidationResult` with:
  - `passed: boolean`
  - `checkedRules: number`
  - `failedRules: Array<{rule, details}>`

### Requirement: Pre-validation latency constraint

Pre-validation checks SHALL complete within 100ms to avoid impacting task execution latency.

#### Scenario: Fast pre-validation execution
- **WHEN** pre-validation checks run
- **THEN** the total pre-validation time SHALL be less than 100ms
- **AND** if pre-validation exceeds 100ms, the system SHALL proceed to LLM execution with a warning log
