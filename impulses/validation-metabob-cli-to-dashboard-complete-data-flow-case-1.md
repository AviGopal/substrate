# Validation Test Case 1: Project Persistence

## Metadata
- **Impulse ID**: validation-metabob-cli-to-dashboard-complete-data-flow-case-1
- **Type**: memo
- **Test Case**: Project Persistence
- **Purpose**: Verify project creation persists in SurrealDB and appears in GET queries

## Input
```json
{
  "apiBaseUrl": "http://app.metabob.local",
  "jwtToken": "<from /tmp/e2e-test-creds.sh>",
  "orgId": "<from /tmp/e2e-test-creds.sh>",
  "testProjectName": "Test Project Validation"
}
```

## Expected Output
```json
{
  "pass": true,
  "actual": {
    "projectCreated": true,
    "projectRetrieved": true,
    "projectId": "<uuid>"
  },
  "expected": {
    "projectCreated": true,
    "projectRetrieved": true
  },
  "errors": [],
  "details": {
    "projectPersistence": true,
    "problemPersistence": false,
    "dashboardVisible": false,
    "temporalTracking": false,
    "dataHierarchy": false
  }
}
```

## Test Steps
1. POST /api/auth/orgs/{org_id}/projects with test project data
2. Verify response is 201 CREATED with project_id
3. Wait 1 second for persistence
4. GET /api/auth/orgs/{org_id}/projects
5. Verify project appears in list
6. Return PASS if both steps succeed

## Success Criteria
- POST returns 201 with valid project_id
- GET returns projects array containing the created project
- No errors in response

## Historical Note
This test verifies the fix in commit adb858a (project_ops.py SQL INSERT pattern)
