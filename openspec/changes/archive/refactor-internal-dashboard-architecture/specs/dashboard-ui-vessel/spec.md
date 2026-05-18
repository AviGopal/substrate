# Specification: Dashboard UI Vessel

## ADDED Requirements

### Requirement: UI vessel resolves presentation-layer impulses only

The dashboard-ui vessel SHALL resolve only `ui_component`, `query_interface`, and `viewport_state` impulses. It MUST NOT execute activities, make backend queries, or process business logic.

#### Scenario: UI component impulse resolved
- **WHEN** the dashboard-ui vessel receives a `ui_component` impulse
- **THEN** it renders the component tree in the React frontend and broadcasts via WebSocket

#### Scenario: Query interface impulse captured
- **WHEN** a user submits a query via the UI
- **THEN** the vessel creates a `query_interface` impulse with the query text and broadcasts it to the executor vessel

#### Scenario: Viewport state impulse provided
- **WHEN** requested, the vessel creates a `viewport_state` impulse
- **THEN** the impulse contains current window dimensions and layout bounds from the browser

#### Scenario: Business logic impulse rejected
- **WHEN** the dashboard-ui vessel receives an impulse like `activityListRequest` or `goalExecution`
- **THEN** it returns an error indicating it cannot resolve that shape

### Requirement: UI vessel exposes MCP server

The dashboard-ui vessel SHALL expose an MCP server at `/mcp` for impulse resolution requests from other vessels.

#### Scenario: MCP endpoint accessible
- **WHEN** another vessel sends an MCP request to `http://internal-dashboard-ui.activity-system.svc.cluster.local:3001/mcp`
- **THEN** the request is accepted and processed according to impulse shape

#### Scenario: UI component impulse resolved via MCP
- **WHEN** the executor vessel sends a `ui_component` impulse via MCP
- **THEN** the UI vessel resolves it by rendering and returns confirmation

### Requirement: WebSocket broadcasts impulse references

The dashboard-ui vessel SHALL broadcast impulses to connected clients using impulse IDs, not full content serialization. Clients reference impulses by ID.

#### Scenario: Impulse created broadcast
- **WHEN** a new impulse is created or received
- **THEN** the vessel broadcasts an `impulse_create` message with the full impulse object (initial state)

#### Scenario: Impulse updated broadcast
- **WHEN** an existing impulse is modified
- **THEN** the vessel broadcasts an `impulse_update` message with `impulseId` and only the changed fields (patch)

#### Scenario: Impulse deleted broadcast
- **WHEN** an impulse is removed from the state space
- **THEN** the vessel broadcasts an `impulse_delete` message with the `impulseId`

### Requirement: UI vessel maintains no business state

The dashboard-ui vessel MUST NOT store activity templates, execution traces, or user queries beyond the current session. All persistent state lives in other vessels or databases.

#### Scenario: Session ends, state cleared
- **WHEN** a WebSocket connection closes
- **THEN** the vessel clears that session's impulse state and does not persist it

#### Scenario: No database access
- **WHEN** the UI vessel needs data
- **THEN** it requests impulse resolution from executor or data vessels, not querying databases directly

### Requirement: UI vessel delegates execution

When a user action requires execution (query processing, activity selection), the UI vessel SHALL create an impulse and delegate to the dashboard-executor vessel via MCP.

#### Scenario: User submits query
- **WHEN** user enters a query in the input field
- **THEN** the UI vessel creates a `query_interface` impulse and sends it to the executor vessel for processing

#### Scenario: User clicks button
- **WHEN** user clicks an action button in a rendered component
- **THEN** the UI vessel creates a `user_action` impulse and delegates to the executor vessel

### Requirement: No embedded MiniBob

The dashboard-ui vessel MUST NOT have `@metabob/minibob` as a dependency. All MiniBob functionality is handled by the separate dashboard-executor vessel.

#### Scenario: Package dependencies exclude MiniBob
- **WHEN** checking the UI vessel's `package.json`
- **THEN** `@metabob/minibob` is not listed in dependencies

#### Scenario: No local activity execution
- **WHEN** the UI vessel receives a request that would require activity execution
- **THEN** it delegates via impulse creation, never executing activities locally
