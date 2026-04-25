## ADDED Requirements

### Requirement: Detect feedback loops
The system SHALL detect when an activity's output shapes include all its input shapes (potential cycle).

#### Scenario: Cycle detected
- **WHEN** activity has `input_shapes: ["systemMetrics"]` and `output_shapes: ["systemMetrics", "alertLog"]`
- **THEN** cycle indicator shown with warning badge

### Requirement: Validate loop productivity
The system SHALL distinguish productive cycles (add new shapes) from infinite loops (no new output).

#### Scenario: Productive cycle allowed
- **WHEN** cycle adds new shape "alertLog" each iteration
- **THEN** indicator shows "Productive Cycle" with green status

#### Scenario: Infinite loop blocked
- **WHEN** cycle produces no new shapes
- **THEN** warning shown "Infinite loop detected - execution will not terminate"
- **AND** execution blocked with override option

### Requirement: Suggest termination conditions
The system SHALL suggest adding termination conditions for continuous cycles.

#### Scenario: Termination suggestion displayed
- **WHEN** productive cycle detected
- **THEN** suggestion shows "Add manual stop or condition-based exit"
