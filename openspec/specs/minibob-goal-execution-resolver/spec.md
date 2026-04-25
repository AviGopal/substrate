# minibob-goal-execution-resolver Specification

## Purpose
TBD - created by archiving change trajectory-execution-integration. Update Purpose after archive.
## Requirements
### Requirement: MiniBob exposes POST /v2/impulses/resolve endpoint
MiniBob's HTTP server SHALL expose `POST /v2/impulses/resolve` accepting `{ pointer: { type: string, ... } }`. For unknown pointer types, it SHALL return `{ success: false, error: "unsupported pointer type: <type>" }` with HTTP 400. All existing endpoints SHALL remain unchanged.

#### Scenario: Endpoint responds to supported pointer type
- **WHEN** POST /v2/impulses/resolve is called with pointer.type=goalExecution
- **THEN** MiniBob handles the request and returns { success: true, content: "..." }

#### Scenario: Endpoint rejects unsupported pointer type
- **WHEN** POST /v2/impulses/resolve is called with an unsupported pointer.type
- **THEN** MiniBob returns HTTP 400 with { success: false, error: "unsupported pointer type: <type>" }

### Requirement: goalExecution pointer type handled by processGoal
When MiniBob receives a `goalExecution` pointer, it SHALL extract `pointer.goal` (string), call the existing `processGoal()` function asynchronously, generate an `executionId`, and return immediately with `{ success: true, content: "executionId: <id>\nwsUrl: <url>" }`. The execution SHALL proceed in the background and emit events to activity-api.

#### Scenario: Goal execution starts and returns executionId immediately
- **WHEN** POST /v2/impulses/resolve is called with { pointer: { type: "goalExecution", goal: "fix auth bug" } }
- **THEN** MiniBob returns within 500ms with executionId and wsUrl, while the execution runs asynchronously

#### Scenario: Background execution failure does not affect resolve response
- **WHEN** processGoal() eventually fails during background execution
- **THEN** the failure is recorded as a trace in activity-api; the resolve response already returned success

### Requirement: MiniBob advertises goalExecution shape and resolve contract in discovery registration
MiniBob's discovery registration payload SHALL include `goalExecution` in the `shapes` array and SHALL include the resolve contract fields: `resolve_endpoint: "/v2/impulses/resolve"`, `resolve_request_format: "pointer"`, `auth_scheme: "ApiKey"`, `resolve_timeout_ms: 30000`.

#### Scenario: Discovery registration includes goalExecution shape
- **WHEN** MiniBob registers with discovery-vessel on startup (when discovery enabled)
- **THEN** the registration payload includes "goalExecution" in the shapes array

#### Scenario: Discovery registration includes resolve contract
- **WHEN** MiniBob registers with discovery-vessel
- **THEN** the payload includes resolve_endpoint, resolve_request_format, auth_scheme, and resolve_timeout_ms fields

#### Scenario: Existing shapes unaffected
- **WHEN** MiniBob registers with discovery-vessel
- **THEN** existing shapes (memo, file, directoryTree, gitDiff) remain in the shapes array alongside goalExecution

