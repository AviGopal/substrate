# Validation Harness: metabob-cli-to-dashboard-data-flow

## Overview

This validation harness tests the complete end-to-end data pipeline from metabob-cli code analysis through RPC API to SurrealDB storage and dashboard display.

**Specification:** metabob-cli-to-dashboard-data-flow  
**Harness File:** `tests/validation-harnesses/metabob-cli-to-dashboard-data-flow-harness.ts`  
**Status:** Ready for execution  
**Created:** 2026-03-11

---

## Validation Strategy

The harness executes the following validation steps without LLM involvement:

1. **Register Test User and Organization** - Creates isolated test environment
2. **Execute metabob-cli Analysis** - Runs analysis on test repository
3. **Verify SurrealDB Data** - Checks projects, sessions, problems tables
4. **Verify Data Hierarchy** - Validates org→project→session→problems links
5. **Verify Dashboard APIs** - Tests GET /projects, /sessions, /problems endpoints
6. **Verify Dashboard UI** - Checks visibility of data in dashboard (using Playwright)
7. **Verify Temporal Tracking** - Validates timestamps for trend analysis
8. **Cleanup** - Removes test data

---

## Test Cases

### Case 1: Basic End-to-End Flow
**Impulse ID:** `validation-metabob-cli-to-dashboard-data-flow-case-1`

**Input:**
```json
{
  "testCase": "basic-e2e",
  "repoPath": "./repos/metabob-cli"
}
```

**Expected Output:**
- ✅ Authentication succeeds (token + org_id returned)
- ✅ CLI analysis completes (session_id + project_id returned)
- ✅ Project found in SurrealDB projects table
- ✅ Session found in SurrealDB sessions table
- ✅ Problems found in SurrealDB problems table (count > 0)
- ✅ Data hierarchy valid (all org_id/project_id/session_id links present)
- ✅ Dashboard API endpoints return 200 OK
- ✅ Dashboard UI displays projects/sessions/problems
- ✅ Temporal timestamps present in all records

---

### Case 2: Multiple Sessions for Temporal Tracking
**Impulse ID:** `validation-metabob-cli-to-dashboard-data-flow-case-2`

**Input:**
```json
{
  "testCase": "temporal-tracking",
  "repoPath": "./repos/metabob-cli",
  "sessionCount": 3
}
```

**Expected Output:**
- ✅ Multiple sessions created and linked to same project
- ✅ Timestamps increase monotonically
- ✅ Trend data available for charts

---

## Running the Validation

### Prerequisites

1. **Services Running:**
   - RPC API Backend: `http://localhost:8000`
   - Dashboard UI: `http://localhost:3001`
   - SurrealDB: `http://localhost:8080`
   - Redis: `localhost:6379`
   - Celery Workers: Running

2. **metabob-cli Installed:**
   ```bash
   which metabob-cli
   # Should return path to CLI executable
   ```

3. **Test Repository Available:**
   ```bash
   ls ./repos/metabob-cli
   # Should contain source code for analysis
   ```

### Execution

**Basic Run:**
```bash
cd /home/avi/documents/work/exp-repo/metabob-devbob
ts-node tests/validation-harnesses/metabob-cli-to-dashboard-data-flow-harness.ts
```

**With Custom Configuration:**
```bash
export RPC_API_URL=http://localhost:8000
export DASHBOARD_URL=http://localhost:3001
export SURREALDB_URL=http://localhost:8080
export TEST_REPO_PATH=./repos/metabob-cli
export CLI_COMMAND=metabob-cli

ts-node tests/validation-harnesses/metabob-cli-to-dashboard-data-flow-harness.ts
```

**Expected Output:**
```
Starting metabob-cli-to-dashboard-data-flow validation...
Step 1: Registering test user and organization...
Step 2: Running metabob-cli analysis...
Step 3: Verifying data in SurrealDB...
Step 4: Verifying data hierarchy (org→project→session→problems)...
Step 5: Verifying Dashboard API endpoints...
Step 6: Verifying Dashboard UI display...
Step 7: Verifying temporal tracking for trends...
Step 8: Cleaning up test data...

=== Running Test Case: Basic end-to-end flow ===
Result: PASS

=== Running Test Case: Multiple sessions for temporal tracking ===
Result: PASS

=== Validation Complete ===
Passed: 2/2
```

### Exit Codes
- `0` - All tests passed
- `1` - One or more tests failed

---

## Validation Results Structure

```typescript
{
  pass: boolean,
  actual: {
    auth: {
      success: boolean,
      token: string,
      org_id: string,
      user_id: string
    },
    analysis: {
      success: boolean,
      session_id: string | undefined,
      project_id: string | undefined,
      output: string
    },
    database: {
      projects: { found: boolean, data: any },
      sessions: { found: boolean, data: any },
      problems: { found: boolean, count: number, data: any[] }
    },
    hierarchy: {
      valid: boolean,
      errors: string[],
      hierarchy: {
        org_to_project: boolean,
        project_to_session: boolean,
        session_to_problems: boolean
      }
    },
    api: {
      projects: { success: boolean, data: any, error: string | undefined },
      sessions: { success: boolean, data: any, error: string | undefined },
      problems: { success: boolean, data: any, error: string | undefined }
    },
    ui: {
      projects: { visible: boolean },
      sessions: { visible: boolean },
      problems: { visible: boolean }
    },
    temporal: {
      timestampsPresent: boolean,
      trendDataAvailable: boolean
    }
  },
  expected: { /* Same structure as actual */ },
  errors: string[],
  warnings: string[],
  metadata: {
    testCase: string,
    timestamp: string,
    duration: number
  }
}
```

---

## Common Issues and Debugging

### Issue 1: Services Not Running
**Error:** `fetch failed: connect ECONNREFUSED`  
**Solution:** Ensure all services are running:
```bash
# Check RPC API
curl http://localhost:8000/health

# Check Dashboard
curl http://localhost:3001

# Check SurrealDB
curl http://localhost:8080/health
```

### Issue 2: metabob-cli Not Found
**Error:** `metabob-cli: command not found`  
**Solution:** Install metabob-cli or set CLI_COMMAND:
```bash
export CLI_COMMAND=/path/to/metabob-cli
```

### Issue 3: Registration Fails
**Error:** `Email already registered`  
**Solution:** Test user already exists. Either:
1. Delete existing test user from database
2. Change TEST_USER email in harness code

### Issue 4: Projects Table Empty
**Error:** `Project not found in SurrealDB projects table`  
**Root Cause:** Gap 1 (CLI Project Registration) not implemented  
**Solution:** Complete Gap 1 implementation or manually create project

### Issue 5: Problems Table Empty
**Error:** `No problems found in SurrealDB problems table`  
**Root Cause:** Could be valid (clean code) or Gap 3 (SurrealDB Persistence) not implemented  
**Check:** Verify problems in Redis:
```bash
redis-cli
> HGETALL session:{session_id}:problems
```

### Issue 6: Dashboard API Returns 404
**Error:** `Projects API failed: Status 404`  
**Root Cause:** Backend changes not deployed  
**Solution:** Restart RPC API backend:
```bash
kubectl rollout restart deployment metabob-rpc-api
# OR
python repos/metabob-rpc-api/server/main.py
```

---

## Integration with CI/CD

### GitHub Actions
```yaml
name: Validate Data Flow
on: [push, pull_request]

jobs:
  validate:
    runs-on: ubuntu-latest
    services:
      surrealdb:
        image: surrealdb/surrealdb:latest
        ports:
          - 8080:8080
      redis:
        image: redis:latest
        ports:
          - 6379:6379
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
        with:
          node-version: '18'
      - name: Install dependencies
        run: npm install
      - name: Start services
        run: |
          docker-compose up -d
          sleep 10
      - name: Run validation harness
        run: ts-node tests/validation-harnesses/metabob-cli-to-dashboard-data-flow-harness.ts
```

### Manual Pre-Deployment Check
```bash
# Before deploying to production
./scripts/run-validation-harness.sh metabob-cli-to-dashboard-data-flow

# Should output:
# ✅ All validations passed
# 🚀 Safe to deploy
```

---

## Impulses Created

### Harness Impulse
**ID:** `harness-metabob-cli-to-dashboard-data-flow`  
**Type:** file  
**Pointer:** `tests/validation-harnesses/metabob-cli-to-dashboard-data-flow-harness.ts`  
**Budget:** 2000 tokens  
**Purpose:** Executable validation harness for end-to-end data flow

### Test Case Impulse 1
**ID:** `validation-metabob-cli-to-dashboard-data-flow-case-1`  
**Type:** memo  
**Content:** Basic end-to-end flow test case  
**Budget:** 500 tokens  
**Purpose:** Historical test case - can be run without LLM

### Test Case Impulse 2
**ID:** `validation-metabob-cli-to-dashboard-data-flow-case-2`  
**Type:** memo  
**Content:** Temporal tracking test case  
**Budget:** 500 tokens  
**Purpose:** Historical test case - can be run without LLM

---

## Maintenance

### Updating Test Cases
When the specification changes, update:
1. Expected outputs in test cases
2. Validation logic in harness functions
3. Impulse contents with new expectations

### Adding New Test Cases
```typescript
// In harness file
const newTestCase: TestCase = {
  id: 'validation-metabob-cli-to-dashboard-data-flow-case-3',
  name: 'Test case name',
  input: { /* input data */ },
  expectedOutput: { /* expected output */ },
};
```

Then create corresponding impulse.

---

## Related Documentation

- **Specification Trace:** `TRACE_COMPLETE_metabob-cli-to-dashboard-data-flow.md`
- **Enforcement Summary:** `ENFORCEMENT_COMPLETE_metabob-cli-to-dashboard-data-flow.md`
- **Data Flow Diagram:** `docs/data-flows/metabob-cli-to-dashboard-data-flow-flow.md`

---

## Contact and Support

For issues with the validation harness:
1. Check logs in `tests/validation-harnesses/logs/`
2. Review recent changes to specification
3. Verify all prerequisites are met
4. Check service health endpoints

---

**Last Updated:** 2026-03-11  
**Maintainer:** OpenCode Activity System  
**Status:** Active - Ready for Execution
