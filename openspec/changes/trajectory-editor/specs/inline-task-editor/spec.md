## ADDED Requirements

### Requirement: Activity cards expand to show task details

The system SHALL display activities as collapsible cards that expand inline to reveal task configuration.

#### Scenario: Expand activity for editing
- **WHEN** user clicks expand icon (▸) on an activity card
- **THEN** system expands the card inline to show all tasks with editable fields

#### Scenario: Collapse to summary view
- **WHEN** user clicks collapse icon (▾) on an expanded activity
- **THEN** system collapses the card back to summary view showing only activity name and shapes

#### Scenario: Preserve other activities visibility
- **WHEN** user expands one activity
- **THEN** system keeps other activities visible in the trajectory (no modal or full-screen takeover)

### Requirement: User can edit task prompts inline

The system SHALL provide text areas for editing LLM task prompts without leaving the trajectory view.

#### Scenario: Edit prompt text
- **WHEN** user modifies text in a task prompt field
- **THEN** system updates the task configuration in real-time

#### Scenario: Template variable highlighting
- **WHEN** task prompt contains variables like ${vulnerability_report}
- **THEN** system highlights variables with distinct styling and validates they reference available impulses

#### Scenario: Prompt validation
- **WHEN** user enters empty prompt for LLM task
- **THEN** system shows validation error "Prompt required for LLM tasks"

### Requirement: User can configure validation rules inline

The system SHALL provide form controls for editing task validation rules including required files and patterns.

#### Scenario: Add required file pattern
- **WHEN** user clicks "Add Required File" in validation section
- **THEN** system adds new input field for file path pattern

#### Scenario: Edit forbidden pattern
- **WHEN** user modifies regex in forbidden pattern field
- **THEN** system validates regex syntax and shows error if invalid

#### Scenario: Remove validation rule
- **WHEN** user clicks "×" button next to a validation rule
- **THEN** system removes that rule from the task configuration

### Requirement: User can adjust retry configuration

The system SHALL allow editing of retry attempts and strategy for individual tasks.

#### Scenario: Set max retry attempts
- **WHEN** user changes max attempts from 3 to 5
- **THEN** system updates task retry configuration

#### Scenario: Change retry strategy
- **WHEN** user selects "exponential backoff" from strategy dropdown
- **THEN** system updates retry strategy and shows relevant configuration options

### Requirement: Changes auto-save to trajectory state

The system SHALL automatically persist inline edits to the trajectory store without requiring explicit save action.

#### Scenario: Auto-save on blur
- **WHEN** user finishes editing a field and clicks elsewhere
- **THEN** system saves changes to trajectory state within 500ms

#### Scenario: Validation before save
- **WHEN** user enters invalid configuration (empty required field)
- **THEN** system shows validation error and prevents save until corrected

### Requirement: Inline editor shows live preview

The system SHALL display preview of how task will execute based on current configuration.

#### Scenario: Preview prompt rendering
- **WHEN** user edits prompt with variables
- **THEN** system shows preview with variables replaced by sample values

#### Scenario: Show affected files
- **WHEN** user adds required file pattern "src/**/*.ts"
- **THEN** system shows count of matching files in current project
