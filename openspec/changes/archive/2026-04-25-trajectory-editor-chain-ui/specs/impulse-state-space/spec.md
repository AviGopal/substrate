## ADDED Requirements

### Requirement: Display accumulated impulse shapes
The system SHALL display all accumulated impulse shapes available at each trajectory column, showing provenance (which activity produced each shape).

#### Scenario: Initial state shows goal and user context
- **WHEN** user creates new trajectory with goal text
- **THEN** impulse state panel displays initial shapes: `goal`, `directoryTree`

#### Scenario: State accumulates after adding activity
- **WHEN** user adds activity with `output_shapes: ["sourceCode", "errorLog"]`
- **THEN** impulse state panel adds these shapes to accumulated state
- **AND** shows provenance link to producing activity

### Requirement: Show shape flow between activities
The system SHALL visualize which shapes flow from one activity's outputs to another activity's inputs using connection lines or arrows.

#### Scenario: Shape connection displayed
- **WHEN** Activity A produces `sourceCode` and Activity B consumes `sourceCode`
- **THEN** visual connection shown between A's output badge and B's input badge

#### Scenario: Missing shape highlighted
- **WHEN** Activity B requires `testResults` but no prior activity produces it
- **THEN** required shape badge shown in red/error state
- **AND** tooltip indicates "No producer found"

### Requirement: Track state timeline
The system SHALL maintain a timeline showing accumulated shapes after each activity in the chain.

#### Scenario: Timeline shows incremental growth
- **WHEN** trajectory has 3 activities producing different shapes
- **THEN** timeline shows: Step 0 ({goal, dir}), Step 1 (+sourceCode), Step 2 (+testResults), Step 3 (+gitCommit)

#### Scenario: User can inspect historical state
- **WHEN** user clicks on timeline step
- **THEN** system highlights which shapes existed at that point
- **AND** dims shapes not yet available
