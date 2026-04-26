## ADDED Requirements

### Requirement: Active task row highlighted with pulsing run marker during live execution
When a live execution is active, the task row in `TaskEditor` corresponding to the currently executing task SHALL display a pulsing left-border indicator (a vertical bar with `animate-pulse` styling). The indicator SHALL be shown only on the task whose ID matches `activeTaskId`.

#### Scenario: Run marker appears on active task row
- **WHEN** a live execution is running and `activeTaskId` is "task-abc"
- **THEN** the task row for "task-abc" in the expanded ActivityCard shows a pulsing left border marker

#### Scenario: Run marker absent when no execution active
- **WHEN** no execution is active (`activeTaskId` is null)
- **THEN** no pulsing run marker appears on any task row

#### Scenario: Run marker moves to next task
- **WHEN** `activeTaskId` changes from "task-abc" to "task-def" as execution progresses
- **THEN** the marker disappears from "task-abc" and appears on "task-def"

#### Scenario: Run marker absent on tasks of inactive activities
- **WHEN** the active task belongs to activity A and activity B is also in the trajectory
- **THEN** only activity A's expanded card shows the run marker; activity B shows none

### Requirement: Active activity card visually distinguished during execution
The `ActivityCard` for the activity currently being executed SHALL receive an `isActiveActivity` prop that applies a highlighted ring or border (distinct from the standard selection border) to indicate the card is live.

#### Scenario: Active activity card highlighted
- **WHEN** `activeActivityId` matches a card's `templateId` and live execution is active
- **THEN** that ActivityCard shows a visual highlight ring around the card border

#### Scenario: Non-active cards unaffected
- **WHEN** a live execution is active but `activeActivityId` does not match a card's templateId
- **THEN** that card shows no execution ring (retains its normal or selected-state styling)

### Requirement: activeTaskId forwarded from TrajectoryEditorPage to ActivityCard
`TrajectoryEditorPage` SHALL read `activeTaskId` from the `useTrajectoryExecution` hook result and pass it as an optional prop to each `ActivityCard`. The prop SHALL be non-null only for the card whose `templateId` matches `activeActivityId`.

#### Scenario: Prop forwarding to correct card
- **WHEN** `activeActivityId` is "template-X" and `activeTaskId` is "task-Y"
- **THEN** the ActivityCard for "template-X" receives `activeTaskId="task-Y"`
- **THEN** all other ActivityCards receive `activeTaskId={null}`
