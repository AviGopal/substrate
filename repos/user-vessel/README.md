# user-vessel

User management vessel that handles organizations, users, projects, and API keys with full RBAC enforcement. Integrates with cloud dashboard for authentication while participating in the learning loop through activity traces.

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
- Dashboard needs immediate auth responses (<100ms) - can't wait for activity execution
- Complex workflows benefit from Thompson Sampling and trace-based learning
- Progressive enhancement toward full activity-based model

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

Connection tracking enforces slot limits and monitors active connections for API keys.

### Features

- **Slot Enforcement**: Limit simultaneous connections per API key (default: 3)
- **Heartbeat Monitoring**: Detect and auto-disconnect stale connections (5min timeout)
- **Instance Tracking**: Track which instances are connected (MiniBob, IDE, CLI, etc.)
- **Soft Deletion**: Connections marked as disconnected, not deleted

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

| Variable | Description | Default |
|----------|-------------|---------|
| `USER_VESSEL_PORT` | Server port | 8080 |
| `USER_VESSEL_HOST` | Bind address | 0.0.0.0 |
| `SURREALDB_URL` | SurrealDB endpoint | http://surrealdb.activity-system.svc.cluster.local:8000 |
| `SURREALDB_NAMESPACE` | Database namespace | activity-system |
| `SURREALDB_DATABASE` | Database name | learning_loop |
| `SURREALDB_USERNAME` | Database username | root |
| `SURREALDB_PASSWORD` | Database password | (required) |
| `JWT_SECRET` | JWT signing secret | (required) |
| `JWT_EXPIRES_IN` | Token expiry | 15m |
| `ACTIVITY_API_ENDPOINT` | Activity API URL | http://metabob-activity-api... |

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

## Activities (Future)

Vessel functions to be registered with activity-api:

### 1. user-vessel:onboard-user
- **Input**: `new_user_request` (email, name, org_id, role)
- **Output**: `user_profile`, `welcome_email_sent`, `initial_api_key`
- **Steps**: create_user → assign_projects → send_email → generate_api_key

### 2. user-vessel:provision-organization
- **Input**: `org_request` (name, admin_email, plan)
- **Output**: `organization`, `admin_user`, `default_project`
- **Steps**: create_org → create_admin → setup_billing → create_default_project

### 3. user-vessel:generate-audit-report
- **Tasks**: Fetch user actions → Aggregate metrics → Generate report
- **Output**: Compliance report with login success, API usage

## Impulse Types

User-vessel introduces and resolves these impulse types:

| Type | Description | Example Pointer |
|------|-------------|-----------------|
| `user_profile` | User details | `{type: "user_profile", user_id: "users:alice"}` |
| `org_settings` | Org config | `{type: "org_settings", org_id: "organizations:acme"}` |
| `api_key_info` | API key metadata | `{type: "api_key_info", key_id: "api_keys:123"}` |
| `project_list` | Projects for user/org | `{type: "project_list", org_id: "..."}` |

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

✓ **Treats data as impulses** - user_profile, org_settings are impulse types
✓ **Activities constrain search** - Onboarding, provisioning are activities
✓ **Resolvers where data lives** - User-vessel resolves its own domain types
✓ **Records traces** - All executions traced for learning
✓ **Avoids unnecessary LLM** - CRUD is deterministic, no LLM needed
✓ **Improvisation with recording** - Can recover from failures, traces captured
✓ **Backend for traces only** - Activity-api stores traces, doesn't orchestrate
✓ **Extractable patterns** - Template for building other vessels

## License

Proprietary - Metabob Inc.
