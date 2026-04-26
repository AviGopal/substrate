# goal-submission-panel Specification

## Purpose
TBD - created by archiving change trajectory-execution-integration. Update Purpose after archive.
## Requirements
### Requirement: Goal text input and submit button
The trajectory editor SHALL provide a "Run Goal" panel with a multi-line text input for the goal description and a "Run" button. On submit, the panel SHALL POST to activity-api `POST /v2/impulses/resolve` with `{ pointer: { type: "goalExecution", goal: "<text>" } }`. The panel SHALL be disabled while a submission is in flight or a live execution is already connected. The panel SHALL also render a "Run Trajectory" button (see Requirement: Run Trajectory button in GoalSubmissionPanel).

#### Scenario: Submit goal triggers impulse resolution
- **WHEN** the user enters a goal and clicks Run
- **THEN** the workbench POSTs to activity-api /v2/impulses/resolve with pointer.type=goalExecution

#### Scenario: Panel disabled during active execution
- **WHEN** a live execution is already connected
- **THEN** both the Run and Run Trajectory buttons are disabled with tooltip "Disconnect active execution first"

#### Scenario: Empty goal validation
- **WHEN** the user clicks Run with an empty goal field
- **THEN** the Run button remains disabled and a validation hint is shown (Run Trajectory is not affected by empty goal)

### Requirement: Auto-connect to execution on resolution
When the impulse resolution succeeds and returns an executionId, the system SHALL immediately wire that executionId into the live execution panel (equivalent to the user manually connecting). The trajectory grid SHALL begin animating and accumulating shapes as tasks complete.

#### Scenario: Successful resolution auto-connects
- **WHEN** activity-api returns `{ executionId: "exec_xxx" }` from goalExecution resolution
- **THEN** the live execution panel auto-connects to exec_xxx without user interaction

#### Scenario: Resolution routed through discovery to MiniBob
- **WHEN** no local resolver handles goalExecution
- **THEN** activity-api queries discovery-vessel, finds MiniBob (advertising goalExecution shape), and forwards the pointer via MiniBob's resolve contract

### Requirement: Submission error handling
If the impulse resolution fails (network error, MiniBob unavailable, discovery finds no vessel), the panel SHALL show an error message and allow retry. The trajectory grid SHALL not be modified on failure.

#### Scenario: MiniBob not registered in discovery
- **WHEN** discovery-vessel has no vessel advertising goalExecution shape
- **THEN** the panel shows "No execution vessel available — is MiniBob running?" with a retry button

#### Scenario: Submission timeout
- **WHEN** the resolve request exceeds 30s without a response
- **THEN** the panel shows "Execution timed out" and re-enables the Run button

### Requirement: Run Trajectory button in GoalSubmissionPanel
`GoalSubmissionPanel` SHALL render a second button labeled "Run Trajectory" (icon: `ListOrdered` from lucide-react) alongside the existing "Run" (goal) button. The "Run Trajectory" button SHALL be enabled only when the trajectory store has at least one activity (`activities.length > 0`) AND no live execution is currently connected (`!isLiveConnected`) AND no submission is in flight (`!isSubmitting`). When clicked, it SHALL call `submitTrajectory(activities, goalText.trim() || undefined)` from `useTrajectoryExecution`, then call `onExecutionStarted(executionId)` on success. On failure it SHALL display the same error classification and retry UI as the existing goal submission error path.

#### Scenario: Run Trajectory enabled when grid has activities
- **WHEN** the trajectory grid contains at least one activity and no execution is live
- **THEN** the "Run Trajectory" button is enabled

#### Scenario: Run Trajectory disabled when grid is empty
- **WHEN** the trajectory grid has no activities
- **THEN** the "Run Trajectory" button is disabled with tooltip "Add activities to the grid first"

#### Scenario: Run Trajectory disabled during active execution
- **WHEN** a live execution is connected
- **THEN** both "Run" and "Run Trajectory" buttons are disabled

#### Scenario: Run Trajectory submits trajectoryExecution pointer with grid contents
- **WHEN** the user clicks "Run Trajectory" with three activities in the grid
- **THEN** POST /v2/impulses/resolve is called with `{ pointer: { type: "trajectoryExecution", activities: [...] } }`

#### Scenario: Run Trajectory with goal text includes goal in payload
- **WHEN** the user has entered goal text "deploy to canary" and clicks "Run Trajectory"
- **THEN** the payload includes `goal: "deploy to canary"`

#### Scenario: Run Trajectory error shown with retry button
- **WHEN** `submitTrajectory` throws
- **THEN** the same error message + retry button UI used for goal submission errors is shown

