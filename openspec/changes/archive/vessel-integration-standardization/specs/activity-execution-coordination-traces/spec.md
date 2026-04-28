# Specification: Activity Execution - Coordination Traces

## MODIFIED Capability

This specification documents **modifications** to the existing `activity-execution` capability to add comprehensive tracing for all vessel coordination activities.

**Previous behavior:** Activity execution traces captured:
- Task execution details
- Tool calls and results
- Success/failure status
- Duration and cost

**New behavior:** Activity execution traces ALSO capture:
- Impulse resolution routing decisions
- Vessel-to-vessel communication performance
- Circuit breaker state transitions
- Health-based vessel selection
- Discovery query results
- Fallback path usage

---

## Foundation Alignment

This modification ensures that all vessel coordination activities are traced and available for learning, enabling the backend to optimize routing strategies, circuit breaker thresholds, and vessel selection algorithms based on actual execution patterns.

---

## MODIFIED Requirements

### Requirement: Execution trace includes resolved_by_vessel_id field

All execution traces SHALL record which vessel resolved each impulse for performance analysis.

#### Scenario: Trace records vessel that resolved impulse
- **WHEN** activity execution resolves impulse via Analysis-API vessel
- **THEN** execution trace SHALL include `resolved_by_vessel_id: "analysis-api-abc123"`
- **AND** impulse metadata SHALL include `resolver_vessel: "analysis-api-abc123"`
- **AND** backend can query all impulses resolved by specific vessel

#### Scenario: Multiple impulses resolved by different vessels
- **WHEN** activity execution resolves 5 impulses via 3 different vessels
- **THEN** execution trace SHALL include array:
  ```json
  "impulse_resolutions": [
    {"impulse_id": "imp-1", "resolved_by_vessel_id": "analysis-api-abc", "duration_ms": 234},
    {"impulse_id": "imp-2", "resolved_by_vessel_id": "local", "duration_ms": 12},
    {"impulse_id": "imp-3", "resolved_by_vessel_id": "analysis-api-abc", "duration_ms": 198},
    {"impulse_id": "imp-4", "resolved_by_vessel_id": "identity-api-xyz", "duration_ms": 87},
    {"impulse_id": "imp-5", "resolved_by_vessel_id": "local", "duration_ms": 8}
  ]
  ```

#### Scenario: Local resolver recorded as vessel_id
- **WHEN** impulse is resolved using local in-process resolver
- **THEN** execution trace SHALL record `resolved_by_vessel_id: "local"`
- **AND** this enables distinguishing local vs remote resolution in analytics

#### Scenario: Backend routing recorded with target vessel
- **WHEN** impulse is resolved via backend routing fallback
- **THEN** execution trace SHALL record:
  - `resolution_tier: "backend_routing"`
  - `resolved_by_vessel_id: "{actual vessel backend routed to}"`
  - `routed_via_backend: true`

### Requirement: Execution trace includes impulse_resolutions array

All execution traces SHALL include detailed resolution tracking for each impulse.

#### Scenario: Resolution array includes timing breakdown
- **WHEN** activity resolves 3 impulses
- **THEN** `impulse_resolutions` array SHALL include for each impulse:
  - `impulse_id`: UUID of impulse
  - `shape`: Impulse shape type (e.g., "error_log")
  - `resolver_vessel`: Vessel ID that resolved it
  - `resolution_tier`: "local" | "vessel_direct" | "backend_routing"
  - `duration_ms`: Total resolution time
  - `network_latency_ms`: Time spent in network (if remote)
  - `cache_hit`: Whether resolution used cache
  - `retry_count`: Number of retries (0 if first attempt succeeded)
  - `success`: Boolean indicating resolution success

#### Scenario: Resolution array includes error details
- **WHEN** impulse resolution fails
- **THEN** array entry SHALL include:
  - `success: false`
  - `error_code`: Standardized error code (e.g., "TIMEOUT", "CIRCUIT_OPEN")
  - `error_message`: Human-readable error description
  - `fallback_used`: Whether fallback tier was attempted
  - `final_outcome`: "resolved_via_fallback" | "failed_all_tiers"

#### Scenario: Resolution array preserves execution order
- **WHEN** activity resolves impulses in specific order
- **THEN** `impulse_resolutions` array SHALL preserve that order
- **AND** array index reflects resolution sequence
- **AND** enables analyzing impulse dependency patterns

### Requirement: Routing trace records stored separately

Vessel routing decisions SHALL be stored in dedicated `routing_trace` records linked to activity execution.

#### Scenario: Routing trace created for each discovery query
- **WHEN** MiniBob queries discovery for capable vessels
- **THEN** system SHALL create `routing_trace` record with:
  - `trace_id`: UUID linking to activity execution
  - `impulse_id`: Impulse being routed
  - `shape`: Impulse shape queried
  - `discovery_query_duration_ms`: Time to query discovery
  - `candidates`: Array of vessel IDs returned by discovery
  - `health_scores`: Current health score for each candidate
  - `circuit_states`: Circuit breaker state for each candidate
  - `excluded_vessels`: Vessels filtered out (with reasons)
  - `selected_vessel_id`: Final chosen vessel
  - `selection_algorithm`: "health_weighted" | "round_robin" | "random"
  - `selection_probability`: Probability of selected vessel (if Thompson Sampling)

#### Scenario: Routing trace records fallback path
- **WHEN** direct vessel resolution fails and fallback used
- **THEN** routing trace SHALL include:
  - `direct_attempt_failed: true`
  - `direct_failure_reason`: Error code from direct attempt
  - `fallback_tier_used: "backend_routing"`
  - `fallback_vessel_id`: Vessel backend routed to
  - `fallback_success: true/false`

#### Scenario: Routing trace linked to activity execution
- **WHEN** activity execution trace is stored
- **THEN** all related routing traces SHALL include `activity_execution_id`
- **AND** backend can query all routing decisions for specific activity
- **AND** dashboard can display routing timeline for activity

### Requirement: Circuit breaker trace records state transitions

All circuit breaker state transitions SHALL be recorded in `circuit_breaker_trace` records.

#### Scenario: Circuit breaker opens
- **WHEN** vessel failures reach threshold and circuit opens
- **THEN** system SHALL create `circuit_breaker_trace` with:
  - `trace_id`: UUID
  - `vessel_id`: Vessel whose circuit opened
  - `event`: "opened"
  - `previous_state`: "closed"
  - `trigger_type`: "consecutive_failures" | "failure_rate_threshold"
  - `consecutive_failures`: Count if trigger was consecutive
  - `failure_rate`: Rate if trigger was rate threshold
  - `failure_window_ms`: Time window for rate calculation
  - `health_score_before`: Health score before opening
  - `cooldown_period_ms`: Duration before half-open attempt
  - `timestamp`: ISO 8601 timestamp
  - `caused_by_activity_id`: Activity execution that triggered opening (if applicable)

#### Scenario: Circuit breaker transitions to half-open
- **WHEN** cooldown period expires and circuit enters half-open
- **THEN** system SHALL create trace with:
  - `event`: "half_open"`
  - `previous_state`: "open"
  - `time_in_open_state_ms`: Duration circuit was open
  - `probe_request_planned`: true
  - `timestamp`: When half-open state entered

#### Scenario: Circuit breaker closes after recovery
- **WHEN** half-open probe succeeds and circuit closes
- **THEN** system SHALL create trace with:
  - `event`: "closed"`
  - `previous_state`: "half_open"
  - `probe_request_succeeded`: true
  - `health_score_after`: New health score
  - `vessel_eligible_for_routing`: true
  - `timestamp`: When circuit closed

#### Scenario: Circuit breaker reopens after failed probe
- **WHEN** half-open probe fails and circuit reopens
- **THEN** system SHALL create trace with:
  - `event`: "reopened"`
  - `previous_state`: "half_open"
  - `probe_request_failed`: true
  - `probe_error_code`: Error from failed probe
  - `new_cooldown_period_ms`: Exponentially increased cooldown
  - `timestamp`: When circuit reopened

### Requirement: Health score updates are traced

Vessel health score changes SHALL be recorded with context explaining the change.

#### Scenario: Health score decreases after failure
- **WHEN** vessel resolution fails and health score decreases
- **THEN** system SHALL record in execution trace:
  - `health_score_change`: {"before": 0.85, "after": 0.72, "delta": -0.13}
  - `change_reason`: "resolution_failure"
  - `failure_details`: Error code and message
  - `new_routing_eligibility`: true/false (if score drops below threshold)

#### Scenario: Health score increases after success
- **WHEN** vessel resolution succeeds and health score increases
- **THEN** system SHALL record:
  - `health_score_change`: {"before": 0.72, "after": 0.78, "delta": +0.06}
  - `change_reason`: "resolution_success"
  - `success_duration_ms`: Resolution time
  - `consecutive_successes`: Count of recent successes

#### Scenario: Health score updated from heartbeat
- **WHEN** vessel sends heartbeat with metrics
- **THEN** system SHALL record:
  - `health_score_change`: {"before": 0.78, "after": 0.81, "delta": +0.03}
  - `change_reason`: "heartbeat_received"
  - `heartbeat_metrics`: Vessel-reported metrics
  - `availability_factor`: Heartbeat freshness contribution

### Requirement: Coordination traces use standardized schema

All coordination-related traces SHALL follow consistent schema for aggregation and analysis.

#### Scenario: Trace includes correlation fields
- **WHEN** any coordination trace is created
- **THEN** trace SHALL include:
  - `trace_type`: "routing" | "circuit_breaker" | "health_update" | "vessel_communication"
  - `correlation_id`: UUID linking related coordination events
  - `activity_execution_id`: Parent activity execution (if applicable)
  - `session_id`: User session (if applicable)
  - `timestamp`: ISO 8601 with millisecond precision
  - `source_vessel_id`: Vessel initiating coordination
  - `target_vessel_id`: Vessel being coordinated with (if applicable)

#### Scenario: Trace includes performance metrics
- **WHEN** coordination trace captures timing
- **THEN** trace SHALL include:
  - `duration_ms`: Total coordination operation time
  - `network_latency_ms`: Network transit time (if measurable)
  - `processing_time_ms`: Target vessel processing time
  - `queue_time_ms`: Time waiting in queue (if queued)
  - `retry_count`: Number of retries
  - `data_size_bytes`: Payload size

#### Scenario: Trace includes outcome classification
- **WHEN** coordination operation completes
- **THEN** trace SHALL include:
  - `outcome`: "success" | "failure" | "timeout" | "circuit_open" | "fallback"
  - `error_type`: Classification if not success
  - `error_code`: Standardized error code
  - `error_details`: Structured error information
  - `fallback_used`: Boolean indicating fallback path
  - `impact_on_activity`: "success" | "degraded" | "failed"

### Requirement: Trace sampling for high-volume coordination

System SHALL implement sampling to manage trace volume without losing critical information.

#### Scenario: Always trace failures and state transitions
- **WHEN** coordination operation fails OR circuit breaker state changes
- **THEN** system SHALL create full trace record (100% sampling)
- **AND** trace SHALL never be sampled out
- **AND** all failure patterns are preserved for learning

#### Scenario: Sample routine successes
- **WHEN** coordination operation succeeds routinely (no errors, no retries)
- **THEN** system SHALL sample at configurable rate (default 10%)
- **AND** sampled traces provide statistical representation
- **AND** unsampled operations still update aggregated metrics

#### Scenario: Always trace first occurrence of pattern
- **WHEN** system detects new coordination pattern (new vessel, new shape, new error code)
- **THEN** system SHALL create full trace regardless of sampling
- **AND** subsequent occurrences of same pattern follow sampling rules
- **AND** pattern detection enables learning from new behaviors

#### Scenario: Aggregated metrics for sampled traces
- **WHEN** traces are sampled
- **THEN** system SHALL maintain aggregate metrics:
  - Total count (including unsampled)
  - Success rate
  - Average duration
  - P50, P95, P99 latency
  - Error rate by error code
- **AND** aggregates updated for all operations (sampled or not)

### Requirement: Trace retention and archival

Coordination traces SHALL follow retention policy optimized for storage and queryability.

#### Scenario: Raw traces retained for 7 days
- **WHEN** coordination trace is created
- **THEN** full detail stored for 7 days
- **AND** all fields queryable
- **AND** enables debugging recent issues

#### Scenario: Aggregation to hourly summaries after 7 days
- **WHEN** trace is older than 7 days
- **THEN** system SHALL aggregate to hourly summary:
  - Hour timestamp
  - Trace type and operation
  - Count, success rate, avg duration
  - Error code distribution
- **AND** raw trace deleted after aggregation
- **AND** hourly summaries retained for 90 days

#### Scenario: Preserve significant patterns indefinitely
- **WHEN** trace represents significant pattern (first failure, circuit breaker open, new vessel)
- **THEN** trace SHALL be marked `preserve: true`
- **AND** trace SHALL NOT be deleted after 7 days
- **AND** enables long-term pattern analysis

---

## Schema Extensions

### Activity Execution Trace (Extended)

**New fields:**

```typescript
interface ActivityExecutionTrace {
  // ... existing fields ...

  // NEW: Vessel coordination fields
  resolved_by_vessel_id?: string  // Primary vessel used
  impulse_resolutions: Array<{
    impulse_id: string
    shape: string
    resolver_vessel: string
    resolution_tier: "local" | "vessel_direct" | "backend_routing"
    duration_ms: number
    network_latency_ms?: number
    cache_hit: boolean
    retry_count: number
    success: boolean
    error_code?: string
    error_message?: string
    fallback_used?: boolean
  }>
  coordination_summary: {
    total_vessels_contacted: number
    routing_decisions: number
    circuit_breaker_events: number
    fallback_paths_used: number
    total_coordination_time_ms: number
  }
}
```

### Routing Trace Schema

```typescript
interface RoutingTrace {
  trace_id: string
  trace_type: "routing"
  correlation_id: string
  activity_execution_id?: string
  timestamp: string  // ISO 8601

  // Routing details
  impulse_id: string
  shape: string
  discovery_query_duration_ms: number
  candidates: string[]  // vessel IDs
  health_scores: Record<string, number>
  circuit_states: Record<string, "closed" | "open" | "half_open">
  excluded_vessels: Array<{vessel_id: string, reason: string}>
  selected_vessel_id: string
  selection_algorithm: string
  selection_probability?: number

  // Outcome
  outcome: string
  direct_attempt_failed?: boolean
  direct_failure_reason?: string
  fallback_tier_used?: string
  fallback_vessel_id?: string
  fallback_success?: boolean
}
```

### Circuit Breaker Trace Schema

```typescript
interface CircuitBreakerTrace {
  trace_id: string
  trace_type: "circuit_breaker"
  correlation_id: string
  timestamp: string  // ISO 8601

  // Circuit details
  vessel_id: string
  event: "opened" | "half_open" | "closed" | "reopened"
  previous_state: string
  trigger_type?: string
  consecutive_failures?: number
  failure_rate?: number
  failure_window_ms?: number
  health_score_before?: number
  health_score_after?: number
  cooldown_period_ms?: number
  probe_request_succeeded?: boolean
  probe_request_failed?: boolean
  probe_error_code?: string

  // Context
  caused_by_activity_id?: string
  vessel_eligible_for_routing: boolean
}
```

---

## Dashboard Visualization Requirements

### Activity Execution Detail View

**New sections to add:**

1. **Coordination Timeline**
   - Visual timeline showing all vessel coordination events
   - Color-coded by outcome (green=success, red=failure, yellow=fallback)
   - Tooltips showing trace details on hover

2. **Impulse Resolution Breakdown**
   - Table showing each impulse with resolver vessel, duration, and tier
   - Sortable by duration, vessel, outcome
   - Filter by resolution tier

3. **Circuit Breaker Events**
   - List of circuit breaker state transitions during activity
   - Link to affected vessels
   - Impact analysis (did it cause fallback?)

4. **Vessel Communication Graph**
   - Node-edge graph showing vessel interactions
   - Edge thickness = number of calls
   - Edge color = success rate

---

## Testing Requirements

### Unit Tests
- Trace field population for each coordination type
- Sampling logic (always sample failures, 10% successes)
- Trace retention policy enforcement
- Schema validation for all trace types

### Integration Tests
- End-to-end activity with multiple coordination events
- Trace linkage (activity → routing → circuit breaker)
- Dashboard query performance with large trace volume
- Aggregate metric calculation accuracy

### Performance Tests
- Trace storage performance under high coordination volume (1000 traces/min)
- Query performance for activity coordination timeline
- Aggregation job performance (7-day → hourly summary)

---

## Success Metrics

- **100% of coordination events traced** (all routing, circuit breaker, health updates)
- **< 5ms overhead** per trace creation (non-blocking writes)
- **All traces queryable within 200ms** for time-range queries
- **Dashboard displays coordination timeline** for any activity execution
- **Learning loop uses coordination traces** for routing optimization

---

## Related Capabilities

- `impulse-resolution-vessel-direct`: Generates impulse resolution traces
- `cross-vessel-protocol`: Generates vessel communication traces
- `vessel-discovery`: Generates routing decision traces
- `execution-tracing-integration`: Provides base tracing infrastructure
