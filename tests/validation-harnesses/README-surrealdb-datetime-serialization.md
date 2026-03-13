# Validation Harness: SurrealDB Datetime Serialization for API Key Creation

## Purpose

This validation harness tests the fix for the critical datetime serialization bug that prevented API keys from persisting in SurrealDB, breaking the entire GAP-9 multi-tenant learning loop.

**Bug Fixed**: `api_key_ops.py:76-77` passed raw `datetime.utcnow()` objects to `db.query()` instead of `.isoformat()` strings.

**Impact**: Unblocked CLI-to-dashboard data flow and multi-tenant activity tracking.

## Test Scenario

End-to-end validation of:
1. User registration
2. API key creation via dashboard endpoint
3. CLI authentication with API key
4. Activity execution posting
5. Dashboard display of CLI-generated data
6. Direct database verification of API key persistence with ISO timestamps

## Prerequisites

- RPC API deployed and running
- SurrealDB accessible
- Port-forward configured: `kubectl port-forward -n metabob svc/metabob-rpc-api 8080:8080`

## Running the Harness

### Option 1: Direct execution
```bash
cd tests/validation-harnesses
npx ts-node surrealdb-datetime-serialization-api-key-creation-harness.ts
```

### Option 2: With custom RPC API URL
```bash
RPC_API_URL=http://custom-host:8080 npx ts-node surrealdb-datetime-serialization-api-key-creation-harness.ts
```

### Option 3: With custom timeout
```bash
TIMEOUT=120000 npx ts-node surrealdb-datetime-serialization-api-key-creation-harness.ts
```

## Expected Output (Success)

```
=== SurrealDB Datetime Serialization Validation ===

RPC API URL: http://localhost:8080
Timeout: 60000ms

[1/5] Registering new user...
✓ User registered: validation_1710337000@metabob.com
✓ Org ID: org_abc123

[2/5] Creating API key...
✓ API Key created: mb_xxxxxxxxxxxxxxxxxxxxxxxx...

[3/5] Posting activity execution with API key...
✓ Execution recorded: exec_xyz789

[4/5] Querying dashboard endpoint...
✓ Dashboard returns 1 activity(ies)

[5/5] Verifying API key in SurrealDB...
✓ API key found in database with valid ISO timestamps

✅ VALIDATION PASSED
   - API key created with correct format
   - API key persisted in database
   - Timestamps properly serialized to ISO format
   - CLI authentication succeeded
   - org_id extracted from API key
   - Dashboard displays activity
   - GAP-9 multi-tenant learning loop COMPLETE

=== VALIDATION RESULT ===
{
  "pass": true,
  "actual": {
    "apiKeyCreated": true,
    "apiKeyFormat": "mb_",
    "executionId": "exec_xyz789",
    "activityCount": 1,
    "apiKeyInDatabase": true,
    "timestampsValid": true,
    "orgIdExtracted": true
  },
  "expected": {
    "apiKeyCreated": true,
    "apiKeyFormat": "starts with 'mb_'",
    "executionId": "non-empty string",
    "activityCount": "> 0",
    "apiKeyInDatabase": true,
    "timestampsValid": true,
    "orgIdExtracted": true
  },
  "errors": [],
  "testCase": "SurrealDB datetime serialization for API key creation"
}

Exit code: 0
```

## Expected Output (Failure - Bug Not Fixed)

```
=== SurrealDB Datetime Serialization Validation ===

[1/5] Registering new user...
✓ User registered: validation_1710337000@metabob.com
✓ Org ID: org_abc123

[2/5] Creating API key...
✓ API Key created: mb_xxxxxxxxxxxxxxxxxxxxxxxx...

[3/5] Posting activity execution with API key...
✗ Activity execution failed with status 401

[4/5] Querying dashboard endpoint...
✗ Dashboard returned 0 activities - API key authentication or org_id linkage failed

[5/5] Verifying API key in SurrealDB...
✗ API key not found in database - datetime serialization bug still present

❌ VALIDATION FAILED
   Errors: 3
   1. Activity execution failed with status 401
   2. Dashboard returned 0 activities - API key authentication or org_id linkage failed
   3. API key not found in database - datetime serialization bug still present

Exit code: 1
```

## Test Cases

### Case 1: Happy Path - API Key Creation with CLI Authentication
**Impulse ID**: `validation-surrealdb-datetime-serialization-api-key-creation-case-1`

**Input**:
```json
{
  "rpcApiUrl": "http://localhost:8080",
  "timeout": 60000
}
```

**Expected Output**:
- API key created: ✅
- API key format starts with 'mb_': ✅
- Execution ID returned: ✅
- Activity count > 0: ✅
- API key in database: ✅
- Timestamps valid (ISO format): ✅
- org_id extracted: ✅

## Validation Criteria

| Criterion | Expected | Validates |
|-----------|----------|-----------|
| API key creation | Returns 201 with key starting with 'mb_' | API key generation works |
| API key persistence | Key exists in SurrealDB with ISO timestamps | datetime serialization fixed |
| CLI authentication | POST execution returns 200 with execution_id | get_api_key_by_key() succeeds |
| org_id extraction | execution_id returned (not 401) | Tenant isolation works |
| Dashboard display | GET activity returns count > 0 | CLI-to-dashboard flow complete |
| Timestamp format | created_at/updated_at match ISO 8601 regex | .isoformat() applied |

## Related Specifications

- **GAP-9**: Multi-tenant learning loop
- **CLI-to-dashboard data flow**: Activity execution from CLI visible in dashboard
- **API key authentication for CLI**: Bearer token authentication with org_id extraction

## Related Files

- **Trace impulse**: `impulses/trace-surrealdb-datetime-serialization-api-key-creation.json`
- **Enforcement impulse**: `impulses/enforcement-surrealdb-datetime-serialization-api-key-creation.json`
- **Test case impulse**: `impulses/validation-surrealdb-datetime-serialization-api-key-creation-case-1.json`
- **Harness impulse**: `impulses/harness-surrealdb-datetime-serialization-api-key-creation.json`
- **Fixed file**: `repos/metabob-rpc-api/server/db/operations/api_key_ops.py` (lines 76-77)

## Troubleshooting

### Validation fails with "Connection refused"
- Ensure RPC API is deployed and running
- Check port-forward: `kubectl port-forward -n metabob svc/metabob-rpc-api 8080:8080`
- Verify RPC API health: `curl http://localhost:8080/health`

### Validation fails with "API key not found in database"
- The datetime serialization bug is NOT fixed
- Check `api_key_ops.py:76-77` - should use `.isoformat()`
- Rebuild and redeploy RPC API: `make docker-rpc-api && helmfile -e metabob apply`

### Validation fails with "Dashboard returned 0 activities"
- API key authentication may be working but org_id linkage is broken
- Check RPC API logs: `kubectl logs -n metabob deployment/metabob-rpc-api | grep "org_id"`
- Verify `learning_loop.py` extracts org_id from API key

### Admin endpoint not available for direct DB query
- Harness falls back to indirect verification
- If execution_id is returned AND activity_count > 0, persistence is confirmed
- Direct DB verification is optional, not required for pass/fail

## Integration with CI/CD

### Pre-deployment test
```bash
# Run validation before merging PR
npm run test:validation:surrealdb-datetime

# Exit code 0 = pass, 1 = fail
```

### Post-deployment verification
```bash
# Run after helm deployment
helmfile -e metabob apply
sleep 10
kubectl port-forward -n metabob svc/metabob-rpc-api 8080:8080 &
sleep 5
npx ts-node tests/validation-harnesses/surrealdb-datetime-serialization-api-key-creation-harness.ts
```

### Continuous validation
```bash
# Run every 5 minutes to detect regressions
watch -n 300 'npx ts-node tests/validation-harnesses/surrealdb-datetime-serialization-api-key-creation-harness.ts'
```

## Historical Context

This harness validates the fix for issue GAP-9, which blocked the entire multi-tenant learning loop. The bug was discovered when:

1. Dashboard users created API keys
2. Keys appeared to be created (response returned)
3. CLI authentication failed (keys not in database)
4. Dashboard showed 0 activities (orphaned records excluded)

The root cause was `api_key_ops.py` passing raw Python `datetime` objects to SurrealDB's `db.query()`, which failed silently because the HTTP client couldn't serialize them.

The fix was simple but critical: add `.isoformat()` to convert datetime to ISO 8601 strings before passing to `db.query()`.

**Before**:
```python
"created_at": datetime.utcnow(),
"updated_at": datetime.utcnow(),
```

**After**:
```python
"created_at": datetime.utcnow().isoformat(),
"updated_at": datetime.utcnow().isoformat(),
```

This 2-line change unblocked:
- CLI authentication
- Multi-tenant activity tracking
- Dashboard activity display
- GAP-9 specification completion
