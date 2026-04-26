## ADDED Requirements

### Requirement: submitTrajectory method on useTrajectoryExecution hook
The `useTrajectoryExecution` hook SHALL expose a `submitTrajectory(activities: TrajectoryActivity[], goal?: string): Promise<string>` method on its return value. This method SHALL POST to the configured vessel endpoint `POST /v2/impulses/resolve` with `{ pointer: { type: "trajectoryExecution", activities: activities.map(a => ({ templateId: a.templateId, column: a.column, row: a.row })), goal } }`. On success it SHALL parse the returned `executionId` from the content string and return it. On failure it SHALL throw an `Error` with a descriptive message. The hook SHALL use the same `post()` API client helper and `parseExecutionId()` utility already used for goal submission.

#### Scenario: submitTrajectory returns executionId on success
- **WHEN** `submitTrajectory([{ templateId: "t1", column: 0, row: 0, ... }])` is called
- **THEN** it returns a non-empty executionId string

#### Scenario: submitTrajectory throws on network error
- **WHEN** the POST to /v2/impulses/resolve fails with a network error
- **THEN** `submitTrajectory` throws an Error; the caller is responsible for error display

#### Scenario: submitTrajectory maps TrajectoryActivity to slim payload
- **WHEN** a `TrajectoryActivity` has `{ id, templateId, template, column, row }`
- **THEN** only `{ templateId, column, row }` is sent in the request payload (no template object, no local id)
