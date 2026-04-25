## ADDED Requirements

### Requirement: Show prerequisite dependency tree
The system SHALL display dependency tree showing which activities produce required shapes.

#### Scenario: Tree shows prerequisite chain
- **WHEN** Activity "git-commit" requires ["gitDiff", "sourceCode"]
- **AND** "modify-file" produces "gitDiff"
- **AND** "read-file" produces "sourceCode"
- **THEN** dependency tree shows read-file → modify-file → git-commit

### Requirement: Query backend for prerequisite resolution
The system SHALL call `POST /v2/activities/discover-by-shapes` with backward mode to find producers.

#### Scenario: Backend query for shape producers
- **WHEN** user needs shape "testResults"
- **THEN** system queries backend with `desired_shapes: ["testResults"], mode: "backward"`
- **AND** displays ranked activities that produce this shape

### Requirement: Suggest adding prerequisites
The system SHALL suggest adding prerequisite activities when required shapes are missing.

#### Scenario: Prerequisite suggestion shown
- **WHEN** activity requires missing shape
- **THEN** suggestion panel shows "Add prerequisite: activity-x produces this shape"
