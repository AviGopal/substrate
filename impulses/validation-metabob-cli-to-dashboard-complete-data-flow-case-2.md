# Validation Test Case 2: Problem Persistence

## Metadata
- **Impulse ID**: validation-metabob-cli-to-dashboard-complete-data-flow-case-2
- **Type**: memo
- **Test Case**: Problem Persistence
- **Purpose**: Verify problem creation persists in SurrealDB and appears in GET queries

## Input
```json
{
  "apiBaseUrl": "http://app.metabob.local",
  "jwtToken": "<from /tmp/e2e-test-creds.sh>",
  "orgId": "<from /tmp/e2e-test-creds.sh>",
  "testProblemData": {
    "session_id": "session_validation",
    "project_id": "<created_project_id>",
    "org_id": "<from input>",
    "file_path": "test/file.ts",
    "start_line": 10,
    "end_line": 15,
    "category": "code_quality",
    "severity": "HIGH",
    "description": "Test problem for validation",
    "recommendation": "Fix the issue",
    "context": { "test": true },
    "problem_hash": "hash_validation"
  }
}
```

## Expected Output
```json
{
  "pass": true,
  "actual": {
    "problemCreated": true,
    "problemRetrieved": true,
    "problemId": "<uuid>",
    "projectId": "<uuid>"
  },
  "expected": {
    "problemCreated": true,
    "problemRetrieved": true
  },
  "errors": [],
  "details": {
    "projectPersistence": true,
    "problemPersistence": true,
    "dashboardVisible": false,
    "temporalTracking": false,
    "dataHierarchy": false
  }
}
```

## Test Steps
1. POST project (prerequisite)
2. POST /api/problems with test problem data
3. Verify response is 201 CREATED with problem_id
4. Wait 1 second for persistence
5. GET /api/auth/orgs/{org_id}/projects/{project_id}/problems
6. Verify problem appears in list
7. Return PASS if both steps succeed

## Success Criteria
- POST problem returns 201 with valid problem_id
- GET returns problems array containing the created problem
- No errors in response

## Historical Note
This test verifies the fix in commit d5420bf (problem_ops.py SQL INSERT pattern)
