## ADDED Requirements

### Requirement: Behavioral metric tracking per resolver and activity
The backend SHALL maintain running statistics on behavioral metrics for each resolver and activity template, grouped by peer category (pointer type for resolvers, goal category for activities).

#### Scenario: Resolver metrics tracked
- **WHEN** a resolver of type `sql_query` executes
- **THEN** the backend SHALL update running statistics for that resolver including `medianDuration`, `medianCost`, `medianMetadataSize`, `medianTokenCount`, and `toolCallDiversity` (unique tools / total tool calls)

#### Scenario: Activity metrics tracked
- **WHEN** an activity in category `bugfix` executes
- **THEN** the backend SHALL update running statistics for that activity template including the same behavioral metrics, grouped under the `bugfix` peer category

### Requirement: Peer group anomaly detection
The backend SHALL flag resolvers or activity templates whose behavioral metrics deviate significantly from their peer group.

#### Scenario: Anomalous metadata size detected
- **WHEN** resolver R has `medianMetadataSize` that is more than 2 standard deviations above the mean for all `sql_query` resolvers
- **THEN** the backend SHALL create a peer anomaly impulse: `{ type: "peer_anomaly", entityId: "R", metric: "medianMetadataSize", deviation: <value>, peerGroup: "sql_query resolvers", timestamp: <now> }`

#### Scenario: Anomalous cost detected
- **WHEN** activity template T has `medianCost` that is more than 2 standard deviations above the mean for all `bugfix` activities
- **THEN** the backend SHALL create a peer anomaly impulse with the relevant details

#### Scenario: Normal variation does not trigger flag
- **WHEN** a resolver's metrics are within 2 standard deviations of its peer group
- **THEN** no anomaly impulse SHALL be created

#### Scenario: Insufficient peer data does not trigger flag
- **WHEN** a peer group has fewer than 3 members with sufficient observations
- **THEN** peer comparison SHALL be skipped for that group — anomaly detection requires a meaningful peer baseline

### Requirement: Peer anomaly impulses are observable
Peer anomaly impulses SHALL be stored and queryable so that higher observation layers (human or automated) can analyze patterns.

#### Scenario: Query anomaly history
- **WHEN** `GET /v2/metrics/peer-anomalies?window=7d` is called
- **THEN** the backend SHALL return all peer anomaly impulses from the past 7 days, including entity ID, metric, deviation magnitude, peer group, and timestamp

#### Scenario: Anomaly patterns across time
- **WHEN** `GET /v2/metrics/peer-anomalies?entity_id=R&window=30d` is called
- **THEN** the backend SHALL return the anomaly history for resolver R over 30 days, enabling trend detection (is this resolver becoming more anomalous or normalizing?)

#### Scenario: Anomalies do not trigger automatic action
- **WHEN** a peer anomaly impulse is created
- **THEN** the system SHALL NOT automatically quarantine, demote, or disable the flagged entity — anomalies are observation data for higher layers, not enforcement triggers
