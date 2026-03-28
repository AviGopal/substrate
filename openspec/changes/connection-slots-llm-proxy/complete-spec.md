# Connection Slots & LLM Proxy: Complete Specification

> **Status**: Comprehensive spec synthesized from structured exploration
> **Date**: 2026-03-26

---

## Table of Contents

1. [System Ethos & Bridge Philosophy](#1-system-ethos--bridge-philosophy)
2. [Interface Boundaries & Data Flow](#2-interface-boundaries--data-flow)
3. [Existing Schema Analysis & Field Sourcing](#3-existing-schema-analysis--field-sourcing)
4. [Reusable Components](#4-reusable-components)
5. [Common Patterns to Colocate](#5-common-patterns-to-colocate)
6. [RBAC & Multi-Tenant Constraints](#6-rbac--multi-tenant-constraints)
7. [Reorganized Task List with Commit Milestones](#7-reorganized-task-list-with-commit-milestones)

---

## 1. System Ethos & Bridge Philosophy

### 1.1 The Core Mission

> "We are only begrudgingly asking for payment. Our main goal is to collect traces and improve."

metabob-mcp is a **bridge vessel** that translates traditional software development into the impulse-activity-execution paradigm. It does this through:

1. **Non-invasive observation** - Tools augment, never replace, existing workflows
2. **Trace-driven learning** - Every interaction recorded with full state transitions
3. **Tiered resolution** - LLMs are resolvers, ranked by cost, with patterns replacing expensive calls
4. **Connection slots as learning infrastructure** - Monetization funds LLM proxying to capture rich traces

### 1.2 The Three-State Ontology

| State | Definition | In This System |
|-------|------------|----------------|
| **Instructional (Vessel)** | Capacity to execute; blueprint | Activity templates, metabob-mcp binary, connection slot configs |
| **Transient (Becoming)** | Active transformation; execution in flight | Activity executing, LLM generating, pattern extracting |
| **Functional (Instance)** | Realized outcome; artifacts | Completed trace, written files, extracted pattern |

**Key insight**: The becoming never stops. Completed activities feed learning that transforms the next execution.

### 1.3 Foundation Alignment Checklist

| Principle | Implementation |
|-----------|----------------|
| **Impulses are universal data** | Analysis tools emit impulses; Activity tools consume them |
| **Activities constrain search** | Thompson Sampling ranks activities; search space shrinks |
| **Resolvers live where data lives** | CPG in analysis-api, LLM proxy in activity-api, files in vessel |
| **Metadata first, content later** | Shape metadata drives resolution; content loaded lazily |
| **Record everything** | Every tool call creates trace with state transitions |
| **Learn from traces** | Thompson Sampling, impulse relevance, pattern extraction |
| **Reserve improvisation** | Tiered LLM when no pattern; record for learning |
| **LLMs are tools, not controllers** | Tier 3-5 resolver; system learns patterns, not prompts |

### 1.4 The Virtuous Cycle

```
We proxy LLM → Rich traces captured
                      ↓
              Patterns extracted (ribosome)
                      ↓
              Deterministic resolvers replace LLM
                      ↓
              Cost drops → More margin → More learning
```

---

## 2. Interface Boundaries & Data Flow

### 2.1 External Interfaces

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
│  │   (7 existing)      │                     │   (4 new)           │       │
│  └─────────┬───────────┘                     └─────────┬───────────┘       │
└────────────┼───────────────────────────────────────────┼────────────────────┘
             │                                           │
             ▼                                           ▼
┌─────────────────────────┐               ┌─────────────────────────┐
│  metabob-analysis-api   │               │  metabob-activity-api   │
│  (code analysis)        │               │  (trace + LLM proxy)    │
└─────────────────────────┘               └────────────┬────────────┘
                                                       │
                                                       ▼
                                          ┌─────────────────────────┐
                                          │    RESOLVER ROUTER      │
                                          │  Tier 1: Pattern ($0)   │
                                          │  Tier 2: Interpolate    │
                                          │  Tier 3: Haiku ($)      │
                                          │  Tier 4: Sonnet ($$)    │
                                          │  Tier 5: Opus ($$$)     │
                                          └────────────┬────────────┘
                                                       │
                                    ┌──────────────────┼──────────────────┐
                                    ▼                  ▼                  ▼
                              ┌──────────┐      ┌──────────┐      ┌──────────┐
                              │ SurrealDB│      │  Redis   │      │ Anthropic│
                              │ (traces) │      │ (cache)  │      │   API    │
                              └──────────┘      └──────────┘      └──────────┘
```

### 2.2 Connection Management Endpoints

| Endpoint | Method | Purpose | Auth |
|----------|--------|---------|------|
| `/v2/connections/acquire` | POST | Get connection slot | API Key |
| `/v2/connections/heartbeat` | POST | Maintain connection | JWT |
| `/v2/connections/reconnect` | POST | Resume within grace | Session Token |
| `/v2/connections/release` | POST | Free slot explicitly | JWT |
| `/v2/resolve` | POST | Tiered LLM resolution | JWT |

### 2.3 Request/Response Contracts

**Acquire Slot**:
```typescript
// Request
{ api_key: string, instance_name?: string }

// Response 200
{ connection_id, session_token, jwt, jwt_expires_at, org_id,
  max_connections, active_connections, llm_budget }

// Response 429
{ error: "connection_limit_reached", max_connections, active_connections }
```

**Heartbeat**:
```typescript
// Request (Bearer JWT)
{ current_execution?: { execution_id, activity_id, started_at, estimated_duration_ms } }

// Response 200
{ status: "active", next_heartbeat_due, grace_period_ms }
```

**Resolve**:
```typescript
// Request
{ impulse: { id, pointer, metadata }, execution_context?, prefer_tier? }

// Response 200 (pattern match)
{ resolver_used: "pattern", pattern_id, confidence, result, cost_usd: 0 }

// Response 200 (LLM)
{ resolver_used: "sonnet", confidence, result, cost_usd, tokens_used, thinking? }

// Response 402
{ error: "llm_budget_exceeded", tokens_used, tokens_limit, pattern_matches_available: true }
```

### 2.4 Data Flow Requirements

| Flow | Source | Destination | Data |
|------|--------|-------------|------|
| Slot Acquisition | metabob-mcp | activity-api | API key, instance name |
| Heartbeat | metabob-mcp | activity-api | Connection ID, execution state |
| Resolution Request | metabob-mcp | activity-api | Impulse metadata, context |
| Pattern Lookup | activity-api | Redis/SurrealDB | Impulse hash |
| LLM Call | activity-api | Anthropic API | Prompt, model, params |
| Trace Recording | activity-api | SurrealDB | Full resolution log |
| Budget Update | activity-api | Redis → SurrealDB | Tokens consumed |

---

## 3. Existing Schema Analysis & Field Sourcing

### 3.1 Tables to Leverage (No Changes Needed)

| Table | Purpose | Key Fields |
|-------|---------|------------|
| `organizations` | Tenant root | `id`, `name`, `stripe_customer_id` |
| `users` | Human accounts | `org_id`, `email`, `role` |
| `api_keys` | Credential storage | `org_id`, `user_id`, `key_hash`, `scopes` |
| `minibob_instance` | Vessel auth | `org_id`, `project_id`, `api_key_hash`, `is_active` |
| `projects` | Code workspace | `org_id`, `name`, `repo_url` |

### 3.2 Fields to Reuse (Standard Patterns)

| Field Pattern | Type | Source Table | Notes |
|---------------|------|--------------|-------|
| `org_id` | `record<organizations>` | All tables | Required, auto-populated from $auth |
| `project_id` | `option<record<projects>>` | Many tables | Optional subdivision |
| `created_by` | `record<users> \| record<minibob_instance>` | Many tables | Polymorphic creator |
| `created_at` | `datetime` | All tables | `VALUE time::now()` |
| `updated_at` | `datetime` | All tables | `VALUE time::now()` on every write |
| `is_active` | `bool` | Auth tables | Default true, for soft disable |
| `expires_at` | `option<datetime>` | Auth tables | Optional expiration |
| `key_hash` | `string` | Auth tables | `crypto::argon2` hashed |

### 3.3 New Tables Required

**`connection` (active session)**:
```surql
DEFINE TABLE connection SCHEMAFULL;

-- Identity
DEFINE FIELD id ON connection TYPE string;
DEFINE FIELD session_token ON connection TYPE string;

-- Relationships (REUSE patterns)
DEFINE FIELD org_id ON connection TYPE record<organizations>
  VALUE $value OR $auth.org_id;
DEFINE FIELD api_key_id ON connection TYPE record<api_keys>;
DEFINE FIELD created_by ON connection
  TYPE option<record<users> | record<minibob_instance>>
  VALUE $value OR $auth.id;

-- Connection state (NEW)
DEFINE FIELD status ON connection TYPE string
  ASSERT $value IN ["active", "grace", "disconnected"];
DEFINE FIELD instance_name ON connection TYPE option<string>;
DEFINE FIELD connected_at ON connection TYPE datetime VALUE time::now();
DEFINE FIELD last_heartbeat ON connection TYPE datetime VALUE time::now();
DEFINE FIELD grace_until ON connection TYPE option<datetime>;

-- Execution tracking (NEW)
DEFINE FIELD current_execution ON connection
  TYPE option<record<activity_execution_traces>>;

-- JWT (NEW)
DEFINE FIELD jwt_token ON connection TYPE string;
DEFINE FIELD jwt_expires_at ON connection TYPE datetime;

-- Indexes
DEFINE INDEX idx_connection_org ON connection FIELDS org_id;
DEFINE INDEX idx_connection_session ON connection FIELDS session_token UNIQUE;
DEFINE INDEX idx_connection_status ON connection FIELDS org_id, status;
```

**`llm_resolution_log` (trace every resolution)**:
```surql
DEFINE TABLE llm_resolution_log SCHEMAFULL;

-- Relationships (REUSE patterns)
DEFINE FIELD org_id ON llm_resolution_log TYPE record<organizations>;
DEFINE FIELD connection_id ON llm_resolution_log TYPE record<connection>;
DEFINE FIELD execution_id ON llm_resolution_log
  TYPE option<record<activity_execution_traces>>;

-- Resolver selection (NEW)
DEFINE FIELD resolver_tier ON llm_resolution_log TYPE string
  ASSERT $value IN ["pattern", "interpolate", "haiku", "sonnet", "opus"];
DEFINE FIELD resolver_confidence ON llm_resolution_log TYPE float;
DEFINE FIELD resolver_reasoning ON llm_resolution_log TYPE string;

-- Pattern match data (NEW)
DEFINE FIELD pattern_id ON llm_resolution_log TYPE option<string>;
DEFINE FIELD impulse_hash ON llm_resolution_log TYPE option<string>;

-- LLM call data (NEW - rich trace capture)
DEFINE FIELD llm_request ON llm_resolution_log TYPE option<object>;
DEFINE FIELD llm_response ON llm_resolution_log TYPE option<object>;
DEFINE FIELD tokens_input ON llm_resolution_log TYPE option<int>;
DEFINE FIELD tokens_output ON llm_resolution_log TYPE option<int>;
DEFINE FIELD latency_ms ON llm_resolution_log TYPE option<int>;

-- Outcome (REUSE pattern from execution traces)
DEFINE FIELD success ON llm_resolution_log TYPE bool;
DEFINE FIELD cost_usd ON llm_resolution_log TYPE float DEFAULT 0;
DEFINE FIELD created_at ON llm_resolution_log TYPE datetime VALUE time::now();

-- Learning flags (NEW)
DEFINE FIELD pattern_extracted ON llm_resolution_log TYPE bool DEFAULT false;
DEFINE FIELD extracted_pattern_id ON llm_resolution_log TYPE option<string>;

-- Indexes
DEFINE INDEX idx_llm_log_org ON llm_resolution_log FIELDS org_id;
DEFINE INDEX idx_llm_log_tier ON llm_resolution_log FIELDS resolver_tier;
DEFINE INDEX idx_llm_log_hash ON llm_resolution_log FIELDS impulse_hash;
```

**`pattern` (extracted deterministic resolvers)**:
```surql
DEFINE TABLE pattern SCHEMAFULL;

DEFINE FIELD pattern_id ON pattern TYPE string;
DEFINE FIELD impulse_hash ON pattern TYPE string;
DEFINE FIELD org_id ON pattern TYPE record<organizations>;
DEFINE FIELD template ON pattern TYPE object;  -- Extracted resolution template
DEFINE FIELD success_rate ON pattern TYPE float;
DEFINE FIELD executions ON pattern TYPE int;
DEFINE FIELD created_at ON pattern TYPE datetime VALUE time::now();

DEFINE INDEX idx_pattern_hash ON pattern FIELDS impulse_hash;
DEFINE INDEX idx_pattern_org ON pattern FIELDS org_id;
```

### 3.4 Extend `api_keys` Table

```surql
-- Add connection slot limits to existing api_keys table
DEFINE FIELD max_connections ON api_keys TYPE int DEFAULT 1
  ASSERT $value >= 1 AND $value <= 100;

DEFINE FIELD llm_budget ON api_keys TYPE object DEFAULT {
  tokens_per_month: 10000000,
  tokens_used: 0,
  reset_at: time::now() + 30d,
  overage_enabled: false
};

DEFINE FIELD tier ON api_keys TYPE string DEFAULT "starter"
  ASSERT $value IN ["starter", "pro", "enterprise"];
```

---

## 4. Reusable Components

### 4.1 Authentication (Copy Directly)

| Component | File | What to Reuse |
|-----------|------|---------------|
| MiniBob signin | `activity-api/routes/auth.ts:50-128` | RECORD auth pattern |
| JWT middleware | `activity-api/middleware/jwtAuth.ts` | Token validation, $auth extraction |
| Authenticated client | `activity-api/db/surreal.ts:queryWithAuth` | Per-request RBAC enforcement |

### 4.2 Session/Connection Management (Adapt)

| Component | File | Adaptation |
|-----------|------|------------|
| SessionManager | `metabob-mcp/session-manager.ts` | Change session → connection tracking |
| Redis session | `activity-api/routes/session.ts` | Use same key patterns for connection state |
| Heartbeat | `activity-api/routes/vessels.ts:178-236` | Adapt vessel heartbeat for connections |

### 4.3 Rate Limiting & Circuit Breaker (Copy)

| Component | File | Notes |
|-----------|------|-------|
| RateLimiter | `metabob-mcp/rate-limiter.ts` | Per-connection rate limits |
| CircuitBreaker | `metabob-mcp/circuit-breaker.ts` | Per-provider failure tracking |
| Hono middleware | `activity-api/middleware/rateLimiter.ts` | HTTP endpoint protection |

### 4.4 HTTP Client (Copy Pattern)

| Component | File | What to Reuse |
|-----------|------|---------------|
| Auto-refresh | `metabob-mcp/api-client.ts:scheduleTokenRefresh` | Token refresh at 80% lifetime |
| Retry logic | `metabob-mcp/api-client.ts:request` | Exponential backoff |
| Error mapping | `metabob-mcp/api-client.ts` | HTTP status → error codes |

### 4.5 Redis Operations (Use Directly)

| Operation | Method | Use Case |
|-----------|--------|----------|
| Fast slot count | `redis.sadd/smembers` | Track active connection IDs |
| Budget tracking | `redis.get/set` | Fast token budget check |
| Connection state | `redis.hset/hget` | Grace period, heartbeat time |
| Distributed lock | `redis.acquireLock` | Safe slot acquisition |

---

## 5. Common Patterns to Colocate

### 5.1 Shared Utilities Package: `@metabob/connection-utils`

**Structure**:
```
packages/connection-utils/
├── src/
│   ├── auth/
│   │   ├── context.ts      # AuthContext interface
│   │   ├── jwt.ts          # JWT validation helpers
│   │   └── middleware.ts   # Hono middleware factory
│   ├── errors/
│   │   ├── types.ts        # StandardError interface
│   │   ├── codes.ts        # Error code constants
│   │   └── transformer.ts  # HTTP → app error mapping
│   ├── rate-limit/
│   │   ├── limiter.ts      # Base RateLimiter class
│   │   ├── memory.ts       # In-memory implementation
│   │   └── redis.ts        # Redis implementation
│   ├── circuit-breaker/
│   │   └── breaker.ts      # CircuitBreaker class
│   ├── database/
│   │   ├── client.ts       # PooledDatabaseClient base
│   │   ├── surreal.ts      # SurrealDB implementation
│   │   └── redis.ts        # Redis client singleton
│   ├── config/
│   │   └── loader.ts       # Type-safe config loading
│   ├── logging/
│   │   └── logger.ts       # Structured logger
│   └── health/
│       ├── checker.ts      # HealthChecker class
│       └── server.ts       # HTTP health endpoint
├── package.json
└── tsconfig.json
```

### 5.2 Error Handling Pattern

```typescript
// Consistent across all services
interface StandardError {
  code: string;           // 'CONNECTION_LIMIT_REACHED'
  message: string;        // Human-readable
  details?: unknown;      // Additional context
  suggestion?: string;    // How to resolve
  retryable: boolean;     // Can retry?
  httpStatus: number;     // 429, 402, etc.
}

// Error codes for connection slots
const ErrorCodes = {
  CONNECTION_LIMIT_REACHED: { code: 'CONNECTION_LIMIT_REACHED', httpStatus: 429, retryable: true },
  SESSION_EXPIRED: { code: 'SESSION_EXPIRED', httpStatus: 410, retryable: false },
  BUDGET_EXCEEDED: { code: 'BUDGET_EXCEEDED', httpStatus: 402, retryable: false },
  PATTERN_NOT_FOUND: { code: 'PATTERN_NOT_FOUND', httpStatus: 200, retryable: true },
} as const;
```

### 5.3 Configuration Pattern

```typescript
// Base config for all proxy-related services
interface BaseProxyConfig {
  // Database
  surrealdb: { url: string; namespace: string; database: string; username: string; password: string };
  redis: { url: string };

  // LLM Proxy
  anthropic: { apiKey: string; defaultModel: string };

  // Connection slots
  slots: {
    heartbeatIntervalMs: number;  // 30000
    graceMinMs: number;           // 120000 (2 min)
    graceMaxMs: number;           // 1800000 (30 min)
  };

  // Rate limiting
  rateLimits: {
    requestsPerMinute: number;
    tokensPerMonth: number;
  };
}

function loadConfig(): BaseProxyConfig {
  // Validate all required env vars, fail fast
}
```

### 5.4 Logging Pattern

```typescript
// Structured logging with context
const logger = new Logger({
  level: process.env.LOG_LEVEL || 'info',
  format: process.env.LOG_FORMAT || 'json',
});

// Usage
logger.info('Connection acquired', {
  connection_id: conn.id,
  org_id: conn.org_id,
  slots_used: activeCount,
  slots_max: maxConnections,
});

logger.warn('Grace period started', {
  connection_id: conn.id,
  grace_until: conn.grace_until,
  has_execution: !!conn.current_execution,
});
```

---

## 6. RBAC & Multi-Tenant Constraints

### 6.1 Scoping Hierarchy

```
GLOBAL (scope='global', public=true)
  └── Visible to all authenticated users

ORG (scope='org')
  └── Visible only within organization
  └── org_id = $auth.org_id enforced

PROJECT (scope='project')
  └── Visible only to project members
  └── project_id IN $auth.project_ids enforced
```

### 6.2 AUTH Methods & JWT Claims

| Method | Duration | Claims | Use Case |
|--------|----------|--------|----------|
| `jwt_external` | 15m token, 12h session | org_id, role | Dashboard users |
| `apikey_record` | 15m token, 1h session | org_id, user_id, scopes, project_ids | IDE integrations |
| `minibob_record` | 24h token, 7d session | org_id, project_id, instance_id | Autonomous vessels |

### 6.3 PERMISSIONS Pattern for Connection Tables

```surql
DEFINE TABLE connection SCHEMAFULL
  PERMISSIONS
    -- Users see their org's connections
    FOR select WHERE org_id = $auth.org_id

    -- Creation requires authenticated org context
    FOR create WHERE $auth.org_id != NONE

    -- Only connection owner or admin can update
    FOR update WHERE org_id = $auth.org_id
      AND (created_by = $auth.id OR $auth.role = 'admin')

    -- Only admin can delete
    FOR delete WHERE org_id = $auth.org_id AND $auth.role = 'admin';
```

### 6.4 Connection Slots Respect RBAC

**Key principle**: Slots manage resource allocation at the connection level. PERMISSIONS enforce data isolation at the query level. They are orthogonal.

| Aspect | Connection Slot Layer | RBAC Layer |
|--------|----------------------|------------|
| **What it does** | Counts active connections | Filters query results |
| **Scope** | Per API key | Per $auth.org_id |
| **Enforcement** | Redis counters + DB records | SurrealDB PERMISSIONS |
| **Bypass possible?** | No (checked before query) | No (database-level) |

### 6.5 Token Budget Per API Key (Not Per Org)

```
┌─────────────────────────────────────────────────────────────────┐
│                      Organization: Acme                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─────────────────────┐    ┌─────────────────────┐            │
│  │  API Key: dev-team  │    │  API Key: prod-bot  │            │
│  │  max_conn: 5        │    │  max_conn: 10       │            │
│  │  budget: 10M tokens │    │  budget: 50M tokens │            │
│  └─────────────────────┘    └─────────────────────┘            │
│         │                          │                            │
│         ▼                          ▼                            │
│  ┌─────────────────────┐    ┌─────────────────────┐            │
│  │ Connection 1        │    │ Connection 1        │            │
│  │ Connection 2        │    │ Connection 2        │            │
│  │ Connection 3        │    │ ...                 │            │
│  └─────────────────────┘    │ Connection 10       │            │
│                              └─────────────────────┘            │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 7. Reorganized Task List with Commit Milestones

### Milestone 1: Schema Foundation
**Commit**: `feat(schema): add connection slot and LLM resolution tables`
**State**: Database ready for connection tracking

| Task | Files | Description |
|------|-------|-------------|
| 1.1 | `metabob-proto/surrealdb/core/006-connection-slots.surql` | Create `connection` table with PERMISSIONS |
| 1.2 | `metabob-proto/surrealdb/activity/017-llm-resolution.surql` | Create `llm_resolution_log` table |
| 1.3 | `metabob-proto/surrealdb/activity/018-patterns.surql` | Create `pattern` table |
| 1.4 | `metabob-proto/surrealdb/core/005-api-keys-enhancement.surql` | Add `max_connections`, `llm_budget`, `tier` to api_keys |

**Testable**: Run migration, verify tables exist with `INFO FOR DB`

---

### Milestone 2: Shared Utilities Package
**Commit**: `feat(utils): create @metabob/connection-utils package`
**State**: Reusable utilities available for all services

| Task | Files | Description |
|------|-------|-------------|
| 2.1 | `packages/connection-utils/src/errors/` | StandardError interface, error codes, transformer |
| 2.2 | `packages/connection-utils/src/auth/` | AuthContext, JWT validation, middleware factory |
| 2.3 | `packages/connection-utils/src/rate-limit/` | RateLimiter class (memory + Redis) |
| 2.4 | `packages/connection-utils/src/circuit-breaker/` | CircuitBreaker with OPEN/HALF_OPEN/CLOSED |
| 2.5 | `packages/connection-utils/src/logging/` | Structured logger with context |
| 2.6 | `packages/connection-utils/src/config/` | Type-safe config loader |

**Testable**: `bun test` passes for all utilities

---

### Milestone 3: Connection Slot Backend
**Commit**: `feat(activity-api): implement connection slot management`
**State**: Connection acquisition, heartbeat, and release working

| Task | Files | Description |
|------|-------|-------------|
| 3.1 | `activity-api/src/routes/connections.ts` | `POST /v2/connections/acquire` |
| 3.2 | `activity-api/src/routes/connections.ts` | `POST /v2/connections/heartbeat` |
| 3.3 | `activity-api/src/routes/connections.ts` | `POST /v2/connections/reconnect` |
| 3.4 | `activity-api/src/routes/connections.ts` | `POST /v2/connections/release` |
| 3.5 | `activity-api/src/db/redis.ts` | `acquireSlot()`, `releaseSlot()`, `getSlotCount()` |
| 3.6 | `activity-api/src/workers/heartbeat.ts` | Background worker for grace period management |

**Testable**:
```bash
# Acquire 3 connections
for i in 1 2 3; do
  curl -X POST http://activity.metabob.local/v2/connections/acquire \
    -d '{"api_key":"test-key","instance_name":"test-'$i'"}'
done

# Verify slot count
curl http://activity.metabob.local/v2/connections/status
```

---

### Milestone 4: LLM Proxy - Pattern Resolution
**Commit**: `feat(activity-api): implement tiered resolver with pattern matching`
**State**: Tier 1-2 (pattern/interpolate) working, no LLM calls yet

| Task | Files | Description |
|------|-------|-------------|
| 4.1 | `activity-api/src/resolvers/router.ts` | `selectResolver()` with tier logic |
| 4.2 | `activity-api/src/resolvers/pattern-store.ts` | `findExact()`, `findSimilar()` |
| 4.3 | `activity-api/src/resolvers/hash.ts` | `hashImpulseShape()` for pattern matching |
| 4.4 | `activity-api/src/routes/resolve.ts` | `POST /v2/resolve` endpoint (pattern only) |
| 4.5 | `activity-api/src/db/redis.ts` | Pattern cache operations |

**Testable**:
```bash
# Create a pattern manually
# Then resolve should match it
curl -X POST http://activity.metabob.local/v2/resolve \
  -H "Authorization: Bearer $JWT" \
  -d '{"impulse":{"metadata":{"shape":"test"}}}'
# Expected: resolver_used: "pattern" or "no_match"
```

---

### Milestone 5: LLM Proxy - Anthropic Integration
**Commit**: `feat(activity-api): add Anthropic LLM proxy for tiers 3-5`
**State**: Full tiered resolution working with actual LLM calls

| Task | Files | Description |
|------|-------|-------------|
| 5.1 | `activity-api/src/resolvers/llm-proxy.ts` | Anthropic client wrapper |
| 5.2 | `activity-api/src/resolvers/llm-proxy.ts` | `callHaiku()`, `callSonnet()`, `callOpus()` |
| 5.3 | `activity-api/src/resolvers/budget.ts` | `checkAndDeductBudget()` with Redis |
| 5.4 | `activity-api/src/routes/resolve.ts` | Integrate LLM tiers into resolve endpoint |
| 5.5 | `activity-api/src/resolvers/trace.ts` | Record full resolution in `llm_resolution_log` |

**Testable**:
```bash
# Force LLM resolution (no pattern exists)
curl -X POST http://activity.metabob.local/v2/resolve \
  -H "Authorization: Bearer $JWT" \
  -d '{"impulse":{"metadata":{"shape":"novel-task"}},"prefer_tier":"haiku"}'
# Expected: resolver_used: "haiku", cost_usd > 0, trace recorded
```

---

### Milestone 6: metabob-mcp Integration
**Commit**: `feat(mcp): integrate connection slots and activity tools`
**State**: metabob-mcp uses connection slots and routes LLM through proxy

| Task | Files | Description |
|------|-------|-------------|
| 6.1 | `metabob-mcp/src/connection-manager.ts` | ConnectionManager class |
| 6.2 | `metabob-mcp/src/connection-manager.ts` | Heartbeat loop, reconnection logic |
| 6.3 | `metabob-mcp/src/api-client.ts` | Add X-Connection-ID header |
| 6.4 | `metabob-mcp/src/tools/activity.ts` | `run_goal`, `get_recommendations`, `submit_trace` |
| 6.5 | `metabob-mcp/src/index.ts` | Register activity tools |
| 6.6 | `metabob-mcp/src/config.ts` | Make ANTHROPIC_API_KEY optional |

**Testable**:
```bash
# Start MCP with only METABOB_API_KEY
METABOB_API_KEY=xxx METABOB_ENDPOINT=http://activity.metabob.local \
  bun run metabob-mcp/src/index.ts

# Use activity tools in Claude Desktop
# run_goal should route through /v2/resolve
```

---

### Milestone 7: Pattern Extraction (Learning Loop)
**Commit**: `feat(activity-api): implement pattern extraction from traces`
**State**: System learns patterns from successful LLM resolutions

| Task | Files | Description |
|------|-------|-------------|
| 7.1 | `activity-api/src/resolvers/pattern-extractor.ts` | `maybeExtractPattern()` |
| 7.2 | `activity-api/src/resolvers/pattern-extractor.ts` | Result consistency calculation |
| 7.3 | `activity-api/src/workers/pattern-extraction.ts` | Background job for extraction |
| 7.4 | `activity-api/src/routes/resolve.ts` | Trigger extraction after successful resolution |

**Testable**:
```bash
# Run same impulse shape 5+ times successfully
# Pattern should be extracted
# Next resolution should use Tier 1 (pattern match)
```

---

### Milestone 8: Deployment & Testing
**Commit**: `feat(helm): deploy connection slots and LLM proxy`
**State**: Full system running in Kubernetes

| Task | Files | Description |
|------|-------|-------------|
| 8.1 | `helm/charts/metabob-activity-api/values.yaml` | Add ANTHROPIC_API_KEY secret |
| 8.2 | `helm/charts/metabob-activity-api/values.yaml` | Configure heartbeat worker |
| 8.3 | `helm/charts/metabob-mcp/values.yaml` | Remove ANTHROPIC_API_KEY requirement |
| 8.4 | `activity-api/test/connections.test.ts` | Unit tests for connection slots |
| 8.5 | `activity-api/test/resolver.test.ts` | Unit tests for resolver router |
| 8.6 | `activity-api/test/integration/` | Integration tests for full flow |

**Testable**:
```bash
helmfile -f activity-system-minimal.yaml.gotmpl sync
kubectl get pods -n activity-system
curl http://activity.metabob.local/health
```

---

### Milestone 9: Documentation & Monitoring
**Commit**: `docs: add connection slots and LLM proxy documentation`
**State**: System documented and observable

| Task | Files | Description |
|------|-------|-------------|
| 9.1 | `docs/api/connections.md` | API documentation |
| 9.2 | `docs/api/resolve.md` | Resolver endpoint docs |
| 9.3 | `docs/architecture/CONNECTION_SLOTS.md` | Architecture overview |
| 9.4 | `docs/architecture/LLM_PROXY.md` | Tiered resolver design |
| 9.5 | `activity-dashboard/src/queries/` | Dashboard queries |

---

## Summary

### Commit Sequence

1. **Schema** → Tables ready
2. **Utilities** → Shared code ready
3. **Connection slots** → Acquisition working
4. **Pattern resolution** → Tier 1-2 working
5. **LLM proxy** → Tier 3-5 working
6. **MCP integration** → Full client working
7. **Pattern extraction** → Learning loop closed
8. **Deployment** → Running in K8s
9. **Documentation** → Complete

### Key Metrics After Implementation

| Metric | Target | Measurement |
|--------|--------|-------------|
| Pattern match rate | >50% after 30 days | `SELECT count() FROM llm_resolution_log WHERE resolver_tier = 'pattern'` |
| Avg resolution cost | <$0.005 after 90 days | `SELECT math::avg(cost_usd) FROM llm_resolution_log` |
| Trace completeness | >95% | `SELECT count() FROM llm_resolution_log WHERE llm_response IS NOT NONE` |
| Pattern extraction rate | >10/week | `SELECT count() FROM pattern WHERE created_at > time::now() - 7d` |
| Grace period completion | >90% | `SELECT count() FROM connection WHERE status = 'disconnected' AND current_execution IS NOT NONE` |
