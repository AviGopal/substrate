## ADDED Requirements

### Requirement: System displays activities in horizontal grid layout

The system SHALL render activities as cards in a horizontal grid where columns represent sequential execution order and rows within columns represent parallel execution.

#### Scenario: Sequential execution in columns
- **WHEN** user adds three activities to a trajectory
- **THEN** system displays them in three consecutive columns from left to right

#### Scenario: Parallel execution in rows
- **WHEN** user adds two activities to the same column
- **THEN** system displays them stacked vertically in that column with visual indicators showing parallel execution

#### Scenario: Grid snapping
- **WHEN** user drags an activity to reposition it
- **THEN** system snaps the activity to the nearest grid column and row

### Requirement: User can add activities to trajectory

The system SHALL allow users to add activities to the trajectory by selecting from a palette or search interface.

#### Scenario: Adding activity from palette
- **WHEN** user clicks an activity in the palette
- **THEN** system appends the activity to the end of the trajectory in a new column

#### Scenario: Inserting activity between existing activities
- **WHEN** user clicks "+" button between two activities
- **THEN** system shows activity selector and inserts chosen activity between them

#### Scenario: Search for activities
- **WHEN** user types in activity search field
- **THEN** system filters palette showing only activities matching the search term

### Requirement: User can remove activities from trajectory

The system SHALL provide controls to remove individual activities from the sequence.

#### Scenario: Remove activity
- **WHEN** user clicks "×" button on an activity card
- **THEN** system removes the activity and reflows remaining activities to close the gap

#### Scenario: Confirm destructive removal
- **WHEN** user attempts to remove an activity with unsaved task edits
- **THEN** system shows confirmation dialog before removing

### Requirement: User can reorder activities via drag-and-drop

The system SHALL support drag-and-drop reordering of activities within the grid.

#### Scenario: Drag to reorder sequentially
- **WHEN** user drags activity from column 2 to column 4
- **THEN** system moves the activity and renumbers columns accordingly

#### Scenario: Drag to create parallel execution
- **WHEN** user drags activity vertically within a column
- **THEN** system positions it as a parallel activity in that column's row

#### Scenario: Visual feedback during drag
- **WHEN** user is dragging an activity
- **THEN** system shows drop zones with visual indicators and grays out invalid positions

### Requirement: System validates impulse shape compatibility

The system SHALL validate that activity output shapes match subsequent activity input shapes and display validation errors.

#### Scenario: Compatible shapes
- **WHEN** activity A produces output_shapes ["source_code"] and activity B requires input_shapes ["source_code"]
- **THEN** system shows green checkmark indicator between the activities

#### Scenario: Incompatible shapes
- **WHEN** activity A produces ["error_log"] but activity B requires ["source_code"]
- **THEN** system highlights the incompatibility with red border and warning message

#### Scenario: Missing required shape
- **WHEN** activity requires input shape not produced by any previous activity
- **THEN** system shows warning "Missing required shape: <shape_name>" with suggestion to add impulse source

### Requirement: Grid supports horizontal scrolling for long trajectories

The system SHALL provide smooth horizontal scrolling when trajectory exceeds viewport width.

#### Scenario: Auto-scroll on add
- **WHEN** user adds activity that extends beyond viewport
- **THEN** system scrolls to show the newly added activity

#### Scenario: Keyboard navigation
- **WHEN** user presses arrow keys with activity selected
- **THEN** system scrolls and selects adjacent activity in the pressed direction

### Requirement: System persists trajectory state to localStorage

The system SHALL automatically save trajectory edits to browser localStorage and restore on page load.

#### Scenario: Auto-save on changes
- **WHEN** user adds, removes, or reorders activities
- **THEN** system saves trajectory state to localStorage within 1 second

#### Scenario: Restore on page load
- **WHEN** user refreshes page or navigates back to trajectory editor
- **THEN** system restores the exact trajectory state including activity positions

#### Scenario: Clear saved state on export
- **WHEN** user successfully exports trajectory as template
- **THEN** system clears localStorage to start fresh for next trajectory
