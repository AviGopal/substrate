# Design: Refactor Internal Dashboard Architecture

## Context

### Current State

The `metabob-internal-dashboard` is a monolithic vessel that:
- Embeds MiniBob directly as `@metabob/minibob` dependency
- Runs activities internally via GoalProcessor and ActivityExecutor
- Makes direct REST HTTP calls to `metabob-activity-api` via `query_activity_api` tool
- Serves WebSocket UI + executes business logic in the same process
- Successfully implements impulse-driven UI rendering with primitive composition

**Architecture Violations:**
- Backend treated as universal REST resolver (violates "resolvers live where data lives")
- No vessel capability registry (violates dynamic discovery principle)
- Query results returned as raw JSON strings (violates impulse state space principle)
- Presentation and execution logic coupled in one vessel

### Foundational Principles (from IMPULSE_ACTIVITY_FOUNDATION.md)

1. **Resolvers live where data lives** - Don't centralize resolution
2. **Vessels provide capabilities** - Declare what impulse shapes can be resolved
3. **Metadata first, content later** - Impulse IDs reference content
4. **Backend only stores traces** - Not a universal resolver

### Stakeholders

- **Dashboard users**: Internal team using UI for system observability
- **MiniBob developers**: Need clear separation for autonomous development
- **Activity system architects**: Ensuring architectural alignment
- **Future vessel developers**: Pattern for vessel-to-vessel communication

## Goals / Non-Goals

**Goals:**

1. **Eliminate REST anti-patterns**: Replace direct HTTP calls with MCP impulse resolution
2. **Separate presentation from execution**: UI vessel renders, executor vessel processes
3. **Establish capability-based routing**: Vessels declare shapes, router dispatches dynamically
4. **Maintain backward compatibility**: Dashboard functionality unchanged from user perspective
5. **Create reusable patterns**: Other vessels can follow this MCP integration approach

**Non-Goals:**

- Changing UI appearance or user-facing features
- Optimizing performance beyond current baseline
- Adding new dashboard capabilities (defer to future work)
- Refactoring metabob-activity-api (separate concern)
- Changing impulse state space core concepts

## Decisions

### Decision 1: Two-Vessel Split (UI + Executor)

**Choice:** Split into `metabob-internal-dashboard-ui` (presentation) and `dashboard-executor-minibob` (execution)

**Alternatives Considered:**
1. **Keep monolithic**: Simpler deployment but perpetuates architectural violations
2. **Three vessels** (UI, query processor, activity executor): Over-engineering for current needs
3. **Merge into existing MiniBob deployments**: Loses dashboard-specific context

**Rationale:**
- Clear separation of concerns: UI vessel only resolves `ui_component`, executor handles all logic
- Aligns with "resolvers live where data lives" - UI vessel lives where rendering happens
- Enables independent scaling (more executor replicas for load, one UI replica for WebSocket hub)
- Provides clear pattern for future vessel extraction

**Implementation:**
- UI vessel: Bun server, React frontend, WebSocket broadcasting, MCP server for UI impulse resolution
- Executor vessel: Bun runtime, MiniBob library, GoalProcessor, MCP client for delegation

### Decision 2: MCP Over REST for Vessel Communication

**Choice:** Use MCP `impulse_resolve` tool calls instead of HTTP fetch to service endpoints

**Alternatives Considered:**
1. **Keep REST with better abstraction**: Still violates impulse-driven principle
2. **gRPC or GraphQL**: Over-engineered, doesn't align with impulse paradigm
3. **Message queue (Redis pub/sub)**: Adds complexity, not request/response pattern

**Rationale:**
- MCP already in use for MiniBob-to-backend communication
- Impulse resolution is the correct abstraction (shape-based, metadata-first)
- Enables capability registry routing
- Supports future caching/tracing of impulse resolution
- Aligns with foundation: data access via impulses, not endpoints

**Implementation:**
```typescript
// Before (anti-pattern)
const response = await fetch(`${ACTIVITY_API_URL}/v2/activities/templates`);
const data = await response.json();

// After (aligned)
const impulse: Impulse = {
  id: generateId(),
  shape: "activityListRequest",
  pointer: { type: "activityListRequest", filters: {} },
  loaded: false
};
const resolved = await mcpClient.callTool('impulse_resolve', { impulse, authToken });
const templates = resolved.content;
```

### Decision 3: Vessel Capability Registry in metabob-proto

**Choice:** Centralized registry in `repos/metabob-proto/src/vessel-registry.ts`

**Alternatives Considered:**
1. **Service discovery (Consul, etcd)**: Over-engineered for current scale
2. **Each vessel advertises capabilities**: Distributed but harder to reason about
3. **Hardcoded routing in each client**: Violates open/closed principle

**Rationale:**
- Proto is already shared across all services (metabob-activity-api, MiniBob, dashboard)
- TypeScript-typed for compile-time safety
- Single source of truth for "which vessel resolves which shapes"
- Easy to extend with metadata (priority, health checks, rate limits)

**Implementation:**
```typescript
// repos/metabob-proto/src/vessel-registry.ts
export interface VesselCapability {
  vessel_id: string;
  resolves: string[];  // Impulse shapes
  mcp_endpoint: string;
  metadata?: Record<string, unknown>;
}

export const vesselCapabilities: VesselCapability[] = [
  {
    vessel_id: "dashboard-ui",
    resolves: ["ui_component", "query_interface", "viewport_state"],
    mcp_endpoint: "http://internal-dashboard-ui.activity-system.svc.cluster.local:3001/mcp"
  },
  {
    vessel_id: "dashboard-executor",
    resolves: ["goal", "memo"],
    mcp_endpoint: "http://dashboard-executor.activity-system.svc.cluster.local:8080/mcp"
  },
  {
    vessel_id: "activity-db",
    resolves: ["activityListRequest", "activityTemplate", "activityMetrics", "activityExecutionTrace"],
    mcp_endpoint: "http://activity-db.activity-system.svc.cluster.local:8080/mcp"
  }
];
```

### Decision 4: WebSocket Protocol with Impulse References

**Choice:** Broadcast impulse IDs in update/delete messages, not full content

**Alternatives Considered:**
1. **Always send full impulses**: Simple but bandwidth-heavy
2. **GraphQL subscriptions**: Over-engineered, requires new infrastructure
3. **Binary protocol (protobuf)**: Optimization before measurement

**Rationale:**
- Large impulses (UI components with rich content) waste bandwidth if re-sent on every update
- Impulse IDs are universal references (SYSTEM_UNDERSTANDING.txt principle)
- Clients maintain local impulse map (React state)
- Aligns with "metadata first, content later" - ID is metadata, map lookup gets content

**Implementation:**
```typescript
// Initial sync: send full impulse
{ type: "impulse_create", impulse: { id: "ui-123", shape: "ui_component", content: {...} } }

// Update: send only ID + patch
{ type: "impulse_update", impulseId: "ui-123", patch: { "content.status": "completed" } }

// Delete: send only ID
{ type: "impulse_delete", impulseId: "ui-123" }

// Client maintains: Map<string, Impulse>
const impulseMap = new Map();
impulseMap.set("ui-123", impulse);  // On create
impulseMap.set("ui-123", { ...impulseMap.get("ui-123"), ...patch });  // On update
impulseMap.delete("ui-123");  // On delete
```

### Decision 5: Dashboard Impulse Types in Proto

**Choice:** Define `QueryInterfaceImpulse`, `QueryResultImpulse`, `UserActionImpulse`, `ViewportStateImpulse` in metabob-proto

**Alternatives Considered:**
1. **Define in UI vessel**: Couples types to single vessel
2. **Inline without types**: Loses type safety
3. **Each vessel defines its own**: Duplication and drift

**Rationale:**
- Proto is the shared type library (already has `Impulse` base type)
- TypeScript enforces structure across vessels
- Other vessels (future dashboard clones, analytics) can reuse types
- Aligns with SYSTEM_UNDERSTANDING.txt: impulse types are system-wide contracts

**Implementation:**
```typescript
// repos/metabob-proto/src/impulse-types/dashboard.ts
export interface QueryInterfaceImpulse extends Impulse {
  shape: "queryInterface";
  pointer: {
    type: "queryInterface";
    text: string;
    context?: Record<string, unknown>;
  };
  loaded: true;
}

export interface QueryResultImpulse extends Impulse {
  shape: "queryResult";
  pointer: {
    type: "queryResult";
    query: string;
    endpoint?: string;
  };
  content: any;
  metadata: {
    cached: boolean;
    timestamp: string;
    source_vessel: string;
  };
  loaded: true;
}

export interface UserActionImpulse extends Impulse {
  shape: "userAction";
  pointer: {
    type: "userAction";
    action: string;
    target?: string;
    payload?: Record<string, unknown>;
  };
  metadata: {
    ui_component_id: string;
    user_session_id: string;
    timestamp: string;
  };
  loaded: true;
}

export interface ViewportStateImpulse extends Impulse {
  shape: "viewportState";
  pointer: {
    type: "viewportState";
  };
  content: {
    width: number;
    height: number;
    devicePixelRatio: number;
    bounds?: Array<{
      componentId: string;
      x: number;
      y: number;
      width: number;
      height: number;
    }>;
  };
  loaded: true;
}
```

### Decision 6: Phased Migration Strategy

**Choice:** Incremental refactor with feature flags, not big-bang rewrite

**Alternatives Considered:**
1. **Complete rewrite in parallel**: Risky, double maintenance burden
2. **Direct cutover**: High risk if issues found in production
3. **A/B test both versions**: Over-engineered for internal dashboard

**Rationale:**
- Minimize risk by deploying changes incrementally
- Validate each phase before proceeding (MCP working before vessel split)
- Rollback strategy at each phase boundary
- Aligns with "record everything, learn from traces" - observe behavior at each step

**Migration Phases:**

**Phase 1: Add MCP Endpoints (No Breaking Changes)**
- UI vessel gains `/mcp` endpoint (coexists with WebSocket)
- Executor vessel gains `/mcp` endpoint
- Vessels registered in capability registry
- No client code changes yet
- **Validation**: MCP health checks pass, capabilities queryable
- **Rollback**: Remove MCP endpoints, no impact

**Phase 2: Replace REST with MCP (Feature Flag)**
- Add `USE_MCP_RESOLUTION` environment variable (default: false)
- When enabled, executor uses MCP instead of `query_activity_api` tool
- Both paths coexist temporarily
- **Validation**: Compare MCP responses to REST responses, measure latency
- **Rollback**: Set `USE_MCP_RESOLUTION=false`

**Phase 3: Extract Executor Vessel (Dual Deployment)**
- Create new Helm chart for dashboard-executor-minibob
- UI vessel delegates to executor via MCP (internally or externally)
- Both monolithic and split deployments work
- **Validation**: E2E tests pass on split deployment
- **Rollback**: Route traffic to monolithic deployment

**Phase 4: WebSocket Protocol Update (Backward Compatible)**
- Add impulse reference messages alongside full serialization
- Clients detect protocol version and use references if available
- Old clients still work with full serialization
- **Validation**: Bandwidth monitoring shows reduction
- **Rollback**: Disable reference protocol, full serialization fallback

**Phase 5: Deprecate Monolithic Deployment**
- Remove monolithic chart from Helm
- Update docs and runbooks
- Archive old code with deprecation tags
- **Validation**: Split deployment is stable for 1+ week
- **Rollback**: Restore monolithic chart (code still exists)

## Risks / Trade-offs

### Risk 1: Increased Latency from MCP Overhead

**Risk**: MCP adds serialization + network hop compared to direct REST calls

**Mitigation:**
- Measure baseline latency in Phase 2 with feature flag
- MCP calls within cluster (< 1ms network overhead)
- Impulse caching reduces repeated resolutions
- If latency unacceptable, optimize MCP transport (HTTP/2, connection pooling)

**Trade-off Accepted**: Slight latency increase (estimated 5-10ms) for architectural correctness

### Risk 2: Vessel Discovery Coupling via Registry

**Risk**: Centralized registry in proto creates dependency; proto updates require redeployment

**Mitigation:**
- Registry changes are infrequent (only when vessels added/changed)
- Future: Move to dynamic discovery if needed (service mesh annotations)
- Proto already required by all services (existing coupling)

**Trade-off Accepted**: Compile-time coupling for runtime flexibility and type safety

### Risk 3: WebSocket State Synchronization Complexity

**Risk**: Impulse reference protocol requires careful state management; clients out of sync if messages dropped

**Mitigation:**
- `state_sync` message on connect/reconnect provides full state
- Client detects missing references and requests re-sync
- WebSocket library (Bun native) handles reconnection automatically
- Impulse IDs are immutable (never reused after delete)

**Trade-off Accepted**: State sync complexity for bandwidth efficiency

### Risk 4: Dual-Vessel Deployment Complexity

**Risk**: More Helm charts, Kubernetes resources, monitoring surface area

**Mitigation:**
- Helm templating reduces duplication (shared base chart)
- Istio provides unified observability (both vessels in service mesh)
- Gradual rollout via phases reduces blast radius

**Trade-off Accepted**: Operational complexity for architectural alignment

### Risk 5: Proto Dependency Versioning

**Risk**: Breaking changes to impulse types in proto affect all vessels

**Mitigation:**
- Semantic versioning for proto package
- Additive changes preferred (new fields optional)
- Deprecation warnings before removals
- Integration tests validate cross-service compatibility

**Trade-off Accepted**: Coordination cost for shared type safety

## Migration Plan

### Pre-Migration Checklist

- [ ] All Phase 1 tests pass (MCP endpoints respond correctly)
- [ ] Capability registry includes all vessels
- [ ] Baseline metrics captured (latency, error rate, bandwidth)
- [ ] Feature flags implemented and tested locally

### Deployment Steps

**Phase 1: Add MCP Endpoints (Week 1)**
1. Deploy updated UI vessel with `/mcp` endpoint (backward compatible)
2. Deploy executor vessel chart (initially disabled)
3. Validate MCP health checks pass
4. Validate capability registry queries work
5. **Go/No-Go**: All health checks green

**Phase 2: Enable MCP Resolution (Week 2)**
1. Set `USE_MCP_RESOLUTION=true` on single executor replica (canary)
2. Monitor latency, error rates for 24 hours
3. Compare MCP responses to REST responses (automated diff)
4. If successful, enable on all replicas
5. **Go/No-Go**: <10ms latency increase, <1% error rate increase

**Phase 3: Split Vessels (Week 3)**
1. Deploy dashboard-executor-minibob chart
2. Route 10% of traffic to split deployment (Istio weight-based routing)
3. Monitor for 48 hours
4. Increase to 50%, then 100%
5. **Go/No-Go**: E2E tests pass, no user-reported issues

**Phase 4: Update WebSocket Protocol (Week 4)**
1. Deploy UI vessel with impulse reference protocol
2. Monitor bandwidth reduction
3. Validate clients handle updates correctly
4. **Go/No-Go**: Bandwidth reduced by 30%+, no client errors

**Phase 5: Deprecate Monolithic (Week 5+)**
1. Remove monolithic chart from Helm
2. Update runbooks and documentation
3. Archive old code in `repos/metabob-internal-dashboard-archived/`
4. **Go/No-Go**: 1 week stable split deployment

### Rollback Strategy

**Phase 1-2**: Disable feature flags, no service restart needed
**Phase 3**: Change Istio routing to 100% monolithic
**Phase 4**: Disable reference protocol via config
**Phase 5**: Restore monolithic chart from git history

### Validation Criteria

- **Latency**: P95 response time < 200ms (same as baseline)
- **Error Rate**: < 0.5% errors on impulse resolution
- **Bandwidth**: WebSocket messages reduced by 30%+
- **Uptime**: 99.9% availability during migration
- **E2E Tests**: All existing dashboard tests pass

## Open Questions

1. **Impulse caching strategy**: Should resolved impulses be cached by ID? If so, what TTL and invalidation strategy?
   - **Propose**: 5-minute TTL, LRU eviction, invalidate on `impulse_update` broadcast

2. **Executor vessel scaling**: How many replicas needed? Should it autoscale?
   - **Propose**: Start with 2 replicas, monitor CPU/memory, add HPA if needed

3. **MCP authentication**: Should MCP calls use JWT tokens or service mesh mTLS?
   - **Propose**: JWT for multi-tenancy (org isolation), mTLS for transport security

4. **Vessel health checks**: How should vessels report capability availability (degraded state)?
   - **Propose**: MCP health endpoint returns capability list + status per shape

5. **Proto versioning strategy**: How to handle breaking changes without coordinated releases?
   - **Propose**: Duplicate types during transition (e.g., `QueryInterfaceImpulseV2`), deprecate old after migration
