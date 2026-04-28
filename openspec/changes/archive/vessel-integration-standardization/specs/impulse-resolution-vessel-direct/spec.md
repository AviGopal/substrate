# Specification: Impulse Resolution - Vessel Direct

## MODIFIED Capability

This specification documents **modifications** to the existing `impulse-resolution` capability to support direct vessel-to-vessel resolution via discovery protocol.

**Previous behavior:** MiniBob resolved impulses in two ways:
1. Local resolvers (`memo`, `file`) - handled in-process
2. Backend-mediated resolution - all other types routed through Activity-API

**New behavior:** MiniBob resolves impulses in three ways:
1. Local resolvers (`memo`, `file`) - handled in-process
2. **Direct vessel resolution** - query discovery for capable vessel, call directly via HTTP
3. Backend-routing fallback - when no direct vessel available or circuit breaker open

---

## Foundation Alignment

This modification strengthens the "resolvers live where data lives" principle by enabling vessels to discover and communicate directly, without requiring the backend to act as a universal proxy.

---

## MODIFIED Requirements

### Requirement: Three-tier impulse resolution fallback chain

MiniBob SHALL attempt impulse resolution using a three-tier fallback strategy.

#### Scenario: Local resolution attempted first
- **WHEN** MiniBob receives impulse with pointer type `memo` or `file`
- **THEN** MiniBob SHALL resolve using local in-process resolver
- **AND** SHALL NOT query discovery or backend

#### Scenario: Direct vessel resolution attempted second
- **WHEN** local resolution is not applicable (impulse type not `memo` or `file`)
- **THEN** MiniBob SHALL query discovery service: `GET /v2/vessels/discover?shape={impulse.pointer.type}`
- **AND** discovery SHALL return list of vessels advertising capability for that shape
- **AND** MiniBob SHALL select vessel using health-based routing
- **AND** MiniBob SHALL call vessel directly: `POST {vesselEndpoint}/v2/impulses/resolve`

#### Scenario: Backend routing attempted third (fallback)
- **WHEN** direct vessel resolution fails (no vessels found, all circuits open, or timeout)
- **THEN** MiniBob SHALL fall back to backend routing: `POST {activityApiEndpoint}/v2/impulses/resolve`
- **AND** backend SHALL perform vessel discovery and routing on behalf of MiniBob
- **AND** trace SHALL record `fallback_reason` (e.g., "circuit_open", "no_vessels", "discovery_unavailable")

#### Scenario: All tiers fail
- **WHEN** local, direct vessel, and backend fallback all fail
- **THEN** MiniBob SHALL mark impulse as `loaded: false` with error
- **AND** error SHALL include details from all three attempts
- **AND** trace SHALL record full resolution attempt chain

### Requirement: Discovery query for vessel selection

MiniBob SHALL query discovery service to find vessels capable of resolving impulse shapes.

#### Scenario: Discovery returns multiple capable vessels
- **WHEN** MiniBob queries discovery for shape `error_log`
- **AND** discovery returns 3 vessels advertising `error_log` capability
- **THEN** MiniBob SHALL filter vessels by circuit breaker state (exclude vessels with open circuits)
- **AND** MiniBob SHALL select vessel using health score weighting (higher health score = higher probability)
- **AND** MiniBob SHALL record selection decision in trace with candidates and scores

#### Scenario: Discovery returns no capable vessels
- **WHEN** MiniBob queries discovery for shape `custom_analyzer`
- **AND** discovery returns empty array
- **THEN** MiniBob SHALL skip direct vessel resolution tier
- **AND** MiniBob SHALL immediately attempt backend routing fallback
- **AND** trace SHALL record `no_vessels_found` for direct resolution attempt

#### Scenario: Discovery query timeout
- **WHEN** MiniBob queries discovery service
- **AND** discovery does not respond within 2 seconds
- **THEN** MiniBob SHALL abort discovery query
- **AND** MiniBob SHALL fall back to backend routing
- **AND** trace SHALL record `discovery_timeout` as fallback reason

#### Scenario: Discovery service unavailable
- **WHEN** MiniBob cannot reach discovery service (connection refused, network error)
- **THEN** MiniBob SHALL log warning about discovery unavailability
- **AND** MiniBob SHALL skip direct vessel resolution tier
- **AND** MiniBob SHALL use backend routing as fallback
- **AND** MiniBob SHALL NOT cache discovery unavailability (retry on next impulse)

### Requirement: Direct vessel HTTP call with authentication

MiniBob SHALL make authenticated HTTP calls to selected vessels for impulse resolution.

#### Scenario: Successful direct vessel call
- **WHEN** MiniBob calls vessel at `https://analysis.metabob.com/v2/impulses/resolve`
- **THEN** request SHALL include header `Authorization: ApiKey {minibob.apiKey}`
- **AND** request SHALL include header `X-Protocol-Version: 2.0`
- **AND** request body SHALL match standard impulse resolution format
- **AND** MiniBob SHALL await response within timeout (5 seconds)
- **AND** successful response SHALL populate impulse with `loaded: true` and content

#### Scenario: Direct vessel call with mTLS (vessel-to-vessel)
- **WHEN** MiniBob configuration includes `vessels.analysis.mtls` section
- **THEN** MiniBob SHALL establish TLS connection with client certificate
- **AND** MiniBob SHALL verify server certificate against vessel CA
- **AND** MiniBob SHALL include API key header in addition to mTLS

#### Scenario: Direct vessel call timeout
- **WHEN** vessel does not respond within 5 seconds
- **THEN** MiniBob SHALL abort request
- **AND** MiniBob SHALL increment circuit breaker failure count for that vessel
- **AND** MiniBob SHALL fall back to backend routing
- **AND** trace SHALL record timeout duration and fallback action

#### Scenario: Direct vessel call returns error
- **WHEN** vessel returns 4xx or 5xx HTTP status
- **THEN** MiniBob SHALL parse error response for retry guidance
- **AND** MiniBob SHALL retry if error is retryable (503, network timeout)
- **AND** MiniBob SHALL NOT retry if error is non-retryable (400, 422, 401)
- **AND** MiniBob SHALL fall back to backend routing after retry exhaustion
- **AND** trace SHALL record error details and retry attempts

### Requirement: Circuit breaker integration

MiniBob SHALL maintain circuit breaker state for each vessel and exclude vessels with open circuits from selection.

#### Scenario: Circuit breaker prevents vessel selection
- **WHEN** MiniBob queries discovery and receives 3 capable vessels
- **AND** vessel A has circuit breaker state OPEN
- **THEN** MiniBob SHALL exclude vessel A from selection candidates
- **AND** MiniBob SHALL only consider vessels B and C
- **AND** trace SHALL record `circuit_open_exclusions: ["vessel-a-id"]`

#### Scenario: All vessels have open circuits
- **WHEN** MiniBob queries discovery and all returned vessels have open circuits
- **THEN** MiniBob SHALL skip direct vessel resolution tier
- **AND** MiniBob SHALL immediately fall back to backend routing
- **AND** trace SHALL record `all_circuits_open` as fallback reason

#### Scenario: Circuit opens after direct call failure
- **WHEN** MiniBob calls vessel directly and receives 5 consecutive failures
- **THEN** MiniBob SHALL transition circuit breaker to OPEN state
- **AND** MiniBob SHALL exclude that vessel from future selections
- **AND** MiniBob SHALL use backend routing as fallback for current impulse
- **AND** trace SHALL record circuit breaker state transition

### Requirement: Execution trace includes resolution path

All impulse resolutions SHALL record which tier (local, direct, fallback) successfully resolved the impulse.

#### Scenario: Trace records direct vessel resolution
- **WHEN** impulse is resolved via direct vessel call
- **THEN** trace SHALL include:
  - `resolution_tier: "vessel_direct"`
  - `resolved_by_vessel_id: "analysis-api-abc123"`
  - `discovery_candidates: ["vessel-a", "vessel-b", "vessel-c"]`
  - `selection_reason: "health_score_weighted"`
  - `direct_call_duration_ms: 234`

#### Scenario: Trace records backend fallback
- **WHEN** direct vessel resolution fails and backend fallback succeeds
- **THEN** trace SHALL include:
  - `resolution_tier: "backend_routing"`
  - `fallback_reason: "circuit_open"`
  - `direct_attempt_failed: true`
  - `direct_attempt_errors: [...]`
  - `backend_routed_to_vessel_id: "analysis-api-xyz456"`

#### Scenario: Trace records local resolution
- **WHEN** impulse is resolved via local resolver
- **THEN** trace SHALL include:
  - `resolution_tier: "local"`
  - `local_resolver_type: "file"`
  - `no_discovery_query: true`
  - `local_resolution_duration_ms: 12`

---

## Configuration Changes

### MiniBob Configuration Schema

**New fields added:**

```json
{
  "discovery": {
    "endpoint": "https://activity.metabob.com",
    "timeout_ms": 2000,
    "enabled": true
  },
  "vessels": {
    "analysis": {
      "endpoint": "https://analysis.metabob.com",
      "apiKey": "${ANALYSIS_API_KEY}",
      "mtls": {
        "enabled": true,
        "cert": "/etc/minibob/tls/client.crt",
        "key": "/etc/minibob/tls/client.key",
        "ca": "/etc/minibob/tls/ca.crt"
      },
      "circuitBreaker": {
        "failureThreshold": 5,
        "timeoutMs": 30000
      }
    }
  },
  "fallback": {
    "useBackendRouting": true,
    "preferDirectResolution": true
  }
}
```

**Configuration validation:**
- MiniBob SHALL validate discovery endpoint is reachable on startup
- MiniBob SHALL warn if mTLS certificates are expired or invalid
- MiniBob SHALL allow disabling discovery via `discovery.enabled: false`
- MiniBob SHALL fall back to backend routing if discovery disabled

---

## Resolution Flow Diagram

```
Impulse needs resolution
    ↓
Is type "memo" or "file"?
    ↓ YES
[Local Resolver] → Success → Done
    ↓ NO
Query Discovery: GET /v2/vessels/discover?shape={type}
    ↓
Discovery returns vessels?
    ↓ YES
Filter by circuit breaker state
    ↓
Any vessels available?
    ↓ YES
Select vessel using health scores
    ↓
POST {vessel}/v2/impulses/resolve
    ↓
Success?
    ↓ YES
[Mark impulse loaded] → Done
    ↓ NO (or NO from discovery/filter)
[Fallback: Backend Routing]
    ↓
POST {backend}/v2/impulses/resolve
    ↓
Backend routes to vessel on behalf of MiniBob
    ↓
Success?
    ↓ YES
[Mark impulse loaded] → Done
    ↓ NO
[Mark impulse failed] → Done
```

---

## Migration Impact

### Breaking Changes
- **NONE** - This is a purely additive modification. Existing behavior (backend routing) remains as fallback tier.

### Backward Compatibility
- MiniBob without discovery configuration will skip direct vessel tier and use backend routing
- Existing impulse resolution logic remains unchanged as the fallback path
- All existing tests continue to pass with default configuration

### Rollback Strategy
- Set `discovery.enabled: false` in MiniBob config to disable direct vessel resolution
- MiniBob will skip tier 2 and go directly from local → backend routing
- No code changes required for rollback

---

## Testing Requirements

### Unit Tests
- Discovery query formatting
- Vessel selection logic with health scores
- Circuit breaker state filtering
- Fallback tier transitions
- Trace recording for each tier

### Integration Tests
- End-to-end local → direct → fallback chain
- Discovery service unavailable handling
- All circuits open fallback
- Direct vessel timeout and retry
- mTLS authentication (if enabled)

### Performance Tests
- Discovery query latency impact
- Direct vessel call vs backend routing comparison
- Circuit breaker overhead measurement

---

## Related Capabilities

- `vessel-discovery`: Provides the discovery endpoints queried by MiniBob
- `cross-vessel-protocol`: Defines the HTTP API for direct vessel calls
- `vessel-authentication`: Specifies mTLS + API key authentication
- `execution-tracing-integration`: Extends traces to record resolution tier
- `analysis-api-direct-integration`: Specific implementation for Analysis-API vessel

---

## Success Metrics

- **> 80% of impulses** resolved via direct vessel tier (not fallback)
- **< 100ms added latency** from discovery query overhead
- **Circuit breaker false positive rate < 1%** (vessels incorrectly excluded)
- **Zero regressions** in existing impulse resolution behavior
- **100% trace coverage** of resolution tier decisions
