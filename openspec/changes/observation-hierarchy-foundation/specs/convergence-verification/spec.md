## ADDED Requirements

### Requirement: Thompson Sampling uses actual Beta distribution samples
The recommendation endpoint SHALL sample from Beta(alpha, beta) distributions rather than computing the expected value alpha/(alpha+beta).

#### Scenario: Exploration of underperforming template
- **WHEN** template A has alpha=100, beta=5 and template B has alpha=3, beta=1
- **THEN** template B SHALL have a non-zero probability of being selected due to stochastic sampling from its Beta distribution, not zero probability from expected-value comparison

#### Scenario: Deterministic mode for testing
- **WHEN** the recommendation endpoint is called with `deterministic: true` parameter
- **THEN** the system SHALL use expected value alpha/(alpha+beta) instead of sampling, to enable reproducible test assertions

### Requirement: Shadow sampling records considered alternatives
When the goal processor requests recommendations and selects a variant for execution, the system SHALL record which other variants were sampled but not executed.

#### Scenario: Shadow samples recorded in execution trace
- **WHEN** the goal processor samples 3 variants (A, B, C) and executes A
- **THEN** the execution trace SHALL include `shadowSamples: [{ variantId: "B", sampledScore: 0.72 }, { variantId: "C", sampledScore: 0.68 }]`

#### Scenario: Shadow samples available for pattern analysis
- **WHEN** the backend aggregation endpoint `GET /v2/metrics/shadow-patterns?window=7d` is called
- **THEN** the backend SHALL return patterns showing which variants are consistently sampled but not executed, and whether executed variants outperform their shadow alternatives

### Requirement: Parallel execution for high-stakes operations
When an execution is classified as high-stakes (configurable threshold), the system SHALL execute 2 variants in parallel and compare state transitions.

#### Scenario: High-stakes threshold triggers parallel execution
- **WHEN** the goal processor estimates an activity will modify more than 5 files or cost more than $0.50
- **THEN** the system SHALL execute the top 2 Thompson-sampled variants in parallel on isolated working copies

#### Scenario: Convergent parallel executions recorded
- **WHEN** two parallel executions produce state transition hashes that match within tolerance
- **THEN** the primary execution's result SHALL be accepted and both traces stored with `convergenceScore: "high"`

#### Scenario: Divergent parallel executions flagged
- **WHEN** two parallel executions produce state transition hashes that differ beyond tolerance
- **THEN** the system SHALL create a peer anomaly impulse: `{ type: "convergence_divergence", executions: [id1, id2], divergenceMetric: <value> }` and accept the execution from the higher-scored Thompson variant

#### Scenario: Parallel execution cost is bounded
- **WHEN** the high-stakes threshold is not met
- **THEN** the system SHALL NOT execute in parallel, relying on shadow sampling only
