# JWT Claims Structure

This document describes the JWT token structure used for authentication in the Metabob ecosystem.

## Overview

JWTs (JSON Web Tokens) are used for authenticated API requests. The token contains claims that identify the user/instance and their permissions.

## Token Format

```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.
eyJzdWIiOiJ1c2VyczphbGljZSIsIm9yZ19pZCI6Im9yZ2FuaXphdGlvbnM6YWNtZSIsInJvbGUiOiJhZG1pbiIsImlhdCI6MTcxMTM2MTQwMCwiZXhwIjoxNzExMzYyMzAwfQ.
signature
```

Three parts separated by dots:
1. **Header**: Algorithm and token type
2. **Payload**: Claims (user info, expiration)
3. **Signature**: Verification signature

## Standard Claims

| Claim | Type | Description |
|-------|------|-------------|
| `sub` | string | Subject - user or instance ID |
| `iat` | number | Issued at (Unix timestamp) |
| `exp` | number | Expiration (Unix timestamp) |
| `iss` | string | Issuer (optional) |

## Custom Claims

### User Authentication (Dashboard/API Key)

```json
{
  "sub": "users:alice",
  "org_id": "organizations:acme",
  "role": "admin",
  "user_id": "users:alice",
  "auth_method": "password",
  "iat": 1711361400,
  "exp": 1711362300
}
```

### API Key Authentication

```json
{
  "sub": "api_keys:xyz789",
  "org_id": "organizations:acme",
  "user_id": "users:alice",
  "role": "member",
  "scopes": ["read", "write"],
  "auth_method": "api_key",
  "api_key_id": "api_keys:xyz789",
  "iat": 1711361400,
  "exp": 1711362300
}
```

### MiniBob Instance Authentication

```json
{
  "sub": "minibob_instance:mb001",
  "org_id": "organizations:acme",
  "project_id": "projects:backend",
  "instance_id": "mb001",
  "vessel_id": "vessel:minibob-v2",
  "auth_method": "record",
  "iat": 1711361400,
  "exp": 1711447800
}
```

## Claim Descriptions

### org_id (required)

Organization scope for the authenticated entity.

```json
"org_id": "organizations:acme"
```

Used in PERMISSIONS:
```surql
WHERE org_id = $auth.org_id
```

### role (users only)

User's role within the organization.

| Value | Description |
|-------|-------------|
| `admin` | Full permissions, can manage org |
| `member` | Standard permissions |
| `viewer` | Read-only access |

```json
"role": "admin"
```

Used in PERMISSIONS:
```surql
WHERE $auth.role = 'admin'
```

### project_id (optional)

Project scope for project-scoped operations.

```json
"project_id": "projects:backend"
```

Used in PERMISSIONS:
```surql
WHERE project_id = $auth.project_id
```

### scopes (API keys only)

Array of permission scopes for the API key.

```json
"scopes": ["read", "write", "admin"]
```

Common scopes:
- `read`: Read access to org data
- `write`: Create/update access
- `admin`: Administrative operations
- `execute`: Execute activities

Used in PERMISSIONS:
```surql
WHERE 'write' IN $auth.scopes
```

### auth_method

How the token was obtained.

| Value | Description |
|-------|-------------|
| `password` | User login with password |
| `api_key` | API key exchange |
| `record` | SurrealDB RECORD auth (MiniBob) |
| `oauth` | OAuth provider (future) |

Useful for audit logging:
```typescript
auditLog.create({
  event: 'data_access',
  auth_method: claims.auth_method,
  user_id: claims.sub
});
```

### instance_id (MiniBob only)

MiniBob instance identifier.

```json
"instance_id": "mb001"
```

### vessel_id (MiniBob only)

Vessel type/version for the instance.

```json
"vessel_id": "vessel:minibob-v2"
```

## Token Lifetimes

| Auth Method | Token Duration | Session Duration | Refresh |
|-------------|----------------|------------------|---------|
| Password | 15 minutes | 12 hours | Manual |
| API Key | 15 minutes | 1 hour | Auto (80%) |
| MiniBob | 24 hours | 7 days | Auto |

## Validation

### Server-Side Validation

```typescript
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET;

function validateToken(token: string): Claims {
  try {
    const claims = jwt.verify(token, JWT_SECRET) as Claims;

    // Required claims
    if (!claims.sub || !claims.org_id) {
      throw new Error('Missing required claims');
    }

    return claims;
  } catch (error) {
    throw new Error('Invalid token');
  }
}
```

### SurrealDB Validation

SurrealDB validates tokens automatically when using ACCESS:

```typescript
// Token is validated and $auth is populated
await db.authenticate(token);

// Now queries use $auth for PERMISSIONS
const results = await db.query('SELECT * FROM activity_template');
```

## Extracting Claims

### In Application Code

```typescript
import jwt from 'jsonwebtoken';

const token = req.headers.authorization?.replace('Bearer ', '');
const claims = jwt.decode(token) as Claims;

console.log(claims.org_id);  // "organizations:acme"
console.log(claims.role);    // "admin"
```

### In SurrealDB Queries

```surql
-- Access current auth context
SELECT * FROM $auth;

-- Use in queries
SELECT * FROM users WHERE id = $auth.id;
```

## Security Best Practices

1. **Short-lived tokens**: Use 15-minute tokens with refresh
2. **HTTPS only**: Never send tokens over unencrypted connections
3. **Secure storage**: Store tokens securely (not in localStorage for web)
4. **Validate on every request**: Don't cache validation results
5. **Include auth_method**: Track how tokens were obtained for audit
6. **Minimal claims**: Only include necessary data

## Example: Full Token Flow

### 1. API Key Validation (identity-vessel)

Request:
```http
POST http://identity.metabob.local/v1/auth/resolve
Content-Type: application/json

{
  "impulse": {
    "type": "authentication",
    "pointer": {
      "type": "apiKey",
      "apiKey": "mb_live-acme-usr_alice-key_abc123-signature"
    }
  }
}
```

Response:
```json
{
  "success": true,
  "data": {
    "authenticated": true,
    "orgId": "acme",
    "userId": "usr_alice",
    "keyId": "key_abc123",
    "type": "api_key",
    "scopes": ["read", "write"]
  }
}
```

### 2. MiniBob Instance Authentication (identity-vessel)

Request:
```http
POST http://identity.metabob.local/v1/auth/minibob/signin
Content-Type: application/json

{
  "instance_id": "minibob-local-001",
  "api_key": "minibob-local-dev-key"
}
```

Response:
```json
{
  "success": true,
  "token": "eyJhbGci...",
  "org_id": "metabob_internal"
}
```

### 3. Authenticated Request (activity-api)

```http
GET http://activity.metabob.local/v2/activities/templates
Authorization: Bearer eyJhbGci...
```

## Debugging

### Decode Token (Development)

```bash
# Using jq and base64
echo "eyJhbGci..." | cut -d. -f2 | base64 -d | jq .
```

### Online Decoder

https://jwt.io (paste token, don't use for production tokens)

### Check Token in SurrealDB

```surql
-- After authentication
SELECT * FROM $auth;
```
