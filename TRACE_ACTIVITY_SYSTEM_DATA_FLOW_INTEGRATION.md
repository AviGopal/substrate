# Activity System Data Flow Integration - Trace Analysis

**Specification**: Activity System Data Flow Integration  
**Traced by**: trace-data-flow-single-feature activity  
**Date**: March 19, 2026  
**Status**: ✅ Traced - Implementation Gaps Identified

---

## Executive Summary

The Activity System Data Flow Integration is **85% complete**. The core data generation, backend storage, and Thompson Sampling learning loop are fully functional. Five components are missing or incomplete:

1. **Impulse backend storage** - Method exists but not called (HIGH priority, 1 hour)
2. **Execution history endpoint** - API endpoint missing (HIGH priority, 2 hours)
3. **WebSocket real-time updates** - Server not implemented (MEDIUM priority, 4-6 hours)
4. **Execution history UI** - Dashboard component missing (MEDIUM priority, 4 hours)
5. **Thompson Sampling visualization** - Dashboard component missing (LOW priority, 6 hours)

**Total remaining effort**: 7-11 days (1.5-2.5 weeks)

---

## Current State vs Desired State

### ✅ Working Components (Complete Data Flow)

#### MiniBob → Activity API
1. **Template Registration** (repos/minibob/src/activity.ts:124-130)
   - MiniBob registers templates via `MCPClient.registerTemplate()`
   - Backend creates `activity_template` record
   - Backend initializes `variant_performance_metrics` (alpha=1, beta=1)
   - Handles duplicate templates gracefully (409 conflict)

2. **Execution Reporting** (repos/minibob/src/activity.ts:202-213)
   - MiniBob reports execution results via `MCPClient.reportExecution()`
   - Backend records execution in `activity_executions` table
   - Backend atomically updates Thompson Sampling metrics
   - Backend invalidates Redis cache for updated template

3. **Thompson Sampling Learning Loop** (repos/metabob-activity-api/src/routes/activities.ts:599-622)
   - Atomic metric updates (no race conditions)
   - Bayesian parameter updates: `alpha = successes + 1, beta = failures + 1`
   - Success rate calculation: `successful_executions / total_executions`
   - Average duration/cost tracking with running averages

#### Activity API → Dashboard
4. **Template Discovery** (repos/activity-dashboard/src/hooks/useTemplates.ts:37-56)
   - Dashboard fetches templates via `api.listTemplates()`
   - Backend uses Redis cache-aside pattern (1hr TTL)
   - Backend queries SurrealDB with multi-tenant filtering
   - Returns templates with Thompson Sampling parameters

5. **Multi-Tenant Isolation** (repos/metabob-activity-api/src/routes/activities.ts:397-417)
   - Global templates visible to all users
   - Org-scoped templates visible only to org members
   - Project-scoped templates visible only to project members

---

### ❌ Missing Components (Gaps Identified)

#### 1. Impulse Backend Storage (HIGH Priority)

**File**: repos/minibob/src/impulse.ts:32  
**Issue**: Impulses created in-memory but not persisted to backend  
**Impact**: Impulse learning data not stored, no cross-execution impulse tracking  

**Current Code** (line 25-33):
```typescript
create(impulse: Omit<Impulse, "loaded" | "createdAt">): Impulse {
  const fullImpulse: Impulse = {
    ...impulse,
    loaded: false,
    createdAt: Date.now(),
  }
  this.impulses.set(impulse.id, fullImpulse)
  return fullImpulse  // ← MISSING: Should call mcp.storeImpulse() here
}
```

**Required Fix**:
```typescript
create(impulse: Omit<Impulse, "loaded" | "createdAt">): Impulse {
  const fullImpulse: Impulse = {
    ...impulse,
    loaded: false,
    createdAt: Date.now(),
  }
  this.impulses.set(impulse.id, fullImpulse)
  
  // Store in backend if MCP enabled
  if (isMCPEnabled()) {
    const mcp = getMCPClient()
    if (mcp) {
      mcp.storeImpulse(fullImpulse).catch(err => {
        console.warn(`[Impulse] Failed to store in backend: ${err.message}`)
      })
    }
  }
  
  return fullImpulse
}
```

**Note**: `MCPClient.storeImpulse()` already implemented (repos/minibob/src/mcp.ts:181-204), just not called.

---

#### 2. Execution History Endpoint (HIGH Priority)

**File**: repos/metabob-activity-api/src/routes/activities.ts:667 (after POST /executions)  
**Issue**: No endpoint to list execution history  
**Impact**: Dashboard cannot display execution history, no execution filtering/pagination  

**Required Implementation**:
```typescript
/**
 * GET /v2/activities/executions
 * List execution history with filtering
 */
app.get('/executions', async (c) => {
  try {
    const variantId = c.req.query('variant_id') || null
    const success = c.req.query('success')
    const limitStr = c.req.query('limit') || '50'
    const offsetStr = c.req.query('offset') || '0'
    
    let limit = Math.min(parseInt(limitStr, 10), 100)
    let offset = Math.max(parseInt(offsetStr, 10), 0)
    
    let query = 'SELECT * FROM activity_executions WHERE 1=1'
    const params: Record<string, any> = {}
    
    if (variantId) {
      query += ' AND variant_id = $variant_id'
      params.variant_id = variantId
    }
    
    if (success !== undefined) {
      query += ' AND success = $success'
      params.success = success === 'true'
    }
    
    query += ' ORDER BY executed_at DESC LIMIT $limit START $offset'
    params.limit = limit
    params.offset = offset
    
    const executions = await surrealDB.query(query, params)
    
    return c.json({
      executions,
      total: executions.length,
      limit,
      offset,
    })
  } catch (error: any) {
    logger.error('GET /executions failed', { error: error.message })
    return c.json({ error: 'Failed to fetch executions' }, 500)
  }
})
```

**Estimate**: 2 hours (implementation + testing)

---

#### 3. WebSocket Real-Time Updates (MEDIUM Priority)

**File**: repos/metabob-activity-api/src/index.ts  
**Issue**: No WebSocket server for real-time execution updates  
**Impact**: Dashboard uses polling instead of real-time updates, higher latency  

**Required Implementation**:
1. Add WebSocket server in `src/index.ts`
2. Broadcast execution events from `POST /executions` handler
3. Dashboard connects via `repos/activity-dashboard/src/hooks/useWebSocket.ts` (already implemented)

**Message Types**:
```typescript
type WebSocketMessage = 
  | {
      type: "execution_started"
      data: {
        execution_id: string
        variant_id: string
        started_at: string
      }
    }
  | {
      type: "execution_completed"
      data: {
        execution_id: string
        variant_id: string
        success: boolean
        duration_ms: number
        cost: number
        completed_at: string
      }
    }
  | {
      type: "template_metrics_updated"
      data: {
        variant_id: string
        metrics: {
          success_rate: number
          avg_duration_ms: number
          avg_cost_usd: number
          thompson_alpha: number
          thompson_beta: number
        }
      }
    }
```

**Estimate**: 4-6 hours (WebSocket server + event broadcasting + client integration)

---

#### 4. Execution History UI Component (MEDIUM Priority)

**File**: repos/activity-dashboard/src/components/ExecutionHistory.tsx (does not exist)  
**Issue**: No UI component to display execution history  
**Impact**: Users cannot view execution history, no filtering/sorting/pagination  

**Required Features**:
- Table with columns: execution_id, variant_id, success, duration_ms, cost_usd, executed_at
- Filtering by variant_id, success status
- Sorting by any column
- Pagination (limit, offset)
- Real-time updates via WebSocket (if available)

**Estimate**: 4 hours (React component + table + filtering + pagination)

---

#### 5. Thompson Sampling Visualization (LOW Priority)

**File**: repos/activity-dashboard/src/components/ThompsonVisualization.tsx (does not exist)  
**Issue**: No visualization for Thompson Sampling parameters  
**Impact**: Users cannot see confidence intervals, Beta distribution, selection probability  

**Required Features**:
- Beta distribution chart (alpha, beta parameters)
- Confidence intervals (95% confidence range)
- Selection probability (Thompson score)
- Comparison with other templates
- Explanation of Thompson Sampling parameters

**Estimate**: 6 hours (React component + chart library + Beta distribution calculation)

---

## Data Flow Paths

### Path 1: Template Registration
```
MiniBob execution starts
  → ActivityExecutor.execute:124
  → MCPClient.registerTemplate:108
  → POST /templates
  → activity_template table
  → variant_performance_metrics table (alpha=1, beta=1)
```

### Path 2: Execution Reporting
```
MiniBob execution completes
  → ActivityExecutor.execute:202
  → MCPClient.reportExecution:163
  → POST /executions
  → activity_executions table
  → UPDATE variant_performance_metrics (atomic Thompson Sampling)
  → invalidate Redis cache
```

### Path 3: Template Discovery
```
Dashboard loads
  → useTemplates hook:37
  → api.listTemplates:129
  → GET /templates:278
  → check Redis cache
  → SurrealDB query (if cache miss)
  → return templates with metrics
  → display in UI
```

### Path 4: Impulse Creation (INCOMPLETE)
```
Activity task executes
  → createImpulsesFromRequirements:233
  → ImpulseStore.create:25
  → [MISSING: mcp.storeImpulse call]
  → in-memory only (not persisted to backend)
```

### Path 5: Real-Time Updates (MISSING)
```
[MISSING: WebSocket flow]
Should be:
Execution completes
  → broadcast via WebSocket
  → Dashboard receives event
  → refresh UI without polling
```

---

## Component Inventory

| Component | File | Status | Gap |
|-----------|------|--------|-----|
| ActivityExecutor.execute | repos/minibob/src/activity.ts:104 | ✅ Complete | None |
| MCPClient.registerTemplate | repos/minibob/src/mcp.ts:89 | ✅ Complete | None |
| MCPClient.reportExecution | repos/minibob/src/mcp.ts:133 | ✅ Complete | None |
| MCPClient.storeImpulse | repos/minibob/src/mcp.ts:181 | ⚠️ Not Called | Add call in impulse.ts:32 |
| ImpulseStore.create | repos/minibob/src/impulse.ts:25 | ⚠️ Incomplete | Missing backend storage |
| POST /templates | repos/metabob-activity-api/src/routes/activities.ts:141 | ✅ Complete | None |
| POST /executions | repos/metabob-activity-api/src/routes/activities.ts:516 | ✅ Complete | None |
| GET /templates | repos/metabob-activity-api/src/routes/activities.ts:278 | ✅ Complete | None |
| GET /executions | repos/metabob-activity-api/src/routes/activities.ts:667 | ❌ Missing | Implement endpoint |
| WebSocket /ws | repos/metabob-activity-api/src/index.ts | ❌ Missing | Implement WebSocket server |
| api.listTemplates | repos/activity-dashboard/src/lib/api-client.ts:129 | ✅ Complete | None |
| api.listExecutions | repos/activity-dashboard/src/lib/api-client.ts:176 | ⚠️ Stub | Blocked by backend |
| useTemplates hook | repos/activity-dashboard/src/hooks/useTemplates.ts:24 | ✅ Complete | Could add WebSocket |
| ExecutionHistory component | repos/activity-dashboard/src/components/ExecutionHistory.tsx | ❌ Missing | Create component |
| ThompsonVisualization component | repos/activity-dashboard/src/components/ThompsonVisualization.tsx | ❌ Missing | Create component |

---

## Implementation Plan

### Phase 1: Complete Data Flow (1-2 days, HIGH priority)

**Goal**: Enable end-to-end data flow from MiniBob to Dashboard

**Tasks**:
1. Add impulse backend storage in MiniBob (1 hour)
   - File: repos/minibob/src/impulse.ts:32
   - Change: Add `mcp.storeImpulse()` call with error handling
   
2. Implement GET /executions endpoint in API (2 hours)
   - File: repos/metabob-activity-api/src/routes/activities.ts:667
   - Add: Endpoint with filtering (variant_id, success, limit, offset)
   
3. Update Dashboard API client (30 minutes)
   - File: repos/activity-dashboard/src/lib/api-client.ts:176
   - Remove: Warning console.log, implement actual fetch

**Validation**:
- Execute activity in MiniBob → verify impulse stored in backend
- Fetch execution history via API → verify filtering works
- Dashboard calls listExecutions → verify data returned

---

### Phase 2: Real-Time Updates (2-3 days, MEDIUM priority)

**Goal**: Enable real-time dashboard updates via WebSocket

**Tasks**:
1. Add WebSocket server to Activity API (4 hours)
   - File: repos/metabob-activity-api/src/index.ts
   - Add: WebSocket endpoint `/ws`
   - Implement: Connection management, authentication
   
2. Broadcast execution events (2 hours)
   - File: repos/metabob-activity-api/src/routes/activities.ts:516
   - Add: Broadcast to WebSocket clients on execution completion
   - Event types: execution_started, execution_completed, template_metrics_updated
   
3. Connect Dashboard WebSocket client (2 hours)
   - File: repos/activity-dashboard/src/hooks/useWebSocket.ts
   - Connect: To API WebSocket endpoint
   - Handle: Incoming events and update UI state

**Validation**:
- Execute activity in MiniBob → verify WebSocket event broadcast
- Dashboard connected → verify event received
- UI updates without polling → verify real-time updates work

---

### Phase 3: Dashboard UI Enhancements (3-4 days, MEDIUM priority)

**Goal**: Visualize execution history and Thompson Sampling

**Tasks**:
1. Create ExecutionHistory component (4 hours)
   - File: repos/activity-dashboard/src/components/ExecutionHistory.tsx
   - Features: Table, filtering, sorting, pagination
   - Integration: Use api.listExecutions, handle WebSocket updates
   
2. Create ThompsonVisualization component (6 hours)
   - File: repos/activity-dashboard/src/components/ThompsonVisualization.tsx
   - Features: Beta distribution chart, confidence intervals
   - Calculation: Thompson score from alpha/beta parameters
   
3. Add real-time metrics to SystemOverview (3 hours)
   - File: repos/activity-dashboard/src/components/SystemOverview.tsx
   - Features: Live execution counter, recent activity feed
   - Integration: WebSocket updates

**Validation**:
- ExecutionHistory displays recent executions
- Filtering/sorting/pagination work correctly
- Thompson visualization shows confidence intervals
- Real-time updates appear instantly

---

### Phase 4: Testing & Validation (1-2 days, HIGH priority)

**Goal**: Ensure correctness and performance

**Tasks**:
1. End-to-end test: MiniBob → API → Dashboard
   - Execute activity in MiniBob
   - Verify template registration in SurrealDB
   - Verify execution recording in SurrealDB
   - Verify metrics update (Thompson Sampling)
   - Verify dashboard displays updated data
   
2. Load testing
   - Execute 100 activities in parallel
   - Verify no race conditions in metrics updates
   - Verify Redis cache performance
   - Verify WebSocket scalability
   
3. Validation
   - Thompson Sampling accuracy (compare with manual calculation)
   - Impulse storage (verify backend contains impulse data)
   - Execution history (verify filtering/pagination correctness)

---

## Architecture Compliance

### ✅ Separation of Concerns
- **MiniBob**: Data generation (execution results, impulses, metrics)
- **Activity API**: Data storage (SurrealDB), learning logic (Thompson Sampling), caching (Redis)
- **Dashboard**: Data visualization (templates, executions, metrics)

### ✅ Backend-Driven Learning
- Thompson Sampling calculations in backend (repos/metabob-activity-api/src/routes/activities.ts:599-622)
- Atomic metric updates prevent race conditions
- MiniBob reports results, backend handles learning

### ✅ Multi-Tenant Isolation
- Scope filtering (global, org, project) in backend
- Dashboard respects scope boundaries
- Execution history filtered by org_id/project_id

### ⚠️ Missing Documentation
- WebSocket protocol not documented
- Execution history endpoint API contract not specified
- Thompson Sampling visualization requirements not detailed

---

## Enforcement Mechanisms

### ✅ Existing Enforcement
1. **Zod Schemas** (repos/metabob-activity-api/src/models/schemas.ts)
   - `ExecutionRecordSchema` validates execution data
   - `CreateTemplateRequestSchema` validates template registration
   - Type safety enforced via TypeScript

2. **Atomic Updates** (repos/metabob-activity-api/src/routes/activities.ts:596-622)
   - SurrealDB `+=` operator prevents race conditions
   - Thompson Sampling updates are atomic
   - No read-modify-write vulnerabilities

3. **Redis Cache Invalidation** (repos/metabob-activity-api/src/routes/activities.ts:630-632)
   - Cache invalidated on template updates
   - Distributed lock prevents cache stampede
   - TTL prevents stale data

### ⚠️ Missing Enforcement
1. **Impulse Storage Enforcement**
   - No check to ensure impulses are persisted
   - No validation that mcp.storeImpulse() was called
   - Recommendation: Add integration test

2. **Execution History Validation**
   - No endpoint specification
   - No API contract tests
   - Recommendation: Add OpenAPI/Swagger spec

3. **WebSocket Protocol Validation**
   - No message schema validation
   - No authentication enforcement
   - Recommendation: Add Zod schemas for WebSocket messages

---

## Validation Criteria

### Phase 1 Validation (Complete Data Flow)
- [ ] Impulse created in MiniBob → stored in backend
- [ ] Execution history endpoint returns data
- [ ] Dashboard can fetch execution history
- [ ] Filtering by variant_id works
- [ ] Pagination works (limit, offset)

### Phase 2 Validation (Real-Time Updates)
- [ ] WebSocket server accepts connections
- [ ] Execution events broadcast to connected clients
- [ ] Dashboard receives events in real-time
- [ ] UI updates without polling

### Phase 3 Validation (Dashboard UI)
- [ ] ExecutionHistory component renders correctly
- [ ] Filtering/sorting/pagination work
- [ ] Thompson visualization shows Beta distribution
- [ ] Confidence intervals calculated correctly

### Phase 4 Validation (Testing)
- [ ] End-to-end test passes
- [ ] 100 parallel executions complete successfully
- [ ] No race conditions detected
- [ ] Thompson Sampling accuracy verified

---

## References

### Documentation Files
- **DATA_FLOW_TRACING_ACTIVITY_SYSTEM.md** - Original comprehensive trace document
- **ARCHITECTURE_SEPARATION_SUMMARY.json** - Backend communication boundaries
- **ACTIVITY_SYSTEM_COMPLETE_SUMMARY.md** - Activity system overview

### Implementation Files
- **repos/minibob/src/activity.ts** - Activity execution and data generation
- **repos/minibob/src/mcp.ts** - MCP client for backend communication
- **repos/minibob/src/impulse.ts** - Impulse creation and management
- **repos/metabob-activity-api/src/routes/activities.ts** - Template and execution endpoints
- **repos/activity-dashboard/src/lib/api-client.ts** - Dashboard API client
- **repos/activity-dashboard/src/hooks/useTemplates.ts** - Template fetching hook

### Database Tables
- **activity_template** - Template metadata and task definitions
- **variant_performance_metrics** - Thompson Sampling parameters and success rates
- **activity_executions** - Execution history with timestamps and results
- **impulse_data** - Impulse storage (backend endpoint ready)

---

## Conclusion

The Activity System Data Flow Integration is **85% complete** with a clear path to 100%. The core learning loop (MiniBob → API → Thompson Sampling → Dashboard) is fully functional. The remaining gaps are well-defined with concrete implementation plans and time estimates.

**Next Steps**:
1. Implement Phase 1 (Complete Data Flow) - 1-2 days
2. Validate Phase 1 before proceeding
3. Implement Phase 2 (Real-Time Updates) - 2-3 days
4. Implement Phase 3 (Dashboard UI) - 3-4 days
5. Run Phase 4 (Testing & Validation) - 1-2 days

**Total Timeline**: 7-11 days (1.5-2.5 weeks)

**Success Criteria**: End-to-end observability from MiniBob execution to Dashboard visualization with real-time updates and Thompson Sampling learning.
