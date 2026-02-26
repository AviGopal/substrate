# Validation Harness: sidebar-impulse-visibility

## Overview

This validation harness tests the TUI sidebar's ability to display real-time impulse loading state and activity progress tracking. It validates all 7 specification requirements without requiring an LLM.

## Files

- `sidebar-impulse-visibility-harness.ts` - Main validation script
- `sidebar-test-cases.json` - Historical test cases with expected outputs
- `README.md` - This file

## Usage

### Run All Test Cases

```bash
cd tests/validation-harnesses
bun run sidebar-impulse-visibility-harness.ts case-1-basic-impulse-loading
bun run sidebar-impulse-visibility-harness.ts case-2-activity-progress
bun run sidebar-impulse-visibility-harness.ts case-3-warning-thresholds
bun run sidebar-impulse-visibility-harness.ts case-4-incremental-loading
```

### Run Programmatically

```typescript
import { runValidation, testCases } from './sidebar-impulse-visibility-harness'

const result = await runValidation(testCases['case-1-basic-impulse-loading'])

if (result.pass) {
  console.log('✅ Validation PASSED')
} else {
  console.log('❌ Validation FAILED')
  console.log('Errors:', result.errors)
}
```

## Test Cases

### Case 1: Basic Impulse Loading

**Purpose:** Verify sidebar shows impulse count incrementing as impulses load by priority

**Validation:**
- Initial state: 0/4 impulses loaded, 0% utilization
- After high-priority load: 2/4 impulses loaded, 50% utilization
- After medium-priority load: 3/4 impulses loaded, 75% utilization

**Expected Behavior:**
- Memory section appears when impulses exist
- Impulse counter shows X/Y format
- Token counter updates with budget usage
- Utilization progress bar advances

### Case 2: Activity Progress Tracking

**Purpose:** Verify sidebar activity section tracks task completion in real-time

**Validation:**
- Task counter advances: Task 0/5 -> 1/5 -> 2/5 -> 3/5 -> 4/5 -> 5/5
- Progress bar advances: 0% -> 20% -> 40% -> 60% -> 80% -> 100%
- Status changes: executing -> executing -> executing -> completing -> done
- Elapsed time increases

**Expected Behavior:**
- Activities section shows active activities
- Task counter format is "Task N/M"
- Progress bar updates with color coding
- Status badge reflects current state

### Case 3: Warning Thresholds (85%)

**Purpose:** Verify sidebar shows warnings when utilization exceeds 85%

**Validation:**
- Initial state: 0% utilization, no warning
- After loading 3 high-priority impulses: 90% utilization (9000/10000), warning appears

**Expected Behavior:**
- Warning indicator appears at 85%+ utilization
- Progress bar color changes to red
- Memory section shows warning badge

### Case 4: Incremental Loading with Activity Progress

**Purpose:** Verify sidebar shows both impulse loading and activity progress simultaneously

**Validation:**
- Impulses: 0/5 -> 2/5 -> 3/5 loaded
- Activity: Task 0/3 -> 1/3 -> 2/3 -> 3/3
- Progress: 0% -> 33% -> 67% -> 100%
- Utilization: 0% -> 40% -> 60%

**Expected Behavior:**
- Both sections update independently
- No race conditions or conflicts
- All metrics stay synchronized

## Validation Criteria

### Pass Conditions

✅ All snapshots match expected values
✅ Impulse counts accurate (loaded/total)
✅ Token usage tracked correctly
✅ Utilization percentage within ±1% tolerance
✅ Activity progress advances correctly
✅ Task counter format is "Task N/M"
✅ Status transitions match expected sequence
✅ Warnings appear at correct thresholds

### Fail Conditions

❌ Any snapshot mismatch
❌ Impulse count incorrect
❌ Token usage incorrect
❌ Utilization off by >1%
❌ Activity progress incorrect
❌ Task counter format wrong
❌ Status transitions incorrect
❌ Warnings missing or incorrect

## Architecture

### Validation Flow

```
1. Create test session
2. Create impulses (varying priorities and budgets)
3. Capture initial snapshot (baseline)
4. Load high-priority impulses
5. Capture snapshot (verify impulse loading)
6. Load medium-priority impulses
7. Capture snapshot (verify incremental loading)
8. Create test activity
9. Simulate task completion
10. Capture snapshots at each step (verify progress)
11. Compare all snapshots to expected values
12. Return PASS/FAIL with errors
```

### Snapshot Structure

```typescript
interface SidebarSnapshot {
  timestamp: number
  impulses: {
    loaded: number        // Count of loaded impulses
    total: number         // Total impulse count
    utilization: number   // Percentage (0-100)
  }
  tokens: {
    used: number         // Tokens consumed
    total: number        // Total budget
  }
  activities: Array<{
    title: string
    status: string       // executing, completing, done
    progress: {
      current: number    // Completed tasks
      total: number      // Total tasks
      percentage: number // Progress (0-100)
    }
    elapsedMs: number
  }>
  warnings: {
    memoryWarning: boolean  // True when utilization >= 85%
    heapWarning: boolean    // True when heap >= 80%
  }
}
```

## Integration with trace-enforce-validate Loop

This harness is designed to be used in the trace-enforce-validate loop:

1. **Trace** identifies specification requirements and current implementation
2. **Enforce** applies changes to close gaps
3. **Validate** (this harness) confirms changes work as expected

The harness:
- Runs without LLM (uses historical test cases)
- Returns deterministic PASS/FAIL results
- Provides detailed error messages for debugging
- Captures actual vs expected for comparison

## Maintenance

### Adding New Test Cases

1. Add entry to `sidebar-test-cases.json`
2. Add entry to `testCases` object in harness
3. Define input parameters and expected outputs
4. Run validation to verify

### Updating Expected Values

If specification changes:
1. Update expected snapshots in test cases
2. Re-run validation
3. Verify new behavior matches updated spec

## Troubleshooting

### Validation Fails with "Snapshot count mismatch"

**Cause:** Activity execution didn't generate expected number of snapshots

**Solution:** Check that impulse loading and task completion logic is working correctly

### Utilization Mismatch

**Cause:** Token budget calculation differs from expected

**Solution:** Verify impulse budgets are correct and loading logic is working

### Activity Progress Incorrect

**Cause:** Task completion simulation not updating state correctly

**Solution:** Check activity state updates and storage writes

## Performance

- **Execution time:** ~1-2 seconds per test case
- **Storage I/O:** Minimal (test session cleanup)
- **Memory usage:** <50 MB
- **Parallelizable:** Yes (independent test cases)

## Future Enhancements

- [ ] Add visual TUI rendering validation (screenshot comparison)
- [ ] Test color coding thresholds (green/yellow/red)
- [ ] Test refresh rate (2.5s polling)
- [ ] Test race conditions (concurrent updates)
- [ ] Add stress test (many impulses/activities)
- [ ] Test error handling (malformed state)

---

# Validation Harness: deployment-vessel-job-management

## Overview

This validation harness tests the complete deployment workflow for DevBob vessel containers and job submission. It validates the deployment orchestration, ACP delegation, impulse sharing, container health checks, and error handling without requiring an LLM.

## Files

- `deployment-vessel-job-management-harness.ts` - Main validation script
- `README.md` - This file (shared with other harnesses)

## Usage

### Run All Test Cases

```bash
cd /home/avi/documents/work/exp-repo/metabob-devbob
npx ts-node tests/validation-harnesses/deployment-vessel-job-management-harness.ts
```

### Run Programmatically

```typescript
import { runValidation } from './tests/validation-harnesses/deployment-vessel-job-management-harness'

const result = await runValidation()

if (result.pass) {
  console.log('✅ All tests PASSED')
  console.log(`${result.passed}/${result.totalTests} tests passed`)
} else {
  console.log('❌ Some tests FAILED')
  console.log(`${result.failed}/${result.totalTests} tests failed`)
  
  // Show failed test details
  result.results.filter(r => !r.pass).forEach(test => {
    console.log(`\nFailed: ${test.testCase}`)
    console.log(`Expected:`, test.expected)
    console.log(`Actual:`, test.actual)
    console.log(`Error:`, test.error)
  })
}
```

## Test Cases

### Case 1: Prerequisites Check

**Purpose:** Verify Docker and docker-compose availability before deployment

**Validation:**
- Docker installed and available
- docker-compose installed and available
- docker-compose.unified.yaml exists in project root

**Expected Output:**
```json
{
  "dockerAvailable": true,
  "composeAvailable": true,
  "composeFileExists": true
}
```

### Case 2: Infrastructure Services

**Purpose:** Verify infrastructure services (Redis, SurrealDB) are running and healthy

**Validation:**
- metabob-redis container is running
- metabob-surrealdb container is running
- Redis port 6379 is accessible
- SurrealDB port 8000 is accessible
- Redis responds to PING command

**Expected Output:**
```json
{
  "redisRunning": true,
  "surrealRunning": true,
  "redisPortOpen": true,
  "surrealPortOpen": true,
  "redisPing": true
}
```

### Case 3: Metabob Backend

**Purpose:** Verify Metabob backend services are running with healthy API

**Validation:**
- metabob-api container is running
- metabob-worker container is running
- API port 8080 is accessible
- API health endpoint responds with 200 OK

**Expected Output:**
```json
{
  "apiRunning": true,
  "workerRunning": true,
  "apiPortOpen": true,
  "apiHealthy": true
}
```

### Case 4: DevBob Vessels

**Purpose:** Verify DevBob vessel containers are running with ACP servers initialized

**Validation:**
- devbob-clean container is running
- devbob-rpc-api container is running
- devbob-dashboard container is running
- ACP ports 3100, 3101, 3102 are accessible
- ACP server logs show "ACP server listening" or "opencode acp"

**Expected Output:**
```json
{
  "cleanRunning": true,
  "rpcApiRunning": true,
  "dashboardRunning": true,
  "cleanPortOpen": true,
  "rpcApiPortOpen": true,
  "dashboardPortOpen": true,
  "cleanAcpReady": true,
  "rpcApiAcpReady": true,
  "dashboardAcpReady": true
}
```

### Case 5: ACP Connectivity

**Purpose:** Verify docker exec connectivity to vessel containers for ACP delegation

**Validation:**
- At least one DevBob vessel is running
- Can execute commands in vessel via docker exec
- OpenCode process is running in vessel container

**Expected Output:**
```json
{
  "targetContainer": "devbob-*",
  "opencodeRunning": true,
  "canExec": true
}
```

### Case 6: Error Handling

**Purpose:** Verify error handling for non-existent containers

**Validation:**
- Non-existent container is correctly identified as not running
- docker exec to non-existent container fails with proper error
- Error message includes "No such container" or "not found"

**Expected Output:**
```json
{
  "containerExists": false,
  "execFailed": true,
  "hasErrorMessage": true
}
```

### Case 7: Deployment Configuration

**Purpose:** Verify docker-compose.unified.yaml contains all required service definitions

**Validation:**
- All service definitions present (redis, surrealdb, api, worker, devbob-*)
- All profile definitions present (infra, metabob, devbob)
- Network configuration with static IPs
- Health checks defined for critical services

**Expected Output:**
```json
{
  "hasRedis": true,
  "hasSurrealDB": true,
  "hasApi": true,
  "hasWorker": true,
  "hasDevBobClean": true,
  "hasDevBobRpcApi": true,
  "hasDevBobDashboard": true,
  "hasInfraProfile": true,
  "hasMetabobProfile": true,
  "hasDevbobProfile": true,
  "hasNetwork": true,
  "hasStaticIp": true,
  "hasHealthCheck": true
}
```

### Case 8: Activity Templates

**Purpose:** Verify required activity templates exist and have valid structure

**Validation:**
- deploy-devbob-stack.json exists in .metabob/activities/
- delegate-to-devbob.json exists in .metabob/activities/
- submit-analysis-job.json exists in .metabob/activities/
- All templates have valid JSON structure with name and tasks array

**Expected Output:**
```json
{
  "deployStackExists": true,
  "delegateExists": true,
  "submitJobExists": true,
  "deployStackValid": true,
  "delegateValid": true,
  "submitJobValid": true
}
```

## Validation Criteria

### Pass Conditions

✅ All 8 test cases pass
✅ Docker and docker-compose are available
✅ Infrastructure services are running
✅ Metabob backend is operational
✅ At least one DevBob vessel is accessible
✅ ACP connectivity works via docker exec
✅ Error handling works correctly
✅ Configuration files are valid
✅ Activity templates exist and are well-formed

### Fail Conditions

❌ Any test case fails
❌ Docker or docker-compose not available
❌ Critical services not running
❌ ACP connectivity broken
❌ Configuration files missing or invalid
❌ Activity templates missing or malformed

## Architecture

### Validation Flow

```
1. Check prerequisites (Docker, docker-compose, config files)
2. Validate infrastructure services (Redis, SurrealDB)
3. Validate Metabob backend (API, worker)
4. Validate DevBob vessels (containers, ACP servers)
5. Test ACP connectivity (docker exec)
6. Test error handling (non-existent container)
7. Validate deployment configuration (docker-compose.yaml)
8. Validate activity templates (JSON structure)
9. Aggregate results and return PASS/FAIL
```

### Test Execution

- Each test case is independent
- Test cases can be run in parallel (future enhancement)
- Execution time: ~10-30 seconds total
- No LLM interaction required
- Deterministic PASS/FAIL results

## Integration with trace-enforce-validate Loop

This harness is designed for the trace-enforce-validate loop:

1. **Trace** - Identifies deployment specification requirements and current implementation
2. **Enforce** - Applies changes to close gaps (none needed in this case)
3. **Validate** (this harness) - Confirms deployment infrastructure works as specified

The harness:
- ✅ Runs without LLM (uses shell commands and file checks)
- ✅ Returns deterministic PASS/FAIL results
- ✅ Provides detailed error messages for debugging
- ✅ Tests all critical deployment components
- ✅ Validates ACP delegation infrastructure
- ✅ Tests error handling and edge cases

## Maintenance

### Adding New Test Cases

1. Add new test function to harness file
2. Add to `tests` array in `runValidation()`
3. Document expected behavior in this README
4. Create impulse with test case definition

### Updating Expected Values

If specification changes:
1. Update expected outputs in test functions
2. Re-run validation
3. Update this README with new expectations

## Troubleshooting

### "Docker not available"

**Cause:** Docker daemon not running or not installed

**Solution:** 
```bash
# Start Docker
sudo systemctl start docker

# Or install Docker
curl -fsSL https://get.docker.com | sh
```

### "Container not running"

**Cause:** DevBob stack not deployed

**Solution:**
```bash
# Deploy the stack
docker-compose -f docker-compose.unified.yaml --profile all up -d

# Wait for services to start
sleep 30

# Re-run validation
npx ts-node tests/validation-harnesses/deployment-vessel-job-management-harness.ts
```

### "ACP server not ready"

**Cause:** Container started but ACP server not initialized

**Solution:**
```bash
# Check container logs
docker logs devbob-clean --tail 50

# Wait longer for initialization
sleep 10

# Re-run validation
```

### "Port not accessible"

**Cause:** Port conflict or firewall blocking

**Solution:**
```bash
# Check port usage
netstat -tuln | grep -E '(6379|8000|8080|3100|3101|3102)'

# Check firewall
sudo ufw status

# Restart services if needed
docker-compose -f docker-compose.unified.yaml restart
```

## Performance

- **Execution time:** ~10-30 seconds for all 8 tests
- **Network I/O:** Minimal (localhost connections only)
- **Disk I/O:** Minimal (reading config files)
- **Memory usage:** <100 MB
- **Parallelizable:** Yes (tests are independent)

## CI/CD Integration

Example GitHub Actions workflow:

```yaml
name: Deployment Validation

on: [push, pull_request]

jobs:
  validate-deployment:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
        with:
          node-version: '18'
      
      # Deploy stack
      - name: Deploy DevBob Stack
        run: docker-compose -f docker-compose.unified.yaml --profile all up -d
      
      # Wait for services
      - name: Wait for Services
        run: sleep 30
      
      # Run validation
      - name: Run Validation Harness
        run: npx ts-node tests/validation-harnesses/deployment-vessel-job-management-harness.ts
      
      # Cleanup
      - name: Cleanup
        if: always()
        run: docker-compose -f docker-compose.unified.yaml down -v
```
