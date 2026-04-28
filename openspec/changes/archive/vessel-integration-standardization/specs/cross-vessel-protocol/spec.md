# Cross-Vessel Protocol Specification

**Capability:** cross-vessel-protocol
**Purpose:** Define HTTP API specification for vessel-to-vessel communication with circuit breaker pattern, enabling direct impulse resolution between vessels without backend mediation.

---

## Design Principles

1. **Resolvers Live Where Data Lives** - Vessels resolve impulses they have access to directly
2. **Metadata First, Content Later** - Protocol operates on impulse metadata for routing decisions
3. **Fail Fast, Learn Later** - Circuit breaker prevents cascade failures, traces inform learning
4. **Trace Everything** - All routing decisions, state transitions, and resolution attempts are recorded
5. **Trust But Verify** - mTLS + API key authentication for vessel-to-vessel communication

## Field Naming Convention

- **Database/SurrealDB schema**: `snake_case` (e.g., `vessel_id`, `org_id`, `created_at`)
- **HTTP API JSON requests/responses**: `camelCase` (e.g., `vesselId`, `orgId`, `createdAt`)
- **Transformation**: Vessels convert between naming conventions at boundaries (DB ↔ API)

---

## ADDED Requirements

### Requirement: HTTP API specification for impulse resolution

Vessels SHALL expose a standard HTTP endpoint for resolving impulses that they advertise capability for.

#### Scenario: Vessel receives resolution request

- **WHEN** a vessel receives `POST /v2/impulses/resolve` with a valid impulse pointer
- **THEN** the vessel SHALL attempt to resolve the impulse and return the loaded content within 5 seconds or return an error

#### Scenario: Resolution request format validation

- **WHEN** a vessel receives `POST /v2/impulses/resolve` with missing required fields (`type`, `pointer`)
- **THEN** the vessel SHALL return `400 Bad Request` with error details listing the missing fields

#### Scenario: Unsupported impulse type

- **WHEN** a vessel receives resolution request for impulse type it does not advertise capability for
- **THEN** the vessel SHALL return `422 Unprocessable Entity` with message "Impulse type not supported by this vessel"

#### Scenario: Successful impulse resolution

- **WHEN** Analysis-API receives request to resolve `{ type: "codebase:defect-location", pointer: { file_path: "auth.ts", line_range: [42, 58] } }`
- **THEN** Analysis-API SHALL return `200 OK` with `{ loaded: true, content: { analysis: {...}, suggestions: [...] }, metadata: {...} }`

#### Scenario: Resolution timeout

- **WHEN** a vessel takes longer than 5 seconds to resolve an impulse
- **THEN** the calling vessel SHALL abort the request, record timeout in execution trace, and return error to caller

### Requirement: Request format standardization

All vessel-to-vessel impulse resolution requests SHALL use a standardized JSON format.

#### Scenario: Request includes required fields

- **WHEN** MiniBob sends impulse resolution request to Analysis-API
- **THEN** the request body SHALL include `{ impulse_id: string, type: string, pointer: object, budget?: number, priority?: string, context?: object }`

#### Scenario: Response includes resolution metadata

- **WHEN** a vessel successfully resolves an impulse
- **THEN** the response SHALL include `{ loaded: boolean, content: any, metadata: { resolved_by: string, resolution_time_ms: number, resolver_version: string, cache_hit?: boolean } }`

#### Scenario: Error response standardization

- **WHEN** a vessel fails to resolve an impulse
- **THEN** the response SHALL be `{ loaded: false, error: { code: string, message: string, details?: any, retry_after_ms?: number } }`

### Requirement: Circuit breaker state machine

Vessels SHALL implement circuit breaker pattern with three states (CLOSED, OPEN, HALF_OPEN) for each remote vessel they communicate with.

#### Scenario: Initial state is CLOSED

- **WHEN** MiniBob first communicates with Analysis-API
- **THEN** the circuit breaker SHALL initialize in CLOSED state allowing all requests through

#### Scenario: Transition to OPEN on failure threshold

- **WHEN** EITHER 5 consecutive failures occur OR failure rate ≥ 50% over 60-second window
- **THEN** the circuit breaker SHALL transition to OPEN state and reject all requests without attempting

#### Scenario: OPEN state rejects requests immediately

- **WHEN** circuit breaker is in OPEN state and a resolution request is made
- **THEN** the circuit breaker SHALL return error immediately without network call: `{ error: { code: "CIRCUIT_OPEN", message: "Circuit breaker open for vessel <name>", retry_after_ms: <timeout> } }`

#### Scenario: Automatic transition to HALF_OPEN after timeout

- **WHEN** circuit breaker has been in OPEN state for 30 seconds (configurable)
- **THEN** the circuit breaker SHALL automatically transition to HALF_OPEN state

#### Scenario: HALF_OPEN allows single test request

- **WHEN** circuit breaker is in HALF_OPEN state and a resolution request is made
- **THEN** the circuit breaker SHALL allow exactly one request through and queue subsequent requests

#### Scenario: Successful HALF_OPEN request closes circuit

- **WHEN** the test request in HALF_OPEN state succeeds
- **THEN** the circuit breaker SHALL transition to CLOSED state and process queued requests

#### Scenario: Failed HALF_OPEN request reopens circuit

- **WHEN** the test request in HALF_OPEN state fails
- **THEN** the circuit breaker SHALL transition back to OPEN state with exponential backoff (60s timeout)

### Requirement: Circuit breaker configuration

Circuit breaker thresholds SHALL be configurable per vessel with sensible defaults.

#### Scenario: Default configuration loaded

- **WHEN** a vessel starts and no circuit breaker config is provided
- **THEN** the vessel SHALL use defaults: `{ failureThreshold: 5, failureRateThreshold: 0.5, windowMs: 60000, timeoutMs: 30000, halfOpenMaxConcurrency: 1 }`

#### Scenario: Per-vessel configuration override

- **WHEN** vessel config specifies `{ vessels: { "analysis-api": { circuitBreaker: { failureThreshold: 3, timeoutMs: 15000 } } } }`
- **THEN** Analysis-API circuit breaker SHALL use threshold of 3 failures and 15-second timeout, inheriting other defaults

#### Scenario: Configuration validation on startup

- **WHEN** vessel config contains invalid circuit breaker settings (e.g., negative thresholds)
- **THEN** the vessel SHALL fail to start with error message listing invalid configuration fields

### Requirement: Health check endpoint

All vessels SHALL expose a standard health check endpoint for circuit breaker probes.

#### Scenario: Health check endpoint exists

- **WHEN** a circuit breaker sends `GET /v2/health` to a vessel
- **THEN** the vessel SHALL return `200 OK` with `{ status: "healthy", version: string, capabilities: string[], uptime_ms: number }`

#### Scenario: Degraded health state

- **WHEN** a vessel is experiencing issues but still operational (e.g., high latency, partial functionality)
- **THEN** the vessel SHALL return `200 OK` with `{ status: "degraded", details: string }`

#### Scenario: Unhealthy state

- **WHEN** a vessel cannot fulfill its core functions (e.g., database unreachable)
- **THEN** the vessel SHALL return `503 Service Unavailable` with `{ status: "unhealthy", details: string }`

#### Scenario: Health check timeout

- **WHEN** a health check request does not respond within 2 seconds
- **THEN** the calling vessel SHALL treat it as a failure and increment circuit breaker failure count

### Requirement: Retry logic with exponential backoff

Failed resolution requests SHALL be retried with exponential backoff before opening circuit.

#### Scenario: Transient failure triggers retry

- **WHEN** a resolution request fails with `503 Service Unavailable` or network timeout
- **THEN** the vessel SHALL retry up to 3 times with delays: 100ms, 200ms, 400ms

#### Scenario: Non-retryable errors fail immediately

- **WHEN** a resolution request fails with `400 Bad Request` or `422 Unprocessable Entity`
- **THEN** the vessel SHALL NOT retry and return error immediately to caller

#### Scenario: Retry exhaustion records trace

- **WHEN** all 3 retry attempts fail
- **THEN** the vessel SHALL record execution trace with `{ retry_count: 3, failure_reason: string }` and increment circuit breaker failure count

#### Scenario: Successful retry does not count as failure

- **WHEN** first attempt fails but second retry succeeds
- **THEN** the circuit breaker SHALL NOT increment failure count and SHALL record success with `{ retry_count: 1 }`

### Requirement: Authentication for vessel-to-vessel communication

Vessels SHALL authenticate with each other using mTLS + API key.

#### Scenario: mTLS certificate validation

- **WHEN** MiniBob connects to Analysis-API
- **THEN** both vessels SHALL validate each other's TLS certificates against trusted CA

#### Scenario: API key in request headers

- **WHEN** MiniBob sends resolution request to Analysis-API
- **THEN** the request SHALL include header `Authorization: ApiKey <key>` where key is vessel's API key

#### Scenario: Invalid API key rejected

- **WHEN** a vessel receives request with invalid or missing API key
- **THEN** the vessel SHALL return `401 Unauthorized` and SHALL NOT increment circuit breaker failure count (auth failures are not service health issues)

#### Scenario: Expired certificate handling

- **WHEN** a vessel's TLS certificate has expired
- **THEN** connections SHALL fail and circuit breaker SHALL NOT open (requires operator intervention for cert renewal)

### Requirement: Error handling standardization

All vessels SHALL return standardized error codes for common failure modes.

#### Scenario: Error codes defined

- **WHEN** a vessel encounters an error during resolution
- **THEN** the vessel SHALL return one of: `CIRCUIT_OPEN`, `TIMEOUT`, `RESOLVER_ERROR`, `INVALID_POINTER`, `UNSUPPORTED_TYPE`, `AUTHENTICATION_FAILED`, `RATE_LIMITED`, `INTERNAL_ERROR`

#### Scenario: Error includes retry guidance

- **WHEN** a vessel returns `RATE_LIMITED` error
- **THEN** the response SHALL include `retry_after_ms` field indicating when to retry

#### Scenario: Error includes debug context

- **WHEN** a vessel returns `RESOLVER_ERROR` in non-production environment
- **THEN** the response MAY include `details.stack_trace` for debugging

### Requirement: Resolution request tracing

All resolution requests and state transitions SHALL be recorded in execution traces.

#### Scenario: Successful resolution traced

- **WHEN** MiniBob successfully resolves impulse via Analysis-API
- **THEN** execution trace SHALL include `{ resolution: { vessel_id: "analysis-api", duration_ms: 234, cache_hit: false, circuit_state: "CLOSED" } }`

#### Scenario: Circuit breaker state transition traced

- **WHEN** circuit breaker transitions from CLOSED to OPEN
- **THEN** execution trace SHALL include `{ circuit_breaker: { vessel_id: "analysis-api", from: "CLOSED", to: "OPEN", reason: "failure_threshold_exceeded", failure_count: 5, window_ms: 60000 } }`

#### Scenario: Failed resolution traced with error details

- **WHEN** resolution fails with timeout
- **THEN** execution trace SHALL include `{ resolution: { vessel_id: "analysis-api", error: "TIMEOUT", retry_count: 3, circuit_state: "CLOSED" } }`

#### Scenario: Trace includes resolver performance

- **WHEN** a resolution completes (success or failure)
- **THEN** execution trace SHALL record `resolved_by_vessel_id` in impulse metadata for backend performance analysis

### Requirement: Fallback to backend mediation

When direct vessel-to-vessel resolution fails with circuit open, vessels MAY fall back to backend-mediated resolution.

#### Scenario: Circuit open triggers backend fallback

- **WHEN** MiniBob attempts to resolve Analysis-API impulse but circuit is OPEN
- **THEN** MiniBob MAY send resolution request to backend with `{ fallback: true, original_vessel: "analysis-api", circuit_state: "OPEN" }`

#### Scenario: Backend mediates resolution

- **WHEN** backend receives fallback resolution request
- **THEN** backend SHALL attempt to resolve via target vessel and return result to caller (acts as proxy)

#### Scenario: Fallback success does not close circuit

- **WHEN** backend-mediated fallback succeeds
- **THEN** the circuit breaker for direct vessel communication SHALL remain in its current state (circuit health is independent of backend-mediated success)

#### Scenario: No fallback available fails fast

- **WHEN** circuit is OPEN and backend fallback is not configured
- **THEN** MiniBob SHALL return error immediately: `{ error: { code: "CIRCUIT_OPEN", message: "No fallback available", vessel: "analysis-api" } }`

### Requirement: Rate limiting

Vessels SHALL implement rate limiting to prevent resource exhaustion from misbehaving callers.

#### Scenario: Per-vessel rate limits

- **WHEN** Analysis-API receives more than 100 requests per minute from MiniBob instance
- **THEN** Analysis-API SHALL return `429 Too Many Requests` with `{ retry_after_ms: 5000 }`

#### Scenario: Rate limit does not open circuit

- **WHEN** a vessel receives `429 Too Many Requests` response
- **THEN** the circuit breaker SHALL NOT increment failure count (rate limiting is not a service health issue)

#### Scenario: Rate limit headers included

- **WHEN** a vessel responds to any request
- **THEN** the response SHALL include headers: `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`

### Requirement: Content size limits

Resolved impulse content SHALL respect budget constraints to prevent memory exhaustion.

#### Scenario: Budget enforced during resolution

- **WHEN** a resolution request includes `{ budget: 2000 }` (tokens)
- **THEN** the vessel SHALL limit response content to approximately 2000 tokens or return partial result with `{ truncated: true }`

#### Scenario: No budget defaults to maximum

- **WHEN** a resolution request omits budget field
- **THEN** the vessel SHALL apply default maximum budget of 10000 tokens

#### Scenario: Budget exceeded error

- **WHEN** a vessel cannot meaningfully resolve impulse within budget
- **THEN** the vessel SHALL return error: `{ error: { code: "BUDGET_EXCEEDED", message: "Cannot resolve within budget", required_budget: 5000, requested_budget: 2000 } }`

### Requirement: Protocol versioning

The cross-vessel protocol SHALL support versioning to enable evolution without breaking changes.

#### Scenario: Version in request headers

- **WHEN** a vessel sends resolution request
- **THEN** the request SHALL include header `X-Protocol-Version: 2.0`

#### Scenario: Version mismatch handling

- **WHEN** a vessel receives request with unsupported protocol version
- **THEN** the vessel SHALL return `400 Bad Request` with `{ error: { code: "UNSUPPORTED_PROTOCOL_VERSION", supported: ["2.0"], requested: "3.0" } }`

#### Scenario: Backward compatibility

- **WHEN** a vessel receives request with older supported protocol version (e.g., "1.0")
- **THEN** the vessel SHALL process the request using compatibility layer and respond in the requested version format

---

## Request/Response Format Specification

### Resolution Request

```typescript
POST /v2/impulses/resolve
Headers:
  Authorization: ApiKey <vessel-api-key>
  X-Protocol-Version: 2.0
  X-Request-ID: <uuid>
  Content-Type: application/json

{
  impulse_id: string           // UUID for tracking
  type: string                 // e.g., "codebase:defect-location"
  pointer: object              // Type-specific pointer structure
  budget?: number              // Max tokens (default: 10000)
  priority?: "low" | "normal" | "high"
  context?: {                  // Optional context for resolution
    session_id?: string
    trace_id?: string
    caller_vessel_id?: string
  }
}
```

### Successful Resolution Response

```typescript
200 OK
Headers:
  X-RateLimit-Limit: 100
  X-RateLimit-Remaining: 95
  X-RateLimit-Reset: 1678901234
  X-Request-ID: <uuid>

{
  loaded: true
  content: any                 // Resolved impulse content (type-specific)
  metadata: {
    resolved_by: string        // Vessel ID
    resolution_time_ms: number
    resolver_version: string
    cache_hit?: boolean
    truncated?: boolean        // If budget was exceeded
  }
}
```

### Error Response

```typescript
4xx / 5xx
Headers:
  X-Request-ID: <uuid>

{
  loaded: false
  error: {
    code: "TIMEOUT" | "RESOLVER_ERROR" | "INVALID_POINTER" | "UNSUPPORTED_TYPE" | ...
    message: string
    details?: {                // Type-specific error context
      vessel_id?: string
      timeout_ms?: number
      [key: string]: any
    }
    retry_after_ms?: number    // For rate limiting / circuit breaker
  }
}
```

### Health Check

```typescript
GET /v2/health
Headers:
  Authorization: ApiKey <vessel-api-key>

Response 200 OK:
{
  status: "healthy" | "degraded" | "unhealthy"
  version: string              // Vessel version
  capabilities: string[]       // Impulse types this vessel can resolve
  uptime_ms: number
  details?: string             // If degraded/unhealthy
}
```

---

## Circuit Breaker State Machine

```
           [Initial]
              ↓
          [CLOSED] ←──────────┐
              ↓                │
        (failures ≥ threshold) │
              ↓                │
           [OPEN] ─────────────┤
              ↓                │
        (timeout expires)      │
              ↓                │
        [HALF_OPEN]            │
              ↓                │
         (test request)        │
              ↓                │
         ┌────┴────┐          │
    (success)  (failure)      │
         │         │           │
         └─────────┴───────────┘
```

**State Definitions:**

- **CLOSED**: Normal operation, all requests allowed
- **OPEN**: Failure threshold exceeded, all requests rejected immediately
- **HALF_OPEN**: Testing if service has recovered, single test request allowed

**Transition Conditions:**

- CLOSED → OPEN: `failure_count ≥ threshold` OR `failure_rate ≥ rate_threshold`
- OPEN → HALF_OPEN: `time_in_open ≥ timeout_ms`
- HALF_OPEN → CLOSED: Test request succeeds
- HALF_OPEN → OPEN: Test request fails (with exponential backoff)

---

## Error Code Reference

| Code | HTTP Status | Description | Retry? | Circuit Impact |
|------|-------------|-------------|--------|----------------|
| `CIRCUIT_OPEN` | 503 | Circuit breaker open | After timeout | N/A |
| `TIMEOUT` | 504 | Request exceeded 5s | Yes (3x) | +1 failure |
| `RESOLVER_ERROR` | 500 | Internal resolver failure | Yes (3x) | +1 failure |
| `INVALID_POINTER` | 422 | Pointer structure invalid | No | No impact |
| `UNSUPPORTED_TYPE` | 422 | Impulse type not supported | No | No impact |
| `SHAPE_VALIDATION_FAILED` | 422 | Content doesn't match shape schema | No | No impact |
| `AUTHENTICATION_FAILED` | 401 | Invalid API key / cert | No | No impact |
| `RATE_LIMITED` | 429 | Too many requests | After delay | No impact |
| `BUDGET_EXCEEDED` | 422 | Cannot resolve within budget | No | No impact |
| `INTERNAL_ERROR` | 500 | Unexpected error | Yes (3x) | +1 failure |
| `UNSUPPORTED_PROTOCOL_VERSION` | 400 | Protocol version mismatch | No | No impact |

---

## Performance Characteristics

| Operation | Target | Notes |
|-----------|--------|-------|
| Resolution request | < 5s | Hard timeout enforced |
| Health check | < 2s | Timeout = failure |
| Circuit state transition | < 10ms | In-memory state machine |
| Retry backoff | 100ms, 200ms, 400ms | Exponential with jitter |
| OPEN → HALF_OPEN timeout | 30s (default) | Configurable per vessel |
| Rate limit window | 1 minute | Sliding window |
| Max concurrent resolutions | 10 per vessel | Prevents resource exhaustion |

---

## Implementation Checklist

### MiniBob
- [ ] Implement circuit breaker state machine per remote vessel
- [ ] Add mTLS certificate configuration and validation
- [ ] Implement retry logic with exponential backoff
- [ ] Add circuit breaker state to execution traces
- [ ] Implement health check probes for remote vessels
- [ ] Add fallback to backend-mediated resolution when circuit open
- [ ] Implement rate limiting headers parsing
- [ ] Add protocol version negotiation

### Analysis-API
- [ ] Expose `POST /v2/impulses/resolve` endpoint
- [ ] Implement defect-location impulse resolver
- [ ] Expose `GET /v2/health` endpoint with capabilities
- [ ] Add API key authentication middleware
- [ ] Implement request budget enforcement
- [ ] Add rate limiting per calling vessel
- [ ] Emit resolution metrics for backend learning

### metabob-activity-api (Backend)
- [ ] Add `resolved_by_vessel_id` to impulse trace schema
- [ ] Implement fallback resolution proxy endpoint
- [ ] Aggregate circuit breaker metrics for observability
- [ ] Track resolver performance by vessel
- [ ] Add vessel-to-vessel routing decision traces

### Activity Dashboard
- [ ] Visualize circuit breaker states across vessels
- [ ] Display resolution latency by vessel
- [ ] Show fallback vs direct resolution ratio
- [ ] Alert on circuit breaker transitions to OPEN

---

## Testing Strategy

### Unit Tests
- Circuit breaker state transitions (CLOSED → OPEN → HALF_OPEN → CLOSED)
- Retry logic with exponential backoff
- Error code mapping
- Budget enforcement

### Integration Tests
- MiniBob → Analysis-API resolution (happy path)
- Circuit breaker opens after failures
- Fallback to backend mediation when circuit open
- Health check failures trigger circuit breaker
- Rate limiting behavior
- mTLS authentication

### Chaos Tests
- Kill Analysis-API mid-request (verify timeout and retry)
- Network partition between vessels (verify circuit opens)
- Slow responses (verify timeout enforcement)
- Certificate expiration (verify connection failure)

---

## Migration Path

1. **Phase 1**: Add circuit breaker to MiniBob (passive mode - log only)
2. **Phase 2**: Implement `/v2/impulses/resolve` in Analysis-API
3. **Phase 3**: Enable direct MiniBob → Analysis-API resolution (bypass backend)
4. **Phase 4**: Activate circuit breaker enforcement
5. **Phase 5**: Remove backend impulse proxy for analysis types
6. **Phase 6**: Add fallback mechanism for production safety
