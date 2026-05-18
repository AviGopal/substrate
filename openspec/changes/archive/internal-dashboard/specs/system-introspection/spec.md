## ADDED Requirements

### Requirement: Query Kubernetes deployment state
The system SHALL allow MiniBob to query Kubernetes resources in the activity-system namespace.

#### Scenario: List running pods
- **WHEN** user asks "What pods are running?"
- **THEN** MiniBob queries Kubernetes API and returns pod names, status, and resource usage

#### Scenario: Check pod health
- **WHEN** user asks "Is SurrealDB healthy?"
- **THEN** MiniBob queries the surrealdb pod status and readiness probes

#### Scenario: View recent pod events
- **WHEN** user asks "Why did activity-api restart?"
- **THEN** MiniBob queries Kubernetes events for the deployment and returns relevant events

#### Scenario: List services and endpoints
- **WHEN** user asks "What services are exposed?"
- **THEN** MiniBob returns service names, ports, and endpoint counts

### Requirement: Query SurrealDB data
The system SHALL allow MiniBob to execute SurrealQL queries against the learning database.

#### Scenario: Count records in table
- **WHEN** user asks "How many activities executed today?"
- **THEN** MiniBob executes `SELECT count() FROM activity_executions WHERE created_at > time::now() - 1d`

#### Scenario: Query Thompson Sampling stats
- **WHEN** user asks "Show Thompson Sampling stats for template X"
- **THEN** MiniBob queries `activity_templates` for success_rate, total_executions, and variant data

#### Scenario: Explore composition graph
- **WHEN** user asks "Show the composition graph for session X"
- **THEN** MiniBob queries `composition_graph` and `execution_traces` to build node/edge data

#### Scenario: List recent execution failures
- **WHEN** user asks "What activities failed in the last hour?"
- **THEN** MiniBob queries `activity_executions WHERE status = 'failed' AND completed_at > time::now() - 1h`

### Requirement: Check connected service health
The system SHALL allow MiniBob to check the health of connected backend services.

#### Scenario: Check all service health
- **WHEN** user asks "Are all services healthy?"
- **THEN** MiniBob calls health endpoints for activity-api, analysis-api, and surrealdb, returning status summary

#### Scenario: Check specific service latency
- **WHEN** user asks "What's the latency to analysis-api?"
- **THEN** MiniBob times a health check request and reports round-trip latency

#### Scenario: Detect service degradation
- **WHEN** user asks "Is anything slow right now?"
- **THEN** MiniBob checks response times across services and highlights any above threshold

### Requirement: Query organization and member data
The system SHALL allow MiniBob to query multi-tenant organization and user data.

#### Scenario: List organizations
- **WHEN** user asks "List all organizations"
- **THEN** MiniBob queries `organizations` table and returns org names, seat usage, and subscription status

#### Scenario: List MiniBob instances
- **WHEN** user asks "Show all MiniBob instances"
- **THEN** MiniBob queries `minibob_instance` table and returns instance IDs, assigned projects, and last activity

#### Scenario: Query instance execution history
- **WHEN** user asks "What has minibob-local-001 been doing?"
- **THEN** MiniBob queries executions filtered by that instance and returns recent activity summary

### Requirement: Explore activity templates and variants
The system SHALL allow MiniBob to explore the activity template registry.

#### Scenario: List templates by category
- **WHEN** user asks "Show all bugfix templates"
- **THEN** MiniBob queries `activity_templates WHERE category = 'bugfix'`

#### Scenario: Show template performance
- **WHEN** user asks "Which templates have low success rates?"
- **THEN** MiniBob queries templates ordered by success_rate ascending

#### Scenario: Show template variants
- **WHEN** user asks "What variants exist for template X?"
- **THEN** MiniBob queries templates with matching parent_id to show variant tree

### Requirement: Query observation hierarchy metrics
The system SHALL allow MiniBob to query multi-scale observation data for system self-awareness.

#### Scenario: Query system health summary
- **WHEN** user asks "Is the system healthy?"
- **THEN** MiniBob queries `query_system_health({ window: '24h' })` and returns aggregate metrics
- **AND** creates a `system_health` UI component showing success rate, template creation rate, and circuit breaker status

#### Scenario: Query tool patterns
- **WHEN** user asks "What tool sequences are most common?"
- **THEN** MiniBob queries `query_tool_patterns({ window: '7d', minFrequency: 5 })`
- **AND** returns table of tool sequences with frequency counts and success rates

#### Scenario: Query composition patterns
- **WHEN** user asks "Show activity composition chains"
- **THEN** MiniBob queries `query_composition_patterns({ window: '7d' })`
- **AND** creates a graph UI component showing A→B→C patterns with success rates as edge weights

#### Scenario: Query peer anomalies
- **WHEN** user asks "Are any templates behaving unusually?"
- **THEN** MiniBob queries `query_peer_anomalies({ entityType: 'template' })`
- **AND** returns flagged templates with their deviation metrics relative to peer group

### Requirement: Circuit breaker visibility and control
The system SHALL allow MiniBob to query and control the boredom system circuit breaker.

#### Scenario: Check circuit breaker state
- **WHEN** user asks "Is the boredom system running?"
- **THEN** MiniBob queries `get_circuit_breaker_state()` and returns status (active/paused), reason if paused, and timestamp

#### Scenario: Pause boredom system
- **WHEN** user says "Pause the boredom system" (and is authorized)
- **THEN** MiniBob calls `set_circuit_breaker({ action: 'pause', reason: 'Manual pause via internal dashboard' })`
- **AND** confirms the boredom system is now paused

#### Scenario: Resume boredom system
- **WHEN** user says "Resume boredom activities" (and is authorized)
- **THEN** MiniBob calls `set_circuit_breaker({ action: 'resume' })`
- **AND** confirms the boredom system is now active

#### Scenario: Circuit breaker status in system health
- **WHEN** MiniBob displays system_health UI component
- **THEN** the circuit breaker status is always visible as a badge
- **AND** if paused, shows the pause reason and who/what triggered it
