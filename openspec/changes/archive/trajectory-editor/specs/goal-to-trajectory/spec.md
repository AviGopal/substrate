## ADDED Requirements

### Requirement: User can initialize trajectory from goal text

The system SHALL accept natural language goal input and generate a prospective activity sequence using Thompson Sampling recommendations.

#### Scenario: Enter goal in trajectory box
- **WHEN** user types "Fix security vulnerabilities" in the trajectory input
- **THEN** system displays the goal text and enables "Generate Path" button

#### Scenario: Generate prospective chain
- **WHEN** user clicks "Generate Path" with goal text entered
- **THEN** system calls backend path recommendation endpoint and displays suggested activity sequence

#### Scenario: No recommendations available
- **WHEN** backend returns no path recommendations for the goal
- **THEN** system displays "No automatic path found" message and shows activity palette for manual selection

### Requirement: System displays path confidence and alternatives

The system SHALL show Thompson Sampling confidence scores and allow user to choose between multiple recommended paths.

#### Scenario: Display confidence scores
- **WHEN** system receives multiple path recommendations
- **THEN** system displays each path with its confidence percentage and estimated cost

#### Scenario: Choose alternative path
- **WHEN** user clicks on a non-primary recommendation
- **THEN** system loads that path into the trajectory editor instead of the default

#### Scenario: Show path details on hover
- **WHEN** user hovers over a recommended path
- **THEN** system displays tooltip with full activity sequence and success rate history

### Requirement: Generated trajectory is editable

The system SHALL allow users to modify the auto-generated trajectory before saving.

#### Scenario: Edit generated path
- **WHEN** system generates prospective chain from goal
- **THEN** user can add, remove, or reorder activities using standard editor controls

#### Scenario: Preserve goal context
- **WHEN** user modifies generated trajectory
- **THEN** system preserves the original goal text in trajectory header for reference

### Requirement: System predicts goal endpoint

The system SHALL analyze the activity sequence and indicate when the predicted output shapes match the goal requirement.

#### Scenario: Goal endpoint reached
- **WHEN** final activity in trajectory produces shapes matching goal requirements
- **THEN** system displays "✓ Goal Endpoint" indicator after the last activity

#### Scenario: Goal endpoint not reached
- **WHEN** final activity shapes do not match goal requirements
- **THEN** system shows "⚠ Goal not reached" warning with missing shapes list

#### Scenario: Suggest completing activities
- **WHEN** goal endpoint is not reached
- **THEN** system recommends additional activities that could produce the missing shapes
