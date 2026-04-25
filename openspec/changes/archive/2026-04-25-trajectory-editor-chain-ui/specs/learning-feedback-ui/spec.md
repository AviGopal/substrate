## ADDED Requirements

### Requirement: Show Thompson parameter updates
The system SHALL display Thompson Sampling parameter changes after execution completes.

#### Scenario: Parameter delta shown post-execution
- **WHEN** execution succeeds and updates α from 45 to 46
- **THEN** feedback panel shows "debug-null-pointer: α=45 → 46 (success)"

### Requirement: Display variant creation
The system SHALL notify user when modified execution creates new variant.

#### Scenario: Variant created notification
- **WHEN** user modified task 2 and execution succeeded
- **THEN** alert displays "New variant created: activity-name-v2"

### Requirement: Show composition edge updates
The system SHALL display composition graph edge weight changes after execution.

#### Scenario: Edge success rate updated
- **WHEN** Activity A → B transition succeeds
- **THEN** feedback shows "A → B: 89% → 90% success rate"
