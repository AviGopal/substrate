## ADDED Requirements

### Requirement: List API keys for user
The system SHALL return all API keys owned by the authenticated user with secret masked.

#### Scenario: User lists their API keys
- **WHEN** user calls GET /v1/api-keys
- **THEN** system returns keys filtered by user_id = $auth.user_id with secret masked showing only prefix

#### Scenario: Admin lists all org API keys
- **WHEN** admin calls GET /v1/api-keys?org_scope=true
- **THEN** system returns all API keys for org_id = $auth.org_id

### Requirement: Create API key with tier-based defaults
The system SHALL allow users to create API keys with tier determining connection and token limits.

#### Scenario: User creates starter tier key
- **WHEN** user calls POST /v1/api-keys with tier = 'starter'
- **THEN** system creates key with max_connections = 1, tokens_per_month = 1000000

#### Scenario: User creates pro tier key
- **WHEN** user calls POST /v1/api-keys with tier = 'pro'
- **THEN** system creates key with max_connections = 5, tokens_per_month = 10000000

#### Scenario: User creates enterprise tier key
- **WHEN** user calls POST /v1/api-keys with tier = 'enterprise'
- **THEN** system creates key with max_connections = custom, tokens_per_month = custom (from admin input)

#### Scenario: Key creation returns secret once
- **WHEN** user creates API key
- **THEN** system returns full secret in response but never stores plaintext (only hash stored)

### Requirement: Revoke API key
The system SHALL allow users to revoke their own API keys and admins to revoke any org keys.

#### Scenario: User revokes own key
- **WHEN** user calls DELETE /v1/api-keys/:id for key where user_id = $auth.user_id
- **THEN** system sets status = 'revoked', closes all active connections

#### Scenario: Admin revokes any org key
- **WHEN** admin calls DELETE /v1/api-keys/:id for key in their organization
- **THEN** system sets status = 'revoked' if org_id = $auth.org_id

#### Scenario: User attempts to revoke another user's key
- **WHEN** member (non-admin) calls DELETE /v1/api-keys/:id for key owned by different user
- **THEN** system returns 403 Forbidden due to PERMISSIONS clause

### Requirement: Update API key limits
The system SHALL allow admin users to modify connection and token limits for existing keys.

#### Scenario: Admin increases connection limit
- **WHEN** admin calls PATCH /v1/api-keys/:id with max_connections = 10
- **THEN** system updates max_connections for that key

#### Scenario: Non-admin attempts limit update
- **WHEN** member calls PATCH /v1/api-keys/:id
- **THEN** system returns 403 Forbidden (only admins can modify limits)

### Requirement: Track API key usage
The system SHALL record usage count and last used timestamp on each authenticated request.

#### Scenario: API key used for request
- **WHEN** request authenticates with API key
- **THEN** system increments usage_count and updates last_used_at timestamp

#### Scenario: Token budget tracked
- **WHEN** LLM request completes with token usage
- **THEN** system increments llm_budget.tokens_used for that API key

### Requirement: API key authentication
The system SHALL validate API keys against stored hash and check status before allowing access.

#### Scenario: Valid active API key
- **WHEN** request includes valid API key with status = 'active'
- **THEN** system authenticates request and populates $auth context

#### Scenario: Revoked API key
- **WHEN** request includes API key with status = 'revoked'
- **THEN** system returns 401 Unauthorized with message "API key revoked"

#### Scenario: Invalid API key format
- **WHEN** request includes malformed API key
- **THEN** system returns 401 Unauthorized with message "Invalid API key"
