---
spec_id: user-authentication
spec_version: 1.0
created_at: 2026-04-15T10:00:00Z
status: active
category: feature
---

# OpenSpec: User Authentication

## Context

### Problem Statement
Users currently cannot authenticate to the system. All endpoints are public, creating security risks and preventing user-specific functionality.

### Goals
- Secure sensitive endpoints with authentication
- Enable user-specific data access
- Implement industry-standard password security

### Non-Goals
- OAuth integration (future work)
- Multi-factor authentication (future work)
- Social login providers (future work)

## Functional Requirements

- [ ] Create User model in `src/models/user.ts` with password hashing using bcrypt
- [ ] Add `POST /login` endpoint returning JWT token in `src/routes/auth.ts`
- [ ] Implement authentication middleware in `src/middleware/auth.ts` for protected routes
- [ ] Add password reset flow with email verification
- [ ] Create test suite in `test/auth.test.ts` with minimum 5 test cases

## Performance Requirements

### Cost
- Total implementation cost: < $0.50 (compilation + initial execution)
- Per-execution cost: < $0.10 (after template created)

### Duration
- Implementation time: < 10 minutes (template execution)
- Login endpoint response time: < 200ms (p95)
- Password hashing: < 100ms per operation

### Quality
- Test coverage: > 80% for authentication module
- Code complexity: Cyclomatic complexity < 10 per function
- Security: No plaintext passwords, no hardcoded secrets

## Validation Rules

### Required Files
- `src/models/user.ts` (User model with password hashing)
- `src/routes/auth.ts` (Authentication routes)
- `src/middleware/auth.ts` (Auth middleware)
- `test/auth.test.ts` (Test suite)
- `package.json` (must include bcrypt and jsonwebtoken dependencies)

### Required Patterns

**User Model (`src/models/user.ts`):**
- Must contain: `bcrypt`, `hashPassword`, `comparePassword`
- Must contain: `interface User` or `class User`
- Must contain: `email`, `password` (or passwordHash)

**Auth Routes (`src/routes/auth.ts`):**
- Must contain: `POST /login`, `router.post('/login'`
- Must contain: `jwt.sign` or `jsonwebtoken`
- Must contain: `comparePassword` or password verification

**Auth Middleware (`src/middleware/auth.ts`):**
- Must contain: `jwt.verify` or token verification
- Must contain: `req.user =` or similar user attachment
- Must contain: `401` or `403` status codes

**Tests (`test/auth.test.ts`):**
- Must contain: `describe('authentication'` or similar test suite
- Must contain: `expect(` or assertion statements
- Must contain at least 5 test cases (count `it(` or `test(`)

### Forbidden Patterns

**Security violations:**
- No plaintext passwords: forbid `password: string` stored directly
- No hardcoded secrets: forbid `secret = "`, `apiKey = "`
- No password logging: forbid `console.log(.*password)`

**Bad practices:**
- No weak hashing: forbid `md5`, `sha1` (for passwords)
- No token in URL: forbid `/login?token=`

### Commands to Run

```bash
# Install dependencies
npm install

# Run tests
npm test -- test/auth.test.ts
# Expected: All tests pass (exit code 0)

# Type checking
npm run typecheck
# Expected: No type errors (exit code 0)

# Linting
npm run lint src/models/user.ts src/routes/auth.ts
# Expected: No lint errors (exit code 0)

# Test login endpoint (requires server running)
curl -X POST http://localhost:8080/login \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com", "password": "testpass123"}'
# Expected: 200 OK or 401 Unauthorized (not 500 error)
```

## Drift Thresholds

### Functional Requirements
- Allowed drift: 0% (all requirements must be met)
- Missing files: 0 allowed
- Missing patterns: 0 allowed
- Failed commands: 0 allowed

### Performance Requirements
- Cost variance: ± 20% acceptable
- Duration variance: ± 10% acceptable
- Quality variance: ± 5% acceptable

### Validation Rules
- Test failures: 0 allowed (all tests must pass)
- Pattern matches: 100% required (no missing patterns)
- Command failures: 0 allowed

## Architecture Notes

### Technology Choices
- **bcrypt** for password hashing (industry standard, salt rounds = 10)
- **JWT** for session tokens (stateless authentication)
- **Express middleware** for route protection (standard pattern)

### Design Decisions
- Passwords hashed with 10 salt rounds (balances security vs performance)
- JWT expiry = 24 hours (reasonable session length)
- Refresh tokens not implemented in v1 (future enhancement)
- Email verification required for password reset (security)

### Security Considerations
- Never log passwords or tokens (even in debug mode)
- Rate limit login endpoint: 10 requests/minute per IP
- Validate JWT signature on every protected request
- Use HTTPS in production (enforce in middleware)
- Hash passwords before storing (never store plaintext)

## Examples

### Successful Login

**Request:**
```bash
curl -X POST http://localhost:8080/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "secret123"
  }'
```

**Response (200 OK):**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIxMjMiLCJlbWFpbCI6InVzZXJAZXhhbXBsZS5jb20iLCJpYXQiOjE2NDY4NTAwMDAsImV4cCI6MTY0NjkzNjQwMH0.abc123def456",
  "user": {
    "id": "123",
    "email": "user@example.com",
    "createdAt": "2024-03-10T10:00:00Z"
  }
}
```

### Failed Login (Invalid Credentials)

**Request:**
```bash
curl -X POST http://localhost:8080/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "wrongpassword"
  }'
```

**Response (401 Unauthorized):**
```json
{
  "error": "Invalid credentials",
  "message": "The email or password you entered is incorrect."
}
```

### Protected Route Access

**Request (with valid token):**
```bash
curl -X GET http://localhost:8080/api/profile \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

**Response (200 OK):**
```json
{
  "id": "123",
  "email": "user@example.com",
  "name": "John Doe",
  "createdAt": "2024-03-10T10:00:00Z"
}
```

**Request (without token):**
```bash
curl -X GET http://localhost:8080/api/profile
```

**Response (401 Unauthorized):**
```json
{
  "error": "Unauthorized",
  "message": "Authentication token required"
}
```

### Password Reset Flow

**1. Request Reset:**
```bash
curl -X POST http://localhost:8080/auth/reset-password-request \
  -H "Content-Type: application/json" \
  -d '{"email": "user@example.com"}'
```

**Response (200 OK):**
```json
{
  "message": "Password reset email sent"
}
```

**2. Reset with Token:**
```bash
curl -X POST http://localhost:8080/auth/reset-password \
  -H "Content-Type: application/json" \
  -d '{
    "token": "reset-token-abc123",
    "newPassword": "newsecret456"
  }'
```

**Response (200 OK):**
```json
{
  "message": "Password reset successful"
}
```

## Test Cases

### Minimum Test Coverage

1. **Test: Successful login with valid credentials**
   - Arrange: Create user with email/password
   - Act: POST /login with correct credentials
   - Assert: 200 OK, returns token and user object

2. **Test: Failed login with invalid password**
   - Arrange: Create user
   - Act: POST /login with wrong password
   - Assert: 401 Unauthorized, error message

3. **Test: Failed login with non-existent email**
   - Arrange: No user created
   - Act: POST /login with any credentials
   - Assert: 401 Unauthorized

4. **Test: Protected route access with valid token**
   - Arrange: Get valid JWT token
   - Act: GET /api/profile with Authorization header
   - Assert: 200 OK, returns user data

5. **Test: Protected route access without token**
   - Arrange: No token
   - Act: GET /api/profile without Authorization header
   - Assert: 401 Unauthorized

6. **Test: Password hashing**
   - Arrange: Create user with password
   - Act: Retrieve user from database
   - Assert: Password is hashed (not plaintext)

7. **Test: Password comparison**
   - Arrange: User with hashed password
   - Act: Compare correct password
   - Assert: Returns true
   - Act: Compare incorrect password
   - Assert: Returns false

## Dependencies

### Requires
- None (self-contained feature)

### Blocks
- `user-profile-management.md` (needs authentication first)
- `admin-dashboard.md` (needs authentication first)
- `api-rate-limiting.md` (needs user identification)

### Related
- `password-reset-flow.md` (enhancement to this spec)
- `oauth-integration.md` (alternative authentication)
- `session-management.md` (token refresh, logout)

---

## Validation Checklist

Before compiling this spec to an activity template:

- ✅ Metadata section with required fields (spec_id, version, status, category)
- ✅ Functional requirements (5 requirements, all testable)
- ✅ Performance requirements (cost, duration, quality thresholds)
- ✅ Validation rules (4 required files, 12 required patterns, 6 forbidden patterns, 5 commands)
- ✅ Drift thresholds (0% functional, ±20% cost, ±10% duration)
- ✅ Examples (successful login, failed login, protected route)
- ✅ Test cases (7 minimum tests specified)
- ✅ All requirements use objective language
- ✅ Thresholds include units and operators
- ✅ No subjective requirements

**This spec is ready for compilation.**
