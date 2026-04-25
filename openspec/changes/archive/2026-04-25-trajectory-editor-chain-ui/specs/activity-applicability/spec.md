## ADDED Requirements

### Requirement: Filter activities by current state
The system SHALL dynamically filter activity templates based on whether current impulse state satisfies their `input_shapes` requirements.

#### Scenario: Applicable activity shown
- **WHEN** current state contains `["errorLog", "sourceCode"]`
- **AND** activity requires `input_shapes: ["errorLog", "sourceCode"]`
- **THEN** activity shown in "Now Applicable" section

#### Scenario: Blocked activity shown separately
- **WHEN** current state contains `["errorLog"]`
- **AND** activity requires `["errorLog", "sourceCode"]`
- **THEN** activity shown in "Not Yet Applicable" section
- **AND** missing shape `sourceCode` indicated

### Requirement: Highlight newly unlocked activities
The system SHALL highlight activities that became applicable after the last activity was added.

#### Scenario: New unlock after activity addition
- **WHEN** user adds activity producing `testResults`
- **AND** activity "run-coverage" requires `testResults`
- **THEN** "run-coverage" appears in "Newly Unlocked" section with sparkle/star icon

### Requirement: Show Thompson Sampling ranks
The system SHALL rank applicable activities by Thompson Sampling scores and display confidence.

#### Scenario: Activities ranked by success rate
- **WHEN** multiple activities are applicable
- **THEN** activities sorted by Thompson score (highest first)
- **AND** each shows success rate percentage and confidence interval
