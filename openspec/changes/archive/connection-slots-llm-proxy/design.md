# Connection Slots and LLM Proxy: Technical Design

> **Aligned with**: `docs/architecture/IMPULSE_ACTIVITY_FOUNDATION.md`

## Foundation Alignment

This design implements key principles from the foundation:

> "LLMs are one resolver type among many, used only when reasoning about ambiguous input is needed"

Key alignment points:
- LLM is a resolver tier, not the controller
- Deterministic patterns preferred over LLM calls
- Every execution is traced for learning
- System improves by learning durable patterns, not by prompt engineering

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           AI AGENTS                                          │
│                  (Claude Code, Cursor, VS Code Continue)                     │
└─────────────────────────────────┬───────────────────────────────────────────┘
                                  │
                      MCP Protocol (JSON-RPC/stdio)
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           metabob-mcp                                        │
│                      (unified vessel gateway)                                │
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │                     CONNECTION SLOT LAYER                               │ │
│  │                                                                         │ │
│  │  API Key → acquire_slot() → Connection → JWT                           │ │
│  │  Heartbeat (30s) → grace period management                              │ │
│  │  Session tracking via X-Connection-ID header                            │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                  │                                           │
│         ┌────────────────────────┴────────────────────────┐                 │
│         │                                                 │                 │
│         ▼                                                 ▼                 │
│  ┌─────────────────────┐                     ┌─────────────────────┐       │
│  │   Analysis Tools    │                     │   Activity Tools    │       │
│  │                     │                     │                     │       │
│  │ get_priority        │                     │ run_goal            │       │
│  │ search_codebase     │                     │ get_recommendations │       │
│  │ annotate            │                     │ submit_trace        │       │
│  │ suggest_changes     │                     │ resolve_impulse     │       │
│  │ analyze_impact      │                     │                     │       │
│  └─────────┬───────────┘                     └─────────┬───────────┘       │
│            │                                           │                    │
└────────────┼───────────────────────────────────────────┼────────────────────┘
             │                                           │
             ▼                                           ▼
┌─────────────────────────┐               ┌─────────────────────────┐
│  metabob-analysis-api   │               │  metabob-activity-api   │
│                         │               │                         │
│  Code analysis          │               │  Trace storage          │
│  CPG inference          │               │  Thompson Sampling      │
│  Impact graphs          │               │  Pattern learning       │
│                         │               │  LLM Proxy              │
└─────────────────────────┘               └────────────┬────────────┘
                                                       │
                                                       ▼
                                          ┌─────────────────────────┐
                                          │    RESOLVER ROUTER      │
                                          │                         │
                                          │  Tier 1: Pattern match  │
                                          │  Tier 2: Interpolation  │
                                          │  Tier 3: Haiku          │
                                          │  Tier 4: Sonnet         │
                                          │  Tier 5: Opus           │
                                          └────────────┬────────────┘
                                                       │
                                    ┌──────────────────┼──────────────────┐
                                    │                  │                  │
                                    ▼                  ▼                  ▼
                              ┌──────────┐      ┌──────────┐      ┌──────────┐
                              │ Pattern  │      │  Redis   │      │ Anthropic│
                              │  Store   │      │  Cache   │      │   API    │
                              │(SurrealDB)│     │          │      │          │
                              └──────────┘      └──────────┘      └──────────┘
```

## Data Model

### API Key (billing entity)

```sql
DEFINE TABLE api_key SCHEMAFULL;

DEFINE FIELD org_id ON api_key TYPE record<organizations>
  ASSERT $value != NONE;
DEFINE FIELD name ON api_key TYPE string
  ASSERT $value != NONE AND string::len($value) > 0;
DEFINE FIELD key_hash ON api_key TYPE string
  ASSERT $value != NONE;
DEFINE FIELD max_connections ON api_key TYPE int
  DEFAULT 1
  ASSERT $value >= 1 AND $value <= 100;
DEFINE FIELD is_active ON api_key TYPE bool
  DEFAULT true;
DEFINE FIELD tier ON api_key TYPE string
  DEFAULT "starter"
  ASSERT $value IN ["starter", "pro", "enterprise"];

-- Token budget for LLM proxy
DEFINE FIELD llm_budget ON api_key TYPE object DEFAULT {
  tokens_per_month: 10000000,
  tokens_used: 0,
  reset_at: time::now() + 30d,
  overage_enabled: false
};

-- Metadata
DEFINE FIELD created_at ON api_key TYPE datetime DEFAULT time::now();
DEFINE FIELD updated_at ON api_key TYPE datetime DEFAULT time::now();
DEFINE FIELD billing_email ON api_key TYPE option<string>;

-- Indexes
DEFINE INDEX api_key_org_idx ON api_key FIELDS org_id;
DEFINE INDEX api_key_active_idx ON api_key FIELDS is_active;

-- RBAC
DEFINE ACCESS api_key_access ON api_key
  FOR select, update
  WHERE org_id = $auth.org_id;
```

### Connection (active session)

```sql
DEFINE TABLE connection SCHEMAFULL;

DEFINE FIELD api_key_id ON connection TYPE record<api_key>
  ASSERT $value != NONE;
DEFINE FIELD org_id ON connection TYPE record<organizations>
  ASSERT $value != NONE;
DEFINE FIELD instance_name ON connection TYPE option<string>;
DEFINE FIELD session_token ON connection TYPE string
  ASSERT $value != NONE;

-- Connection state
DEFINE FIELD status ON connection TYPE string
  DEFAULT "active"
  ASSERT $value IN ["active", "grace", "disconnected"];
DEFINE FIELD connected_at ON connection TYPE datetime
  DEFAULT time::now();
DEFINE FIELD last_heartbeat ON connection TYPE datetime
  DEFAULT time::now();
DEFINE FIELD grace_until ON connection TYPE option<datetime>;

-- Execution tracking (for grace period calculation)
DEFINE FIELD current_execution ON connection TYPE option<record<activity_execution_traces>>;
DEFINE FIELD execution_started_at ON connection TYPE option<datetime>;

-- JWT for this connection
DEFINE FIELD jwt_token ON connection TYPE string;
DEFINE FIELD jwt_expires_at ON connection TYPE datetime;

-- Indexes
DEFINE INDEX connection_api_key_idx ON connection FIELDS api_key_id;
DEFINE INDEX connection_status_idx ON connection FIELDS status;
DEFINE INDEX connection_session_idx ON connection FIELDS session_token UNIQUE;

-- RBAC
DEFINE ACCESS connection_access ON connection
  FOR select, create, update, delete
  WHERE org_id = $auth.org_id;
```

### LLM Resolution Log

```sql
DEFINE TABLE llm_resolution_log SCHEMAFULL;

DEFINE FIELD org_id ON llm_resolution_log TYPE record<organizations>;
DEFINE FIELD connection_id ON llm_resolution_log TYPE record<connection>;
DEFINE FIELD execution_id ON llm_resolution_log TYPE option<record<activity_execution_traces>>;

-- Resolver selection
DEFINE FIELD resolver_tier ON llm_resolution_log TYPE string
  ASSERT $value IN ["pattern", "interpolate", "haiku", "sonnet", "opus"];
DEFINE FIELD resolver_confidence ON llm_resolution_log TYPE float;
DEFINE FIELD resolver_reasoning ON llm_resolution_log TYPE string;

-- For pattern matches
DEFINE FIELD pattern_id ON llm_resolution_log TYPE option<string>;
DEFINE FIELD pattern_success_rate ON llm_resolution_log TYPE option<float>;

-- For LLM calls
DEFINE FIELD llm_request ON llm_resolution_log TYPE option<object>;
DEFINE FIELD llm_response ON llm_resolution_log TYPE option<object>;
DEFINE FIELD tokens_input ON llm_resolution_log TYPE option<int>;
DEFINE FIELD tokens_output ON llm_resolution_log TYPE option<int>;
DEFINE FIELD latency_ms ON llm_resolution_log TYPE option<int>;

-- Outcome
DEFINE FIELD success ON llm_resolution_log TYPE bool;
DEFINE FIELD cost_usd ON llm_resolution_log TYPE float DEFAULT 0;
DEFINE FIELD created_at ON llm_resolution_log TYPE datetime DEFAULT time::now();

-- For pattern extraction
DEFINE FIELD impulse_hash ON llm_resolution_log TYPE option<string>;
DEFINE FIELD pattern_extracted ON llm_resolution_log TYPE bool DEFAULT false;
DEFINE FIELD extracted_pattern_id ON llm_resolution_log TYPE option<string>;

-- Indexes
DEFINE INDEX llm_log_org_idx ON llm_resolution_log FIELDS org_id;
DEFINE INDEX llm_log_tier_idx ON llm_resolution_log FIELDS resolver_tier;
DEFINE INDEX llm_log_impulse_idx ON llm_resolution_log FIELDS impulse_hash;
```

## API Endpoints

### Connection Management

#### POST /v2/connections/acquire

Acquire a connection slot. Returns session token and JWT.

```typescript
// Request
{
  api_key: string,        // Raw API key (hashed for lookup)
  instance_name?: string  // Optional identifier for this connection
}

// Response (200)
{
  connection_id: string,
  session_token: string,  // Use for reconnection
  jwt: string,            // Bearer token for API calls
  jwt_expires_at: string, // ISO timestamp
  org_id: string,
  max_connections: number,
  active_connections: number,
  llm_budget: {
    tokens_remaining: number,
    reset_at: string
  }
}

// Response (429 - slot limit reached)
{
  error: "connection_limit_reached",
  message: "All connection slots are in use",
  max_connections: number,
  active_connections: number,
  oldest_connection: {
    instance_name: string,
    connected_at: string,
    status: string
  }
}
```

#### POST /v2/connections/heartbeat

Send heartbeat to maintain connection. Updates grace period based on execution state.

```typescript
// Request
{
  // Auth via Bearer token (JWT from acquire)
  current_execution?: {
    execution_id: string,
    activity_id: string,
    started_at: string,
    estimated_duration_ms?: number
  }
}

// Response (200)
{
  status: "active",
  next_heartbeat_due: string,  // ISO timestamp (now + 30s)
  grace_period_ms: number      // How long slot held after missed heartbeat
}
```

#### POST /v2/connections/reconnect

Reconnect using session token (within grace period).

```typescript
// Request
{
  session_token: string
}

// Response (200) - reconnected
{
  connection_id: string,
  jwt: string,
  jwt_expires_at: string,
  current_execution?: {...},  // Resume state
  status: "active"
}

// Response (410) - session expired
{
  error: "session_expired",
  message: "Grace period has passed, please acquire a new connection"
}
```

#### POST /v2/connections/release

Explicitly release a connection slot.

```typescript
// Request
{
  // Auth via Bearer token
}

// Response (200)
{
  released: true,
  connection_id: string
}
```

### LLM Proxy

#### POST /v2/resolve

Resolve an impulse through the tiered resolver system.

```typescript
// Request
{
  impulse: {
    id: string,
    pointer: {...},
    metadata: {
      shape: string,
      // ... other metadata for pattern matching
    }
  },
  execution_context?: {
    execution_id: string,
    task_index: number,
    previous_results: [...]
  },
  prefer_tier?: "pattern" | "haiku" | "sonnet" | "opus"  // Hint, not guarantee
}

// Response (200) - pattern match
{
  resolver_used: "pattern",
  pattern_id: "null-check-pattern-v3",
  confidence: 0.94,
  result: {...},
  cost_usd: 0,
  tokens_used: 0
}

// Response (200) - LLM resolution
{
  resolver_used: "sonnet",
  confidence: 0.85,
  result: {...},
  cost_usd: 0.023,
  tokens_used: {
    input: 1847,
    output: 234
  },
  thinking?: "...",  // If extended thinking enabled
  trace_id: "llm_resolution_log:xxx"
}

// Response (402) - budget exceeded
{
  error: "llm_budget_exceeded",
  message: "Monthly LLM token budget exhausted",
  tokens_used: 10000000,
  tokens_limit: 10000000,
  reset_at: "2026-04-01T00:00:00Z",
  pattern_matches_available: true  // Tier 1-2 still work
}
```

## Connection Lifecycle

### State Machine

```
                         acquire_slot()
                              │
                              ▼
                    ┌─────────────────┐
         ┌────────▶│     ACTIVE      │◀────────┐
         │         └────────┬────────┘         │
         │                  │                  │
         │         heartbeat_missed()     heartbeat()
         │                  │                  │
         │                  ▼                  │
         │         ┌─────────────────┐         │
    reconnect()    │      GRACE      │─────────┘
         │         └────────┬────────┘    (within grace)
         │                  │
         │         grace_expired()
         │                  │
         │                  ▼
         │         ┌─────────────────┐
         └─────────│  DISCONNECTED   │
        (expired)  └─────────────────┘
                            │
                   cleanup_job() (24h)
                            │
                            ▼
                        [DELETED]
```

### Grace Period Calculation

```typescript
function calculateGracePeriod(connection: Connection): number {
  const BASE_GRACE_MS = 2 * 60 * 1000; // 2 minutes idle
  const MAX_GRACE_MS = 30 * 60 * 1000; // 30 minutes hard cap

  if (!connection.current_execution) {
    return BASE_GRACE_MS;
  }

  const execution = connection.current_execution;
  const elapsed = Date.now() - execution.started_at;

  // Use estimated duration if available
  if (execution.estimated_duration_ms) {
    const remaining = execution.estimated_duration_ms - elapsed;
    const grace = remaining + (5 * 60 * 1000); // +5 min buffer
    return Math.min(grace, MAX_GRACE_MS);
  }

  // Default: assume activity takes 15 minutes max
  const DEFAULT_ACTIVITY_MS = 15 * 60 * 1000;
  const remaining = DEFAULT_ACTIVITY_MS - elapsed;
  return Math.min(Math.max(remaining, BASE_GRACE_MS), MAX_GRACE_MS);
}
```

### Heartbeat Worker

```typescript
// Background job running every 10 seconds
async function processHeartbeats() {
  const now = Date.now();
  const HEARTBEAT_INTERVAL_MS = 30 * 1000;

  // Find connections that missed heartbeat
  const stale = await db.query(`
    SELECT * FROM connection
    WHERE status = "active"
    AND last_heartbeat < $threshold
  `, { threshold: new Date(now - HEARTBEAT_INTERVAL_MS) });

  for (const conn of stale) {
    const gracePeriod = calculateGracePeriod(conn);

    await db.query(`
      UPDATE $conn SET
        status = "grace",
        grace_until = $graceUntil
    `, {
      conn: conn.id,
      graceUntil: new Date(now + gracePeriod)
    });

    // Log for monitoring
    logger.info("Connection entered grace period", {
      connection_id: conn.id,
      grace_ms: gracePeriod,
      has_execution: !!conn.current_execution
    });
  }

  // Find grace periods that expired
  const expired = await db.query(`
    SELECT * FROM connection
    WHERE status = "grace"
    AND grace_until < $now
  `, { now: new Date() });

  for (const conn of expired) {
    await db.query(`
      UPDATE $conn SET status = "disconnected"
    `, { conn: conn.id });

    // If there was an execution, mark it as orphaned
    if (conn.current_execution) {
      await db.query(`
        UPDATE $exec SET
          outcome.status = "orphaned",
          outcome.error = "Connection lost during execution"
      `, { exec: conn.current_execution });
    }

    logger.warn("Connection grace period expired", {
      connection_id: conn.id,
      had_execution: !!conn.current_execution
    });
  }
}
```

## Resolver Router

### Tier Selection Logic

```typescript
interface ResolverDecision {
  tier: 'pattern' | 'interpolate' | 'haiku' | 'sonnet' | 'opus';
  confidence: number;
  reasoning: string;
  estimated_cost: number;
  pattern_id?: string;
}

async function selectResolver(
  impulse: Impulse,
  context: ExecutionContext
): Promise<ResolverDecision> {

  // Tier 1: Exact pattern match
  const impulseHash = hashImpulseShape(impulse.metadata);
  const exactMatch = await patternStore.findExact(impulseHash);

  if (exactMatch && exactMatch.success_rate > 0.90 && exactMatch.executions > 10) {
    return {
      tier: 'pattern',
      confidence: exactMatch.success_rate,
      reasoning: `Exact match: ${exactMatch.pattern_id} (${exactMatch.executions} executions, ${(exactMatch.success_rate * 100).toFixed(1)}% success)`,
      estimated_cost: 0,
      pattern_id: exactMatch.pattern_id
    };
  }

  // Tier 2: Similar pattern with interpolation
  const similar = await patternStore.findSimilar(impulseHash, { threshold: 0.85 });

  if (similar && similar.success_rate > 0.85 && similar.executions > 5) {
    return {
      tier: 'interpolate',
      confidence: similar.success_rate * 0.95, // Slight penalty
      reasoning: `Interpolate from: ${similar.pattern_id} (similarity: ${(similar.similarity * 100).toFixed(1)}%)`,
      estimated_cost: 0,
      pattern_id: similar.pattern_id
    };
  }

  // Tier 3+: LLM required
  const complexity = estimateComplexity(impulse, context);

  // Tier 3: Haiku for simple tasks
  if (complexity.context_tokens < 4000 && complexity.reasoning_depth < 3) {
    return {
      tier: 'haiku',
      confidence: 0.70,
      reasoning: `Simple task (${complexity.context_tokens} tokens, depth ${complexity.reasoning_depth})`,
      estimated_cost: complexity.context_tokens * 0.00025 / 1000
    };
  }

  // Tier 4: Sonnet for moderate complexity
  if (complexity.context_tokens < 100000 && complexity.reasoning_depth < 5) {
    return {
      tier: 'sonnet',
      confidence: 0.85,
      reasoning: `Moderate complexity (${complexity.context_tokens} tokens, depth ${complexity.reasoning_depth})`,
      estimated_cost: complexity.context_tokens * 0.003 / 1000
    };
  }

  // Tier 5: Opus for complex/novel situations
  return {
    tier: 'opus',
    confidence: 0.95,
    reasoning: `High complexity or novel situation (${complexity.context_tokens} tokens, depth ${complexity.reasoning_depth})`,
    estimated_cost: complexity.context_tokens * 0.015 / 1000
  };
}

function hashImpulseShape(metadata: ImpulseMetadata): string {
  // Create a stable hash of the impulse "shape" for pattern matching
  // Ignores variable content, focuses on structure
  const shape = {
    type: metadata.shape,
    intent: metadata.intent,
    domain: metadata.domain,
    // Normalized/abstracted fields
  };
  return crypto.createHash('sha256').update(JSON.stringify(shape)).digest('hex');
}
```

### Pattern Extraction (Ribosome Integration)

```typescript
// After successful LLM resolution, check if pattern should be extracted
async function maybeExtractPattern(
  resolution: LLMResolutionLog,
  outcome: ExecutionOutcome
): Promise<void> {
  if (!outcome.success) return;

  // Find similar successful resolutions
  const similar = await db.query(`
    SELECT * FROM llm_resolution_log
    WHERE impulse_hash = $hash
    AND success = true
    AND pattern_extracted = false
    ORDER BY created_at DESC
    LIMIT 50
  `, { hash: resolution.impulse_hash });

  // Need minimum executions to extract pattern
  if (similar.length < 5) return;

  // Check consistency of results
  const consistency = calculateResultConsistency(similar);
  if (consistency < 0.85) return;

  // Extract pattern
  const pattern = await ribosomeExtract(similar);

  // Store pattern for Tier 1/2 matching
  await db.query(`
    CREATE pattern SET
      pattern_id = $patternId,
      impulse_hash = $hash,
      template = $template,
      success_rate = $successRate,
      executions = $executions,
      created_at = time::now()
  `, {
    patternId: `pattern-${resolution.impulse_hash.slice(0, 8)}-${Date.now()}`,
    hash: resolution.impulse_hash,
    template: pattern.template,
    successRate: consistency,
    executions: similar.length
  });

  // Mark source resolutions as extracted
  await db.query(`
    UPDATE llm_resolution_log
    SET pattern_extracted = true, extracted_pattern_id = $patternId
    WHERE id IN $ids
  `, { patternId: pattern.id, ids: similar.map(s => s.id) });

  logger.info("Pattern extracted from LLM resolutions", {
    pattern_id: pattern.id,
    source_resolutions: similar.length,
    success_rate: consistency
  });
}
```

## Token Budget Management

### Budget Tracking

```typescript
interface TokenBudget {
  tokens_per_month: number;
  tokens_used: number;
  reset_at: Date;
  overage_enabled: boolean;
}

async function checkAndDeductBudget(
  apiKeyId: string,
  tokensNeeded: number
): Promise<{ allowed: boolean; remaining: number }> {

  // Atomic check-and-deduct using Redis for speed
  const key = `budget:${apiKeyId}`;

  const result = await redis.eval(`
    local current = tonumber(redis.call('GET', KEYS[1]) or '0')
    local limit = tonumber(ARGV[1])
    local needed = tonumber(ARGV[2])

    if current + needed > limit then
      return {0, limit - current}  -- Denied
    end

    redis.call('INCRBY', KEYS[1], needed)
    return {1, limit - current - needed}  -- Allowed
  `, [key], [budget.tokens_per_month, tokensNeeded]);

  return {
    allowed: result[0] === 1,
    remaining: result[1]
  };
}

// Sync Redis to SurrealDB periodically
async function syncBudgetToDatabase() {
  const keys = await redis.keys('budget:*');

  for (const key of keys) {
    const apiKeyId = key.replace('budget:', '');
    const used = await redis.get(key);

    await db.query(`
      UPDATE $apiKey SET llm_budget.tokens_used = $used
    `, { apiKey: apiKeyId, used: parseInt(used) });
  }
}

// Monthly reset job
async function resetBudgets() {
  await db.query(`
    UPDATE api_key
    SET llm_budget.tokens_used = 0,
        llm_budget.reset_at = time::now() + 30d
    WHERE llm_budget.reset_at < time::now()
  `);

  // Clear Redis counters for reset keys
  // ...
}
```

## metabob-mcp Integration

### New Activity Tools

```typescript
// src/tools/activity.ts

export const activityTools = {
  run_goal: {
    name: "run_goal",
    description: "Execute a development goal using the activity system",
    inputSchema: z.object({
      goal: z.string().describe("What you want to achieve"),
      workdir: z.string().optional().describe("Working directory"),
      impulse_refs: z.array(z.string()).optional().describe("Additional context impulses")
    }),
    handler: async (input, context) => {
      // Route through resolver system
      const resolution = await activityClient.post('/v2/resolve', {
        impulse: {
          pointer: { type: 'goal', description: input.goal },
          metadata: { shape: 'goal', intent: 'execute' }
        },
        execution_context: context
      });

      return formatGoalResult(resolution);
    }
  },

  get_recommendations: {
    name: "get_recommendations",
    description: "Get activity recommendations for current situation",
    inputSchema: z.object({
      context: z.string().describe("Current situation description"),
      limit: z.number().optional().default(5)
    }),
    handler: async (input) => {
      const result = await activityClient.post('/v2/activities/recommend', {
        context: input.context,
        limit: input.limit
      });
      return formatRecommendations(result);
    }
  },

  submit_trace: {
    name: "submit_trace",
    description: "Submit execution trace for learning",
    inputSchema: z.object({
      execution_id: z.string(),
      success: z.boolean(),
      tasks: z.array(z.object({
        id: z.string(),
        prompt: z.string(),
        result: z.string(),
        duration_ms: z.number()
      }))
    }),
    handler: async (input) => {
      const result = await activityClient.post('/v2/activities/execution-traces', input);
      return { trace_id: result.id, recorded: true };
    }
  }
};
```

### Connection Lifecycle in metabob-mcp

```typescript
// src/connection-manager.ts

export class ConnectionManager {
  private sessionToken: string | null = null;
  private jwt: string | null = null;
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private currentExecution: ExecutionState | null = null;

  async connect(apiKey: string, instanceName?: string): Promise<void> {
    const response = await fetch(`${this.endpoint}/v2/connections/acquire`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ api_key: apiKey, instance_name: instanceName })
    });

    if (response.status === 429) {
      const error = await response.json();
      throw new ConnectionLimitError(error);
    }

    const data = await response.json();
    this.sessionToken = data.session_token;
    this.jwt = data.jwt;

    // Start heartbeat
    this.startHeartbeat();
  }

  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(async () => {
      try {
        await fetch(`${this.endpoint}/v2/connections/heartbeat`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.jwt}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            current_execution: this.currentExecution
          })
        });
      } catch (error) {
        console.error('Heartbeat failed:', error);
        // Will enter grace period, attempt reconnect on next API call
      }
    }, 30000); // 30 seconds
  }

  async reconnect(): Promise<boolean> {
    if (!this.sessionToken) return false;

    try {
      const response = await fetch(`${this.endpoint}/v2/connections/reconnect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_token: this.sessionToken })
      });

      if (response.status === 410) {
        // Session expired, need new connection
        return false;
      }

      const data = await response.json();
      this.jwt = data.jwt;
      this.currentExecution = data.current_execution || null;
      this.startHeartbeat();
      return true;
    } catch {
      return false;
    }
  }

  setCurrentExecution(execution: ExecutionState | null): void {
    this.currentExecution = execution;
  }

  async disconnect(): Promise<void> {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }

    if (this.jwt) {
      await fetch(`${this.endpoint}/v2/connections/release`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${this.jwt}` }
      });
    }

    this.sessionToken = null;
    this.jwt = null;
  }
}
```

## Redis Schema

```
# Connection slot counting (fast path)
SET   slot_count:{api_key_id}           <active_connection_count>
EXPIRE slot_count:{api_key_id}          300  # 5 min TTL, refreshed on heartbeat

# Token budget (fast path)
SET   budget:{api_key_id}               <tokens_used>
EXPIRE budget:{api_key_id}              86400  # 1 day TTL, synced to DB

# Active connections (for slot acquisition)
SADD  connections:{api_key_id}          <connection_id>
EXPIRE connections:{api_key_id}         300

# Connection details (for grace period)
HSET  conn:{connection_id}              status         <active|grace>
HSET  conn:{connection_id}              last_heartbeat <timestamp>
HSET  conn:{connection_id}              grace_until    <timestamp>
HSET  conn:{connection_id}              execution_id   <execution_id|null>
EXPIRE conn:{connection_id}             3600  # 1 hour TTL

# Pattern cache (for Tier 1 resolution)
HSET  pattern:{impulse_hash}            pattern_id     <pattern_id>
HSET  pattern:{impulse_hash}            success_rate   <float>
HSET  pattern:{impulse_hash}            template       <json>
EXPIRE pattern:{impulse_hash}           86400  # 1 day, refreshed on hit
```

## Testing Strategy

### Unit Tests

1. **Grace period calculation**
   - Idle connection → 2 min grace
   - Active execution → estimated remaining + 5 min
   - Hard cap at 30 min

2. **Slot counting**
   - Acquire increments count
   - Release decrements count
   - Grace period maintains count
   - Disconnected frees count

3. **Resolver selection**
   - Pattern match with high success rate → Tier 1
   - Similar pattern → Tier 2
   - Simple task → Tier 3 (Haiku)
   - Complex task → Tier 4 (Sonnet)
   - Novel/high-stakes → Tier 5 (Opus)

### Integration Tests

```bash
# Test connection slot limits
for i in {1..5}; do
  curl -X POST http://activity.metabob.local/v2/connections/acquire \
    -H "Content-Type: application/json" \
    -d '{"api_key":"test-key","instance_name":"test-'$i'"}'
done

# 6th should fail with 429
curl -X POST http://activity.metabob.local/v2/connections/acquire \
  -H "Content-Type: application/json" \
  -d '{"api_key":"test-key","instance_name":"test-6"}'
# Expected: 429 Connection limit reached

# Test grace period
# 1. Acquire connection
# 2. Start execution
# 3. Kill heartbeat
# 4. Verify grace period calculated from execution
# 5. Reconnect within grace → success
# 6. Wait for grace to expire → 410
```

### End-to-End Test

```bash
# Full flow through metabob-mcp
cd repos/metabob-mcp

# Configure with API key (no ANTHROPIC_API_KEY needed!)
export METABOB_API_KEY="mb-xxx"
export METABOB_ENDPOINT="http://activity.metabob.local"

# Start MCP server
bun run start

# In Claude Code, use the activity tools
# - run_goal should route through resolver
# - Pattern matches should cost $0
# - LLM calls should use our proxy
# - Traces should be recorded
```

## Monitoring

### Key Metrics

| Metric | Description | Alert Threshold |
|--------|-------------|-----------------|
| `connection_slots_used` | Active slots per api_key | > 80% of max |
| `grace_period_entries` | Connections entering grace | > 10/min |
| `resolver_tier_distribution` | % per tier | Tier 4/5 > 30% |
| `pattern_match_rate` | Tier 1+2 vs total | < 50% after warmup |
| `llm_proxy_latency_p99` | Proxy overhead | > 500ms |
| `budget_utilization` | Tokens used vs limit | > 90% |

### Dashboard Queries

```sql
-- Connection slot utilization by org
SELECT
  org_id,
  count() as active_connections,
  (SELECT max_connections FROM api_key WHERE id = connection.api_key_id) as max_connections
FROM connection
WHERE status IN ["active", "grace"]
GROUP BY org_id;

-- Resolver tier distribution (last 24h)
SELECT
  resolver_tier,
  count() as count,
  math::sum(cost_usd) as total_cost,
  math::avg(latency_ms) as avg_latency
FROM llm_resolution_log
WHERE created_at > time::now() - 24h
GROUP BY resolver_tier;

-- Pattern extraction progress
SELECT
  count() as total_resolutions,
  count(IF pattern_extracted THEN 1 ELSE NONE END) as extracted,
  count(IF resolver_tier = "pattern" THEN 1 ELSE NONE END) as pattern_matches
FROM llm_resolution_log
WHERE created_at > time::now() - 7d;
```
