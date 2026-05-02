## ADDED Requirements

### Requirement: User can load existing activity as trajectory

The system SHALL allow users to click on any activity template and load it into the trajectory editor for modification.

#### Scenario: Load from templates library
- **WHEN** user clicks "Edit as Trajectory" button on activity template detail page
- **THEN** system opens trajectory editor with all tasks from that template loaded

#### Scenario: Populate trajectory box
- **WHEN** activity template is loaded into editor
- **THEN** system fills trajectory box with the activity's description or inferred goal

#### Scenario: Display template genealogy
- **WHEN** loaded activity has variant_of relationship
- **THEN** system shows genealogy tree (v1 → v2 → v3) with current variant highlighted

### Requirement: User can modify loaded template tasks

The system SHALL support inline editing of all task properties including prompts, validation, and configuration.

#### Scenario: Edit task prompt
- **WHEN** user changes task prompt text
- **THEN** system marks template as modified and updates trajectory state

#### Scenario: Add new task to sequence
- **WHEN** user clicks "Add Task" within an activity
- **THEN** system inserts new task form with default configuration

#### Scenario: Remove existing task
- **WHEN** user clicks "Remove" on a task
- **THEN** system prompts for confirmation and removes task from activity

#### Scenario: Reorder tasks within activity
- **WHEN** user drags task to new position within activity
- **THEN** system updates task execution order

### Requirement: User can adjust Thompson Sampling scores

The system SHALL provide controls to manually adjust alpha and beta parameters for template variants.

#### Scenario: View current scores
- **WHEN** user expands learning parameters section
- **THEN** system displays current alpha (successes) and beta (failures) values

#### Scenario: Increase success weight
- **WHEN** user increments alpha parameter
- **THEN** system updates Thompson Sampling confidence and shows projected selection probability

#### Scenario: Penalize variant
- **WHEN** user increments beta parameter
- **THEN** system decreases Thompson Sampling confidence to reduce future selection probability

#### Scenario: Reset scores
- **WHEN** user clicks "Reset to defaults"
- **THEN** system sets alpha=1, beta=0 for fresh variant

### Requirement: User can adjust selection strength

The system SHALL allow tuning of exploration vs exploitation trade-off for the template.

#### Scenario: Set exploration mode
- **WHEN** user sets selection strength to 0.2
- **THEN** system configures template for high exploration (frequently try despite failures)

#### Scenario: Set exploitation mode
- **WHEN** user sets selection strength to 0.9
- **THEN** system configures template for high exploitation (prefer only if proven successful)

#### Scenario: Show impact preview
- **WHEN** user adjusts selection strength slider
- **THEN** system shows real-time preview of how often this variant would be selected

### Requirement: System saves variant with genealogy tracking

The system SHALL create new variant linked to parent template with updated scores.

#### Scenario: Save as variant
- **WHEN** user clicks "Save as Variant" button
- **THEN** system creates new activity template with incremented version (v4 from v3)

#### Scenario: Initialize variant scores
- **WHEN** new variant is created
- **THEN** system sets alpha=1, beta=0 (fresh scores) unless user manually adjusted

#### Scenario: Link to parent
- **WHEN** variant is saved
- **THEN** system sets variant_of field to parent template ID and updates genealogy tree

#### Scenario: Preserve parent scores
- **WHEN** new variant is created from parent
- **THEN** system leaves parent's Thompson scores unchanged (variants compete independently)
