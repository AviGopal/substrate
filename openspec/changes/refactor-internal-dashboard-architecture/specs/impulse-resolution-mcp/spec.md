# Specification: Impulse Resolution via MCP

## ADDED Requirements

### Requirement: Vessel exposes MCP endpoint for impulse resolution

Vessels SHALL expose an MCP server endpoint at `/mcp` that accepts impulse resolution requests. This replaces direct REST API calls with a unified impulse-driven communication pattern.

#### Scenario: Successful impulse resolution
- **WHEN** a vessel receives an MCP `impulse_resolve` tool call with a valid impulse and auth token
- **THEN** the vessel resolves the impulse by loading content according to the pointer type and returns the resolved impulse with `loaded: true`

#### Scenario: Unsupported impulse shape
- **WHEN** a vessel receives an impulse with a shape it cannot resolve (not in its `resolves` capability list)
- **THEN** the vessel returns an error indicating it cannot resolve that shape

#### Scenario: Authentication failure
- **WHEN** a vessel receives an impulse resolution request with an invalid or missing auth token
- **THEN** the vessel returns an authentication error and does not resolve the impulse

### Requirement: MCP tool accepts impulse and auth token

The MCP `impulse_resolve` tool SHALL accept two parameters: `impulse` (object) and `authToken` (string). The tool MUST not accept raw query parameters or endpoint paths.

#### Scenario: Valid parameters provided
- **WHEN** the tool is called with `{ impulse: {...}, authToken: "valid-jwt" }`
- **THEN** the tool processes the request and attempts resolution

#### Scenario: Missing required parameters
- **WHEN** the tool is called without `impulse` or `authToken`
- **THEN** the tool returns a parameter validation error

### Requirement: Resolved impulse maintains referential integrity

When an impulse is resolved via MCP, the returned impulse MUST preserve the original `id` and `shape` fields. Only `loaded`, `content`, and optional metadata fields SHALL be modified.

#### Scenario: Impulse ID preserved after resolution
- **WHEN** an unloaded impulse with `id: "query-123"` is resolved
- **THEN** the returned impulse has the same `id: "query-123"`

#### Scenario: Impulse shape unchanged
- **WHEN** an impulse with `shape: "activityListRequest"` is resolved
- **THEN** the returned impulse has the same `shape: "activityListRequest"`

### Requirement: MCP replaces direct REST calls

Vessels MUST NOT make direct HTTP fetch calls to other service endpoints for data retrieval. All data access SHALL go through impulse resolution via MCP.

#### Scenario: Legacy REST call removed
- **WHEN** a vessel needs data from another service
- **THEN** it creates an impulse with appropriate shape and resolves it via MCP, not via `fetch(endpoint)`

#### Scenario: Tool-based REST removed
- **WHEN** a vessel previously had tools like `query_activity_api` that made HTTP calls
- **THEN** those tools are removed and replaced with impulse creation/resolution patterns
