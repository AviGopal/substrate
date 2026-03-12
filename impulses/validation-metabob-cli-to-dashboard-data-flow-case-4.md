# Validation Test Case 4: Multi-tenant Isolation

**Test ID**: validation-metabob-cli-to-dashboard-data-flow-case-4  
**Category**: E2E Data Flow  
**Priority**: CRITICAL (Security)

## Input

```json
{
  "testName": "Verify user can only access their own org's projects",
  "endpoint": "GET /auth/orgs/{fake_org_id}/projects",
  "authentication": "JWT Bearer token (with different org_id)",
  "fakeOrgId": "00000000-0000-0000-0000-000000000000"
}
```

## Expected Output

```json
{
  "statusCode": 403,
  "response": {
    "detail": "Access denied: org_id mismatch"
  },
  "validations": {
    "access_denied": true,
    "multi_tenant_isolation_enforced": true,
    "security_check_passed": true
  }
}
```

## Validation Steps

1. Extract `org_id` from JWT token
2. Generate a different `fake_org_id` (e.g., all zeros UUID)
3. Call GET /auth/orgs/{fake_org_id}/projects with JWT authentication
4. Verify response status is 403 (Forbidden) or 401 (Unauthorized)
5. Verify no projects from other orgs are returned
6. Verify error message indicates authorization failure

## Success Criteria

- ✅ HTTP status code is 403 or 401 (access denied)
- ✅ No projects from other organizations returned
- ✅ Error message indicates authorization failure
- ✅ Multi-tenant isolation enforced at API level

## Failure Modes

- ❌ HTTP 200: Multi-tenant isolation broken (CRITICAL SECURITY ISSUE)
- ❌ Projects from other orgs returned: Data leak vulnerability
- ❌ No error message: Silent failure
- ❌ HTTP 500: Server error instead of authorization check

## Security Implications

**CRITICAL**: This test validates that users cannot access data belonging to other organizations. Failure indicates a serious security vulnerability that could lead to data breaches.

**Implementation**: The API should validate `current_user.org_id == org_id` in the path parameter before executing any database queries.

## References

- **Trace Impulse**: trace-metabob-cli-to-dashboard-data-flow
- **Gap**: Gap 4 (Project API Endpoints)
- **File**: repos/metabob-rpc-api/server/routes/projects.py:121-206
- **Function**: get_org_projects()
- **Security Check**: `current_user.org_id` validation
