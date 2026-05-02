## ADDED Requirements

### Requirement: Template editor provides trajectory editor launch option

The system SHALL add a button to launch the trajectory editor from the template editor interface.

#### Scenario: Launch trajectory from template list
- **WHEN** user clicks "Edit as Trajectory" on a template card
- **THEN** system navigates to trajectory editor with that template loaded

#### Scenario: Create new from trajectory
- **WHEN** user clicks "Create from Trajectory" button in templates page header
- **THEN** system opens empty trajectory editor for creating new template

### Requirement: Templates created via trajectory are compatible

The system SHALL ensure templates created through trajectory editor are fully compatible with existing template system.

#### Scenario: Import trajectory as template
- **WHEN** trajectory editor exports a template
- **THEN** template appears in templates library with correct metadata and tasks structure

#### Scenario: Edit trajectory-created template
- **WHEN** user loads a trajectory-created template in standard template editor
- **THEN** all fields display correctly without data loss
