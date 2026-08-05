# JWT Claims Structure

This document describes the JWT token structure used for authenticated requests across the vessel fleet. Tokens are minted and verified by identity-vessel, the single validator; every other vessel checks credentials against it rather than decoding tokens itself.

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
  "api_key_id": "api_keys:xyz789",
  "iat": 1711361400,
  "exp": 1711362300
}
```

### Instance authentication is retired

A per-instance record-auth token format existed for a retired CLI. Instances authenticate with an
ordinary API key, exactly as in §API Key Authentication above. The signin routes for the old format
remain mounted and answer `410 Gone`: a tombstone that names the removed method is a better signal
than a bare `404`, and it stays until telemetry shows no callers.

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

### The claim set is what the generator emits

`POST /v1/jwt/generate` on identity-vessel accepts `user_id`, `org_id`, `role`, optional
`project_ids[]`, and an optional lifetime; `POST /v1/jwt/verify` returns those plus `exp` and
`iat`. Nothing outside that set is minted or read, so a claim documented here that the generator
does not emit is a claim that will silently be `undefined` at the point of use.

The generator is authenticated. Every request carries an `Authorization` header —
`ApiKey <key>` or `Bearer <jwt>` — and the claims it will mint are bound to the identity behind
that credential: a body whose `org_id` or `user_id` differs from the authenticated credential's
own is refused rather than honoured. The mint does **not** require `admin` scope, because an
operator credential carrying only `read,write` still needs to mint its own token; nor does it
constrain the requested `role`. Scope is enforced downstream, on the admin-only `/v1/keys/*`
endpoints. Treat the mint as identity-binding rather than privilege-granting: it re-expresses a
credential you already hold as a short-lived token with the same identity.

## Token Lifetimes

| Auth Method | Token Duration | Session Duration | Refresh |
|-------------|----------------|------------------|---------|
| Password | 15 minutes | 12 hours | Manual |
| API Key | 15 minutes | 1 hour | Auto (80%) |

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
5. **Minimal claims**: Only include necessary data
6. **Isolation is enforced in the database**: PERMISSIONS gate on `$token.org_id`, not application code

## Example: Full Token Flow

Endpoints below are written against the host-mapped ports of a local substrate. Resolve the live
address through discovery rather than pinning it; the port table is a convenience, not a contract.

### 1. API Key Validation (identity-vessel)

Request:
```http
POST http://localhost:18101/v1/auth/resolve
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

### 2. Token Generation (identity-vessel)

Request:
```http
POST http://localhost:18101/v1/jwt/generate
Content-Type: application/json
Authorization: ApiKey <key>

{
  "user_id": "usr_alice",
  "org_id": "acme",
  "role": "member"
}
```

The `Authorization` header is required (`ApiKey <key>` or `Bearer <jwt>`), and the `user_id` /
`org_id` in the body must be the authenticated credential's own.

Response:
```json
{
  "success": true,
  "data": { "token": "eyJhbGci...", "issued_at": 1711361400, "expires_at": 1711362300 }
}
```

Rejections:

| Status | Code | Condition |
|---|---|---|
| 401 | `MISSING_AUTH_HEADER` | No `Authorization` header on the request |
| 401 | `INVALID_AUTH_SCHEME` | Header does not begin with `ApiKey ` or `Bearer ` |
| 401 | `INVALID_API_KEY` | `ApiKey` credential fails validation |
| 401 | `REVOKED_API_KEY` | `ApiKey` credential validates but has been revoked |
| 401 | `INVALID_JWT` | `Bearer` token fails verification (bad signature, expired, malformed) |
| 403 | `FORBIDDEN` | Body `org_id` or `user_id` does not match the authenticated credential |

Note the split: a 401 means the caller was not identified, a 403 means the caller was identified
and asked for claims that are not theirs to mint. Neither is a scope failure — the mint does not
check for `admin`.

### 3. Authenticated Request (activity-api)

```http
GET http://localhost:18080/v2/activities/templates
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
