# Validation Test Case 3: Project Registration Idempotency

**Test ID**: validation-metabob-cli-to-dashboard-data-flow-case-3  
**Category**: E2E Data Flow  
**Priority**: HIGH

## Input

```json
{
  "testName": "Create same project again - should return existing project_id",
  "endpoint": "POST /auth/orgs/{org_id}/projects",
  "authentication": "JWT Bearer token",
  "payload": {
    "name": "e2e-test-<timestamp>",
    "repository_url": "<git_remote_url>",
    "branch": "<current_branch>",
    "git_root_hash": "<git_rev_parse_HEAD>",
    "settings": {}
  },
  "note": "Same payload as Case 1"
}
```

## Expected Output

```json
{
  "statusCode": 200,
  "response": {
    "project_id": "<project_id_from_case_1>",
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
    "project_id_same_as_case_1": true,
    "status_code_200_not_201": true,
    "idempotency_verified": true,
    "no_duplicate_project_created": true
  }
}
```

## Validation Steps

1. Call POST /auth/orgs/{org_id}/projects with **identical payload** from Case 1
2. Verify response status is 200 (OK, existing project) not 201 (Created)
3. Verify `project_id` in response matches `project_id` from Case 1
4. Verify no duplicate project was created in SurrealDB
5. Verify `created_at` timestamp is unchanged (same as Case 1)
6. Verify `updated_at` may be same or newer (acceptable either way)

## Success Criteria

- ✅ HTTP status code is 200 (not 201)
- ✅ `project_id` matches Case 1 exactly
- ✅ No duplicate project exists in database
- ✅ `created_at` timestamp unchanged
- ✅ Idempotency contract enforced

## Failure Modes

- ❌ HTTP 201: New project created (idempotency broken)
- ❌ Different `project_id`: Duplicate project created
- ❌ HTTP 500: Database constraint violation or error
- ❌ `created_at` changed: Idempotency update issue

## Design Notes

**Idempotency Key**: The combination of `(org_id, repository_url, branch, git_root_hash)` should uniquely identify a project. The API should return the existing project if these match.

**Alternative Design**: Some APIs use status code 201 for both create and idempotent create. The important validation is that `project_id` remains constant.

## References

- **Trace Impulse**: trace-metabob-cli-to-dashboard-data-flow
- **Gap**: Gap 1 (CLI Project Registration) + Gap 4 (Project API Endpoints)
- **File**: repos/metabob-rpc-api/server/routes/projects.py:21-118
- **Function**: create_org_project()
- **Database Operation**: repos/metabob-rpc-api/server/db/operations/project_ops.py:create_project()
