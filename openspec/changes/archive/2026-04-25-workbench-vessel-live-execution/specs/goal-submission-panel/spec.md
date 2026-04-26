## MODIFIED Requirements

### Requirement: Goal text input and submit button
The trajectory editor SHALL provide a "Run Goal" panel with a multi-line text input for the goal description and a "Run" button. On submit, the panel SHALL POST to the vessel's fully-qualified resolver URL stored in `selectedVesselEndpoint` with `{ pointer: { type: "goalExecution", goal: "<text>" } }`. The `selectedVesselEndpoint` value SHALL be a complete URL ready for use as the `fetch` first argument (e.g., `http://minibob:8080/v2/impulses/resolve`) — no path suffix is appended by `GoalSubmissionPanel`. The panel SHALL be disabled while a submission is in flight or a live execution is already connected.

#### Scenario: Submit goal triggers impulse resolution
- **WHEN** the user enters a goal and clicks Run
- **THEN** the workbench POSTs to `selectedVesselEndpoint` directly (no `/v2/impulses/resolve` appended) with `pointer.type=goalExecution`

#### Scenario: Panel disabled during active execution
- **WHEN** a live execution is already connected
- **THEN** the Run button is disabled with tooltip "Disconnect active execution first"

#### Scenario: Empty goal validation
- **WHEN** the user clicks Run with an empty goal field
- **THEN** the button remains disabled and a validation hint is shown

#### Scenario: POST URL uses full resolver contract URL
- **WHEN** MiniBob is registered with `endpoint="http://minibob:8080"` and `resolve_endpoint="/v2/impulses/resolve"`
- **THEN** `selectedVesselEndpoint` is `"http://minibob:8080/v2/impulses/resolve"` and `GoalSubmissionPanel` POSTs to that URL without appending any suffix

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
