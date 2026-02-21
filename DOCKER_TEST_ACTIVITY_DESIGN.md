# Docker Test Activity Design

**Activity:** run-tests-in-docker  
**Purpose:** Run test suites in Docker Compose environment with systematic setup, execution, analysis, and cleanup  
**Date:** 2026-02-20  

---

## Overview

This activity automates the complete workflow for running tests in Docker/devbob containers:

1. **Verify Setup** - Check Docker environment and prerequisites
2. **Start Services** - Launch required Docker Compose services
3. **Execute Tests** - Run tests in appropriate containers
4. **Analyze Results** - Parse output and identify issues
5. **Collect Artifacts** - Save reports, logs, coverage data
6. **Cleanup** - Stop/remove containers as specified
7. **Generate Report** - Create comprehensive test report

---

## Variables

### Required
- `profile` - Docker Compose profile (stable | devbob | devbob-dev)
- `testType` - Test execution type (container | compose | standalone | acp)
- `testCommand` - Command to run tests

### Optional
- `container` - Container name (for container/compose/acp types)
- `services` - Specific services to start (comma-separated)
- `testPaths` - Test file paths to verify
- `healthTimeout` - Seconds to wait for health (default: 120)
- `cleanupMode` - Cleanup strategy (stop | down | down-volumes | keep)
- `artifactPath` - Base path for artifacts (default: test-results)

---

## Use Cases

### Use Case 1: Run Unit Tests in OpenCode Container

```bash
activity run-tests-in-docker \
  profile="devbob" \
  testType="container" \
  container="devbob-clean" \
  testCommand="cd repos/metabob-opencode && bun test"
```

### Use Case 2: Run Integration Tests with Backend

```bash
activity run-tests-in-docker \
  profile="stable" \
  testType="standalone" \
  testCommand="npm run test:integration"
```

### Use Case 3: Run Tests via ACP Delegation

```bash
activity run-tests-in-docker \
  profile="devbob-dev" \
  testType="acp" \
  container="docker://devbob-rpc-api" \
  testCommand="pytest tests/"
```

### Use Case 4: E2E Tests with Full Stack

```bash
activity run-tests-in-docker \
  profile="devbob-dev" \
  testType="compose" \
  container="devbob-dashboard" \
  testCommand="npm run test:e2e" \
  cleanupMode="down-volumes"
```

---

## Task Breakdown

### Task 1: verify-docker-setup

**Purpose:** Ensure environment is ready

**Checks:**
- docker-compose.yaml exists and has profile
- Required environment variables set
- Services can be listed
- Test files/paths exist
- Dependencies installed

**Output:** Setup status, missing prerequisites, recommendations

---

### Task 2: start-services

**Purpose:** Launch Docker services with health checks

**Actions:**
- Create networks if needed
- Start services via docker-compose
- Wait for health checks (with timeout)
- Verify connectivity
- Report readiness

**Output:** Service status, connection details, ready/not ready

---

### Task 3: execute-tests

**Purpose:** Run tests in appropriate environment

**Strategies:**
1. **container** - `docker exec container command`
2. **compose** - `docker-compose exec -T container command`
3. **standalone** - Run on host, test Docker services
4. **acp** - Delegate via acp_delegate tool

**Capture:**
- Full stdout/stderr
- Exit code
- Test framework output
- Duration

**Output:** Test results, pass/fail counts, failures

---

### Task 4: analyze-results

**Purpose:** Parse and understand test results

**Analysis:**
- Parse test framework output
- Categorize failures
- Identify patterns (env issues, flaky tests)
- Check service logs for errors
- Root cause analysis

**Output:** Failure summary, root causes, recommendations

---

### Task 5: collect-artifacts

**Purpose:** Gather all test outputs

**Collect:**
- Test reports (JUnit XML, JSON, HTML)
- Coverage reports
- Service logs
- Screenshots (E2E)
- Performance metrics

**Organize:**
```
test-results/
  summary.md
  reports/
  coverage/
  logs/
  screenshots/
```

**Output:** Artifact manifest, file locations

---

### Task 6: cleanup-services

**Purpose:** Clean up Docker environment

**Modes:**
- `stop` - Stop containers, keep volumes
- `down` - Remove containers, keep volumes  
- `down-volumes` - Full cleanup
- `keep` - No cleanup (for debugging)

**Actions:**
- Save final logs
- Execute cleanup
- Verify cleanup
- Report disk space

**Output:** Cleanup summary, restart commands

---

### Task 7: generate-report

**Purpose:** Create comprehensive test report

**Sections:**
- Executive summary
- Environment details
- Test results
- Root cause analysis
- Artifacts
- Recommendations
- Reproduction steps

**Output:** Markdown report with all findings

---

## Integration with Data Flow Archaeology

This activity can be enhanced with flow tracing:

**Before testing:**
```bash
# Trace the test execution flow
activity trace-data-flow-single-feature \
  featureName="test execution in docker"
```

**After failures:**
```bash
# Use propagate-change to fix issues
activity propagate-change-through-flow \
  featureName="test execution" \
  changeType="addValidation" \
  changeDescription="Add test prerequisites check"
```

---

## Refinement Strategy

1. **Run on simple test:** Unit tests in single container
2. **Collect feedback:** What worked? What failed?
3. **Refine tasks:** Improve prompts based on actual output
4. **Add capabilities:** Handle edge cases discovered
5. **Document patterns:** Capture successful test patterns
6. **Create variants:** Specialized templates for common scenarios

---

## Success Metrics

**Activity succeeds when:**
- ✅ All tests run successfully OR
- ✅ All test failures have identified root causes
- ✅ Artifacts collected and organized
- ✅ Report generated with actionable recommendations
- ✅ Environment cleaned up as specified

**Activity fails when:**
- ❌ Docker services can't start
- ❌ Tests can't execute (env issue)
- ❌ Critical artifacts missing
- ❌ Cleanup fails (orphaned containers)

---

## Next Steps

1. Create minimal template (1-2 tasks)
2. Test on simple case (bun test in devbob-clean)
3. Refine based on results
4. Add remaining tasks incrementally
5. Test complex scenarios (multi-service, E2E)
6. Create specialized variants

