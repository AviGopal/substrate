## ADDED Requirements

### Requirement: Define expectations as impulses
Activities SHALL declare expected behavior at trace points using execution-expectation impulses.

#### Scenario: Create execution expectation
- **WHEN** activity defines expected state for trace point
- **THEN** system stores as execution-expectation impulse with trace point ID, expected values, tolerance

#### Scenario: Expectations reference trace points
- **WHEN** execution-expectation impulse is created
- **THEN** it MUST reference valid trace point ID from instrumentation spec

#### Scenario: Multiple expectations per trace point
- **WHEN** trace point has multiple assertions
- **THEN** system allows multiple execution-expectation impulses for same trace point ID

### Requirement: Compare traced behavior against expectations
The system SHALL validate actual execution traces against expectation impulses.

#### Scenario: Exact match validation
- **WHEN** expectation specifies exact value and trace captures matching value
- **THEN** validation succeeds with confidence 1.0

#### Scenario: Tolerance-based validation
- **WHEN** expectation specifies numeric tolerance and trace value within range
- **THEN** validation succeeds with confidence based on distance from expected

#### Scenario: Pattern matching validation
- **WHEN** expectation specifies regex or structural pattern
- **THEN** validation succeeds if traced value matches pattern

#### Scenario: Missing trace point
- **WHEN** expectation references trace point not captured in execution
- **THEN** validation fails with "missing-trace-point" reason

### Requirement: Validation results are recorded
All expectation validations SHALL be stored with execution traces.

#### Scenario: Record validation success
- **WHEN** trace matches expectation
- **THEN** system records validation result with expectation ID, trace point ID, confidence score

#### Scenario: Record validation failure
- **WHEN** trace does not match expectation
- **THEN** system records failure with expected vs actual values, difference, failure reason

#### Scenario: Aggregate validation metrics
- **WHEN** activity executes multiple times
- **THEN** system tracks validation success rate per expectation across executions

### Requirement: Validation strategies are configurable
Expectations SHALL support different validation approaches appropriate to the assertion type.

#### Scenario: Strict equality validation
- **WHEN** expectation uses "strict-equality" strategy
- **THEN** validation requires exact match including type

#### Scenario: Structural validation
- **WHEN** expectation uses "structural" strategy
- **THEN** validation checks object shape and property types without exact value match

#### Scenario: Semantic validation
- **WHEN** expectation uses "semantic" strategy
- **THEN** validation uses LLM to assess whether behavior matches intent description

#### Scenario: Custom validator
- **WHEN** expectation includes custom validation function
- **THEN** system executes validator with trace data and uses boolean result

### Requirement: Failed validations trigger learning
Validation failures SHALL initiate appropriate learning responses based on activity intent.

#### Scenario: Code-must-conform failure
- **WHEN** validation fails for expectation with intent "code-must-conform"
- **THEN** system marks as bug detection and creates fix-validation-failure activity

#### Scenario: Expectations-may-evolve failure
- **WHEN** validation fails for expectation with intent "expectations-may-evolve"
- **THEN** system creates update-expectation activity to refine understanding

#### Scenario: Ambiguous intent failure
- **WHEN** validation fails without explicit intent marker
- **THEN** system records failure and asks user whether to fix code or update expectation
