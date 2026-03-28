# Validation Harness: RPC API Data Display Endpoints

## Purpose

This validation harness tests the RPC API Data Display Endpoints specification to ensure:
1. **Project Listing** returns project objects (not field name strings)
2. **Activity Endpoint** returns empty array structure (not error messages)

## Bugs Being Tested

### Bug 1: Project Listing Returns Field Names
**Before Fix:**
```json
{
  "projects": ["branch", "created_at", "updated_at", "project_id", "org_id", "name"],
  "total": 6,
  "hasMore": false
}
```

**After Fix:**
```json
{
  "projects": [
    {
      "project_id": "uuid-123",
      "name": "my-app",
      "org_id": "org-456",
      "branch": "main",
      "created_at": "2026-03-11T00:00:00Z",
      "updated_at": "2026-03-11T12:00:00Z"
    }
  ],
  "total": 1,
  "hasMore": false
}
```

### Bug 2: Activity Endpoint Returns Error Message
**Before Fix:**
```
"Error: No activity found for organization"
```

**After Fix:**
```json
{
  "activities": [],
  "hasMore": false,
  "total": 0
}
```

## Test Cases

### Case 1: Project Listing Returns Objects
- **Endpoint:** `GET /auth/orgs/{org_id}/projects`
- **Validates:** Response structure has `projects` array of objects
- **Required Fields:** `project_id`, `name`, `org_id`, `branch`, `created_at`, `updated_at`
- **Fails If:** Projects array contains strings (field names) instead of objects

### Case 2: Activity Endpoint Returns Empty Array
- **Endpoint:** `GET /auth/orgs/{org_id}/activity`
- **Validates:** Response structure has `activities` array, `hasMore` boolean, `total` number
- **Fails If:** Response is a string (error message) instead of structured object

### Case 3: Project Listing Not Field Names Array
- **Endpoint:** `GET /auth/orgs/{org_id}/projects`
- **Validates:** Projects array does NOT contain known field name strings
- **Known Field Names:** `['branch', 'created_at', 'updated_at', 'project_id', 'org_id', 'name', 'repository_url', 'git_root_hash']`
- **Fails If:** Projects array contains these strings as elements

## Usage

### Prerequisites

```bash
cd tests/validation-harnesses
npm install
```

### Standalone Execution

```bash
# Set environment variables
export API_BASE_URL="http://localhost:8000"
export ORG_ID="your-org-id"
export AUTH_TOKEN="your-jwt-token"

# Run the harness
ts-node rpc-api-data-display-endpoints-harness.ts
```

### Programmatic Usage

```typescript
import { runValidation, ValidationInput } from './rpc-api-data-display-endpoints-harness';

const input: ValidationInput = {
  apiBaseUrl: 'http://localhost:8000',
  orgId: 'org-123',
  authToken: 'eyJhbGc...',
};

const result = await runValidation(input);

console.log(`Overall: ${result.pass ? 'PASS ✓' : 'FAIL ✗'}`);
console.log(`Passed: ${result.summary.passed}/${result.summary.total}`);

// Check individual test results
result.testResults.forEach(test => {
  console.log(`${test.testName}: ${test.pass ? 'PASS' : 'FAIL'}`);
  if (!test.pass) {
    console.log(`  Error: ${test.error}`);
  }
});
```

### With Docker Compose (Local Testing)

```bash
# Start the RPC API server
cd repos/metabob-rpc-api
docker-compose up -d

# Wait for server to be ready
sleep 5

# Get auth token (login first)
export AUTH_TOKEN=$(curl -X POST http://localhost:8000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password"}' \
  | jq -r '.token')

# Get org_id from token or API
export ORG_ID="your-org-id"

# Run validation
cd ../../tests/validation-harnesses
ORG_ID=$ORG_ID AUTH_TOKEN=$AUTH_TOKEN ts-node rpc-api-data-display-endpoints-harness.ts
```

## Expected Output

### Successful Run (All Tests Pass)

```
Running API validation tests...

=== Validation Results ===
Total: 3
Passed: 3
Failed: 0
Overall: PASS ✓

=== Test Details ===

1. Project Listing Returns Objects: PASS ✓
   Metadata: {
     "responseTime": "45ms",
     "projectCount": 2
   }

2. Activity Endpoint Returns Empty Array: PASS ✓
   Metadata: {
     "responseTime": "32ms",
     "activityCount": 0
   }

3. Project Listing Not Field Names: PASS ✓
   Metadata: {
     "projectCount": 2
   }
```

### Failed Run (Bug Detected)

```
Running API validation tests...

=== Validation Results ===
Total: 3
Passed: 0
Failed: 3
Overall: FAIL ✗

=== Test Details ===

1. Project Listing Returns Objects: FAIL ✗
   Error: Projects array contains field names instead of project objects
   
2. Activity Endpoint Returns Empty Array: FAIL ✗
   Error: Activity endpoint should return empty array, not error message
   
3. Project Listing Not Field Names: FAIL ✗
   Error: BUG DETECTED: Projects array contains field names instead of project objects
```

## Exit Codes

- **0**: All tests passed
- **1**: One or more tests failed or harness error

## Integration

### CI/CD Pipeline

Add to `.github/workflows/validation.yml`:

```yaml
- name: Run RPC API Data Display Validation
  env:
    API_BASE_URL: http://localhost:8000
    ORG_ID: ${{ secrets.TEST_ORG_ID }}
    AUTH_TOKEN: ${{ secrets.TEST_AUTH_TOKEN }}
  run: |
    cd tests/validation-harnesses
    npm install
    ts-node rpc-api-data-display-endpoints-harness.ts
```

### Pre-deployment Check

```bash
#!/bin/bash
# pre-deploy-validation.sh

echo "Running RPC API Data Display validation..."

cd tests/validation-harnesses
ts-node rpc-api-data-display-endpoints-harness.ts

if [ $? -eq 0 ]; then
  echo "✓ Validation passed - safe to deploy"
  exit 0
else
  echo "✗ Validation failed - DO NOT DEPLOY"
  exit 1
fi
```

## Related Files

- **Harness:** `tests/validation-harnesses/rpc-api-data-display-endpoints-harness.ts`
- **Test Cases (Impulses):**
  - `.opencode/storage/impulses/validation-rpc-api-data-display-endpoints-case-1.json`
  - `.opencode/storage/impulses/validation-rpc-api-data-display-endpoints-case-2.json`
  - `.opencode/storage/impulses/validation-rpc-api-data-display-endpoints-case-3.json`
- **Harness Impulse:** `.opencode/storage/impulses/harness-rpc-api-data-display-endpoints.json`
- **Trace Analysis:** `.opencode/storage/impulses/trace-RPC_API_Data_Display_Endpoints.json`
- **Enforcement Summary:** `.opencode/storage/impulses/enforcement-RPC_API_Data_Display_Endpoints.json`

## Maintenance

This harness should be run:
- ✅ Before deploying RPC API changes
- ✅ After modifying `project_ops.py:list_projects_by_org`
- ✅ After modifying `activity_execution.py:get_organization_activity`
- ✅ As part of regression test suite
- ✅ When SurrealDB client library is updated

## Troubleshooting

### Authentication Errors

```
Error: API request failed: Request failed with status code 401
```

**Solution:** Verify AUTH_TOKEN is valid and not expired. Re-login to get a fresh token.

### Connection Errors

```
Error: API request failed: connect ECONNREFUSED 127.0.0.1:8000
```

**Solution:** Ensure RPC API server is running at the specified API_BASE_URL.

### No Projects Found

If validation passes but you expected to see projects, ensure:
1. Database has project records for the specified org_id
2. User has access to the organization
3. Projects were created with the correct org_id

## Specification Reference

- **Specification:** RPC API Data Display Endpoints
- **Purpose:** Fix critical data display bugs preventing dashboard from showing project information and activity
- **Root Cause:** Incorrect SurrealDB result parsing in `project_ops.py:list_projects_by_org`
- **Fix Applied:** Applied proven pattern from `api_key_ops.py:130-163` to handle 3 SurrealDB result formats
