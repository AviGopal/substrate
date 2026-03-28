# Validation Test Case 3: Temporal Tracking

## Metadata
- **Impulse ID**: validation-metabob-cli-to-dashboard-complete-data-flow-case-3
- **Type**: memo
- **Test Case**: Temporal Tracking
- **Purpose**: Verify created_at and updated_at fields with ISO 8601 'Z' suffix

## Input
```json
{
  "apiBaseUrl": "http://app.metabob.local",
  "jwtToken": "<from /tmp/e2e-test-creds.sh>",
  "orgId": "<from /tmp/e2e-test-creds.sh>",
  "testProjectName": "Temporal Validation Test"
}
```

## Expected Output
```json
{
  "pass": true,
  "actual": {
    "hasCreatedAt": true,
    "hasUpdatedAt": true,
    "hasZSuffix": true
  },
  "expected": {
    "hasCreatedAt": true,
    "hasUpdatedAt": true,
    "hasZSuffix": true
  },
  "errors": [],
  "details": {
    "projectPersistence": false,
    "problemPersistence": false,
    "dashboardVisible": false,
    "temporalTracking": true,
    "dataHierarchy": false
  }
}
```

## Test Steps
1. POST project
2. Verify response contains created_at field
3. Verify response contains updated_at field
4. Verify both timestamps end with 'Z' (ISO 8601 UTC)
5. Return PASS if all checks succeed

## Success Criteria
- created_at field exists and is ISO 8601 with 'Z'
- updated_at field exists and is ISO 8601 with 'Z'
- Both timestamps are valid dates

## Historical Note
This test verifies temporal tracking requirement from specification
