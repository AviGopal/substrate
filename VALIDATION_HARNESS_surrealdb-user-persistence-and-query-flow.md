# Validation Harness: surrealdb-user-persistence-and-query-flow

## Overview

This validation harness provides comprehensive E2E testing for the SurrealDB user persistence and query flow specification. It validates that users registered via the API are properly persisted with schema enforcement, queryable by email field, and can successfully authenticate.

## Harness File

`tests/validation-harnesses/surrealdb-user-persistence-and-query-flow-harness.ts`

## Test Flow

### 1. Schema Verification
- Query SurrealDB for table schema using `INFO FOR TABLE users`
- Verify `SCHEMAFULL` definition exists
- Confirm `email` index with `UNIQUE` constraint
- Confirm `user_id` index with `UNIQUE` constraint

### 2. User Registration
- Generate unique test credentials (timestamped email)
- POST to `/auth/register` with email, password, name, org_name
- Expect HTTP 200 OK with JWT token
- Capture user_id and org_id from response

### 3. Database Record Verification
- Query SurrealDB directly: `SELECT * FROM users WHERE user_id = "$user_id"`
- Verify record exists with correct data
- Confirm all required fields are present

### 4. Email Index Test
- Query by email: `SELECT * FROM users WHERE email = "$email"`
- Verify query returns exactly one result
- Confirms email index is functional

### 5. Login Authentication
- POST to `/auth/login` with registered credentials
- Expect HTTP 200 OK (not 401 Unauthorized)
- Verify JWT token in response
- This is the CRITICAL test that was failing before the fix

### 6. Project Relationship Test
- Create project using authenticated token
- POST to `/auth/orgs/{org_id}/projects`
- Verify project creation succeeds
- Tests hierarchical relationships (user → org → projects)

### 7. Persistence Test (Pod Restart)
- Restart RPC API deployment: `kubectl rollout restart`
- Wait for pod to be ready
- Ensures no in-memory-only behavior

### 8. Persistence Verification
- Re-query user by email after restart
- Verify data still exists in SurrealDB
- Confirms data persists across application restarts

## Test Cases

### Case 1: Happy Path E2E Flow
**Input**:
```json
{
  "apiBaseUrl": "http://api.metabob.local",
  "namespace": "metabob",
  "database": "metabob",
  "surrealdbPod": "surrealdb-<pod-id>",
  "rpcApiDeployment": "metabob-rpc-api"
}
```

**Expected Output**:
```json
{
  "schemaApplied": true,
  "registrationSuccess": true,
  "recordExists": true,
  "emailIndexWorks": true,
  "loginSuccess": true,
  "projectCreated": true,
  "persistsAcrossRestart": true
}
```

**Result**: PASS if all steps succeed

### Case 2: Schema Validation
**Purpose**: Verify database schema requirements are met

**Checks**:
- DEFINE TABLE users SCHEMAFULL
- DEFINE INDEX email_idx ON users FIELDS email UNIQUE
- DEFINE INDEX user_id_idx ON users FIELDS user_id UNIQUE

**Expected**: All schema elements present

### Case 3: Login After Registration
**Purpose**: Reproduce and validate fix for critical blocker

**Steps**:
1. Register user (expect 200 OK)
2. Immediately login with same credentials (expect 200 OK, not 401)

**Before Fix**: Step 2 returned 401 "Invalid email or password"
**After Fix**: Step 2 returns 200 OK with JWT token

## Running the Harness

### Prerequisites
- Kubernetes cluster with metabob namespace
- SurrealDB running with proper schema
- RPC API deployment with SQL INSERT fix applied
- kubectl configured for cluster access

### Execute

```bash
# Set environment variables (optional)
export API_BASE_URL="http://api.metabob.local"
export K8S_NAMESPACE="metabob"
export SURREALDB_DATABASE="metabob"

# Run harness
cd /home/avi/documents/work/exp-repo/metabob-devbob
npx ts-node tests/validation-harnesses/surrealdb-user-persistence-and-query-flow-harness.ts
```

### Expected Output

```
Starting validation harness for surrealdb-user-persistence-and-query-flow
Configuration: { apiBaseUrl: 'http://api.metabob.local', ... }

Step 1: Verifying SurrealDB schema...
Step 2: Registering test user...
Step 3: Verifying user record in database...
Step 4: Testing email index...
Step 5: Testing login...
Step 6: Creating project to test relationships...
Step 7: Restarting RPC API pod to test persistence...
Step 8: Verifying data persists after restart...

=== Validation Results ===
Overall: PASS ✅
Duration: 45678ms

Step Details:
  ✅ verify_schema: Schema validation: email_idx=true, user_id_idx=true
  ✅ register_user: Registration succeeded: HTTP 200
  ✅ verify_record_exists: User record found in database
  ✅ test_email_index: Email index works: query by email returned results
  ✅ login: Login succeeded: HTTP 200
  ✅ create_project: Project created: HTTP 200
  ✅ restart_pod: Pod restart completed
  ✅ verify_persistence: Data persisted across restart

Expected vs Actual:
Expected: { schemaApplied: true, registrationSuccess: true, ... }
Actual: { schemaApplied: true, registrationSuccess: true, ... }
```

## Failure Scenarios

### Schema Not Applied
**Symptom**: `verify_schema` step fails
**Cause**: Schema SQL not executed against database
**Fix**: Run `scripts/init-surrealdb-devbob-schema-v2.sql`

### Login Returns 401
**Symptom**: `login` step fails with "Invalid email or password"
**Cause**: SQL INSERT fix not deployed
**Fix**: Deploy RPC API with commit d61fa57 or later

### Record Not Found
**Symptom**: `verify_record_exists` or `test_email_index` fails
**Cause**: db.insert() bug or missing indexes
**Fix**: Apply SQL INSERT fix and verify schema

### Pod Restart Timeout
**Symptom**: `restart_pod` step fails with timeout
**Cause**: Deployment issues or resource constraints
**Fix**: Check pod logs and k8s events

## Related Documentation

- `TRACE_surrealdb-user-persistence-and-query-flow.md` - Root cause analysis
- `ENFORCEMENT_surrealdb-user-persistence-and-query-flow.md` - Fix implementation
- `scripts/init-surrealdb-devbob-schema-v2.sql` - Database schema

## Maintenance

### Updating Test Cases
Modify the `runValidation()` function in the harness file to add new test steps.

### Adding New Checks
1. Add step in `runValidation()` with try-catch block
2. Push result to `details` array
3. Update `ExpectedOutput` interface if needed
4. Document in this file

### Continuous Validation
Integrate into CI/CD pipeline:
```yaml
- name: Validate SurrealDB Persistence
  run: |
    npx ts-node tests/validation-harnesses/surrealdb-user-persistence-and-query-flow-harness.ts
  continue-on-error: false
```

---

**Created**: 2026-03-12
**Last Updated**: 2026-03-12
**Status**: Active
**Pass Rate**: TBD (awaiting deployment)
