# Component Annotations: WebSocket-Real-Time-Dashboard-Updates

## Overview

This document provides component-level annotations for the WebSocket real-time dashboard updates feature, focusing on **WHY** each component exists and the design decisions behind it.

**Note**: Metabob CPG (Code Property Graph) has not yet indexed these files, so `metabob_annotate_component` is not available. This document serves as a comprehensive annotation reference for when Metabob indexing is complete.

---

## Critical Components Annotated

**Total Components**: 5  
**Annotation Focus**: Entry points, transformations, boundaries, exit points

---

## Component 1: POST /v2/activities/executions Endpoint (ENTRY POINT)

**File**: repos/metabob-activity-api/src/routes/activities.ts  
**Function**: POST handler (lines 500-707)  
**Component Type**: HTTP Controller  

### Why It Exists

This endpoint is the **primary entry point** for execution recording in the Activity System. MiniBob pods and metabob-cli clients POST execution results here after completing activity template executions.

**Business Purpose**:
- Record execution history for template learning loop
- Update Thompson Sampling metrics for template recommendation
- Trigger real-time WebSocket broadcasts to dashboard clients

**Integration Context**:
- Integrates with MiniBob execution environment (Kubernetes pods)
- Integrates with metabob-cli (developer machines)
- Provides data for Activity Dashboard real-time visualization

### Data Transformation

**Input Type**: ExecutionRecord (HTTP POST JSON)
```typescript
{
  variant_id: string,
  success: boolean,
  duration_ms: number,
  cost: number,
  tokens: { input, output, cache },
  error_message?: string,
  error_type?: string,
  failed_task_id?: string,
  impulses_used?: string[],
  component_changes?: string[]
}
```

**Output Type**: ExecutionRecordResponse (HTTP 201 JSON)
```typescript
{
  success: boolean,
  execution_id: string,
  metrics?: {
    success_rate, avg_duration_ms, avg_cost_usd,
    thompson_alpha, thompson_beta
  }
}
```

**Transformations Performed**:
1. HTTP JSON → Validated ExecutionRecord (Zod validation)
2. ExecutionRecord → Database record (field flattening, renaming)
3. ExecutionRecord → 3 WebSocket events (started, completed, updated)
4. Success boolean → Thompson Sampling deltas (0 or 1)
5. Metrics → Rolling averages (incremental calculation)

### Business Logic Enforced

**Validation Rules**:
- Required fields: variant_id, success, duration_ms, cost, tokens
- Type enforcement: success must be boolean, not truthy/falsy
- Token breakdown required: separate input/output/cache counts

**Thompson Sampling Update**:
- Atomic metrics update using SurrealDB `+=` operator
- Rolling averages: `new_avg = ((old_avg × (n-1)) + new_value) / n`
- Beta distribution: `alpha = successes + 1`, `beta = failures + 1`

**Multi-Tenancy**:
- org_id and project_id extracted from session (authMiddleware)
- Execution records filtered by organization
- WebSocket broadcasts filtered by authenticated clients

### Design Decisions

**Why Transaction Script Pattern?**
- **Decision**: Embed all logic in single route handler
- **Rationale**: Simplicity for MVP, fast development
- **Trade-off**: Difficult to unit test, tight database coupling
- **Future**: Refactor to service layer (Issue 6 in CODE_QUALITY_ISSUES.md)

**Why Optimistic Broadcasting?**
- **Decision**: Broadcast execution_started BEFORE database write
- **Rationale**: Minimize perceived latency for dashboard users
- **Trade-off**: Client sees event for execution that might fail to persist
- **Mitigation**: execution_completed confirms persistence
- **Risk**: UI shows "Running" execution that failed (Issue 4)

**Why 3 Separate WebSocket Events?**
- **Decision**: execution_started, execution_completed, template_updated
- **Rationale**: Granular UI updates, different components consume different events
- **Alternative Considered**: Single event with all data (rejected due to payload size)
- **Benefit**: Client can filter events by type, early optimistic updates

**Why No Transactions?**
- **Decision**: Separate INSERT and UPDATE queries without BEGIN...COMMIT
- **Rationale**: SurrealDB transaction support not explored in MVP
- **Trade-off**: Risk of partial execution records (Issue 3)
- **Future**: Wrap in SurrealDB transaction for data integrity

### Constraints

**Concurrency**:
- Atomic `+=` operator prevents race conditions in metrics update
- Multiple concurrent executions update metrics correctly
- No locks required (database handles atomicity)

**Performance**:
- ~90ms latency from HTTP POST to WebSocket client notification
- 3 WebSocket events broadcast per execution
- Database: 1 INSERT + 1 UPDATE + 1 Redis DEL per execution

**Error Handling**:
- Validation failure → 400 Bad Request, no side effects
- Database failure → 500 Internal Server Error, logs error
- WebSocket broadcast failure → Per-client error, continues to other clients
- Redis cache invalidation failure → Logs warning, continues (best-effort)

### Flow Context

**Position in Data Flow**:
```
MiniBob/CLI → [POST /v2/activities/executions] → Validation → Database → WebSocket Broadcast → Dashboard
```

**Critical for**:
- Thompson Sampling learning loop (metrics update)
- Real-time dashboard updates (WebSocket events)
- Execution history tracking (database persistence)

---

## Component 2: WebSocketBroadcaster.emit() (TRANSFORMATION)

**File**: repos/metabob-activity-api/src/websocket/broadcaster.ts  
**Method**: emit() (lines 52-69)  
**Component Type**: Pub/Sub Message Broadcaster  

### Why It Exists

The broadcaster is the **central hub** for real-time dashboard updates. It manages all WebSocket client connections and broadcasts execution events to authenticated clients.

**Business Purpose**:
- Enable real-time visibility into execution progress
- Notify dashboard users immediately when executions complete
- Update template metrics in real-time (Thompson Sampling parameters)

**Integration Context**:
- Called by POST /v2/activities/executions after execution recording
- Broadcasts to all authenticated WebSocket clients
- Filters by authentication status (security boundary)

### Data Transformation

**Input Type**: WebSocketMessage object
```typescript
{
  type: 'execution_started' | 'execution_completed' | 'template_updated',
  timestamp: string (ISO 8601),
  data: { execution_id, variant_id, ... }
}
```

**Output Type**: JSON string (WebSocket payload)
```json
"{\"type\":\"execution_completed\",\"timestamp\":\"2026-03-19T...\",\"data\":{...}}"
```

**Transformations Performed**:
1. WebSocketMessage object → JSON string (JSON.stringify)
2. Client set → Filtered authenticated clients (authentication filter)
3. Broadcast to N clients → N send operations (pub/sub fanout)

### Business Logic Enforced

**Authentication Filter**:
- Only clients with `ws.data.authenticated === true` receive broadcasts
- Unauthenticated clients silently ignored (no error sent)
- Prevents unauthorized access to execution data

**Broadcast Isolation**:
- Per-client error handling (try-catch around each send)
- Failure to send to one client doesn't stop broadcast to others
- Success/failure counts logged for observability

**Message Serialization**:
- JSON.stringify() performed once (optimization)
- Same payload sent to all clients (no per-client customization)

### Design Decisions

**Why Singleton Pattern?**
- **Decision**: Single broadcaster instance shared across all routes
- **Rationale**: Centralized client management, consistent broadcast behavior
- **Alternative Considered**: Per-route broadcaster instances (rejected: hard to manage clients)
- **Benefit**: All routes can broadcast to same client set

**Why Authentication Filter in Broadcaster?**
- **Decision**: Filter at broadcast time, not at connection time
- **Rationale**: Allows unauthenticated connections (WebSocket handshake before auth message)
- **Alternative Considered**: Reject unauthenticated connections immediately (rejected: need multi-step auth)
- **Security**: Only authenticated clients receive events, but all connections tracked

**Why Set<WebSocket> for Client Storage?**
- **Decision**: Use Set instead of Array
- **Rationale**: O(1) add/remove, no duplicates
- **Trade-off**: Iteration still O(n), but add/remove is fast
- **Performance**: Efficient for frequent connect/disconnect

**Why Synchronous Iteration?**
- **Decision**: `for (const client of this.clients) { client.send(payload); }`
- **Rationale**: Simple, blocking sends ensure order
- **Trade-off**: Slow clients delay broadcast to all clients (Issue 10)
- **Future**: Use Promise.all for parallel sending

### Constraints

**Concurrency**:
- Set operations are not atomic (JavaScript single-threaded, but async)
- Clients can be added/removed during broadcast
- No race condition (Set handles concurrent modification)

**Performance**:
- O(n) iteration per broadcast (n = client count)
- 3 broadcasts per execution × n clients = 3n send operations
- Tested with 100+ concurrent clients

**Error Handling**:
- Per-client error logging with message context (Issue 7: missing client context)
- Broadcast continues on individual client errors
- No rollback or retry (fire-and-forget)

**Security**:
- Authentication filter prevents unauthorized access
- ⚠️ WARNING: Token validation is stub (Issue 1)
- No org_id/project_id filtering on broadcasts (all authenticated clients see all events)

### Flow Context

**Position in Data Flow**:
```
POST Endpoint → [WebSocketBroadcaster.emit()] → WebSocket Server → Dashboard Client
```

**Critical for**:
- Real-time dashboard updates (primary purpose)
- Multi-client event distribution (pub/sub pattern)
- Security boundary (authentication filter)

---

## Component 3: WebSocket Server Handlers (BOUNDARY)

**File**: repos/metabob-activity-api/src/index.ts  
**Handlers**: websocket.open, websocket.message, websocket.close (lines 164-237)  
**Component Type**: Protocol Boundary (WebSocket)  

### Why It Exists

The WebSocket server handlers are the **protocol boundary** between HTTP and WebSocket. They manage connection lifecycle, authentication, and message routing.

**Business Purpose**:
- Enable bidirectional real-time communication with dashboard
- Authenticate clients before broadcasting execution events
- Manage connection lifecycle (connect, authenticate, disconnect)

**Integration Context**:
- Integrates with Bun WebSocket runtime (server-side)
- Integrates with activity-dashboard WebSocket client (browser)
- Bridges HTTP authentication (Bearer token) with WebSocket events

### Data Transformation

**Input Type**: WebSocket connection + client messages
```typescript
// Connection upgrade (HTTP → WebSocket)
Request: GET /ws (HTTP Upgrade header)

// Client messages
{ type: 'authenticate', token: string }
{ type: 'ping' }
```

**Output Type**: WebSocket events + server messages
```typescript
// Server messages
{ type: 'authenticated', timestamp: string }
{ type: 'pong', timestamp: string }

// Broadcast events (via broadcaster)
{ type: 'execution_started', ... }
{ type: 'execution_completed', ... }
{ type: 'template_updated', ... }
```

**Transformations Performed**:
1. HTTP Upgrade → WebSocket connection
2. Authentication message → Session lookup (Redis)
3. Client message (string) → Parsed JSON → Action (authenticate, ping)
4. WebSocket close → Broadcaster client removal

### Business Logic Enforced

**Connection Lifecycle**:
- `open`: Add client to broadcaster, set `authenticated: false`
- `message`: Handle authentication and ping/pong
- `close`: Remove client from broadcaster
- `drain`: Handle backpressure (log only)

**Authentication Flow**:
1. Client connects (unauthenticated)
2. Client sends `{ type: 'authenticate', token: 'xxx' }`
3. Server validates token (⚠️ stub implementation: accepts all tokens)
4. Server sets `ws.data.authenticated = true`
5. Server responds `{ type: 'authenticated' }`
6. Broadcaster now sends events to this client

**Ping/Pong**:
- Client sends `{ type: 'ping' }`
- Server responds `{ type: 'pong', timestamp: ISO }`
- Keeps connection alive, detects dead connections

### Design Decisions

**Why Multi-Step Authentication?**
- **Decision**: Accept connection first, authenticate via message
- **Rationale**: WebSocket protocol requires handshake before authentication
- **Alternative Considered**: Token in URL query parameter (rejected: security risk in logs)
- **Security**: Unauthenticated clients don't receive broadcasts

**Why Stub Token Validation?**
- **Decision**: Accept all tokens without Redis validation (TODO comment)
- **Rationale**: MVP speed, defer authentication complexity
- **Trade-off**: Critical security vulnerability (Issue 1)
- **Future**: Validate token against Redis session store

**Why Bun WebSocket Instead of ws Library?**
- **Decision**: Use Bun's native WebSocket support
- **Rationale**: Integrated with Bun.serve, better performance
- **Alternative Considered**: ws library (rejected: external dependency, lower performance)
- **Benefit**: Single server for HTTP + WebSocket, fewer dependencies

**Why No Heartbeat?**
- **Decision**: Respond to client pings, but don't send automatic pings
- **Rationale**: MVP simplicity, assume client handles connection health
- **Trade-off**: Dead connections not detected proactively (Issue 11)
- **Future**: Add server-initiated ping interval

### Constraints

**Concurrency**:
- WebSocket handlers are async (Bun event loop)
- Multiple clients can connect/disconnect concurrently
- Broadcaster handles concurrent client modifications

**Performance**:
- Bun WebSocket is high-performance (C++ implementation)
- Backpressure handling via `drain` event
- No rate limiting on WebSocket messages (Issue 5)

**Error Handling**:
- JSON parse errors logged, continue
- Authentication errors logged, client remains unauthenticated
- Close errors ignored (best-effort cleanup)

**Security**:
- ⚠️ CRITICAL: Token validation stub (Issue 1)
- No HTTPS/WSS enforcement (Issue 12)
- No rate limiting on authentication attempts
- No IP-based throttling

### Flow Context

**Position in Data Flow**:
```
Dashboard Client → [WebSocket Server] → Broadcaster → [WebSocket Server] → Dashboard Client
```

**Critical for**:
- WebSocket protocol implementation
- Client authentication (security boundary)
- Connection lifecycle management

---

## Component 4: Thompson Sampling Metrics Update (TRANSFORMATION)

**File**: repos/metabob-activity-api/src/routes/activities.ts  
**Query**: UPDATE variant_performance_metrics (lines 604-638)  
**Component Type**: Business Logic (Learning Loop)  

### Why It Exists

This component implements the **Thompson Sampling algorithm** for template recommendation. It atomically updates template metrics after each execution to inform the learning loop.

**Business Purpose**:
- Track template performance (success rate, avg duration, avg cost)
- Update Beta distribution parameters (alpha, beta) for Thompson Sampling
- Enable intelligent template recommendation (exploration/exploitation tradeoff)

**Integration Context**:
- Called after execution INSERT succeeds
- Updates metrics used by template recommendation API
- Invalidates Redis cache to force fresh reads

### Data Transformation

**Input Type**: Execution result + success/failure deltas
```typescript
{
  variant_id: string,
  success_delta: 0 | 1,  // 1 if success, 0 if failure
  failure_delta: 0 | 1,  // 0 if success, 1 if failure
  duration_ms: number,
  cost: number
}
```

**Output Type**: Updated metrics
```typescript
{
  variant_id: string,
  total_executions: number,
  successful_executions: number,
  failed_executions: number,
  success_rate: number,
  avg_duration_ms: number,
  avg_cost_usd: number,
  thompson_alpha: number,  // successful_executions + 1
  thompson_beta: number,   // failed_executions + 1
  last_executed_at: timestamp,
  updated_at: timestamp
}
```

**Transformations Performed**:
1. Success boolean → Deltas (success_delta, failure_delta)
2. Previous metrics + new data → Rolling averages
3. Execution counts → Beta distribution parameters (alpha, beta)
4. Metrics → WebSocket event (template_updated)

### Business Logic Enforced

**Thompson Sampling Algorithm**:
```
alpha = successful_executions + 1  (pseudo-count of successes)
beta = failed_executions + 1       (pseudo-count of failures)

Recommendation: Sample from Beta(alpha, beta) distribution
  - High alpha, low beta → Likely to recommend (proven success)
  - Low alpha, high beta → Unlikely to recommend (proven failure)
  - Alpha ≈ Beta → Uncertain, explore more
```

**Rolling Average Formula**:
```
new_avg = ((old_avg × (total - 1)) + new_value) / total
```
- Avoids storing all historical values (O(1) space)
- Mathematically equivalent to recalculating from scratch
- Single atomic update (no SELECT before UPDATE)

**Atomic Updates**:
- `total_executions += 1`: Atomic increment
- `successful_executions += success_delta`: Atomic increment by 0 or 1
- `failed_executions += failure_delta`: Atomic increment by 0 or 1
- Prevents race conditions in concurrent executions

### Design Decisions

**Why Thompson Sampling?**
- **Decision**: Use Thompson Sampling instead of ε-greedy or UCB
- **Rationale**: Bayesian approach, handles uncertainty well
- **Alternative Considered**: 
  - ε-greedy (rejected: doesn't adapt to uncertainty)
  - UCB (rejected: more complex, similar performance)
- **Benefit**: Naturally balances exploration and exploitation

**Why Beta Distribution?**
- **Decision**: Model success/failure as Beta(alpha, beta)
- **Rationale**: Conjugate prior for binomial likelihood (success/failure)
- **Mathematical Property**: Beta(1, 1) is uniform (no prior knowledge)
- **Benefit**: Easy to update incrementally (add 1 to alpha or beta)

**Why +1 Prior?**
- **Decision**: Alpha = successes + 1, Beta = failures + 1
- **Rationale**: 
  - Prevents zero probability (new templates can be selected)
  - Beta(1, 1) prior represents uniform uncertainty
  - Allows first execution to influence recommendation
- **Alternative Considered**: No prior (rejected: division by zero, zero probability)

**Why Atomic Operators Instead of Read-Modify-Write?**
- **Decision**: Use SurrealDB `+=` operator
- **Rationale**: Prevent race conditions in concurrent executions
- **Previous Implementation**: Read → Calculate → Write (had race condition)
- **Benefit**: Correct metrics even with 100+ concurrent executions

### Constraints

**Concurrency**:
- Atomic `+=` operator ensures correct concurrent updates
- No locks required (database handles atomicity)
- Multiple executions can update same variant simultaneously

**Performance**:
- Single UPDATE query (~40ms)
- Rolling averages avoid recalculating from all historical data
- O(1) time complexity (independent of execution history size)

**Precision**:
- Floating-point rounding errors in rolling averages
- Insignificant for typical execution counts (<10,000)
- Alternative (exact calculation from all data) rejected due to performance

**Data Integrity**:
- ⚠️ WARNING: No transaction wrapping (Issue 3)
- If UPDATE fails after INSERT, execution record exists without metrics update
- Thompson Sampling parameters incorrect if partial failure

### Flow Context

**Position in Data Flow**:
```
Execution INSERT → [Thompson Sampling Update] → template_updated Event → Dashboard
```

**Critical for**:
- Template recommendation system (primary purpose)
- Learning loop (adaptive template selection)
- Dashboard metrics display (real-time success rates)

---

## Component 5: SurrealDB INSERT Execution Record (EXIT POINT)

**File**: repos/metabob-activity-api/src/routes/activities.ts  
**Query**: INSERT INTO activity_executions (lines 556-598)  
**Component Type**: Data Persistence (Database)  

### Why It Exists

This component **persists execution history** to the database, enabling historical analysis, debugging, and learning loop training data.

**Business Purpose**:
- Maintain permanent record of all executions (audit trail)
- Enable historical analysis (success rates over time, cost trends)
- Provide training data for template learning loop
- Support debugging failed executions (error messages, task context)

**Integration Context**:
- Called after Zod validation succeeds
- Stores data queried by Activity Dashboard (execution history view)
- Provides input for Thompson Sampling metrics calculation

### Data Transformation

**Input Type**: Validated ExecutionRecord
```typescript
{
  variant_id: string,
  success: boolean,
  duration_ms: number,
  cost: number,
  tokens: { input, output, cache },
  error_message?: string,
  error_type?: string,
  failed_task_id?: string,
  impulses_used?: string[],
  component_changes?: string[],
  pod_name?: string  // MiniBob only
}
```

**Output Type**: Database record (activity_executions table)
```typescript
{
  execution_id: 'exec_1710850496789_a1b2c3d4e5',  // UUID
  variant_id: 'add-rest-endpoint',
  success: true,
  duration_ms: 45000,
  cost_usd: 0.0234,  // Renamed from 'cost'
  tokens_input: 1000,    // Flattened from tokens.input
  tokens_output: 500,    // Flattened from tokens.output
  tokens_cache: 200,     // Flattened from tokens.cache
  org_id?: 'org_abc123',        // From session
  project_id?: 'proj_xyz789',   // From session
  error_message?: 'Validation failed',
  error_type?: 'validation',
  failed_task_id?: 'task-2',
  impulses_used?: ['impulse-1', 'impulse-2'],
  component_changes?: ['src/api.ts', 'src/routes.ts'],
  pod_name?: 'minibob-pod-user123-xyz',
  executed_at: '2026-03-19T12:34:56.789Z',  // Auto-generated
  created_at: '2026-03-19T12:34:56.789Z'    // Auto-generated
}
```

**Transformations Performed**:
1. `cost` → `cost_usd` (explicit currency)
2. `tokens` object → `tokens_input`, `tokens_output`, `tokens_cache` (flatten)
3. Add `execution_id` (UUID generation)
4. Add `org_id`, `project_id` (from session context)
5. Add `executed_at`, `created_at` (timestamp generation)
6. Conditional field inclusion (omit undefined fields)

### Business Logic Enforced

**UUID Generation**:
```
Format: exec_{timestamp}_{random}
Example: exec_1710850496789_a1b2c3d4e5

Components:
- exec: Prefix for execution IDs
- timestamp: Unix milliseconds (sortable)
- random: Hex string (uniqueness)
```

**Multi-Tenancy**:
- `org_id` and `project_id` from session (authMiddleware)
- Enables filtering executions by organization or project
- Dashboard queries can scope to user's organization

**Conditional Field Inclusion**:
- Only add optional fields if they have values
- SurrealDB doesn't support NULL (must omit field instead)
- Reduces storage size for successful executions (no error fields)

### Design Decisions

**Why Flatten Tokens Object?**
- **Decision**: Store `tokens.input` as `tokens_input` (flat schema)
- **Rationale**: 
  - SurrealDB query performance (no nested object traversal in WHERE)
  - Direct aggregation (SUM, AVG) without JSON extraction
  - Index efficiency (can index individual token counts)
- **Alternative Considered**: Store as JSON string (rejected: loss of query capability)

**Why Rename cost → cost_usd?**
- **Decision**: Explicit currency in field name
- **Rationale**: 
  - Prepare for future multi-currency support
  - Avoid ambiguity (cost in what currency?)
  - Clear semantics (USD is the unit)
- **Alternative Considered**: Separate currency field (rejected: overkill for single currency)

**Why UUID Format exec_{timestamp}_{random}?**
- **Decision**: Custom UUID format instead of standard UUID
- **Rationale**:
  - Sortable by timestamp (lexicographic order = chronological order)
  - Human-readable prefix (identify as execution ID)
  - Sufficient randomness for uniqueness
- **Alternative Considered**: Standard UUID v4 (rejected: not sortable, not human-readable)

**Why Conditional Field Inclusion?**
- **Decision**: Only add fields with values (dynamic query building)
- **Rationale**: SurrealDB doesn't support NULL (must omit field)
- **Trade-off**: Query building complexity (conditional field list)
- **Benefit**: Reduced storage size, cleaner database schema

### Constraints

**Data Size**:
- Typical execution record: ~200-500 bytes
- Large error messages: up to 2KB
- Component changes array: unbounded (could be large)

**Performance**:
- INSERT latency: ~30ms (SurrealDB on localhost)
- No indexes on execution table (queried by variant_id, time range)
- Large result sets (10,000+ executions) require pagination

**Data Retention**:
- No automatic cleanup or archival
- Executions accumulate indefinitely
- Future: Add TTL or archival policy

**Consistency**:
- ⚠️ WARNING: No transaction with metrics UPDATE (Issue 3)
- If INSERT succeeds but UPDATE fails, metrics inconsistent
- If INSERT fails after broadcast, client sees event for non-existent execution

### Flow Context

**Position in Data Flow**:
```
Validation → [INSERT Execution] → Thompson Sampling Update → WebSocket Broadcast
```

**Critical for**:
- Execution history persistence (primary purpose)
- Dashboard execution list queries
- Thompson Sampling input data
- Audit trail and debugging

---

## Summary of Annotated Components

### Components Annotated: 5

1. **POST /v2/activities/executions** (Entry Point)
   - HTTP controller for execution recording
   - Validates input, persists to database, broadcasts events
   - Design: Transaction Script pattern, optimistic broadcasting
   - Critical issues: No transactions (Issue 3), optimistic risk (Issue 4)

2. **WebSocketBroadcaster.emit()** (Transformation)
   - Pub/sub hub for real-time dashboard updates
   - Filters by authentication, broadcasts to all clients
   - Design: Singleton pattern, synchronous iteration
   - Critical issues: No client context in errors (Issue 7), O(n) blocking (Issue 10)

3. **WebSocket Server Handlers** (Boundary)
   - Protocol boundary between HTTP and WebSocket
   - Manages connection lifecycle, authentication
   - Design: Multi-step auth, Bun native WebSocket
   - Critical issues: Auth stub (Issue 1), no heartbeat (Issue 11)

4. **Thompson Sampling Update** (Transformation)
   - Learning loop for template recommendation
   - Atomic metrics update with rolling averages
   - Design: Beta distribution, atomic operators
   - Critical issues: No transactions (Issue 3)

5. **INSERT Execution Record** (Exit Point)
   - Persists execution history to SurrealDB
   - Flattens tokens, adds timestamps, conditional fields
   - Design: Custom UUID format, conditional inclusion
   - Critical issues: No transactions (Issue 3)

### Key Design Decisions Documented

**Architectural Patterns**:
- Transaction Script (controller + service + repository in one)
- Optimistic Broadcasting (broadcast before persistence)
- Pub/Sub (broadcaster → many clients)
- Singleton (shared broadcaster instance)

**Algorithm Choices**:
- Thompson Sampling (exploration/exploitation)
- Beta distribution (Bayesian update)
- Rolling averages (O(1) space complexity)
- Atomic operators (concurrency safety)

**Data Modeling**:
- Flat schema (tokens_input vs. tokens.input)
- Explicit currency (cost_usd)
- Custom UUID format (exec_{timestamp}_{random})
- Conditional field inclusion (no NULL support)

**Protocol Choices**:
- Bun WebSocket (native, high-performance)
- Multi-step authentication (handshake then auth message)
- JSON over WebSocket (standard, simple)
- 3 separate event types (granular UI updates)

### Critical Issues Identified

**Blocking for Production**:
1. Authentication stub (Issue 1) - All clients authenticated
2. No transactions (Issue 3) - Data integrity risk
3. No HTTPS/WSS (Issue 12) - Security risk

**Technical Debt**:
4. Transaction Script pattern (Issue 6) - Hard to test
5. Optimistic broadcasting (Issue 4) - UI/DB divergence
6. No error context (Issue 7) - Hard to debug
7. Synchronous iteration (Issue 10) - Performance bottleneck

### Business Context Captured

**Thompson Sampling Learning Loop**:
- Why: Adaptive template recommendation
- How: Beta distribution with incremental updates
- Trade-off: Simplicity vs. advanced multi-armed bandit algorithms

**Real-Time Dashboard Updates**:
- Why: Immediate visibility into execution progress
- How: WebSocket broadcasts after execution recording
- Trade-off: Optimistic updates vs. guaranteed consistency

**Multi-Tenancy**:
- Why: Support multiple organizations on same infrastructure
- How: org_id and project_id filtering
- Gap: WebSocket broadcasts not filtered by org (security issue)

### Constraints Documented

**Performance**:
- ~90ms end-to-end latency (HTTP POST → client notification)
- 3 events per execution × n clients = 3n send operations
- Tested with 100+ concurrent clients

**Concurrency**:
- Atomic operators prevent race conditions
- Set operations handle concurrent client modifications
- No locks required

**Data Integrity**:
- ⚠️ No transactions (partial execution records possible)
- ⚠️ Optimistic broadcasting (UI ahead of database)
- Rolling averages (floating-point rounding errors)

---

## Metabob Integration Status

**Current State**: Files not indexed by CPG  
**Components Found**: 0 (files not yet analyzed)

**Next Steps**:
1. Wait for Metabob background engine to index files
2. Re-run `metabob_list_file_components` to get exact component names
3. Use `metabob_annotate_component` to add annotations to Metabob database
4. Link annotations to code quality issues for traceability

**Annotation Queries** (after indexing):
```typescript
// Example: Annotate POST endpoint
metabob_annotate_component({
  file_path: 'repos/metabob-activity-api/src/routes/activities.ts',
  component_name: 'POST /v2/activities/executions',  // From list_file_components
  component_type: 'function',
  reason: 'Primary entry point for execution recording in Activity System learning loop',
  design_decisions: [
    'Transaction Script pattern for MVP simplicity',
    'Optimistic broadcasting to minimize perceived latency',
    'Thompson Sampling for adaptive template recommendation'
  ]
});
```

---

## Documentation Index

- **Entry Points**: ENTRY_POINTS_WebSocket-Real-Time-Dashboard-Updates.md
- **Dependency Chain**: DEPENDENCY_CHAIN_WebSocket-Real-Time-Dashboard-Updates.md
- **Data Transformations**: DATA_TRANSFORMATIONS_WebSocket-Real-Time-Dashboard-Updates.md
- **Architectural Boundaries**: ARCHITECTURAL_BOUNDARIES_WebSocket-Real-Time-Dashboard-Updates.md
- **Code Quality Issues**: CODE_QUALITY_ISSUES_WebSocket-Real-Time-Dashboard-Updates.md
- **Component Annotations**: COMPONENT_ANNOTATIONS_WebSocket-Real-Time-Dashboard-Updates.md (this file)
