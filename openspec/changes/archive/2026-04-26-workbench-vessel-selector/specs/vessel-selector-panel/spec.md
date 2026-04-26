## ADDED Requirements

### Requirement: Panel renders a row for each executor vessel
`VesselSelectorPanel` SHALL render one row per vessel returned by `useVesselRegistry`. Each row SHALL display: a health status dot (green = healthy, yellow = degraded, grey = unknown), the vessel name (truncated to 20 chars with ellipsis), the vesselId truncated to 8 chars, a last-seen timestamp formatted as relative time (e.g., "2 min ago"), the estimated Thompson selection strength expressed as a percentage (α / (α + β) × 100, rounded to 0 decimal places), and a "Connect" button.

#### Scenario: Multiple vessels in registry
- **WHEN** `useVesselRegistry` returns three vessels
- **THEN** the panel renders exactly three rows, each with name, truncated vesselId, health dot, last-seen, Thompson %, and Connect button

#### Scenario: Vessel health states render correct indicator color
- **WHEN** a vessel has health "healthy"
- **THEN** its health dot is rendered with a green indicator class
- **WHEN** a vessel has health "degraded"
- **THEN** its health dot is rendered with a yellow indicator class
- **WHEN** a vessel has health "unknown"
- **THEN** its health dot is rendered with a grey indicator class

### Requirement: Panel shows empty state when no executor vessels are online
When `useVesselRegistry` returns an empty array and is not loading, the panel SHALL display the message: "No executor vessels online — start MiniBob to connect".

#### Scenario: Empty registry
- **WHEN** `useVesselRegistry` returns `[]` and `isLoading` is `false`
- **THEN** the panel renders the "No executor vessels online" message and no vessel rows

### Requirement: Panel shows a skeleton loader during initial fetch
While `isLoading` is `true` (first fetch, no cached data), the panel SHALL render two skeleton rows using shadcn `Skeleton` component instead of real vessel rows.

#### Scenario: Loading state
- **WHEN** `isLoading` is `true`
- **THEN** two skeleton rows are rendered and no real vessel data is shown

### Requirement: Clicking "Connect" selects the vessel
When the user clicks the "Connect" button on a vessel row, the panel SHALL call `useTrajectoryStore().selectVessel(vesselId, endpoint)`. The clicked row SHALL be highlighted as selected. The "Connect" button on the selected row SHALL be replaced by a "Connected" badge.

#### Scenario: User connects to a vessel
- **WHEN** user clicks "Connect" on a vessel row
- **THEN** `selectVessel` is called with that vessel's id and endpoint
- **THEN** that row renders a "Connected" badge instead of the "Connect" button
- **THEN** no other row shows the "Connected" badge

#### Scenario: User switches to a different vessel
- **WHEN** a vessel is already selected and the user clicks "Connect" on a different row
- **THEN** `selectVessel` is called with the new vessel's id and endpoint
- **THEN** the previously selected row reverts to showing the "Connect" button
- **THEN** the newly selected row shows the "Connected" badge

### Requirement: Panel displays per-vessel Thompson α/β scores
The panel SHALL read `vesselScores` from the trajectory store. For each vessel, it SHALL compute estimated selection strength as `alpha / (alpha + beta) * 100`. When no score entry exists for a vessel, it SHALL display "—" instead of a percentage.

#### Scenario: Vessel with recorded outcomes
- **WHEN** `vesselScores` contains an entry for a vesselId with alpha=8 and beta=2
- **THEN** the panel displays "80%" for that vessel

#### Scenario: Vessel with no recorded outcomes
- **WHEN** `vesselScores` has no entry for a vesselId
- **THEN** the panel displays "—" for that vessel

### Requirement: Panel is placed at the top of the left sidebar in TrajectoryEditorPage, above GoalSubmissionPanel
`VesselSelectorPanel` SHALL be rendered inside the left sidebar `ScrollArea` of `TrajectoryEditorPage`, immediately above the `GoalSubmissionPanel` component.

#### Scenario: Sidebar render order
- **WHEN** `TrajectoryEditorPage` renders
- **THEN** `VesselSelectorPanel` appears above `GoalSubmissionPanel` in the DOM order of the left sidebar
