## MODIFIED Requirements

### Requirement: LiveExecutionPanel renders per-task resolution timeline
The `TaskEditor` component SHALL accept an optional `resolutionEvents?: ImpulseResolutionEvent[]` prop and render a compact inline sub-list below the task row when the prop is non-empty. Each event row SHALL show: a color-coded tier dot (green = deterministic, yellow = pattern, blue = llm), the `shape` name in monospace, the `resolver` name in monospace, and `latency_ms` in milliseconds if present. `ActivityCard` SHALL subscribe to `taskResolutions` from `trajectoryStore` and pass `resolutionEvents={taskResolutions.get(task.id) ?? []}` to each `TaskEditor`. This replaces the previous requirement that rendered the timeline inside `LiveExecutionPanel`.

#### Scenario: Task with one impulse resolution shows one event row
- **WHEN** `taskResolutions.get("task_1")` has one entry `{ shape: "fileContent", resolver: "bash", tier: "deterministic", latency_ms: 12 }`
- **THEN** the `TaskEditor` for task_1 renders one sub-row with a green dot, "fileContent", "bash", and "12ms"

#### Scenario: Task with no resolutions shows no event rows
- **WHEN** `taskResolutions.get("task_2")` is undefined or empty
- **THEN** the `TaskEditor` for task_2 shows no resolution sub-rows (no empty list, no placeholder)

#### Scenario: Tier determines color coding
- **WHEN** `tier = "deterministic"` the dot is green; `tier = "pattern"` the dot is yellow; `tier = "llm"` the dot is blue

#### Scenario: latency_ms absent omits timing display
- **WHEN** `latency_ms` is undefined on the event
- **THEN** no latency text is shown in the row (shape + resolver name only)
