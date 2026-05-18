## ADDED Requirements

### Requirement: System health monitoring
The backend SHALL compute and store aggregate system health metrics at configurable time windows (1h, 24h, 7d).

#### Scenario: Hourly health metrics computed
- **WHEN** the hourly health aggregation job runs
- **THEN** the backend SHALL store a `system_health` record with `overallSuccessRate`, `templateCreationRate`, `averageCost`, `uniqueTemplatesUsed`, and `failureCorrelation` for the past 1 hour

#### Scenario: Health metrics queryable
- **WHEN** `GET /v2/system/health?window=24h` is called
- **THEN** the backend SHALL return the most recent system health record for the 24h window

### Requirement: Automatic boredom pause on anomalous metrics
The boredom system SHALL pause autonomous activity when system health metrics cross configurable anomaly thresholds.

#### Scenario: Low success rate triggers pause
- **WHEN** the 24h `overallSuccessRate` drops below 0.3
- **THEN** the boredom system SHALL transition to `paused` status and cease fetching and executing boredom tasks

#### Scenario: Runaway template creation triggers pause
- **WHEN** `templateCreationRate` exceeds 10 per hour sustained for 6 consecutive hours
- **THEN** the boredom system SHALL transition to `paused` status

#### Scenario: Correlated failures trigger pause
- **WHEN** `failureCorrelation` exceeds 0.8 over the 24h window (failures are not independent — they share patterns)
- **THEN** the boredom system SHALL transition to `paused` status

#### Scenario: Independent failures do not trigger pause
- **WHEN** overall success rate is 0.4 but `failureCorrelation` is 0.2 (failures are independent and diverse)
- **THEN** the boredom system SHALL remain active — independent failures indicate healthy exploration, not systematic degradation

### Requirement: Manual circuit breaker endpoint
The backend SHALL provide an endpoint for manually pausing and resuming the boredom system.

#### Scenario: Manual pause
- **WHEN** `POST /v2/system/circuit-breaker` is called with `{ action: "pause", reason: "investigating anomaly" }`
- **THEN** the boredom system SHALL transition to `paused` status and record the reason and timestamp

#### Scenario: Manual resume
- **WHEN** `POST /v2/system/circuit-breaker` is called with `{ action: "resume" }`
- **THEN** the boredom system SHALL transition to `active` status

#### Scenario: Circuit breaker status queryable
- **WHEN** `GET /v2/system/circuit-breaker` is called
- **THEN** the backend SHALL return current status (`active` or `paused`), the reason for pause (if paused), the timestamp of last state change, and which threshold triggered the pause (if automatic)

### Requirement: Boredom system respects circuit breaker state
The boredom task executor in MiniBob SHALL check circuit breaker state before fetching tasks.

#### Scenario: Paused state prevents task execution
- **WHEN** the boredom polling loop runs and circuit breaker state is `paused`
- **THEN** the boredom system SHALL skip task fetching and execution for that cycle, logging "Boredom paused: <reason>"

#### Scenario: Active state allows normal operation
- **WHEN** the boredom polling loop runs and circuit breaker state is `active`
- **THEN** the boredom system SHALL proceed with normal task fetching and execution
