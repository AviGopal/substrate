## MODIFIED Requirements

### Requirement: MiniBob exposes POST /v2/impulses/resolve endpoint
MiniBob's HTTP server SHALL expose `POST /v2/impulses/resolve` accepting `{ pointer: { type: string, ... } }`. For unknown pointer types, it SHALL return `{ success: false, error: "unsupported pointer type: <type>" }` with HTTP 400. All existing endpoints SHALL remain unchanged. The handler SHALL support both `goalExecution` and `trajectoryExecution` pointer types.

#### Scenario: Endpoint responds to goalExecution pointer type
- **WHEN** POST /v2/impulses/resolve is called with pointer.type=goalExecution
- **THEN** MiniBob handles the request and returns { success: true, content: "..." }

#### Scenario: Endpoint responds to trajectoryExecution pointer type
- **WHEN** POST /v2/impulses/resolve is called with pointer.type=trajectoryExecution
- **THEN** MiniBob handles the request and returns { success: true, content: "executionId: <id>\nwsUrl: ..." }

#### Scenario: Endpoint rejects unsupported pointer type
- **WHEN** POST /v2/impulses/resolve is called with an unsupported pointer.type
- **THEN** MiniBob returns HTTP 400 with { success: false, error: "unsupported pointer type: <type>" }

### Requirement: MiniBob advertises goalExecution shape and resolve contract in discovery registration
MiniBob's discovery registration payload SHALL include `goalExecution` and `trajectoryExecution` in the `shapes` array and SHALL include the resolve contract fields: `resolve_endpoint: "/v2/impulses/resolve"`, `resolve_request_format: "pointer"`, `auth_scheme: "ApiKey"`, `resolve_timeout_ms: 30000`.

#### Scenario: Discovery registration includes goalExecution shape
- **WHEN** MiniBob registers with discovery-vessel on startup (when discovery enabled)
- **THEN** the registration payload includes "goalExecution" in the shapes array

#### Scenario: Discovery registration includes trajectoryExecution shape
- **WHEN** MiniBob registers with discovery-vessel on startup (when discovery enabled)
- **THEN** the registration payload includes "trajectoryExecution" in the shapes array

#### Scenario: Discovery registration includes resolve contract
- **WHEN** MiniBob registers with discovery-vessel
- **THEN** the payload includes resolve_endpoint, resolve_request_format, auth_scheme, and resolve_timeout_ms fields

#### Scenario: Existing shapes unaffected
- **WHEN** MiniBob registers with discovery-vessel
- **THEN** existing shapes (memo, file, directoryTree, gitDiff) remain in the shapes array alongside goalExecution and trajectoryExecution
