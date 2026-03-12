# Validation Test Case 5: Pagination Support

**Test ID**: validation-metabob-cli-to-dashboard-data-flow-case-5  
**Category**: E2E Data Flow  
**Priority**: MEDIUM

## Input

```json
{
  "testName": "Test pagination with limit and offset parameters",
  "endpoint": "GET /auth/orgs/{org_id}/projects?limit=10&offset=0",
  "authentication": "JWT Bearer token"
}
```

## Expected Output

```json
{
  "statusCode": 200,
  "response": {
    "projects": "<array_of_up_to_10_projects>",
    "total": "<total_count_of_all_projects>",
    "hasMore": "<boolean_indicating_more_pages>"
  },
  "validations": {
    "projects_array_present": true,
    "total_field_present": true,
    "has_more_field_present": true,
    "total_is_number": true,
    "has_more_is_boolean": true,
    "pagination_metadata_valid": true
  }
}
```

## Validation Steps

1. Call GET /auth/orgs/{org_id}/projects?limit=10&offset=0
2. Verify response status is 200 (OK)
3. Verify `projects` array is present
4. Verify `projects` array length <= 10 (respects limit)
5. Verify `total` field is present and is a number
6. Verify `hasMore` field is present and is a boolean
7. Verify `hasMore = true` if `total > 10`, else `hasMore = false`

## Success Criteria

- ✅ HTTP status code is 200
- ✅ `projects` array respects limit parameter
- ✅ `total` field indicates total count across all pages
- ✅ `hasMore` field correctly indicates if more pages exist
- ✅ Pagination metadata is consistent

## Failure Modes

- ❌ Missing `total` or `hasMore` fields: Pagination metadata incomplete
- ❌ `projects` array exceeds limit: Pagination broken
- ❌ `hasMore` logic incorrect: Client cannot determine if more pages exist
- ❌ HTTP 500: Server error in pagination logic

## Additional Tests

**Edge Cases**:
- Test with `limit=0` (should return empty array but valid metadata)
- Test with `limit=1000` (should be clamped to max 100 per API design)
- Test with `offset > total` (should return empty array but valid metadata)
- Test with negative `limit` or `offset` (should return validation error)

## References

- **Trace Impulse**: trace-metabob-cli-to-dashboard-data-flow
- **Gap**: Gap 4 (Project API Endpoints)
- **File**: repos/metabob-rpc-api/server/routes/projects.py:121-206
- **Function**: get_org_projects()
- **Query Parameters**: limit (default: 10, max: 100), offset (default: 0)
