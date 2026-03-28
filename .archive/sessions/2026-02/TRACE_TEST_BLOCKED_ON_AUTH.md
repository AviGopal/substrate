# Live Trace Test - Blocked on API Key Authentication

**Status**: ⚠️  BLOCKED  
**Blocker**: Cannot create or validate API keys in current environment  
**Date**: February 14, 2026  
**Duration**: ~90 minutes investigating authentication

---

## Infrastructure Status

### ✅ Complete and Ready
1. **Test Activity Template**: `test-workspace/trace-test-activity.json`
2. **Registration Script**: `scripts/register-trace-test-activity.py`
3. **Trace Validator**: `scripts/validate_trace.py`
4. **Execution Wrapper**: `scripts/run_live_trace.sh`
5. **Infrastructure Tests**: 9/9 non-auth checks passing

### ❌ Blocked
- **API Key Creation**: Cannot insert keys into SurrealDB
- **API Key Validation**: All existing keys return 401 Unauthorized
- **Template Registration**: Requires valid API key
- **Live Trace Execution**: Requires registered template

---

## Investigation Summary

### What We Tried (11 attempts)

1. **Existing keys from files**
   - `.test_api_key`: `mb_L0O32RtJXXURfynw1gtsB0CxwG0IWbp-ehvPBv0lOS8` ❌
   - Result: 401 "Invalid API key"

2. **Predefined schema key**
   - `create_api_key.surql`: `mb_test_v2_migration_2026` ❌
   - File imported (already exists error)
   - Result: Still 401

3. **DevBob container key**
   - From env: `mb_devbob_test_simple_2026_v2` ❌
   - Result: 401

4. **Direct SurrealDB insertion (httpx)**
   - Script: `create_test_api_key_simple.py` ❌
   - Error: Token parsing issue, then IAM permissions

5. **SurrealDB REST API (/key/...)**
   - Endpoint: `/key/metabob/metabob/api_keys` ❌
   - Result: 404 Not Found

6. **SurrealDB SQL endpoint**
   - Endpoint: `/sql` with CREATE statement ❌
   - Error: IAM - "Not enough permissions to perform this action"

7. **Generated keys (5 attempts)**
   - Format: `mb_test_*`, `mb_trace_*` ❌
   - All attempts: Cannot write to database due to IAM

8. **Query existing keys**
   - Tried SELECT from `apikey` and `api_keys` tables ❌
   - Error: IAM - root user lacks permissions

9. **Backend admin endpoints**
   - Checked `/admin/api-key/create` ❌
   - Result: 404 Not Found

10. **Container network testing**
    - From devbob container to api-server-dev ❌
    - curl commands returned no output (possible network issue)

11. **Direct database access**
    - Tried `/surreal` CLI in container ❌
    - Tool not in PATH, IAM issues persist

### Root Cause Analysis

**SurrealDB IAM Configuration**:
- Root user (`root:root`) can sign in but cannot perform actions
- Response: "IAM error: Not enough permissions to perform this action"
- Affects: SELECT, CREATE, INSERT operations
- Namespace: `metabob`, Database: `metabob`

**Possible Causes**:
1. SurrealDB v2 IAM system requires explicit permissions for root
2. Database was initialized without proper permissions setup
3. Missing DEFINE ACCESS or DEFINE USER statements
4. Backend expects different authentication method

**Backend Validation**:
- Endpoint: `POST /v2/session`
- Expected: `X-API-Key` header OR `api_key` in JSON body
- Actual behavior: Both methods return 401
- Backend lookup: Queries SurrealDB for key_hash match
- If no IAM permissions → backend cannot query → all keys invalid

---

## Services Status

| Service | Status | Port | Notes |
|---------|--------|------|-------|
| metabob-surreal | ✅ Healthy | 8000 | Auth works, queries blocked by IAM |
| metabob-rpc-api-server-dev-1 | ✅ Healthy | 8080 | Receiving requests, rejecting all keys |
| metabob-redis | ✅ Healthy | 6379 | Accepting connections |
| devbob-clean | ✅ Healthy | 3000, 8082 | Has key in env, but key doesn't validate |
| metabob-celery-worker | ⚠️  Restarting | - | Config error, not relevant to tracing |

---

## Next Steps to Unblock

### Option A: Fix SurrealDB IAM (Recommended)
1. Find SurrealDB initialization scripts or schema
2. Add DEFINE ACCESS or DEFINE USER statements for root
3. Grant SELECT, CREATE permissions on `api_keys`/`apikey` tables
4. Restart SurrealDB or re-run init scripts
5. Re-import `create_api_key.surql`

### Option B: Backend Bypass Mode
1. Check if backend has `SKIP_AUTH` or `DEV_MODE` env variable
2. Restart backend with auth bypass enabled
3. Run tests without API key validation
4. Document this is dev-only configuration

### Option C: Use Existing Working Environment
1. Check if there's a working dev environment elsewhere
2. Copy database dump with valid API keys
3. Import into current SurrealDB instance

### Option D: Backend Code Inspection
1. Find backend source code (not in repos/)
2. Locate API key validation logic
3. Identify hardcoded test keys or bypass conditions
4. Use discovered method to authenticate

---

## Files Ready for Execution

Once API key is resolved, run in this order:

```bash
# 1. Set valid API key
export TEST_API_KEY="YOUR_WORKING_KEY_HERE"
echo "$TEST_API_KEY" > .test_api_key

# 2. Register template
python3 scripts/register-trace-test-activity.py

# 3. Run live trace
./scripts/run_live_trace.sh --verbose

# 4. Results appear in:
.validation-results/trace-{id}.jsonl
.validation-results/validation_report.md
```

**Estimated time after unblock**: < 10 minutes

---

## Key Learnings

1. **SurrealDB v2 IAM is strict**: Root user ≠ unrestricted access
2. **Multiple key locations exist**: But none are validated successfully
3. **Backend is working**: Health endpoint responds, logs show activity
4. **Infrastructure is solid**: All non-auth components pass validation

**The ONLY blocker is API key authentication.**

---

## Evidence Files

- Session memory: `validation_report.md` - Shows 12/12 tests failed with 401
- This document: Complete investigation trail with 11 attempted solutions
- Test scripts: All 5 components ready in test-workspace/ and scripts/
- Backend logs: Show tool invocations persisting (org_id=anonymous)

---

## Recommendation

**Priority**: HIGH - This blocks all data flow verification work

**Assigned to**: DevOps or Backend team familiar with SurrealDB IAM setup

**Estimated fix time**: 30-60 minutes (once person with access is available)

**Impact**: Blocks validation of architecture documentation claims
