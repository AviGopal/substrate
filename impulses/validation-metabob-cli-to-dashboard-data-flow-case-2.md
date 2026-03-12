# Validation Test Case 2: SurrealDB Project Query

**Test ID**: validation-metabob-cli-to-dashboard-data-flow-case-2  
**Category**: E2E Data Flow  
**Priority**: CRITICAL

## Input

```json
{
  "testName": "Query SurrealDB to verify project persistence",
  "endpoint": "GET /auth/orgs/{org_id}/projects",
  "authentication": "JWT Bearer token",
  "projectId": "<project_id_from_case_1>"
}
```

## Expected Output

```json
{
  "statusCode": 200,
  "response": {
    "projects": [
      {
        "project_id": "<project_id_from_case_1>",
        "org_id": "<org_id_from_jwt>",
        "name": "e2e-test-<timestamp>",
        "repository_url": "<git_remote_url>",
        "branch": "<current_branch>",
        "git_root_hash": "<git_rev_parse_HEAD>",
        "settings": {},
        "created_at": "<iso8601_timestamp>",
        "updated_at": "<iso8601_timestamp>"
      }
    ],
    "total": ">=1",
    "hasMore": "<boolean>"
  },
  "validations": {
    "project_found_in_list": true,
    "org_id_matches": true,
    "surrealdb_persistence_verified": true
  }
}
```

## Validation Steps

1. Call GET /auth/orgs/{org_id}/projects with JWT authentication
2. Verify response status is 200 (OK)
3. Parse `projects` array from response
4. Search for project with `project_id` matching Case 1
5. Verify project is found in the list
6. Verify project `org_id` matches JWT `org_id`
7. Verify pagination metadata (`total`, `hasMore`) is present

## Success Criteria

- ✅ HTTP status code is 200
- ✅ Project from Case 1 is found in projects list
- ✅ Project `org_id` matches JWT `org_id`
- ✅ Pagination metadata is present and valid
- ✅ SurrealDB persistence confirmed

## Failure Modes

- ❌ HTTP 404: Project not found in SurrealDB
- ❌ HTTP 500: SurrealDB query error
- ❌ Project not in list: Write to SurrealDB failed or delayed
- ❌ Empty projects array: Multi-tenant isolation issue or no projects exist
- ❌ Missing pagination metadata: API response schema issue

## References

- **Trace Impulse**: trace-metabob-cli-to-dashboard-data-flow
- **Gap**: Gap 4 (Project API Endpoints)
- **File**: repos/metabob-rpc-api/server/routes/projects.py:121-206
- **Function**: get_org_projects()
- **Database Operation**: repos/metabob-rpc-api/server/db/operations/project_ops.py:list_projects_by_org()
