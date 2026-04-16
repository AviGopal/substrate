# Quick Start: Authentication Endpoints

## TL;DR

```bash
# Signup
curl -X POST http://localhost:8080/v2/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"email":"alice@example.com","password":"TestPassword123","name":"Alice","org_name":"Acme Corp"}'

# Login
curl -X POST http://localhost:8080/v2/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"alice@example.com","password":"TestPassword123"}'

# Use token
curl http://localhost:8080/v2/auth/me \
  -H "Authorization: Bearer <token>"
```

## Signup

**Endpoint**: `POST /v2/auth/signup`

**Request**:
```json
{
  "email": "alice@example.com",
  "password": "TestPassword123",
  "name": "Alice Test",
  "org_name": "Test Organization"
}
```

**Response (201)**:
```json
{
  "token": "eyJhbGc...",
  "user": {
    "id": "users:abc123",
    "org_id": "test_organization",
    "email": "alice@example.com",
    "name": "Alice Test",
    "role": "admin"
  },
  "org": {
    "id": "organizations:xyz",
    "org_id": "test_organization",
    "name": "Test Organization",
    "subscription_tier": "free"
  }
}
```

**Errors**:
- 400: Missing fields or weak password
- 409: Email already exists

## Login

**Endpoint**: `POST /v2/auth/login`

**Request**:
```json
{
  "email": "alice@example.com",
  "password": "TestPassword123"
}
```

**Response (200)**:
```json
{
  "token": "eyJhbGc...",
  "user": { ... },
  "org": { ... }
}
```

**Errors**:
- 400: Missing email or password
- 401: Invalid credentials

## Authenticated Requests

Add header to all authenticated requests:
```
Authorization: Bearer <token>
```

Example:
```bash
curl http://localhost:8080/v2/users \
  -H "Authorization: Bearer eyJhbGc..."
```

## Password Requirements

- Minimum 8 characters
- At least one uppercase letter (A-Z)
- At least one lowercase letter (a-z)
- At least one number (0-9)

Valid examples:
- ✅ `Password123`
- ✅ `Test1234`
- ✅ `MySecurePass1`

Invalid examples:
- ❌ `pass` (too short)
- ❌ `password` (no uppercase, no number)
- ❌ `PASSWORD123` (no lowercase)
- ❌ `Password` (no number)

## Token Expiry

Tokens expire after **15 minutes**. When a token expires:

1. Client receives 401 Unauthorized
2. User must login again to get new token
3. Refresh tokens not yet implemented (future work)

## Testing

```bash
# Run automated tests
./test-auth-endpoints.sh

# Start local server
bun run dev

# Check health
curl http://localhost:8080/health
```

See [TESTING.md](TESTING.md) for comprehensive testing guide.
