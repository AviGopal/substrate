## MODIFIED Requirements

### Requirement: ImpulseStatePanel shows per-task shape contributions from trace
When a trace is loaded or a live execution is active, the ImpulseStatePanel's Shape Provenance section SHALL show task-level contributions: which specific task (by index and description) produced each shape. This replaces the template-level provenance ("Activity X → shapes") with task-level resolution ("Activity X / Task N → shapes").

#### Scenario: Provenance updated from historical trace
- **WHEN** a trace is loaded onto the trajectory grid
- **THEN** Shape Provenance entries show "Task N: <description>" as sub-items under each activity

#### Scenario: Provenance accumulated live during execution
- **WHEN** a live execution is running and a task.completed WS event arrives with output_impulse_ids
- **THEN** the corresponding shapes are immediately added to the provenance tree under that task

#### Scenario: Fallback to template output_shapes when trace lacks task data
- **WHEN** a trace task has no output_impulse_ids or the shapes cannot be resolved
- **THEN** the panel falls back to the template's output_shapes and marks provenance as "estimated"

### Requirement: Shape Timeline reflects task-level granularity
The Shape Timeline section of ImpulseStatePanel SHALL show individual task completions as timeline events (not just column-level events) when trace or live data is present. Each event SHALL include task index, description, shapes added, and resolver tier.

#### Scenario: Timeline shows task events from trace
- **WHEN** a trace is loaded with 3 tasks across 2 activities
- **THEN** the timeline shows 3 events (one per task) with shapes added at each step

#### Scenario: Timeline updates incrementally during live execution
- **WHEN** tasks complete one-by-one during live execution
- **THEN** each task.completed event appends a new timeline entry with elapsed time

## ADDED Requirements

### Requirement: ImpulseStatePanel Realized tab shows per-task breakdown alongside flat list
In the Realized tab of ImpulseStatePanel, when `taskResolutions` is non-empty, the panel SHALL render a "Per-task resolutions" section below the flat "Discovered Shapes" badges. This section groups `ImpulseResolutionEvent` entries by `taskId` and shows them as collapsible task rows, each containing the shape/resolver/tier/latency sub-rows.

#### Scenario: Realized tab shows per-task section when resolutions exist
- **WHEN** `taskResolutions` has entries for two tasks
- **THEN** the Realized tab shows a "Per-task resolutions" collapsible section with two task headers

#### Scenario: Per-task section absent when taskResolutions empty
- **WHEN** `taskResolutions` is empty (no `impulse.resolved` events have arrived)
- **THEN** the Realized tab shows only the flat impulse ID list and discovered shapes, no per-task section

#### Scenario: Existing flat discoveredShapes view unaffected
- **WHEN** `discoveredShapes` is non-empty and `taskResolutions` is empty
- **THEN** the Realized tab continues to display discovered shapes as dashed badges, no regression
