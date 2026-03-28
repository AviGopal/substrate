# Validation Harness: metabob-dashboard-to-cli-data-flow

## Purpose

This validation harness tests the complete bidirectional data flow between metabob-dashboard UI, metabob-rpc-api, SurrealDB, and metabob-cli.

## Test Coverage

### 1. Container Code Validation
Verifies that the metabob-dashboard container code matches the source code in `repos/metabob-dashboard`.

**Critical Files Checked:**
- `src/cloud/api/ProjectApi.js` - RTK Query API definitions
- `src/cloud/hooks/useProjects.js` - React hooks
- `src/cloud/pages/Projects/ProjectDetail.js` - UI component

### 2. CLI → SurrealDB → Dashboard (Write Path)
Tests that data created by the CLI persists in SurrealDB and appears in the dashboard.

**Entity Types Tested:**
- **Projects**: CLI creates project → persists → dashboard displays
- **Problems**: CLI creates problems → persists → dashboard displays

**Transformations Validated:**
1. CLI → RPC API: snake_case JSON with bearer token auth
2. RPC API → SurrealDB: SQL INSERT with multi-branch parsing
3. SurrealDB → Dashboard: snake_case → camelCase via RTK Query

### 3. Dashboard → SurrealDB → CLI (Read/Update Path)
Tests that dashboard changes persist in SurrealDB and are visible to the CLI.

**Operations Tested:**
- Dashboard updates problem status → CLI fetches updated data

**Transformations Validated:**
1. Dashboard → RPC API: camelCase → snake_case transformation
2. RPC API → SurrealDB: SQL UPDATE statement
3. SurrealDB → CLI: snake_case JSON response

## Running the Harness

### Prerequisites
```bash
# Set environment variables
export RPC_API_URL="http://localhost:8000"
export DASHBOARD_URL="http://localhost:3000"
export SURREALDB_URL="http://localhost:8080"
export TEST_API_TOKEN="your-api-token"
export TEST_ORG_ID="test-org-001"
export TEST_USER_ID="test-user-001"
```

### Run All Tests
```bash
cd tests/validation-harnesses
npm install
npx ts-node metabob-dashboard-to-cli-data-flow-harness.ts
```

### Run Specific Test
```typescript
import { runValidation } from './metabob-dashboard-to-cli-data-flow-harness';

const result = await runValidation({
  testCase: 'cli-project-to-dashboard',
  description: 'CLI creates project → SurrealDB → Dashboard displays',
  entityType: 'project',
  operation: 'cli-to-dashboard',
});

console.log(result.pass ? 'PASS ✅' : 'FAIL ❌');
```

## Output Format

### Success Output
```json
{
  "pass": true,
  "actual": {
    "entityType": "project",
    "direction": "cli-to-dashboard",
    "propagated": true,
    "transformations": [
      {
        "layer": "CLI → RPC API",
        "component": "api_client.call_api()",
        "input": { "project_id": "...", "org_id": "..." },
        "output": { "project_id": "...", "name": "..." },
        "format": "snake_case JSON",
        "validated": true
      }
    ]
  },
  "expected": {
    "propagated": true,
    "allTransformationsValid": true
  },
  "details": {
    "testCase": "cli-project-to-dashboard",
    "operation": "cli-to-dashboard",
    "entityType": "project",
    "transformations": [...]
  }
}
```

### Failure Output
```json
{
  "pass": false,
  "actual": { "error": "..." },
  "expected": { "success": true },
  "details": {
    "testCase": "...",
    "operation": "...",
    "entityType": "...",
    "transformations": [],
    "errors": ["Data did not propagate end-to-end"]
  }
}
```

## Validation Strategy

### 1. Layer-by-Layer Tracing
Each test traces data through all layers:
- **Source Layer**: CLI or Dashboard
- **Database Layer**: SurrealDB
- **API Layer**: metabob-rpc-api
- **Destination Layer**: Dashboard or CLI

### 2. Transformation Validation
Each layer transformation is validated:
- Input data format (snake_case/camelCase)
- Output data format
- Data persistence
- Format conversion correctness

### 3. End-to-End Propagation
Final check confirms:
- Data created at source appears at destination
- All intermediate transformations succeeded
- No data loss or corruption

## Test Cases (Impulses)

Test case data is stored as impulses for historical validation:

1. `validation-metabob-dashboard-to-cli-data-flow-case-1`: Container code validation
2. `validation-metabob-dashboard-to-cli-data-flow-case-2`: CLI project to dashboard
3. `validation-metabob-dashboard-to-cli-data-flow-case-3`: CLI problems to dashboard
4. `validation-metabob-dashboard-to-cli-data-flow-case-4`: Dashboard update to CLI

Each impulse contains:
- Test input parameters
- Expected output
- Transformation sequence

## Architecture Diagram

```
CLI (metabob-cli)
  ↓ [snake_case JSON + bearer token]
RPC API (metabob-rpc-api)
  ↓ [SQL INSERT/UPDATE]
SurrealDB
  ↓ [Multi-branch parsing]
RPC API (metabob-rpc-api)
  ↓ [snake_case JSON]
Dashboard (metabob-dashboard)
  ↓ [RTK Query transforms to camelCase]
React UI Components
```

## Known Limitations

1. **Container Path**: Update `CONFIG.paths.dashboardContainer` with actual container path
2. **Authentication**: Requires valid API token in `TEST_API_TOKEN`
3. **Services Running**: Assumes all services (RPC API, SurrealDB, Dashboard) are running
4. **Test Data Cleanup**: Manual cleanup may be required after test runs

## Maintenance

When updating the data flow:
1. Update transformation validation in harness functions
2. Update expected outputs in test case impulses
3. Re-run all tests to verify
4. Update this README with any new test cases or validation logic
