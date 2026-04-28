# task-shape-contributions Specification

## Purpose
Define how per-task input and output shape contributions are surfaced in the workbench. Governs the `ActivityTask` type extension, `ImpulseStatePanel` provenance/timeline granularity, and `TaskEditor` read-only shape badge display — making task-level resolver I/O visible in both live and recalled execution modes.
## Requirements
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

### Requirement: Consumed shapes tracked per task
The system SHALL track input shapes consumed by each task (from `tasks[].input_impulse_ids` in the trace). The ImpulseStatePanel SHALL visually distinguish consumed vs. produced shapes in the provenance tree.

#### Scenario: Consumed shapes shown in provenance
- **WHEN** a trace task has input_impulse_ids that map to known shapes
- **THEN** those shapes appear under the task as "consumed" (distinct visual from produced)

### Requirement: ActivityTask type includes per-task input_shapes and output_shapes
The `ActivityTask` interface in `src/types/index.ts` SHALL include `input_shapes?: string[]` and `output_shapes?: string[]` fields. These fields are optional to maintain backward compatibility with existing trace and template data.

#### Scenario: ActivityTask with shape arrays is valid
- **WHEN** an ActivityTask object includes `input_shapes: ["file_content"]` and `output_shapes: ["test_result"]`
- **THEN** TypeScript compilation succeeds without type errors

#### Scenario: ActivityTask without shape arrays is valid
- **WHEN** an ActivityTask object has no `input_shapes` or `output_shapes` fields
- **THEN** TypeScript compilation succeeds without type errors

### Requirement: TaskEditor detail panel displays declared per-task shapes as read-only
When a task has non-empty `input_shapes` or `output_shapes`, the `TaskEditor` detail panel SHALL display them as read-only badge rows. Input shapes SHALL appear between the prompt section header and the prompt editor. Output shapes SHALL appear between the prompt editor and the validation section header.

#### Scenario: Input shapes displayed when present
- **WHEN** a task has `input_shapes: ["file_content", "git_diff"]` and the detail panel is expanded
- **THEN** a read-only row labeled "in:" shows `file_content` and `git_diff` as compact monospace badges

#### Scenario: Output shapes displayed when present
- **WHEN** a task has `output_shapes: ["test_result"]` and the detail panel is expanded
- **THEN** a read-only row labeled "out:" shows `test_result` as a compact monospace badge

#### Scenario: Shape rows hidden when shapes are absent
- **WHEN** a task has no `input_shapes` and no `output_shapes`
- **THEN** no shape rows are rendered in the TaskEditor detail panel

#### Scenario: Shape display does not interfere with existing prompt/validation editing
- **WHEN** shapes are shown in the detail panel
- **THEN** the prompt editor, validation rules editor, and retry config remain fully interactive

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

