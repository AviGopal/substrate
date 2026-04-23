# RBAC Guide

This document covers Role-Based Access Control (RBAC) implementation using SurrealDB PERMISSIONS clauses.

## Core Concept

SurrealDB PERMISSIONS are evaluated at query time using the `$auth` or `$token` variable, populated from the JWT. This enables **database-level enforcement** of access control, not just application-level filtering.

```surql
-- When a user queries, SurrealDB automatically filters:
SELECT * FROM activity_template
-- Becomes (internally):
SELECT * FROM activity_template WHERE org_id = $token.org_id
```

## `$auth` vs `$token` (which one do I use?)

All activity-api JWTs — both identity-vessel-minted dashboard tokens and activity-api self-signed API-key tokens — verify against a single access method: `jwt_external` (`TYPE JWT`, `ALGORITHM HS256`, defined in `metabob-proto/surrealdb/core/001-auth-access.surql`). The `$auth` vs `$token` split comes from whether the JWT's `id` claim resolves to a real SurrealDB record:

| Caller | `id` claim | `$auth` | `$token` |
|---|---|---|---|
| Dashboard user (identity-vessel JWT) | `users:alice` — resolves to a real row | Populated (the user record) | Populated (raw claims) |
| API-key auth (activity-api self-signs with `jwt_external` since commit a20314a, 2026-04-22) | `api_key:${keyId}` — **not** a record | `NONE` | Populated (raw claims) |

**Rule of thumb for activity-api tables:** prefer `$token` in PERMISSIONS. It works for both callers (dashboard *and* API-key), whereas `$auth` evaluates to `NONE` under API-key auth and silently filters everything out. Migrations 079, 080, and 083 (2026-04) swept 20 tables from `$auth.*` to `$token.*` precisely because Thompson-Sampling queries, template listing, and impulse resolution were returning empty under API-key auth.

`$auth` remains correct when a pattern genuinely needs the authenticated record — for example, looking up the user row for display name or preferences — and the caller is known to be dashboard-JWT. For raw org scoping, use `$token.org_id`.

> **Historical note:** activity-api previously self-signed API-key JWTs with `AC: 'apikey_token'` + `alg: HS512` against a `DEFINE ACCESS apikey_token ... TYPE JWT` block introduced in migration 064. Commit a20314a switched to `AC: 'jwt_external'` + `alg: HS256` to match the shared `metabob-proto` access definition. The `apikey_token` access is still defined in `metabob-activity-api/sql/000-auth-schema.surql` and migration 064/069 for backward compatibility but is no longer issued against.

## The $token Variable

After authentication, `$token` contains the claims from the JWT:

```json
{
  "id": "users:alice",           // User or instance ID
  "org_id": "organizations:acme", // Organization
  "role": "admin",               // User's role
  "project_id": "projects:api",  // Optional: project scope
  "scopes": ["read", "write"]    // Optional: API key scopes
}
```

## PERMISSIONS Patterns

> **Note:** The examples below use `$auth.*` for readability and historical continuity. In deployed activity-api migrations these are `$token.*` — see the `$auth` vs `$token` section above. When authoring new migrations, default to `$token.*` for org/project scoping; reach for `$auth.*` only when you truly need the authenticated record.

### Pattern 1: Org-Scoped Read/Write

Most common pattern - users can only access their organization's data:

```surql
DEFINE TABLE activity_template SCHEMAFULL
  PERMISSIONS
    FOR select, create, update, delete WHERE org_id = $auth.org_id;
```

### Pattern 2: Public + Org (Marketplace)

For shared resources like public templates:

```surql
DEFINE TABLE activity_template SCHEMAFULL
  PERMISSIONS
    -- Can read own org's templates OR public templates
    FOR select WHERE org_id = $auth.org_id OR public = true
    -- Can only create in own org
    FOR create WHERE org_id = $auth.org_id
    -- Can only modify own org's templates
    FOR update, delete WHERE org_id = $auth.org_id;
```

### Pattern 3: Role-Based (Admin Only)

For sensitive operations:

```surql
DEFINE TABLE organizations SCHEMAFULL
  PERMISSIONS
    FOR select WHERE id = $auth.org_id
    FOR update WHERE id = $auth.org_id AND $auth.role = 'admin'
    FOR delete WHERE false;  -- Never allow delete via API
```

### Pattern 4: Owner-Based

For user-owned resources like annotations:

```surql
DEFINE TABLE annotations SCHEMAFULL
  PERMISSIONS
    -- Anyone in org can read
    FOR select WHERE org_id = $auth.org_id
    -- Owner or admin can modify
    FOR update, delete WHERE org_id = $auth.org_id
      AND (user_id = $auth.id OR $auth.role = 'admin')
    -- Anyone in org can create
    FOR create WHERE org_id = $auth.org_id;
```

### Pattern 5: Project-Scoped

For project-level isolation within an org:

```surql
DEFINE TABLE execution_traces SCHEMAFULL
  PERMISSIONS
    -- Project members only (or org admins)
    FOR select WHERE org_id = $auth.org_id
      AND (project_id = $auth.project_id OR $auth.role = 'admin')
    FOR create WHERE org_id = $auth.org_id
      AND project_id = $auth.project_id;
```

### Pattern 6: Hierarchical (Global/Org/Project)

For scope-based visibility:

```surql
DEFINE TABLE activity_template SCHEMAFULL
  PERMISSIONS
    FOR select WHERE
      -- Global templates visible to all
      scope = 'global' OR
      -- Org templates visible to org members
      (scope = 'org' AND org_id = $auth.org_id) OR
      -- Project templates visible to project members
      (scope = 'project' AND project_id = $auth.project_id);
```

## Default Field Values

Use `VALUE` clauses to auto-populate org_id from $auth:

```surql
DEFINE FIELD org_id ON activity_template TYPE record<organizations>
  ASSERT $value != NONE
  VALUE $value OR $auth.org_id;
```

This ensures:
1. If org_id is provided, use it (validated by PERMISSIONS)
2. If not provided, use $auth.org_id (current user's org)

## Common Mistakes

### Mistake 1: Application-Level Only

**Wrong:**
```typescript
// Only filtering in application code - can be bypassed!
const templates = await db.query(`
  SELECT * FROM activity_template WHERE org_id = $org_id
`, { org_id: userOrgId });
```

**Right:**
```typescript
// Use authenticated connection - PERMISSIONS enforced
const db = await createAuthenticatedClient(jwtToken);
const templates = await db.query(`SELECT * FROM activity_template`);
// SurrealDB automatically filters by $auth.org_id
```

### Mistake 2: Missing PERMISSIONS

**Wrong:**
```surql
DEFINE TABLE secrets SCHEMAFULL;
-- No PERMISSIONS = accessible to everyone!
```

**Right:**
```surql
DEFINE TABLE secrets SCHEMAFULL
  PERMISSIONS
    FOR select, create, update, delete WHERE org_id = $auth.org_id;
```

### Mistake 3: Overly Permissive OR

**Wrong:**
```surql
PERMISSIONS
  FOR select WHERE org_id = $auth.org_id OR true;  -- Always true!
```

**Right:**
```surql
PERMISSIONS
  FOR select WHERE org_id = $auth.org_id OR public = true;
```

## Testing PERMISSIONS

### Test 1: Verify Isolation

```typescript
// User A creates a template
const userADb = await createAuthenticatedClient(userAToken);
await userADb.query(`CREATE activity_template SET name = 'A Template', org_id = $auth.org_id`);

// User B (different org) should not see it
const userBDb = await createAuthenticatedClient(userBToken);
const result = await userBDb.query(`SELECT * FROM activity_template WHERE name = 'A Template'`);
assert(result.length === 0); // Should be empty
```

### Test 2: Verify Role Enforcement

```typescript
// Member cannot update org settings
const memberDb = await createAuthenticatedClient(memberToken);
try {
  await memberDb.query(`UPDATE organizations SET name = 'Hacked'`);
  assert.fail('Should have thrown');
} catch (e) {
  // Expected: permission denied
}

// Admin can update
const adminDb = await createAuthenticatedClient(adminToken);
await adminDb.query(`UPDATE organizations SET name = 'New Name'`);
// Success
```

## Roles

### Standard Roles

| Role | Description | Typical Permissions |
|------|-------------|---------------------|
| `admin` | Organization administrator | Full CRUD on org data |
| `member` | Regular user | Read all, write own resources |
| `viewer` | Read-only access | Read only |

### Role Checks in PERMISSIONS

```surql
-- Admin-only operations
FOR delete WHERE $auth.role = 'admin'

-- Member or above
FOR create WHERE $auth.role IN ['admin', 'member']

-- Any authenticated user
FOR select WHERE org_id = $auth.org_id
```

## API Key Scopes

API keys can have restricted scopes:

```surql
DEFINE FIELD scopes ON api_keys TYPE array<string>
  DEFAULT ['read'];
```

Check scopes in PERMISSIONS:

```surql
PERMISSIONS
  FOR select WHERE org_id = $auth.org_id
  FOR create WHERE org_id = $auth.org_id AND 'write' IN $auth.scopes;
```

## Performance Considerations

### Indexes

Always create indexes on org_id for filtered tables:

```surql
DEFINE INDEX idx_template_org ON activity_template FIELDS org_id;
DEFINE INDEX idx_template_org_project ON activity_template FIELDS org_id, project_id;
```

### Query Patterns

Efficient (uses index):
```surql
SELECT * FROM activity_template WHERE org_id = $auth.org_id LIMIT 100
```

Potentially slow (full scan):
```surql
SELECT * FROM activity_template WHERE name CONTAINS 'test'
-- Add: AND org_id = $auth.org_id to use index first
```

## Debugging

### Check Current Auth

```surql
SELECT * FROM $auth;
```

### Explain Query Plan

```surql
EXPLAIN SELECT * FROM activity_template;
```

### Test PERMISSIONS

```surql
-- Create test user with specific claims
DEFINE ACCESS test_user ON DATABASE TYPE JWT
  ALGORITHM HS256 KEY 'test-key'
  DURATION FOR TOKEN 1h;

-- Generate token with claims
-- Then test queries
```

## Summary

1. **Always use PERMISSIONS** on multi-tenant tables
2. **Never rely only on application-level filtering**
3. **Use $auth.org_id** as the primary isolation mechanism
4. **Create indexes** on org_id fields
5. **Test isolation** between organizations
6. **Use authenticated connections** (`createAuthenticatedClient`)
