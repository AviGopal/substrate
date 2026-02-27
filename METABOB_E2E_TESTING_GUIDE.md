# Metabob Stack - End-to-End Testing Guide

**Activity Template:** `test-metabob-stack-e2e`  
**Purpose:** Validate complete Metabob application stack with data flow verification and input-output dependency enforcement  
**Date Created:** February 26, 2026

## Overview

This activity template provides comprehensive end-to-end testing of the Metabob application stack, ensuring:
1. ✅ All components are deployed and accessible
2. ✅ Data flows correctly between components
3. ✅ Input-output dependencies are enforced
4. ✅ Outcomes depend on inputs (no arbitrary behavior)

## Test Coverage

### Components Tested
- **Redis** - Session storage and caching
- **SurrealDB** - Graph database for activities/sessions
- **DevBob** - AI agent with ACP server
- **Integration** - End-to-end data flow

### Data Flow Requirements Validated

| Requirement | Test | Expected Outcome |
|-------------|------|------------------|
| Redis Round-Trip | Write → Read | Output === Input |
| SurrealDB Structure | Create → Query | Data structure preserved |
| ACP Response | Delegate → Response | Response contains input |
| Impulse Sharing | Share → Process | Output depends on shared data |
| E2E Dependency | Full Flow | Final state reflects initial input |

### Input-Output Dependencies

The activity validates that **outputs depend on inputs** at every stage:

```
Input → Component → Output
  ↓       verify      ↓
Expected    ═══>    Actual
```

If `Actual !== Expected`, test **FAILS** with diagnostic information.

## Activity Structure

### Task Flow

```
1. validate-deployment-state
   ↓
2. test-redis-data-flow ──────┐
   ↓                          │
3. test-surrealdb-data-flow ──┤
   ↓                          │
4. test-devbob-acp-delegation─┤
   ↓                          │
5. test-end-to-end-data-flow ←┘
   ↓
6. aggregate-test-results
```

### Task Descriptions

#### Task 1: Validate Deployment State
- Runs `scripts/validate-metabob-stack.sh`
- Checks all pods are Running
- Verifies ACP server initialized
- Creates deployment state impulse

#### Task 2: Test Redis Data Flow
- Writes test data to Redis
- Reads data back
- Validates: `output === input`
- Creates redis-test impulse

#### Task 3: Test SurrealDB Data Flow
- Creates test record in SurrealDB
- Queries record back
- Validates all fields match
- Tests optional data transformation
- Creates surrealdb-test impulse

#### Task 4: Test DevBob ACP Delegation
- Delegates echo task to DevBob
- Validates response contains input
- Tests impulse sharing
- Validates output depends on shared data
- Creates acp-test impulse

#### Task 5: Test End-to-End Data Flow
- Stores data in Redis
- Creates activity in SurrealDB
- Delegates to DevBob
- Verifies complete flow: Redis → SurrealDB → DevBob
- Validates input-output dependency chain
- Creates e2e-test impulse

#### Task 6: Aggregate Test Results
- Loads all test result impulses
- Analyzes input-output dependencies
- Validates all data flow requirements
- Creates comprehensive test report
- Overall status: PASS/FAIL

## Usage

### Prerequisites

1. **Metabob Stack Deployed:**
   ```bash
   cd helm && helmfile -f helmfile.yaml sync
   ```

2. **Validation Script Ready:**
   ```bash
   chmod +x scripts/validate-metabob-stack.sh
   ```

3. **kubectl Context:**
   ```bash
   kubectl config use-context docker-desktop
   ```

### Register Template

```bash
./scripts/register-test-template.sh
```

### Execute Test

#### Basic Execution

```bash
opencode activity execute test-metabob-stack-e2e \
  --variable testRunId=e2e-test-$(date +%Y%m%d-%H%M%S) \
  --variable redisTestInput='Hello Redis' \
  --variable surrealTestActivityName='test-activity' \
  --variable surrealTestStatus='pending' \
  --variable surrealTestInput='Test data' \
  --variable acpTestInput='Echo this message' \
  --variable acpTestValue1='value1' \
  --variable acpTestValue2='value2' \
  --variable e2eTestPrompt='Complete workflow test'
```

#### Custom Test Data

You can customize any test input to verify different scenarios:

```bash
# Test with specific data
opencode activity execute test-metabob-stack-e2e \
  --variable testRunId=custom-test-001 \
  --variable redisTestInput='Custom test data for Redis verification' \
  --variable surrealTestActivityName='my-custom-activity' \
  --variable surrealTestStatus='running' \
  --variable surrealTestInput='SurrealDB specific test input' \
  --variable acpTestInput='DevBob should echo this exact text' \
  --variable acpTestValue1='first-value' \
  --variable acpTestValue2='second-value' \
  --variable e2eTestPrompt='Process this complete workflow with specific data'
```

### Required Variables

| Variable | Type | Description | Example |
|----------|------|-------------|---------|
| `testRunId` | string | Unique test run identifier | `e2e-test-20260226-001` |
| `redisTestInput` | string | Test data for Redis round-trip | `Hello Redis` |
| `surrealTestActivityName` | string | Activity name for SurrealDB | `test-activity` |
| `surrealTestStatus` | string | Status value for SurrealDB | `pending` or `running` |
| `surrealTestInput` | string | Test data for SurrealDB | `Test data` |
| `acpTestInput` | string | Echo test input for DevBob | `Echo this message` |
| `acpTestValue1` | string | First value for impulse sharing | `value1` |
| `acpTestValue2` | string | Second value for impulse sharing | `value2` |
| `e2eTestPrompt` | string | Prompt for full workflow test | `Complete workflow test` |

## Test Results

### Success Criteria

The test **PASSES** if:
- ✅ All component tests PASS
- ✅ All input-output dependencies verified
- ✅ All data flow requirements met
- ✅ 100% dependency verification rate

### Failure Scenarios

The test **FAILS** if:
- ❌ Any component is not Running
- ❌ Data round-trip fails (output !== input)
- ❌ ACP server not responding
- ❌ Input-output dependency not verified
- ❌ End-to-end flow broken

### Output Format

```json
{
  "testRunId": "e2e-test-20260226-001",
  "timestamp": "2026-02-26T21:30:00Z",
  "overallStatus": "PASS",
  "componentResults": {
    "redis": {"status": "PASS", "dataFlowVerified": true},
    "surrealdb": {"status": "PASS", "dataFlowVerified": true},
    "devbob": {"status": "PASS", "acpVerified": true},
    "e2e": {"status": "PASS", "fullFlowVerified": true}
  },
  "dataFlowRequirements": {
    "requirement1_redisRoundTrip": "PASS",
    "requirement2_surrealdbStructure": "PASS",
    "requirement3_acpResponse": "PASS",
    "requirement4_impulseSharing": "PASS",
    "requirement5_e2eDependency": "PASS"
  },
  "inputOutputDependencies": {
    "totalTested": 10,
    "verified": 10,
    "failed": 0,
    "verificationRate": "100%"
  }
}
```

## Impulses Created

The activity creates impulses at each stage for traceability:

| Impulse ID | Type | Content | Purpose |
|------------|------|---------|---------|
| `deployment-state-{testRunId}` | memo | Deployment status | Track initial state |
| `redis-test-{testRunId}` | memo | Redis test results | Verify Redis flow |
| `surrealdb-test-{testRunId}` | memo | SurrealDB test results | Verify SurrealDB flow |
| `acp-test-{testRunId}` | memo | ACP test results | Verify DevBob ACP |
| `e2e-test-{testRunId}` | memo | E2E test results | Verify complete flow |
| `test-report-{testRunId}` | memo | Final test report | Aggregate all results |

## Interpreting Results

### All Tests PASS

```
✓ Metabob Stack is fully operational
✓ All data flows are working correctly
✓ Input-output dependencies are enforced
✓ System behaves deterministically
```

**Next Steps:**
- Deploy to production with confidence
- Run regression tests regularly
- Use as baseline for performance testing

### Some Tests FAIL

Check the test report impulse for diagnostics:

```bash
# View test report
opencode impulse list | grep test-report-{testRunId}
opencode impulse load test-report-{testRunId}
```

**Common Issues:**

1. **Redis Test FAIL:**
   - Check Redis pod is Running
   - Verify port-forward works
   - Check network connectivity

2. **SurrealDB Test FAIL:**
   - Check SurrealDB pod is Running
   - Verify database initialization
   - Check authentication (root/root)

3. **DevBob ACP Test FAIL:**
   - Check ACP server initialized
   - Verify "acp-command setup connection" in logs
   - Test ACP endpoint with curl

4. **E2E Test FAIL:**
   - Review individual component tests first
   - Check data flow at each stage
   - Verify impulse sharing works

## Advanced Usage

### Running Specific Tests Only

Modify the activity template to comment out unwanted tasks or use:

```bash
# Test Redis only
opencode activity execute test-metabob-stack-e2e \
  --variable testRunId=redis-only-test \
  --skip-task test-surrealdb-data-flow \
  --skip-task test-devbob-acp-delegation \
  --skip-task test-end-to-end-data-flow
```

### Custom Validation Logic

Add custom validation by modifying task prompts in `templates/test-metabob-stack-e2e.json`:

```json
{
  "id": "custom-validation",
  "dependencies": ["test-end-to-end-data-flow"],
  "prompt": {
    "template": "Your custom validation logic here..."
  }
}
```

### Integration with CI/CD

```yaml
# .github/workflows/e2e-test.yml
name: Metabob Stack E2E Test

on: [push, pull_request]

jobs:
  e2e-test:
    runs-on: ubuntu-latest
    steps:
      - name: Deploy Stack
        run: |
          cd helm
          helmfile -f helmfile.yaml sync
      
      - name: Run E2E Test
        run: |
          opencode activity execute test-metabob-stack-e2e \
            --variable testRunId=ci-test-${{ github.run_id }} \
            ...
      
      - name: Check Results
        run: |
          # Parse test results and fail if not PASS
          opencode impulse load test-report-ci-test-${{ github.run_id }}
```

## Troubleshooting

### Activity Execution Fails

```bash
# Check activity status
opencode activity list

# View activity logs
opencode activity logs test-metabob-stack-e2e
```

### Impulse Not Created

```bash
# List all impulses
opencode impulse list | grep {testRunId}

# If missing, check task logs for errors
```

### Validation Script Fails

```bash
# Run validation script directly
./scripts/validate-metabob-stack.sh

# Expected: ✓ All checks passed!
```

## Best Practices

1. **Use Unique Test Run IDs:**
   ```bash
   testRunId=e2e-test-$(date +%Y%m%d-%H%M%S)
   ```

2. **Run Tests After Deployment:**
   ```bash
   cd helm && helmfile sync && \
   sleep 30 && \
   opencode activity execute test-metabob-stack-e2e ...
   ```

3. **Store Test Results:**
   ```bash
   # Save test report to file
   opencode impulse load test-report-{testRunId} > test-results.json
   ```

4. **Run Regression Tests:**
   ```bash
   # Run with same inputs, compare outputs
   ./run-e2e-test.sh baseline-inputs.json > baseline-results.json
   ./run-e2e-test.sh baseline-inputs.json > new-results.json
   diff baseline-results.json new-results.json
   ```

## Performance Expectations

| Stage | Expected Duration | Notes |
|-------|------------------|-------|
| Deployment Validation | 5-10 seconds | Quick pod status checks |
| Redis Test | 5-15 seconds | Network + Redis ops |
| SurrealDB Test | 10-20 seconds | Database query time |
| DevBob ACP Test | 30-60 seconds | LLM response time |
| E2E Test | 60-120 seconds | Complete workflow |
| Aggregation | 5-10 seconds | Result processing |
| **Total** | **2-4 minutes** | Full test suite |

## Related Documentation

- **Stack Deployment:** `METABOB_STACK_DEPLOYMENT_GUIDE.md`
- **DevBob ACP Usage:** `DEVBOB_ACP_USAGE_GUIDE.md`
- **Quick Start:** `QUICK_START.md`
- **Validation Script:** `scripts/validate-metabob-stack.sh`

## Support

For issues with the test activity:
1. Check deployment: `./scripts/validate-metabob-stack.sh`
2. Review test report impulse: `opencode impulse load test-report-{testRunId}`
3. Check individual component logs: `kubectl logs -n metabob <pod-name>`
4. Verify test inputs are correct (no typos in variables)

---

**Status:** ✅ Template Registered and Ready  
**Last Updated:** February 26, 2026  
**Activity ID:** `test-metabob-stack-e2e`
