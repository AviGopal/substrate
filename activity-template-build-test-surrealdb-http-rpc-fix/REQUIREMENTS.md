# Activity Requirements: Build and Test SurrealDB HTTP RPC Fix

## Overview

This activity template automates the process of building and testing the HTTP RPC persistence fix for SurrealDB in an isolated Docker environment. The fix replaces the buggy surrealdb-py library with direct HTTP RPC calls to resolve template persistence issues (404 errors on retrieval). This template ensures the fix works correctly before deploying to production Kubernetes clusters.

## Workflow Steps

1. **Verify Build Context**: Check that necessary files exist for building Docker image (Dependencies: none)
   - Verify Dockerfile.devbob-local exists
   - Verify docker-compose.unified.yaml exists
   - Verify source code files are present

2. **Build Docker Image**: Build the metabob-devbob image with HTTP RPC client fix (Dependencies: Step 1)
   - Build using docker-compose or docker build command
   - Tag with test version identifier
   - Verify image built successfully

3. **Start Local Environment**: Launch docker-compose services with SurrealDB and devbob (Dependencies: Step 2)
   - Start SurrealDB container
   - Start devbob container with new image
   - Wait for services to be healthy
   - Verify connectivity between services

4. **Run Template CRUD Tests**: Execute tests to verify template persistence operations (Dependencies: Step 3)
   - Test template creation (POST/register)
   - Test template retrieval by ID (GET)
   - Test template listing (GET all)
   - Verify no 404 errors on retrieval
   - Check that templates persist after service restart

5. **Validate Persistence**: Restart services and verify templates still exist (Dependencies: Step 4)
   - Stop devbob container
   - Restart devbob container
   - Retrieve templates created in previous step
   - Confirm data persisted correctly

6. **Collect Results**: Gather test outputs and logs for review (Dependencies: Step 5)
   - Export test results
   - Collect relevant container logs
   - Generate success/failure report

7. **Cleanup**: Stop and remove test containers (Dependencies: Step 6)
   - Stop all containers
   - Remove test containers (optional: preserve for debugging)
   - Clean up test data

## Input Variables

| Variable | Type | Required | Default | Description |
|----------|------|----------|---------|-------------|
| dockerImageTag | string | no | "http-rpc-fix-test" | Tag for the Docker image to build |
| composeFile | string | no | "docker-compose.unified.yaml" | Path to docker-compose file |
| testTemplateId | string | no | "test-template-http-rpc" | ID for test template to create |
| testTemplateName | string | no | "Test Template HTTP RPC" | Name for test template |
| surrealdbHost | string | no | "surrealdb" | Hostname of SurrealDB service |
| surrealdbPort | number | no | 8000 | Port for SurrealDB HTTP RPC |
| waitTimeout | number | no | 60 | Seconds to wait for services to be ready |
| preserveContainers | boolean | no | false | Keep containers running after tests for debugging |
| skipBuild | boolean | no | false | Skip Docker build step (use existing image) |

## Expected Outputs

- **File**: `activity-template-build-test-surrealdb-http-rpc-fix/test-results.json` - Detailed test results with pass/fail status
- **File**: `activity-template-build-test-surrealdb-http-rpc-fix/build.log` - Docker build logs
- **File**: `activity-template-build-test-surrealdb-http-rpc-fix/service.log` - Container runtime logs
- **Report**: Summary showing:
  - Build success/failure
  - Service startup success/failure
  - Template CRUD operations results
  - Persistence validation results
  - Overall pass/fail status
- **State**: 
  - Docker image built and tagged
  - Test templates created in SurrealDB
  - Validation that templates persist across restarts

## Validation Criteria

### Per-Task Validation

- **Task 1 (Verify Build Context)**: 
  - Dockerfile.devbob-local exists
  - docker-compose.unified.yaml exists
  - Source files in expected locations

- **Task 2 (Build Docker Image)**: 
  - Docker build exits with code 0
  - Image exists in `docker images` output
  - No build errors in output

- **Task 3 (Start Local Environment)**: 
  - All containers show "running" status
  - Health checks pass
  - SurrealDB responds to HTTP requests

- **Task 4 (Run Template CRUD Tests)**: 
  - Template creation returns 200/201 status
  - Template retrieval returns 200 status (not 404)
  - Template data matches what was created
  - No error messages in response

- **Task 5 (Validate Persistence)**: 
  - Container restart successful
  - Template still retrievable after restart
  - Template data unchanged

- **Task 6 (Collect Results)**: 
  - test-results.json file created
  - Log files contain expected content
  - Report generated successfully

- **Task 7 (Cleanup)**: 
  - Containers stopped (unless preserveContainers=true)
  - No orphaned containers running

### Overall Success

**Required Files Exist**:
- activity-template-build-test-surrealdb-http-rpc-fix/test-results.json
- activity-template-build-test-surrealdb-http-rpc-fix/build.log

**Required Patterns Found**:
- In build.log: "Successfully built", "Successfully tagged"
- In test-results.json: `"status": "success"` or `"passed": true`
- In service.log: "SurrealDB started", "HTTP RPC endpoint listening"
- Template retrieval responses: HTTP 200 status codes

**Forbidden Patterns**:
- In test-results.json: `"status": "error"`, `404`, `"failed": true`
- In build.log: "ERROR", "FAILED", "Cannot build"
- In service.log: "Connection refused", "Failed to connect", "Database error"
- Python tracebacks or exceptions related to surrealdb-py

**Commands Pass**:
```bash
# Verify image exists
docker images | grep metabob-devbob | grep http-rpc-fix-test

# Verify SurrealDB is accessible
curl -X POST http://localhost:8000/sql -H "Content-Type: application/json" -d '{"sql":"INFO FOR DB;"}'

# Verify test results show success
cat activity-template-build-test-surrealdb-http-rpc-fix/test-results.json | grep -q '"status":"success"'
```

## Error Handling

### Common Failures

1. **Docker Build Failure**
   - **Cause**: Missing dependencies, syntax errors in Dockerfile, network issues
   - **Handling**: Capture full build output, check Dockerfile syntax, verify base image availability
   - **Retry**: Yes, up to 2 retries with exponential backoff (network issues)
   - **Debug Info**: Full build log, Docker version, base image version

2. **Service Startup Failure**
   - **Cause**: Port conflicts, insufficient resources, container crashes
   - **Handling**: Check port availability, inspect container logs, verify resource limits
   - **Retry**: Yes, up to 2 retries (port conflicts may resolve)
   - **Debug Info**: `docker ps`, `docker logs`, port binding status

3. **Template Creation Failure**
   - **Cause**: HTTP RPC client bug, network connectivity, SurrealDB not ready
   - **Handling**: Verify SurrealDB health, test HTTP RPC endpoint directly, check credentials
   - **Retry**: Yes, up to 3 retries with delay (readiness issue)
   - **Debug Info**: Full HTTP request/response, SurrealDB logs, network connectivity test

4. **Template Retrieval 404 Error**
   - **Cause**: Persistence bug, wrong namespace/database, HTTP client implementation error
   - **Handling**: This is the primary bug being fixed - capture detailed logs and fail the test
   - **Retry**: No (this indicates the fix doesn't work)
   - **Debug Info**: Full HTTP request/response, SurrealDB query logs, template ID used

5. **Persistence Validation Failure**
   - **Cause**: Data not persisted, volume mount issues, database corruption
   - **Handling**: Check volume mounts, verify SurrealDB data directory, inspect database integrity
   - **Retry**: No (indicates data loss)
   - **Debug Info**: Volume mount status, SurrealDB data directory contents, database info queries

### Retry Strategy

- **Network/Infrastructure Issues**: Retry up to 3 times with exponential backoff (2s, 4s, 8s)
- **Service Readiness Issues**: Retry with fixed delay (5s between attempts)
- **Data Integrity Issues**: No retry - fail immediately with detailed diagnostics
- **Build Issues**: Retry once after clearing Docker cache

### Debug Information Collection

For all failures, collect:
- Full command output and exit codes
- Container logs (last 100 lines minimum)
- Docker inspect output for containers
- SurrealDB query logs
- HTTP request/response payloads
- Timestamp of failure
- Environment variables and configuration
- Network connectivity test results

## Success Criteria Summary

✅ **Activity succeeds when**:
1. Docker image builds without errors
2. All containers start and become healthy
3. Template can be created via HTTP RPC
4. Template can be retrieved via HTTP RPC (no 404)
5. Template persists after service restart
6. All validation checks pass
7. No forbidden error patterns detected

❌ **Activity fails when**:
- Any step returns non-zero exit code after retries
- 404 errors occur on template retrieval
- Templates don't persist across restarts
- Build or service logs contain critical errors
- Required files missing after completion
