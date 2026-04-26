## ADDED Requirements

### Requirement: Trajectory store holds selected vessel state
`TrajectoryState` SHALL include `selectedVesselId: string | null` and `selectedVesselEndpoint: string | null`, both defaulting to `null`. `TrajectoryState` SHALL also include `vesselScores: Record<string, { alpha: number; beta: number }>`, defaulting to `{}`.

#### Scenario: Initial store state
- **WHEN** the store is initialized with no localStorage data
- **THEN** `selectedVesselId` is `null`, `selectedVesselEndpoint` is `null`, and `vesselScores` is `{}`

### Requirement: selectVessel action updates selected vessel state
The `selectVessel(id: string, endpoint: string)` action SHALL set `selectedVesselId` to `id` and `selectedVesselEndpoint` to `endpoint`, then call `saveToLocalStorage()`.

#### Scenario: Calling selectVessel
- **WHEN** `selectVessel("minibob-abc123", "https://minibob-1.example.com")` is called
- **THEN** `selectedVesselId` is "minibob-abc123" and `selectedVesselEndpoint` is "https://minibob-1.example.com"

### Requirement: recordVesselOutcome action updates Thompson scores
The `recordVesselOutcome(id: string, success: boolean)` action SHALL increment `vesselScores[id].alpha` by 1 on success, or increment `vesselScores[id].beta` by 1 on failure. If no entry exists for `id`, it SHALL initialize `{ alpha: 1, beta: 0 }` on success or `{ alpha: 0, beta: 1 }` on failure.

#### Scenario: First success for a new vessel
- **WHEN** `recordVesselOutcome("minibob-abc123", true)` is called and no prior score exists
- **THEN** `vesselScores["minibob-abc123"]` equals `{ alpha: 1, beta: 0 }`

#### Scenario: Subsequent failure on a vessel with existing score
- **WHEN** `vesselScores["minibob-abc123"]` is `{ alpha: 3, beta: 1 }` and `recordVesselOutcome("minibob-abc123", false)` is called
- **THEN** `vesselScores["minibob-abc123"]` equals `{ alpha: 3, beta: 2 }`

### Requirement: Vessel state is persisted in localStorage v2 format
`saveToLocalStorage()` SHALL include `selectedVesselId`, `selectedVesselEndpoint`, and `vesselScores` in the serialized v2 object. `loadFromLocalStorage()` SHALL restore these fields from the saved object.

#### Scenario: Save and restore vessel selection
- **WHEN** `selectVessel` is called and then `loadFromLocalStorage` is called on a fresh store instance
- **THEN** `selectedVesselId` and `selectedVesselEndpoint` match the previously selected values

#### Scenario: Legacy v1 data with no vessel fields
- **WHEN** v1 localStorage data (no vessel fields) is loaded
- **THEN** `selectedVesselId` and `selectedVesselEndpoint` default to `null` and `vesselScores` defaults to `{}`

### Requirement: GoalSubmissionPanel routes to selected vessel endpoint
When `selectedVesselEndpoint` is non-null, `GoalSubmissionPanel` SHALL POST to `${selectedVesselEndpoint}/v2/impulses/resolve` instead of the hardcoded relative path `/v2/impulses/resolve`.

#### Scenario: Vessel is selected and goal is submitted
- **WHEN** `selectedVesselEndpoint` is "http://minibob-1.example.com" and the user submits a goal
- **THEN** the POST is sent to "http://minibob-1.example.com/v2/impulses/resolve"

### Requirement: GoalSubmissionPanel falls back to current URL with warning toast when no vessel is selected
When `selectedVesselEndpoint` is `null`, `GoalSubmissionPanel` SHALL POST to the existing relative path `/v2/impulses/resolve` (current behavior) AND show a shadcn toast with message "No vessel selected — routing to default endpoint".

#### Scenario: No vessel selected and goal is submitted
- **WHEN** `selectedVesselEndpoint` is `null` and the user submits a goal
- **THEN** the POST is sent to `/v2/impulses/resolve` via the existing api-client path
- **THEN** a toast notification appears with "No vessel selected — routing to default endpoint"

### Requirement: GoalSubmissionPanel classifies vessel-offline errors
When the POST to the selected vessel's endpoint results in a network error (fetch rejected or connection refused), `classifyError` SHALL return `{ kind: "vessel-offline" }`. The error message displayed SHALL be "Executor vessel offline — select a different vessel or restart MiniBob".

#### Scenario: Selected vessel is unreachable
- **WHEN** `selectedVesselEndpoint` is set and the POST throws a network error
- **THEN** the error panel shows "Executor vessel offline — select a different vessel or restart MiniBob"

### Requirement: recordVesselOutcome is called after each execution attempt
After each goal submission attempt (success or failure), `GoalSubmissionPanel` SHALL call `useTrajectoryStore().recordVesselOutcome(selectedVesselId, success)` when a vessel is selected.

#### Scenario: Successful execution updates alpha
- **WHEN** a goal submission succeeds with a vessel selected
- **THEN** `recordVesselOutcome(selectedVesselId, true)` is called

#### Scenario: Failed execution updates beta
- **WHEN** a goal submission fails with a vessel selected
- **THEN** `recordVesselOutcome(selectedVesselId, false)` is called
