# Testing User-Vessel Authentication Endpoints

This document describes how to test the newly implemented signup and login endpoints.

## Prerequisites

1. SurrealDB running and accessible
2. Environment variables configured (see `.env.example` or use defaults)
3. user-vessel server running on port 8080 (or configured port)

## Quick Start

### 1. Start SurrealDB (if not already running)

```bash
# Using Docker
docker run --rm -p 8000:8000 surrealdb/surrealdb:latest start \
  --user root --pass surrealdb-local-dev-123
```

### 2. Configure Environment

Create a `.env` file or export variables:

```bash
export SURREALDB_URL="http://localhost:8000"
export SURREALDB_NAMESPACE="activity-system"
export SURREALDB_DATABASE="learning_loop"
export SURREALDB_USERNAME="root"
export SURREALDB_PASSWORD="surrealdb-local-dev-123"
export JWT_SECRET="your-secret-key-change-in-production"
export JWT_EXPIRES_IN="15m"
```

### 3. Start user-vessel

```bash
bun run dev
```

### 4. Run Tests

```bash
./test-auth-endpoints.sh
```

## Manual Testing with curl

### Signup (Create Organization + User)

```bash
curl -X POST http://localhost:8080/v2/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "email": "alice@example.com",
    "password": "TestPassword123",
    "name": "Alice Test",
    "org_name": "Test Organization"
  }'
```

**Expected Response (201 Created):**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "users:abc123",
    "org_id": "test_organization",
    "email": "alice@example.com",
    "name": "Alice Test",
    "role": "admin",
    "created_at": "2026-04-08T14:30:00Z",
    "last_login": "2026-04-08T14:30:00Z"
  },
  "org": {
    "id": "organizations:xyz789",
    "org_id": "test_organization",
    "name": "Test Organization",
    "subscription_tier": "free",
    "seat_limit": 1,
    "seat_usage": 1,
    "created_at": "2026-04-08T14:30:00Z",
    "updated_at": "2026-04-08T14:30:00Z"
  }
}
```

### Login

```bash
curl -X POST http://localhost:8080/v2/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "alice@example.com",
    "password": "TestPassword123"
  }'
```

**Expected Response (200 OK):**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "users:abc123",
    "org_id": "test_organization",
    "email": "alice@example.com",
    "name": "Alice Test",
    "role": "admin",
    "created_at": "2026-04-08T14:30:00Z",
    "last_login": "2026-04-08T14:30:15Z"
  },
  "org": {
    "id": "organizations:xyz789",
    "org_id": "test_organization",
    "name": "Test Organization",
    "subscription_tier": "free",
    "seat_limit": 1,
    "seat_usage": 1,
    "created_at": "2026-04-08T14:30:00Z",
    "updated_at": "2026-04-08T14:30:00Z"
  }
}
```

### Get Current User Info

```bash
TOKEN="<jwt-token-from-signup-or-login>"

curl http://localhost:8080/v2/auth/me \
  -H "Authorization: Bearer $TOKEN"
```

**Expected Response (200 OK):**
```json
{
  "user": {
    "id": "users:abc123",
    "org_id": "test_organization",
    "email": "alice@example.com",
    "name": "Alice Test",
    "role": "admin",
    "created_at": "2026-04-08T14:30:00Z",
    "last_login": "2026-04-08T14:30:15Z"
  },
  "org": {
    "id": "organizations:xyz789",
    "org_id": "test_organization",
    "name": "Test Organization",
    "subscription_tier": "free",
    "seat_limit": 1,
    "seat_usage": 1,
    "created_at": "2026-04-08T14:30:00Z",
    "updated_at": "2026-04-08T14:30:00Z"
  },
  "project_ids": []
}
```

## Error Cases

### Duplicate Email (409 Conflict)

```bash
curl -X POST http://localhost:8080/v2/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "email": "alice@example.com",
    "password": "TestPassword123",
    "name": "Alice Duplicate",
    "org_name": "Another Organization"
  }'
```

**Expected Response:**
```json
{
  "error": "Email already exists"
}
```

### Weak Password (400 Bad Request)

```bash
curl -X POST http://localhost:8080/v2/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "email": "bob@example.com",
    "password": "weak",
    "name": "Bob Test",
    "org_name": "Bob Org"
  }'
```

**Expected Response:**
```json
{
  "error": "Password must be at least 8 characters, Password must contain at least one uppercase letter, Password must contain at least one number"
}
```

### Invalid Login Credentials (401 Unauthorized)

```bash
curl -X POST http://localhost:8080/v2/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "alice@example.com",
    "password": "WrongPassword123"
  }'
```

**Expected Response:**
```json
{
  "error": "Invalid email or password"
}
```

### Non-existent Email (401 Unauthorized)

```bash
curl -X POST http://localhost:8080/v2/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "nonexistent@example.com",
    "password": "TestPassword123"
  }'
```

**Expected Response:**
```json
{
  "error": "Invalid email or password"
}
```

## Implementation Details

### Password Requirements

- Minimum 8 characters
- At least one uppercase letter (A-Z)
- At least one lowercase letter (a-z)
- At least one number (0-9)

### Password Hashing

Passwords are hashed using **Argon2id** via `Bun.password.hash()` with the following parameters:
- Algorithm: argon2id
- Memory cost: 65536 (64 MB)
- Time cost: 3

### JWT Token

- Signing algorithm: HS256
- Expiry: 15 minutes (configurable via `JWT_EXPIRES_IN`)
- Claims:
  - `iss`: https://metabob.com
  - `sub`: user ID
  - `org_id`: organization ID
  - `role`: user role (admin/member)
  - `user_id`: user ID (duplicate of sub for convenience)
  - `project_ids`: array of project IDs user has access to
  - `exp`: expiration timestamp
  - `iat`: issued at timestamp

### Atomic Transactions

Signup uses SurrealDB transactions to ensure atomicity:
1. Create organization
2. Create user with admin role
3. If either step fails, both are rolled back

This prevents orphaned organizations or users.

## Database Schema

### Users Table

```surql
DEFINE TABLE users SCHEMAFULL
  PERMISSIONS
    FOR select WHERE org_id = $auth.org_id
    FOR create WHERE $auth = NONE OR ($auth.role = 'admin' AND org_id = $auth.org_id)
    FOR update WHERE org_id = $auth.org_id AND ($auth.role = 'admin' OR id = $auth.id)
    FOR delete WHERE $auth.role = 'admin' AND org_id = $auth.org_id;

DEFINE FIELD org_id ON users TYPE string;
DEFINE FIELD email ON users TYPE string;
DEFINE FIELD name ON users TYPE string;
DEFINE FIELD password_hash ON users TYPE string;
DEFINE FIELD role ON users TYPE string;
DEFINE FIELD created_at ON users TYPE datetime;
DEFINE FIELD last_login ON users TYPE option<datetime>;

DEFINE INDEX idx_email ON users FIELDS email UNIQUE;
```

### Organizations Table

```surql
DEFINE TABLE organizations SCHEMAFULL
  PERMISSIONS
    FOR select WHERE $auth = NONE OR org_id = $auth.org_id
    FOR create WHERE $auth = NONE OR org_id = $auth.org_id
    FOR update WHERE $auth = NONE OR (org_id = $auth.org_id AND $auth.role IN ['admin', 'owner'])
    FOR delete WHERE $auth = NONE OR (org_id = $auth.org_id AND $auth.role = 'owner');

DEFINE FIELD org_id ON organizations TYPE string;
DEFINE FIELD name ON organizations TYPE string;
DEFINE FIELD subscription_tier ON organizations TYPE string;
DEFINE FIELD seat_limit ON organizations TYPE int;
DEFINE FIELD seat_usage ON organizations TYPE int;
DEFINE FIELD created_at ON organizations TYPE datetime;
DEFINE FIELD updated_at ON organizations TYPE datetime;

DEFINE INDEX idx_org_id ON organizations FIELDS org_id UNIQUE;
```

## Next Steps

After validating the endpoints locally:

1. **Push to dev branch** - CI/CD will automatically deploy to canary
2. **Test against canary** - Use `https://activity.metabob.com` for validation
3. **Frontend integration** - Update cloud dashboard to use these endpoints
4. **Production promotion** - After canary validation succeeds

## Troubleshooting

### Connection refused

Ensure SurrealDB is running and accessible at the configured URL.

### Schema errors

Apply schema migrations:
```bash
bun run apply-schema
```

Or manually via SurrealDB CLI:
```bash
surreal sql --endpoint http://localhost:8000 --namespace activity-system --database learning_loop --username root --password surrealdb-local-dev-123 < sql/schema/001-organizations.surql
surreal sql --endpoint http://localhost:8000 --namespace activity-system --database learning_loop --username root --password surrealdb-local-dev-123 < sql/schema/002-users.surql
```

### JWT verification failed

Ensure `JWT_SECRET` is consistent between signup/login and subsequent API calls.
