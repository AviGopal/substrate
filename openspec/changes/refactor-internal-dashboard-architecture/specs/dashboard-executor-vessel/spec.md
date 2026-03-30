# Specification: Dashboard Executor Vessel

## ADDED Requirements

### Requirement: Executor vessel processes user queries

The dashboard-executor vessel SHALL receive `query_interface` impulses from the UI vessel and process them using the MiniBob GoalProcessor to determine appropriate activities.

#### Scenario: Query impulse received
- **WHEN** the executor vessel receives a `query_interface` impulse with query text
- **THEN** it passes the query to GoalProcessor and executes the selected activity

#### Scenario: Activity execution creates UI impulse
- **WHEN** an activity completes successfully
- **THEN** the executor creates a `ui_component` impulse with the result and sends it to the UI vessel

#### Scenario: Activity execution fails
- **WHEN** an activity fails
- **THEN** the executor creates a `ui_component` impulse with error information and sends it to the UI vessel

### Requirement: Executor delegates data access via impulses

The executor vessel MUST NOT make direct REST calls to data services. All data access SHALL use impulse resolution via MCP to appropriate data vessels.

#### Scenario: Need activity template data
- **WHEN** the executor needs to query activity templates
- **THEN** it creates an `activityListRequest` impulse and resolves it via the activity-db vessel's MCP endpoint

#### Scenario: Need execution trace data
- **WHEN** the executor needs execution history
- **THEN** it creates an `activityExecutionTrace` impulse and resolves it via MCP

#### Scenario: Need metrics data
- **WHEN** the executor needs performance metrics
- **THEN** it creates an `activityMetrics` impulse and resolves it via MCP

### Requirement: Executor vessel uses vessel capability registry

The executor SHALL use the vessel capability registry to route impulses to the correct resolving vessel based on impulse shape.

#### Scenario: Route to activity-db vessel
- **WHEN** the executor needs to resolve an `activityListRequest` impulse
- **THEN** it queries the capability registry, finds the activity-db vessel resolves that shape, and routes the MCP call there

#### Scenario: Route to UI vessel
- **WHEN** the executor creates a `ui_component` impulse
- **THEN** it queries the capability registry, finds the dashboard-ui vessel resolves that shape, and routes the MCP call there

### Requirement: Executor exposes MCP endpoint

The dashboard-executor vessel SHALL expose an MCP server at `/mcp` for receiving impulses from the UI vessel and potentially other vessels.

#### Scenario: UI vessel delegates query
- **WHEN** the UI vessel sends a `query_interface` impulse via MCP to the executor
- **THEN** the executor accepts the impulse and begins processing

#### Scenario: MCP health check
- **WHEN** a client sends an MCP health check request
- **THEN** the executor responds with its status and capability list

### Requirement: Executor maintains execution state

The executor vessel SHALL maintain active execution state (current activities, impulse state space) for ongoing queries but MUST delegate persistent storage to data vessels.

#### Scenario: In-progress execution tracked
- **WHEN** an activity is executing
- **THEN** the executor maintains its state in memory (impulses, task progress)

#### Scenario: Execution complete stored remotely
- **WHEN** an activity execution completes
- **THEN** the executor creates an execution trace impulse and sends it to the activity-db vessel for persistent storage

### Requirement: Executor depends on MiniBob library

The dashboard-executor vessel SHALL have `@metabob/minibob` as a dependency and use its GoalProcessor, ActivityExecutor, and impulse management capabilities.

#### Scenario: MiniBob library imported
- **WHEN** checking the executor vessel's `package.json`
- **THEN** `@metabob/minibob` is listed in dependencies

#### Scenario: GoalProcessor used for query handling
- **WHEN** a query impulse arrives
- **THEN** the executor uses MiniBob's GoalProcessor.executeGoal() to handle it

### Requirement: Executor creates semantic impulses

The executor SHALL create domain-specific impulses for query results and user actions rather than returning raw data or generic messages.

#### Scenario: Query result as impulse
- **WHEN** the executor receives data from a resolved impulse
- **THEN** it wraps the data in a `query_result` impulse with metadata (query text, timestamp, source vessel)

#### Scenario: User action as impulse
- **WHEN** the UI vessel sends a user action (button click, selection)
- **THEN** the executor processes it as a `user_action` impulse with semantic meaning (action type, target, context)

### Requirement: Executor stores execution traces

After executing an activity, the executor MUST create an execution trace impulse and delegate its storage to the activity-db vessel via MCP.

#### Scenario: Successful execution traced
- **WHEN** an activity completes successfully
- **THEN** the executor creates an `activityExecutionTrace` impulse with success status, duration, cost, and output impulses

#### Scenario: Failed execution traced
- **WHEN** an activity fails
- **THEN** the executor creates an `activityExecutionTrace` impulse with failure status, error details, and input impulses

#### Scenario: Trace stored via MCP
- **WHEN** an execution trace impulse is created
- **THEN** the executor sends it to the activity-db vessel's MCP endpoint for persistent storage
