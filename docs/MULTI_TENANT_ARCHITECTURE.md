# Multi-Tenant Architecture

This document describes the multi-tenant architecture for the Metabob ecosystem, covering data isolation, authentication methods, and RBAC enforcement.

## Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           MULTI-TENANT ARCHITECTURE                         │
└─────────────────────────────────────────────────────────────────────────────┘

                    ┌──────────────────────────────────────┐
                    │           SurrealDB 3.x              │
                    │  ┌────────────────────────────────┐  │
                    │  │     NAMESPACE: production      │  │
                    │  │  ┌──────────────────────────┐  │  │
                    │  │  │   DATABASE: metabob      │  │  │
                    │  │  │                          │  │  │
                    │  │  │  All orgs share tables   │  │  │
                    │  │  │  PERMISSIONS enforce     │  │  │
                    │  │  │  row-level isolation     │  │  │
                    │  │  │                          │  │  │
                    │  │  └──────────────────────────┘  │  │
                    │  └────────────────────────────────┘  │
                    └──────────────────────────────────────┘
                                      │
                    ┌─────────────────┼─────────────────┐
                    │                 │                 │
                    ▼                 ▼                 ▼
            ┌───────────┐     ┌───────────┐     ┌───────────┐
            │  Org: A   │     │  Org: B   │     │  Org: C   │
            │ (Acme)    │     │ (BigCorp) │     │ (StartUp) │
            └───────────┘     └───────────┘     └───────────┘
```

## Tenancy Model

### Design Decision: Shared Database with Row-Level Isolation

We use a **single namespace and database** with **row-level PERMISSIONS** rather than database-per-tenant:

| Approach | Pros | Cons |
|----------|------|------|
| **Database per tenant** | Complete isolation, easy to backup/restore per org | Connection overhead, harder cross-org queries, complex migrations |
| **Shared with PERMISSIONS** ✓ | Efficient connections, simple migrations, SurrealDB native | Requires careful PERMISSIONS design |

### Hierarchy

```
Organization (org_id)
├── Users (belong to exactly one org)
│   └── API Keys (scoped to org via user)
├── Projects (optional subdivision)
│   └── Project Members (relation table)
├── MiniBob Instances (autonomous vessels)
└── Subscriptions (billing)
```

**Key Constraints:**
- Users belong to exactly one organization
- API keys inherit org scope from their owning user
- Projects are optional - some data is org-wide
- MiniBob instances are assigned to org (optionally to project)

## Authentication Methods

### 1. JWT External (Dashboard Users)

For human users accessing via web dashboard or API clients.

```surql
DEFINE ACCESS jwt_external ON DATABASE TYPE JWT
  ALGORITHM HS256
  KEY 'secret-key'
  DURATION FOR TOKEN 15m, FOR SESSION 12h;
```

**JWT Claims:**
```json
{
  "sub": "users:alice",
  "org_id": "organizations:acme",
  "role": "admin",
  "iat": 1711361400,
  "exp": 1711362300
}
```

### 2. API Key (IDE Integrations)

For Claude Desktop, Cursor, and other IDE integrations.

```surql
DEFINE ACCESS apikey_record ON DATABASE TYPE RECORD
  SIGNIN (
    SELECT id, org_id, user_id, scopes, role
    FROM api_keys
    WHERE is_active = true
      AND crypto::argon2::compare(key_hash, $api_key)
  )
  DURATION FOR TOKEN 15m, FOR SESSION 1h;
```

**Flow:**
1. User creates API key in dashboard
2. IDE config includes `METABOB_API_KEY=mk_...`
3. MCP server exchanges key for JWT on startup
4. Auto-refresh every 12 minutes

### 3. MiniBob Record (Autonomous Instances)

For MiniBob autonomous vessels running boredom activities.

```surql
DEFINE ACCESS minibob_record ON DATABASE TYPE RECORD
  SIGNIN (
    SELECT * FROM minibob_instance
    WHERE instance_id = $instance_id
      AND is_active = true
      AND crypto::argon2::compare(api_key_hash, $api_key)
  )
  DURATION FOR TOKEN 24h, FOR SESSION 7d;
```

**Flow:**
1. Admin creates MiniBob instance in org
2. Instance starts with `MINIBOB_INSTANCE_ID` and `MINIBOB_API_KEY`
3. Instance authenticates and gets JWT
4. Longer token lifetime (24h) for autonomous operation

## RBAC Enforcement

### PERMISSIONS Clauses

Every multi-tenant table has PERMISSIONS clauses that use `$auth.org_id`:

```surql
DEFINE TABLE activity_template SCHEMAFULL
  PERMISSIONS
    FOR select WHERE org_id = $auth.org_id OR public = true
    FOR create WHERE org_id = $auth.org_id
    FOR update, delete WHERE org_id = $auth.org_id AND $auth.role = 'admin';
```

### Common Patterns

**1. Org-scoped read (user can only see their org's data):**
```surql
FOR select WHERE org_id = $auth.org_id
```

**2. Public + org visibility (marketplace pattern):**
```surql
FOR select WHERE org_id = $auth.org_id OR public = true
```

**3. Role-based write (admins only):**
```surql
FOR update, delete WHERE org_id = $auth.org_id AND $auth.role = 'admin'
```

**4. Owner-only edit (user can edit their own):**
```surql
FOR update WHERE user_id = $auth.id OR $auth.role = 'admin'
```

### Scope Hierarchy

```
┌────────────────────────────────────────────────────────────────┐
│                         SCOPE HIERARCHY                        │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│  GLOBAL (scope='global', public=true)                         │
│  └── Visible to ALL users (including unauthenticated)         │
│      Endpoint: GET /v2/activities/public                       │
│      Example: Metabob official activity templates              │
│                                                                │
│  GLOBAL (scope='global', public=false)                        │
│  └── Visible to all authenticated users                       │
│      Example: Internal shared templates                        │
│                                                                │
│  ORG (scope='org')                                            │
│  └── Visible only within organization                         │
│      PERMISSIONS: WHERE org_id = $auth.org_id                 │
│      Example: Company-specific templates                       │
│                                                                │
│  PROJECT (scope='project')                                    │
│  └── Visible only to project members                          │
│      PERMISSIONS: WHERE project_id IN $auth.project_ids       │
│      Example: Project-specific execution traces                │
│                                                                │
│  SESSION (transient)                                          │
│  └── Exists only for the duration of a session                │
│      Not persisted; used for real-time analysis               │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

### Project-Scoped Filtering

Project-scoped data uses `$auth.project_ids` (array) from JWT claims:

```surql
-- SQL Schema PERMISSIONS example
DEFINE TABLE activity_execution_traces SCHEMAFULL
  PERMISSIONS
    FOR select WHERE
      org_id = $auth.org_id
      AND (project_id IS NULL OR project_id IN $auth.project_ids)
    FOR create WHERE
      org_id = $auth.org_id
      AND (project_id IS NULL OR project_id IN $auth.project_ids)
    FOR update, delete WHERE
      org_id = $auth.org_id
      AND $auth.role = 'admin';
```

**JWT Claims with project_ids:**
```json
{
  "sub": "users:alice",
  "org_id": "organizations:acme",
  "project_ids": ["projects:proj-abc", "projects:proj-xyz"],
  "role": "developer",
  "iat": 1711361400,
  "exp": 1711362300
}
```

**Middleware extraction (jwtAuth.ts):**
```typescript
projectIds: Array.isArray(auth.project_ids)
  ? auth.project_ids.map((p: unknown) => String(p).replace(/^projects:/, ''))
  : undefined
```

## Session Management

### Session Types

The system uses different session types depending on the client:

| Session Type | Client | Storage | Duration | Use Case |
|--------------|--------|---------|----------|----------|
| **JWT Session** | Dashboard | SurrealDB | 12h | Human users via web UI |
| **API Key Session** | metabob-mcp | SurrealDB | 1h | IDE integrations with auto-refresh |
| **MiniBob Session** | MiniBob vessels | SurrealDB | 7d | Autonomous execution with long-lived tokens |
| **Redis Session** | Legacy clients | Redis | 24h | Session data caching (deprecated path) |

### Session Lifecycle

```
┌─────────────────┐       ┌──────────────────┐       ┌─────────────────┐
│   Authenticate  │──────▶│  Create Session  │──────▶│  Execute Query  │
│  (signin route) │       │  (token issued)  │       │  (RBAC active)  │
└─────────────────┘       └──────────────────┘       └─────────────────┘
                                   │                          │
                                   ▼                          ▼
                          ┌──────────────────┐       ┌─────────────────┐
                          │  Token Refresh   │◀──────│   Auto-Refresh  │
                          │  (before expiry) │       │  (clients poll) │
                          └──────────────────┘       └─────────────────┘
```

### API Key Auto-Refresh

metabob-mcp implements automatic token refresh:

```typescript
// Token refresh happens 3 minutes before expiry
const REFRESH_THRESHOLD_MS = 3 * 60 * 1000;

async function ensureValidToken(): Promise<string> {
  const now = Date.now();
  if (tokenExpiry && now < tokenExpiry - REFRESH_THRESHOLD_MS) {
    return currentToken;
  }
  return await refreshToken();
}
```

## Learning Data Isolation

Learning data requires special consideration because it builds patterns over time that could leak information across tenants.

### Learning Tables and Their Isolation

| Table | Isolation Level | Notes |
|-------|-----------------|-------|
| `cochange_patterns` | org + project | Patterns derived from commits within org/project |
| `tool_usage` | org + project | Tool call patterns from executions |
| `activity_performance_metrics` | org | Performance data per org |
| `execution_sequences` | org + project | Execution ordering patterns |
| `impulse_relevance` | org | Context effectiveness tracking |

### Cross-Org Learning Constraints

**CRITICAL: Learning data MUST NOT cross org boundaries.**

1. **Cochange patterns** - Only derived from changes within the same org
2. **Tool usage patterns** - Only aggregated within org scope
3. **Similarity searches** - Only compare within org's execution history
4. **Thompson Sampling** - Separate alpha/beta parameters per org

### Implementation Pattern

```surql
-- Cochange patterns are strictly org + project scoped
DEFINE TABLE cochange_patterns SCHEMAFULL
  PERMISSIONS
    FOR select WHERE
      org_id = $auth.org_id
      AND (project_id IS NULL OR project_id IN $auth.project_ids)
    FOR create WHERE org_id = $auth.org_id
    FOR update, delete WHERE org_id = $auth.org_id AND $auth.role = 'admin';
```

### Public Data Exception

Only data explicitly marked `public = true` and `scope = 'global'` can be shared:
- Public activity templates (GET /v2/activities/public)
- Official Metabob patterns (curated by platform)

**Learning data is NEVER public** - even "public" templates track performance metrics separately per org.

## Data Model

### Core Tables (metabob-proto)

| Table | Scope | Description |
|-------|-------|-------------|
| `organizations` | N/A | Top-level tenant container |
| `users` | org | Users within an organization |
| `api_keys` | org+user | API credentials for users |
| `projects` | org | Optional project subdivisions |
| `project_members` | project | User-project membership |
| `minibob_instance` | org+project | Autonomous vessel instances |
| `subscriptions` | org | Billing and feature flags |
| `audit_logs` | org | Security audit trail |

### Activity API Tables

| Table | Scope | Description |
|-------|-------|-------------|
| `activity_template` | org/global | Activity definitions |
| `activity_execution_traces` | org+project | Execution history |
| `composition_graph` | org | Activity composition patterns |
| `impulse_data` | org | Context injection data |
| `tool_usage` | org | Tool call patterns |

### Analysis API Tables

| Table | Scope | Description |
|-------|-------|-------------|
| `analysis_problems` | org+project | Detected code issues |
| `code_components` | org+project | Code structure graph |
| `cochange_patterns` | org+project | Co-change relationships |
| `annotations` | org+user | Human annotations |

## Services Architecture

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                              SERVICE ARCHITECTURE                            │
└──────────────────────────────────────────────────────────────────────────────┘

┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│ Cloud Dashboard │     │   metabob-mcp   │     │    MiniBob      │
│  (React SPA)    │     │  (MCP Server)   │     │   (Vessel)      │
└────────┬────────┘     └────────┬────────┘     └────────┬────────┘
         │                       │                       │
         │ JWT (15m)             │ API Key→JWT           │ Record Auth→JWT
         │                       │ (auto-refresh)        │ (24h token)
         │                       │                       │
         ▼                       ▼                       ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│                          metabob-activity-api                                │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │                         Auth Middleware                               │  │
│  │  JWT → db.authenticate(token) → $auth populated for PERMISSIONS     │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                    │                                        │
│                                    ▼                                        │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │                         SurrealDB Client                              │  │
│  │  queryWithAuth(jwt, sql) → PERMISSIONS enforce org isolation         │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│                              SurrealDB 3.x                                   │
│                                                                              │
│  PERMISSIONS WHERE org_id = $auth.org_id   ← Row-level isolation            │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

## Migration Strategy

### For New Deployments

1. Deploy SurrealDB with core schemas (metabob-proto)
2. Create default organization
3. Deploy services with RBAC enabled

### For Existing Deployments

1. **Backup**: Export existing data
2. **Schema Migration**: Add org_id fields, PERMISSIONS clauses
3. **Data Backfill**: Set org_id = metabob_internal for existing records
4. **Validation**: Verify RBAC enforcement
5. **Cutover**: Enable authentication

See `MIGRATION_FROM_ANONYMOUS_TO_RBAC.md` for detailed steps.

## Security Considerations

### Rate Limiting

Auth endpoints are rate limited to prevent brute force:
- General auth routes: 10 requests/minute
- Signin endpoints: 5 requests/minute

### Audit Logging

All authentication events are logged to `audit_logs`:
- `login`, `logout`
- `api_key_created`, `api_key_revoked`
- `access_denied`

### Token Security

- JWT tokens are short-lived (15 minutes)
- API keys are hashed with argon2
- Tokens include auth_method for audit trail
- HTTPS required in production

## Related Documentation

- `RBAC_GUIDE.md` - Detailed PERMISSIONS clause patterns
- `AUTH_JWT_CLAIMS.md` - JWT claim structure
- `SCHEMA_OWNERSHIP.md` - Which service owns which tables
- `MIGRATION_FROM_ANONYMOUS_TO_RBAC.md` - Migration guide
