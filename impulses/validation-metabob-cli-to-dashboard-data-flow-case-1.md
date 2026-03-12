# Validation Test Case 1: Project Registration

**Test ID**: validation-metabob-cli-to-dashboard-data-flow-case-1  
**Category**: E2E Data Flow  
**Priority**: CRITICAL

## Input

```json
{
  "testName": "Project Registration via POST /auth/orgs/{org_id}/projects",
  "endpoint": "POST /auth/orgs/{org_id}/projects",
  "authentication": "JWT Bearer token",
  "payload": {
    "name": "e2e-test-<timestamp>",
    "repository_url": "<git_remote_url>",
    "branch": "<current_branch>",
    "git_root_hash": "<git_rev_parse_HEAD>",
    "settings": {}
  }
}
```

## Expected Output

```json
{
  "statusCode": 201,
  "response": {
    "project_id": "<uuid>",
    "org_id": "<org_id_from_jwt>",
    "name": "e2e-test-<timestamp>",
    "repository_url": "<git_remote_url>",
    "branch": "<current_branch>",
    "git_root_hash": "<git_rev_parse_HEAD>",
    "settings": {},
    "created_at": "<iso8601_timestamp>",
    "updated_at": "<iso8601_timestamp>"
  },
  "validations": {
    "project_id_present": true,
    "org_id_matches_jwt": true,
    "created_at_present": true,
    "updated_at_present": true,
    "timestamps_are_iso8601": true
  }
}
```

## Validation Steps

1. Extract `org_id` from JWT token (decode without verification)
2. Call POST /auth/orgs/{org_id}/projects with project metadata
3. Verify response status is 201 (Created) or 200 (OK, idempotent)
4. Verify `project_id` is present and is a valid UUID
5. Verify `org_id` in response matches `org_id` from JWT
6. Verify `created_at` and `updated_at` timestamps are present
7. Verify timestamps are in ISO8601 format
8. Store `project_id` for subsequent tests

## Success Criteria

- ✅ HTTP status code is 201 or 200
- ✅ Response contains valid `project_id` UUID
- ✅ Response `org_id` matches JWT `org_id`
- ✅ Timestamps are present and in ISO8601 format
- ✅ Project can be queried via GET /auth/orgs/{org_id}/projects

## Failure Modes

- ❌ HTTP 401/403: Authentication/authorization failure
- ❌ HTTP 500: Server error (check logs for datetime serialization, SurrealDB connection)
- ❌ Missing `project_id`: Response parsing error
- ❌ `org_id` mismatch: Multi-tenant isolation broken
- ❌ Missing timestamps: Schema compliance issue

## References

- **Trace Impulse**: trace-metabob-cli-to-dashboard-data-flow
- **Gap**: Gap 1 (CLI Project Registration) + Gap 4 (Project API Endpoints)
- **File**: repos/metabob-rpc-api/server/routes/projects.py:21-118
- **Function**: create_org_project()
