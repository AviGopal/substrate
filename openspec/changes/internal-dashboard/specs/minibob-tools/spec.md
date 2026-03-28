## ADDED Requirements

### Requirement: create_ui_component tool
The system SHALL provide a MiniBob tool to create UI component impulses.

#### Scenario: Create table component
- **WHEN** MiniBob calls `create_ui_component({ type: 'table', data: [...], position: 'below-input' })`
- **THEN** a new UI component impulse is created and sent to the dashboard via WebSocket

#### Scenario: Create component with explicit position
- **WHEN** MiniBob calls `create_ui_component({ type: 'narrative', data: '...', position: { x: 50, y: 200 } })`
- **THEN** the component is created at the specified coordinates

#### Scenario: Create component with custom props
- **WHEN** MiniBob calls `create_ui_component({ type: 'table', data: [...], props: { sortable: true, pageSize: 20 } })`
- **THEN** the component is created with those props passed to the React component

### Requirement: update_ui_component tool
The system SHALL provide a MiniBob tool to update existing UI component impulses.

#### Scenario: Update component data
- **WHEN** MiniBob calls `update_ui_component({ id: 'xxx', changes: { data: newData } })`
- **THEN** the impulse data is updated and the frontend re-renders with new data

#### Scenario: Update component position
- **WHEN** MiniBob calls `update_ui_component({ id: 'xxx', changes: { position: 'center' } })`
- **THEN** the component animates to the new position

#### Scenario: Update component type
- **WHEN** MiniBob calls `update_ui_component({ id: 'xxx', changes: { type: 'json' } })`
- **THEN** the component re-renders as the new type with the same data

### Requirement: delete_ui_component tool
The system SHALL provide a MiniBob tool to delete UI component impulses.

#### Scenario: Delete single component
- **WHEN** MiniBob calls `delete_ui_component({ id: 'xxx' })`
- **THEN** the impulse is removed and the frontend unmounts the component

#### Scenario: Cannot delete protected input
- **WHEN** MiniBob calls `delete_ui_component({ id: 'query-input' })`
- **THEN** the tool returns an error indicating the input cannot be deleted

### Requirement: clear_ui_components tool
The system SHALL provide a MiniBob tool to clear all UI components except specified exceptions.

#### Scenario: Clear all response components
- **WHEN** MiniBob calls `clear_ui_components({})`
- **THEN** all UI component impulses except the query input are deleted

#### Scenario: Clear with exceptions
- **WHEN** MiniBob calls `clear_ui_components({ except: ['component-123'] })`
- **THEN** all UI components except the query input and component-123 are deleted

### Requirement: query_kubernetes tool
The system SHALL provide a MiniBob tool to query Kubernetes resources.

#### Scenario: List pods in namespace
- **WHEN** MiniBob calls `query_kubernetes({ resource: 'pods', namespace: 'activity-system' })`
- **THEN** the tool returns pod list with name, status, restarts, and age

#### Scenario: Get pod with selector
- **WHEN** MiniBob calls `query_kubernetes({ resource: 'pods', namespace: 'activity-system', selector: 'app=minibob' })`
- **THEN** the tool returns only pods matching the label selector

#### Scenario: Query services
- **WHEN** MiniBob calls `query_kubernetes({ resource: 'services', namespace: 'activity-system' })`
- **THEN** the tool returns service list with name, type, ports, and cluster IP

#### Scenario: Query events
- **WHEN** MiniBob calls `query_kubernetes({ resource: 'events', namespace: 'activity-system', limit: 20 })`
- **THEN** the tool returns recent events with type, reason, message, and timestamp

### Requirement: query_surrealdb tool
The system SHALL provide a MiniBob tool to execute SurrealQL queries.

#### Scenario: Execute SELECT query
- **WHEN** MiniBob calls `query_surrealdb({ query: 'SELECT * FROM activity_executions LIMIT 10' })`
- **THEN** the tool returns query results as an array

#### Scenario: Execute query with parameters
- **WHEN** MiniBob calls `query_surrealdb({ query: 'SELECT * FROM users WHERE org_id = $org', params: { org: 'organization:acme' } })`
- **THEN** the tool executes the parameterized query safely

#### Scenario: Read-only enforcement
- **WHEN** MiniBob calls `query_surrealdb({ query: 'DELETE FROM users' })`
- **THEN** the tool returns an error indicating only SELECT queries are allowed

### Requirement: check_service_health tool
The system SHALL provide a MiniBob tool to check backend service health.

#### Scenario: Check all services
- **WHEN** MiniBob calls `check_service_health({ services: ['activity-api', 'analysis-api', 'surrealdb'] })`
- **THEN** the tool returns health status and latency for each service

#### Scenario: Check single service
- **WHEN** MiniBob calls `check_service_health({ services: ['surrealdb'] })`
- **THEN** the tool returns detailed health info including version and connection pool status

#### Scenario: Handle unreachable service
- **WHEN** MiniBob calls `check_service_health` and a service is unreachable
- **THEN** the tool returns status 'unreachable' with error details for that service

### Requirement: query_system_health tool
The system SHALL provide a MiniBob tool to query observation hierarchy system health metrics.

#### Scenario: Query 24-hour system health
- **WHEN** MiniBob calls `query_system_health({ window: '24h' })`
- **THEN** the tool returns aggregate metrics including `overallSuccessRate`, `templateCreationRate`, `averageCost`, `uniqueTemplatesUsed`, `failureCorrelation`, and `status`

#### Scenario: Query hourly system health
- **WHEN** MiniBob calls `query_system_health({ window: '1h' })`
- **THEN** the tool returns the most recent hourly health metrics for fine-grained monitoring

### Requirement: query_tool_patterns tool
The system SHALL provide a MiniBob tool to query tool usage patterns across timescales.

#### Scenario: Query frequent tool sequences
- **WHEN** MiniBob calls `query_tool_patterns({ window: '7d', minFrequency: 5 })`
- **THEN** the tool returns tool call sequences that occurred at least 5 times in the past 7 days, with frequency counts and success rates

### Requirement: query_composition_patterns tool
The system SHALL provide a MiniBob tool to query activity composition patterns.

#### Scenario: Query activity chains
- **WHEN** MiniBob calls `query_composition_patterns({ window: '7d' })`
- **THEN** the tool returns activity composition chains (A→B→C patterns) with their frequency, overall success rate, and average cost

### Requirement: query_peer_anomalies tool
The system SHALL provide a MiniBob tool to query peer comparison anomaly flags.

#### Scenario: Query template anomalies
- **WHEN** MiniBob calls `query_peer_anomalies({ entityType: 'template' })`
- **THEN** the tool returns templates with behavioral metrics that deviate more than 2 standard deviations from their peer group mean

#### Scenario: Query resolver anomalies
- **WHEN** MiniBob calls `query_peer_anomalies({ entityType: 'resolver' })`
- **THEN** the tool returns resolvers with anomalous behavior patterns

### Requirement: circuit breaker tools
The system SHALL provide MiniBob tools to query and control the boredom system circuit breaker.

#### Scenario: Get circuit breaker state
- **WHEN** MiniBob calls `get_circuit_breaker_state()`
- **THEN** the tool returns current status (`active` or `paused`), the reason for pause (if paused), the timestamp of last state change, and which threshold triggered the pause (if automatic)

#### Scenario: Pause circuit breaker
- **WHEN** MiniBob calls `set_circuit_breaker({ action: 'pause', reason: 'Investigating anomaly' })`
- **THEN** the boredom system transitions to `paused` state and the reason and timestamp are recorded

#### Scenario: Resume circuit breaker
- **WHEN** MiniBob calls `set_circuit_breaker({ action: 'resume' })`
- **THEN** the boredom system transitions to `active` state
