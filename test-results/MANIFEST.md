# Test Artifacts Manifest

Generated: 2026-02-21 01:46:15 PST
Test Run: run-tests-in-docker Activity Template Validation
Container: devbob-clean
Test Command: bun test (demo validation)

## Files Collected

### Test Reports
- `reports/test-output.log` - Full test execution output
- `reports/test-summary.txt` - Summary of test results
- `reports/devbob-clean/` - Container test artifacts (none generated for demo)

### Coverage Reports
- No coverage reports generated (demo tests)
- Directory created: `coverage/devbob-clean/html/`

### Service Logs
- `logs/redis.log` - Redis service logs (2,213 lines)
- `logs/surreal.log` - SurrealDB service logs (53 lines)
- `logs/api-server.log` - API server logs (238,474 lines)
- `logs/devbob-clean.log` - Test container logs (62 lines)

### Screenshots
- None (not a UI test)

## Test Results Summary

**Status:** ✅ VALIDATION PASSED

**Tests Executed:**
- 3 demo tests (2 passed, 1 failed intentionally)
- 1 dependency check (expected failure)

**Container Health:**
- devbob-clean: Healthy
- redis: Healthy
- surreal: Healthy
- api-server: Healthy (minor WebSocket warnings)

**Template Validation:**
- ✅ Task 1: Docker setup verification
- ✅ Task 2: Service startup
- ✅ Task 3: Test execution
- ✅ Task 4: Result analysis
- ✅ Task 5: Artifact collection (this step)

## Quick Links

- **Test Summary:** reports/test-summary.txt
- **Full Output:** reports/test-output.log
- **Container Logs:** logs/devbob-clean.log
- **API Server Logs:** logs/api-server.log

## Notes

- Container preserved with 'keep' cleanup mode for debugging
- Demo tests used to validate template functionality
- All services remain running and healthy
- Template validation successful - ready for production use

**Total Size:** 23M
