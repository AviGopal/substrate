# per-task-impulse-resolution-timeline Specification

## Purpose
TBD - created by archiving change workbench-vessel-live-execution. Update Purpose after archive.
## Requirements
### Requirement: ImpulseResolutionEvent type and store field
The trajectoryStore SHALL define `ImpulseResolutionEvent = { shape: string; resolver: string; tier: string; latency_ms?: number; cost_usd?: number; timestamp: number }` and hold a runtime-only field `taskResolutions: Map<string, ImpulseResolutionEvent[]>` (not serialized to localStorage). A store action `addTaskResolution(taskId: string, event: ImpulseResolutionEvent)` SHALL append to the array for the given `taskId`, creating it if absent.

#### Scenario: Store accumulates resolution events per task
- **WHEN** `addTaskResolution("task_abc", { shape: "fileContent", resolver: "bash", tier: "deterministic", latency_ms: 12, timestamp: 1714000000000 })` is called twice with the same taskId
- **THEN** `taskResolutions.get("task_abc")` returns an array of length 2

#### Scenario: taskResolutions cleared on execution disconnect
- **WHEN** the active execution is disconnected or a new execution starts
- **THEN** `taskResolutions` is reset to an empty Map

### Requirement: useTrajectoryExecution populates taskResolutions from impulse.resolved events
The `impulse.resolved` WebSocket event handler in `useTrajectoryExecution` SHALL be updated to accept the fields `taskId`, `resolver`, `latency_ms`, and `cost_usd` as optional fields on `ImpulseResolvedEvent`. When `taskId` is present and non-empty, the handler SHALL call `addTaskResolution(taskId, { shape, resolver, tier, latency_ms, cost_usd, timestamp: Date.now() })`.

#### Scenario: impulse.resolved event with taskId populates per-task map
- **WHEN** a `{ type: "impulse.resolved", executionId, taskId: "task_1", shape: "fileContent", resolver: "bash", resolverTier: "deterministic", latency_ms: 8 }` WS event arrives
- **THEN** `taskResolutions.get("task_1")` contains one entry with `shape="fileContent"`, `resolver="bash"`, `tier="deterministic"`, `latency_ms=8`

#### Scenario: impulse.resolved event without taskId still updates discoveredShapes
- **WHEN** a `{ type: "impulse.resolved", impulseId, shape: "fileContent" }` event arrives with no `taskId` field
- **THEN** `discoveredShapes` gains "fileContent" and `taskResolutions` is unchanged

### Requirement: LiveExecutionPanel renders per-task resolution timeline
For each task row shown in `LiveExecutionPanel` while a live execution is active, the panel SHALL read `taskResolutions` from trajectoryStore and display a compact inline list of resolution events for that task. Each event row SHALL show: a shape badge (using `ResolverTierBadge` or equivalent), the resolver name in monospace, and the latency in milliseconds if present.

#### Scenario: Task with one impulse resolution shows one event row
- **WHEN** `taskResolutions.get("task_1")` has one entry `{ shape: "fileContent", resolver: "bash", tier: "deterministic", latency_ms: 12 }`
- **THEN** the task row in `LiveExecutionPanel` shows a "fileContent" badge, text "bash", and "12ms"

#### Scenario: Task with no resolutions shows no event rows
- **WHEN** `taskResolutions.get("task_2")` is undefined or empty
- **THEN** the task row in `LiveExecutionPanel` shows no resolution sub-rows (no empty list, no placeholder)

#### Scenario: Tier determines color coding
- **WHEN** `tier = "deterministic"` the badge color SHALL be green; `tier = "pattern"` yellow; `tier = "llm"` blue, matching `ResolverTierBadge` conventions

#### Scenario: latency_ms absent omits timing display
- **WHEN** `latency_ms` is undefined on the event
- **THEN** no latency text is shown in the row (shape + resolver name only)

