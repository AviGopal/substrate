# user-vessel Development Guide

## Overview

**user-vessel** is a specialized vessel that manages the user domain: organizations, users, projects, API keys, and RBAC enforcement. It participates in the learning loop through discovery integration and provides deterministic resolvers for user-related impulse types.

**Key Characteristics**:
- **Deterministic execution**: User management operations are CRUD-based, no LLM needed
- **Discovery-integrated**: Registers shapes and provides resolvers for user domain
- **Hybrid architecture**: REST for synchronous ops + Activities for composition patterns
- **Multi-tenant RBAC**: Database-level enforcement via SurrealDB PERMISSIONS

## Vessel Identity

```typescript
{
  vesselId: "user-vessel-{hostname}",
  vesselName: "User Management Vessel",
  version: "0.1.0",
  shapes: [
    "user_profile",
    "org_settings",
    "api_key_info",
    "project_list",
    "api_key_usage",
    "user_cost_report"
  ],
  capabilities: ["user-management", "rbac", "jwt-auth", "api-key-auth"],
  protocol: "http"
}
```

## Discovery Integration

### Shape Registration

user-vessel registers with discovery-vessel to resolve user-domain impulse types:

```typescript
// On startup (index.ts)
const discoveryClient = new VesselClient({
  discoveryEndpoint: process.env.DISCOVERY_VESSEL_ENDPOINT,
  vesselId: process.env.VESSEL_ID || `user-vessel-${process.env.HOSTNAME}`,
  vesselName: "user-vessel",
  endpoint: process.env.VESSEL_ENDPOINT,
  shapes: process.env.VESSEL_SHAPES?.split(',') || [
    "user_profile",
    "org_settings",
    "api_key_info",
    "project_list",
    "api_key_usage",
    "user_cost_report"
  ],
  heartbeatIntervalMs: 120000,  // 2 minutes
});

await discoveryClient.register();
discoveryClient.startHeartbeat();
```

### Resolver Endpoints

Discovery routes impulse resolution requests to user-vessel based on shape:

```typescript
// POST /resolve-impulse
app.post("/resolve-impulse", async (c) => {
  const { impulse, auth } = await c.req.json();

  // Validate shape is supported
  const supportedShapes = [
    "user_profile",
    "org_settings",
    "api_key_info",
    "project_list",
    "api_key_usage",
    "user_cost_report"
  ];

  if (!supportedShapes.includes(impulse.shape)) {
    return c.json({ error: "Unsupported shape" }, 400);
  }

  // Route to shape-specific resolver
  const resolver = resolvers[impulse.shape];
  const result = await resolver.resolve(impulse, auth);

  return c.json({
    impulse: {
      ...impulse,
      loaded: true,
      content: result,
      metadata: {
        ...impulse.metadata,
        resolvedAt: new Date().toISOString(),
        resolvedBy: "user-vessel"
      }
    }
  });
});
```

## Impulse Types and Resolvers

### 1. user_profile

**Shape**: Single user record with RBAC context

**Metadata**:
```typescript
{
  shape: "user_profile",
  rowCount: 1,
  columns: ["id", "org_id", "email", "name", "role", "created_at", "last_login"],
  summary: "User profile for alice@example.com",
  availableOps: ["update_profile", "change_password", "delete_user"],
  producedBy: "user-vessel"
}
```

**Pointer**:
```typescript
{
  type: "user_profile",
  user_id: "users:alice",
  include_projects: false  // Optional: include project memberships
}
```

**Resolver** (src/resolvers/user-profile.ts):
```typescript
async function resolveUserProfile(
  pointer: UserProfilePointer,
  auth: AuthContext
): Promise<User> {
  // RBAC: Can only access users in same org
  const db = await getAuthenticatedDb(auth);

  const [user] = await db.query(
    `SELECT * FROM users WHERE id = $user_id AND org_id = $auth.org_id`,
    { user_id: pointer.user_id }
  );

  if (!user) {
    throw new Error("User not found or access denied");
  }

  // Never return password_hash
  delete user.password_hash;

  if (pointer.include_projects) {
    user.projects = await getProjectMemberships(user.id, auth);
  }

  return user;
}
```

**Deterministic**: No LLM needed - direct database query with RBAC

### 2. org_settings

**Shape**: Organization configuration and metadata

**Metadata**:
```typescript
{
  shape: "org_settings",
  rowCount: 1,
  columns: ["id", "org_id", "name", "subscription_tier", "seat_limit", "seat_usage"],
  summary: "Organization settings for Acme Corp",
  availableOps: ["update_org", "upgrade_subscription", "add_seats"],
  producedBy: "user-vessel"
}
```

**Pointer**:
```typescript
{
  type: "org_settings",
  org_id: "organizations:acme"
}
```

**Resolver**: Direct database query with org_id filter

### 3. api_key_info

**Shape**: API key metadata (NOT the secret key itself)

**Metadata**:
```typescript
{
  shape: "api_key_info",
  rowCount: 1,
  columns: ["id", "user_id", "prefix", "scopes", "tier", "max_connections", "llm_budget"],
  summary: "API key mb_live_abc... for user alice",
  availableOps: ["revoke_key", "update_scopes", "rotate_key"],
  producedBy: "user-vessel"
}
```

**Pointer**:
```typescript
{
  type: "api_key_info",
  key_id: "api_keys:123",
  include_usage: true  // Optional: include usage statistics
}
```

**Resolver**: Query api_keys table with RBAC enforcement

### 4. project_list

**Shape**: Collection of projects for user/org

**Metadata**:
```typescript
{
  shape: "project_list",
  rowCount: 5,
  columns: ["id", "name", "repo_url", "member_count"],
  summary: "5 projects for organization Acme Corp",
  sample: [
    { id: "projects:backend", name: "Backend API" },
    { id: "projects:frontend", name: "React Dashboard" }
  ],
  availableOps: ["create_project", "delete_project", "add_member"],
  producedBy: "user-vessel"
}
```

**Pointer**:
```typescript
{
  type: "project_list",
  org_id: "organizations:acme",
  user_id?: "users:alice"  // Optional: filter by user membership
}
```

**Resolver**: Query projects table with optional user membership join

### 5. api_key_usage

**Shape**: Usage statistics for API key

**Metadata**:
```typescript
{
  shape: "api_key_usage",
  rowCount: 1,
  columns: ["key_id", "total_requests", "last_used_at", "active_connections", "token_usage"],
  summary: "Usage stats for API key mb_live_abc...",
  producedBy: "user-vessel"
}
```

**Pointer**:
```typescript
{
  type: "api_key_usage",
  key_id: "api_keys:123",
  time_range?: { start: string, end: string }  // Optional: filter by time
}
```

**Resolver**: Aggregate from connection tracking and cost tracking tables

### 6. user_cost_report

**Shape**: LLM usage and costs for user/org

**Metadata**:
```typescript
{
  shape: "user_cost_report",
  rowCount: 1,
  columns: ["org_id", "total_tokens", "total_cost_usd", "budget_remaining", "budget_reset_at"],
  summary: "Cost report for Acme Corp (March 2026)",
  producedBy: "user-vessel"
}
```

**Pointer**:
```typescript
{
  type: "user_cost_report",
  org_id: "organizations:acme",
  time_range: { start: "2026-03-01", end: "2026-03-31" },
  group_by?: "user" | "project"  // Optional: breakdown by dimension
}
```

**Resolver**: Aggregate from cost_tracking table with budget calculations

## Deterministic Activities

user-vessel provides activities for composition patterns, but execution is deterministic (no improvisation needed):

### 1. user-vessel:onboard-user

**Purpose**: Create user + assign projects + send welcome email + generate API key

**Input Schema**:
```typescript
{
  required: [
    { shape: "new_user_request", metadata: { email, name, org_id, role } }
  ],
  optional: [
    { shape: "project_list", metadata: { initial_projects } }
  ]
}
```

**Output Schema**:
```typescript
{
  produces: [
    { shape: "user_profile" },
    { shape: "api_key_info" },
    { shape: "email_sent_confirmation" }
  ]
}
```

**Tasks**:
```typescript
[
  {
    id: "create-user",
    resolver: "user-vessel:create_user",
    deterministic: true,  // No LLM needed
    inputShapes: ["new_user_request"],
    outputShapes: ["user_profile"]
  },
  {
    id: "assign-projects",
    resolver: "user-vessel:assign_projects",
    deterministic: true,
    inputShapes: ["user_profile", "project_list"],
    outputShapes: ["project_memberships"]
  },
  {
    id: "generate-api-key",
    resolver: "user-vessel:generate_api_key",
    deterministic: true,
    inputShapes: ["user_profile"],
    outputShapes: ["api_key_info"]
  },
  {
    id: "send-welcome-email",
    resolver: "email-vessel:send_template",  // Delegates to email-vessel
    deterministic: true,
    inputShapes: ["user_profile", "api_key_info"],
    outputShapes: ["email_sent_confirmation"]
  }
]
```

**Composition**: Tasks execute sequentially, output impulses become input for next task. No LLM needed - just state transitions with RBAC enforcement.

### 2. user-vessel:provision-organization

**Purpose**: Create org + admin user + default project + setup billing

**Deterministic**: All steps are database transactions with RBAC checks

### 3. user-vessel:generate-audit-report

**Purpose**: Aggregate user actions + compute metrics + format report

**Deterministic**: Pure aggregation queries, no reasoning needed

## Hybrid Architecture: REST + Activities

### When to Use REST

**Use REST endpoints** for:
- **Immediate responses** (<100ms): Dashboard auth flows
- **Simple CRUD**: Single-table operations
- **Stateless operations**: No multi-step workflows
- **Known state-space**: Direct database queries

**Examples**:
- `POST /v2/auth/login` - Validate credentials, return JWT
- `GET /v2/users/:id` - Fetch single user
- `DELETE /v2/api-keys/:id` - Revoke API key

### When to Use Activities

**Use activities** for:
- **Composition patterns**: Multi-vessel workflows
- **Learning opportunities**: Successful sequences become templates
- **Trace-based optimization**: Thompson Sampling improves over time
- **Multi-step workflows**: Onboarding, provisioning, auditing

**Examples**:
- `user-vessel:onboard-user` - Creates user, assigns projects, sends email
- `user-vessel:provision-organization` - Creates org, admin, billing setup
- `user-vessel:generate-audit-report` - Aggregates metrics, formats report

### Composition Learning

Even though user-vessel activities are deterministic, recording traces enables composition learning:

```
Example: user-vessel:onboard-user calls email-vessel:send_template

Composition record:
{
  parent: "user-vessel:onboard-user",
  child: "email-vessel:send_template",
  success: true,
  context: "Send welcome email to new user"
}

Backend learns:
- When onboarding succeeds, send_template usually succeeds
- email-vessel is reliable for this pattern
- Can recommend this composition for similar workflows
```

## Standard Configuration

### Environment Variables

user-vessel follows STANDARD_CONFIGURATION.md patterns:

```bash
# Core (no vessel prefix)
PORT=8080
HOST=0.0.0.0
NODE_ENV=production
LOG_LEVEL=info

# Vessel Identity
VESSEL_ID=user-vessel-${HOSTNAME}
VESSEL_NAME="User Management Vessel"
VESSEL_VERSION=0.1.0

# Discovery
DISCOVERY_ENABLED=true
DISCOVERY_VESSEL_ENDPOINT=http://discovery-vessel.activity-system.svc.cluster.local:8080
VESSEL_ENDPOINT=http://user-vessel.activity-system.svc.cluster.local:8080
VESSEL_SHAPES=user_profile,org_settings,api_key_info,project_list,api_key_usage,user_cost_report

# Database
SURREALDB_URL=http://surrealdb.activity-system.svc.cluster.local:8000/rpc
SURREALDB_NAMESPACE=activity-system
SURREALDB_DATABASE=learning_loop
SURREALDB_USERNAME=root
SURREALDB_PASSWORD=<from-secret>

# Auth
JWT_SECRET=<from-secret>
JWT_EXPIRES_IN=15m

# Observability
METRICS_ENABLED=true
TRACING_ENABLED=true
```

### Configuration Priority

1. Environment variables (highest)
2. Project config (`.metabob/config.json`)
3. User config (`~/.metabob/config.json`)
4. Defaults (hardcoded in src/config.ts)

## Connection Tracking vs. Discovery Health

**Two separate concerns**:

### Connection Tracking (user-vessel specific)

**Purpose**: Enforce API key connection slot limits

**Mechanism**:
- Client claims connection slot: `POST /v2/connections/claim`
- Client sends heartbeats: `POST /v2/connections/heartbeat` (every 30s)
- Client releases slot: `POST /v2/connections/release`

**Enforcement**: Max connections per API key (e.g., 3 for pro tier)

**Use case**: Prevent single API key from spawning unlimited MiniBob instances

### Discovery Health (vessel-level)

**Purpose**: Vessel availability for shape resolution

**Mechanism**:
- Vessel registers with discovery: `POST /register`
- Vessel sends heartbeats: `POST /heartbeat` (every 2 min)
- Discovery marks vessel unhealthy if no heartbeat for 5 min

**Enforcement**: Discovery stops routing to unhealthy vessels

**Use case**: Ensure impulse resolution requests go to healthy vessels

**Relationship**: Independent systems with different granularity (API key vs. vessel)

## Development Workflow

### Local Testing

```bash
# Install dependencies
bun install

# Start local SurrealDB (if needed)
docker run -d -p 8000:8000 surrealdb/surrealdb:latest start \
  --user root --pass surrealdb-local-dev-123

# Set environment variables
export SURREALDB_URL=http://localhost:8000/rpc
export SURREALDB_USERNAME=root
export SURREALDB_PASSWORD=surrealdb-local-dev-123
export JWT_SECRET=local-dev-secret
export DISCOVERY_ENABLED=false  # Disable for local testing

# Run in dev mode (with watch)
bun run dev

# Run tests
bun test

# Type check
bun run typecheck
```

### Canary Deployment

**Prefer canary deployment over local Kubernetes:**

```bash
# 1. Write code locally, run tests
bun test && bun run typecheck

# 2. Push to dev branch (triggers canary deployment)
git add . && git commit -m "feat(user-vessel): add new feature"
git push origin dev

# 3. Monitor deployment
gh run list --repo MetabobProject/deployment --limit 5
gh run view <run-id> --log

# 4. Validate against canary
curl https://identity.metabob.com/health
curl https://identity.metabob.com/manifest

# 5. Test discovery integration
curl https://activity.metabob.com/v2/impulses/discover-vessel \
  -H "Authorization: ApiKey <your-key>" \
  -d '{"shape": "user_profile"}'
```

### Testing Resolvers

```bash
# Test user_profile resolver
curl http://localhost:8080/resolve-impulse \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <jwt-token>" \
  -d '{
    "impulse": {
      "shape": "user_profile",
      "pointer": {
        "type": "user_profile",
        "user_id": "users:alice"
      }
    }
  }'
```

## RBAC and Multi-Tenant Isolation

### Database-Level Enforcement

**All RBAC via SurrealDB PERMISSIONS**:

```surql
DEFINE TABLE users SCHEMAFULL
  PERMISSIONS
    FOR select WHERE org_id = $auth.org_id
    FOR create WHERE $auth.role = 'admin' AND org_id = $auth.org_id
    FOR update WHERE org_id = $auth.org_id AND ($auth.role = 'admin' OR id = $auth.id)
    FOR delete WHERE $auth.role = 'admin' AND org_id = $auth.org_id;
```

**No application-level filtering needed** - database enforces isolation.

### Authenticated Connections

```typescript
// Use JWT or API key to authenticate
const db = await getAuthenticatedDb(authContext);

// All queries automatically filtered by org_id
const users = await db.query(`SELECT * FROM users`);
// Returns only users WHERE org_id = $auth.org_id
```

## Alignment with Foundation Principles

### 1. Impulses Are Universal Data

✓ User data treated as impulse types with metadata
✓ Metadata describes shape, resolver loads content
✓ Discovery routes based on shape, not vessel name

### 2. Activities Constrain Search

✓ Onboarding, provisioning are activities (not ad-hoc scripts)
✓ Deterministic execution (no search needed)
✓ Known state-space (CRUD operations)

### 3. Resolvers Live Where Data Lives

✓ user-vessel resolves user domain shapes
✓ Database access is local to vessel
✓ No centralized resolution - distributed by shape

### 4. Metadata First, Content Later

✓ Impulse metadata includes columns, summary, availableOps
✓ Reasoners see metadata to decide next step
✓ Resolvers load content only when needed

### 5. Record Everything

✓ All activity executions traced
✓ Composition patterns recorded
✓ API usage tracked for learning

### 6. Learn From Traces

✓ Thompson Sampling for activity selection
✓ Composition graph learns successful patterns
✓ No LLM for user data, but traces feed learning

### 7. Reserve Improvisation

✓ User operations are deterministic (no improvisation)
✓ But traces record what worked for similar workflows
✓ Enables recommendation for new use cases

### 8. LLMs Are Tools, Not Controllers

✓ User management is deterministic (no LLM)
✓ LLM only used in activities that reason about workflow composition
✓ Resolvers are direct database queries

## Related Documentation

- [STANDARD_CONFIGURATION.md](/home/avi/documents/work/exp-repo/metabob-devbob/docs/STANDARD_CONFIGURATION.md) - Standard vessel configuration
- [IMPULSE_ACTIVITY_FOUNDATION.md](/home/avi/documents/work/exp-repo/metabob-devbob/docs/architecture/IMPULSE_ACTIVITY_FOUNDATION.md) - Foundational model
- [README.md](README.md) - Comprehensive vessel overview
- [TESTING.md](TESTING.md) - Testing procedures
- [@metabob/vessel-discovery-client](../../packages/vessel-discovery-client/README.md) - Discovery client library
