## ADDED Requirements

### Requirement: Preview state changes on hover
The system SHALL predict and display state changes when user hovers over an activity card, without executing the activity.

#### Scenario: Hover shows predicted new shapes
- **WHEN** user hovers over activity with `output_shapes: ["testResults", "coverage"]`
- **AND** current state is `["sourceCode"]`
- **THEN** preview panel shows predicted state: `["sourceCode", "testResults", "coverage"]`
- **AND** highlights new shapes in green

#### Scenario: Preview shows unlocked activities
- **WHEN** predicted state would unlock 2 additional activities
- **THEN** preview panel lists those newly unlocked activities

### Requirement: Show goal progress prediction
The system SHALL calculate and display predicted goal completion percentage if the activity is added.

#### Scenario: Goal progress increases
- **WHEN** goal expects `["gitCommit", "testResults"]`
- **AND** activity produces `["testResults"]`
- **THEN** preview shows "Goal Progress: 50% → 100% (adds testResults)"

### Requirement: Display cost and duration estimates
The system SHALL show estimated cost and duration for the predicted activity execution.

#### Scenario: Estimates from historical data
- **WHEN** activity has 15 historical executions
- **THEN** preview shows "Estimated: ~3m 45s, ~$0.15"
- **AND** shows confidence based on sample size
