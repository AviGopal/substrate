## ADDED Requirements

### Requirement: Execution details page provides trajectory editing option

The system SHALL add a button to load execution trace into trajectory editor for analysis and variant creation.

#### Scenario: Edit trace as trajectory
- **WHEN** user clicks "Edit as Trajectory" button on execution details page
- **THEN** system navigates to trajectory editor with execution trace loaded

#### Scenario: Show edit option for failed executions
- **WHEN** execution has failed status
- **THEN** system prominently displays "Fix in Trajectory Editor" button

#### Scenario: Preserve trace ID in editor
- **WHEN** trajectory editor loads from trace
- **THEN** system preserves trace ID for diff comparison and variant creation
