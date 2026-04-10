## Why

Multiple vessel integration plans have been developed independently (MiniBob, Analysis-API, Vessel Registry, Cross-Vessel Protocol, Shape Standardization). While they demonstrate strong alignment with foundational principles, there are inconsistencies in authentication patterns, service boundaries, and communication protocols. Standardizing these integrations now prevents architectural drift and ensures all vessels communicate idiomatically according to "resolvers live where data lives" and "metadata first, content later" principles.

## What Changes

- Standardize authentication pattern across backend-to-vessel and vessel-to-vessel communication
- Define clear service boundaries for Activity-API, Vessel Registry, and Cross-Vessel Protocol
- Implement execution tracing for all routing and resolution decisions
- Remove Analysis API proxy pattern from backend (violates resolver localization)
- Add missing context acquisition activities and goal orchestrators to MiniBob
- Establish shape registry ownership and versioning strategy
- Implement health scoring and circuit breaker patterns with trace integration
- Create unified vessel capability advertisement format (VesselCapabilityV2)

## Capabilities

### New Capabilities
- `vessel-authentication`: Standardized auth patterns for backend-to-vessel (API key) and vessel-to-vessel (mTLS + API key)
- `vessel-discovery`: Unified vessel capability advertisement, registration, and health scoring
- `cross-vessel-protocol`: HTTP API specification for vessel-to-vessel communication with circuit breaker
- `shape-registry`: Central shape definition registry with versioning and validation
- `execution-tracing-integration`: Tracing for routing decisions, circuit breaker state, and resolver performance
- `minibob-context-acquisition`: Activities for context:error-log, context:requirements, context:codebase
- `minibob-goal-orchestrators`: Activities for goal:test and goal:refactor
- `analysis-api-direct-integration`: MiniBob directly integrates with Analysis-API, removing backend proxy

### Modified Capabilities
- `impulse-resolution`: Add direct vessel-to-vessel resolution via discovery protocol (currently backend-mediated only)
  - **Delta spec**: `specs/impulse-resolution-vessel-direct/spec.md`
  - **Changes**: Three-tier fallback (local → vessel-direct → backend-routing), discovery integration, circuit breaker filtering
- `activity-execution`: Add execution tracing for all vessel coordination activities (registry routing, circuit breaker)
  - **Delta spec**: `specs/activity-execution-coordination-traces/spec.md`
  - **Changes**: New trace fields (resolved_by_vessel_id, impulse_resolutions array), routing traces, circuit breaker traces, health score tracking

## Impact

**Affected Services:**
- `repos/minibob/` - Add context acquisition, goal orchestrators, Analysis-API direct integration, config validation
- `repos/metabob-activity-api/` - Remove impulse proxy pattern, add shape registry, add vessel discovery endpoints (discovery starts here, may extract to dedicated service later)
- `repos/metabob-analysis-api/` - Implement /v2/impulses/resolve endpoint, register capabilities

**Schema Changes:**
- `vessel` table: Add `capabilities` field with VesselCapabilityV2 format
- `impulse` table: Add `resolved_by_vessel_id` for tracking resolver performance
- New `shape_definition` table for central registry
- New `vessel_health` table for health scoring

**Breaking Changes:**
- **BREAKING**: Analysis API impulses must go direct to Analysis-API, not via backend proxy
- **BREAKING**: Vessel-to-vessel communication requires mTLS setup
- **BREAKING**: All vessels must implement VesselCapabilityV2 format for registration

**Configuration:**
- MiniBob: Add Analysis-API endpoint configuration, remove SurrealDB credentials
- All vessels: Add mTLS certificate paths for vessel-to-vessel auth
- Vessel Registry: Add health check intervals and circuit breaker thresholds
