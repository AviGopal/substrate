## ADDED Requirements

### Requirement: Display resolver tier per task
The system SHALL show which resolver tier (LOCAL/PATTERN/LLM) handled each task.

#### Scenario: Tier badges displayed
- **WHEN** task uses bash resolver
- **THEN** green badge shows "LOCAL (deterministic)"

### Requirement: Show cost breakdown by tier
The system SHALL aggregate and display costs grouped by resolver tier.

#### Scenario: Cost summary displayed
- **WHEN** execution uses 3 LOCAL, 1 PATTERN, 2 LLM resolvers
- **THEN** summary shows "80% deterministic ($0), 5% pattern ($0.002), 15% LLM ($0.15)"

### Requirement: Display resolver latency
The system SHALL show resolution latency and vessel attribution per impulse.

#### Scenario: Latency shown
- **WHEN** impulse resolved by activity-api vessel in 120ms
- **THEN** indicator shows "Resolved by activity-api (120ms)"
