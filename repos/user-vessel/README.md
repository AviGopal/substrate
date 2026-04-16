# user-vessel

User management vessel that handles organizations, users, projects, and API keys with full RBAC enforcement. Integrates with cloud dashboard for authentication while participating in the learning loop through activity traces.

**For Development**: See [CLAUDE.md](CLAUDE.md) for detailed development guide, discovery integration, and resolver implementation patterns.

## Features

- **Email/Password Authentication**: JWT-based auth with 15-minute tokens
- **Multi-Tenant RBAC**: Database-level enforcement via SurrealDB PERMISSIONS
- **Organization Management**: Create and manage organizations with subscription tiers
- **User Management**: CRUD operations with role-based access (admin/member)
- **Project Management**: Organize code repositories and workspaces
- **API Key Management**: Generate and revoke API keys for programmatic access

## Architecture

### Hybrid Approach

**REST API** for synchronous operations (auth, CRUD) + **Activities** for complex workflows (onboarding, auditing).

**Rationale:**
- **Deterministic operations** (user CRUD) have known state-space - no search/learning needed
- Dashboard needs immediate auth responses (<100ms) - synchronous REST is optimal
- **Composition patterns** (multi-step workflows) benefit from Thompson Sampling and trace-based learning
- Discovery integration enables shape-based routing without LLM for simple lookups
- Progressive enhancement toward full activity-based model for complex workflows

### Discovery Integration

user-vessel registers with discovery-vessel to provide resolvers for user-domain impulse types:

**Registered Shapes:**
- `user_profile` - User account details with RBAC context
- `org_settings` - Organization configuration and metadata
- `api_key_info` - API key metadata (not secret key)
- `project_list` - Collection of projects for user/org
- `api_key_usage` - Usage statistics for API key
- `user_cost_report` - LLM usage and costs for user/org

**Discovery Lifecycle:**
1. **Register on startup**: `POST /register` to discovery-vessel
2. **Heartbeat every 2 minutes**: `POST /heartbeat` to maintain availability
3. **Resolve impulses**: Discovery routes shape-based requests to user-vessel
4. **Graceful shutdown**: Deregister from discovery on SIGTERM

**Configuration:**
```bash
export DISCOVERY_ENABLED=true
export DISCOVERY_VESSEL_ENDPOINT=http://discovery-vessel:8080
export VESSEL_ENDPOINT=http://user-vessel:8080
export VESSEL_SHAPES=user_profile,org_settings,api_key_info,project_list
```

See [CLAUDE.md](CLAUDE.md) for detailed discovery integration guide.

### Database Schema

Uses existing tables from `metabob-proto`:
- `organizations` - Multi-tenant root entities
- `users` - User accounts with email/password auth
- `projects` - Code repositories/workspaces
- `project_members` - User-project access control
- `api_keys` - Programmatic access tokens

Extensions in `sql/001-user-vessel-extensions.surql`:
- `password_hash` field on users table
- `user_password` ACCESS method for email/password authentication

Extensions in `sql/002-connection-tracking.surql`:
- `active_connections` table for tracking live connections
- Connection slot enforcement (max connections per API key)
- Heartbeat mechanism to detect stale connections

## API Endpoints

### Authentication

- `POST /v2/auth/signup` - Create new user and organization
- `POST /v2/auth/login` - Email/password authentication → JWT token
- `GET /v2/auth/me` - Get current authenticated user
- `POST /v2/auth/logout` - Logout (client-side token invalidation)

### Users

- `GET /v2/users` - List users in organization
- `GET /v2/users/:id` - Get user details
- `POST /v2/users` - Create user (admin only)
- `PATCH /v2/users/:id` - Update user
- `DELETE /v2/users/:id` - Delete user (admin only)

### Organizations

- `GET /v2/organizations/:id` - Get organization details
- `POST /v2/organizations` - Create organization
- `PATCH /v2/organizations/:id` - Update organization (admin only)

### Projects

- `GET /v2/projects` - List accessible projects
- `GET /v2/projects/:id` - Get project details
- `POST /v2/projects` - Create project (admin only)
- `PATCH /v2/projects/:id` - Update project (admin only)
- `DELETE /v2/projects/:id` - Delete project (admin only)

### API Keys

- `GET /v2/api-keys` - List API keys
- `POST /v2/api-keys` - Generate new API key
- `DELETE /v2/api-keys/:id` - Revoke API key

### Connections

- `POST /v2/connections/claim` - Claim a connection slot with API key
- `POST /v2/connections/release` - Release a connection slot
- `POST /v2/connections/heartbeat` - Update heartbeat to keep connection alive
- `GET /v2/connections` - List active connections

## Connection Tracking

Connection tracking enforces slot limits and monitors active connections for API keys. This is **separate from discovery health checks** - connection tracking is API-key level, discovery health is vessel-level.

### Connection Tracking (API Key Level)

**Purpose**: Enforce connection slot limits per API key

- **Slot Enforcement**: Limit simultaneous connections per API key (e.g., 3 for pro tier)
- **Heartbeat Monitoring**: Detect and auto-disconnect stale connections (5min timeout)
- **Instance Tracking**: Track which instances are connected (MiniBob, IDE, CLI, etc.)
- **Soft Deletion**: Connections marked as disconnected, not deleted

**Use Case**: Prevent single API key from spawning unlimited MiniBob instances

### Discovery Health (Vessel Level)

**Purpose**: Vessel availability for shape resolution

- **Vessel Registration**: Register with discovery-vessel on startup
- **Heartbeat Every 2 Minutes**: Maintain vessel availability status
- **Unhealthy Detection**: Discovery marks vessel unhealthy if no heartbeat for 5 min
- **Routing**: Discovery stops routing impulse requests to unhealthy vessels

**Use Case**: Ensure impulse resolution requests go to healthy vessels

### Relationship

Two **independent systems** with different granularity:
- **Connection tracking**: Per API key, enforces billing tier limits
- **Discovery health**: Per vessel, ensures system availability

### Connection Lifecycle

1. **Claim**: Client claims a connection slot using an API key
   ```bash
   POST /v2/connections/claim
   {
     "api_key": "mb_live_abc123...",
     "instance_id": "minibob-001",
     "instance_type": "minibob",
     "client_metadata": { "version": "1.0.0" }
   }
   ```

2. **Heartbeat**: Client sends periodic heartbeats (every 30s)
   ```bash
   POST /v2/connections/heartbeat
   {
     "instance_id": "minibob-001",
     "client_metadata": { "status": "active" }
   }
   ```

3. **Release**: Client releases the connection slot
   ```bash
   POST /v2/connections/release
   {
     "instance_id": "minibob-001"
   }
   ```

### Slot Limits

- API key level: `api_keys.max_connections` (default: 3)
- Enforced on claim - returns 429 if limit reached
- Admins can configure per-key limits

### Monitoring

List active connections:
```bash
GET /v2/connections
```

Response includes:
- Active connection count
- Instance IDs and types
- Last heartbeat timestamps
- Client metadata

### Cleanup Strategy

Stale connections (no heartbeat for >5min) can be auto-disconnected via background job:

```surql
UPDATE active_connections
SET disconnected_at = time::now()
WHERE disconnected_at IS NONE
  AND last_heartbeat_at < time::now() - 5m
```

Old disconnected connections can be archived/deleted periodically.

## Development

### Prerequisites

- Bun 1.0+
- SurrealDB 3.x
- Access to Kubernetes cluster (for deployment)

### Local Development

```bash
# Install dependencies
bun install

# Set environment variables
export SURREALDB_URL=http://localhost:8000
export SURREALDB_USERNAME=root
export SURREALDB_PASSWORD=root
export JWT_SECRET=your-secret-key

# Run in development mode (with watch)
bun run dev

# Run in production mode
bun run start
```

### Environment Variables

user-vessel follows [STANDARD_CONFIGURATION.md](/home/avi/documents/work/exp-repo/metabob-devbob/docs/STANDARD_CONFIGURATION.md) patterns:

**Core Configuration:**

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | 8080 |
| `HOST` | Bind address | 0.0.0.0 |
| `NODE_ENV` | Environment (development/production) | development |
| `LOG_LEVEL` | Logging level (debug/info/warn/error) | info |

**Vessel Identity:**

| Variable | Description | Default |
|----------|-------------|---------|
| `VESSEL_ID` | Unique vessel identifier | user-vessel-{hostname} |
| `VESSEL_NAME` | Human-readable vessel name | User Management Vessel |
| `VESSEL_VERSION` | Vessel version | 0.1.0 |

**Discovery Configuration:**

| Variable | Description | Default |
|----------|-------------|---------|
| `DISCOVERY_ENABLED` | Enable discovery integration | false |
| `DISCOVERY_VESSEL_ENDPOINT` | Discovery service URL | (required if enabled) |
| `VESSEL_ENDPOINT` | This vessel's endpoint | (required if enabled) |
| `VESSEL_SHAPES` | Comma-separated shapes | user_profile,org_settings,... |
| `DISCOVERY_HEARTBEAT_INTERVAL_MS` | Heartbeat interval | 120000 (2 min) |

**Database Configuration:**

| Variable | Description | Default |
|----------|-------------|---------|
| `SURREALDB_URL` | SurrealDB connection URL | http://surrealdb:8000/rpc |
| `SURREALDB_NAMESPACE` | Database namespace | activity-system |
| `SURREALDB_DATABASE` | Database name | learning_loop |
| `SURREALDB_USERNAME` | Database username | root |
| `SURREALDB_PASSWORD` | Database password | (required) |

**Authentication:**

| Variable | Description | Default |
|----------|-------------|---------|
| `JWT_SECRET` | JWT signing secret | (required) |
| `JWT_EXPIRES_IN` | Token expiry duration | 15m |

**Note**: Legacy variables `USER_VESSEL_PORT` and `USER_VESSEL_HOST` are supported for backward compatibility but deprecated in favor of standard `PORT` and `HOST`.

### Testing

```bash
# Run auth integration tests
bun run test-auth-flow.ts

# Run connection tracking tests
bun run test-connection-tracking.ts

# Run against deployed environment
USER_VESSEL_URL=http://identity.metabob.local bun run test-auth-flow.ts
USER_VESSEL_URL=http://identity.metabob.local bun run test-connection-tracking.ts
```

### Database Migrations

Apply schema extensions:

```bash
bun run apply-schema
```

Or use the SQL file directly:

```bash
surreal sql --endpoint http://localhost:8000 \
  --namespace activity-system \
  --database learning_loop \
  --username root \
  --password root \
  --file sql/001-user-vessel-extensions.surql
```

## Deployment

### Helm Chart

Deployment configuration in `helm/charts/user-vessel/`:

```yaml
replicaCount: 2  # HA for auth reliability

image:
  repository: user-vessel
  tag: "0.1.0"

service:
  type: ClusterIP
  port: 8080

env:
  SURREALDB_URL: "http://surrealdb.activity-system.svc.cluster.local:8000"
  JWT_SECRET: "from-secret"
```

### Deploy to Kubernetes

```bash
# Build container
docker build -t user-vessel:0.1.0 .

# Deploy with Helm
helm upgrade --install user-vessel ./helm/charts/user-vessel \
  --namespace activity-system \
  --create-namespace

# Verify deployment
kubectl get pods -n activity-system -l app.kubernetes.io/name=user-vessel
```

### Service Mesh

Configure Istio gateway route for `identity.metabob.local`:

```yaml
apiVersion: networking.istio.io/v1beta1
kind: VirtualService
metadata:
  name: user-vessel
spec:
  hosts:
  - identity.metabob.local
  gateways:
  - istio-system/metabob-gateway
  http:
  - route:
    - destination:
        host: user-vessel.activity-system.svc.cluster.local
        port:
          number: 8080
```

## Dashboard Integration

Update `metabob-cloud-dashboard/src/index.ts` to proxy auth routes:

```typescript
const userVesselUrl = process.env.USER_VESSEL_URL ||
  'http://user-vessel.activity-system.svc.cluster.local:8080';

// Proxy auth and user management routes
if (url.pathname.startsWith('/api/auth/') ||
    url.pathname.startsWith('/api/v2/users') ||
    url.pathname.startsWith('/api/v2/organizations')) {
  return fetch(`${userVesselUrl}${url.pathname}${url.search}`, {
    method: req.method,
    headers: req.headers,
    body: req.body
  });
}
```

## Deterministic Activities

user-vessel provides **activities for composition patterns**, but execution is **deterministic** (no LLM improvisation needed):

### 1. user-vessel:onboard-user

**Status**: Template defined, deterministic execution

**Purpose**: Create user + assign projects + send welcome email + generate API key

**Input Schema:**
```typescript
{
  required: [{ shape: "new_user_request" }],
  optional: [{ shape: "project_list" }]
}
```

**Output Schema:**
```typescript
{
  produces: [
    { shape: "user_profile" },
    { shape: "api_key_info" },
    { shape: "email_sent_confirmation" }
  ]
}
```

**Tasks:**
1. `create-user` - User-vessel resolver (deterministic DB insert)
2. `assign-projects` - User-vessel resolver (deterministic memberships)
3. `generate-api-key` - User-vessel resolver (deterministic key generation)
4. `send-welcome-email` - **Delegates to email-vessel** (composition!)

**Key Points:**
- **Deterministic**: Known state-space (CRUD operations), no LLM needed
- **Composition**: Calls email-vessel for send_template
- **Learning**: Traces record which composition patterns succeed
- **State transitions**: Each task transforms impulse sets deterministically

### 2. user-vessel:provision-organization

**Status**: Template defined, deterministic execution

**Purpose**: Create org + admin user + default project + setup billing

**Tasks:**
1. `create-org` - Deterministic transaction
2. `create-admin` - Deterministic user creation
3. `setup-billing` - **Delegates to billing-vessel** (composition!)
4. `create-default-project` - Deterministic project creation

### 3. user-vessel:generate-audit-report

**Status**: Template defined, deterministic execution

**Purpose**: Aggregate user actions + compute metrics + format report

**Tasks:**
1. `fetch-user-actions` - Deterministic aggregation query
2. `compute-metrics` - Deterministic calculations
3. `format-report` - Deterministic template rendering

**Composition Learning:**
Even though execution is deterministic, recording traces enables learning:
- Which activity sequences succeed together
- Which vessels are reliable for specific patterns
- How to recommend compositions for new workflows

See [CLAUDE.md](CLAUDE.md) for detailed activity composition guide.

## Impulse Types and Resolvers

user-vessel provides **deterministic resolvers** for user-domain impulse types. These resolvers are registered with discovery-vessel for shape-based routing.

### Supported Shapes

| Shape | Description | Resolver Pattern | Deterministic |
|-------|-------------|------------------|---------------|
| `user_profile` | User details with RBAC | Direct DB query | ✓ |
| `org_settings` | Org config and metadata | Direct DB query | ✓ |
| `api_key_info` | API key metadata (not secret) | Direct DB query | ✓ |
| `project_list` | Projects for user/org | Direct DB query with joins | ✓ |
| `api_key_usage` | Usage statistics | Aggregate from tracking tables | ✓ |
| `user_cost_report` | LLM usage and costs | Aggregate with budget calc | ✓ |

### Example: user_profile Resolver

**Impulse Structure:**
```typescript
{
  id: "imp_user_alice",
  pointer: {
    type: "user_profile",
    user_id: "users:alice",
    include_projects: false  // Optional
  },
  metadata: {
    shape: "user_profile",
    rowCount: 1,
    columns: ["id", "org_id", "email", "name", "role"],
    summary: "User profile for alice@example.com",
    availableOps: ["update_profile", "change_password"],
    producedBy: "user-vessel"
  },
  loaded: false,
  content: null
}
```

**Resolution (POST /resolve-impulse):**
```typescript
// 1. Validate shape is supported
if (impulse.metadata.shape !== "user_profile") {
  return { error: "Unsupported shape" };
}

// 2. Extract pointer parameters
const { user_id, include_projects } = impulse.pointer;

// 3. Query with RBAC enforcement
const db = await getAuthenticatedDb(auth);
const [user] = await db.query(
  `SELECT * FROM users WHERE id = $user_id AND org_id = $auth.org_id`,
  { user_id }
);

// 4. Return loaded impulse
return {
  impulse: {
    ...impulse,
    loaded: true,
    content: user,
    metadata: {
      ...impulse.metadata,
      resolvedAt: new Date().toISOString(),
      resolvedBy: "user-vessel"
    }
  }
};
```

**Key Points:**
- **No LLM needed**: Direct database query with RBAC
- **Metadata first**: Reasoners see shape/summary before loading
- **Discovery routing**: Discovery-vessel routes based on shape
- **Multi-tenant safe**: PERMISSIONS enforce org_id filtering

See [CLAUDE.md](CLAUDE.md) for detailed resolver implementation guide.

## RBAC and Security

### Database-Level Enforcement

All RBAC is enforced at the database level via SurrealDB PERMISSIONS clauses:

```surql
DEFINE TABLE users SCHEMAFULL
  PERMISSIONS
    FOR select WHERE org_id = $auth.org_id
    FOR create, update WHERE $auth.role = 'admin' AND org_id = $auth.org_id
    FOR delete WHERE $auth.role = 'admin' AND org_id = $auth.org_id;
```

### JWT Claims Structure

```json
{
  "iss": "https://metabob.com",
  "sub": "user:alice",
  "org_id": "organization:acme",
  "project_ids": ["project:backend", "project:frontend"],
  "role": "admin",
  "user_id": "user:alice",
  "exp": 1234567890,
  "iat": 1234567800
}
```

### Password Security

- Passwords hashed with Argon2id (Bun.password.hash)
- Minimum requirements: 8 chars, uppercase, lowercase, number
- Password hashes never returned in API responses

### API Keys

- Format: `mb_live_<random24>` or `mb_test_<random24>`
- Stored as Argon2 hashes
- Raw key only returned once on creation
- Revocation via `is_active = false`

## Alignment with Foundation Principles

### 1. Impulses Are Universal Data
✓ **Implementation**: User data (profiles, org settings, API keys) are impulse types with metadata
✓ **Example**: `user_profile` impulse has metadata (shape, columns, summary) and pointer (user_id)
✓ **Benefit**: Metadata allows reasoners to decide without loading all user data

### 2. Activities Constrain Search
✓ **Implementation**: Onboarding, provisioning, auditing are activities (not ad-hoc scripts)
✓ **Example**: `user-vessel:onboard-user` constrains search to known sequence
✓ **Benefit**: Deterministic execution (known state-space, no improvisation needed)

### 3. Resolvers Live Where Data Lives
✓ **Implementation**: user-vessel resolves user-domain shapes (not centralized)
✓ **Example**: Discovery routes `user_profile` requests to user-vessel
✓ **Benefit**: Database access is local, no remote coupling

### 4. Metadata First, Content Later
✓ **Implementation**: Impulse metadata includes columns, summary, availableOps
✓ **Example**: Reasoner sees "user_profile for alice@example.com" before loading content
✓ **Benefit**: Efficient context window usage, lazy loading

### 5. Record Everything
✓ **Implementation**: All activity executions traced, composition patterns recorded
✓ **Example**: API usage tracked via cost_tracking table
✓ **Benefit**: Traces feed learning loop

### 6. Learn From Traces
✓ **Implementation**: Thompson Sampling for activity selection, composition graph learning
✓ **Example**: Backend learns which activity sequences succeed together
✓ **Benefit**: Even deterministic operations contribute to composition learning

### 7. Reserve Improvisation
✓ **Implementation**: User operations are deterministic, but traces record patterns
✓ **Example**: No LLM for user CRUD, but onboarding sequence can improvise if needed
✓ **Benefit**: Enables recommendation for new workflows based on successful patterns

### 8. LLMs Are Tools, Not Controllers
✓ **Implementation**: User management is deterministic (no LLM needed)
✓ **Example**: Resolvers are direct database queries with RBAC enforcement
✓ **Benefit**: Fast, reliable, predictable execution

See [IMPULSE_ACTIVITY_FOUNDATION.md](/home/avi/documents/work/exp-repo/metabob-devbob/docs/architecture/IMPULSE_ACTIVITY_FOUNDATION.md) for foundational model.

## License

Proprietary - Metabob Inc.
