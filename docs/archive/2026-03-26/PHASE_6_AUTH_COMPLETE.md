# Phase 6: MiniBob Authentication - COMPLETE

**Date:** 2026-03-24  
**Status:** ✅ All tests passing  
**Environment:** Kubernetes (activity-system namespace)

## Summary

Successfully implemented and validated SurrealDB multi-tenant authentication schemas for MiniBob instances.

## Schemas Applied

### 1. Access Definitions

**JWT External Access:**
```surql
DEFINE ACCESS jwt_external ON DATABASE TYPE JWT
  ALGORITHM HS256 KEY 'your-secret-key-min-32-chars-long-12345'
  WITH ISSUER KEY 'your-secret-key-min-32-chars-long-12345'
  DURATION FOR TOKEN 15m, FOR SESSION 24h;
```

**MiniBob RECORD Access:**
```surql
DEFINE ACCESS minibob_record ON DATABASE TYPE RECORD
  SIGNIN (
    SELECT * FROM minibob_instance 
    WHERE instance_id = $instance_id 
    AND crypto::argon2::compare(api_key_hash, $api_key)
  )
  DURATION FOR TOKEN 24h, FOR SESSION 72h;
```

### 2. Tables Created

**Organizations Table:**
- `name`: string
- `created_at`: datetime (auto)
- `updated_at`: datetime (auto)
- Permissions: Org-scoped access control

**MiniBob Instance Table:**
- `instance_id`: string (unique index)
- `org_id`: record<organizations>
- `project_id`: optional record<projects>
- `api_key_hash`: argon2 hashed string
- `vessel_id`: string
- `is_active`: boolean
- `created_at`: datetime (auto)
- `last_active_at`: datetime

### 3. Default Data

**Organization:**
- ID: `organizations:metabob_internal`
- Name: "Metabob Internal"

**MiniBob Instance:**
- Instance ID: `minibob-local-001`
- Org: `organizations:metabob_internal`
- Vessel ID: `minibob-cli-local`
- API Key: `test-api-key-123` (hashed with argon2)

## Test Results

### Authentication Flow

1. **Signin Request:**
   ```bash
   POST /v2/auth/minibob/signin
   {
     "instance_id": "minibob-local-001",
     "api_key": "test-api-key-123"
   }
   ```

2. **JWT Token Response:**
   ```json
   {
     "token": {
       "access": "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzUxMiJ9..."
     },
     "org_id": "metabob_internal"
   }
   ```

3. **Token Payload:**
   ```json
   {
     "iat": 1774421069,
     "nbf": 1774421069,
     "exp": 1774507469,
     "iss": "SurrealDB",
     "NS": "activity-system",
     "DB": "learning_loop",
     "AC": "minibob_record",
     "ID": "minibob_instance:r0r71n5hkxu1d2763y9x"
   }
   ```

### Test Suite Results

```
✅ Test 1: SurrealDB connection
✅ Test 2: Organizations table
✅ Test 3: MiniBob instances table
✅ Test 4: MiniBob signin
✅ Test 5: Token structure validation
✅ Test 6: SurrealDB access definitions
✅ Test 7: Invalid credentials test
```

## Key Features

### Security
- Argon2 password hashing for API keys
- JWT-based authentication (HS512 algorithm)
- 24-hour token expiration
- 72-hour session duration
- Row-level security with permissions

### Multi-Tenancy
- Organization-level isolation
- Per-instance authentication
- Project-level scoping (optional)
- Org-scoped data access

### Access Control
- RECORD access type for instance authentication
- JWT access for external integrations
- Automatic token generation via SIGNIN
- Permissions enforced at database level

## API Endpoints

### MiniBob Authentication

**POST** `/v2/auth/minibob/signin`
- Authenticate MiniBob instance
- Returns JWT access token
- Returns organization ID

**POST** `/v2/auth/minibob/verify`
- Verify JWT token validity
- Returns instance details if valid

## Database Structure

```
activity-system (namespace)
└── learning_loop (database)
    ├── organizations
    │   └── metabob_internal
    ├── minibob_instance
    │   └── r0r71n5hkxu1d2763y9x
    └── access definitions
        ├── jwt_external
        └── minibob_record
```

## Testing

Run the Phase 6 test suite:

```bash
# Ensure port-forwards are active
kubectl port-forward -n activity-system svc/surrealdb 8000:8000 &
kubectl port-forward -n activity-system svc/metabob-activity-api 8080:8080 &

# Run tests
./test-phase6-auth.sh
```

## Next Steps

1. **Phase 7:** Integrate authentication with MiniBob CLI
2. **Phase 8:** Add project-level scoping
3. **Phase 9:** Implement API key rotation
4. **Phase 10:** Add audit logging for authentication events

## Files Modified

- `/repos/metabob-activity-api/src/routes/auth.ts` - Authentication endpoints
- `/repos/metabob-activity-api/src/middleware/auth.ts` - Auth middleware
- SurrealDB schemas applied directly via SQL

## Notes

- API routes work correctly when accessed via port-forward (localhost:8080)
- Istio routing to api.minibob.local needs configuration for production
- Current setup suitable for local development and testing
- Production deployment will need ingress/gateway configuration

## Success Criteria Met

✅ SurrealDB schemas applied without errors  
✅ Organizations table created and populated  
✅ MiniBob instances table created and populated  
✅ Authentication endpoint returns valid JWT tokens  
✅ Token verification works correctly  
✅ Invalid credentials are properly rejected  
✅ Access definitions configured and functional  
✅ Test suite passes all 7 tests
