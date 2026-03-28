# Activity History Comprehensive Display - Validation Harness

## Overview

This validation harness tests the comprehensive Activity History dashboard at `app.metabob.local/cloud/activity`.

## Specification

**Name:** activity-history-comprehensive-display  
**Description:** Create comprehensive Activity History dashboard displaying: invocations table, task breakdowns, impulses used, outcomes, variants, costs, compositions with expandable rows, color coding, filters, and sorting.

## Validation Strategy

1. **Execute Test Activities** - Run 3-5 activities on devbob to generate test data
2. **Query SurrealDB** - Get ground truth data from database
3. **Navigate Dashboard** - Use Playwright to interact with UI
4. **Verify Display** - Check that all data is displayed correctly
5. **Test Interactions** - Verify filters, sorting, expandable rows
6. **Capture Evidence** - Take screenshots of each validation step

## Test Cases

### Case 1: Basic Display Validation
**Purpose:** Verify activity executions are displayed with correct data  
**Checks:**
- Table is visible
- At least 3 executions shown
- Template ID, status, timestamp displayed
- Duration, cost, tokens displayed
- Data matches SurrealDB within 1% variance
- Page loads < 3 seconds

### Case 2: Expandable Rows Validation
**Purpose:** Verify expandable rows show complete details  
**Checks:**
- Expand button works
- Task breakdown displayed
- Task count matches database
- Impulses used displayed
- Impulse count matches database
- Error details shown (if applicable)

### Case 3: Filtering and Sorting Validation
**Purpose:** Verify interactive features work correctly  
**Checks:**
- Template filter reduces results
- Success filter reduces results
- Timestamp sorting works
- Cost sorting works
- Duration sorting works
- Sort order correct (ascending/descending)

## Usage

### Prerequisites

```bash
# Install dependencies
npm install playwright @types/node

# Ensure services are running
kubectl get pods -n metabob
# Verify: surrealdb, metabob-rpc-api, metabob-dashboard, devbob are Running
```

### Running Validation

```bash
# Run all test cases
npx tsx tests/validation-harnesses/activity-history-comprehensive-display-harness.ts

# Run specific test case
npx tsx -e "
import { runValidation } from './tests/validation-harnesses/activity-history-comprehensive-display-harness.ts';
runValidation('validation-activity-history-comprehensive-display-case-1').then(console.log);
"
```

### Output

Validation results are returned as JSON:

```json
{
  "pass": true,
  "testCaseId": "validation-activity-history-comprehensive-display-case-1",
  "executionIds": ["act_123", "act_124", "act_125"],
  "checks": [
    {
      "name": "Executions visible in table",
      "pass": true,
      "expected": "3 executions",
      "actual": "3 rows"
    },
    {
      "name": "Execution 1: Duration accuracy",
      "pass": true,
      "expected": "5000ms",
      "actual": "4998ms",
      "variance": 0.0004
    }
  ],
  "screenshots": {
    "listView": "/path/to/list-view-12345.png",
    "expandedView": "/path/to/expanded-view-12345.png"
  },
  "errors": [],
  "timestamp": "2026-03-06T03:30:00Z"
}
```

### Screenshots

Screenshots are saved to `tests/screenshots/activity-history-validation/` with timestamps.

## Environment Variables

```bash
# Dashboard URL
export DASHBOARD_URL=http://app.metabob.local

# RPC API URL
export RPC_API_URL=http://metabob-rpc-api:8080

# SurrealDB connection
export SURREAL_HOST=surrealdb
export SURREAL_PORT=8000
export SURREAL_USER=root
export SURREAL_PASS=root
export SURREAL_NAMESPACE=metabob
export SURREAL_DATABASE=metabob
```

## Success Criteria

All checks must pass:

- ✅ Table displays executions
- ✅ Data accuracy within 1% variance
- ✅ Expandable rows show task breakdown
- ✅ Expandable rows show impulse details
- ✅ Template filter works
- ✅ Success filter works  
- ✅ Timestamp sorting works
- ✅ Cost sorting works
- ✅ Duration sorting works
- ✅ Page loads < 3 seconds
- ✅ No console errors

## Troubleshooting

### No executions found in database
```bash
# Execute a test activity in devbob
kubectl exec -n metabob devbob-0 -- opencode activity list
kubectl exec -n metabob devbob-0 -- opencode activity execute <template-id>
```

### Dashboard not accessible
```bash
# Check dashboard pod
kubectl get pods -n metabob | grep dashboard
kubectl logs -n metabob <dashboard-pod>

# Check route
kubectl exec -n metabob <dashboard-pod> -- curl http://localhost:3000/cloud/activity
```

### SurrealDB connection failed
```bash
# Check SurrealDB pod
kubectl get pods -n metabob | grep surrealdb
kubectl logs -n metabob surrealdb-0

# Test connection
kubectl exec -n metabob surrealdb-0 -- surreal sql --conn http://localhost:8000 --user root --pass root --ns metabob --db metabob "SELECT * FROM activity_executions LIMIT 1;"
```

### Data mismatch
```bash
# Check RPC API logs for sync failures
kubectl logs -n metabob <rpc-api-pod> | grep "activity/record"

# Verify Activity.complete() is syncing
kubectl logs -n metabob devbob-0 | grep "recording activity execution to RPC API"

# Check METABOB_RPC_API_URL env var
kubectl exec -n metabob devbob-0 -- env | grep METABOB_RPC_API_URL
```

## Related Files

- **Harness:** `tests/validation-harnesses/activity-history-comprehensive-display-harness.ts`
- **Test Cases:** `tests/validation-harnesses/activity-history-test-cases.json`
- **Component:** `repos/metabob-dashboard/src/pages/ActivityHistory/ActivityHistory.js`
- **API:** `repos/metabob-rpc-api/server/routes/analytics.py`
- **Trace:** `TRACE_ANALYSIS_activity-history-comprehensive-display.json`
- **Enforcement:** `ENFORCEMENT_SUMMARY_activity-history-comprehensive-display.json`

## Continuous Integration

Add to CI pipeline:

```yaml
- name: Validate Activity History Dashboard
  run: |
    npm install playwright
    npx tsx tests/validation-harnesses/activity-history-comprehensive-display-harness.ts
  env:
    DASHBOARD_URL: http://app.metabob.local
    RPC_API_URL: http://metabob-rpc-api:8080
    SURREAL_HOST: surrealdb
    SURREAL_PORT: 8000
```

