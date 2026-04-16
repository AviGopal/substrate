## ADDED Requirements

### Requirement: User signup endpoint
The system SHALL provide a POST /v2/auth/signup endpoint that creates a new user and organization atomically.

#### Scenario: Successful signup with organization creation
- **WHEN** client posts {email, password, name, org_name} to /v2/auth/signup
- **THEN** system creates new organization with auto-generated org_id slug
- **THEN** system creates new user with hashed password (Argon2id)
- **THEN** system assigns user as organization admin (role="admin")
- **THEN** system returns JWT token (15-minute expiry) and user profile

#### Scenario: Signup with duplicate email
- **WHEN** client posts email that already exists in database
- **THEN** system returns 409 Conflict error
- **THEN** system does NOT create organization or user

#### Scenario: Signup with invalid password
- **WHEN** client posts password shorter than 8 characters or missing uppercase/lowercase/number
- **THEN** system returns 400 Bad Request with validation error
- **THEN** system does NOT create organization or user

#### Scenario: Partial failure rollback
- **WHEN** organization creation succeeds but user creation fails
- **THEN** system rolls back organization record (atomic transaction)
- **THEN** system returns 500 Internal Server Error

### Requirement: User login endpoint
The system SHALL provide a POST /v2/auth/login endpoint that authenticates users and returns JWT tokens.

#### Scenario: Successful login with valid credentials
- **WHEN** client posts {email, password} to /v2/auth/login
- **THEN** system looks up user by email
- **THEN** system verifies password with Bun.password.verify()
- **THEN** system generates JWT token signed with config secret
- **THEN** system returns {token, user} with user profile

#### Scenario: Login with incorrect password
- **WHEN** client posts valid email but incorrect password
- **THEN** system returns 401 Unauthorized
- **THEN** system does NOT return token or user profile

#### Scenario: Login with non-existent email
- **WHEN** client posts email that does not exist in database
- **THEN** system returns 401 Unauthorized
- **THEN** system does NOT reveal whether email exists (security)

### Requirement: JWT token validation
The system SHALL validate JWT tokens on authenticated endpoints and enforce expiration.

#### Scenario: Valid unexpired token
- **WHEN** client includes valid JWT token in Authorization header
- **THEN** system decodes token and extracts {userId, orgId, role}
- **THEN** system allows access to authenticated endpoint
- **THEN** system populates $auth context with user claims

#### Scenario: Expired token
- **WHEN** client includes expired JWT token (> 15 minutes old)
- **THEN** system returns 401 Unauthorized
- **THEN** system requires user to login again

#### Scenario: Invalid token signature
- **WHEN** client includes token with tampered signature
- **THEN** system returns 401 Unauthorized
- **THEN** system does NOT grant access

### Requirement: Password security
The system SHALL hash passwords using Argon2id via Bun.password before storing.

#### Scenario: Password hashing on signup
- **WHEN** user signs up with password "TestPassword123!"
- **THEN** system hashes password with Bun.password.hash()
- **THEN** system stores ONLY hashed password (never plaintext)
- **THEN** database contains Argon2id hash starting with "$argon2id$"

#### Scenario: Password verification on login
- **WHEN** user logs in with correct password
- **THEN** system uses Bun.password.verify(plaintextPassword, hashedPassword)
- **THEN** system returns true for matching password
- **THEN** system generates token and allows login
