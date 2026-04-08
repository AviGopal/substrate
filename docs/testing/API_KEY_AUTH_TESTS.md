# API Key Authentication End-to-End Tests

## Overview

This document describes the comprehensive test suite for the API-key-only authentication flow across MiniBob, identity-vessel, and activity-api.

## Test Architecture

```
┌─────────────────┐
│    MiniBob      │
│  Config Tests   │
└────────┬────────┘
         │ Loads API key from config
         │ Validates config structure
         ▼
┌─────────────────┐
│ Identity Vessel │
│  Validation     │──────► Redis (revocation check)
│     Tests       │
└────────┬────────┘
         │ Validates HMAC signature
         │ Returns org_id, user_id, scopes
         ▼
┌─────────────────┐
│  Activity API   │
│   Auth Tests    │──────► SurrealDB (RBAC enforcement)
│                 │
└─────────────────┘
```

## Test Files

### 1. MiniBob Config & Authentication
**File**: `repos/minibob/test/auth-e2e.test.ts`

Tests MiniBob's ability to load and use API keys for authentication.

#### Test Suites

**1.1 Config Loading with API Key**
- ✅ Load config with `metabob.apiKey` from user config
- ✅ Extract `org_id` from config (when provided)
- ✅ Handle missing API key error gracefully
- ✅ Support environment variable override

**1.2 MCP Client API Key Authentication**
- ✅ Initialize MCP client with API key
- ✅ Authenticate and get `org_id` from API key validation
- ✅ Handle invalid API key error
- ✅ Handle revoked API key error
- ✅ Handle network timeout gracefully

**1.3 Activity API Integration**
- ✅ Create activity template with API key authentication
- ✅ Retrieve template with API key authentication
- ✅ List templates with API key authentication

**1.4 Multi-Tenant Isolation**
- ✅ Isolate templates by `org_id`
- ✅ Enforce RBAC permissions at database level

**1.5 Error Handling**
- ✅ Handle missing API key gracefully
- ✅ Handle invalid API key format
- ✅ Handle expired API key
- ✅ Fallback to embedded templates when backend unavailable

**1.6 Full E2E Flow**
- ✅ Config → Auth → Template Creation → Retrieval

### 2. Identity Vessel API Key Validation
**File**: `repos/identity-vessel/test/api-key-validation.test.ts`

Tests the canonical API key validation endpoint that all services use.

#### Test Suites

**2.1 Valid API Key Validation**
- ✅ Validate correct API key format
- ✅ Validate HMAC signature
- ✅ Extract metadata from API key
- ✅ Handle scopes (defaults to read/write)

**2.2 Invalid API Key Format**
- ✅ Reject empty API key
- ✅ Reject malformed API key
- ✅ Reject API key with wrong prefix
- ✅ Reject API key with invalid base64
- ✅ Reject API key with truncated data

**2.3 Invalid HMAC Signature**
- ✅ Reject API key with tampered payload
- ✅ Reject API key with wrong HMAC

**2.4 Revoked API Key**
- ✅ Detect revoked API key (via Redis)
- ✅ Allow non-revoked API key
- ✅ Handle Redis connection errors gracefully

**2.5 Response Structure**
- ✅ Return correct structure for valid key
- ✅ Return correct structure for invalid key
- ✅ Include detailed error messages

**2.6 org_id, user_id, scopes Extraction**
- ✅ Extract `org_id` correctly
- ✅ Extract `user_id` correctly
- ✅ Handle various `org_id` formats
- ✅ Preserve scopes in key generation

**2.7 Edge Cases**
- ✅ Handle very long `org_id`
- ✅ Handle special characters in `org_id`
- ✅ Handle Unicode in `org_id`
- ✅ Handle API key with extra whitespace
- ✅ Handle case-sensitive prefix check

**2.8 Performance**
- ✅ Validate keys quickly (< 10ms)
- ✅ Reject invalid keys quickly (< 5ms)

**2.9 Integration Endpoint Tests**
- ✅ POST /v1/keys/validate - valid key
- ✅ POST /v1/keys/validate - invalid key

### 3. Activity API Authentication Middleware
**File**: `repos/metabob-activity-api/test/api-key-auth.test.ts`

Tests the activity-api authentication middleware that accepts both JWT and API keys.

#### Test Suites

**3.1 API Key Header Extraction**
- ✅ Accept `Authorization: ApiKey <key>` header
- ✅ Accept `Authorization: Bearer <jwt>` header
- ✅ Handle missing Authorization header
- ✅ Reject malformed Authorization header

**3.2 API Key Validation via Identity Vessel**
- ✅ Validate API key with identity-vessel
- ✅ Reject invalid API key
- ✅ Use direct SurrealDB fallback when identity-vessel unavailable

**3.3 JWT Token Generation from API Key**
- ✅ Generate JWT token for validated API key
- ✅ Include `org_id` in JWT claims
- ✅ Set 15-minute expiry on generated JWT

**3.4 org_id Extraction and Context Setting**
- ✅ Extract `org_id` from validated API key
- ✅ Set `jwtAuth` context for downstream handlers
- ✅ Set `authType` to "apikey" for API key auth

**3.5 Multi-Tenant Isolation**
- ✅ Enforce `org_id` isolation at database level
- ✅ Use SurrealDB PERMISSIONS for isolation
- ✅ Prevent cross-org template access

**3.6 Error Handling**
- ✅ Handle missing API key gracefully
- ✅ Handle expired API key
- ✅ Handle revoked API key
- ✅ Handle identity-vessel connection failure
- ✅ Return 401 for invalid API key format
- ✅ Return 401 for invalid HMAC signature
- ✅ Log authentication method for debugging

**3.7 Integration Tests**
- ✅ Allow template creation with API key
- ✅ Allow template retrieval with API key
- ✅ Allow execution trace storage with API key

## Running the Tests

### Prerequisites

1. **Environment Variables**:
   ```bash
   export METABOB_API_KEY_ORG_A="your-api-key-org-a"
   export METABOB_API_KEY_ORG_B="your-api-key-org-b"  # Optional
   export ACTIVITY_API_ENDPOINT="http://activity.metabob.local"
   export IDENTITY_API_ENDPOINT="http://identity.metabob.local"
   ```

2. **Services Running**:
   - Identity vessel (for validation endpoint tests)
   - Activity API (for integration tests)
   - Redis (for revocation tests)
   - SurrealDB (for RBAC tests)

### Run All Tests

```bash
./test-api-key-auth.sh
```

This script runs all three test suites sequentially and provides a summary.

### Run Individual Test Suites

**MiniBob tests:**
```bash
cd repos/minibob
bun test test/auth-e2e.test.ts
```

**Identity vessel tests:**
```bash
cd repos/identity-vessel
bun test test/api-key-validation.test.ts
```

**Activity API tests:**
```bash
cd repos/metabob-activity-api
bun test test/api-key-auth.test.ts
```

### Run Specific Tests

```bash
# MiniBob config loading only
cd repos/minibob
bun test test/auth-e2e.test.ts -t "Config Loading"

# Identity vessel HMAC validation only
cd repos/identity-vessel
bun test test/api-key-validation.test.ts -t "HMAC"

# Activity API isolation tests only
cd repos/metabob-activity-api
bun test test/api-key-auth.test.ts -t "Multi-Tenant"
```

## Test Coverage

### Integration Points Tested

1. **MiniBob → Identity Vessel**
   - API key validation request
   - org_id extraction from validation response

2. **MiniBob → Activity API**
   - Authenticated template creation
   - Authenticated template retrieval
   - Authenticated trace storage

3. **Activity API → Identity Vessel**
   - API key validation via `/v1/keys/validate`
   - Fallback to direct SurrealDB validation

4. **Activity API → SurrealDB**
   - RBAC enforcement via PERMISSIONS clauses
   - Multi-tenant isolation via `org_id`

### Authentication Flow Coverage

```
┌─────────────────────────────────────────────────────────────┐
│                   Full E2E Flow                             │
└─────────────────────────────────────────────────────────────┘

1. Config Loading
   ✓ Load ~/.metabob/config.json
   ✓ Extract metabob.apiKey
   ✓ Extract metabob.endpoint

2. MCP Client Initialization
   ✓ Create MCPClient with directApiKey
   ✓ Set authentication headers

3. API Key Validation (via identity-vessel)
   ✓ POST /v1/keys/validate { api_key }
   ✓ Validate HMAC signature
   ✓ Check Redis for revocation
   ✓ Return { valid, org_id, user_id, scopes }

4. JWT Generation (activity-api middleware)
   ✓ Receive validated API key metadata
   ✓ Generate JWT with org_id claim
   ✓ Set 15-minute expiry
   ✓ Set jwtAuth context

5. Database Query (SurrealDB)
   ✓ Use JWT token for authentication
   ✓ Extract $auth.org_id from token
   ✓ Apply WHERE org_id = $auth.org_id
   ✓ Return only org-scoped data

6. Response
   ✓ Return filtered results to client
```

## Expected Behavior

### Success Cases

1. **Valid API key**: Returns org-scoped data
2. **Multiple orgs**: Each sees only their own data
3. **Missing key**: Falls back gracefully (embedded templates)
4. **Backend down**: Offline mode with local templates

### Error Cases

1. **Invalid format**: 401 Unauthorized, clear error message
2. **Wrong HMAC**: 401 Unauthorized, signature validation failed
3. **Revoked key**: 401 Unauthorized, key has been revoked
4. **Expired key**: 401 Unauthorized, key has expired
5. **Missing org**: 401 Unauthorized, no org membership

## Security Considerations

### What Is Tested

✅ HMAC signature validation (tampering prevention)
✅ Revocation checking (key invalidation)
✅ Multi-tenant isolation (no cross-org access)
✅ Database-level RBAC (PERMISSIONS enforcement)
✅ JWT expiry (15 minutes)

### What Is NOT Tested

❌ Rate limiting (separate concern)
❌ IP whitelisting (not implemented)
❌ API key rotation (manual process)
❌ Audit logging (separate system)

## Troubleshooting

### Tests Fail with "Identity vessel not reachable"

**Cause**: Identity vessel not running or wrong endpoint

**Solutions**:
1. Check `IDENTITY_API_ENDPOINT` environment variable
2. Verify identity vessel is running: `curl http://identity.metabob.local/health`
3. Check network/DNS resolution

### Tests Fail with "Redis not available"

**Cause**: Redis connection failure

**Solutions**:
1. Start Redis: `docker run -d -p 6379:6379 redis:7`
2. Check Redis connection: `redis-cli ping`
3. Verify `REDIS_URL` in identity-vessel config

### Tests Fail with "API key validation failed"

**Cause**: Invalid or incorrectly configured API key

**Solutions**:
1. Verify `METABOB_API_KEY_ORG_A` is set correctly
2. Check key format: Should start with `mb_live_` or `mb_test_`
3. Ensure key hasn't been revoked
4. Verify key belongs to the expected org

### Tests Skip with Warning Messages

**Cause**: Optional dependencies or test data not available

**Solutions**:
- This is normal - tests skip gracefully when optional features unavailable
- Check warning messages for specific missing requirements
- Tests will pass even with warnings

## Continuous Integration

These tests are designed to run in CI/CD pipelines:

```yaml
# Example GitHub Actions workflow
- name: Run API Key Auth Tests
  env:
    METABOB_API_KEY_ORG_A: ${{ secrets.METABOB_API_KEY_ORG_A }}
    METABOB_API_KEY_ORG_B: ${{ secrets.METABOB_API_KEY_ORG_B }}
    ACTIVITY_API_ENDPOINT: https://activity.metabob.com
    IDENTITY_API_ENDPOINT: https://identity.metabob.com
  run: |
    ./test-api-key-auth.sh
```

## Test Maintenance

### Adding New Tests

1. Identify the component to test (MiniBob, identity-vessel, or activity-api)
2. Add test to appropriate test file
3. Follow existing test structure and naming conventions
4. Update this documentation with new test coverage

### Updating Tests

When authentication flow changes:
1. Update affected test suites
2. Run full test suite to verify no regressions
3. Update documentation to reflect changes

## References

- [API Key Generation](../architecture/API_KEY_GENERATION.md)
- [Authentication Flow](../architecture/AUTHENTICATION_FLOW.md)
- [Multi-Tenant Architecture](../MULTI_TENANT_ARCHITECTURE.md)
- [RBAC Guide](../RBAC_GUIDE.md)
