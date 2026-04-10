## Context

Five vessel integration plans have been developed independently:
1. **MiniBob Phase 2**: Direct integration with Analysis-API, context acquisition activities, goal orchestrators
2. **Analysis-API Vessel**: Shape-based impulse resolution, capability advertisement, self-service integration
3. **Vessel Registry**: Capability discovery, health scoring, smart routing with circuit breakers
4. **Cross-Vessel Protocol**: HTTP API spec for vessel-to-vessel communication
5. **Shape Standardization**: Central registry, versioning, validation

While these plans demonstrate strong alignment with foundational principles ("resolvers live where data lives", "metadata first, content later"), they were designed in isolation and reveal **inconsistencies**:

- **Authentication**: MiniBob Phase 2 uses API keys only; Cross-Vessel Protocol uses mTLS + API keys
- **Service boundaries**: Unclear if shape registry lives in Activity-API or Vessel Registry
- **Discovery integration**: Vessel Registry and Analysis-API both describe capability advertisement
- **Tracing gaps**: Circuit breaker state and routing decisions not captured in execution traces
- **Proxy pattern violation**: Activity-API currently proxies Analysis-API impulse resolution (violates "resolvers live where data lives")

**Current State:**
- 5 independent specs with overlapping but inconsistent designs
- MiniBob implements local resolvers (`memo`, `file`) only
- Activity-API has `/v2/impulses/resolve` endpoint that proxies to Analysis-API
- No vessel-to-vessel direct communication exists
- No shape registry exists (shapes are implicit in code)
- No vessel discovery or health scoring

**Constraints:**
- Must maintain backward compatibility during migration
- Must preserve "resolvers live where data lives" principle
- Must record all coordination activities in execution traces
- Cannot require downtime for existing deployments

**Stakeholders:**
- MiniBob instances (add new capabilities, remove SurrealDB dependency)
- Analysis-API vessel (expose impulse resolution directly)
- Activity-API backend (remove proxy pattern, add discovery endpoints)
- Future vessels (benefit from standardized patterns)

## Goals / Non-Goals

**Goals:**
- Standardize authentication patterns across all vessel-to-vessel and backend-to-vessel communication
- Define clear service boundaries for Activity-API, Vessel Registry, and Cross-Vessel Protocol
- Implement execution tracing for all routing decisions, circuit breaker state changes, and resolver performance
- Remove Activity-API proxy pattern for Analysis-API impulses (restore resolver localization)
- Add missing context acquisition activities (`context:error-log`, `context:requirements`, `context:codebase`) to MiniBob
- Add missing goal orchestrators (`goal:test`, `goal:refactor`) to MiniBob
- Establish shape registry ownership, versioning strategy, and validation
- Implement health scoring and circuit breaker patterns with trace integration
- Create unified vessel capability advertisement format (VesselCapabilityV2)

**Non-Goals:**
- Redesigning the entire impulse-activity foundation (this is standardization, not reimagining)
- OAuth/SSO integration for vessel authentication (API key + mTLS is sufficient)
- Real-time streaming of vessel health (polling is sufficient for v1)
- Migrating all existing vessels at once (phased rollout is acceptable)
- Building a separate Vessel Registry service immediately (Activity-API can host discovery endpoints initially)

## Decisions

### Decision 1: Two-tier authentication strategy

**Rationale:** Different authentication needs for different communication patterns.

**Implementation:**
- **Backend-to-Vessel**: API key only (same as current user authentication)
  - Activity-API validates API key via identity service
  - Returns org_id, user_id, key_id, scopes
  - Used for: Activity-API → vessel for impulse resolution routing
- **Vessel-to-Vessel**: mTLS + API key
  - mTLS proves vessel identity (prevents spoofing)
  - API key provides org/user context for multi-tenant isolation
  - Used for: MiniBob → Analysis-API direct impulse resolution

**Alternatives Considered:**
- ❌ **API key only for all**: Vulnerable to vessel impersonation attacks
- ❌ **mTLS only**: No org/user context, breaks multi-tenant isolation
- ❌ **JWT tokens**: Adds refresh complexity, not needed for vessel-to-vessel
- ✅ **Hybrid approach**: Security for vessel identity, context for tenancy

**Analysis-API Dual-Role Pattern:**

Analysis-API accepts two authentication patterns depending on caller:

1. **As a Vessel** (responding to direct impulse resolution):
   - Caller: MiniBob or other vessels
   - Auth: mTLS + API key
   - Endpoint: `https://analysis.metabob.com/v2/impulses/resolve`
   - Use case: Vessel-to-vessel direct communication

2. **As Backend Recipient** (receiving routed requests):
   - Caller: Activity-API routing layer
   - Auth: API key only (internal service mesh call)
   - Endpoint: Internal service mesh URL (e.g., `http://analysis-api.activity-system.svc.cluster.local:8080`)
   - Use case: Backend-mediated fallback routing

**Configuration:**
```typescript
// MiniBob config
{
  "vessels": {
    "analysis": {
      "endpoint": "https://analysis.metabob.com",
      "mtls": {
        "cert": "/etc/minibob/tls/client.crt",
        "key": "/etc/minibob/tls/client.key",
        "ca": "/etc/minibob/tls/ca.crt"
      },
      "apiKey": "${METABOB_API_KEY}"
    }
  }
}
```

### Decision 2: Service boundary definitions

**Rationale:** Clear ownership prevents duplication and architectural drift.

**Activity-API (Backend):**
- ✅ Execution trace storage
- ✅ Thompson Sampling computation
- ✅ Vessel capability discovery endpoints (`/v2/vessels/register`, `/v2/vessels/discover`)
- ✅ Health aggregation and circuit breaker state
- ✅ Shape registry (`/v2/shapes/*`)
- ❌ NOT: Impulse resolution (delegates to vessels)
- ❌ NOT: Direct vessel health checks (vessels self-report)

**Vessel Registry (Future):**
- Initial implementation: Endpoints in Activity-API
- Future extraction: When 5+ vessels exist or query complexity warrants dedicated service
- Would own: Discovery, health scoring, routing optimization

**Cross-Vessel Protocol (Standard):**
- HTTP API specification for vessel-to-vessel communication
- Implemented by all vessels that expose capabilities
- Required endpoints: `/v2/impulses/resolve`, `/health`, `/capabilities`

**Alternatives Considered:**
- ❌ **Separate Vessel Registry service immediately**: Over-engineering for 2 vessels
- ❌ **Activity-API owns all impulse resolution**: Violates "resolvers live where data lives"
- ❌ **gRPC for vessel-to-vessel**: HTTP is simpler, works with existing infrastructure
- ✅ **Activity-API hosts discovery, vessels resolve impulses**: Balances centralization with localization

### Decision 3: Shape registry ownership

**Rationale:** Shapes are shared metadata that must be consistent across vessels.

**Implementation:**
- **Activity-API owns shape registry** (`/v2/shapes/*` endpoints)
- Vessels register shapes they produce/consume during startup
- SurrealDB table: `shape_definition` with versioning
- Validation enforced at impulse creation time

**SurrealDB Schema:**
```sql
DEFINE TABLE shape_definition SCHEMAFULL;
DEFINE FIELD shape_name ON shape_definition TYPE string;
DEFINE FIELD version ON shape_definition TYPE string;
DEFINE FIELD schema ON shape_definition TYPE object;  -- JSON schema
DEFINE FIELD examples ON shape_definition TYPE array;
DEFINE FIELD registered_by ON shape_definition TYPE string;  -- vessel_id
DEFINE FIELD created_at ON shape_definition TYPE datetime DEFAULT time::now();

DEFINE INDEX idx_shape_version ON shape_definition FIELDS shape_name, version UNIQUE;
```

**Versioning Strategy:**
- Semantic versioning: `shape_name@version` (e.g., `error_log@1.2.0`)
- Breaking changes require major version bump
- Vessels declare supported versions in capability advertisement
- Activity-API validates compatibility during routing

**Alternatives Considered:**
- ❌ **Each vessel owns its shapes**: Inconsistency, no validation
- ❌ **Shapes in code only**: No runtime validation, no discovery
- ❌ **Separate shape service**: Over-engineering
- ✅ **Centralized registry in Activity-API**: Single source of truth, enables validation

### Decision 4: Discovery mechanism integration

**Rationale:** Vessels must be discoverable for routing without manual configuration.

**Implementation:**
- Vessels call `POST /v2/vessels/register` on startup with `VesselCapabilityV2` payload
- Activity-API stores in `vessel` table with `capabilities` field
- Vessels send health heartbeat every 60 seconds (`POST /v2/vessels/heartbeat`)
- Activity-API computes health score (success rate, latency, availability)
- Circuit breaker opens after 5 consecutive failures or health score < 0.3

**VesselCapabilityV2 Format:**
```typescript
interface VesselCapabilityV2 {
  vessel_id: string
  vessel_type: string  // "analysis", "execution", "storage", etc.
  endpoint: string     // Base URL for this vessel
  resolvers: Array<{
    type: string       // "error_log", "source_code", "cpg", etc.
    shapes: string[]   // Shapes this resolver can produce
    version: string    // Resolver version
  }>
  activities: Array<{
    activity_id: string
    input_shapes: string[]
    output_shapes: string[]
  }>
  health_check_path: string  // e.g., "/health"
  capabilities_path: string  // e.g., "/capabilities"
}
```

**Routing Logic:**
```typescript
// In Activity-API /v2/impulses/resolve
async function routeImpulseToVessel(impulse: Impulse): Promise<ResolvedImpulse> {
  // 1. Find vessels that can resolve this shape
  const candidates = await db.query(`
    SELECT * FROM vessel
    WHERE capabilities.resolvers[*].shapes CONTAINS $shape
    AND health_score > 0.3
  `, { shape: impulse.pointer.type });

  // 2. Apply circuit breaker filter
  const available = candidates.filter(v => !circuitBreaker.isOpen(v.vessel_id));

  // 3. Select vessel (round-robin or Thompson Sampling)
  const vessel = selectVessel(available);

  // 4. Call vessel's /v2/impulses/resolve endpoint
  const result = await callVessel(vessel, impulse);

  // 5. Record trace
  await recordRoutingTrace({
    impulse_id: impulse.id,
    shape: impulse.pointer.type,
    routed_to: vessel.vessel_id,
    candidates: candidates.map(v => v.vessel_id),
    latency_ms: result.duration,
    success: result.success
  });

  return result;
}
```

**Alternatives Considered:**
- ❌ **Service mesh for discovery**: Adds infrastructure complexity
- ❌ **Manual vessel configuration**: Doesn't scale, error-prone
- ❌ **DNS-based discovery**: No health awareness, no shape matching
- ✅ **Application-level registry with health scoring**: Full control, trace integration

### Decision 5: Execution tracing for all coordination activities

**Rationale:** Learning requires observability. Routing decisions, circuit breaker state, and resolver performance must be traced.

**New Trace Types:**
```typescript
// 1. Routing traces
interface RoutingTrace {
  trace_type: "impulse_routing"
  impulse_id: string
  shape: string
  candidates: string[]        // vessel_ids considered
  selected: string            // vessel_id selected
  selection_reason: string    // "health_score" | "round_robin" | "thompson_sampling"
  latency_ms: number
  success: boolean
  circuit_breaker_state?: string
}

// 2. Circuit breaker traces
interface CircuitBreakerTrace {
  trace_type: "circuit_breaker_event"
  vessel_id: string
  event: "opened" | "half_open" | "closed"
  consecutive_failures?: number
  health_score?: number
  timestamp: datetime
}

// 3. Resolver performance traces (existing execution traces enhanced)
interface ExecutionTrace {
  // ... existing fields ...
  resolved_by_vessel_id?: string  // NEW: which vessel resolved impulses
  impulse_resolutions: Array<{    // NEW: detailed resolution tracking
    impulse_id: string
    shape: string
    resolver_vessel: string
    latency_ms: number
    success: boolean
  }>
}
```

**Trace Integration Points:**
- Activity-API: All routing decisions → `routing_trace` table
- Vessels: All impulse resolutions → enhanced `execution_trace` records
- Circuit breaker: State changes → `circuit_breaker_trace` table
- MiniBob: All activities → existing traces with new `resolved_by_vessel_id` field

**Alternatives Considered:**
- ❌ **No routing traces**: Can't learn which vessels perform best
- ❌ **Logging only**: Not queryable, not structured
- ❌ **Separate tracing system**: Adds complexity, breaks learning loop
- ✅ **Extend existing execution trace model**: Unified view, enables Thompson Sampling on routing

### Decision 6: Remove Analysis-API proxy pattern from Activity-API

**Rationale:** Violates "resolvers live where data lives". MiniBob should call Analysis-API directly.

**Current State (INCORRECT):**
```
MiniBob → Activity-API /v2/impulses/resolve → Analysis-API /internal/resolve
```

**Target State (CORRECT):**
```
MiniBob → Analysis-API /v2/impulses/resolve (direct)
MiniBob → Activity-API /v2/impulses/resolve (only for routing unknown shapes)
```

**Migration Path:**
1. Analysis-API implements `/v2/impulses/resolve` endpoint (Phase 1)
2. MiniBob config adds Analysis-API endpoint (Phase 2)
3. MiniBob tries local resolvers first, then Analysis-API direct, then Activity-API routing (Phase 3)
4. Activity-API `/v2/impulses/resolve` only handles unknown shapes (looks up in registry, routes to vessel) (Phase 4)
5. Remove Analysis-API proxy code from Activity-API (Phase 5)

**Alternatives Considered:**
- ❌ **Keep proxy for backward compatibility**: Perpetuates architectural violation
- ❌ **Remove proxy immediately**: Breaking change, no rollback
- ✅ **Phased migration with fallback**: Safe, gradual, traceable

### Decision 7: Missing MiniBob capabilities - context acquisition and goal orchestrators

**Rationale:** MiniBob currently lacks activities for acquiring context and orchestrating multi-step goals.

**New Activities (all added to MiniBob's activity catalog):**

**Context Acquisition:**
```json
// 1. context:error-log
{
  "id": "acquire-error-log-context",
  "input_shapes": ["file", "bash_output"],
  "output_shapes": ["error_log"],
  "tasks": [
    { "description": "Read log file or command output" },
    { "description": "Parse error messages and stack traces" },
    { "description": "Create error_log impulse with structured data" }
  ]
}

// 2. context:requirements
{
  "id": "acquire-requirements-context",
  "input_shapes": ["file", "memo"],
  "output_shapes": ["requirements"],
  "tasks": [
    { "description": "Read requirements document or user input" },
    { "description": "Extract functional and non-functional requirements" },
    { "description": "Create requirements impulse with structured data" }
  ]
}

// 3. context:codebase
{
  "id": "acquire-codebase-context",
  "input_shapes": ["file", "git"],
  "output_shapes": ["codebase_structure"],
  "tasks": [
    { "description": "Analyze directory structure" },
    { "description": "Identify key modules and dependencies" },
    { "description": "Create codebase_structure impulse" }
  ]
}
```

**Goal Orchestrators:**
```json
// 1. goal:test
{
  "id": "orchestrate-test-goal",
  "input_shapes": ["requirements", "source_code"],
  "output_shapes": ["test_suite", "execution_trace"],
  "tasks": [
    { "description": "Generate test cases from requirements" },
    { "description": "Implement tests using test framework" },
    { "description": "Run tests and capture results" },
    { "description": "Create test_suite impulse with coverage" }
  ]
}

// 2. goal:refactor
{
  "id": "orchestrate-refactor-goal",
  "input_shapes": ["codebase_structure", "design_pattern"],
  "output_shapes": ["refactored_code", "execution_trace"],
  "tasks": [
    { "description": "Identify refactoring opportunities" },
    { "description": "Apply design pattern transformations" },
    { "description": "Validate via tests" },
    { "description": "Create refactored_code impulse" }
  ]
}
```

**Alternatives Considered:**
- ❌ **LLM improvisation for all contexts**: Inconsistent, not reusable
- ❌ **Hard-coded parsers**: Inflexible, breaks with new formats
- ✅ **Structured activities with validation**: Measured, learned from, extractable

### Decision 8: Config validation and error handling

**Rationale:** Adding vessel endpoints to MiniBob config increases misconfiguration risk.

**Implementation:**
- MiniBob validates config on startup (URL reachability, mTLS cert validity)
- Logs detailed errors with actionable fixes
- Gracefully degrades if vessel unreachable (uses Activity-API routing as fallback)
- Config validation activity: `validate-vessel-config.json`

**Validation Checks:**
```typescript
interface ConfigValidation {
  checks: [
    { type: "url_reachable", target: "analysis.endpoint" },
    { type: "mtls_cert_valid", target: "analysis.mtls.cert" },
    { type: "mtls_key_valid", target: "analysis.mtls.key" },
    { type: "api_key_valid", target: "metabob.apiKey" },
    { type: "health_check", target: "${analysis.endpoint}/health" }
  ]
}
```

**Error Messages:**
```
❌ Analysis-API endpoint unreachable: https://analysis.metabob.com
   → Check network connectivity or verify endpoint URL
   → Falling back to Activity-API routing for analysis impulses

❌ mTLS certificate expired: /etc/minibob/tls/client.crt
   → Certificate expired on 2026-03-15
   → Generate new certificate: ./scripts/renew-mtls-cert.sh
   → Vessel-to-vessel calls will fail until certificate renewed
```

**Alternatives Considered:**
- ❌ **Silent failures**: Confusing, hard to debug
- ❌ **Fail fast on startup**: Prevents operation even if vessel not needed
- ✅ **Validate + warn + degrade gracefully**: Best user experience

## Risks / Trade-offs

### Risk: mTLS setup complexity for local development

**Description:** Developers need to generate and manage mTLS certificates for vessel-to-vessel communication.

**Mitigation:**
- Provide script: `./scripts/generate-dev-mtls-certs.sh` (uses openssl, 90-day validity)
- Docker Compose includes certificate generation in setup
- Canary/production use cert-manager in Kubernetes (automated renewal)
- Document mTLS setup clearly in DEPLOYMENT_WORKFLOW.md
- Allow disabling mTLS in local dev mode via `DISABLE_MTLS=true` env var (logs warning)

**Residual Risk:** Local development still harder than before. Acceptable trade-off for security.

### Risk: Breaking change for existing MiniBob deployments

**Description:** MiniBob Phase 2 changes config structure and removes SurrealDB dependency.

**Mitigation:**
- **Backward compatibility period**: MiniBob 2.0 supports both old and new config formats
- **Gradual migration**: Phase 1 (Analysis-API endpoint), Phase 2 (remove SurrealDB), Phase 3 (cleanup)
- **Feature flags**: `USE_DIRECT_ANALYSIS_API=false` env var keeps old behavior
- **Clear migration guide**: Document exact steps in MIGRATION.md
- **Rollback plan**: Keep MiniBob 1.x images available, Helm values support version pinning

**Residual Risk:** Users who don't read migration guide will experience breakage. Document prominently.

### Risk: Circuit breaker false positives during deployments

**Description:** Rolling deployment of Analysis-API could trigger circuit breaker, blocking all analysis impulses.

**Mitigation:**
- Circuit breaker opens when EITHER: 5 consecutive failures occur OR failure rate ≥ 50% over 60-second window
- Half-open state after 30 seconds (allows retry)
- Health check considers last 100 requests (smooths out transient failures)
- Deployment strategy: Blue-green with health check gate (wait for 200 OK before routing traffic)
- Manual override: `POST /v2/vessels/{id}/circuit-breaker/reset` endpoint for operators

**Residual Risk:** Very long deployments (>30s unhealthy) could still trigger. Monitor circuit breaker state.

### Risk: Shape registry schema evolution

**Description:** Shape definitions will evolve. How to handle incompatible changes?

**Mitigation:**
- **Semantic versioning**: Breaking changes require major version bump
- **Capability advertisement includes versions**: Vessels declare `error_log@1.0.0` and `error_log@2.0.0`
- **Activity-API routing logic considers versions**: Routes impulse to vessel supporting that version
- **Deprecation process**: Mark old versions deprecated, maintain for 6 months before removal
- **Migration activities**: Create `migrate-shape-v1-to-v2` activities for data transformation

**Residual Risk:** Rapid evolution creates version sprawl. Require strong justification for breaking changes.

### Risk: Tracing overhead on high-throughput vessels

**Description:** Recording routing traces for every impulse resolution adds database writes.

**Mitigation:**
- **Sampling**: Record 100% of failures, 10% of successes (configurable)
- **Async writes**: Trace recording non-blocking via queue
- **Batching**: Buffer traces and write in batches of 100
- **TTL**: Routing traces expire after 30 days (shorter than execution traces)
- **Monitoring**: Alert if trace queue depth > 1000

**Residual Risk:** Under extreme load (10k+ req/s), tracing could still bottleneck. Monitor queue depth.

### Trade-off: Activity-API hosts discovery vs. dedicated Vessel Registry

**Decision:** Start with Activity-API, extract later if needed.

**Trade-off:**
- **Pro**: Simpler deployment, fewer services, faster iteration
- **Con**: Activity-API becomes larger, discovery logic couples with trace storage

**When to extract:**
- 5+ vessels in production
- Discovery queries >10ms P99 latency
- Complex routing logic (multi-criteria optimization, ML-based selection)

**Acceptable for now:** 2 vessels (MiniBob, Analysis-API) don't justify dedicated service.

### Trade-off: HTTP vs. gRPC for vessel-to-vessel

**Decision:** Use HTTP with JSON.

**Trade-off:**
- **Pro**: Simpler, works with existing infrastructure, easier debugging
- **Con**: Larger payloads, slightly higher latency than gRPC

**Rationale:** Impulse resolution is not latency-critical (P99 < 500ms acceptable). HTTP simplicity outweighs gRPC performance gains.

## Migration Plan

**Phased Rollout:**

### Phase 1: Foundation (Activity-API + Analysis-API changes)
**Duration:** 1 week
**Goal:** Establish shape registry, vessel discovery, and direct Analysis-API impulse resolution.

**Tasks:**
1. Activity-API: Add `/v2/shapes/*` endpoints and `shape_definition` table
2. Activity-API: Add `/v2/vessels/register` and `/v2/vessels/discover` endpoints
3. Analysis-API: Implement `/v2/impulses/resolve` endpoint (shapes: `error_log`, `source_code`, `cpg`)
4. Analysis-API: Implement `/health` and `/capabilities` endpoints
5. Analysis-API: Call `POST /v2/vessels/register` on startup
6. Deploy to canary, validate health

**Validation:**
```bash
# Shape registry working
curl https://activity.metabob.com/v2/shapes | jq .

# Vessel registration working
curl https://activity.metabob.com/v2/vessels/discover | jq .

# Analysis-API direct resolution working
curl -X POST https://analysis.metabob.com/v2/impulses/resolve \
  -H "Authorization: ApiKey $KEY" \
  -d '{"pointer": {"type": "error_log", "path": "error.log"}}'
```

**Rollback:** Revert Activity-API and Analysis-API images. No breaking changes yet.

---

### Phase 2: Direct Integration (MiniBob changes)
**Duration:** 1 week
**Goal:** MiniBob directly calls Analysis-API for analysis impulses, adds context acquisition activities.

**Tasks:**
1. MiniBob: Update config schema to support `vessels.analysis.endpoint`
2. MiniBob: Implement mTLS client for vessel-to-vessel communication
3. MiniBob: Implement config validation on startup
4. MiniBob: Add fallback logic (local → vessel direct → Activity-API routing)
5. MiniBob: Add context acquisition activities (`acquire-error-log-context`, `acquire-requirements-context`, `acquire-codebase-context`)
6. MiniBob: Remove SurrealDB dependency (delegated to Activity-API via MCP)
7. Update Helm values with mTLS certificate paths
8. Deploy to canary, validate with end-to-end trace

**Validation:**
```bash
# MiniBob config validation
minibob --validate-config

# Direct Analysis-API call trace
minibob --single "analyze error log" --trace
# Should show: resolved_by_vessel_id = "analysis-api-abc123"

# Context acquisition activity
minibob --single "acquire error log context from error.log"
# Should create error_log impulse
```

**Rollback:** Revert MiniBob image, keep old config format. Analysis-API changes remain (backward compatible).

---

### Phase 3: Missing Activities (MiniBob goal orchestrators)
**Duration:** 1 week
**Goal:** Add goal orchestrators (`goal:test`, `goal:refactor`) to MiniBob.

**Tasks:**
1. MiniBob: Add `orchestrate-test-goal.json` activity
2. MiniBob: Add `orchestrate-refactor-goal.json` activity
3. MiniBob: Integrate goal orchestrators into goal-processor logic
4. Deploy to canary, validate with test goal execution
5. Register new activities in Activity-API backend

**Validation:**
```bash
# Test goal orchestrator
minibob --single "test the authentication module"
# Should execute: acquire context → generate tests → run tests → report

# Refactor goal orchestrator
minibob --single "refactor user service to use repository pattern"
# Should execute: acquire codebase → identify opportunities → apply pattern → validate
```

**Rollback:** Revert MiniBob image. Existing activities unaffected.

---

### Phase 4: Intelligence (Circuit breakers, health scoring, routing traces)
**Duration:** 1 week
**Goal:** Add circuit breaker, health scoring, and routing trace integration.

**Tasks:**
1. Activity-API: Implement circuit breaker logic in `/v2/impulses/resolve` routing
2. Activity-API: Add `POST /v2/vessels/heartbeat` endpoint
3. Activity-API: Add `routing_trace` and `circuit_breaker_trace` tables
4. Activity-API: Implement health score computation (success rate, latency, availability)
5. Vessels: Send heartbeat every 60 seconds
6. Deploy to canary, simulate vessel failure, validate circuit breaker opens

**Validation:**
```bash
# Circuit breaker opens after failures
# 1. Stop Analysis-API pod
kubectl delete pod -n activity-system -l app=analysis-api

# 2. Trigger 5 impulse resolutions
for i in {1..5}; do
  minibob --single "analyze error log"
done

# 3. Check circuit breaker state
curl https://activity.metabob.com/v2/vessels/analysis-api-abc123/circuit-breaker
# Should show: state = "open"

# 4. Restart Analysis-API
kubectl rollout restart deployment -n activity-system analysis-api

# 5. Wait 30 seconds, circuit breaker should enter half-open
# 6. Next success should close circuit breaker
```

**Rollback:** Revert Activity-API image. Vessels continue heartbeat (no harm). Routing falls back to round-robin.

---

### Phase 5: Cleanup (Remove proxy pattern)
**Duration:** 3 days
**Goal:** Remove Analysis-API proxy code from Activity-API.

**Tasks:**
1. Activity-API: Remove `/v2/impulses/resolve` proxy logic for Analysis-API shapes
2. Activity-API: Update routing logic to only handle unknown shapes
3. Deploy to canary, validate no regressions
4. Monitor error rate for 48 hours
5. Promote to production

**Validation:**
```bash
# Activity-API should NOT proxy Analysis-API impulses
curl -X POST https://activity.metabob.com/v2/impulses/resolve \
  -H "Authorization: ApiKey $KEY" \
  -d '{"pointer": {"type": "error_log", "path": "error.log"}}'
# Should return: error "Use vessel-direct resolution for error_log shape"

# Activity-API should still route unknown shapes
curl -X POST https://activity.metabob.com/v2/impulses/resolve \
  -H "Authorization: ApiKey $KEY" \
  -d '{"pointer": {"type": "unknown_shape", "path": "data.json"}}'
# Should return: routed to vessel that registered unknown_shape
```

**Rollback:** Revert Activity-API image, restore proxy code. No data loss.

---

## Testing Strategy

**Unit Tests:**
- MiniBob config validation logic
- Circuit breaker state machine
- Health score computation
- Shape version matching

**Integration Tests:**
- End-to-end impulse resolution: MiniBob → Analysis-API direct
- Vessel registration and discovery flow
- Circuit breaker open/close cycle
- Routing trace capture

**Load Tests:**
- 1000 concurrent impulse resolutions (validate circuit breaker doesn't false positive)
- 10k routing decisions (validate trace queue doesn't overflow)

**Chaos Tests:**
- Kill Analysis-API pod during resolution (validate circuit breaker opens)
- Expire mTLS certificate (validate graceful degradation)
- SurrealDB connection loss (validate trace buffering)

---

## Open Questions

None - all architectural decisions resolved. Implementation can proceed.
