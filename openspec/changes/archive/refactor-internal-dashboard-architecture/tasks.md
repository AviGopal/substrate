# Implementation Tasks: Refactor Internal Dashboard Architecture

## 1. Proto Package Foundation

- [ ] 1.1 Create `repos/metabob-proto/src/vessel-registry.ts` with `VesselCapability` interface
- [ ] 1.2 Define initial vessel capability entries for dashboard-ui, dashboard-executor, and activity-db
- [ ] 1.3 Create `repos/metabob-proto/src/impulse-types/dashboard.ts` with QueryInterface, QueryResult, UserAction, ViewportState impulse types
- [ ] 1.4 Export new types and registry from `repos/metabob-proto/src/index.ts`
- [ ] 1.5 Build and publish proto package (or link locally for development)

## 2. Dashboard UI Vessel - MCP Endpoint

- [ ] 2.1 Create `repos/metabob-internal-dashboard-ui/` directory structure
- [ ] 2.2 Copy existing WebSocket server code from `repos/metabob-internal-dashboard/src/index.ts`
- [ ] 2.3 Remove MiniBob dependency from `package.json`
- [ ] 2.4 Add `@metabob/proto` dependency
- [ ] 2.5 Create `src/mcp/server.ts` with MCP server implementation
- [ ] 2.6 Implement `impulse_resolve` tool for `ui_component` shape
- [ ] 2.7 Implement `impulse_resolve` tool for `query_interface` shape (captures user input)
- [ ] 2.8 Implement `impulse_resolve` tool for `viewport_state` shape (returns browser dimensions)
- [ ] 2.9 Add `/mcp` HTTP endpoint to Bun server
- [ ] 2.10 Add health check that returns vessel capabilities

## 3. Dashboard UI Vessel - WebSocket Protocol Update

- [ ] 3.1 Update WebSocket handler to support impulse reference messages (`impulse_update`, `impulse_delete`)
- [ ] 3.2 Implement `impulse_create` message format with full impulse
- [ ] 3.3 Implement `impulse_update` message format with ID + patch
- [ ] 3.4 Implement `impulse_delete` message format with ID only
- [ ] 3.5 Add `state_sync` message on client connect/reconnect
- [ ] 3.6 Update React hook `useMiniBobConnection` to maintain local impulse Map
- [ ] 3.7 Implement impulse map operations (add, update, delete) in hook
- [ ] 3.8 Update `ImpulseRenderer.tsx` to lookup impulses by ID from map

## 4. Dashboard Executor Vessel - New Deployment

- [ ] 4.1 Create `repos/dashboard-executor-minibob/` directory structure
- [ ] 4.2 Initialize `package.json` with dependencies: `@metabob/minibob`, `@metabob/proto`, `bun`
- [ ] 4.3 Create `src/index.ts` as Bun HTTP server entry point
- [ ] 4.4 Copy MiniBob integration code from `repos/metabob-internal-dashboard/src/lib/minibob-integration.ts`
- [ ] 4.5 Remove UI-specific tools (create_ui_component, update_ui_component, delete_ui_component)
- [ ] 4.6 Create `src/mcp/server.ts` with MCP server implementation
- [ ] 4.7 Implement MCP `impulse_resolve` tool for `goal` shape (processes queries via GoalProcessor)
- [ ] 4.8 Implement MCP `impulse_resolve` tool for `memo` shape (creates internal notes)
- [ ] 4.9 Add `/mcp` HTTP endpoint to expose MCP server
- [ ] 4.10 Create health check endpoint that returns vessel capabilities

## 5. Dashboard Executor Vessel - MCP Client for Delegation

- [ ] 5.1 Create `src/mcp/client.ts` with MCP client for calling other vessels
- [ ] 5.2 Implement `resolveImpulse()` function that uses vessel registry to route by shape
- [ ] 5.3 Replace `query_activity_api` tool with impulse creation + resolution pattern
- [ ] 5.4 Create `activityListRequest` impulse and resolve via activity-db vessel MCP
- [ ] 5.5 Create `activityTemplate` impulse and resolve via activity-db vessel MCP
- [ ] 5.6 Create `activityMetrics` impulse and resolve via activity-db vessel MCP
- [ ] 5.7 Wrap resolved data in `queryResult` impulses instead of returning raw JSON
- [ ] 5.8 Create `ui_component` impulses for results and send to dashboard-ui vessel via MCP

## 6. Activity Database Vessel - MCP Endpoint (New Requirement)

- [ ] 6.1 Add MCP server to `repos/metabob-activity-api/src/mcp/server.ts`
- [ ] 6.2 Implement `impulse_resolve` tool for `activityListRequest` shape
- [ ] 6.3 Implement `impulse_resolve` tool for `activityTemplate` shape
- [ ] 6.4 Implement `impulse_resolve` tool for `activityMetrics` shape
- [ ] 6.5 Implement `impulse_resolve` tool for `activityExecutionTrace` shape
- [ ] 6.6 Add `/mcp` HTTP endpoint to Hono server
- [ ] 6.7 Register activity-db vessel in capability registry with supported shapes

## 7. Helm Charts - Dashboard UI Vessel

- [ ] 7.1 Create `helm/charts/metabob-internal-dashboard-ui/` chart structure
- [ ] 7.2 Create `Chart.yaml` with metadata
- [ ] 7.3 Create `values.yaml` with configuration (port 3001, no MiniBob dependencies)
- [ ] 7.4 Create `templates/deployment.yaml` for UI vessel deployment
- [ ] 7.5 Create `templates/service.yaml` for ClusterIP service
- [ ] 7.6 Create `templates/secret.yaml` for environment variables
- [ ] 7.7 Update `helm/helmfile-activity-system.yaml` to include UI vessel chart
- [ ] 7.8 Add Istio VirtualService for `internal.metabob.local` routing to UI vessel

## 8. Helm Charts - Dashboard Executor Vessel

- [ ] 8.1 Create `helm/charts/dashboard-executor-minibob/` chart structure
- [ ] 8.2 Create `Chart.yaml` with metadata
- [ ] 8.3 Create `values.yaml` with configuration (port 8080, MiniBob + proto dependencies)
- [ ] 8.4 Create `templates/deployment.yaml` for executor vessel deployment (2 replicas)
- [ ] 8.5 Create `templates/service.yaml` for ClusterIP service
- [ ] 8.6 Create `templates/secret.yaml` for ANTHROPIC_API_KEY and other secrets
- [ ] 8.7 Update `helm/helmfile-activity-system.yaml` to include executor vessel chart
- [ ] 8.8 Configure environment variables: `ACTIVITY_DB_MCP_ENDPOINT`, `DASHBOARD_UI_MCP_ENDPOINT`

## 9. Docker Images

- [ ] 9.1 Create `repos/metabob-internal-dashboard-ui/Dockerfile` (multi-stage: builder + production)
- [ ] 9.2 Update UI Dockerfile to exclude MiniBob, build only frontend + server
- [ ] 9.3 Create `repos/dashboard-executor-minibob/Dockerfile` (multi-stage)
- [ ] 9.4 Update executor Dockerfile to include MiniBob library
- [ ] 9.5 Update `scripts/build-vessels.sh` to build both UI and executor images
- [ ] 9.6 Test local image builds for both vessels

## 10. Testing - Unit Tests

- [ ] 10.1 Write tests for vessel capability registry (find by shape, handle missing shapes)
- [ ] 10.2 Write tests for dashboard impulse type validation (QueryInterface, QueryResult, etc.)
- [ ] 10.3 Write tests for UI vessel MCP endpoint (resolve ui_component, query_interface, viewport_state)
- [ ] 10.4 Write tests for executor vessel MCP endpoint (resolve goal, memo)
- [ ] 10.5 Write tests for impulse resolution routing (mock registry, verify correct vessel called)
- [ ] 10.6 Write tests for WebSocket protocol (impulse_create, impulse_update, impulse_delete messages)

## 11. Testing - Integration Tests

- [ ] 11.1 Create E2E test: User submits query → UI vessel creates impulse → executor processes → UI renders result
- [ ] 11.2 Create E2E test: Executor requests activity list → activity-db vessel resolves → executor receives data
- [ ] 11.3 Create E2E test: Multiple vessels registered → router selects correct vessel by shape
- [ ] 11.4 Create E2E test: WebSocket client receives state_sync on connect → impulse_update on change
- [ ] 11.5 Create E2E test: Impulse reference protocol reduces bandwidth (measure message sizes)
- [ ] 11.6 Create E2E test: MCP authentication with JWT token enforcement

## 12. Phase 1 Deployment - Add MCP Endpoints (No Breaking Changes)

- [ ] 12.1 Deploy updated proto package to all services
- [ ] 12.2 Deploy activity-db vessel with new MCP endpoint (backward compatible)
- [ ] 12.3 Verify MCP health checks pass for activity-db vessel
- [ ] 12.4 Deploy dashboard-executor vessel (new deployment)
- [ ] 12.5 Verify executor MCP endpoint accessible and returns capabilities
- [ ] 12.6 Run integration tests against deployed vessels
- [ ] 12.7 Validate vessel capability registry queries work correctly

## 13. Phase 2 Deployment - Enable MCP Resolution (Feature Flag)

- [ ] 13.1 Add `USE_MCP_RESOLUTION` environment variable to executor vessel (default: false)
- [ ] 13.2 Implement feature flag logic in executor: use MCP if true, REST if false
- [ ] 13.3 Deploy executor with flag disabled
- [ ] 13.4 Enable flag on one replica (canary deployment)
- [ ] 13.5 Monitor latency and error rates for 24 hours
- [ ] 13.6 Compare MCP responses to REST responses (automated diff)
- [ ] 13.7 Enable flag on all replicas if validation passes
- [ ] 13.8 Remove REST code paths after successful rollout

## 14. Phase 3 Deployment - Split UI Vessel (Dual Deployment)

- [ ] 14.1 Deploy dashboard-ui vessel chart (initially receives no traffic)
- [ ] 14.2 Configure Istio to route 10% of traffic to UI vessel, 90% to monolithic
- [ ] 14.3 Monitor error rates, latency for 48 hours
- [ ] 14.4 Increase traffic to 50% if validation passes
- [ ] 14.5 Increase traffic to 100% after another 48 hours
- [ ] 14.6 Remove monolithic dashboard deployment
- [ ] 14.7 Update documentation to reflect new architecture

## 15. Phase 4 Deployment - WebSocket Protocol Update

- [ ] 15.1 Deploy UI vessel with impulse reference protocol enabled
- [ ] 15.2 Verify backward compatibility (old clients still work with full serialization)
- [ ] 15.3 Monitor WebSocket bandwidth metrics
- [ ] 15.4 Validate 30%+ bandwidth reduction
- [ ] 15.5 Deploy updated React client with impulse map support
- [ ] 15.6 Remove full serialization fallback after all clients updated

## 16. Phase 5 Deployment - Deprecate Monolithic

- [ ] 16.1 Verify split deployment stable for 1 week
- [ ] 16.2 Remove monolithic chart from `helm/helmfile-activity-system.yaml`
- [ ] 16.3 Archive old dashboard code to `repos/metabob-internal-dashboard-archived/`
- [ ] 16.4 Update `CLAUDE.md` with new architecture documentation
- [ ] 16.5 Update runbooks and deployment guides
- [ ] 16.6 Create migration summary document with lessons learned

## 17. Documentation and Cleanup

- [ ] 17.1 Update `docs/architecture/IMPULSE_ACTIVITY_FOUNDATION.md` with vessel capability registry pattern
- [ ] 17.2 Create `docs/guides/VESSEL_TO_VESSEL_COMMUNICATION.md` guide for future vessels
- [ ] 17.3 Document impulse reference protocol in `docs/protocols/WEBSOCKET_IMPULSE_PROTOCOL.md`
- [ ] 17.4 Update dashboard README with new architecture diagrams
- [ ] 17.5 Create troubleshooting guide for MCP resolution issues
- [ ] 17.6 Add metrics dashboards for impulse resolution latency and error rates

## 18. Validation and Monitoring

- [ ] 18.1 Set up Prometheus metrics for MCP call duration, error rates
- [ ] 18.2 Create Grafana dashboards for vessel-to-vessel communication
- [ ] 18.3 Configure alerts for MCP endpoint failures
- [ ] 18.4 Validate P95 latency < 200ms across all phases
- [ ] 18.5 Validate error rate < 0.5% on impulse resolution
- [ ] 18.6 Confirm WebSocket bandwidth reduction > 30%
- [ ] 18.7 Run full E2E test suite against production deployment
- [ ] 18.8 Conduct user acceptance testing with internal team
