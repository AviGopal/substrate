## ADDED Requirements

### Requirement: System displays side-by-side trace comparison

The system SHALL show execution trace and template side-by-side with synchronized scrolling and difference highlighting.

#### Scenario: Load trace for comparison
- **WHEN** user opens trajectory editor with execution trace ID
- **THEN** system displays left column with actual trace and right column with expected template

#### Scenario: Synchronized scrolling
- **WHEN** user scrolls in either trace or template column
- **THEN** system scrolls both columns together to maintain alignment

#### Scenario: Activity alignment
- **WHEN** trace and template have same activity sequence
- **THEN** system aligns matching activities horizontally across columns

### Requirement: System highlights differences between trace and template

The system SHALL visually indicate additions, removals, modifications, and sequence changes.

#### Scenario: Added activity in trace
- **WHEN** execution trace contains activity not in template
- **THEN** system highlights that activity in green with "Added" label

#### Scenario: Removed activity from trace
- **WHEN** template contains activity not executed in trace
- **THEN** system highlights that activity in red with "Not Executed" label

#### Scenario: Modified task within activity
- **WHEN** trace shows task with different configuration than template
- **THEN** system highlights the modified task in yellow with inline diff of changes

#### Scenario: Reordered activities
- **WHEN** trace executes activities in different order than template
- **THEN** system shows reordering indicators with arrows connecting original to new positions

### Requirement: Diff view shows execution failures

The system SHALL clearly indicate where execution failed and display error details.

#### Scenario: Failed task highlight
- **WHEN** trace shows task failed at Task 2 of Activity 3
- **THEN** system highlights failed task in red and displays error message

#### Scenario: Skipped subsequent tasks
- **WHEN** task failure caused remaining tasks to skip
- **THEN** system shows skipped tasks in gray with "Skipped due to failure" label

#### Scenario: Error details on hover
- **WHEN** user hovers over failed task
- **THEN** system displays tooltip with full error message, stack trace, and failure timestamp

### Requirement: User can create variant from diff view

The system SHALL allow users to modify the template based on trace differences and save as new variant.

#### Scenario: Accept trace changes
- **WHEN** user clicks "Accept" on an added activity in trace
- **THEN** system incorporates that activity into the template being edited

#### Scenario: Reject trace deviation
- **WHEN** user clicks "Reject" on a modified task
- **THEN** system keeps original template configuration unchanged

#### Scenario: Bulk accept changes
- **WHEN** user clicks "Accept All Changes"
- **THEN** system applies all trace differences to create modified template

### Requirement: Diff view displays projected impact

The system SHALL calculate and show estimated cost and duration differences between trace and template.

#### Scenario: Show cost delta
- **WHEN** trace contains additional activities compared to template
- **THEN** system displays "Projected cost increase: +$0.15" based on trace execution data

#### Scenario: Show duration delta
- **WHEN** template has more activities than trace executed
- **THEN** system displays "Projected duration decrease: -30s" if those activities were skipped

#### Scenario: Confidence impact
- **WHEN** user modifies template based on trace
- **THEN** system shows how Thompson Sampling confidence would change with the modifications
