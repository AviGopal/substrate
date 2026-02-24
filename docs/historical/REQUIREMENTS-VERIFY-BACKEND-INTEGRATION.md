# Activity Requirements: Verify metabob-cli Backend Integration

## Overview
This activity verifies that metabob-cli correctly integrates with metabob-rpc-api as the backend source of truth for activity template storage and retrieval. The verification ensures that:
1. Activity templates are stored in metabob-rpc-api (not just local cache)
2. The metabob-rpc-api endpoints exist and work correctly
3. Local `.metabob/` directories function as cache only
4. The architecture matches the intent documented in ARCHITECTURE_CORRECTION.md

This addresses a critical architectural concern: ensuring the implemented system matches the documented intent where metabob-rpc-api is the authoritative backend, metabob-cli is the client/gateway, and local directories are ephemeral cache.

## Workflow Steps

1. **Verify Backend API Endpoints Exist**: Check that metabob-rpc-api has the required endpoints for activity template CRUD operations (Dependencies: none)
   - Test GET /api/v1/activities (list templates)
   - Test GET /api/v1/activities/{id} (get specific template)
   - Test POST /api/v1/activities (register template)
   - Test PUT /api/v1/activities/{id} (update template)
   - Document endpoint behavior and response formats

2. **Test Template Registration Flow**: Register a test activity template and verify it reaches metabob-rpc-api backend (Dependencies: Step 1)
   - Create test template payload
   - Register template via metabob-cli MCP tool or API
   - Verify template appears in backend database/storage
   - Confirm backend returns template in list/get operations
   - Check local .metabob/ cache behavior

3. **Test Template Retrieval Flow**: Retrieve the test template and verify it comes from backend, not just local cache (Dependencies: Step 2)
   - Clear local .metabob/ cache
   - Query template via metabob-cli
   - Verify backend API is called (check logs or network traffic)
   - Confirm cache is populated from backend response
   - Test cache-hit scenario (subsequent queries)

4. **Verify Cache-Only Behavior**: Confirm local `.metabob/` directories act as cache, not source of truth (Dependencies: Step 2, Step 3)
   - Delete template from backend
   - Verify local cache still has stale data
   - Query template via metabob-cli
   - Confirm query fails (not served from cache)
   - Verify cache invalidation on backend delete

5. **Test Backend Priority**: Verify that backend data takes precedence over local cache when conflicts exist (Dependencies: Step 2, Step 3, Step 4)
   - Update template in backend with different data
   - Keep old version in local cache
   - Query template via metabob-cli
   - Verify backend version is returned (not cached version)
   - Check cache is updated with new backend data

6. **Test Network Failure Scenarios**: Verify graceful degradation when backend is unavailable (Dependencies: Step 1, Step 2, Step 3)
   - Stop metabob-rpc-api service
   - Attempt template registration (should fail with clear error)
   - Attempt template retrieval with valid cache (may succeed from cache)
   - Attempt template retrieval without cache (should fail with clear error)
   - Restart backend and verify recovery

7. **Document Integration Architecture**: Create or update documentation showing the verified data flow (Dependencies: Step 1, Step 2, Step 3, Step 4, Step 5, Step 6)
   - Create verification report with all test results
   - Document data flow diagram (backend → metabob-cli → cache)
   - Note any discrepancies from ARCHITECTURE_CORRECTION.md
   - Provide recommendations for fixes if issues found
   - Update architecture documentation if needed

## Input Variables

| Variable | Type | Required | Default | Description |
|----------|------|----------|---------|-------------|
| backend_url | string | no | http://localhost:8000 | URL of metabob-rpc-api backend |
| backend_health_endpoint | string | no | /health | Health check endpoint for backend |
| test_template_name | string | no | test-backend-integration-template | Name for test template to register |
| test_template_id | string | no | test-backend-integration | ID for test template |
| skip_cleanup | boolean | no | false | Skip cleanup of test templates after verification |
| output_report_path | string | no | ./VERIFICATION_REPORT.md | Path to save verification report |
| check_database_directly | boolean | no | false | If true, connect to backend database to verify storage (requires DB credentials) |
| metabob_cli_path | string | no | ./repos/metabob-cli | Path to metabob-cli repository |
| cache_directory | string | no | ./.metabob | Path to local cache directory |

## Expected Outputs

- **File: `VERIFICATION_REPORT.md`** - Comprehensive report documenting:
  - Backend API endpoint verification results with status codes and response samples
  - Template registration flow test results (success/failure, backend storage confirmed)
  - Template retrieval flow test results (cache behavior, backend queries)
  - Cache-only behavior validation results (stale data handling)
  - Backend priority test results (conflict resolution)
  - Network failure scenario test results (graceful degradation)
  - Architecture diagram or data flow description (actual vs. intended)
  - Summary of findings (pass/fail/issues discovered)
  - Recommendations for fixes if issues found

- **File: `ARCHITECTURE_VERIFICATION_DIAGRAM.md`** (optional) - Visual diagram showing:
  - Data flow: user → metabob-cli → metabob-rpc-api → storage
  - Cache layer interaction
  - API endpoint paths and methods
  - Comparison to ARCHITECTURE_CORRECTION.md intent

- **Report Summary**: Console output with:
  - ✅ Tests passed / ❌ Tests failed counts
  - Critical issues requiring immediate attention
  - Non-critical discrepancies noted
  - Overall assessment: "Integration verified" or "Issues found requiring fixes"

- **State Changes**: 
  - Test template created in backend (cleaned up unless skip_cleanup=true)
  - Local cache may contain test template data
  - Backend logs contain test activity traces

## Validation Criteria

### Per-Step:

**Step 1 (Verify Backend API Endpoints)**:
- GET /api/v1/activities returns 200 with array of templates
- GET /api/v1/activities/{id} returns 200 for existing template, 404 for non-existent
- POST /api/v1/activities returns 201 with created template data
- PUT /api/v1/activities/{id} returns 200 with updated template data
- Response formats match expected schema (JSON with id, name, category, tasks, etc.)
- Logs show "Backend API endpoints verified successfully"

**Step 2 (Test Template Registration)**:
- Test template POST returns 201 status
- Backend GET returns newly registered template
- Backend database/storage contains template (if check_database_directly=true)
- Local .metabob/ cache contains template (may be populated after registration)
- Logs show "Template registration flow verified"

**Step 3 (Test Template Retrieval)**:
- Cache cleared successfully (directory empty or files deleted)
- Template query triggers backend API call (confirmed via logs)
- Cache populated with backend response data
- Subsequent query served from cache (no backend call)
- Logs show "Template retrieval flow verified (cache miss → backend → cache hit)"

**Step 4 (Verify Cache-Only Behavior)**:
- Template deleted from backend successfully (204 or 200 status)
- Local cache still contains stale template data
- Template query returns 404 or "not found" error (not served from stale cache)
- Cache invalidated (stale data removed)
- Logs show "Cache acts as cache only, not source of truth"

**Step 5 (Test Backend Priority)**:
- Template updated in backend with new data (200 status)
- Local cache intentionally has old version
- Template query returns backend version (new data)
- Cache updated with backend version (old data overwritten)
- Logs show "Backend data takes priority over cache"

**Step 6 (Test Network Failure)**:
- Backend service stopped (health endpoint returns connection error)
- Template registration fails with clear error message mentioning backend unavailability
- Template retrieval with valid cache may succeed (graceful degradation)
- Template retrieval without cache fails with clear error message
- Backend restart successful, subsequent queries work normally
- Logs show "Network failure scenarios handled correctly"

**Step 7 (Document Integration)**:
- VERIFICATION_REPORT.md created with all test results
- Report includes data flow diagram or description
- Report compares actual behavior to ARCHITECTURE_CORRECTION.md intent
- Report provides clear recommendations if issues found
- Logs show "Verification report generated"

### Final Validation:

**Files Exist**:
- `VERIFICATION_REPORT.md` with complete test results
- `ARCHITECTURE_CORRECTION.md` (reference document)
- `repos/metabob-cli/` directory (metabob-cli codebase)

**Patterns Present** (in VERIFICATION_REPORT.md):
- "Backend API endpoints verified"
- "Template stored in metabob-rpc-api"
- "Cache behavior correct" or "Cache issues found"
- "Backend priority confirmed" or "Backend priority issues"
- "Data flow: backend → metabob-cli → cache" or diagram
- Summary section with pass/fail counts

**Patterns Absent** (should NOT appear in report if integration is correct):
- "Backend API unreachable" (in final summary, after Step 6 backend restart)
- "Template only in local cache" (should be in backend)
- "Cache acting as source of truth" (should only be cache)
- "Critical integration failure"

**Commands Pass** (validation commands):
```bash
# Verify backend is running
curl -f ${backend_url}/health || echo "Backend health check failed"

# Verify test template in backend (if not cleaned up)
curl -f ${backend_url}/api/v1/activities/${test_template_id} || echo "Template not in backend"

# Verify report exists
test -f VERIFICATION_REPORT.md || echo "Report not generated"

# Verify report has results
grep -q "Backend API endpoints verified" VERIFICATION_REPORT.md || echo "Step 1 results missing"
grep -q "Template registration flow" VERIFICATION_REPORT.md || echo "Step 2 results missing"
grep -q "Template retrieval flow" VERIFICATION_REPORT.md || echo "Step 3 results missing"
grep -q "Cache behavior" VERIFICATION_REPORT.md || echo "Step 4 results missing"
grep -q "Backend priority" VERIFICATION_REPORT.md || echo "Step 5 results missing"
grep -q "Network failure" VERIFICATION_REPORT.md || echo "Step 6 results missing"

# Verify cache directory exists (ephemeral)
test -d ${cache_directory} || echo "Cache directory not found"
```

## Error Handling

**Common Failures and Solutions**:

1. **Backend API unreachable**
   - **Symptom**: Connection refused, timeout, or network error when calling backend_url
   - **Solution**: Check if metabob-rpc-api is running; verify URL and port; check network connectivity
   - **Recovery**: Start metabob-rpc-api service (e.g., `docker-compose up metabob-rpc-api`)
   - **Retry Strategy**: Retry with exponential backoff (3 attempts, 2s, 4s, 8s delays)
   - **Report**: Document backend unavailability as critical issue

2. **Template registration fails**
   - **Symptom**: POST /api/v1/activities returns 400, 422, or 500 status
   - **Solution**: Check request payload format; verify required fields; check backend logs
   - **Recovery**: Fix payload schema; ensure metabob-rpc-api is running latest code
   - **Retry Strategy**: No automatic retry (may be schema issue)
   - **Report**: Document registration failure with error response details

3. **Template retrieval returns 404**
   - **Symptom**: GET /api/v1/activities/{id} returns 404 after successful registration
   - **Solution**: Check backend database for template; verify registration actually succeeded; check backend routing
   - **Recovery**: Re-register template; inspect backend logs; verify API endpoints
   - **Retry Strategy**: Retry registration, then retry retrieval (once)
   - **Report**: Document retrieval failure as potential backend storage issue

4. **Cache behavior incorrect**
   - **Symptom**: Stale data served from cache after backend deletion; cache not updated on backend changes
   - **Solution**: Inspect cache implementation in metabob-cli; check cache invalidation logic
   - **Recovery**: Clear cache manually; restart metabob-cli
   - **Retry Strategy**: No automatic retry (requires code fix)
   - **Report**: Document cache behavior issues with observed vs. expected behavior

5. **Backend priority test fails**
   - **Symptom**: Old cached data returned instead of updated backend data
   - **Solution**: Verify metabob-cli queries backend before serving cache; check cache TTL logic
   - **Recovery**: Clear cache; inspect metabob-cli query logic
   - **Retry Strategy**: No automatic retry (requires code fix)
   - **Report**: Document backend priority failure as critical architectural issue

6. **Network failure recovery fails**
   - **Symptom**: After backend restart, queries still fail; cache not repopulated
   - **Solution**: Check connection pooling in metabob-cli; verify backend fully initialized
   - **Recovery**: Restart metabob-cli; clear connection state
   - **Retry Strategy**: Wait for backend readiness (health check passes) before retrying
   - **Report**: Document recovery failure with recovery steps attempted

7. **Database connection fails** (if check_database_directly=true)
   - **Symptom**: Cannot connect to backend database to verify storage
   - **Solution**: Verify database credentials; check database is running
   - **Recovery**: Skip direct database verification; rely on API queries only
   - **Retry Strategy**: No retry (optional verification step)
   - **Report**: Note database verification skipped due to connection issue

8. **Test cleanup fails**
   - **Symptom**: Cannot delete test template from backend after tests complete
   - **Solution**: Check DELETE endpoint exists; verify permissions; check backend logs
   - **Recovery**: Manual cleanup via backend admin interface or database
   - **Retry Strategy**: Retry DELETE once, then log cleanup failure
   - **Report**: Note manual cleanup required for test template {test_template_id}

## Agent Assignment

- **Step 1: Verify Backend API Endpoints** → **tool** agent
  - Requires HTTP API testing (curl, fetch, or HTTP client)
  - Needs to parse JSON responses and validate schemas
  - Must document endpoint behavior and formats
  
- **Step 2: Test Template Registration** → **tool** agent
  - Requires calling metabob-cli MCP tools or backend API
  - Needs to verify backend storage (API queries or database)
  - Must check cache population behavior

- **Step 3: Test Template Retrieval** → **tool** agent
  - Requires cache manipulation (file operations)
  - Needs to monitor backend API calls (logs or network)
  - Must verify cache hit/miss behavior

- **Step 4: Verify Cache-Only Behavior** → **general** agent
  - Requires file system operations (delete cache)
  - Needs to verify cache invalidation logic
  - Integration testing across backend and cache

- **Step 5: Test Backend Priority** → **test** agent
  - Requires systematic test case execution
  - Needs to set up conflict scenarios (stale cache + new backend)
  - Must validate conflict resolution behavior

- **Step 6: Test Network Failure** → **test** agent
  - Requires service lifecycle management (stop/start backend)
  - Needs to test error handling and graceful degradation
  - Must verify recovery after backend restart

- **Step 7: Document Integration** → **docs** agent
  - Requires aggregating test results into report
  - Needs to create diagrams or data flow descriptions
  - Must compare actual vs. intended architecture

## Additional Context

### Architecture Reference

From ARCHITECTURE_CORRECTION.md:
- **metabob-rpc-api**: Backend service, source of truth for activity templates
- **metabob-cli**: Client/gateway service, communicates with backend, exposes MCP tools
- **.metabob/ directories**: Local cache for performance, not authoritative

### Current Concern

Need to verify the implementation matches this intent because:
1. Historical confusion about where templates are stored
2. Potential for local cache to become unintentional source of truth
3. Need to document actual data flow for developers
4. Ensure backend API endpoints exist and are used correctly

### Integration Points

**metabob-cli → metabob-rpc-api**:
- Template registration: POST /api/v1/activities
- Template retrieval: GET /api/v1/activities/{id}
- Template listing: GET /api/v1/activities
- Template update: PUT /api/v1/activities/{id}
- Template deletion: DELETE /api/v1/activities/{id}

**metabob-cli → Local Cache**:
- Cache directory: `.metabob/activities/` or similar
- Cache format: JSON files or database
- Cache invalidation: On backend updates, deletes, or TTL expiration
- Cache population: On backend queries (cache miss)

**user → metabob-cli MCP**:
- MCP tool: `metabob_search_activities` (list templates)
- MCP tool: `metabob_get_activity_template` (get specific template)
- MCP tool: `metabob_register_activity_template` (create template)
- MCP tool: (possibly) update/delete tools

### Test Template Schema

Test template should be minimal but valid:
```json
{
  "id": "test-backend-integration",
  "name": "Test Backend Integration Template",
  "description": "Test template for backend integration verification",
  "category": "infrastructure",
  "tasks": [
    {
      "id": "task-1",
      "subagent": "general",
      "description": "Test task",
      "dependencies": [],
      "prompt": {
        "template": "This is a test task",
        "maxTokens": 1000,
        "compressionStrategy": "filter",
        "variables": []
      },
      "validation": {
        "requiredFiles": [],
        "requiredPatterns": [],
        "forbiddenPatterns": [],
        "commands": []
      },
      "retry": {
        "maxAttempts": 1,
        "strategy": "simple"
      }
    }
  ],
  "integration": {
    "preChecks": [],
    "postChecks": [],
    "qualityGates": []
  },
  "metabob": {
    "enabled": false,
    "learningMode": false,
    "targetContextTokens": 1000,
    "annotationStrategy": "none"
  }
}
```

### Success Criteria

Verification succeeds if:
1. ✅ Backend API endpoints exist and work correctly
2. ✅ Templates registered via metabob-cli appear in backend storage
3. ✅ Template queries go to backend (not just cache)
4. ✅ Local cache acts as cache only (stale data not served)
5. ✅ Backend data takes priority over cached data
6. ✅ Network failures handled gracefully with clear errors
7. ✅ Architecture matches ARCHITECTURE_CORRECTION.md intent

Verification fails if:
1. ❌ Backend API endpoints missing or non-functional
2. ❌ Templates only stored in local cache (not backend)
3. ❌ Template queries only check cache (not backend)
4. ❌ Stale cache data served as authoritative
5. ❌ Cache data overrides backend data
6. ❌ Network failures cause silent errors or incorrect behavior
7. ❌ Architecture deviates from documented intent

### Related Files

**Architecture Documentation**:
- `ARCHITECTURE_CORRECTION.md` - Documented intent for backend architecture
- `MCP_GATEWAY_ARCHITECTURE.md` - MCP Gateway pattern documentation
- `TEMPLATE_MANAGEMENT_ARCHITECTURE.md` - Template lifecycle documentation

**metabob-cli (client/gateway)**:
- `repos/metabob-cli/src/metabob_cli/mcp/activity_templates.py` - Template storage/retrieval
- `repos/metabob-cli/src/metabob_cli/mcp/activity_template_tools.py` - MCP tool implementations
- `repos/metabob-cli/src/metabob_cli/api/` - Backend API client (if exists)
- Configuration for backend URL

**metabob-rpc-api (backend)**:
- API endpoint implementations for /api/v1/activities/*
- Database models for activity templates
- Template storage layer

**Local Cache**:
- `.metabob/` directory structure
- Cache implementation in metabob-cli

### Constraints

1. **Non-Destructive**: Verification should not modify production templates or data
2. **Isolated**: Test templates should be clearly identified and easy to clean up
3. **Idempotent**: Running verification multiple times should produce consistent results
4. **Fast**: Verification should complete in < 5 minutes under normal conditions
5. **Clear Reporting**: Report should be understandable by developers unfamiliar with the codebase
6. **Actionable**: If issues found, report should provide clear steps to fix

### Risk Mitigation

**High Risk**:
- Backend unavailable during verification → Retry with backoff, clear error messages
- Test template conflicts with existing templates → Use unique test template ID/name

**Medium Risk**:
- Cache manipulation breaks metabob-cli → Use isolated cache directory for testing
- Network instability during tests → Implement robust retry logic

**Low Risk**:
- Report generation fails → Log results to console as fallback
- Cleanup fails → Document manual cleanup steps

### Manual Verification Steps (If Needed)

If automated verification is inconclusive, manual steps:

1. **Check Backend Storage**:
   ```bash
   # Query backend API directly
   curl http://localhost:8000/api/v1/activities/test-backend-integration
   
   # Or check database
   psql -d metabob -c "SELECT * FROM activity_templates WHERE id='test-backend-integration';"
   ```

2. **Inspect Cache**:
   ```bash
   # List cache contents
   ls -la .metabob/activities/
   
   # Read cached template
   cat .metabob/activities/test-backend-integration.json
   ```

3. **Monitor Network Traffic**:
   ```bash
   # Watch backend API calls
   tcpdump -i any -A 'port 8000'
   
   # Or check metabob-cli logs
   tail -f /var/log/metabob-cli.log | grep 'api/v1/activities'
   ```

4. **Test Backend Priority Manually**:
   ```bash
   # Update template in backend
   curl -X PUT http://localhost:8000/api/v1/activities/test-backend-integration \
     -H "Content-Type: application/json" \
     -d '{"name": "Updated Name"}'
   
   # Query via metabob-cli
   # Verify returned name is "Updated Name" (not cached old name)
   ```
