## ADDED Requirements

### Requirement: discoveredShapes field in trajectory store
`TrajectoryState` SHALL include `discoveredShapes: Set<string>` initialized to `new Set()`. `TrajectoryActions` SHALL include `addDiscoveredShape(shape: string): void` which adds the shape to `discoveredShapes` if not already present (idempotent). `clearTrajectory()` SHALL reset `discoveredShapes` to an empty set. `discoveredShapes` SHALL NOT be persisted to `localStorage`.

#### Scenario: addDiscoveredShape adds a new shape
- **WHEN** `addDiscoveredShape("typescript_ast")` is called and "typescript_ast" is not in the set
- **THEN** `discoveredShapes` contains "typescript_ast"

#### Scenario: addDiscoveredShape is idempotent
- **WHEN** `addDiscoveredShape("typescript_ast")` is called twice
- **THEN** `discoveredShapes` contains "typescript_ast" exactly once

#### Scenario: clearTrajectory resets discoveredShapes
- **WHEN** `clearTrajectory()` is called after shapes have been discovered
- **THEN** `discoveredShapes` is an empty set

#### Scenario: discoveredShapes not persisted to localStorage
- **WHEN** the trajectory is saved to localStorage after shapes are discovered
- **THEN** reloading from localStorage results in an empty `discoveredShapes`

### Requirement: useTrajectoryExecution extracts shape from impulse.resolved events
In `useTrajectoryExecution`, the `impulse.resolved` handler SHALL check for a `shape` field in the event payload (`data.shape`). If `data.shape` is a non-empty string and not already in `discoveredShapes`, it SHALL call `addDiscoveredShape(data.shape)`. If `data.shape` is absent or empty, the handler SHALL silently skip the shape extraction (no error thrown).

#### Scenario: impulse.resolved with shape updates discoveredShapes
- **WHEN** a `{ type: "impulse.resolved", impulseId: "i1", shape: "git_diff" }` WS event arrives
- **THEN** `discoveredShapes` in the store contains "git_diff"

#### Scenario: impulse.resolved without shape field is handled gracefully
- **WHEN** a `{ type: "impulse.resolved", impulseId: "i2" }` WS event arrives (no shape field)
- **THEN** `discoveredShapes` is unchanged; no error is thrown

### Requirement: useTrajectoryExecution fires impulse-relevance POST for new discovered shapes
When a new shape is extracted from an `impulse.resolved` event (shape not previously in `discoveredShapes`), `useTrajectoryExecution` SHALL fire a fire-and-forget `POST /v2/activities/impulse-relevance` with body `{ shape, source: "impulse.resolved", executionId }`. Errors from this POST SHALL be caught and logged to `console.warn`; they SHALL NOT propagate to the WS message handler or affect the UI.

#### Scenario: New discovered shape triggers impulse-relevance POST
- **WHEN** shape "git_diff" is discovered for the first time during an execution
- **THEN** POST /v2/activities/impulse-relevance is called with { shape: "git_diff", source: "impulse.resolved", executionId }

#### Scenario: Duplicate discovered shape does not trigger a second POST
- **WHEN** shape "git_diff" appears in a second impulse.resolved event during the same execution
- **THEN** POST /v2/activities/impulse-relevance is NOT called again for "git_diff"

#### Scenario: impulse-relevance POST failure does not crash the hook
- **WHEN** POST /v2/activities/impulse-relevance returns a network error
- **THEN** a console.warn is emitted; the WS stream continues processing; `discoveredShapes` still contains the shape

### Requirement: ImpulseStatePanel renders discovered shapes with dashed-border badge
`ImpulseStatePanel` SHALL read `discoveredShapes` from the trajectory store. In the "Realized" tab (shown during live execution), discovered shapes SHALL be rendered as a section titled "Discovered Shapes" with each shape as a `Badge` with `border-dashed` styling (distinct from the solid-border realized impulse IDs). The discovered shapes section SHALL only appear when `discoveredShapes.size > 0`. In the collapsed / non-executing state, discovered shapes are not shown.

#### Scenario: Discovered shapes appear in Realized tab with dashed border
- **WHEN** `discoveredShapes` contains "git_diff" and a live execution is connected
- **THEN** the Realized tab shows a "Discovered Shapes" section with a dashed-border badge labeled "git_diff"

#### Scenario: No discovered shapes section when set is empty
- **WHEN** `discoveredShapes` is empty
- **THEN** no "Discovered Shapes" section is rendered in the Realized tab
