# Vessel Communication Architecture

> **Status**: Reference document
> **Purpose**: Documents inter-vessel communication patterns, data ownership, and authentication flows.
> **See also**: [IMPULSE_ACTIVITY_FOUNDATION.md](./IMPULSE_ACTIVITY_FOUNDATION.md) for foundational concepts.

---

## Overview

The system consists of four primary vessels, each with a distinct responsibility:

| Vessel | Responsibility | Database Access |
|--------|---------------|-----------------|
| **minibob** | Activity execution, local impulse resolution | Read only (via MCP) |
| **metabob-activity-api** | Learning backend, trace storage, Thompson Sampling | Read/Write (owns learning tables) |
| **identity-vessel** | Stateless authentication validation (JWT + API key) | Read only (users, api_keys) |
| **user-vessel** | User/org management, API key lifecycle, connections | Read/Write (owns auth tables) |

```
                           +-----------------+
                           |    Dashboard    |
                           |   (React App)   |
                           +--------+--------+
                                    |
            +-----------------------+------------------------+
            |                       |                        |
            v                       v                        v
    +---------------+      +----------------+       +------------------+
    |  user-vessel  |      | identity-vessel|       | metabob-activity |
    | (HTTP REST)   |----->| (HTTP REST)    |       |      -api        |
    +-------+-------+      +-------+--------+       +--------+---------+
            |                      |                         |
            |                      |                         |
            +--------+-------------+---------+---------------+
                     |                       |
                     v                       v
              +-------------+         +-------------+
              |  SurrealDB  |         |    Redis    |
              +-------------+         +-------------+
                     ^
                     |
            +--------+--------+
            |     minibob     |
            |  (MCP Client)   |
            +-----------------+
```

---

## Communication Patterns

### 1. MiniBob -> Activity API (MCP)

MiniBob communicates with the activity API via HTTP/REST. The MCP client handles:
- Activity recommendations (Thompson Sampling)
- Execution trace storage
- Backend impulse resolution

```
+----------+                              +-------------------+
| MiniBob  |                              | metabob-activity  |
|          |                              |       -api        |
+----+-----+                              +---------+---------+
     |                                              |
     |  POST /v2/activities/recommend               |
     |  {goal, context, impulse_shapes}             |
     +--------------------------------------------->|
     |                                              |
     |  {template_id, confidence, thompson_alpha,   |
     |   thompson_beta, sampled_value}              |
     |<---------------------------------------------+
     |                                              |
     |  GET /v2/activities/templates/:id            |
     +--------------------------------------------->|
     |                                              |
     |  {template definition with tasks}            |
     |<---------------------------------------------+
     |                                              |
     |  [Execute activity locally with LLM]         |
     |                                              |
     |  POST /v2/activities/execution-traces        |
     |  {execution_id, template_id, status,         |
     |   tasks_executed, duration_ms, cost_usd}     |
     +--------------------------------------------->|
     |                                              |
     |  {stored, trace_id}                          |
     |<---------------------------------------------+
     |                                              |
```

**Impulse Resolution Split:**

MiniBob resolves LOCAL pointer types directly:
- `memo` - Embedded content
- `file` - Read from filesystem
- `ui_component` - UI primitives

MiniBob delegates BACKEND pointer types via MCP:
- `activityExecutionTrace` - Full execution trace with state
- `activityTemplate` - Template structure and metadata
- `activityMetrics` - Performance data
- `recentExecutions` - Filtered execution history
- `failurePatterns` / `successPatterns` - Learned patterns
- Any new type (backend is extensible)

```
+----------+                              +-------------------+
| MiniBob  |                              | metabob-activity  |
|          |                              |       -api        |
+----+-----+                              +---------+---------+
     |                                              |
     |  POST /v2/impulses/resolve                   |
     |  {pointer: {type: "activityExecutionTrace",  |
     |             executionId: "exec_123"}}        |
     +--------------------------------------------->|
     |                                              |
     |  {content: "...", metadata: {...}}           |
     |<---------------------------------------------+
     |                                              |
```

### 2. Any Vessel -> Identity Vessel (HTTP)

Identity-vessel provides stateless authentication validation. Other vessels call it to validate tokens and API keys.

```
+----------------+                       +------------------+
| Calling Vessel |                       | identity-vessel  |
| (user-vessel,  |                       |                  |
|  activity-api) |                       |                  |
+-------+--------+                       +---------+--------+
        |                                          |
        |  POST /v1/auth/resolve                   |
        |  {impulse: {                             |
        |    type: "authentication",               |
        |    pointer: {                            |
        |      type: "apiKey",                     |
        |      apiKey: "mb_live_..."               |
        |    }                                     |
        |  }}                                      |
        +----------------------------------------->|
        |                                          |
        |  HMAC Validation                         |
        |  (no DB lookup for signature)            |
        |                                          |
        |  Redis: Check revocation                 |
        |                                          |
        |  {success: true, data: {                 |
        |    authenticated: true,                  |
        |    orgId: "org_123",                     |
        |    userId: "user_456",                   |
        |    keyId: "key_789",                     |
        |    scopes: ["read", "write"]             |
        |  }}                                      |
        |<-----------------------------------------+
        |                                          |
```

**MiniBob Instance Authentication:**

Autonomous MiniBob instances authenticate via instance credentials:

```
+----------+                              +------------------+
| MiniBob  |                              | identity-vessel  |
|          |                              |                  |
+----+-----+                              +---------+--------+
     |                                              |
     |  POST /v2/auth/minibob/signin                |
     |  {instance_id: "minibob-local-001",          |
     |   api_key: "test-api-key-123"}               |
     +--------------------------------------------->|
     |                                              |
     |  SurrealDB: Lookup minibob_instance          |
     |  Verify credentials                          |
     |  Generate JWT token                          |
     |                                              |
     |  {success: true,                             |
     |   token: "eyJ...",                           |
     |   org_id: "metabob_internal",                |
     |   project_id: "proj_123"}                    |
     |<---------------------------------------------+
     |                                              |
     |  [Use JWT for all subsequent requests]       |
     |                                              |
```

### 3. Dashboard -> User Vessel (HTTP)

User-vessel handles account management for dashboard users.

```
+-----------+                             +---------------+
| Dashboard |                             |  user-vessel  |
|  (React)  |                             |               |
+-----+-----+                             +-------+-------+
      |                                           |
      |  POST /v2/auth/login                      |
      |  {email: "user@example.com",              |
      |   password: "..."}                        |
      +------------------------------------------>|
      |                                           |
      |  SurrealDB: user_password ACCESS method   |
      |  Verify credentials, generate JWT         |
      |                                           |
      |  {token: "eyJ...", user: {...},           |
      |   org: {...}}                             |
      |<------------------------------------------+
      |                                           |
      |  GET /v2/auth/me                          |
      |  Authorization: Bearer eyJ...             |
      +------------------------------------------>|
      |                                           |
      |  {user: {...}, org: {...},                |
      |   project_ids: [...]}                     |
      |<------------------------------------------+
      |                                           |
      |  POST /v2/api-keys                        |
      |  {name: "IDE Key", scopes: [...]}         |
      +------------------------------------------>|
      |                                           |
      |  Delegate to identity-vessel              |
      |  for key generation                       |
      |                                           |
      |  {key: {...}, secret: "mb_live_..."}      |
      |<------------------------------------------+
      |                                           |
```

### 4. User Vessel -> Identity Vessel (HTTP)

User-vessel delegates cryptographic operations to identity-vessel.

```
+---------------+                         +------------------+
|  user-vessel  |                         | identity-vessel  |
|               |                         |                  |
+-------+-------+                         +---------+--------+
        |                                           |
        |  [User requests new API key]              |
        |                                           |
        |  POST /v1/keys/generate                   |
        |  {org_id: "org_123",                      |
        |   user_id: "user_456",                    |
        |   scopes: ["read", "write"]}              |
        +------------------------------------------>|
        |                                           |
        |  Generate HMAC key with embedded metadata |
        |  (org_id, user_id, scopes, expiry)        |
        |                                           |
        |  {key: "mb_live_...",                     |
        |   key_id: "key_789",                      |
        |   prefix: "mb_live_",                     |
        |   expires_at: "2026-05-02T..."}           |
        |<------------------------------------------+
        |                                           |
        |  [Store key_id + metadata in api_keys]    |
        |  [Return key to user (shown once)]        |
        |                                           |
```

---

## Data Ownership Matrix

Each vessel owns specific database tables. Cross-vessel access is read-only.

| Table | Owner | Readers | Purpose |
|-------|-------|---------|---------|
| **organizations** | user-vessel | identity-vessel, activity-api | Organization accounts |
| **users** | user-vessel | identity-vessel | User accounts |
| **api_keys** | user-vessel | identity-vessel | API key metadata (not secrets) |
| **active_connections** | user-vessel | - | Connection slot tracking |
| **projects** | user-vessel | activity-api | Project scoping |
| **project_members** | user-vessel | - | Project membership |
| **minibob_instance** | user-vessel | identity-vessel | MiniBob instance registry |
| **activity** | activity-api | minibob (via MCP) | Activity templates |
| **execution** | activity-api | minibob (via MCP) | Execution traces |
| **impulse** | activity-api | minibob (via MCP) | Impulse data and metadata |
| **v_activity_score** | activity-api | - | Thompson Sampling scores (view) |
| **activity_composition_graph** | activity-api | - | Activity composition patterns |
| **tool_usage** | activity-api | - | Tool usage analytics |
| **impulse_relevance_metrics** | activity-api | - | Impulse usefulness tracking |
| **execution_sequences** | activity-api | - | Execution sequence patterns |

**Note:** identity-vessel owns NO tables. It is a stateless validation service that reads from user-vessel's tables and uses Redis for revocation caching.

---

## Authentication Flows

### Dashboard User Login

```
User                Dashboard              user-vessel              SurrealDB
 |                      |                       |                       |
 |--[email/password]--->|                       |                       |
 |                      |--POST /v2/auth/login->|                       |
 |                      |                       |--SIGNIN user_password-|
 |                      |                       |<--[user record]-------+
 |                      |                       |                       |
 |                      |                       |--Generate JWT---------|
 |                      |                       |  (15 min expiry)      |
 |                      |<--{token, user, org}--|                       |
 |<--[Store JWT]--------|                       |                       |
 |                      |                       |                       |
 |--[Protected request]>|                       |                       |
 |                      |--[Bearer token]------>|                       |
 |                      |                       |--Verify JWT-----------|
 |                      |                       |<--[payload: org_id,---|
 |                      |                       |     user_id, role]    |
 |                      |<--[Response]----------|                       |
```

### API Key Validation

```
IDE/CLI               any-vessel           identity-vessel            Redis
  |                       |                       |                     |
  |--[X-Api-Key: mb_...]->|                       |                     |
  |                       |--POST /v1/auth/resolve|                     |
  |                       |                       |                     |
  |                       |                       |--HMAC Validate------|
  |                       |                       |  (extract org_id,   |
  |                       |                       |   user_id, scopes)  |
  |                       |                       |                     |
  |                       |                       |--GET revoked:key_id-|
  |                       |                       |<--[null or "1"]-----+
  |                       |                       |                     |
  |                       |<--{authenticated,-----|                     |
  |                       |    orgId, userId,     |                     |
  |                       |    scopes}            |                     |
  |                       |                       |                     |
  |<--[Response]----------|                       |                     |
```

### MiniBob Instance Authentication

```
MiniBob              identity-vessel              SurrealDB
   |                       |                          |
   |--POST /v2/auth/------>|                          |
   |  minibob/signin       |                          |
   |  {instance_id,        |                          |
   |   api_key}            |                          |
   |                       |--SELECT minibob_instance-|
   |                       |  WHERE id = instance_id  |
   |                       |<--[instance record]------+
   |                       |                          |
   |                       |--Verify api_key----------|
   |                       |  (bcrypt compare)        |
   |                       |                          |
   |                       |--Generate JWT------------|
   |                       |  (24h expiry, includes   |
   |                       |   org_id, project_id)    |
   |                       |                          |
   |<--{token, org_id,-----|                          |
   |    project_id}        |                          |
   |                       |                          |
   |--[Use JWT for all-----|                          |
   |   activity-api calls] |                          |
```

---

## Auth Delegation Pattern

### Overview

API key validation is delegated to identity-vessel, establishing it as the single source of truth for authentication. Other vessels (activity-api, user-vessel) do not validate API keys directly - they delegate to identity-vessel.

### Delegation Flow

```
Client (CLI/IDE)
    |
    | sends API key
    v
activity-api (/v2/auth/apikey)
    |
    | delegates validation
    v
identity-vessel (/v1/auth/resolve)
    |
    | validates HMAC signature
    | checks Redis for revocation
    v
Returns auth context (org_id, user_id, scopes)
    |
    v
activity-api generates JWT token
    |
    v
Returns JWT to client
```

### Implementation

```typescript
// activity-api delegates to identity-vessel
async function validateApiKeyViaIdentityVessel(apiKey: string) {
  const response = await fetch(`${identityVesselUrl}/v1/auth/resolve`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      impulse: {
        type: 'authentication',
        pointer: { type: 'apiKey', apiKey }
      }
    }),
    signal: AbortSignal.timeout(5000)
  })

  const result = await response.json()
  return result.data  // { authenticated, orgId, userId, keyId, scopes }
}
```

### Benefits

1. **Single Source of Truth**: identity-vessel is authoritative for API key validation. No dual validation logic across vessels.

2. **Stateless Validation**: HMAC-based keys embed their metadata (org_id, user_id, scopes). Validation requires no database lookup - only signature verification (<10us) plus optional Redis revocation check (~1ms).

3. **Horizontal Scalability**: Any identity-vessel replica can validate any key. No coordination required between instances.

4. **Unified Key Management**: Generate, revoke, and rotate keys in one place (user-vessel calls identity-vessel for generation; identity-vessel validates everywhere).

5. **Backward Compatibility**: activity-api can support both new HMAC keys (via identity-vessel) and legacy SurrealDB keys (fallback) during migration.

### Key Format

Identity-vessel uses HMAC-SHA256 signed keys with embedded metadata:

```
Format: Base64(mb_live-<org_id>-<user_id>-<key_id>-<signature>)

The key itself contains:
- Organization ID
- User ID
- Key ID (for revocation)
- HMAC signature (verifies integrity)
```

Validation extracts and verifies these fields without database lookup. Revocation is checked via Redis cache with TTL.

---

## Design Principles

### Why identity-vessel is Stateless

1. **No secrets storage**: API keys use HMAC signatures with embedded metadata. The key itself contains org_id, user_id, and scopes. identity-vessel validates the signature without database lookup.

2. **Horizontal scaling**: Any identity-vessel instance can validate any token. No shared state between replicas.

3. **Revocation via Redis**: Revoked key IDs are cached in Redis with TTL. Short-lived cache provides eventual consistency without database load.

4. **Separation of concerns**: Key generation happens in user-vessel (business logic). Key validation happens in identity-vessel (cryptographic verification).

### Why MiniBob Delegates to activity-api

1. **Locality principle**: MiniBob resolves what it has local access to (files, memos). activity-api resolves what it stores (traces, templates, metrics).

2. **Flexible evolution**: activity-api can introduce new impulse types without MiniBob code changes. The catch-all type `{ type: string; [key: string]: unknown }` enables this.

3. **Learning consolidation**: All execution traces flow to activity-api. Thompson Sampling and pattern learning happen in one place.

4. **Network efficiency**: Backend types require database queries. Centralizing resolution avoids N+1 problems when MiniBob would need to make multiple round trips.

### Impulse Resolution Locality Principle

> "Resolvers live WHERE THE DATA IS"

```
+------------------+         +------------------+
|     MiniBob      |         | activity-api     |
|                  |         |                  |
| Resolves:        |         | Resolves:        |
| - memo (memory)  |         | - traces (DB)    |
| - file (disk)    |         | - templates (DB) |
| - ui_component   |         | - metrics (DB)   |
|   (render local) |         | - patterns (DB)  |
|                  |         |                  |
| Data lives HERE  |         | Data lives HERE  |
+------------------+         +------------------+
```

This principle prevents the backend from becoming a "universal resolver" that proxies all data. Each vessel resolves impulses for data it owns or has direct access to.

---

## Collective Learning via Shared State

Vessels do NOT call each other directly. They interact via the **shared learning substrate**.

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  MiniBob 1  │     │  MiniBob 2  │     │  MiniBob 3  │
└──────┬──────┘     └──────┬──────┘     └──────┬──────┘
       │                   │                   │
       │ POST /traces      │ POST /traces      │ POST /traces
       │                   │                   │
       └───────────────────┴───────────────────┘
                           │
                           ▼
              ┌────────────────────────┐
              │ metabob-activity-api   │
              │ (learning substrate)   │
              ├────────────────────────┤
              │ • Thompson Sampling    │
              │ • Composition graph    │
              │ • Pattern recognition  │
              └────────────────────────┘
```

### How MiniBob 1 Learns from MiniBob 2

1. **MiniBob 2 executes** activity and succeeds
   - Records trace, increments Thompson α parameter

2. **MiniBob 1 requests recommendation** for similar goal
   - Backend samples from Beta(α, β) distributions
   - Higher α → more likely to be recommended

3. **MiniBob 1 uses recommendation** and also succeeds
   - Further increases α, reinforcing the pattern

4. **MiniBob 3 fails** with same recommendation
   - Increments β parameter (failure count)
   - Future sampling less likely to select this template

**This is collective learning** - all vessels contribute to shared knowledge without direct communication.

### Vessel-Specific vs Shared

| Vessel-Specific (not shared) | Shared (backend-mediated) |
|------------------------------|---------------------------|
| Session memory (in-flight impulses) | Activity performance (Thompson α/β) |
| Local file state | Composition graph |
| Current execution context | Impulse relevance scores |
| | Tool usage patterns |

---

## Network Topology

### Local Development

```
Host Machine (/etc/hosts)
    |
    +-- 127.0.0.1  activity.metabob.local
    +-- 127.0.0.1  app.metabob.local
    +-- 127.0.0.1  surql.metabob.local
    +-- 127.0.0.1  minibob.metabob.local
    |
    v
Istio Ingress Gateway (port 80)
    |
    +-- activity.metabob.local -> metabob-activity-api:8080
    +-- app.metabob.local -> user-vessel:3000
    +-- surql.metabob.local -> surrealdb:8000
    +-- minibob.metabob.local -> minibob:8080
```

### Kubernetes Internal

```
activity-system namespace
    |
    +-- metabob-activity-api.activity-system.svc.cluster.local:8080
    +-- identity-vessel.activity-system.svc.cluster.local:8080
    +-- user-vessel.activity-system.svc.cluster.local:3000
    +-- surrealdb.activity-system.svc.cluster.local:8000
    +-- redis-valkey.activity-system.svc.cluster.local:6379
    +-- minibob.activity-system.svc.cluster.local:8080 (3 replicas)
```

---

## Error Handling

### Authentication Failures

| Error | Source | Action |
|-------|--------|--------|
| `Invalid JWT` | identity-vessel | Return 401, client re-authenticates |
| `Expired JWT` | identity-vessel | Return 401, client refreshes token |
| `Revoked API key` | identity-vessel (via Redis) | Return 401, user generates new key |
| `Invalid HMAC` | identity-vessel | Return 401, key is malformed |
| `Unknown instance` | identity-vessel | Return 401, MiniBob not registered |

### Communication Failures

| Failure | Fallback |
|---------|----------|
| activity-api unavailable | MiniBob operates in offline mode (local templates only) |
| identity-vessel unavailable | Cached JWT tokens still valid; new auth fails |
| SurrealDB unavailable | All vessels fail; retry with exponential backoff |
| Redis unavailable | identity-vessel falls back to DB for revocation check |

---

## References

- [IMPULSE_ACTIVITY_FOUNDATION.md](./IMPULSE_ACTIVITY_FOUNDATION.md) - Foundational model
- `/repos/minibob/src/mcp.ts` - MCP client implementation
- `/repos/identity-vessel/src/index.ts` - Identity vessel endpoints
- `/repos/user-vessel/src/routes/*.ts` - User vessel routes
- `/repos/metabob-activity-api/src/routes/*.ts` - Activity API routes
