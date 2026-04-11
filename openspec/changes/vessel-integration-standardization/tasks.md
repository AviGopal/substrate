# Implementation Tasks: Vessel Integration Standardization

## Implementation Philosophy

**Logical Dependencies Over Strict Phasing:**
- Implement tasks in logical dependency order - if Task B requires output from Task A, do A first
- Phases can overlap when dependencies are satisfied - don't wait for entire phase to complete
- Focus on correctness and alignment with foundation principles

**Architecture Note:**
- Discovery-vessel is a standalone vessel (not Activity-API endpoints)
- Activity-API retains: shape registry, trace storage, health scoring, Thompson Sampling
- Discovery-vessel owns: vessel registration, heartbeat, capability queries

---

## Phase 1: Discovery-Vessel Core

### 1.1 Discovery-Vessel Implementation
- [ ] 1.1.1 Implement `POST /register` endpoint for vessel registration
- [ ] 1.1.2 Implement `POST /heartbeat` endpoint for TTL refresh
- [ ] 1.1.3 Implement `DELETE /vessels/:vesselId` endpoint for deregistration
- [ ] 1.1.4 Implement `POST /resolve` endpoint for capability queries
- [ ] 1.1.5 Implement `GET /health` endpoint with registry stats
- [ ] 1.1.6 Add in-memory registry with shape indexing
- [ ] 1.1.7 Add TTL-based expiration (5 minute default)
- [ ] 1.1.8 Add periodic cleanup job (60 second interval)
- [ ] 1.1.9 Add self-registration on startup (discovery is discoverable)
- [ ] 1.1.10 Write unit tests for all endpoints

### 1.2 Shared Client Package (@metabob/vessel-discovery-client)
- [ ] 1.2.1 Create package structure with TypeScript
- [ ] 1.2.2 Implement `register()` function
- [ ] 1.2.3 Implement `VesselClient` class with heartbeat management
- [ ] 1.2.4 Implement exponential backoff for retries
- [ ] 1.2.5 Implement graceful shutdown handler (SIGTERM/SIGINT)
- [ ] 1.2.6 Implement health middleware for Express/Hono
- [ ] 1.2.7 Implement `discoverByShape()` function with caching
- [ ] 1.2.8 Add metrics emission (vessel.registration.*, vessel.heartbeat.*)
- [ ] 1.2.9 Write unit tests for client package
- [ ] 1.2.10 Publish to npm registry

### 1.3 Activity-API Shape Registry (retained)
- [x] 1.3.1 Create `shape_definition` table in SurrealDB schema
- [x] 1.3.2 Implement `POST /v2/shapes/register` endpoint
- [x] 1.3.3 Implement `GET /v2/shapes` endpoint for listing shapes
- [x] 1.3.4 Implement `GET /v2/shapes/:name/:version` endpoint
- [x] 1.3.5 Add shape validation logic using JSON schema
- [x] 1.3.6 Add shape versioning and compatibility validation
- [x] 1.3.7 Register bootstrap shapes (goal, error_log, source_code, etc.)
- [x] 1.3.8 Write unit tests for shape registry endpoints

---

## Phase 2: Vessel Discovery Integrations

### 2.1 Activity-API Discovery Integration
- [ ] 2.1.1 Add discovery-vessel registration on startup
- [ ] 2.1.2 Add heartbeat manager (2 minute interval)
- [ ] 2.1.3 Add shutdown handler for deregistration
- [ ] 2.1.4 Add deprecation headers to legacy `/v2/vessels/*` endpoints
- [ ] 2.1.5 Implement proxy mode for gradual migration
- [ ] 2.1.6 Update health endpoint to include discovery status
- [ ] 2.1.7 Write integration tests for registration flow

### 2.2 Analysis-API Discovery Integration
- [x] 2.2.1 Implement `POST /v2/impulses/resolve` endpoint
- [x] 2.2.2 Add resolver for `problem_detection` impulse shape
- [x] 2.2.3 Add resolver for `error_log` impulse shape
- [x] 2.2.4 Add resolver for `source_code` impulse shape
- [x] 2.2.5 Implement `GET /health` endpoint with detailed status
- [x] 2.2.6 Implement `GET /capabilities` endpoint
- [ ] 2.2.7 Add discovery-vessel registration on startup (migrate from Activity-API)
- [ ] 2.2.8 Add heartbeat manager
- [ ] 2.2.9 Add shutdown handler for deregistration
- [ ] 2.2.10 Write integration tests

### 2.3 Identity-Vessel Discovery Integration
- [ ] 2.3.1 Add discovery-vessel registration with bootstrap delay
- [ ] 2.3.2 Handle circular dependency (30-second validation window)
- [ ] 2.3.3 Add heartbeat manager
- [ ] 2.3.4 Add shutdown handler for deregistration
- [ ] 2.3.5 Ensure identity-vessel operates independently of discovery
- [ ] 2.3.6 Write integration tests

### 2.4 MiniBob Discovery Integration
- [ ] 2.4.1 Add discovery-vessel configuration to MiniBob config schema
- [ ] 2.4.2 Implement registration on startup with local shapes
- [ ] 2.4.3 Add heartbeat manager
- [ ] 2.4.4 Add shutdown handler for deregistration
- [ ] 2.4.5 Update resolution logic: local → discovery query → direct call
- [ ] 2.4.6 Add discovery-vessel status to `/status` command
- [ ] 2.4.7 Write integration tests

### 2.5 Terminal-Vessel Discovery Integration
- [ ] 2.5.1 Migrate from Activity-API registration to discovery-vessel
- [ ] 2.5.2 Add heartbeat manager using shared client
- [ ] 2.5.3 Add shutdown handler for deregistration
- [ ] 2.5.4 Update health endpoint to include discovery status
- [ ] 2.5.5 Write integration tests

### 2.6 React-Renderer Discovery Integration
- [ ] 2.6.1 Add discovery-vessel registration on startup
- [ ] 2.6.2 Add heartbeat manager
- [ ] 2.6.3 Add shutdown handler for deregistration
- [ ] 2.6.4 Update health endpoint to include discovery status
- [ ] 2.6.5 Write integration tests

### 2.7 User-Vessel Discovery Integration
- [ ] 2.7.1 Add discovery-vessel registration on startup
- [ ] 2.7.2 Add heartbeat manager
- [ ] 2.7.3 Add shutdown handler for deregistration
- [ ] 2.7.4 Update manifest endpoint with discovery status
- [ ] 2.7.5 Write integration tests

---

## Phase 3: MiniBob Context Acquisition

### 3.1 Context Acquisition Activities
- [x] 3.1.1 Create `acquire-error-log-context.json` activity template
- [x] 3.1.2 Implement error log parsing logic
- [x] 3.1.3 Define `error_log` impulse shape schema
- [x] 3.1.4 Create `acquire-requirements-context.json` activity template
- [x] 3.1.5 Implement requirements parsing logic
- [x] 3.1.6 Define `requirement` impulse shape schema
- [x] 3.1.7 Create `acquire-codebase-context.json` activity template
- [x] 3.1.8 Implement codebase structure analysis
- [x] 3.1.9 Define `codebase_structure` impulse shape schema
- [x] 3.1.10 Register all 3 context activities in Activity-API
- [x] 3.1.11 Integrate into goal-processor workflow
- [x] 3.1.12 Write unit tests

### 3.2 Goal Orchestrators
- [ ] 3.2.1 Define input/output shapes for goal:test orchestrator
- [ ] 3.2.2 Define input/output shapes for goal:refactor orchestrator
- [ ] 3.2.3 Implement state machine (PLANNING → EXECUTING → VALIDATING → DONE)
- [ ] 3.2.4 Implement rollback activity pattern
- [ ] 3.2.5 Implement composition graph structure
- [ ] 3.2.6 Create `orchestrate-test-goal.json` activity template
- [ ] 3.2.7 Create `orchestrate-refactor-goal.json` activity template
- [ ] 3.2.8 Integrate into goal-processor routing
- [ ] 3.2.9 Write unit tests for orchestration logic
- [ ] 3.2.10 Write integration tests for end-to-end orchestration

---

## Phase 4: Health Scoring and Circuit Breakers

**Status:** ✅ INFRASTRUCTURE DEPLOYED (Validated 2026-04-11)
- All code deployed to canary environment
- Database schema created (4 tables, 11 indexes)
- Services integrated into VesselRouter
- End-to-end testing blocked by vessel registration (400 errors)
- See: PHASE_4_VALIDATION_REPORT.md

### 4.1 Health Score Computation (Activity-API)
- [x] 4.1.1 Implement health score computation logic
- [x] 4.1.2 Add exponential moving average for metrics
- [x] 4.1.3 Add latency-based penalties
- [x] 4.1.4 Add heartbeat freshness factor
- [x] 4.1.5 Implement gradual decay and alert thresholds

### 4.2 Circuit Breaker (Activity-API)
- [x] 4.2.1 Implement circuit breaker state machine (CLOSED → OPEN → HALF_OPEN)
- [x] 4.2.2 Configure thresholds (5 failures, 30s timeout)
- [x] 4.2.3 Add circuit breaker state to routing decisions
- [x] 4.2.4 Create `circuit_breaker_trace` table
- [x] 4.2.5 Write unit tests

### 4.3 Routing Traces
- [x] 4.3.1 Create `routing_trace` table
- [x] 4.3.2 Implement routing trace recording
- [x] 4.3.3 Add sampling (100% failures, 10% successes)
- [x] 4.3.4 Add async trace writing via queue
- [x] 4.3.5 Add TTL for routing traces (30 days)

---

## Phase 5: Validation and Deployment

**Status:** ⚠️ BLOCKED - Discovery-vessel not yet implemented
**Note:** Analysis-API successfully deployed (2026-04-11)
- metabob-analysis-api v0.1.2 operational at https://api.metabob.com
- Fixed: imagePullSecrets, cpg-inference-ts dependencies, image tagging
- See: ANALYSIS_API_DEPLOYMENT_FIX.md, ANALYSIS_API_VALIDATION_REPORT.md

### 5.1 Discovery-Vessel Deployment
- [ ] 5.1.1 Deploy discovery-vessel to canary environment (BLOCKED: Phase 1 not started)
- [ ] 5.1.2 Verify self-registration works
- [ ] 5.1.3 Test vessel registration from Activity-API
- [ ] 5.1.4 Test heartbeat and TTL expiration
- [ ] 5.1.5 Monitor for 48 hours
- [ ] 5.1.6 Promote to production

### 5.2 Vessel Integration Validation
- [ ] 5.2.1 Test all vessels register with discovery-vessel (BLOCKED: Discovery-vessel not deployed)
- [ ] 5.2.2 Test capability queries return correct vessels
- [ ] 5.2.3 Test graceful shutdown deregistration
- [ ] 5.2.4 Test circuit breaker opens after failures (BLOCKED: Vessel registration failing)
- [ ] 5.2.5 Test health scoring reflects vessel state
- [ ] 5.2.6 Verify traces appear in Activity-API

### 5.3 Legacy Endpoint Migration
- [ ] 5.3.1 Enable deprecation headers on Activity-API `/v2/vessels/*`
- [ ] 5.3.2 Monitor deprecation warning adoption (30 days)
- [ ] 5.3.3 Enable 410 Gone for legacy endpoints
- [ ] 5.3.4 Remove legacy endpoint code

---

## Phase 6: Documentation and Quality

### 6.1 Documentation
- [ ] 6.1.1 Update DEPLOYMENT_WORKFLOW.md with discovery-vessel
- [ ] 6.1.2 Create DISCOVERY_INTEGRATION.md guide
- [ ] 6.1.3 Document @metabob/vessel-discovery-client usage
- [ ] 6.1.4 Document standard configuration parameters
- [ ] 6.1.5 Update MiniBob CLAUDE.md with discovery capabilities
- [ ] 6.1.6 Update Activity-API CLAUDE.md with architecture changes

### 6.2 Testing and Quality
- [ ] 6.2.1 Write load tests: 1000 concurrent registrations
- [ ] 6.2.2 Write chaos test: Kill discovery-vessel during registration
- [ ] 6.2.3 Write chaos test: Network partition between vessels
- [ ] 6.2.4 Run all unit tests
- [ ] 6.2.5 Run all integration tests
- [ ] 6.2.6 Perform security audit of discovery endpoints

### 6.3 Monitoring
- [ ] 6.3.1 Add Prometheus metrics for discovery operations
- [ ] 6.3.2 Add Grafana dashboard for vessel health overview
- [ ] 6.3.3 Add alert: Discovery-vessel unhealthy > 5 minutes
- [ ] 6.3.4 Add alert: Vessel registration failure rate > 10%
- [ ] 6.3.5 Update runbooks for discovery incidents

---

## Summary

| Phase | Tasks | Status |
|-------|-------|--------|
| 1. Discovery-Vessel Core | 30 | Not Started |
| 2. Vessel Integrations | 35 | Not Started |
| 3. Context Acquisition | 22 | Mostly Complete |
| 4. Health/Circuit Breakers | 15 | ✅ **Deployed to Canary** (2026-04-11) |
| 5. Validation/Deployment | 16 | Blocked (Discovery-vessel needed) |
| 6. Documentation/Quality | 17 | Not Started |
| **Total** | **135** | |

---

## Deployment Notes

**2026-04-11:** Analysis-API Deployment Success
- Fixed 5 cascading deployment issues (imagePullSecrets, dependencies, image tags)
- metabob-analysis-api v0.1.2 deployed to canary (https://api.metabob.com)
- Phase 4 infrastructure validated: Circuit breaker & health scoring deployed
- See detailed reports: ANALYSIS_API_DEPLOYMENT_FIX.md, PHASE_4_VALIDATION_REPORT.md
- CI/CD workflow 24286591406 completed successfully
