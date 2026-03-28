# Validation Test Case 4: Data Hierarchy

## Metadata
- **Impulse ID**: validation-metabob-cli-to-dashboard-complete-data-flow-case-4
- **Type**: memo
- **Test Case**: Data Hierarchy
- **Purpose**: Verify org → project → problem linkage

## Input
```json
{
  "apiBaseUrl": "http://app.metabob.local",
  "jwtToken": "<from /tmp/e2e-test-creds.sh>",
  "orgId": "<from /tmp/e2e-test-creds.sh>"
}
```

## Expected Output
```json
{
  "pass": true,
  "actual": {
    "orgToProjectLink": true,
    "projectToProblemLink": true
  },
  "expected": {
    "orgToProjectLink": true,
    "projectToProblemLink": true
  },
  "errors": [],
  "details": {
    "projectPersistence": false,
    "problemPersistence": false,
    "dashboardVisible": false,
    "temporalTracking": false,
    "dataHierarchy": true
  }
}
```

## Test Steps
1. POST project for org
2. Verify project.org_id matches input.orgId
3. POST problem for project
4. Verify problem.project_id matches project.project_id
5. Verify problem.org_id matches input.orgId
6. Return PASS if all linkages correct

## Success Criteria
- Project contains correct org_id
- Problem contains correct project_id and org_id
- No orphaned records

## Historical Note
This test verifies data hierarchy requirement from specification
