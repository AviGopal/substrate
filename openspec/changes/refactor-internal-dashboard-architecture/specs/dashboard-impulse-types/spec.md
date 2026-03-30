# Specification: Dashboard Impulse Types

## ADDED Requirements

### Requirement: queryInterface impulse captures user queries

A `queryInterface` impulse SHALL represent user input from the dashboard query field with text, optional context, and metadata.

#### Scenario: User submits text query
- **WHEN** a user types "show recent activity executions" and submits
- **THEN** a `queryInterface` impulse is created with `shape: "queryInterface"`, `pointer.text: "show recent activity executions"`, and `metadata.timestamp`

#### Scenario: Query includes context
- **WHEN** a user submits a query while viewing a specific execution trace
- **THEN** the impulse includes `pointer.context` with the current execution ID for contextual processing

#### Scenario: Query interface impulse structure
- **WHEN** a `queryInterface` impulse is created
- **THEN** it has fields: `id`, `shape: "queryInterface"`, `pointer: { type: "queryInterface", text: string, context?: object }`, `metadata`, `loaded: true`

### Requirement: queryResult impulse wraps backend data

A `queryResult` impulse SHALL wrap data retrieved from backend queries with provenance metadata.

#### Scenario: Activity list query result
- **WHEN** the executor resolves an `activityListRequest` and gets template data
- **THEN** it creates a `queryResult` impulse with `content` containing the templates and `metadata` including source vessel, timestamp, and original query

#### Scenario: Query result impulse structure
- **WHEN** a `queryResult` impulse is created
- **THEN** it has fields: `id`, `shape: "queryResult"`, `pointer: { type: "queryResult", query: string, endpoint?: string }`, `content: any`, `metadata: { cached: boolean, timestamp: string, source_vessel: string }`, `loaded: true`

#### Scenario: Result is cacheable
- **WHEN** a `queryResult` impulse is created
- **THEN** it can be cached by ID and reused for identical queries within cache TTL

### Requirement: userAction impulse represents semantic interactions

A `userAction` impulse SHALL represent user interactions with semantic meaning (not just generic "click" events).

#### Scenario: Button click with intent
- **WHEN** a user clicks a "Retry Execution" button on a failed trace
- **THEN** a `userAction` impulse is created with `pointer: { type: "userAction", action: "retry_execution", target_execution_id: "exec-123", reason: "user_requested" }`

#### Scenario: Row selection action
- **WHEN** a user selects a row in a data table of activity templates
- **THEN** a `userAction` impulse is created with `pointer: { type: "userAction", action: "select_template", target_template_id: "template-456" }`

#### Scenario: User action impulse structure
- **WHEN** a `userAction` impulse is created
- **THEN** it has fields: `id`, `shape: "userAction"`, `pointer: { type: "userAction", action: string, target?: string, payload?: object }`, `metadata: { ui_component_id: string, user_session_id: string, timestamp: string }`, `loaded: true`

### Requirement: viewportState impulse provides layout metadata

A `viewportState` impulse SHALL capture browser viewport dimensions and layout bounds for responsive rendering decisions.

#### Scenario: Viewport dimensions captured
- **WHEN** the UI vessel is asked for viewport state
- **THEN** it creates a `viewportState` impulse with `content: { width: number, height: number, devicePixelRatio: number }`

#### Scenario: Layout bounds included
- **WHEN** a viewport state impulse includes component bounds
- **THEN** it has `content.bounds: { componentId: string, x: number, y: number, width: number, height: number }[]`

#### Scenario: Viewport state impulse structure
- **WHEN** a `viewportState` impulse is created
- **THEN** it has fields: `id`, `shape: "viewportState"`, `pointer: { type: "viewportState" }`, `content: { width: number, height: number, devicePixelRatio: number, bounds?: array }`, `loaded: true`

### Requirement: All dashboard impulses have unique IDs

Every dashboard impulse SHALL have a globally unique `id` field (UUID or similar) for referencing in the shared impulse state space.

#### Scenario: Impulse ID uniqueness
- **WHEN** multiple impulses are created simultaneously
- **THEN** each has a unique `id` that can be used to reference it later

#### Scenario: Impulse referenced by ID
- **WHEN** a WebSocket message needs to refer to an impulse
- **THEN** it uses the impulse's `id` string instead of serializing the full impulse

### Requirement: Dashboard impulses defined in metabob-proto

All dashboard impulse type definitions SHALL live in `repos/metabob-proto/src/impulse-types/` for shared access across vessels.

#### Scenario: Proto package exports types
- **WHEN** a vessel imports `@metabob/proto`
- **THEN** it can access TypeScript interfaces for `QueryInterfaceImpulse`, `QueryResultImpulse`, `UserActionImpulse`, `ViewportStateImpulse`

#### Scenario: Type safety enforced
- **WHEN** creating a dashboard impulse
- **THEN** TypeScript enforces the correct structure based on imported types
