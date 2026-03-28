# Connection Slots & LLM Proxy: Implementation Tasks v2

> **Reorganized with commit milestones and testable states**

---

## Milestone Overview

| # | Milestone | Commit Message | Testable State |
|---|-----------|----------------|----------------|
| 1 | Schema Foundation | `feat(schema): add connection slot and LLM resolution tables` | Tables exist, migrations pass |
| 2 | Shared Utilities | `feat(utils): create @metabob/connection-utils package` | Unit tests pass |
| 3 | Connection Slots Backend | `feat(activity-api): implement connection slot management` | Acquire/heartbeat/release working |
| 4 | Pattern Resolution | `feat(activity-api): implement tiered resolver with pattern matching` | Tier 1-2 working, no LLM |
| 5 | LLM Proxy | `feat(activity-api): add Anthropic LLM proxy for tiers 3-5` | Full resolution working |
| 6 | MCP Integration | `feat(mcp): integrate connection slots and activity tools` | MCP routes through proxy |
| 7 | Pattern Extraction | `feat(activity-api): implement pattern extraction from traces` | Learning loop closed |
| 8 | Deployment | `feat(helm): deploy connection slots and LLM proxy` | Running in K8s |
| 9 | Documentation | `docs: add connection slots and LLM proxy documentation` | Docs complete |

---

## Milestone 1: Schema Foundation

**Commit**: `feat(schema): add connection slot and LLM resolution tables`

### Tasks

#### 1.1 Create connection table
**File**: `repos/metabob-proto/surrealdb/core/006-connection-slots.surql`

```surql
-- Connection table with full PERMISSIONS
DEFINE TABLE connection SCHEMAFULL
  PERMISSIONS
    FOR select WHERE org_id = $auth.org_id
    FOR create WHERE $auth.org_id != NONE
    FOR update WHERE org_id = $auth.org_id AND (created_by = $auth.id OR $auth.role = 'admin')
    FOR delete WHERE org_id = $auth.org_id AND $auth.role = 'admin';

-- Fields per design.md
-- Indexes: idx_connection_org, idx_connection_session (UNIQUE), idx_connection_status
```

#### 1.2 Create llm_resolution_log table
**File**: `repos/metabob-proto/surrealdb/activity/017-llm-resolution.surql`

```surql
-- Full trace capture for every resolution
DEFINE TABLE llm_resolution_log SCHEMAFULL;
-- Fields: resolver_tier, confidence, llm_request/response, tokens, cost, impulse_hash
-- Indexes: idx_llm_log_org, idx_llm_log_tier, idx_llm_log_hash
```

#### 1.3 Create pattern table
**File**: `repos/metabob-proto/surrealdb/activity/018-patterns.surql`

```surql
-- Extracted deterministic resolvers
DEFINE TABLE pattern SCHEMAFULL;
-- Fields: pattern_id, impulse_hash, template, success_rate, executions
-- Indexes: idx_pattern_hash, idx_pattern_org
```

#### 1.4 Extend api_keys table
**File**: `repos/metabob-proto/surrealdb/core/005-api-keys-enhancement.surql` (extend)

```surql
-- Add to existing api_keys table
DEFINE FIELD max_connections ON api_keys TYPE int DEFAULT 1;
DEFINE FIELD llm_budget ON api_keys TYPE object DEFAULT {...};
DEFINE FIELD tier ON api_keys TYPE string DEFAULT "starter";
```

### Verification
```bash
# Run migration
kubectl exec -n activity-system surrealdb-0 -- surreal sql \
  --ns activity-system --db learning_loop \
  "INFO FOR DB"

# Verify tables exist
# Expected: connection, llm_resolution_log, pattern tables listed
```

---

## Milestone 2: Shared Utilities Package

**Commit**: `feat(utils): create @metabob/connection-utils package`

### Tasks

#### 2.1 Error handling module
**Files**: `packages/connection-utils/src/errors/`

- `types.ts`: StandardError interface
- `codes.ts`: Error code constants (CONNECTION_LIMIT_REACHED, SESSION_EXPIRED, BUDGET_EXCEEDED)
- `transformer.ts`: HTTP status → StandardError mapping

#### 2.2 Auth module
**Files**: `packages/connection-utils/src/auth/`

- `context.ts`: AuthContext interface (org_id, user_id, project_ids, scopes)
- `jwt.ts`: JWT validation, claims extraction
- `middleware.ts`: Hono middleware factory

#### 2.3 Rate limiting module
**Files**: `packages/connection-utils/src/rate-limit/`

- `limiter.ts`: Base RateLimiter interface
- `memory.ts`: In-memory sliding window implementation
- `redis.ts`: Redis-backed implementation for distributed

#### 2.4 Circuit breaker module
**Files**: `packages/connection-utils/src/circuit-breaker/`

- `breaker.ts`: CircuitBreaker class with CLOSED/OPEN/HALF_OPEN states

#### 2.5 Logging module
**Files**: `packages/connection-utils/src/logging/`

- `logger.ts`: Structured logger with context, JSON/text formats

#### 2.6 Config module
**Files**: `packages/connection-utils/src/config/`

- `loader.ts`: Type-safe config loading with validation

### Verification
```bash
cd packages/connection-utils
bun test
# Expected: All tests pass
```

---

## Milestone 3: Connection Slots Backend

**Commit**: `feat(activity-api): implement connection slot management`

### Tasks

#### 3.1 Acquire endpoint
**File**: `repos/metabob-activity-api/src/routes/connections.ts`

```typescript
// POST /v2/connections/acquire
// - Validate API key (argon2 hash compare)
// - Check slot availability (Redis count)
// - Create connection record
// - Generate JWT
// - Return session_token
```

#### 3.2 Heartbeat endpoint
**File**: `repos/metabob-activity-api/src/routes/connections.ts`

```typescript
// POST /v2/connections/heartbeat
// - Update last_heartbeat
// - Accept current_execution state
// - Return next_heartbeat_due, grace_period_ms
```

#### 3.3 Reconnect endpoint
**File**: `repos/metabob-activity-api/src/routes/connections.ts`

```typescript
// POST /v2/connections/reconnect
// - Validate session_token
// - Check grace period
// - Restore active status or return 410
```

#### 3.4 Release endpoint
**File**: `repos/metabob-activity-api/src/routes/connections.ts`

```typescript
// POST /v2/connections/release
// - Mark connection disconnected
// - Release slot in Redis
```

#### 3.5 Redis slot operations
**File**: `repos/metabob-activity-api/src/db/redis.ts`

```typescript
async function acquireSlot(apiKeyId: string, connectionId: string): Promise<boolean>
async function releaseSlot(apiKeyId: string, connectionId: string): Promise<void>
async function getSlotCount(apiKeyId: string): Promise<number>
async function refreshSlotTTL(apiKeyId: string): Promise<void>
```

#### 3.6 Heartbeat worker
**File**: `repos/metabob-activity-api/src/workers/heartbeat.ts`

```typescript
// Background job every 10s
// - Find stale connections (missed heartbeat)
// - Calculate grace period
// - Transition to grace status
// - Expire grace periods
// - Mark orphaned executions
```

### Verification
```bash
# Acquire connection
curl -X POST http://activity.metabob.local/v2/connections/acquire \
  -H "Content-Type: application/json" \
  -d '{"api_key":"test-key","instance_name":"test-1"}'

# Check status (should show 1 active)
curl http://activity.metabob.local/v2/connections/status

# Send heartbeat
curl -X POST http://activity.metabob.local/v2/connections/heartbeat \
  -H "Authorization: Bearer $JWT"

# Release
curl -X POST http://activity.metabob.local/v2/connections/release \
  -H "Authorization: Bearer $JWT"
```

---

## Milestone 4: Pattern Resolution

**Commit**: `feat(activity-api): implement tiered resolver with pattern matching`

### Tasks

#### 4.1 Resolver router
**File**: `repos/metabob-activity-api/src/resolvers/router.ts`

```typescript
interface ResolverDecision {
  tier: 'pattern' | 'interpolate' | 'haiku' | 'sonnet' | 'opus';
  confidence: number;
  reasoning: string;
  estimated_cost: number;
  pattern_id?: string;
}

async function selectResolver(impulse: Impulse, context?: ExecutionContext): Promise<ResolverDecision>
```

#### 4.2 Pattern store
**File**: `repos/metabob-activity-api/src/resolvers/pattern-store.ts`

```typescript
async function findExact(impulseHash: string): Promise<Pattern | null>
async function findSimilar(impulseHash: string, threshold: number): Promise<Pattern | null>
```

#### 4.3 Impulse hash function
**File**: `repos/metabob-activity-api/src/resolvers/hash.ts`

```typescript
function hashImpulseShape(metadata: ImpulseMetadata): string {
  // Create stable hash of impulse "shape" for pattern matching
  // Ignores variable content, focuses on structure
}
```

#### 4.4 Resolve endpoint (pattern only)
**File**: `repos/metabob-activity-api/src/routes/resolve.ts`

```typescript
// POST /v2/resolve
// - Extract impulse from request
// - Call selectResolver()
// - If Tier 1/2: execute pattern, return result
// - If Tier 3+: return "llm_required" (for now)
```

#### 4.5 Redis pattern cache
**File**: `repos/metabob-activity-api/src/db/redis.ts`

```typescript
async function cachePattern(impulseHash: string, pattern: Pattern): Promise<void>
async function getCachedPattern(impulseHash: string): Promise<Pattern | null>
```

### Verification
```bash
# Manually create a pattern in DB
kubectl exec -n activity-system surrealdb-0 -- surreal sql \
  --ns activity-system --db learning_loop \
  "CREATE pattern SET pattern_id='test', impulse_hash='abc123', template={...}, success_rate=0.95, executions=15"

# Resolve should match it
curl -X POST http://activity.metabob.local/v2/resolve \
  -H "Authorization: Bearer $JWT" \
  -d '{"impulse":{"metadata":{"shape":"abc123"}}}'

# Expected: resolver_used: "pattern", cost_usd: 0
```

---

## Milestone 5: LLM Proxy

**Commit**: `feat(activity-api): add Anthropic LLM proxy for tiers 3-5`

### Tasks

#### 5.1 LLM proxy client
**File**: `repos/metabob-activity-api/src/resolvers/llm-proxy.ts`

```typescript
class LLMProxy {
  async callHaiku(prompt: string, options?: LLMOptions): Promise<LLMResponse>
  async callSonnet(prompt: string, options?: LLMOptions): Promise<LLMResponse>
  async callOpus(prompt: string, options?: LLMOptions): Promise<LLMResponse>
}
```

#### 5.2 Model-specific methods
**File**: `repos/metabob-activity-api/src/resolvers/llm-proxy.ts`

- Haiku: claude-3-haiku-20240307, max 4K context
- Sonnet: claude-sonnet-4-20250514, max 100K context
- Opus: claude-opus-4-5-20251101, full context

#### 5.3 Token budget management
**File**: `repos/metabob-activity-api/src/resolvers/budget.ts`

```typescript
async function checkAndDeductBudget(apiKeyId: string, tokensNeeded: number): Promise<{allowed: boolean, remaining: number}>
async function syncBudgetToDatabase(): Promise<void>  // Periodic job
async function resetBudgets(): Promise<void>  // Monthly job
```

#### 5.4 Integrate LLM into resolve endpoint
**File**: `repos/metabob-activity-api/src/routes/resolve.ts`

```typescript
// Extend resolve endpoint
// - If Tier 3+: check budget
// - Call appropriate LLM method
// - Deduct tokens
// - Record trace
// - Return result
```

#### 5.5 Resolution trace recording
**File**: `repos/metabob-activity-api/src/resolvers/trace.ts`

```typescript
async function recordResolution(resolution: LLMResolution): Promise<string>
// Store in llm_resolution_log with full prompt/response/tokens/cost
```

### Verification
```bash
# Force LLM resolution with novel impulse
curl -X POST http://activity.metabob.local/v2/resolve \
  -H "Authorization: Bearer $JWT" \
  -d '{"impulse":{"metadata":{"shape":"completely-novel"}}}'

# Expected: resolver_used: "sonnet" (or haiku based on complexity)
# Check trace was recorded
kubectl exec -n activity-system surrealdb-0 -- surreal sql \
  --ns activity-system --db learning_loop \
  "SELECT * FROM llm_resolution_log ORDER BY created_at DESC LIMIT 1"
```

---

## Milestone 6: MCP Integration

**Commit**: `feat(mcp): integrate connection slots and activity tools`

### Tasks

#### 6.1 Connection manager class
**File**: `repos/metabob-mcp/src/connection-manager.ts`

```typescript
class ConnectionManager {
  async connect(apiKey: string, instanceName?: string): Promise<void>
  async disconnect(): Promise<void>
  async reconnect(): Promise<boolean>
  setCurrentExecution(execution: ExecutionState | null): void
}
```

#### 6.2 Heartbeat loop
**File**: `repos/metabob-mcp/src/connection-manager.ts`

```typescript
private startHeartbeat(): void {
  this.heartbeatInterval = setInterval(async () => {
    await this.sendHeartbeat();
  }, 30000);
}
```

#### 6.3 Update API client
**File**: `repos/metabob-mcp/src/api-client.ts`

- Add `X-Connection-ID` header to all requests
- Handle 429 (slot limit) gracefully
- Auto-reconnect on auth failures

#### 6.4 Activity tools
**File**: `repos/metabob-mcp/src/tools/activity.ts`

```typescript
const activityTools = {
  run_goal: {...},           // Route through /v2/resolve
  get_recommendations: {...}, // Route through /v2/activities/recommend
  submit_trace: {...},       // Route through /v2/activities/execution-traces
  resolve_impulse: {...}     // Route through /v2/resolve
}
```

#### 6.5 Register activity tools
**File**: `repos/metabob-mcp/src/index.ts`

- Import activity tools
- Register alongside analysis tools
- Update capabilities advertisement

#### 6.6 Make ANTHROPIC_API_KEY optional
**File**: `repos/metabob-mcp/src/config.ts`

- METABOB_API_KEY is sufficient
- LLM access via proxy
- Direct key optional for dev only

### Verification
```bash
# Start MCP with only METABOB_API_KEY
export METABOB_API_KEY="test-key"
export METABOB_ENDPOINT="http://activity.metabob.local"
bun run repos/metabob-mcp/src/index.ts

# In Claude Desktop, test activity tools
# run_goal should work without ANTHROPIC_API_KEY
```

---

## Milestone 7: Pattern Extraction

**Commit**: `feat(activity-api): implement pattern extraction from traces`

### Tasks

#### 7.1 Pattern extraction function
**File**: `repos/metabob-activity-api/src/resolvers/pattern-extractor.ts`

```typescript
async function maybeExtractPattern(resolution: LLMResolution, outcome: ExecutionOutcome): Promise<void> {
  // Check if 5+ similar successful resolutions exist
  // Calculate result consistency
  // If consistent, extract pattern
  // Store in pattern table
  // Mark source resolutions as extracted
}
```

#### 7.2 Consistency calculation
**File**: `repos/metabob-activity-api/src/resolvers/pattern-extractor.ts`

```typescript
function calculateResultConsistency(resolutions: LLMResolution[]): number {
  // Compare outputs across resolutions
  // Return 0-1 similarity score
}
```

#### 7.3 Background extraction job
**File**: `repos/metabob-activity-api/src/workers/pattern-extraction.ts`

```typescript
// Periodic job (every 5 min)
// - Find impulse hashes with 5+ unextracted resolutions
// - Calculate consistency
// - Extract patterns where consistency > 0.85
```

#### 7.4 Trigger extraction after resolution
**File**: `repos/metabob-activity-api/src/routes/resolve.ts`

```typescript
// After successful LLM resolution
if (outcome.success) {
  // Fire-and-forget pattern extraction check
  maybeExtractPattern(resolution, outcome).catch(console.warn);
}
```

### Verification
```bash
# Run same query 6 times successfully
for i in {1..6}; do
  curl -X POST http://activity.metabob.local/v2/resolve \
    -H "Authorization: Bearer $JWT" \
    -d '{"impulse":{"metadata":{"shape":"repeated-task"}}}'
  sleep 2
done

# Wait for extraction job
sleep 300

# Check pattern was created
kubectl exec -n activity-system surrealdb-0 -- surreal sql \
  --ns activity-system --db learning_loop \
  "SELECT * FROM pattern WHERE impulse_hash CONTAINS 'repeated-task'"

# Next resolution should use pattern (Tier 1)
curl -X POST http://activity.metabob.local/v2/resolve \
  -H "Authorization: Bearer $JWT" \
  -d '{"impulse":{"metadata":{"shape":"repeated-task"}}}'
# Expected: resolver_used: "pattern", cost_usd: 0
```

---

## Milestone 8: Deployment

**Commit**: `feat(helm): deploy connection slots and LLM proxy`

### Tasks

#### 8.1 Activity API values
**File**: `helm/charts/metabob-activity-api/values.yaml`

```yaml
env:
  ANTHROPIC_API_KEY:
    secretKeyRef:
      name: anthropic-api-key
      key: api-key
  HEARTBEAT_WORKER_ENABLED: "true"
  HEARTBEAT_INTERVAL_MS: "10000"
  PATTERN_EXTRACTION_ENABLED: "true"
```

#### 8.2 Heartbeat worker config
**File**: `helm/charts/metabob-activity-api/values.yaml`

```yaml
workers:
  heartbeat:
    enabled: true
    intervalMs: 10000
  patternExtraction:
    enabled: true
    intervalMs: 300000
```

#### 8.3 MCP values update
**File**: `helm/charts/metabob-mcp/values.yaml`

```yaml
env:
  METABOB_API_KEY:
    secretKeyRef:
      name: metabob-api-key
      key: api-key
  ACTIVITY_API_URL: "http://metabob-activity-api:8080"
  # ANTHROPIC_API_KEY removed - no longer required
```

#### 8.4 Connection slot tests
**File**: `repos/metabob-activity-api/test/connections.test.ts`

- Test slot acquisition
- Test heartbeat updates
- Test grace period calculation
- Test reconnection
- Test FIFO enforcement

#### 8.5 Resolver tests
**File**: `repos/metabob-activity-api/test/resolver.test.ts`

- Test tier selection logic
- Test pattern matching
- Test complexity estimation
- Test budget enforcement

#### 8.6 Integration tests
**File**: `repos/metabob-activity-api/test/integration/`

- Test full connection lifecycle
- Test reconnection within grace
- Test LLM proxy end-to-end
- Test pattern extraction

### Verification
```bash
# Deploy
helmfile -f helm/activity-system-minimal.yaml.gotmpl sync

# Verify pods
kubectl get pods -n activity-system

# Health check
curl http://activity.metabob.local/health

# Run tests
cd repos/metabob-activity-api && bun test
```

---

## Milestone 9: Documentation

**Commit**: `docs: add connection slots and LLM proxy documentation`

### Tasks

#### 9.1 Connection API docs
**File**: `docs/api/connections.md`

- Endpoint reference
- Request/response examples
- Error codes
- Grace period behavior

#### 9.2 Resolve API docs
**File**: `docs/api/resolve.md`

- Endpoint reference
- Tier selection logic
- Pattern matching
- Budget management

#### 9.3 Architecture docs
**File**: `docs/architecture/CONNECTION_SLOTS.md`

- Design rationale
- Data model
- State machine
- RBAC integration

#### 9.4 LLM proxy architecture
**File**: `docs/architecture/LLM_PROXY.md`

- Tiered resolution
- Pattern extraction
- Learning loop
- Cost optimization

#### 9.5 Dashboard queries
**File**: `repos/activity-dashboard/src/queries/`

- Connection slot utilization
- Resolver tier distribution
- Pattern extraction progress
- Budget utilization

---

## Task Summary

| Milestone | Tasks | Estimated Effort |
|-----------|-------|------------------|
| 1. Schema | 4 | 1 day |
| 2. Utilities | 6 | 2 days |
| 3. Connection Slots | 6 | 3 days |
| 4. Pattern Resolution | 5 | 2 days |
| 5. LLM Proxy | 5 | 3 days |
| 6. MCP Integration | 6 | 2 days |
| 7. Pattern Extraction | 4 | 2 days |
| 8. Deployment | 6 | 2 days |
| 9. Documentation | 5 | 1 day |
| **Total** | **47** | **~18 days** |

---

## Dependency Graph

```
M1 (Schema)
    │
    ├──────────────────────────────────┐
    │                                  │
    ▼                                  ▼
M2 (Utilities)                    M3 (Connection Slots)
    │                                  │
    └──────────┬───────────────────────┘
               │
               ▼
          M4 (Pattern Resolution)
               │
               ▼
          M5 (LLM Proxy)
               │
               ├──────────────────────────────┐
               │                              │
               ▼                              ▼
          M6 (MCP Integration)           M7 (Pattern Extraction)
               │                              │
               └──────────────┬───────────────┘
                              │
                              ▼
                         M8 (Deployment)
                              │
                              ▼
                         M9 (Documentation)
```
