# Validation Execution Guide: metabob-cli-to-dashboard-e2e-data-flow

**Status**: Ready for execution  
**Date**: 2026-03-12  
**Specification**: metabob-cli-to-dashboard-e2e-data-flow

---

## Prerequisites

Before running the validation harness, ensure:

1. **RPC API is deployed and accessible**
   - URL: `http://localhost:8000` or production URL
   - Health check: `curl http://localhost:8000/health`

2. **SurrealDB is running**
   - URL: `http://localhost:8000` (via RPC API proxy)
   - Database: `metabob`
   - Namespace: `production` or `test`

3. **Authentication credentials**
   - Valid JWT token (from login or API key)
   - Test org_id (organization UUID)
   - Optional: test user_id

4. **Dependencies installed**
   ```bash
   cd /home/avi/documents/work/exp-repo/metabob-devbob
   npm install axios form-data
   # or
   yarn add axios form-data
   ```

5. **Celery workers running** (for V3 - SurrealDB persistence)
   - Workers must be processing analysis jobs
   - Verify with: `celery -A tasks inspect active`

---

## Step 1: Set Environment Variables

```bash
export TEST_ORG_ID="your-org-uuid-here"
export JWT_TOKEN="your-jwt-token-here"
export RPC_API_URL="http://localhost:8000"

# Optional: SurrealDB configuration
export SURREALDB_URL="http://localhost:8000"
export SURREALDB_NS="production"
export SURREALDB_DB="metabob"
export TEST_USER_ID="your-user-uuid-here"
```

### How to Get Credentials

**JWT Token**:
```bash
# Option 1: Via metabob-cli login
metabob-cli login
# Token is stored in ~/.metabob/config.json

# Option 2: Via API
curl -X POST http://localhost:8000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com", "password": "password"}'
```

**Org ID**:
```bash
# Extract from JWT token
echo $JWT_TOKEN | cut -d'.' -f2 | base64 -d | jq -r '.org_id'

# Or query from API
curl -X GET http://localhost:8000/auth/me \
  -H "Authorization: Bearer $JWT_TOKEN" | jq -r '.org_id'
```

---

## Step 2: Run Validation Harness

### Option A: Standalone Execution (Recommended)

```bash
cd /home/avi/documents/work/exp-repo/metabob-devbob

npx ts-node tests/validation-harnesses/metabob-cli-to-dashboard-e2e-data-flow-harness.ts
```

**Expected Output**:
```
=== Validation Results ===
Total: 6
Passed: 6
Failed: 0
Duration: 15000ms

Test Cases:
✅ PASS - V1: CLI Project Registration (250ms)
✅ PASS - V2: Session-Project Linking (180ms)
✅ PASS - V3: SurrealDB Problem Persistence (5200ms)
✅ PASS - V4: Dashboard Problem Query (120ms)
✅ PASS - V5: Temporal Tracking (110ms)
✅ PASS - V6: Stats Updates (100ms)
```

### Option B: Programmatic Execution

Create `run-validation.ts`:
```typescript
import { runValidation } from './tests/validation-harnesses/metabob-cli-to-dashboard-e2e-data-flow-harness';

const config = {
  rpcApiUrl: process.env.RPC_API_URL || 'http://localhost:8000',
  surrealDbUrl: process.env.SURREALDB_URL || 'http://localhost:8000',
  surrealDbNamespace: process.env.SURREALDB_NS || 'production',
  surrealDbDatabase: process.env.SURREALDB_DB || 'metabob',
  testOrgId: process.env.TEST_ORG_ID,
  testUserId: process.env.TEST_USER_ID,
  jwtToken: process.env.JWT_TOKEN
};

async function main() {
  const result = await runValidation(config);
  
  console.log('\n=== Validation Summary ===');
  console.log(`Overall: ${result.pass ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`Passed: ${result.summary.passed}/${result.summary.total}`);
  console.log(`Failed: ${result.summary.failed}`);
  console.log(`Duration: ${result.summary.duration}ms`);
  
  // Detailed results
  result.results.forEach(r => {
    const status = r.pass ? '✅ PASS' : '❌ FAIL';
    console.log(`\n${status} - ${r.testCase} (${r.duration}ms)`);
    if (!r.pass) {
      console.log(`  Error: ${r.error || 'Expected !== Actual'}`);
      console.log(`  Expected:`, JSON.stringify(r.expected, null, 2));
      console.log(`  Actual:`, JSON.stringify(r.actual, null, 2));
    }
  });
  
  // Save results to file
  const fs = require('fs');
  fs.writeFileSync(
    'validation-results-metabob-cli-to-dashboard-e2e-data-flow.json',
    JSON.stringify(result, null, 2)
  );
  
  process.exit(result.pass ? 0 : 1);
}

main().catch(error => {
  console.error('Validation failed:', error);
  process.exit(1);
});
```

Run:
```bash
npx ts-node run-validation.ts
```

---

## Step 3: Interpret Results

### PASS Scenario
All 6 test cases pass:
- ✅ V1: Project created successfully
- ✅ V2: Session linked to project
- ✅ V3: Problems persisted to SurrealDB
- ✅ V4: Dashboard can query problems
- ✅ V5: Temporal ordering works
- ✅ V6: Stats updated correctly

**Action**: E2E data flow is validated. Specification is production-ready.

### FAIL Scenario

#### V1 Fails (Project Registration)
**Symptoms**: 
- Error: "403 Forbidden" or "401 Unauthorized"
- Expected: hasProjectId=true, Actual: hasProjectId=false

**Diagnosis**:
1. Check JWT token validity: `jwt.io` or `echo $JWT_TOKEN | base64 -d`
2. Verify org_id matches token: `echo $JWT_TOKEN | cut -d'.' -f2 | base64 -d | jq -r '.org_id'`
3. Check endpoint is deployed: `curl -I http://localhost:8000/auth/orgs/{org_id}/projects`

**Fix**:
- Generate new JWT token
- Verify org_id is correct
- Check RPC API logs for errors

#### V2 Fails (Session-Project Linking)
**Symptoms**:
- Error: "400 Bad Request" or "500 Internal Server Error"
- Expected: hasJobId=true, Actual: hasJobId=false

**Diagnosis**:
1. Check POST /v2/submit accepts multipart/form-data
2. Verify project_id from V1 is valid UUID
3. Check Celery queue is accepting jobs: `celery -A tasks inspect active`

**Fix**:
- Verify content-type header is correct
- Check Redis connectivity
- Restart Celery workers if needed

#### V3 Fails (SurrealDB Persistence)
**Symptoms**:
- Error: "No problems found" or "Schema mismatch"
- Expected: hasProblems=true, Actual: hasProblems=false

**Diagnosis**:
1. Wait longer (increase timeout from 5s to 10s)
2. Check Celery task completed: `celery -A tasks inspect active`
3. Query SurrealDB directly: `SELECT * FROM problems WHERE project_id = '{project_id}'`
4. Check SurrealDB connection in RPC API logs

**Fix**:
- Ensure Celery workers are running
- Verify SurrealDB is accessible
- Check problem_ops.bulk_create_problems() is called
- Review Celery task logs for errors

#### V4 Fails (Dashboard Problem Query)
**Symptoms**:
- Error: "404 Not Found" or "403 Forbidden"
- Expected: hasProblems=true, Actual: null

**Diagnosis**:
1. Check endpoint exists: `curl -I http://localhost:8000/auth/orgs/{org_id}/projects/{project_id}/problems`
2. Verify JWT token has access to org_id
3. Check project_id is valid and belongs to org

**Fix**:
- Verify endpoint was deployed (from enforcement step)
- Check org_id verification logic
- Review RPC API logs for authorization errors

#### V5 Fails (Temporal Tracking)
**Symptoms**:
- Expected: descendingOrder=true, Actual: descendingOrder=false
- Problems not ordered by created_at DESC

**Diagnosis**:
1. Check problem_ops.list_problems_by_project() uses ORDER BY created_at DESC
2. Verify timestamps are ISO 8601 format
3. Check SurrealDB query syntax

**Fix**:
- Update query to include ORDER BY created_at DESC
- Verify timestamp parsing in validation logic

#### V6 Fails (Stats Updates)
**Symptoms**:
- Expected: hasStats=true, Actual: hasStats=false
- Stats not updated after problem persistence

**Diagnosis**:
1. Check project_ops.update_project_stats() is called
2. Verify stats are updated in SurrealDB
3. Check stats calculation logic

**Fix**:
- Ensure stats update is triggered after problem persistence
- Verify stats schema matches expectation
- Review project_ops implementation

---

## Step 4: Save Results

Results are automatically saved to:
```
validation-results-metabob-cli-to-dashboard-e2e-data-flow.json
```

Contents:
```json
{
  "pass": true,
  "results": [
    {
      "pass": true,
      "testCase": "V1: CLI Project Registration",
      "actual": { "hasProjectId": true, ... },
      "expected": { "hasProjectId": true, ... },
      "duration": 250
    },
    ...
  ],
  "summary": {
    "total": 6,
    "passed": 6,
    "failed": 0,
    "duration": 15000
  }
}
```

---

## Step 5: Create Results Impulse

After successful validation:

```bash
# Copy results to impulses directory
cp validation-results-metabob-cli-to-dashboard-e2e-data-flow.json \
   impulses/validation-results-metabob-cli-to-dashboard-e2e-data-flow.json
```

Update with impulse metadata:
```json
{
  "id": "validation-results-metabob-cli-to-dashboard-e2e-data-flow",
  "type": "memo",
  "createdAt": "2026-03-12T00:00:00Z",
  "budget": 2000,
  "metadata": {
    "specification": "metabob-cli-to-dashboard-e2e-data-flow",
    "executionDate": "2026-03-12T02:45:00Z",
    "overallStatus": "PASS",
    "totalTests": 6,
    "passedTests": 6,
    "failedTests": 0
  },
  "content": {
    "results": [ ... ],
    "summary": { ... }
  }
}
```

---

## CI/CD Integration

### GitHub Actions Workflow

Create `.github/workflows/e2e-validation.yml`:

```yaml
name: E2E Validation - metabob-cli-to-dashboard

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]
  schedule:
    # Run daily at 2 AM UTC
    - cron: '0 2 * * *'

jobs:
  validate-e2e:
    runs-on: ubuntu-latest
    
    services:
      redis:
        image: redis:7-alpine
        ports:
          - 6379:6379
      
      surrealdb:
        image: surrealdb/surrealdb:latest
        ports:
          - 8000:8000
        options: --name surrealdb
    
    steps:
      - uses: actions/checkout@v3
      
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - name: Install dependencies
        run: |
          cd tests/validation-harnesses
          npm install
      
      - name: Start RPC API
        env:
          REDIS_URL: redis://localhost:6379
          SURREALDB_URL: http://localhost:8000
        run: |
          cd repos/metabob-rpc-api
          pip install -r requirements.txt
          uvicorn server.main:app --host 0.0.0.0 --port 8001 &
          sleep 10
      
      - name: Start Celery Workers
        env:
          REDIS_URL: redis://localhost:6379
        run: |
          cd repos/metabob-rpc-api
          celery -A tasks worker --loglevel=info &
          sleep 5
      
      - name: Run E2E Validation
        env:
          TEST_ORG_ID: ${{ secrets.TEST_ORG_ID }}
          JWT_TOKEN: ${{ secrets.JWT_TOKEN }}
          RPC_API_URL: http://localhost:8001
          SURREALDB_URL: http://localhost:8000
          SURREALDB_NS: test
          SURREALDB_DB: metabob
        run: |
          npx ts-node tests/validation-harnesses/metabob-cli-to-dashboard-e2e-data-flow-harness.ts
      
      - name: Upload Results
        if: always()
        uses: actions/upload-artifact@v3
        with:
          name: validation-results
          path: validation-results-*.json
      
      - name: Comment on PR
        if: github.event_name == 'pull_request' && failure()
        uses: actions/github-script@v6
        with:
          script: |
            const fs = require('fs');
            const results = JSON.parse(fs.readFileSync('validation-results-metabob-cli-to-dashboard-e2e-data-flow.json', 'utf8'));
            const failedTests = results.results.filter(r => !r.pass);
            const comment = `## E2E Validation Failed\n\n${failedTests.map(t => `- ❌ ${t.testCase}: ${t.error}`).join('\n')}`;
            github.rest.issues.createComment({
              issue_number: context.issue.number,
              owner: context.repo.owner,
              repo: context.repo.repo,
              body: comment
            });
```

---

## Troubleshooting

### Common Errors

**Error**: `Missing required environment variables: TEST_ORG_ID, JWT_TOKEN`
- **Fix**: Set environment variables before running

**Error**: `ECONNREFUSED` or `Network Error`
- **Fix**: Verify RPC API is running on expected URL

**Error**: `401 Unauthorized`
- **Fix**: Generate new JWT token or verify token is valid

**Error**: `403 Forbidden`
- **Fix**: Verify org_id matches JWT token

**Error**: `V3 timeout - No problems found`
- **Fix**: Wait longer or check Celery workers are processing jobs

### Debugging Tips

1. **Enable verbose logging**:
   ```bash
   export DEBUG=true
   npx ts-node tests/validation-harnesses/metabob-cli-to-dashboard-e2e-data-flow-harness.ts
   ```

2. **Test individual endpoints manually**:
   ```bash
   # V1: Project registration
   curl -X POST http://localhost:8000/auth/orgs/$TEST_ORG_ID/projects \
     -H "Authorization: Bearer $JWT_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{"name":"test","repository_url":"https://github.com/test/repo","branch":"main"}'
   
   # V4: Dashboard query
   curl -X GET "http://localhost:8000/auth/orgs/$TEST_ORG_ID/projects/$PROJECT_ID/problems?limit=10" \
     -H "Authorization: Bearer $JWT_TOKEN"
   ```

3. **Check RPC API logs**:
   ```bash
   docker logs metabob-rpc-api -f
   ```

4. **Query SurrealDB directly**:
   ```bash
   curl -X POST http://localhost:8000/sql \
     -H "NS: production" \
     -H "DB: metabob" \
     -d "SELECT * FROM problems LIMIT 10"
   ```

---

## Next Steps

After successful validation:

1. ✅ Mark specification as **PRODUCTION_READY**
2. ✅ Document results in impulse: `validation-results-metabob-cli-to-dashboard-e2e-data-flow`
3. ✅ Update enforcement status in `ENFORCEMENT_METABOB_CLI_TO_DASHBOARD_E2E_DATA_FLOW.md`
4. ✅ Deploy to production environment
5. ✅ Enable monitoring and alerting
6. ✅ Schedule automated validation in CI/CD

---

## References

- **Harness Impulse**: harness-metabob-cli-to-dashboard-e2e-data-flow
- **Test Case Impulses**: validation-metabob-cli-to-dashboard-e2e-data-flow-case-1 through case-6
- **Harness File**: tests/validation-harnesses/metabob-cli-to-dashboard-e2e-data-flow-harness.ts
- **Specification**: metabob-cli-to-dashboard-e2e-data-flow
- **Trace Document**: TRACE_METABOB_CLI_TO_DASHBOARD_E2E_DATA_FLOW.md
- **Enforcement Document**: ENFORCEMENT_METABOB_CLI_TO_DASHBOARD_E2E_DATA_FLOW.md
