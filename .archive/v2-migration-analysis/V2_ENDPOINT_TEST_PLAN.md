# Metabob-CLI V2 Endpoint Migration - Test Plan

**Date**: February 8, 2026  
**Status**: Ready for Testing  
**Objective**: Verify that metabob-cli correctly uses v2 endpoints and properly reflects intent in the database

## Overview

The metabob-cli has been migrated from the old `activity-recommendations` API to the clean v2 REST API. This test plan verifies:

1. ✅ All v2 endpoints are functional
2. ✅ Database records are created correctly for each operation
3. ✅ metabob-opencode can execute activities with the new CLI build
4. ✅ Bearer authentication works (no X-Internal-Request headers)

## Test Architecture

```
┌─────────────────┐
│ metabob-opencode│  (User agent)
└────────┬────────┘
         │ Uses search_activities, activity tools
         ▼
┌─────────────────┐
│  metabob-cli    │  (MCP Server)
│  (activity_     │  Uses v2 endpoints:
│   manager.py)   │  - POST /v2/session
└────────┬────────┘  - GET /v2/activities/templates
         │           - POST /v2/activities/record/*
         ▼
┌─────────────────┐
│ metabob-rpc-api │  (Backend API)
│  /v2/* routes   │  - Creates DB records
└────────┬────────┘  - Thompson Sampling (internal)
         │           - A/B testing (internal)
         ▼
┌─────────────────┐
│   SurrealDB     │  (Database)
│  - sessions     │  Records:
│  - activity_    │  - Session tokens
│    variants     │  - Templates
│  - impressions  │  - Impressions
│  - conversions  │  - Conversions
└─────────────────┘
```

## V2 Endpoints to Test

### 1. Session Management
- **POST /v2/session** - Create authenticated session
  - Auth: X-API-Key header
  - Returns: session_token (Bearer token)
  - DB: Creates `session` record

### 2. Template Management
- **GET /v2/activities/templates** - List templates
  - Auth: Bearer token
  - DB: Reads from `activity_variant` table
  
- **GET /v2/activities/templates/{id}** - Get template details
  - Auth: Bearer token
  - DB: Reads single `activity_variant` record
  
- **POST /v2/activities/templates** - Create template
  - Auth: Bearer token
  - DB: Creates `activity_variant` record
  
- **PUT /v2/activities/templates/{id}** - Update template
  - Auth: Bearer token
  - DB: Updates `activity_variant` record
  
- **DELETE /v2/activities/templates/{id}** - Soft delete template
  - Auth: Bearer token
  - DB: Sets `deprecated: true` on `activity_variant`

### 3. Template Mutations
- **POST /v2/activities/mutate/derive** - Derive new template from parent
  - Auth: Bearer token
  - DB: Creates `activity_variant` with `parent_id`
  
- **GET /v2/activities/mutate/lineage/{id}** - Get template lineage
  - Auth: Bearer token
  - DB: Traverses parent-child relationships

### 4. Execution Tracking
- **POST /v2/activities/record/start** - Start execution
  - Auth: Bearer token
  - DB: Creates `impression` and `selection` records
  - Returns: impression_id
  
- **POST /v2/activities/record/step** - Record step completion
  - Auth: Bearer token
  - DB: Updates execution metrics
  
- **POST /v2/activities/record/complete** - Complete execution
  - Auth: Bearer token
  - DB: Creates `conversion` record
  - Updates: Thompson Sampling priors (internal)

## Test Files

### 1. Comprehensive Endpoint Test
**File**: `test_cli_v2_endpoints_comprehensive.py`

```bash
# Run comprehensive test suite
python3 test_cli_v2_endpoints_comprehensive.py
```

**What it tests**:
- ✅ Each v2 endpoint individually
- ✅ Database record creation
- ✅ Bearer authentication
- ✅ Proto JSON format handling
- ✅ Error handling

**Output**:
- Green checkmarks for passing tests
- Database verification results
- Test summary with pass/fail counts

### 2. Full Integration Test
**File**: `run_v2_migration_tests.sh`

```bash
# Run full migration test suite
./run_v2_migration_tests.sh
```

**What it does**:
1. Checks prerequisites (backend running, Python installed)
2. Builds metabob-cli
3. Installs test dependencies
4. Runs comprehensive endpoint tests
5. Generates verification report

### 3. Manual OpenCode Integration Test
**Instructions**: See "Manual Testing" section below

## Automated Testing

### Prerequisites
1. Backend running: `docker ps | grep metabob-rpc-api-server`
2. SurrealDB running: `docker ps | grep surreal`
3. Redis running: `docker ps | grep redis`
4. Python 3.9+ installed
5. Test dependencies: `pip3 install httpx surrealdb`

### Step 1: Run Comprehensive Tests

```bash
cd /home/avi/documents/work/exp-repo/metabob-devbob

# Option A: Run Python test directly
python3 test_cli_v2_endpoints_comprehensive.py

# Option B: Run full test suite with reporting
./run_v2_migration_tests.sh
```

### Step 2: Verify Test Output

Expected output:
```
============================================================================
  Metabob-CLI V2 Endpoint Test Suite
============================================================================

Test Environment Setup
✓ Connected to SurrealDB

Test: Session Creation (POST /v2/session)
✓ Session created: test-org-v2:cli-test:xxxxx
ℹ Session token: xxxxxxxxxxxxxxxx...

Test: List Templates (GET /v2/activities/templates)
✓ Found X templates
ℹ Sample template: feature-impl-v1

Test: Create Template (POST /v2/activities/templates)
✓ Template created: xxxxx
✓ Database record verified: activity_variant:xxxxx

... (more tests) ...

============================================================================
  Test Summary
============================================================================
Total Tests: 9
Passed: 9
Failed: 0
Success Rate: 100.0%
```

### Step 3: Database Verification

For each endpoint test, the script verifies:
1. Response status code (200, 201, etc.)
2. Response body contains expected fields
3. Database record exists with correct ID
4. Database record contains expected field values

Example verification:
```python
# After creating a template
template_id = "feature-impl-abc123"

# Verify in SurrealDB
record = await db.select(f"activity_variant:{template_id}")
assert record["name"] == "Test Template"
assert record["category"] == "feature"
```

## Manual Testing

### Test 1: metabob-opencode Integration

1. **Build and install metabob-cli**:
```bash
cd repos/metabob-cli
pip3 install -e .
```

2. **Start metabob-cli MCP server**:
```bash
# In terminal 1
metabob-cli mcp
```

3. **Start metabob-opencode agent**:
```bash
# In terminal 2
cd repos/metabob-opencode
opencode
```

4. **Test activity search**:
```
> search_activities({"query": "feature", "limit": 5})
```

Expected result:
- Returns list of 5 activities
- Each activity has `variant_id`, `variant_name`, `task_steps`
- No errors about authentication or missing endpoints

5. **Test activity execution**:
```
> activity({
    "activityId": "feature-impl-v1",
    "variables": {"feature_name": "test feature"},
    "reason": "Testing v2 endpoint integration"
  })
```

Expected result:
- Activity starts executing
- Steps are delivered incrementally
- No errors about missing endpoints
- Database records created (verify below)

6. **Verify database records**:
```bash
# Connect to SurrealDB
surreal sql --endpoint http://localhost:8000 \
  --namespace test --database test \
  --username root --password root

# Check impression created
SELECT * FROM impression ORDER BY created_at DESC LIMIT 1;

# Check conversion created (after activity completes)
SELECT * FROM conversion ORDER BY created_at DESC LIMIT 1;
```

Expected:
- `impression` record with `execution_id` matching activity
- `conversion` record with `success: true` (if activity succeeded)

### Test 2: Authentication Verification

1. **Capture network traffic** (optional):
```bash
# Monitor HTTP requests
docker logs -f metabob-rpc-api-server-dev-1 | grep "POST /v2"
```

2. **Verify Bearer auth**:
- All requests from CLI should have `Authorization: Bearer <token>`
- No requests should have `X-Internal-Request: true`
- Session token comes from `POST /v2/session` response

3. **Verify session creation**:
```bash
# In SurrealDB
SELECT * FROM session ORDER BY created_at DESC LIMIT 5;
```

Expected:
- Recent sessions from test runs
- Each has `org_id`, `project_id`, `session_token`

## Database Verification Queries

### Check Template Records
```sql
-- List recent templates
SELECT id, name, category, created_at 
FROM activity_variant 
ORDER BY created_at DESC 
LIMIT 10;

-- Check for derived templates
SELECT id, name, parent_id 
FROM activity_variant 
WHERE parent_id IS NOT NULL;
```

### Check Execution Records
```sql
-- List recent impressions (execution starts)
SELECT id, execution_id, variant_id, created_at 
FROM impression 
ORDER BY created_at DESC 
LIMIT 10;

-- List recent conversions (execution completions)
SELECT id, execution_id, success, duration_ms, cost 
FROM conversion 
ORDER BY created_at DESC 
LIMIT 10;

-- Check execution success rate
SELECT 
  COUNT(*) as total,
  SUM(CASE WHEN success = true THEN 1 ELSE 0 END) as successful,
  AVG(CASE WHEN success = true THEN 1.0 ELSE 0.0 END) * 100 as success_rate
FROM conversion
WHERE created_at > time::now() - 1h;
```

### Check Sessions
```sql
-- List active sessions
SELECT id, org_id, project_id, agent_name, created_at 
FROM session 
WHERE created_at > time::now() - 24h
ORDER BY created_at DESC;
```

## Success Criteria

### ✅ Automated Tests Pass
- [ ] All 9 endpoint tests pass
- [ ] All database verifications succeed
- [ ] No authentication errors
- [ ] Proto JSON format correctly parsed

### ✅ Manual Integration Tests Pass
- [ ] metabob-opencode can search activities
- [ ] metabob-opencode can execute activities
- [ ] Database records created during execution
- [ ] Bearer auth used (no X-Internal-Request)

### ✅ Database Integrity
- [ ] Session records created with tokens
- [ ] Template records created/updated correctly
- [ ] Impression records created on execution start
- [ ] Conversion records created on execution complete
- [ ] Parent-child relationships maintained for derived templates

## Troubleshooting

### Issue: "Invalid API key" error
**Cause**: X-API-Key header not set or incorrect  
**Fix**: Set `METABOB_API_KEY` environment variable or pass via header

### Issue: "Failed to connect to SurrealDB"
**Cause**: SurrealDB not running or wrong connection details  
**Fix**: 
```bash
docker ps | grep surreal  # Check if running
docker-compose up -d surreal  # Start if needed
```

### Issue: "Template not found" (404)
**Cause**: Template ID doesn't exist or wrong format  
**Fix**: Use `GET /v2/activities/templates` to list available templates

### Issue: "No templates returned"
**Cause**: Database is empty or needs seeding  
**Fix**: Create test templates using `POST /v2/activities/templates`

### Issue: metabob-opencode can't connect to CLI
**Cause**: MCP server not running or wrong configuration  
**Fix**:
1. Check `metabob-cli mcp` is running
2. Verify `opencode.json` has correct MCP configuration
3. Check `metabob.base_url` points to correct backend

## Test Execution Checklist

- [ ] Backend is running (port 8080)
- [ ] SurrealDB is running (port 8000)
- [ ] Redis is running (port 6379)
- [ ] metabob-cli is built and installed
- [ ] Test dependencies installed (httpx, surrealdb)
- [ ] Run `python3 test_cli_v2_endpoints_comprehensive.py`
- [ ] All automated tests pass
- [ ] Run manual metabob-opencode integration test
- [ ] Verify database records created
- [ ] Review test report
- [ ] Document any issues found

## Next Steps After Testing

1. **If all tests pass**:
   - Deploy new CLI build to production
   - Deprecate old `activity-recommendations` endpoints
   - Monitor production metrics

2. **If tests fail**:
   - Review test output for specific failures
   - Check backend logs: `docker logs metabob-rpc-api-server-dev-1`
   - Verify database schema matches expectations
   - Fix issues and re-test

3. **Production Deployment**:
   - Tag new CLI release: `v2.0.0-v2-migration`
   - Update documentation
   - Notify users of new features
   - Monitor error rates and performance

## Report Template

After running tests, document results:

```markdown
## Test Execution Report

**Date**: [Date]
**Tester**: [Name]
**Environment**: [dev/staging/prod]

### Automated Tests
- Total: X
- Passed: X
- Failed: X
- Success Rate: X%

### Manual Tests
- OpenCode Integration: [PASS/FAIL]
- Database Verification: [PASS/FAIL]
- Authentication: [PASS/FAIL]

### Issues Found
1. [Issue description]
   - Severity: [HIGH/MEDIUM/LOW]
   - Impact: [Description]
   - Fix: [Solution or workaround]

### Conclusion
[Summary and recommendation]
```

## Additional Resources

- **Migration Summary**: `CLI_V2_MIGRATION_COMPLETE.md`
- **Backend V2 API**: `repos/metabob-rpc-api/server/routes/v2_activities.py`
- **CLI Activity Manager**: `repos/metabob-cli/src/metabob_cli/mcp/activity_manager.py`
- **Proto Definitions**: `repos/metabob-proto/proto/metabob/activities/`

---

**Test Plan Version**: 1.0  
**Last Updated**: February 8, 2026  
**Maintainer**: Activity Mode Agent
