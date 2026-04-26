## ADDED Requirements

### Requirement: MiniBob accepts trajectoryExecution pointer type
MiniBob's `POST /v2/impulses/resolve` handler SHALL accept `pointer.type === "trajectoryExecution"` with payload `{ pointer: { type: "trajectoryExecution", activities: Array<{ templateId: string, column: number, row: number }>, goal?: string } }`. It SHALL return `{ success: true, content: "executionId: <id>\nwsUrl: <url>" }` immediately (fire-and-forget execution) using the same response format as `goalExecution`. Unknown pointer types SHALL still return HTTP 400 with `{ success: false, error: "unsupported pointer type: <type>" }`.

#### Scenario: trajectoryExecution pointer accepted and returns executionId
- **WHEN** POST /v2/impulses/resolve is called with `{ pointer: { type: "trajectoryExecution", activities: [{ templateId: "t1", column: 0, row: 0 }] } }`
- **THEN** MiniBob returns HTTP 200 with `{ success: true, content: "executionId: <id>\nwsUrl: ..." }` within 500ms

#### Scenario: Empty activities array still accepted
- **WHEN** POST /v2/impulses/resolve is called with `{ pointer: { type: "trajectoryExecution", activities: [] } }`
- **THEN** MiniBob returns `{ success: true, content: "executionId: <id>\nwsUrl: ..." }` and the execution completes immediately with no tasks

#### Scenario: Optional goal field is accepted but not required
- **WHEN** `trajectoryExecution` payload includes `goal: "deploy to canary"`
- **THEN** the goal string is stored in the execution trace metadata; resolution still succeeds without it

#### Scenario: Other pointer types still rejected as before
- **WHEN** POST /v2/impulses/resolve is called with `pointer.type === "unknownType"`
- **THEN** MiniBob returns HTTP 400 with `{ success: false, error: "unsupported pointer type: unknownType" }`

### Requirement: Activities executed in column order with within-column parallelism
MiniBob SHALL group the provided activities array by `column` value (ascending sort). For each column group, it SHALL execute all activities in that group concurrently (via `Promise.all`). It SHALL not start the next column group until all activities in the current column group complete or fail. Activity execution SHALL use the existing `ActivityExecutor` / `executeActivity` path (same as `goalExecution` task execution), fetching the template from activity-api by `templateId`.

#### Scenario: Sequential columns run in order
- **WHEN** activities = [{ templateId: "A", column: 0, row: 0 }, { templateId: "B", column: 1, row: 0 }]
- **THEN** template A executes and completes before template B begins

#### Scenario: Same-column activities run in parallel
- **WHEN** activities = [{ templateId: "A", column: 0, row: 0 }, { templateId: "B", column: 0, row: 1 }]
- **THEN** both A and B are started concurrently; execution completes when both finish

#### Scenario: Activity with missing templateId is skipped with error logged
- **WHEN** an activity references a templateId that cannot be fetched from activity-api
- **THEN** that activity's column slot is marked failed in the execution trace; other activities in subsequent columns still execute

### Requirement: MiniBob advertises trajectoryExecution shape in discovery registration
When discovery is enabled, MiniBob's registration payload SHALL include `"trajectoryExecution"` in the `shapes` array alongside the existing shapes. The `resolve_endpoint`, `resolve_request_format`, `auth_scheme`, and `resolve_timeout_ms` contract fields SHALL remain unchanged.

#### Scenario: Registration payload includes trajectoryExecution shape
- **WHEN** MiniBob registers with discovery-vessel on startup (discovery enabled)
- **THEN** the registration payload `shapes` array contains both `"goalExecution"` and `"trajectoryExecution"`

#### Scenario: Existing goalExecution shape unaffected
- **WHEN** MiniBob registers with discovery-vessel
- **THEN** `"goalExecution"` still appears in the shapes array alongside `"trajectoryExecution"`
