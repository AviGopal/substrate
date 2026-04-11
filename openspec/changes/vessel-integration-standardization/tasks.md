## Implementation Philosophy

**Logical Dependencies Over Strict Phasing:**
- Implement tasks in logical dependency order - if Task B requires output from Task A, do A first
- Phases can overlap when dependencies are satisfied - don't wait for entire phase to complete
- No backward compatibility concerns - we're implementing the correct architecture
- Focus on correctness and alignment with foundation principles, not elaborate migration paths

---

## 1. Phase 1 - Foundation (Activity-API)

- [x] 1.1 Create `shape_definition` table in SurrealDB schema
- [x] 1.2 Implement `POST /v2/shapes/register` endpoint in Activity-API
- [x] 1.3 Implement `GET /v2/shapes` endpoint for listing shapes
- [x] 1.4 Implement `GET /v2/shapes/:name/:version` endpoint for shape retrieval
- [x] 1.5 Add shape validation logic using JSON schema
- [x] 1.6 Create `vessel` table enhancements for VesselCapabilityV2 format
- [x] 1.7 Implement `POST /v2/vessels/register` endpoint for vessel registration
- [x] 1.8 Implement `GET /v2/vessels/discover` endpoint for capability discovery
- [x] 1.9 Add vessel health score computation logic
- [x] 1.10 Create `routing_trace` table for routing decision traces
- [x] 1.11 Create `circuit_breaker_trace` table for circuit breaker events
- [x] 1.12 Add shape versioning and compatibility validation
- [x] 1.13 Register 8 bootstrap shapes (goal, error_log, source_code, trace, etc.)
- [x] 1.14 Write unit tests for shape registry endpoints
- [x] 1.15 Write unit tests for vessel discovery endpoints

## 2. Phase 1 - Foundation (Analysis-API)

- [x] 2.1 Implement `POST /v2/impulses/resolve` endpoint in Analysis-API
- [x] 2.2 Add resolver for `problem_detection` impulse shape
- [x] 2.3 Add resolver for `error_log` impulse shape
- [x] 2.4 Add resolver for `source_code` impulse shape
- [x] 2.5 Implement `GET /health` endpoint with detailed status
- [x] 2.6 Implement `GET /capabilities` endpoint returning VesselCapabilityV2
- [x] 2.7 Add startup registration call to Activity-API `/v2/vessels/register`
- [x] 2.8 Add execution tracing for impulse resolution performance
- [x] 2.9 Register shape definitions for produced shapes on startup
- [x] 2.10 Write integration tests for direct impulse resolution
- [x] 2.11 Update API documentation for new endpoints

## 3. Phase 1 - Validation and Deployment

- [x] 3.1 Deploy Activity-API changes to canary environment
- [x] 3.2 Deploy Analysis-API changes to canary environment
- [x] 3.3 Verify shape registry endpoints respond correctly
- [x] 3.4 Verify vessel discovery endpoints list Analysis-API
- [x] 3.5 Test direct Analysis-API impulse resolution via curl
- [x] 3.6 Verify vessel registration persists in SurrealDB
- [x] 3.7 Monitor canary logs for errors (48 hours)
- [x] 3.8 Promote to production after validation

## 4. Phase 2 - MiniBob Config and mTLS

- [x] 4.1 Update MiniBob config schema to support `vessels.analysis` section
- [x] 4.2 Add mTLS configuration fields (cert, key, ca paths)
- [x] 4.3 Implement config validation on MiniBob startup
- [x] 4.4 Add validation checks: URL reachability, mTLS cert validity, API key validity
- [x] 4.5 Implement graceful degradation for unreachable vessels
- [x] 4.6 Add actionable error messages for config issues
- [x] 4.7 Create `./scripts/generate-dev-mtls-certs.sh` for local development
- [x] 4.8 Update Docker Compose to include certificate generation
- [x] 4.9 Add `DISABLE_MTLS=true` option for local dev mode
- [x] 4.10 Document mTLS setup in DEPLOYMENT_WORKFLOW.md
- [x] 4.11 Write unit tests for config validation logic

## 5. Phase 2 - MiniBob Direct Integration

- [x] 5.1 Implement mTLS client in MiniBob for vessel-to-vessel communication
- [x] 5.2 Add fallback resolution logic: local → vessel direct → Activity-API routing
- [x] 5.3 Update impulse resolver to try Analysis-API direct for analysis shapes
- [x] 5.4 Add `resolved_by_vessel_id` field to execution traces
- [x] 5.5 Add `impulse_resolutions` array to trace detailed resolution tracking
- [x] 5.6 Remove SurrealDB credential requirements from MiniBob config
- [x] 5.7 Update Helm chart with mTLS certificate secret mounts
- [x] 5.8 Add cert-manager integration for production mTLS renewal
- [x] 5.9 Write integration tests for vessel-to-vessel authentication
- [x] 5.10 Write integration tests for fallback resolution logic

## 6. Phase 2 - MiniBob Context Acquisition Activities

- [x] 6.1 Create `acquire-error-log-context.json` activity template
- [x] 6.2 Implement error log parsing logic (stack traces, error messages)
- [x] 6.3 Define `error_log` impulse shape schema
- [x] 6.4 Create `acquire-requirements-context.json` activity template
- [x] 6.5 Implement requirements parsing logic (markdown, spec files)
- [x] 6.6 Define `requirement` impulse shape schema
- [x] 6.7 Create `acquire-codebase-context.json` activity template
- [x] 6.8 Implement codebase structure analysis (file tree, entry points)
- [x] 6.9 Define `codebase_structure` impulse shape schema
- [x] 6.10 Register all 3 context acquisition activities in Activity-API
- [x] 6.11 Integrate context acquisition into goal-processor workflow
- [x] 6.12 Write unit tests for each context acquisition activity
- [x] 6.13 Write integration tests for goal-seeking with context

## 7. Phase 2 - Validation and Deployment

- [x] 7.1 Deploy MiniBob changes to canary environment
- [x] 7.2 Run `minibob --validate-config` on canary instance
- [x] 7.3 Test direct Analysis-API resolution with `--trace` flag
- [x] 7.4 Verify `resolved_by_vessel_id` appears in traces
- [x] 7.5 Test context acquisition activities end-to-end
- [x] 7.6 Verify error_log, requirement, and codebase_structure impulses created
- [x] 7.7 Test graceful degradation when Analysis-API unavailable
- [x] 7.8 Monitor canary metrics for 72 hours
- [x] 7.9 Promote to production after validation

## 8. Phase 3 - MiniBob Goal Orchestrators

- [x] 8.1 Create `orchestrate-test-goal.json` activity template
- [x] 8.2 Implement test orchestration logic (acquire context → generate → run → report)
- [x] 8.3 Add child activity composition for test workflow
- [x] 8.4 Add success validation for test creation and execution
- [x] 8.5 Create `orchestrate-refactor-goal.json` activity template
- [x] 8.6 Implement refactor orchestration logic (analyze → transform → validate)
- [x] 8.7 Add child activity composition for refactor workflow
- [x] 8.8 Add rollback logic for failed refactoring
- [x] 8.9 Register both orchestrator activities in Activity-API
- [x] 8.10 Integrate orchestrators into goal-processor routing
- [x] 8.11 Write unit tests for orchestration logic
- [x] 8.12 Write integration tests for `goal:test` end-to-end
- [x] 8.13 Write integration tests for `goal:refactor` end-to-end

## 9. Phase 3 - Validation and Deployment

- [ ] 9.1 Deploy MiniBob changes to canary environment
- [ ] 9.2 Test `minibob --single "test the authentication module"`
- [ ] 9.3 Verify test orchestrator executes all child activities
- [ ] 9.4 Test `minibob --single "refactor user service to use repository pattern"`
- [ ] 9.5 Verify refactor orchestrator with codebase analysis
- [ ] 9.6 Verify composition graph snapshot in traces
- [ ] 9.7 Monitor canary for orchestrator failures (48 hours)
- [ ] 9.8 Promote to production after validation

## 10. Phase 4 - Circuit Breaker and Health Scoring

- [x] 10.1 Implement circuit breaker state machine (CLOSED → OPEN → HALF_OPEN)
- [x] 10.2 Add circuit breaker logic to Activity-API impulse routing
- [x] 10.3 Configure circuit breaker thresholds (opens when EITHER: 5 consecutive failures OR failure rate ≥ 50% over 60-second window; half-open after 30s timeout)
- [x] 10.4 Implement `POST /v2/vessels/heartbeat` endpoint in Activity-API
- [x] 10.5 Add heartbeat sending logic to MiniBob (every 60 seconds)
- [x] 10.6 Add heartbeat sending logic to Analysis-API (every 60 seconds)
- [x] 10.7 Implement health score computation (success rate, latency, availability)
- [x] 10.8 Add exponential moving average for health metrics
- [x] 10.9 Add latency-based penalties to health score
- [x] 10.10 Add heartbeat freshness factor to health score
- [x] 10.11 Implement gradual decay and alert thresholds
- [x] 10.12 Add circuit breaker state to routing decision traces
- [x] 10.13 Write unit tests for circuit breaker state machine
- [x] 10.14 Write unit tests for health score computation

## 11. Phase 4 - Routing Traces and Learning Integration

- [x] 11.1 Implement routing trace recording in Activity-API `/v2/impulses/resolve`
- [x] 11.2 Add trace fields: candidates, selected, selection_reason, latency
- [x] 11.3 Implement circuit breaker event tracing
- [x] 11.4 Add trace fields: vessel_id, event, consecutive_failures, health_score
- [x] 11.5 Implement sampling for routing traces (100% failures, 10% successes)
- [x] 11.6 Add async trace writing via queue (non-blocking)
- [x] 11.7 Implement batch writing (buffer 100 traces)
- [x] 11.8 Add TTL for routing traces (30 days)
- [x] 11.9 Add monitoring alert for trace queue depth > 1000
- [x] 11.10 Integrate routing traces into dashboard visualization
- [x] 11.11 Add Thompson Sampling on routing decisions (learn optimal vessel)
- [x] 11.12 Write integration tests for trace capture

## 12. Phase 4 - Validation and Deployment

- [ ] 12.1 Deploy Activity-API changes to canary environment
- [ ] 12.2 Deploy vessel changes (heartbeat logic) to canary
- [ ] 12.3 Simulate vessel failure (stop Analysis-API pod)
- [ ] 12.4 Trigger 5 impulse resolutions to open circuit breaker
- [ ] 12.5 Verify circuit breaker state = "open" via API
- [ ] 12.6 Restart Analysis-API and verify half-open state after 30s
- [ ] 12.7 Verify circuit closes after successful resolution
- [ ] 12.8 Verify routing traces appear in SurrealDB
- [ ] 12.9 Verify dashboard shows routing decision visualizations
- [ ] 12.10 Monitor canary for false positives (72 hours)
- [ ] 12.11 Promote to production after validation

## 13. Phase 5 - Remove Proxy Pattern

- [ ] 13.1 Remove Analysis-API proxy logic from Activity-API `/v2/impulses/resolve`
- [ ] 13.2 Update routing logic to only handle unknown shapes
- [ ] 13.3 Add error response for direct Analysis-API shapes: "Use vessel-direct resolution"
- [ ] 13.4 Verify backward compatibility for unknown shapes routing
- [ ] 13.5 Deploy to canary environment
- [ ] 13.6 Test that Activity-API rejects `error_log` shape resolution
- [ ] 13.7 Test that Activity-API still routes `unknown_shape` to vessels
- [ ] 13.8 Monitor error rate for 48 hours
- [ ] 13.9 Verify no regression in overall system performance
- [ ] 13.10 Promote to production after validation

## 14. Documentation and Migration Guides

- [ ] 14.1 Update DEPLOYMENT_WORKFLOW.md with mTLS setup instructions
- [ ] 14.2 Create MIGRATION.md with step-by-step upgrade guide
- [ ] 14.3 Document VesselCapabilityV2 format specification
- [ ] 14.4 Document shape registry API endpoints
- [ ] 14.5 Document vessel discovery API endpoints
- [ ] 14.6 Document circuit breaker configuration options
- [ ] 14.7 Document health score computation algorithm
- [ ] 14.8 Add examples for context acquisition activities
- [ ] 14.9 Add examples for goal orchestrator activities
- [ ] 14.10 Update MiniBob CLAUDE.md with new capabilities
- [ ] 14.11 Update Activity-API CLAUDE.md with new endpoints
- [ ] 14.12 Update Analysis-API CLAUDE.md with direct integration

## 15. Testing and Quality Assurance

- [ ] 15.1 Write load tests: 1000 concurrent impulse resolutions
- [ ] 15.2 Write load tests: 10k routing decisions with trace capture
- [ ] 15.3 Write chaos test: Kill Analysis-API during resolution
- [ ] 15.4 Write chaos test: Expire mTLS certificate
- [ ] 15.5 Write chaos test: SurrealDB connection loss
- [ ] 15.6 Run all unit tests across all services
- [ ] 15.7 Run all integration tests across all services
- [ ] 15.8 Run load tests in staging environment
- [ ] 15.9 Run chaos tests in staging environment
- [ ] 15.10 Perform security audit of mTLS implementation
- [ ] 15.11 Perform security audit of API key handling
- [ ] 15.12 Verify trace data doesn't leak credentials

## 16. Monitoring and Observability

- [ ] 16.1 Add Prometheus metrics for circuit breaker state
- [ ] 16.2 Add Prometheus metrics for health scores
- [ ] 16.3 Add Prometheus metrics for routing decisions
- [ ] 16.4 Add Prometheus metrics for trace queue depth
- [ ] 16.5 Add Grafana dashboard for vessel health overview
- [ ] 16.6 Add Grafana dashboard for routing performance
- [ ] 16.7 Add Grafana dashboard for circuit breaker events
- [ ] 16.8 Add alert: Circuit breaker open for > 5 minutes
- [ ] 16.9 Add alert: Health score < 0.3 for > 10 minutes
- [ ] 16.10 Add alert: Trace queue depth > 1000
- [ ] 16.11 Add alert: mTLS certificate expiring in < 7 days
- [ ] 16.12 Update runbooks for circuit breaker incidents
