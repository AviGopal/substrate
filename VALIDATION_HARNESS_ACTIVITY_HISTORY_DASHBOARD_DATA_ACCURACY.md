# Validation Harness: activity-history-dashboard-data-accuracy

**Specification**: activity-history-dashboard-data-accuracy  
**Created**: 2026-03-06  
**Status**: READY FOR EXECUTION

## Overview

This validation harness tests the end-to-end functionality of the activity history dashboard, verifying that data flows correctly from SurrealDB through the RPC API to the dashboard UI.

## Harness File

**Location**: `tests/validation-harnesses/activity-history-dashboard-data-accuracy-harness.ts`

**Capabilities**:
- Create test users via metabob-rpc-api admin CLI
- Execute sample activities to generate live data
- Authenticate to app.metabob.local using Playwright
- Navigate to /cloud/activity page
- Validate page loads without errors
- Validate summary cards show non-zero values
- Validate activity table displays data
- Validate expandable rows reveal nested data (tasks, impulses)
- Query SurrealDB directly to verify data accuracy
- Capture screenshot evidence at each validation step

## Test Cases

### Test Case 1: Create Test User
**Impulse ID**: `validation-activity-history-dashboard-data-accuracy-case-1`

**Input**:
```json
{
  "testUserId": "test-user-validation",
  "testUserPassword": "test-password-123",
  "orgId": "test-org",
  "userName": "Test User"
}
```

**Expected Output**:
```json
{
  "created": true,
  "userId": "test-user-validation"
}
```

**Validation**: User can authenticate and access dashboard

---

### Test Case 2: Execute Sample Activities
**Impulse ID**: `validation-activity-history-dashboard-data-accuracy-case-2`

**Input**:
```json
{
  "activityTemplates": ["test-simple-activity", "test-complex-activity"],
  "count": 2
}
```

**Expected Output**:
```json
{
  "executed": true,
  "activityCount": 2,
  "executions": [
    {
      "template_id": "test-simple-activity",
      "success": true
    },
    {
      "template_id": "test-complex-activity",
      "success": true
    }
  ]
}
```

**Validation**: Activities appear in SurrealDB activity_executions table

---

### Test Case 3: Query SurrealDB for Activity Executions
**Impulse ID**: `validation-activity-history-dashboard-data-accuracy-case-3`

**Input**:
```json
{
  "rpcApiUrl": "http://localhost:8080",
  "endpoint": "/analytics/executions",
  "limit": 50,
  "offset": 0
}
```

**Expected Output**:
```json
{
  "executions": [
    {
      "execution_id": "exec_test_1234567890",
      "template_id": "test-simple-activity",
      "success": true,
      "started_at": "2026-03-06T12:00:00Z",
      "duration_ms": 1500,
      "cost_usd": 0.002,
      "tokens_input": 500,
      "tokens_output": 200,
      "tokens_cache": 100
    }
  ],
  "total": 2,
  "hasMore": false
}
```

**Validation**: Response contains activity execution records

---

### Test Case 4: Authenticate to Dashboard
**Impulse ID**: `validation-activity-history-dashboard-data-accuracy-case-4`

**Input**:
```json
{
  "dashboardUrl": "http://app.metabob.local:3000",
  "loginPath": "/login",
  "testUserId": "test-user-validation",
  "testUserPassword": "test-password-123"
}
```

**Expected Output**:
```json
{
  "authenticated": true,
  "redirectedTo": "/cloud"
}
```

**Validation**: User is redirected to /cloud after successful login

---

### Test Case 5: Navigate to Activity Page
**Impulse ID**: `validation-activity-history-dashboard-data-accuracy-case-5`

**Input**:
```json
{
  "targetUrl": "http://app.metabob.local:3000/cloud/activity"
}
```

**Expected Output**:
```json
{
  "pageLoaded": true,
  "url": "http://app.metabob.local:3000/cloud/activity",
  "noErrors": true
}
```

**Validation**: Page loads without error messages

---

### Test Case 6: Validate Summary Cards
**Impulse ID**: `validation-activity-history-dashboard-data-accuracy-case-6`

**Input**:
```json
{
  "expectedExecutions": 2,
  "expectedSuccessRate": 1.0
}
```

**Expected Output**:
```json
{
  "summaryCards": {
    "totalExecutions": 2,
    "successRate": 100,
    "totalCost": 0.004,
    "avgDuration": 1500
  },
  "allCardsPresent": true,
  "hasNonZeroValues": true
}
```

**Validation**: Summary cards display correct aggregated metrics

---

### Test Case 7: Validate Activity Table
**Impulse ID**: `validation-activity-history-dashboard-data-accuracy-case-7`

**Input**:
```json
{
  "expectedMinRows": 2,
  "expectedColumns": ["Template ID", "Status", "Timestamp", "Duration", "Cost"]
}
```

**Expected Output**:
```json
{
  "rowCount": 2,
  "columnsPresent": true,
  "dataPopulated": true,
  "sampleRows": [
    {
      "template_id": "test-simple-activity",
      "success": "Success",
      "duration_ms": "1.5s",
      "cost_usd": "$0.002"
    }
  ]
}
```

**Validation**: Table displays activity execution data with correct formatting

---

### Test Case 8: Validate Expandable Rows
**Impulse ID**: `validation-activity-history-dashboard-data-accuracy-case-8`

**Input**:
```json
{
  "rowIndex": 0,
  "expandAction": "click"
}
```

**Expected Output**:
```json
{
  "expanded": true,
  "nestedDataVisible": true,
  "tasks": [
    {
      "task_id": "task-1",
      "success": true,
      "duration_ms": 500
    }
  ],
  "impulses": [
    {
      "impulse_id": "test-impulse",
      "type": "file"
    }
  ]
}
```

**Validation**: Expandable row reveals task breakdown and impulse data

---

### Test Case 9: Validate Data Accuracy
**Impulse ID**: `validation-activity-history-dashboard-data-accuracy-case-9`

**Input**:
```json
{
  "dashboardExecutionIds": ["exec_test_1234567890", "exec_test_0987654321"],
  "databaseExecutionIds": ["exec_test_1234567890", "exec_test_0987654321"]
}
```

**Expected Output**:
```json
{
  "accuracyRate": 1.0,
  "matchCount": 2,
  "mismatches": []
}
```

**Validation**: Dashboard displays exactly what's in the database (100% accuracy)

---

### Test Case 10: Screenshot Evidence
**Impulse ID**: `validation-activity-history-dashboard-data-accuracy-case-10`

**Input**:
```json
{
  "screenshotDir": "screenshots/validation",
  "captureSteps": [
    "auth-success",
    "dashboard-loaded",
    "activity-table",
    "expanded-row",
    "data-accuracy"
  ]
}
```

**Expected Output**:
```json
{
  "screenshots": [
    "screenshots/validation/auth-success.png",
    "screenshots/validation/dashboard-loaded.png",
    "screenshots/validation/activity-table.png",
    "screenshots/validation/expanded-row.png",
    "screenshots/validation/data-accuracy.png"
  ],
  "allCaptured": true
}
```

**Validation**: Screenshots saved for each validation step

---

## Running the Harness

### Prerequisites

1. Install dependencies:
```bash
cd /home/avi/documents/work/exp-repo/metabob-devbob
npm install @playwright/test
```

2. Ensure services are running:
```bash
# RPC API
cd repos/metabob-rpc-api
python -m uvicorn server.app:app --host 0.0.0.0 --port 8080

# Dashboard
cd repos/metabob-dashboard
npm start

# SurrealDB
surreal start --bind 0.0.0.0:8000 --user root --pass root file://devbob.db
```

### Execution

#### Option 1: Using npx

```bash
npx ts-node tests/validation-harnesses/activity-history-dashboard-data-accuracy-harness.ts
```

#### Option 2: Using environment variables

```bash
export DASHBOARD_URL=http://app.metabob.local:3000
export RPC_API_URL=http://localhost:8080
export SURREALDB_URL=http://localhost:8000
export TEST_USER_ID=test-user-validation
export TEST_USER_PASSWORD=test-password-123
export SCREENSHOT_DIR=screenshots/validation

npx ts-node tests/validation-harnesses/activity-history-dashboard-data-accuracy-harness.ts
```

#### Option 3: Programmatic usage

```typescript
import { runValidation } from './tests/validation-harnesses/activity-history-dashboard-data-accuracy-harness';

const input = {
  dashboardUrl: 'http://app.metabob.local:3000',
  rpcApiUrl: 'http://localhost:8080',
  surrealDbUrl: 'http://localhost:8000',
  testUserId: 'test-user-validation',
  testUserPassword: 'test-password-123'
};

const result = await runValidation(input);

if (result.pass) {
  console.log('✅ All validations passed');
} else {
  console.log('❌ Some validations failed');
  result.errors.forEach(err => console.log(`  - ${err}`));
}
```

## Expected Results

When all validations pass, you should see:

```
🚀 Starting Activity History Dashboard Validation
📅 Timestamp: 2026-03-06T12:00:00Z
🌐 Dashboard URL: http://app.metabob.local:3000
🔧 RPC API URL: http://localhost:8080
💾 SurrealDB URL: http://localhost:8000
✓ Test user test-user-validation already exists
✓ Retrieved 2 activity executions from database
✓ Authenticated as test-user-validation
✓ Navigated to activity page: http://app.metabob.local:3000/cloud/activity
✓ Page loaded successfully
✓ Summary cards: 4 found, non-zero values: true
✓ Activity table: 2 rows found
✓ Expandable rows: working, 3 tasks
✓ Data accuracy: 100.0% match
✅ Validation complete

📊 Validation Summary:
  Total Tests: 10
  Passed: 10
  Failed: 0
  Overall: ✅ PASS

📸 Screenshots saved to: screenshots/validation
```

## Troubleshooting

### Authentication Fails

**Symptom**: Test case 4 fails with "Authentication failed"

**Solution**:
1. Check that RPC API is running on port 8080
2. Verify test user exists: `cd repos/metabob-rpc-api && python -m server.cli list-users`
3. Create user manually: `python -m server.cli create-user --user-id test-user-validation --password test-password-123 --org-id test-org --name "Test User"`

### Page Not Loading

**Symptom**: Test case 5 fails with "Page did not load"

**Solution**:
1. Check that dashboard is running: `curl http://app.metabob.local:3000`
2. Verify DNS: Add `127.0.0.1 app.metabob.local` to /etc/hosts
3. Check browser console for errors (Playwright will show them)

### No Data in Table

**Symptom**: Test case 7 fails with "No rows found"

**Solution**:
1. Query SurrealDB directly: `surreal sql --endpoint http://localhost:8000 --namespace metabob --database devbob "SELECT * FROM activity_executions LIMIT 5;"`
2. If no data, run activities manually: Execute test activities or import sample data
3. Verify schema migration 009 was applied (execution_id field exists)

### Expandable Rows Don't Work

**Symptom**: Test case 8 fails with "No expandable content found"

**Solution**:
1. Check that activity has tasks: Query task_execution table
2. Verify dashboard UI code has expandable row logic
3. Check browser console for JavaScript errors

### Data Mismatch

**Symptom**: Test case 9 fails with "Accuracy rate below threshold"

**Solution**:
1. Compare execution_ids from dashboard vs database
2. Check if timestamp → started_at fix was applied (enforcement changes)
3. Verify dashboard is using latest RPC API version (with fixes)

## Integration with CI/CD

This harness can be integrated into CI/CD pipelines:

```yaml
# .github/workflows/validate-dashboard.yml
name: Validate Dashboard Data Accuracy

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      
      - name: Install dependencies
        run: npm install
      
      - name: Start services
        run: docker-compose up -d
      
      - name: Run validation harness
        run: npx ts-node tests/validation-harnesses/activity-history-dashboard-data-accuracy-harness.ts
      
      - name: Upload screenshots
        if: always()
        uses: actions/upload-artifact@v2
        with:
          name: validation-screenshots
          path: screenshots/validation/*.png
```

## Conclusion

This validation harness provides comprehensive end-to-end testing of the activity history dashboard, ensuring that data flows correctly from SurrealDB through the RPC API to the dashboard UI. It validates not only that the page loads, but that the data displayed matches the source of truth in the database.

**Status**: Ready for execution after fixing the 3 critical schema mismatches identified in the trace analysis and applied in the enforcement phase.
