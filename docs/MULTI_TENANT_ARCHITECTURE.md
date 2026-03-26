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
│  └── Visible to all authenticated users                       │
│      Example: Metabob official activity templates              │
│                                                                │
│  ORG (scope='org')                                            │
│  └── Visible only within organization                         │
│      Example: Company-specific templates                       │
│                                                                │
│  PROJECT (scope='project')                                    │
│  └── Visible only to project members                          │
│      Example: Project-specific execution traces                │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

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
