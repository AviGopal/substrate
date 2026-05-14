# MiniBob Instance Authentication Guide

This guide explains how to set up and use RECORD-based authentication for MiniBob instances in the multi-tenant RBAC system.

## Overview

MiniBob instances use **RECORD authentication** (SurrealDB 3.0 `DEFINE ACCESS ... TYPE RECORD`) to authenticate with the backend. This provides:

- **Autonomous operation**: Instances can authenticate without user intervention
- **Org/project scoping**: Each instance is bound to a specific organization and project
- **Database-enforced isolation**: PERMISSIONS clauses prevent cross-org/project access
- **Long-lived tokens**: 24-hour tokens with 7-day sessions for continuous operation

## Architecture

```
┌─────────────────┐
│  MiniBob Pod 1  │
│  instance_id: A │───┐
│  org: acme      │   │
│  project: web   │   │
└─────────────────┘   │
                      ├──> activity-api ───> SurrealDB
┌─────────────────┐   │    (MCP endpoint)     (RECORD auth)
│  MiniBob Pod 2  │   │
│  instance_id: B │───┘
│  org: globex    │
│  project: api   │
└─────────────────┘
```

### Authentication Flow

1. **Instance Registration** (one-time setup):
   - Admin creates `minibob_instance` record with hashed API key
   - Record includes `org_id`, `project_id` for scoping

2. **Instance Signin** (on startup):
   - MiniBob sends `instance_id` + `api_key` to SurrealDB
   - SIGNIN query validates credentials using `crypto::argon2::compare()`
   - Returns token scoped to instance's org/project

3. **Request Authentication** (every API call):
   - MiniBob includes instance credentials in HTTP headers
   - Activity-api connects to SurrealDB with RECORD auth
   - Database enforces PERMISSIONS based on `$auth.org_id` and `$auth.project_id`

## Setup Instructions

### 1. Create Organization and Project

First, create the organization and project that the MiniBob instance will belong to:

```sql
-- Create organization
CREATE organizations SET
  name = 'Acme Corp',
  seat_limit = 10,
  seat_usage = 0,
  created_at = time::now(),
  updated_at = time::now();

-- Create project
CREATE projects SET
  name = 'Web Application',
  org_id = organizations:acme_corp,
  created_at = time::now(),
  updated_at = time::now();
```

### 2. Generate API Key and Hash

Generate a secure API key and hash it using argon2:

```typescript
// Generate random API key
const apiKey = crypto.randomBytes(32).toString('hex');

// Hash with argon2 (use SurrealDB's crypto::argon2::generate())
const apiKeyHash = await db.query(`
  RETURN crypto::argon2::generate('${apiKey}')
`);
```

**IMPORTANT**: Store the plaintext API key securely - you'll need it to configure MiniBob. The hash goes in the database.

### 3. Create MiniBob Instance Record

Create the instance record in SurrealDB:

```sql
CREATE minibob_instance SET
  instance_id = 'minibob-prod-1',
  org_id = organizations:acme_corp,
  project_id = projects:web_app,
  api_key_hash = $api_key_hash,
  vessel_id = 'minibob-v0.1.0',
  is_active = true,
  created_at = time::now();
```

### 4. Configure MiniBob Environment

Set environment variables for the MiniBob pod:

```bash
# Instance authentication
export MINIBOB_INSTANCE_ID="minibob-prod-1"
export MINIBOB_INSTANCE_API_KEY="<your-generated-api-key>"
export MINIBOB_ORG_ID="organizations:acme_corp"
export MINIBOB_PROJECT_ID="projects:web_app"

# Backend endpoint
export MINIBOB_MCP_ENDPOINT="http://metabob-activity-api.activity-system.svc.cluster.local:8080"
```

Or configure via JSON file:

```json
{
  "instance": {
    "instanceId": "minibob-prod-1",
    "apiKey": "<your-generated-api-key>",
    "orgId": "organizations:acme_corp",
    "projectId": "projects:web_app"
  },
  "vessels": {
    "metabob": {
      "type": "http",
      "endpoint": "http://metabob-activity-api.activity-system.svc.cluster.local:8080",
      "capabilities": ["activities", "impulses", "executions"]
    }
  }
}
```

### 5. Verify Authentication

Test that the instance can authenticate:

```typescript
import { Surreal } from 'surrealdb';

const db = new Surreal();
await db.connect('http://localhost:8000');

// Set namespace/database BEFORE signin
await db.use({
  namespace: 'production',
  database: 'metabob',
});

// Sign in with RECORD access
const token = await db.signin({
  access: 'minibob_record',
  variables: {
    instance_id: 'minibob-prod-1',
    api_key: process.env.MINIBOB_INSTANCE_API_KEY,
  },
});

console.log('Authenticated:', !!token);

// Test org/project scoping
const templates = await db.query('SELECT * FROM activity_registry');
console.log('Templates visible:', templates); // Should only show org's templates
```

## PERMISSIONS Model

### MiniBob Instance Table

```sql
DEFINE TABLE minibob_instance SCHEMAFULL
  PERMISSIONS
    -- Instances can view their own record
    FOR select WHERE id = $auth.id OR (org_id = $auth.org_id AND $auth.role = 'admin')
    -- Admins can create/update/delete instances in their organization
    FOR create, update WHERE $auth.role = 'admin' AND org_id = $auth.org_id
    FOR delete WHERE $auth.role = 'admin' AND org_id = $auth.org_id;
```

**Key Points**:
- Instance can only see its own record (`id = $auth.id`)
- Org admins can see all instances in their org
- Only admins can create/update/delete instances

### Activity Registry Table

```sql
DEFINE TABLE activity_registry SCHEMAFULL
  PERMISSIONS
    FOR select WHERE
      (scope = 'global' AND public = true)  -- Public templates
      OR (scope = 'org' AND org_id = $auth.org_id)  -- Org templates
      OR (scope = 'project' AND project_id IN $auth.project_ids);  -- Project templates
```

**Key Points**:
- MiniBob instance can see public templates (scope='global', public=true)
- MiniBob instance can see org templates (scope='org' with matching org_id)
- MiniBob instance can see project templates (scope='project' with matching project_id)

### Execution Traces Table

```sql
DEFINE TABLE activity_execution_traces SCHEMAFULL
  PERMISSIONS
    FOR select WHERE org_id = $auth.org_id AND project_id = $auth.project_id
    FOR create WHERE org_id = $auth.org_id AND project_id = $auth.project_id
    FOR update, delete NONE;
```

**Key Points**:
- MiniBob can only read/write traces for its assigned project
- Cannot modify existing traces
- Full org/project isolation

## Token Management

### Token Durations

```sql
DEFINE ACCESS minibob_record ON DATABASE TYPE RECORD
  DURATION FOR TOKEN 24h
  DURATION FOR SESSION 7d;
```

- **Token**: 24 hours (refreshed automatically by SurrealDB client)
- **Session**: 7 days (max session lifetime before re-signin required)

### Token Refresh

SurrealDB client automatically refreshes tokens before expiry. To force refresh:

```typescript
const newToken = await db.invalidate();
await db.signin({
  access: 'minibob_record',
  variables: {
    instance_id: process.env.MINIBOB_INSTANCE_ID,
    api_key: process.env.MINIBOB_INSTANCE_API_KEY,
  },
});
```

### Revoking Access

To revoke an instance's access:

```sql
-- Disable instance
UPDATE minibob_instance SET is_active = false WHERE instance_id = 'minibob-prod-1';

-- Or delete instance
DELETE minibob_instance WHERE instance_id = 'minibob-prod-1';
```

Existing tokens remain valid until expiry (24h max). For immediate revocation, restart SurrealDB or implement token blacklist.

## Helm Deployment

Example Helm values for MiniBob deployment:

```yaml
# values.yaml
minibob:
  replicas: 3

  env:
    - name: MINIBOB_INSTANCE_ID
      value: "minibob-prod-1"
    - name: MINIBOB_ORG_ID
      value: "organizations:acme_corp"
    - name: MINIBOB_PROJECT_ID
      value: "projects:web_app"
    - name: MINIBOB_MCP_ENDPOINT
      value: "http://metabob-activity-api.activity-system.svc.cluster.local:8080"

    # API key from secret
    - name: MINIBOB_INSTANCE_API_KEY
      valueFrom:
        secretKeyRef:
          name: minibob-instance-credentials
          key: api-key
```

Create secret:

```bash
kubectl create secret generic minibob-instance-credentials \
  --from-literal=api-key=<your-generated-api-key> \
  -n activity-system
```

## Troubleshooting

### Authentication Failed

**Error**: `SIGNIN failed: invalid credentials`

**Cause**: API key doesn't match hash, or instance not found

**Solution**:
1. Verify instance exists: `SELECT * FROM minibob_instance WHERE instance_id = 'minibob-prod-1'`
2. Check `is_active = true`
3. Regenerate API key and update hash if needed

### Empty Query Results

**Error**: Queries return empty arrays

**Cause**: PERMISSIONS clause filtering data based on org/project

**Solution**:
1. Verify `$auth.org_id` matches records: `SELECT * FROM activity_registry WHERE org_id = $auth.org_id`
2. Check instance has correct org_id/project_id
3. Ensure templates have matching scope ('org' or 'project')

### Token Expired

**Error**: `Token expired`

**Cause**: Session exceeded 7-day limit

**Solution**:
1. Re-signin with RECORD access
2. Restart MiniBob pod (will auto-signin on startup)

## Security Best Practices

1. **API Key Storage**:
   - Never commit API keys to version control
   - Use Kubernetes secrets for production
   - Rotate keys periodically (every 90 days)

2. **Instance Lifecycle**:
   - Set `expires_at` for temporary instances
   - Mark inactive instances with `is_active = false`
   - Delete unused instances regularly

3. **Monitoring**:
   - Track `last_active_at` to detect stale instances
   - Alert on authentication failures
   - Monitor token refresh patterns

4. **Least Privilege**:
   - Each instance should have minimal scope (single project)
   - Don't grant admin role to instances
   - Use project-scoped templates instead of org-wide

## References

- [SurrealDB 3.0 RECORD Authentication](https://surrealdb.com/docs/surrealql/statements/define/access/record)
- [Argon2 Password Hashing](https://surrealdb.com/docs/surrealql/functions/crypto#cryptoargon2generate)
- [Phase 1 Core Schemas](../../repos/metabob-proto/surrealdb/core/001-auth-access.surql)
- [RBAC Specification](./spec.md)
