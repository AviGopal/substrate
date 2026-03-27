# Connection Slots and LLM Proxy: Implementation Tasks

## Phase 1: Database Schema ✅ COMPLETE

### P1.1: Extend api_keys table with connection slot fields ✅
**Files**: `repos/metabob-proto/surrealdb/core/007-api-keys-connection-slots.surql`
- [x] Add `max_connections` field (1-1000, default 1)
- [x] Add `tier` field (starter, pro, enterprise)
- [x] Add `llm_budget` object with nested fields
- [x] Add `billing_email` optional field
- [x] Add indexes for tier and budget_reset_at

### P1.2: Create connection table ✅
**Files**: `repos/metabob-proto/surrealdb/core/006-connection-slots.surql`
- [x] Define `connection` table with all fields per design
- [x] Add indexes for api_key_id, status, session_token (UNIQUE)
- [x] Add RBAC permissions (org scoped)
- [x] Add foreign key relationship to api_keys
- [x] Add execution tracking fields for grace period calculation
- [x] Add metadata field for extensibility

### P1.3: Create llm_resolution_log table ✅
**Files**: `repos/metabob-activity-api/sql/schemas/017-llm-resolution.surql`
- [x] Define `llm_resolution_log` table with full trace capture
- [x] Add indexes for org_id, resolver_tier, impulse_hash
- [x] Link to connection and execution_traces tables
- [x] Add RBAC permissions (org scoped)
- [x] Add pattern extraction tracking fields

### P1.4: Create pattern table ✅
**Files**: `repos/metabob-activity-api/sql/schemas/018-patterns.surql`
- [x] Define `pattern` table for extracted patterns
- [x] Add indexes for impulse_hash, success_rate
- [x] Add RBAC permissions (org scoped + public visibility)
- [x] Add performance metrics fields
- [x] Add extraction provenance tracking

---

## Phase 2: Connection Slot Backend (metabob-activity-api) ✅ COMPLETE

### P2.1: Connection acquisition endpoint ✅
**Files**: `repos/metabob-activity-api/src/routes/connections.ts`
- [x] Create `POST /v2/connections/acquire` endpoint
- [x] Validate API key via argon2 hash comparison
- [x] Check slot availability (count active + grace connections)
- [x] Create connection record with session_token
- [x] Generate JWT for connection
- [x] Return connection details or 429 if limit reached

### P2.2: Heartbeat endpoint ✅
**Files**: `repos/metabob-activity-api/src/routes/connections.ts`
- [x] Create `POST /v2/connections/heartbeat` endpoint
- [x] Update last_heartbeat timestamp
- [x] Accept optional current_execution state
- [x] Calculate and return grace period info

### P2.3: Reconnection endpoint ✅
**Files**: `repos/metabob-activity-api/src/routes/connections.ts`
- [x] Create `POST /v2/connections/reconnect` endpoint
- [x] Validate session_token
- [x] Check if within grace period
- [x] Restore connection to active state
- [x] Return new JWT or 410 if expired

### P2.4: Release endpoint ✅
**Files**: `repos/metabob-activity-api/src/routes/connections.ts`
- [x] Create `POST /v2/connections/release` endpoint
- [x] Mark connection as disconnected
- [x] Clear from Redis slot count

### P2.5: Heartbeat worker ✅
**Files**: `repos/metabob-activity-api/src/workers/heartbeat.ts`
- [x] Create background worker (runs every 10s)
- [x] Find connections that missed heartbeat
- [x] Calculate grace period based on execution state
- [x] Transition to grace status
- [x] Expire grace periods and mark disconnected
- [x] Handle orphaned executions

### P2.6: Redis slot management ✅
**Files**: `repos/metabob-activity-api/src/routes/connections.ts` (integrated into connections module)
- [x] Add `acquireSlot(apiKeyId)` function
- [x] Add `releaseSlot(apiKeyId, connectionId)` function
- [x] Add `getSlotCount(apiKeyId)` function
- [x] Add `refreshSlotTTL(apiKeyId)` function

---

## Phase 3: LLM Proxy Backend ✅ COMPLETE (P3.1-P3.5)

### P3.1: Resolver router ✅
**Files**: `repos/metabob-activity-api/src/resolvers/router.ts`
- [x] Create `selectResolver()` function per design
- [x] Implement `hashImpulseShape()` for pattern matching
- [x] Implement `estimateComplexity()` for tier selection
- [x] Add confidence scoring logic

### P3.2: Pattern store ✅
**Files**: `repos/metabob-activity-api/src/resolvers/pattern-store.ts`
- [x] Create `findExact(impulseHash)` function
- [x] Create `findSimilar(impulseHash, threshold)` function
- [x] Add Redis caching for hot patterns
- [x] Implement cache invalidation on pattern update

### P3.3: LLM proxy client ✅
**Files**: `repos/metabob-activity-api/src/resolvers/llm-proxy.ts`
- [x] Create Anthropic API client wrapper
- [x] Implement `callHaiku()`, `callSonnet()`, `callOpus()`
- [x] Capture full request/response for tracing
- [x] Handle rate limiting and retries
- [x] Track token usage

### P3.4: Resolution endpoint ✅
**Files**: `repos/metabob-activity-api/src/routes/resolve.ts`
- [x] Create `POST /v2/resolve` endpoint
- [x] Route through resolver selection
- [x] Execute pattern match or LLM call
- [x] Record resolution in llm_resolution_log
- [x] Check and deduct token budget

### P3.5: Token budget management ✅
**Files**: `repos/metabob-activity-api/src/resolvers/budget.ts`
- [x] Implement `checkAndDeductBudget()` with Redis
- [x] Create `syncBudgetToDatabase()` periodic job
- [x] Create `resetBudgets()` monthly job
- [x] Add budget exceeded error handling

### P3.6: Pattern extraction (ribosome integration) - DEFERRED
**Files**: `repos/metabob-activity-api/src/resolvers/pattern-extractor.ts`
- [ ] Implement `maybeExtractPattern()` function
- [ ] Calculate result consistency across resolutions
- [ ] Extract template from successful resolutions
- [ ] Store pattern and update source resolutions

---

## Phase 4: metabob-mcp Integration ✅ COMPLETE

### P4.1: Connection manager ✅
**Files**: `repos/metabob-mcp/src/connection-manager.ts`
- [x] Create `ConnectionManager` class
- [x] Implement `connect()` with slot acquisition
- [x] Implement heartbeat loop (30s interval)
- [x] Implement `reconnect()` for grace period recovery
- [x] Implement `disconnect()` for clean release
- [x] Track current execution state

### P4.2: Update API client ✅
**Files**: `repos/metabob-mcp/src/api-client.ts`
- [x] Integrate ConnectionManager
- [x] Add `X-Connection-ID` header to requests
- [x] Handle 429 (slot limit) errors gracefully
- [x] Handle reconnection on auth failures
- [x] Route LLM calls through `/v2/resolve`

### P4.3: Activity tools ✅
**Files**: `repos/metabob-mcp/src/tools/activity.ts`
- [x] Create `run_goal` tool
- [x] Create `get_recommendations` tool
- [x] Create `submit_trace` tool
- [x] Create `resolve_impulse` tool
- [x] Wire tools to resolver endpoint

### P4.4: Update tool registration ✅
**Files**: `repos/metabob-mcp/src/index.ts`
- [x] Register activity tools alongside analysis tools
- [x] Update capabilities advertisement
- [x] Add activity API URL configuration

### P4.5: Remove direct LLM dependency ✅
**Files**: `repos/metabob-mcp/src/index.ts` (config integrated)
- [x] Make ANTHROPIC_API_KEY optional (not required when using connection slots)
- [x] Add METABOB_API_KEY as primary auth
- [x] Update environment variable documentation (USE_CONNECTION_SLOTS, ACTIVITY_API_URL)

---

## Phase 5: MiniBob Integration (Optional)

### P5.1: MCP client update
**Files**: `repos/minibob/src/mcp.ts`
- [ ] Add connection lifecycle management
- [ ] Implement heartbeat during executions
- [ ] Report current_execution in heartbeat
- [ ] Handle reconnection on connection loss

### P5.2: LLM routing
**Files**: `repos/minibob/src/llm.ts`
- [ ] Add option to route through MCP resolve endpoint
- [ ] Fall back to direct LLM for local development
- [ ] Capture resolver tier in execution trace

### P5.3: Configuration
**Files**: `repos/minibob/src/config.ts`
- [ ] Add `MINIBOB_USE_LLM_PROXY` config option
- [ ] Document direct vs proxy modes
- [ ] Default to proxy when MCP endpoint configured

---

## Phase 6: Helm and Deployment ✅ COMPLETE

### P6.1: Update activity-api deployment ✅
**Files**: `helm/charts/metabob-activity-api/values.yaml`, `helm/charts/metabob-activity-api/templates/deployment.yaml`
- [x] Add ANTHROPIC_API_KEY secret mount (for proxy)
- [x] Add environment variables for LLM proxy config
- [x] Add Redis URL configuration (already existed)
- [x] Configure heartbeat worker

### P6.2: Update metabob-mcp deployment ✅
**Files**: `helm/charts/metabob-mcp/values.yaml`, `helm/charts/metabob-mcp/templates/deployment.yaml`
- [x] Remove ANTHROPIC_API_KEY requirement (optional via connection slots)
- [x] Add METABOB_API_KEY configuration
- [x] Add ACTIVITY_API_URL configuration
- [x] Update health check endpoints (unchanged, already correct)

### P6.3: Schema migration job ✅
**Files**: Already handled by existing migration system
- [x] Add new schema files to migration (017-llm-resolution.surql, 018-patterns.surql)
- [x] Ensure proper ordering (api_key before connection)

### P6.4: Secrets management ✅
**Files**: Manual creation via kubectl
- [x] Add anthropic-api-key secret for activity-api
- [x] Document secret creation: `kubectl create secret generic anthropic-api-key --from-literal=api-key="$ANTHROPIC_API_KEY" -n activity-system`

---

## Phase 7: Testing and Validation - IN PROGRESS

### P7.1: Unit tests - connection slots
**Files**: `repos/metabob-activity-api/test/connections.test.ts`
- [ ] Test slot acquisition
- [ ] Test heartbeat updates
- [ ] Test grace period calculation
- [ ] Test slot release
- [ ] Test FIFO enforcement

### P7.2: Unit tests - resolver
**Files**: `repos/metabob-activity-api/test/resolver.test.ts`
- [ ] Test tier selection logic
- [ ] Test pattern matching
- [ ] Test complexity estimation
- [ ] Test budget enforcement

### P7.3: Integration tests ✅
**Files**: `repos/metabob-activity-api/test/integration/connection-slots.test.ts`
- [x] Test full connection lifecycle (requires TEST_API_KEY)
- [x] Test reconnection within grace (requires TEST_API_KEY)
- [x] Test reconnection after grace expires (requires TEST_API_KEY)
- [x] Test LLM proxy end-to-end (PASSED - Haiku returned "4" for 2+2)
- [ ] Test pattern extraction after N successes

### P7.4: metabob-mcp tests
**Files**: `repos/metabob-mcp/test/`
- [ ] Test connection manager lifecycle
- [ ] Test activity tools
- [ ] Test error handling for 429/410
- [ ] Test heartbeat resilience

---

## Phase 8: Documentation and Monitoring

### P8.1: API documentation
**Files**: `docs/api/connections.md`, `docs/api/resolve.md`
- [ ] Document connection slot endpoints
- [ ] Document resolve endpoint
- [ ] Add examples for common flows
- [ ] Document error codes

### P8.2: Architecture documentation
**Files**: `docs/architecture/CONNECTION_SLOTS.md`, `docs/architecture/LLM_PROXY.md`
- [ ] Document connection slot model
- [ ] Document resolver tier system
- [ ] Document learning flywheel
- [ ] Add diagrams

### P8.3: Dashboard queries
**Files**: `repos/activity-dashboard/src/queries/`
- [ ] Add connection slot utilization query
- [ ] Add resolver tier distribution query
- [ ] Add pattern extraction progress query
- [ ] Add budget utilization query

### P8.4: Alerts
**Files**: `helm/charts/metabob-activity-api/templates/alerts.yaml`
- [ ] Alert on high slot utilization
- [ ] Alert on high grace period entries
- [ ] Alert on low pattern match rate
- [ ] Alert on budget exhaustion

---

## Task Summary

| Phase | Tasks | Description |
|-------|-------|-------------|
| P1 | 4 | Database schema |
| P2 | 6 | Connection slot backend |
| P3 | 6 | LLM proxy backend |
| P4 | 5 | metabob-mcp integration |
| P5 | 3 | MiniBob integration (optional) |
| P6 | 4 | Helm and deployment |
| P7 | 4 | Testing |
| P8 | 4 | Documentation |
| **Total** | **36** | |

## Recommended Order

1. **P1** (Schema) - Foundation for everything
2. **P2.1-P2.4** (Connection endpoints) - Core slot management
3. **P2.5-P2.6** (Workers, Redis) - Background processing
4. **P3.1-P3.2** (Router, Pattern store) - Resolution infrastructure
5. **P3.3-P3.5** (LLM proxy, Budget) - Proxy functionality
6. **P4.1-P4.2** (Connection manager, API client) - MCP integration
7. **P4.3-P4.5** (Activity tools) - Complete MCP tools
8. **P6** (Deployment) - Get it running
9. **P7** (Testing) - Validate everything
10. **P3.6** (Pattern extraction) - Enable learning
11. **P5** (MiniBob) - Optional direct integration
12. **P8** (Docs) - Final documentation

## Dependencies

```
P1 ──────────────────────────────────────┐
                                         │
P2.1-P2.4 ◀──────────────────────────────┤
    │                                    │
    ▼                                    │
P2.5-P2.6                                │
    │                                    │
    ▼                                    │
P3.1-P3.2 ◀──────────────────────────────┘
    │
    ▼
P3.3-P3.5
    │
    ├───────────────────┐
    │                   │
    ▼                   ▼
P4.1-P4.2           P3.6
    │
    ▼
P4.3-P4.5
    │
    ├───────────┬───────────┐
    │           │           │
    ▼           ▼           ▼
   P5          P6          P7
                           │
                           ▼
                          P8
```
