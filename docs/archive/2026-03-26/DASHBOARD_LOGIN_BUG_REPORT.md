# Dashboard Login E2E Testing - Bug Report

## Date: 2026-03-12
## Session: Playwright Dashboard Testing

## Summary
Dashboard login functionality is **BLOCKED** due to a critical database configuration issue and potential SurrealDB client bug.

## Bug Details

### Issue 1: Database Configuration Mismatch (FIXED)
**Status**: ✅ FIXED  
**Severity**: HIGH  
**Component**: RPC API Helm Configuration

**Problem**:
- RPC API was configured with `database: default`
- Should be using `database: metabob` to match the application namespace

**Fix Applied**:
```yaml
# File: repos/platform/metabob-apps/charts/metabob-rpc-api/values/default.metabob-rpc-api.values.yaml
surrealdb:
  database: metabob  # Changed from: default
```

**Deployment**:
- Redeployed via Helmfile
- Revision: 34
- Pod Status: Running with correct database config

---

### Issue 2: User Query Returns Empty Results (ACTIVE)
**Status**: 🔴 BLOCKING  
**Severity**: CRITICAL  
**Component**: SurrealDB Python Client / RPC API Auth Flow

**Problem**:
1. User registration succeeds (HTTP 200 OK)
2. User data appears to be inserted into SurrealDB
3. Immediate login attempt fails with "Invalid email or password"
4. Query for user by email returns 0 results

**Evidence from Logs**:
```json
{
  "timestamp": "2026-03-12 13:02:24",
  "stage": "REGISTRATION",
  "database": "metabob",
  "status": "200 OK"
}

{
  "timestamp": "2026-03-12 13:02:28",
  "stage": "DB_QUERY_USER_COMPLETE",
  "query": "SELECT * FROM users WHERE email = $email AND is_active = true",
  "result_count": 0,
  "result_type": "list",
  "result_structure": "[]"
}
```

**Test Credentials**:
- Email: `final-test@example.com`
- Password: `TestPassword123!`
- Expected: Login succeeds
- Actual: 401 Unauthorized - "Invalid email or password"

**Hypotheses**:

1. **Transaction/Consistency Issue (MOST LIKELY)**:
   - `db.insert()` might be async/eventually consistent
   - Query happens before write is committed
   - HTTP protocol might not guarantee immediate consistency

2. **Schema Definition Missing**:
   - SurrealDB might require explicit table/field definitions
   - Insert succeeds but data isn't queryable without schema

3. **Query Parameter Binding Issue**:
   - `$email` parameter might not be properly bound
   - Could be a client library bug with HTTP protocol

4. **Namespace/Database Switching Issue**:
   - `db.use()` might not be persistent across operations
   - Insert goes to one DB, query goes to another

## Investigation Steps Taken

1. ✅ Verified database configuration in Helm values
2. ✅ Confirmed pod is using correct database (`metabob`)
3. ✅ Verified registration request format matches schema
4. ✅ Tested login with correct credentials
5. ✅ Checked RPC API logs for errors
6. ✅ Analyzed query result structure
7. ❌ Unable to directly query SurrealDB due to CLI auth issues

## Recommended Next Steps

### Immediate (Debug)
1. Add debug logging before/after `db.insert()` to capture operation result
2. Add a delay between registration and login (test consistency hypothesis)
3. Query all users (`SELECT * FROM users`) to verify table isn't empty
4. Check if SurrealDB requires explicit schema definition for `users` table

### Short-term (Fix)
1. Consider adding retry logic to login with exponential backoff
2. Implement eventual consistency handling (wait for write to propagate)
3. Add schema initialization on app startup
4. Switch from HTTP to WebSocket protocol if HTTP has consistency issues

### Long-term (Architectural)
1. Add comprehensive E2E test suite for auth flow
2. Implement database health checks in deployment
3. Add monitoring/alerting for auth failures
4. Consider using a more mature database client or switching protocols

## Workaround

**None available**. Login functionality is completely broken.

Users cannot:
- ❌ Log into the dashboard
- ❌ Access authenticated endpoints
- ❌ Test E2E workflows

## Impact

**CRITICAL** - Complete blocker for:
- Dashboard E2E testing
- User acceptance testing
- Demo/presentation scenarios
- CLI integration (Gap 1) testing

## Files Modified This Session

```
repos/platform/metabob-apps/charts/metabob-rpc-api/values/default.metabob-rpc-api.values.yaml
  - Changed database from 'default' to 'metabob'
  - Deployed to revision 34
```

## Test Results

### API Endpoints (Direct)
- ✅ POST `/auth/register` - 200 OK (creates user successfully)
- ❌ POST `/auth/login` - 401 Unauthorized (cannot find user)
- ✅ GET `/auth/orgs/{org_id}/projects/{id}` - 200 OK (from previous session)

### Dashboard UI (Playwright)
- ✅ Page loads correctly
- ✅ Login form renders
- ❌ Login submission fails with 401
- ❌ Cannot access authenticated areas

## Next Session TODO

1. **Debug SurrealDB Write**:
   ```python
   # Add logging in cloud_auth.py register function
   result = await db.insert("users", user_data)
   logger.info(f"Insert result: {result}")
   
   # Immediately query to verify
   verify = await db.query("SELECT * FROM users WHERE user_id = $user_id", {"user_id": user_id})
   logger.info(f"Verification query: {verify}")
   ```

2. **Test Consistency Delay**:
   ```bash
   # Register user
   curl -X POST .../register -d '{...}'
   
   # Wait 5 seconds
   sleep 5
   
   # Try login
   curl -X POST .../login -d '{...}'
   ```

3. **Check Schema**:
   - Review SurrealDB schema definitions
   - Verify table structure matches expectations
   - Add schema migration if needed

4. **Alternative Auth Method**:
   - Consider JWT token from registration response
   - Use token directly instead of login flow
   - Bypass login for testing if needed

## Related Documentation

- Previous session summary: `FINAL_SESSION_SUMMARY.md`
- E2E success report: `E2E_COMPLETE_SUCCESS.md` 
- Playwright test results: `PLAYWRIGHT_DASHBOARD_TEST_RESULTS.md`

## Contact

For questions about this bug:
- Check RPC API logs: `kubectl logs -n metabob deployment/metabob-rpc-api`
- Check SurrealDB logs: `kubectl logs -n metabob statefulset/surrealdb`
- Review auth code: `repos/metabob-rpc-api/server/routes/cloud_auth.py`

---

**Last Updated**: 2026-03-12 13:05 PST  
**Status**: Investigation ongoing, fix pending
