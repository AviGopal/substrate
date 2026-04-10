## ADDED Requirements

### Requirement: Health score computation

Health score SHALL be computed as weighted average of three factors: success rate, latency, and availability.

#### Scenario: Health score formula
- **WHEN** system computes vessel health score
- **THEN** formula SHALL be:
  ```
  health_score = (success_rate × 0.5) + (latency_factor × 0.3) + (availability_factor × 0.2)

  Where:
  - success_rate = successful_requests / total_requests (last 100 requests)
  - latency_factor = 1.0 - min(p95_latency / 1000ms, 1.0)
  - availability_factor = heartbeats_received / heartbeats_expected (last 10 periods)
  ```
- **AND** result SHALL be normalized to range [0.0, 1.0]

#### Scenario: Health score below threshold
- **WHEN** vessel has success_rate = 0.6, p95_latency = 800ms, availability = 0.8
- **THEN** health_score = (0.6 × 0.5) + (0.2 × 0.3) + (0.8 × 0.2) = 0.52
- **AND** vessel remains eligible for routing (threshold is 0.3)
- **AND** vessel has reduced selection probability compared to higher-scoring vessels

#### Scenario: Health score drops below 0.3 threshold
- **WHEN** vessel has success_rate = 0.3, p95_latency = 950ms, availability = 0.4
- **THEN** health_score = (0.3 × 0.5) + (0.05 × 0.3) + (0.4 × 0.2) = 0.245
- **AND** vessel is excluded from routing selection
- **AND** circuit breaker may open due to low health
- **AND** trace records health score drop and routing ineligibility

#### Scenario: Perfect health score
- **WHEN** vessel has success_rate = 1.0, p95_latency = 100ms, availability = 1.0
- **THEN** health_score = (1.0 × 0.5) + (0.9 × 0.3) + (1.0 × 0.2) = 0.97
- **AND** vessel has maximum selection probability
- **AND** trace records excellent performance metrics

### Requirement: Vessel Registry routing decisions are traced
The Vessel Registry SHALL record execution traces for all routing decisions including vessel selection, capability matching, and health score evaluation.

#### Scenario: Trace vessel selection for impulse resolution
- **WHEN** Vessel Registry receives request to resolve impulse type `analysis:code-smell`
- **THEN** system SHALL create trace record with:
  - Input: impulse metadata (type, shape, priority)
  - Candidates: all vessels advertising `analysis:code-smell` capability
  - Health scores: current health score for each candidate
  - Selection algorithm: routing strategy used (round-robin, health-weighted, etc.)
  - Selected vessel: final chosen vessel ID and endpoint
  - Decision time: milliseconds to complete routing decision

#### Scenario: Trace capability matching failure
- **WHEN** Vessel Registry cannot find vessel for impulse type `custom:new-type`
- **THEN** system SHALL create trace record with:
  - Input: impulse metadata
  - Search performed: all registered vessels checked
  - Failure reason: "no vessel advertises capability custom:new-type"
  - Fallback attempted: whether fallback routing was tried
  - Resolution: final status (failed, fallback succeeded, etc.)

#### Scenario: Trace health-based vessel exclusion
- **WHEN** Vessel Registry excludes unhealthy vessels during routing
- **THEN** system SHALL create trace record with:
  - Excluded vessels: list of vessel IDs below health threshold
  - Health scores: current score for each excluded vessel
  - Circuit breaker state: open/closed for each excluded vessel
  - Remaining candidates: vessels still eligible after health filtering
  - Threshold applied: minimum health score required

### Requirement: Cross-Vessel Protocol circuit breaker state is traced
All circuit breaker state transitions SHALL be recorded with execution traces linking to the vessel communication that triggered the state change.

#### Scenario: Trace circuit breaker opening
- **WHEN** vessel communication fails and circuit breaker opens
- **THEN** system SHALL create trace record with:
  - Vessel communication: source vessel, target vessel, endpoint called
  - Failure details: error type, HTTP status, timeout duration
  - Failure count: consecutive failures leading to circuit open
  - Threshold: max failures configured before circuit opens
  - State transition: from `closed` to `open` with timestamp
  - Cooldown period: duration before half-open attempt

#### Scenario: Trace circuit breaker half-open attempt
- **WHEN** circuit breaker enters half-open state and allows probe request
- **THEN** system SHALL create trace record with:
  - Previous state: how long circuit was open
  - Probe request: endpoint and parameters sent
  - Probe result: success or failure with details
  - State transition: next state (back to open, or to closed)
  - Health score impact: whether this affects vessel health score

#### Scenario: Trace circuit breaker closing after recovery
- **WHEN** half-open probe succeeds and circuit breaker closes
- **THEN** system SHALL create trace record with:
  - Recovery confirmation: consecutive successful requests
  - Health score update: new health score after recovery
  - Routing eligibility: vessel re-enabled for routing
  - Backlog processing: whether queued requests are now dispatched
  - State transition: from `half-open` to `closed` with timestamp

#### Scenario: Trace circuit breaker preventing request
- **WHEN** incoming request is blocked by open circuit breaker
- **THEN** system SHALL create trace record with:
  - Blocked request: endpoint and parameters that were blocked
  - Circuit state: current circuit breaker status
  - Time remaining: cooldown period before half-open attempt
  - Alternative action: whether request was routed to fallback vessel
  - Impact: whether this contributed to upstream circuit breaker state

### Requirement: Analysis-API resolver performance is traced
Direct MiniBob-to-Analysis-API impulse resolution SHALL be traced with performance metrics for learning and optimization.

#### Scenario: Trace successful impulse resolution
- **WHEN** MiniBob resolves impulse via Analysis-API `/v2/impulses/resolve`
- **THEN** system SHALL create trace record with:
  - Request: impulse type, shape, and pointer details
  - Response time: total resolution duration in milliseconds
  - Content size: bytes returned in resolved impulse content
  - Token estimate: estimated tokens if LLM content
  - Cache status: whether response was cached (hit/miss/bypass)
  - Trace ID: correlation ID linking to Analysis-API internal trace

#### Scenario: Trace resolution timeout
- **WHEN** Analysis-API does not respond within configured timeout
- **THEN** system SHALL create trace record with:
  - Request details: impulse being resolved
  - Timeout threshold: configured max wait time
  - Actual duration: how long request waited before timeout
  - Retry attempt: whether retry was attempted
  - Fallback action: whether MiniBob used cached or default value
  - Circuit breaker impact: whether this contributes to opening circuit

#### Scenario: Trace resolution error
- **WHEN** Analysis-API returns error response (4xx/5xx)
- **THEN** system SHALL create trace record with:
  - Request details: impulse being resolved
  - Error response: status code, error message, error type
  - Response time: duration before error received
  - Retry decision: whether error is retryable
  - Upstream trace: Analysis-API trace ID if available
  - Activity impact: whether this caused task or activity failure

#### Scenario: Trace batch resolution performance
- **WHEN** MiniBob resolves multiple impulses in single request
- **THEN** system SHALL create trace record with:
  - Batch size: number of impulses in request
  - Individual timings: per-impulse resolution time
  - Total duration: end-to-end batch resolution time
  - Partial failures: which impulses failed and why
  - Batch efficiency: time saved vs individual requests
  - Ordering preserved: whether resolution order matches request order

### Requirement: Coordination activity traces use standardized format
All traces for vessel coordination (registry routing, cross-vessel calls, resolver performance) SHALL use consistent schema for aggregation and analysis.

#### Scenario: Trace schema includes coordination context
- **WHEN** any coordination trace is created
- **THEN** trace record SHALL include:
  - `trace_type`: one of `registry_routing`, `circuit_breaker`, `vessel_communication`, `impulse_resolution`
  - `source_vessel_id`: vessel initiating the coordination
  - `target_vessel_id`: vessel being coordinated with (if applicable)
  - `correlation_id`: UUID linking related coordination traces
  - `parent_activity_id`: activity execution this coordination supports
  - `timestamp`: ISO 8601 timestamp with millisecond precision

#### Scenario: Trace includes performance metrics
- **WHEN** coordination trace is stored
- **THEN** trace record SHALL include:
  - `duration_ms`: total time for coordination operation
  - `network_latency_ms`: time spent in network transit (if measurable)
  - `processing_time_ms`: time spent in target vessel processing
  - `retry_count`: number of retries attempted (0 if first attempt succeeded)
  - `data_size_bytes`: payload size for requests/responses

#### Scenario: Trace includes outcome classification
- **WHEN** coordination operation completes
- **THEN** trace record SHALL include:
  - `outcome`: one of `success`, `failure`, `timeout`, `circuit_open`, `fallback`
  - `error_type`: classification if outcome is not success
  - `error_details`: structured error information
  - `fallback_used`: whether fallback coordination path was taken
  - `impact_assessment`: whether this affected activity outcome

#### Scenario: Traces are linked to activity execution
- **WHEN** coordination trace is created during activity execution
- **THEN** system SHALL:
  - Include `parent_activity_execution_id` in trace
  - Store trace in same transaction as activity state update
  - Enable querying all coordination traces for given activity
  - Aggregate coordination performance into activity metrics
  - Detect coordination bottlenecks in activity patterns

### Requirement: Dashboard provides visibility for coordination traces
The Activity Dashboard SHALL display coordination traces with filtering, aggregation, and correlation views.

#### Scenario: View all coordination traces for activity
- **WHEN** user selects an activity execution in dashboard
- **THEN** dashboard SHALL display:
  - Timeline view: all coordination traces in chronological order
  - Trace types: visual distinction for registry, circuit breaker, vessel communication, resolution
  - Performance overlay: duration bars showing relative time spent
  - Error highlights: failed coordination attempts marked prominently
  - Correlation links: ability to expand related traces

#### Scenario: Filter traces by coordination type
- **WHEN** user applies filter for trace type `circuit_breaker`
- **THEN** dashboard SHALL display:
  - Only circuit breaker state transition traces
  - Aggregated stats: total opens, closes, half-open attempts
  - Trend chart: circuit breaker state over time
  - Affected vessels: which vessels experienced circuit events
  - Impact analysis: activities affected by circuit breaker state

#### Scenario: View vessel communication patterns
- **WHEN** user navigates to vessel coordination view
- **THEN** dashboard SHALL display:
  - Graph visualization: vessels as nodes, communications as edges
  - Edge weight: thickness indicates communication frequency
  - Edge color: color indicates success rate (green to red)
  - Circuit breaker indicators: badges on vessels with open circuits
  - Latency heatmap: time-based view of communication delays

#### Scenario: Analyze resolution performance trends
- **WHEN** user views impulse resolution analytics
- **THEN** dashboard SHALL display:
  - Resolution time percentiles: p50, p95, p99 for each impulse type
  - Resolver comparison: Analysis-API vs other resolvers
  - Cache effectiveness: hit rate and time saved
  - Timeout trends: frequency and patterns of timeouts
  - Batch efficiency: single vs batch resolution performance

#### Scenario: Detect coordination bottlenecks
- **WHEN** dashboard analyzes recent activity executions
- **THEN** dashboard SHALL identify:
  - Slow coordination paths: operations consistently above threshold
  - Circuit breaker hot spots: vessels frequently opening circuits
  - Registry routing issues: high-latency vessel selection
  - Resolution failures: impulse types with high error rates
  - Recommendations: suggested configuration or architecture changes

### Requirement: Traces support learning and optimization
Coordination traces SHALL be queryable for pattern detection and automated optimization recommendations.

#### Scenario: Detect optimal vessel routing strategy
- **WHEN** backend analyzes registry routing traces over time window
- **THEN** system SHALL identify:
  - Best performing routing strategy per impulse type
  - Health score threshold correlation with success rate
  - Load distribution effectiveness across vessels
  - Geographic latency patterns (if multi-region)
  - Recommended routing configuration updates

#### Scenario: Learn circuit breaker thresholds
- **WHEN** backend analyzes circuit breaker traces
- **THEN** system SHALL identify:
  - Optimal failure threshold before circuit opens
  - Optimal cooldown period for recovery attempts
  - Correlation between circuit events and vessel health
  - False positive rate: circuits that opened unnecessarily
  - Recommended threshold adjustments per vessel type

#### Scenario: Optimize batch resolution strategies
- **WHEN** backend analyzes impulse resolution traces
- **THEN** system SHALL identify:
  - Optimal batch sizes for different impulse types
  - Impulse types that benefit from batching
  - Impulse types that perform better individually
  - Timeout threshold effectiveness
  - Recommended batching configuration

#### Scenario: Predict coordination failures
- **WHEN** backend detects pattern in coordination traces
- **THEN** system SHALL:
  - Identify precursor signals to coordination failures
  - Generate early warning before vessel becomes unavailable
  - Recommend proactive circuit breaker engagement
  - Suggest preventive vessel restarts or scaling
  - Alert operators to degrading coordination paths

### Requirement: Trace storage is optimized for high volume
Coordination traces SHALL be stored efficiently to handle high-frequency vessel communication without performance degradation.

#### Scenario: Trace sampling for high-frequency operations
- **WHEN** vessel coordination generates more than 1000 traces per minute
- **THEN** system SHALL:
  - Sample routine successful operations (e.g., 1% sampling rate)
  - Always capture all failures regardless of volume
  - Always capture first occurrence of new trace patterns
  - Store aggregated metrics (counts, averages) for sampled traces
  - Preserve ability to reconstruct activity coordination timeline

#### Scenario: Trace retention policy
- **WHEN** coordination traces accumulate over time
- **THEN** system SHALL:
  - Retain raw traces for 7 days with full detail
  - Aggregate to hourly summaries after 7 days
  - Retain hourly summaries for 90 days
  - Archive pattern-significant traces indefinitely
  - Delete routine successful traces after retention period

#### Scenario: Trace compression for storage
- **WHEN** storing coordination traces
- **THEN** system SHALL:
  - Compress repeated data (vessel IDs, error messages)
  - Use time-series optimized storage format
  - Index only queryable fields (trace_type, outcome, vessel_id)
  - Stream large trace batches instead of loading all in memory
  - Support efficient range queries by timestamp

#### Scenario: Trace query performance
- **WHEN** dashboard queries coordination traces
- **THEN** system SHALL:
  - Return results within 200ms for time-range queries
  - Support pagination for large result sets
  - Enable filtering by multiple dimensions without full scan
  - Cache frequently accessed trace aggregations
  - Use materialized views for common analytics queries
