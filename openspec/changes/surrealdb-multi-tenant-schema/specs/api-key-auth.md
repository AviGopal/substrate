# API Key Authentication Specification

## Overview

This spec defines the API key → JWT exchange flow that allows users and IDE integrations to authenticate with a long-lived API key instead of managing JWT tokens manually.

## Motivation

Users configuring metabob-mcp in their IDE (Claude Desktop, Cursor) need a simple way to authenticate. Managing short-lived JWTs (15 min expiry) manually is impractical. API keys provide:

1. **Simplicity**: One credential to configure, no manual token refresh
2. **Security**: API keys can be revoked, scoped, and tracked
3. **Compatibility**: Standard pattern for developer tools

## Constraints

- API keys are org-scoped (users belong to exactly one org)
- API keys are user-scoped (each key belongs to a user)
- API keys are hashed with argon2 in the database
- JWT tokens expire in 15 minutes and must be refreshed

## Data Model

**Existing `api_keys` table:**
```surql
api_keys {
  id: record<api_keys>        -- e.g., api_keys:abc123
  org_id: record<organizations>
  user_id: record<users>
  key_hash: string            -- argon2 hash of the key
  scopes: array<string>       -- e.g., ["read", "write", "admin"]
  created_at: datetime
  last_used_at: option<datetime>
  expires_at: option<datetime>
  is_active: bool
}
```

**API Key Format:**
```
mk_<org_prefix>_<random_32_chars>
Example: mk_metabob_a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6
```

The key prefix `mk_` identifies it as a Metabob API key. The org prefix is optional but helps users identify which org the key belongs to.

## API Endpoints

### POST /v2/auth/apikey

Exchange an API key for a JWT token.

**Request:**
```json
{
  "api_key": "mk_metabob_a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6"
}
```

**Response (200 OK):**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "expires_at": "2026-03-25T12:30:00Z",
  "expires_in": 900,
  "org_id": "organizations:metabob",
  "user_id": "users:abc123",
  "scopes": ["read", "write"]
}
```

**Response (401 Unauthorized):**
```json
{
  "error": "invalid_api_key",
  "message": "API key is invalid, expired, or revoked"
}
```

**Behavior:**
1. Hash the provided API key with argon2
2. Query `api_keys` table for matching `key_hash`
3. Verify `is_active = true` and `expires_at` not passed
4. Update `last_used_at` to current timestamp
5. Generate JWT with claims from user/org
6. Return JWT and metadata

### POST /v2/auth/apikey/refresh

Refresh an existing JWT using the original API key.

**Request:**
```json
{
  "api_key": "mk_metabob_a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6"
}
```

**Response:** Same as POST /v2/auth/apikey

This is semantically identical to the initial exchange but may be used by clients to explicitly refresh before expiry.

## JWT Claims

The JWT issued from API key authentication contains:

```json
{
  "sub": "users:abc123",
  "org_id": "organizations:metabob",
  "role": "member",
  "scopes": ["read", "write"],
  "auth_method": "api_key",
  "api_key_id": "api_keys:xyz789",
  "iat": 1711361400,
  "exp": 1711362300
}
```

The `auth_method: "api_key"` claim distinguishes API key auth from password auth for audit purposes.

## Client Integration (metabob-mcp)

### Configuration

**Environment variable:**
```bash
METABOB_API_KEY=mk_metabob_a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6
```

**CLI flag:**
```bash
npx @metabob/metabob-mcp --api-key=mk_metabob_...
```

### Startup Flow

```
┌──────────────┐                              ┌──────────────────┐
│  metabob-mcp │                              │  activity-api    │
└──────┬───────┘                              └────────┬─────────┘
       │                                               │
       │  POST /v2/auth/apikey                        │
       │  { "api_key": "mk_..." }                     │
       │──────────────────────────────────────────────▶│
       │                                               │
       │  { "token": "eyJ...", "expires_in": 900 }    │
       │◀──────────────────────────────────────────────│
       │                                               │
       │  Store JWT, schedule refresh at 80% expiry   │
       │                                               │
       │  ... use JWT for all API requests ...        │
       │                                               │
       │  [12 min later] POST /v2/auth/apikey         │
       │──────────────────────────────────────────────▶│
       │                                               │
       │  { "token": "eyJ...", "expires_in": 900 }    │
       │◀──────────────────────────────────────────────│
       │                                               │
```

### Auto-Refresh Logic

1. On startup, exchange API key for JWT
2. Calculate refresh time: `expires_in * 0.8` (12 min for 15 min token)
3. Schedule refresh timer
4. On refresh failure, retry with exponential backoff
5. After 3 failures, log error and continue with expired token (graceful degradation)

### Error Handling

| Error | Action |
|-------|--------|
| Invalid API key | Exit with error message, don't retry |
| API key expired | Exit with error message, prompt to create new key |
| API key revoked | Exit with error message, prompt to create new key |
| Network error | Retry with backoff, continue if have valid cached JWT |
| Server error (5xx) | Retry with backoff |

## Security Considerations

1. **API keys are secrets**: Never log the full key, only prefix
2. **HTTPS only**: API key exchange must use HTTPS in production
3. **Rate limiting**: Limit auth attempts to prevent brute force
4. **Audit logging**: Log all API key usage with `api_key_id` (not the key itself)
5. **Scope enforcement**: JWT scopes are subset of API key scopes

## Example: Claude Desktop Configuration

```json
{
  "mcpServers": {
    "metabob": {
      "command": "npx",
      "args": ["@metabob/metabob-mcp@latest"],
      "env": {
        "METABOB_API_KEY": "mk_metabob_a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6",
        "ANALYSIS_API_URL": "https://api.metabob.com"
      }
    }
  }
}
```

## Example: Cursor Configuration

```json
{
  "mcpServers": {
    "metabob": {
      "command": "npx",
      "args": [
        "@metabob/metabob-mcp@latest",
        "--api-key=mk_metabob_a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6"
      ]
    }
  }
}
```
