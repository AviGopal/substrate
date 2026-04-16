## ADDED Requirements

### Requirement: Backend-to-vessel API key authentication
The system SHALL authenticate backend-to-vessel requests using API keys in the Authorization header.

#### Scenario: Successful authentication with valid API key
- **WHEN** Activity-API sends request to vessel with "Authorization: ApiKey <valid-key>" header
- **THEN** vessel validates API key via identity service
- **THEN** vessel extracts org_id from identity response
- **THEN** vessel populates request context with {org_id, user_id, key_id}
- **THEN** vessel allows access to requested resource

#### Scenario: Authentication with invalid API key
- **WHEN** backend sends request with invalid or expired API key
- **THEN** vessel returns 401 Unauthorized
- **THEN** vessel includes WWW-Authenticate header "ApiKey realm=vessel"
- **THEN** vessel does NOT process request

#### Scenario: Authentication with missing authorization header
- **WHEN** backend sends request without Authorization header
- **THEN** vessel returns 401 Unauthorized
- **THEN** vessel includes WWW-Authenticate header "ApiKey realm=vessel"

#### Scenario: Identity service unavailable fallback
- **WHEN** vessel cannot reach identity service for validation
- **THEN** vessel falls back to direct SurrealDB api_key table lookup
- **THEN** vessel validates key exists and is not revoked
- **THEN** vessel extracts org_id from api_key record
- **THEN** vessel allows request to proceed with degraded mode flag

### Requirement: Vessel-to-vessel mTLS authentication
The system SHALL authenticate vessel-to-vessel requests using mutual TLS with client certificates.

#### Scenario: Successful mTLS handshake between vessels
- **WHEN** MiniBob vessel initiates HTTPS connection to Analysis-API vessel
- **THEN** Analysis-API vessel requests client certificate
- **THEN** MiniBob presents its vessel client certificate
- **THEN** Analysis-API verifies certificate against vessel CA
- **THEN** Analysis-API extracts vessel_id from certificate CN field
- **THEN** connection is established securely

#### Scenario: Missing client certificate
- **WHEN** vessel connects without presenting client certificate
- **THEN** server vessel rejects TLS handshake
- **THEN** connection fails with TLS error
- **THEN** client receives connection refused error

#### Scenario: Invalid or expired client certificate
- **WHEN** vessel presents expired or invalid certificate
- **THEN** server vessel rejects TLS handshake
- **THEN** connection fails with certificate validation error
- **THEN** incident is logged with certificate details

#### Scenario: Certificate from untrusted CA
- **WHEN** vessel presents certificate not signed by vessel CA
- **THEN** server vessel rejects TLS handshake
- **THEN** connection fails with untrusted CA error

### Requirement: Dual-role authentication for vessels

Some vessels (like Analysis-API) accept requests from both other vessels (vessel-to-vessel) and from the backend (backend-to-vessel). These vessels SHALL support dual authentication patterns.

#### Scenario: Analysis-API accepts vessel-to-vessel requests with mTLS + API key
- **WHEN** MiniBob sends request to Analysis-API at `https://analysis.metabob.com/v2/impulses/resolve`
- **THEN** Analysis-API SHALL validate mTLS client certificate
- **AND** Analysis-API SHALL validate `Authorization: ApiKey <key>` header
- **AND** both authentication layers must succeed
- **AND** org_id extracted from API key is used for multi-tenant isolation

#### Scenario: Analysis-API accepts backend routing requests with API key only
- **WHEN** Activity-API sends routed request to Analysis-API at internal service mesh URL
- **THEN** Analysis-API SHALL validate `Authorization: ApiKey <key>` header only
- **AND** mTLS is NOT required (internal service mesh traffic)
- **AND** org_id extracted from API key is used for multi-tenant isolation
- **AND** request processing is identical to vessel-to-vessel path

#### Scenario: Authentication mode detection
- **WHEN** Analysis-API receives incoming request
- **THEN** Analysis-API SHALL detect if connection uses TLS with client certificate
- **AND** if client certificate present, SHALL validate certificate and API key
- **AND** if no client certificate, SHALL validate API key only
- **AND** SHALL NOT reject requests lacking mTLS from trusted internal sources

### Requirement: Vessel-to-vessel API key authentication
The system SHALL require API key in addition to mTLS for vessel-to-vessel requests.

#### Scenario: Successful vessel-to-vessel request with mTLS and API key
- **WHEN** MiniBob vessel connects to Analysis-API with valid mTLS certificate
- **THEN** MiniBob includes "Authorization: ApiKey <key>" header
- **THEN** Analysis-API validates API key via identity service
- **THEN** Analysis-API extracts org_id from API key
- **THEN** Analysis-API verifies vessel_id from certificate matches key ownership
- **THEN** Analysis-API allows request to proceed

#### Scenario: Valid mTLS but missing API key
- **WHEN** vessel connects with valid certificate but no API key header
- **THEN** server vessel returns 401 Unauthorized
- **THEN** server vessel logs authentication attempt with vessel_id
- **THEN** request is rejected

#### Scenario: Valid mTLS but invalid API key
- **WHEN** vessel connects with valid certificate but invalid API key
- **THEN** server vessel validates certificate successfully
- **THEN** server vessel rejects API key validation
- **THEN** server vessel returns 401 Unauthorized
- **THEN** server vessel logs failed API key validation with vessel_id

#### Scenario: API key org_id mismatch with certificate
- **WHEN** vessel presents certificate for vessel_A but API key for org_B
- **THEN** server vessel detects org_id mismatch
- **THEN** server vessel returns 403 Forbidden
- **THEN** server vessel logs potential security incident

### Requirement: API key format and structure
The system SHALL use consistent API key format across all authentication contexts.

#### Scenario: API key generation for vessel
- **WHEN** identity service generates new API key for vessel
- **THEN** key format is "mb_" + base64url(random(32 bytes))
- **THEN** key is cryptographically random (minimum 256 bits entropy)
- **THEN** key is stored hashed with Argon2id in database
- **THEN** key is returned to caller ONLY ONCE at creation time

#### Scenario: API key validation
- **WHEN** vessel receives request with API key
- **THEN** vessel extracts key from "Authorization: ApiKey <key>" header
- **THEN** vessel validates key format matches "mb_[A-Za-z0-9_-]{43}"
- **THEN** vessel sends key to identity service for validation
- **THEN** vessel receives {valid: boolean, org_id, user_id, key_id, scopes}

#### Scenario: Malformed API key
- **WHEN** request includes API key not matching expected format
- **THEN** vessel returns 401 Unauthorized immediately
- **THEN** vessel does NOT query identity service
- **THEN** vessel logs malformed key attempt

### Requirement: Token lifetime and refresh
The system SHALL enforce API key expiration and support key rotation.

#### Scenario: API key with no expiration
- **WHEN** API key is created without explicit expiration
- **THEN** key remains valid until explicitly revoked
- **THEN** identity service validates key on every request
- **THEN** key_id is included in all audit logs

#### Scenario: API key with configured expiration
- **WHEN** API key is created with expires_at timestamp
- **THEN** identity service validates key is not expired
- **THEN** identity service returns 401 for expired keys
- **THEN** vessel must request new key from identity service

#### Scenario: API key rotation
- **WHEN** vessel rotates API key before expiration
- **THEN** identity service generates new key with same scopes
- **THEN** identity service marks old key as superseded (not revoked)
- **THEN** old key remains valid for 24 hours (grace period)
- **THEN** after grace period, old key is rejected

#### Scenario: Immediate key revocation
- **WHEN** API key is explicitly revoked via identity service
- **THEN** key is marked revoked_at = now() in database
- **THEN** all subsequent requests with key return 401 Unauthorized
- **THEN** no grace period applies (immediate invalidation)

### Requirement: Multi-tenant org_id injection from authentication
The system SHALL automatically inject org_id into request context from authenticated credentials.

#### Scenario: org_id injection from API key authentication
- **WHEN** vessel validates API key successfully
- **THEN** vessel receives org_id from identity service response
- **THEN** vessel populates request context with ctx.auth.org_id
- **THEN** vessel does NOT allow application code to override org_id
- **THEN** all database queries automatically filter by org_id

#### Scenario: org_id injection from mTLS certificate
- **WHEN** vessel validates client certificate
- **THEN** vessel extracts vessel_id from certificate CN
- **THEN** vessel looks up vessel record in database
- **THEN** vessel reads org_id from vessel.org_id field
- **THEN** vessel populates request context with ctx.auth.org_id

#### Scenario: org_id injection for combined mTLS + API key
- **WHEN** vessel validates both certificate and API key
- **THEN** vessel extracts org_id from API key (primary source)
- **THEN** vessel extracts org_id from vessel record (secondary)
- **THEN** vessel verifies both org_ids match
- **THEN** vessel populates ctx.auth.org_id with verified value
- **THEN** vessel rejects request if org_ids do not match

#### Scenario: Database query automatic filtering
- **WHEN** application code queries activity_template table
- **THEN** SurrealDB PERMISSIONS clause enforces "WHERE org_id = $auth.org_id"
- **THEN** query returns ONLY records matching ctx.auth.org_id
- **THEN** application code does NOT need to add org_id filter manually

### Requirement: Authorization header standardization
The system SHALL use consistent Authorization header format across all vessel communication.

#### Scenario: Standard API key header format
- **WHEN** vessel sends authenticated request with API key
- **THEN** vessel includes header "Authorization: ApiKey <key>"
- **THEN** vessel does NOT use "Bearer" scheme for API keys
- **THEN** header format matches exactly "ApiKey <key>" (case-sensitive)

#### Scenario: JWT token header format (dashboard users)
- **WHEN** dashboard client sends authenticated request
- **THEN** client includes header "Authorization: Bearer <jwt-token>"
- **THEN** vessel validates JWT signature and expiration
- **THEN** vessel extracts {userId, orgId, role} from JWT claims
- **THEN** vessel populates ctx.auth with JWT claims

#### Scenario: Malformed authorization header
- **WHEN** request includes "Authorization: <key>" without scheme
- **THEN** vessel returns 401 Unauthorized
- **THEN** vessel includes error message "Invalid authorization header format"
- **THEN** vessel logs malformed header attempt

#### Scenario: Multiple authorization headers
- **WHEN** request includes multiple Authorization headers
- **THEN** vessel rejects request with 400 Bad Request
- **THEN** vessel returns error "Multiple authorization headers not allowed"

#### Scenario: Authorization header with extra whitespace
- **WHEN** request includes "Authorization:  ApiKey  <key>" with extra spaces
- **THEN** vessel normalizes whitespace during parsing
- **THEN** vessel extracts scheme "ApiKey" and credential "<key>"
- **THEN** vessel validates credential normally

### Requirement: Authentication failure logging and audit
The system SHALL log all authentication attempts and failures for security audit.

#### Scenario: Successful authentication logging
- **WHEN** vessel successfully authenticates request with API key
- **THEN** vessel logs {timestamp, vessel_id, org_id, key_id, endpoint, status=200}
- **THEN** vessel includes request_id for tracing
- **THEN** log level is INFO

#### Scenario: Failed authentication logging
- **WHEN** vessel rejects request due to invalid credentials
- **THEN** vessel logs {timestamp, vessel_id, org_id, key_id, reason, status=401}
- **THEN** vessel includes attempted credential type (api_key, jwt, mtls)
- **THEN** log level is WARN
- **THEN** vessel does NOT log actual credential value (security)

#### Scenario: Security incident logging
- **WHEN** vessel detects org_id mismatch or suspicious pattern
- **THEN** vessel logs {timestamp, incident_type, details, ip_address, vessel_id}
- **THEN** log level is ERROR
- **THEN** vessel increments security_incidents metric
- **THEN** vessel triggers alert if threshold exceeded

#### Scenario: Audit trail query
- **WHEN** admin queries authentication logs for org
- **THEN** system filters logs by org_id automatically
- **THEN** system returns {timestamp, vessel_id, key_id, endpoint, status, ip_address}
- **THEN** system does NOT expose keys or passwords
- **THEN** system supports pagination and date range filters

### Requirement: Circuit breaker for identity service
The system SHALL implement circuit breaker pattern for identity service calls with fallback.

#### Scenario: Identity service healthy
- **WHEN** vessel validates API key via identity service
- **THEN** circuit breaker is in CLOSED state
- **THEN** vessel sends request to identity service
- **THEN** vessel receives response within timeout (500ms)
- **THEN** vessel processes response normally

#### Scenario: Identity service degraded
- **WHEN** identity service response time exceeds threshold (3 consecutive 500ms+ responses)
- **THEN** circuit breaker transitions to OPEN state
- **THEN** vessel immediately falls back to SurrealDB validation
- **THEN** vessel logs circuit breaker state change
- **THEN** vessel does NOT attempt identity service calls for 60 seconds

#### Scenario: Identity service recovery
- **WHEN** circuit breaker is OPEN for 60 seconds
- **THEN** circuit breaker transitions to HALF_OPEN state
- **THEN** vessel sends single test request to identity service
- **THEN** if test succeeds, circuit breaker transitions to CLOSED
- **THEN** if test fails, circuit breaker returns to OPEN for another 60 seconds

#### Scenario: Identity service unavailable
- **WHEN** identity service returns connection refused or timeout
- **THEN** circuit breaker increments failure count
- **THEN** vessel falls back to SurrealDB validation
- **THEN** vessel logs fallback mode with reason
- **THEN** vessel continues serving requests (degraded mode)

### Requirement: Protocol version validation

After successful authentication, vessels SHALL validate X-Protocol-Version header to ensure compatibility.

#### Scenario: Protocol version mismatch
- **WHEN** authenticated vessel sends request with `X-Protocol-Version: 1.0`
- **AND** receiving vessel only supports version 2.0
- **THEN** vessel SHALL return 400 Bad Request
- **AND** error message SHALL indicate supported versions:
  ```json
  {
    "loaded": false,
    "error": {
      "code": "UNSUPPORTED_PROTOCOL_VERSION",
      "message": "Protocol version 1.0 not supported",
      "details": {
        "requested_version": "1.0",
        "supported_versions": ["2.0"]
      }
    }
  }
  ```

#### Scenario: Compatible protocol version
- **WHEN** vessel sends request with `X-Protocol-Version: 2.0`
- **AND** receiving vessel supports version 2.0
- **THEN** vessel SHALL process request normally
- **AND** response SHALL include `X-Protocol-Version: 2.0` header

#### Scenario: Missing protocol version header
- **WHEN** vessel sends request without `X-Protocol-Version` header
- **THEN** receiving vessel SHALL default to version 2.0
- **AND** SHALL log warning about missing version header
- **AND** SHALL process request (backward compatibility)

### Requirement: Rate limiting for authentication endpoints
The system SHALL enforce rate limits on authentication endpoints to prevent abuse.

#### Scenario: Normal authentication rate
- **WHEN** vessel receives 10 auth requests per second from single IP
- **THEN** vessel processes all requests normally
- **THEN** rate limit counter increments
- **THEN** requests complete successfully

#### Scenario: Excessive authentication attempts
- **WHEN** vessel receives 100 auth requests per second from single IP
- **THEN** vessel returns 429 Too Many Requests after threshold
- **THEN** vessel includes Retry-After header with seconds until reset
- **THEN** vessel logs rate limit violation with IP and key_id

#### Scenario: Distributed brute force detection
- **WHEN** multiple IPs attempt authentication with same key_id at high rate
- **THEN** vessel aggregates attempts by key_id across IPs
- **THEN** vessel triggers security alert if threshold exceeded
- **THEN** vessel temporarily blocks key_id (5 minutes)
- **THEN** vessel notifies org admin of suspicious activity

#### Scenario: Rate limit reset
- **WHEN** rate limit window expires (1 minute)
- **THEN** vessel resets counter for IP/key_id
- **THEN** vessel allows new requests normally
- **THEN** vessel logs rate limit reset event
