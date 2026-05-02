## ADDED Requirements

### Requirement: System displays before/after file diffs

The system SHALL show side-by-side diff view for all files modified during execution, highlighting additions, deletions, and changes.

#### Scenario: Showing file modifications
- **WHEN** execution modifies `src/auth.ts`
- **THEN** system displays left pane with original content and right pane with modified content

#### Scenario: Syntax highlighting diffs
- **WHEN** user views diff for a `.ts` file
- **THEN** system applies TypeScript syntax highlighting to both panes

#### Scenario: Line-by-line diff markers
- **WHEN** diff displays
- **THEN** system highlights added lines in green, removed lines in red, and unchanged lines in default color

### Requirement: User can navigate between changed files

The system SHALL provide a file tree or list showing all modified files with quick navigation.

#### Scenario: Listing modified files
- **WHEN** execution modifies 5 files
- **THEN** system displays a list of 5 file paths with badges showing line change counts

#### Scenario: Jumping to file diff
- **WHEN** user clicks a file path in the list
- **THEN** system scrolls to that file's diff view

### Requirement: Diff viewer shows state transitions per task

The system SHALL group file changes by the task that caused them, showing incremental state evolution.

#### Scenario: Grouping by task
- **WHEN** Task 1 modifies `src/auth.ts` and Task 3 modifies the same file
- **THEN** system shows two separate diff sections labeled "Task 1" and "Task 3"

#### Scenario: Cumulative diff mode
- **WHEN** user enables "Show final diff only"
- **THEN** system displays single diff showing net changes from start to end, hiding intermediate states

### Requirement: User can collapse unchanged sections

The system SHALL automatically collapse large blocks of unchanged lines to focus attention on actual changes.

#### Scenario: Collapsing unchanged code
- **WHEN** diff contains 100 unchanged lines between two changed lines
- **THEN** system collapses the unchanged section showing "... 100 unchanged lines ..." with expand button

#### Scenario: Expanding context
- **WHEN** user clicks the expand button
- **THEN** system reveals the full unchanged section

### Requirement: Diff viewer supports multiple view modes

The system SHALL offer split view (side-by-side) and unified view (interleaved) modes for user preference.

#### Scenario: Split view
- **WHEN** user selects "Split" mode
- **THEN** system displays before and after in two vertical panes

#### Scenario: Unified view
- **WHEN** user selects "Unified" mode
- **THEN** system displays changes interleaved in a single pane with +/- line prefixes
