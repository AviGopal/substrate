# Validation Test Case 6: OpenAPI Schema Registration

**Test ID**: validation-metabob-cli-to-dashboard-data-flow-case-6  
**Category**: E2E Data Flow  
**Priority**: MEDIUM

## Input

```json
{
  "testName": "Verify API endpoints are registered in OpenAPI schema",
  "endpoint": "GET /openapi.json",
  "authentication": "None (public endpoint)"
}
```

## Expected Output

```json
{
  "statusCode": 200,
  "response": {
    "openapi": "3.x.x",
    "paths": {
      "/auth/orgs/{org_id}/projects": {
        "post": "<endpoint_definition>",
        "get": "<endpoint_definition>"
      },
      "/v2/submit": {
        "post": "<endpoint_definition>"
      }
    }
  },
  "validations": {
    "openapi_spec_valid": true,
    "projects_post_endpoint_present": true,
    "projects_get_endpoint_present": true,
    "v2_submit_endpoint_present": true,
    "all_critical_endpoints_registered": true
  }
}
```

## Validation Steps

1. Call GET /openapi.json (no authentication required)
2. Verify response status is 200 (OK)
3. Parse JSON response
4. Verify `paths` object exists
5. Verify `/auth/orgs/{org_id}/projects` path exists
6. Verify `POST` and `GET` methods exist for projects endpoint
7. Verify `/v2/submit` path exists with `POST` method

## Success Criteria

- ✅ HTTP status code is 200
- ✅ OpenAPI spec is valid JSON
- ✅ All critical endpoints are registered in schema
- ✅ Endpoints have correct HTTP methods
- ✅ Schema generation working correctly

## Failure Modes

- ❌ Endpoints missing from schema: Route registration issue (see commit 54a82ec fix)
- ❌ Invalid JSON: OpenAPI generation broken
- ❌ Wrong HTTP methods: Route definition error
- ❌ HTTP 404: OpenAPI endpoint not configured

## Context

**Historical Issue**: Prior to commit 54a82ec, routes in `cloud_auth.py` were silently dropped during app initialization. This was fixed by creating a separate `server/routes/projects.py` router.

**Regression Prevention**: This test ensures that future route additions are properly registered and visible in the OpenAPI schema.

## References

- **Trace Impulse**: trace-metabob-cli-to-dashboard-data-flow
- **Gap**: Gap 4 (Project API Endpoints)
- **Fix Commit**: 54a82ec (FastAPI Route Registration)
- **File**: repos/metabob-rpc-api/server/routes/projects.py
- **Verification Command**: `curl -s "http://api.metabob.local/openapi.json" | jq '.paths | keys'`
