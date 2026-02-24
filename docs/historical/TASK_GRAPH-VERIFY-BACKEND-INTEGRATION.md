# Task Graph: Verify metabob-cli Backend Integration

## Overview
- **Total tasks**: 5
- **Execution pattern**: Linear with parallel merge (tasks 2-4 can partially overlap after task 1)
- **Estimated duration**: 12-18 minutes
- **Estimated cost**: $0.60-$0.90 USD

This activity verifies that metabob-rpc-api is the authoritative backend source of truth for activity templates, metabob-cli acts as the client/gateway, and local .metabob/ directories are cache only.

## Task Breakdown

### Task 1: verify-backend-api-endpoints
- **Description**: Test all metabob-rpc-api endpoints for activity templates and document their behavior
- **Agent**: tool
- **Dependencies**: none
- **Token Budget**: 12,000
- **Validation**:
  - Required files: None (creates section in report)
  - Required patterns: 
    - "GET /api/v1/activities.*200"
    - "POST /api/v1/activities.*201"
    - "Backend API endpoints verified"
  - Forbidden patterns: 
    - "Connection refused"
    - "Backend unreachable"
    - "ECONNREFUSED"
  - Commands:
    ```bash
    # Verify backend is responding
    curl -f ${backend_url}/health
    ```
- **Retry Strategy**: progressive-context (add backend logs if initial attempt fails)
- **Subtasks**:
  1. Check backend health endpoint (${backend_health_endpoint})
  2. Test GET /api/v1/activities (list templates)
  3. Test GET /api/v1/activities/{id} with known template
  4. Test POST /api/v1/activities with test payload
  5. Test PUT /api/v1/activities/{id} to update test template
  6. Document response formats and status codes
  7. Create initial section in VERIFICATION_REPORT.md

### Task 2: test-template-registration-and-retrieval
- **Description**: Register test template, verify backend storage, test retrieval flow with cache behavior
- **Agent**: tool
- **Dependencies**: verify-backend-api-endpoints
- **Token Budget**: 14,000
- **Validation**:
  - Required files: None (appends to report)
  - Required patterns:
    - "Template registration flow verified"
    - "Template retrieval flow verified"
    - "Template stored in metabob-rpc-api"
    - "cache miss.*backend.*cache hit"
  - Forbidden patterns:
    - "Template not found in backend"
    - "Registration failed"
    - "Cache miss.*cache miss" (should hit backend)
  - Commands:
    ```bash
    # Verify test template exists in backend
    curl -f ${backend_url}/api/v1/activities/${test_template_id}
    
    # Verify cache directory exists
    test -d ${cache_directory}
    ```
- **Retry Strategy**: progressive-context (add metabob-cli logs if registration fails)
- **Subtasks**:
  1. Create test template payload (${test_template_id})
  2. Register template via metabob-cli MCP or backend API
  3. Verify template appears in backend (GET /api/v1/activities/${test_template_id})
  4. Clear local cache (rm -rf ${cache_directory}/*)
  5. Query template via metabob-cli (should trigger backend call)
  6. Verify cache populated from backend response
  7. Query template again (should be cache hit, no backend call)
  8. Document registration and retrieval flows in report

### Task 3: test-cache-behavior-and-backend-priority
- **Description**: Verify cache acts as cache only (not source of truth) and backend data takes priority
- **Agent**: test
- **Dependencies**: test-template-registration-and-retrieval
- **Token Budget**: 13,000
- **Validation**:
  - Required files: None (appends to report)
  - Required patterns:
    - "Cache acts as cache only"
    - "Backend data takes priority"
    - "Stale data not served"
    - "Cache invalidation verified"
  - Forbidden patterns:
    - "Stale data served from cache"
    - "Cache overrides backend"
    - "Backend query skipped"
  - Commands:
    ```bash
    # Verify cache exists but test template deleted from backend returns 404
    curl -f ${backend_url}/api/v1/activities/${test_template_id} && echo "ERROR: Template should be deleted" || echo "OK: Template deleted from backend"
    ```
- **Retry Strategy**: simple (cache behavior should be deterministic)
- **Subtasks**:
  1. **Cache-Only Test**: Delete test template from backend (DELETE /api/v1/activities/${test_template_id})
  2. Verify cache still has stale data (check ${cache_directory})
  3. Query template via metabob-cli (should return 404, not serve stale cache)
  4. Verify cache invalidated after 404 response
  5. **Backend Priority Test**: Re-register test template in backend with different data (name: "Updated Template")
  6. Manually place old version in cache (name: "Original Template")
  7. Query template via metabob-cli (should return backend version "Updated Template")
  8. Verify cache updated with new backend data
  9. Document cache behavior and backend priority in report

### Task 4: test-network-failure-scenarios
- **Description**: Verify graceful degradation when backend is unavailable and recovery after restart
- **Agent**: test
- **Dependencies**: test-template-registration-and-retrieval
- **Token Budget**: 11,000
- **Validation**:
  - Required files: None (appends to report)
  - Required patterns:
    - "Network failure scenarios handled correctly"
    - "Backend unavailable.*clear error"
    - "Graceful degradation"
    - "Recovery successful"
  - Forbidden patterns:
    - "Silent failure"
    - "Unhelpful error message"
    - "Recovery failed"
  - Commands:
    ```bash
    # Verify backend is back online after test
    curl -f ${backend_url}/health
    ```
- **Retry Strategy**: simple (network tests should be deterministic)
- **Subtasks**:
  1. Note: This may require manual backend control (docker-compose stop/start)
  2. **Failure Test**: Stop metabob-rpc-api backend service (if possible via docker/systemctl)
  3. Attempt template registration (should fail with clear error mentioning backend unavailability)
  4. Attempt template retrieval with valid cache (may succeed from cache - graceful degradation)
  5. Clear cache and attempt retrieval without cache (should fail with clear error)
  6. **Recovery Test**: Restart metabob-rpc-api backend service
  7. Wait for backend health check to pass
  8. Verify subsequent template queries work normally
  9. Document network failure handling in report
  10. Note: If backend control not possible, document limitation and skip

### Task 5: generate-verification-report-and-recommendations
- **Description**: Aggregate all test results, create final report with architecture comparison and recommendations
- **Agent**: docs
- **Dependencies**: verify-backend-api-endpoints, test-template-registration-and-retrieval, test-cache-behavior-and-backend-priority, test-network-failure-scenarios
- **Token Budget**: 10,000
- **Validation**:
  - Required files: 
    - "VERIFICATION_REPORT.md"
  - Required patterns:
    - "Backend API endpoints verified"
    - "Template registration flow"
    - "Template retrieval flow"
    - "Cache behavior"
    - "Backend priority"
    - "Network failure"
    - "Summary:.*passed.*failed"
    - "Data flow:.*backend.*metabob-cli.*cache"
  - Forbidden patterns:
    - "TODO"
    - "INCOMPLETE"
    - "test not run"
  - Commands:
    ```bash
    # Verify report exists with all sections
    test -f VERIFICATION_REPORT.md
    grep -q "Backend API endpoints verified" VERIFICATION_REPORT.md
    grep -q "Template registration flow" VERIFICATION_REPORT.md
    grep -q "Template retrieval flow" VERIFICATION_REPORT.md
    grep -q "Cache behavior" VERIFICATION_REPORT.md
    grep -q "Backend priority" VERIFICATION_REPORT.md
    grep -q "Network failure" VERIFICATION_REPORT.md
    
    # Cleanup test template if skip_cleanup=false
    if [ "${skip_cleanup}" = "false" ]; then
      curl -X DELETE ${backend_url}/api/v1/activities/${test_template_id}
    fi
    ```
- **Retry Strategy**: simple (documentation task)
- **Subtasks**:
  1. Read ARCHITECTURE_CORRECTION.md to understand intended architecture
  2. Aggregate all test results from previous tasks
  3. Create VERIFICATION_REPORT.md with:
     - Executive summary (pass/fail counts, overall assessment)
     - Backend API endpoint verification results (Task 1)
     - Template registration flow results (Task 2)
     - Template retrieval flow results (Task 2)
     - Cache behavior validation results (Task 3)
     - Backend priority test results (Task 3)
     - Network failure scenario results (Task 4)
     - Data flow diagram (backend → metabob-cli → cache)
     - Comparison to ARCHITECTURE_CORRECTION.md intent
     - Recommendations for fixes (if issues found)
  4. Create console summary with key findings
  5. Clean up test template from backend (unless skip_cleanup=true)
  6. Clean up test data from cache
  7. Print final assessment: "✅ Integration verified" or "❌ Issues found requiring fixes"

## Dependency Graph (ASCII)

```
Task 1: verify-backend-api-endpoints
   |
   ├─────────────────────────┐
   |                         |
   v                         v
Task 2: test-template-       Task 4: test-network-
        registration-and-            failure-scenarios
        retrieval                    (can run in parallel)
   |
   v
Task 3: test-cache-behavior-
        and-backend-priority
   |
   └─────────────────────────┘
                |
                v
Task 5: generate-verification-
        report-and-recommendations
```

**Execution Flow**:
1. Task 1 runs first (verify backend is functional)
2. Tasks 2 and 4 can run in parallel after Task 1 (both test backend behavior independently)
3. Task 3 depends on Task 2 (needs registered template to test cache behavior)
4. Task 5 runs last (aggregates all results into final report)

**Note**: In practice, Tasks 2-4 will likely run sequentially for clarity, but the dependency graph allows Task 4 to run in parallel with Task 2 if needed.

## Token Budget Summary
- Task 1: 12,000 tokens (~$0.12)
- Task 2: 14,000 tokens (~$0.14)
- Task 3: 13,000 tokens (~$0.13)
- Task 4: 11,000 tokens (~$0.11)
- Task 5: 10,000 tokens (~$0.10)
- **Total**: 60,000 tokens (~$0.60 USD)

**Notes**:
- Estimates assume $0.01 per 1K tokens (Claude Sonnet pricing)
- Actual costs may vary based on context size and model used
- Retry attempts will increase token usage
- Network delays (Task 4) don't affect token usage

## Agent Distribution
- **tool**: 2 tasks (Tasks 1, 2) - 26,000 tokens (43%)
- **test**: 2 tasks (Tasks 3, 4) - 24,000 tokens (40%)
- **docs**: 1 task (Task 5) - 10,000 tokens (17%)

## Variable Propagation

The following variables flow through tasks:

- `backend_url` - Used in Tasks 1, 2, 3, 4, 5 (API calls, validation commands)
- `backend_health_endpoint` - Used in Tasks 1, 4 (health checks)
- `test_template_id` - Used in Tasks 2, 3, 5 (template operations, cleanup)
- `test_template_name` - Used in Task 2 (template creation)
- `cache_directory` - Used in Tasks 2, 3, 5 (cache manipulation, validation)
- `skip_cleanup` - Used in Task 5 (conditional cleanup)
- `output_report_path` - Used in Tasks 1-5 (report generation)
- `check_database_directly` - Used in Task 2 (optional DB verification)
- `metabob_cli_path` - Used in Tasks 2, 3, 4 (MCP tool invocation)

## Risk Assessment

**High-Risk Tasks**:
- **Task 1**: If backend is down, entire activity fails (CRITICAL - add retry with clear error)
- **Task 4**: Backend control may not be available (MEDIUM - allow graceful skip)

**Medium-Risk Tasks**:
- **Task 2**: Template registration may fail due to schema issues (add detailed error logging)
- **Task 3**: Cache behavior depends on metabob-cli implementation (may reveal bugs)

**Low-Risk Tasks**:
- **Task 5**: Documentation task, should always succeed (minimal risk)

## Success Criteria

Activity succeeds if:
1. ✅ All backend API endpoints (GET, POST, PUT, DELETE) respond correctly
2. ✅ Test template stored in backend and retrievable via API
3. ✅ Cache populated from backend on cache miss
4. ✅ Stale cache not served when backend data deleted
5. ✅ Backend data overrides cached data on conflicts
6. ✅ Network failures produce clear errors (not silent failures)
7. ✅ VERIFICATION_REPORT.md created with all test results
8. ✅ Architecture matches ARCHITECTURE_CORRECTION.md intent

Activity fails if:
1. ❌ Backend API endpoints missing or non-functional
2. ❌ Template only in cache (not in backend)
3. ❌ Cache served without checking backend
4. ❌ Stale cache data served as authoritative
5. ❌ Cached data overrides backend data
6. ❌ Silent failures on network issues
7. ❌ Report incomplete or missing critical sections
8. ❌ Architecture deviates from documented intent

## Additional Notes

### Task Grouping Rationale

**Why 5 tasks instead of 7?**
- Original requirements had 7 workflow steps
- Grouped related operations for efficiency:
  - Steps 2 + 3 → Task 2 (registration + retrieval are closely related)
  - Steps 4 + 5 → Task 3 (both test cache behavior)
  - Step 6 → Task 4 (network failures)
  - Step 7 → Task 5 (documentation)
- This reduces agent context switching and overhead

### Parallel Execution Opportunity

Tasks 2 and 4 can technically run in parallel because:
- Task 2 tests normal operation (registration + retrieval)
- Task 4 tests failure scenarios (backend down)
- Neither depends on the other's results
- Both only need Task 1 (backend endpoint verification)

However, for clarity and debugging, sequential execution (1 → 2 → 3 → 4 → 5) is recommended.

### Test Template Lifecycle

1. **Task 1**: Backend verified functional
2. **Task 2**: Test template registered in backend
3. **Task 3**: Template deleted, re-registered with new data
4. **Task 4**: Template used for network failure tests
5. **Task 5**: Template cleaned up (unless skip_cleanup=true)

### Backend Control Limitations

**Task 4** (network failure testing) requires stopping/starting the metabob-rpc-api backend service. This may not be possible in all environments:

- **Docker**: `docker-compose stop metabob-rpc-api` / `docker-compose start metabob-rpc-api`
- **Systemd**: `sudo systemctl stop metabob-rpc-api` / `sudo systemctl start metabob-rpc-api`
- **Manual**: Developer-controlled process

If backend control is not available, Task 4 should:
1. Document the limitation in the report
2. Skip network failure tests gracefully
3. Mark this section as "Not tested - backend control unavailable"
4. Provide manual testing instructions for developers

This is acceptable because network failure testing, while valuable, is not critical for verifying the core architecture (backend as source of truth).

### Cache Directory Location

The `cache_directory` variable (default: `./.metabob`) may vary:
- **metabob-cli local cache**: `.metabob/` in project root
- **User-specific cache**: `~/.metabob/`
- **Custom location**: Configurable in metabob-cli

Tasks should handle all cases by:
1. Checking if cache directory exists
2. Using variable substitution for paths
3. Creating cache directory if needed for tests
4. Documenting actual location in report

### Database Verification

If `check_database_directly=true`, Task 2 should:
1. Attempt to connect to backend database
2. Query activity_templates table for test template
3. Confirm template stored in database (not just cached in backend memory)

This is OPTIONAL because:
- Requires database credentials
- May not be available in all environments
- API verification (checking GET endpoint) is sufficient for most cases

If database connection fails, log a warning and continue with API-only verification.
