# Validation Harnesses

Automated validation harnesses for testing specifications without requiring an LLM.

## minibob Complete System Integration Harness

**File**: `minibob-complete-system-integration-harness.ts`  
**Specification**: minibob Complete System Integration - End-to-End Vessel Development Workflow  
**Impulse**: `harness-minibob-complete-system-integration`

### Purpose

Validates the complete minibob vessel development workflow end-to-end:
- deployment → auto-configuration → validation → observation → refinement → repeat

This harness proves that "minibob is a vessel for developing vessels" by verifying the complete autonomous development cycle.

### Validation Steps

The harness executes 8 validation steps:

1. **Local Development Phase** - Tests pass, type check passes, Docker image ready
2. **Deployment Phase** - Helmfile deployment successful, pods running
3. **Self-Configuration** - Environment detected, capabilities match expected
4. **Capability Tests** - Activity execution, ACP delegation, boredom system
5. **Metrics Collection** - Metrics files exist with valid structure
6. **Boredom Task Queue** - Backend endpoint accessible, tasks queryable
7. **Autonomous Execution** - Boredom system executes tasks (optional, requires time)
8. **Autonomous Commits** - Git log shows vessel commits (optional, requires time)

Steps 7-8 are optional and can be skipped with `skipLongRunning: true` for quick validation.

### Test Cases

Four test cases are provided as impulses:

#### Test Case 1: Quick Validation (testing-cluster)
- **Impulse**: `validation-minibob-complete-system-integration-case-1`
- **Layer**: `testing-cluster` (3 pods, boredom + gossip enabled)
- **Skip Long Running**: Yes
- **Steps**: 6
- **Expected**: All 6 steps pass

#### Test Case 2: Full Validation (testing-cluster)
- **Impulse**: `validation-minibob-complete-system-integration-case-2`
- **Layer**: `testing-cluster` (3 pods, boredom + gossip enabled)
- **Skip Long Running**: No
- **Steps**: 8
- **Expected**: At least 7 steps pass (autonomous behavior may take time)

#### Test Case 3: Single Pod Validation (dev)
- **Impulse**: `validation-minibob-complete-system-integration-case-3`
- **Layer**: `dev` (1 pod, no boredom, no gossip)
- **Skip Long Running**: Yes
- **Steps**: 6
- **Expected**: All 6 steps pass, capabilities = [activities, impulses, git, acp]

#### Test Case 4: Staging Validation
- **Impulse**: `validation-minibob-complete-system-integration-case-4`
- **Layer**: `staging` (3 pods, production simulation)
- **Skip Long Running**: Yes
- **Steps**: 6
- **Expected**: All 6 steps pass, capabilities = [activities, impulses, git, acp, acp-gossip, boredom]

### Usage

#### As TypeScript Module

```typescript
import runValidation from "./minibob-complete-system-integration-harness"

const result = await runValidation({
  repoPath: "./repos/minibob",
  helmPath: "./helm",
  environment: "testing",
  layer: "testing-cluster",
  skipLongRunning: true
})

if (result.pass) {
  console.log("✅ Validation passed!")
  console.log(result.summary)
} else {
  console.log("❌ Validation failed")
  for (const step of result.steps) {
    if (!step.pass) {
      console.log(`Failed step ${step.step}: ${step.name}`)
      console.log(`  ${step.message}`)
    }
  }
}
```

#### As CLI Script

```bash
# Quick validation (test case 1)
bun run tests/validation-harnesses/run-minibob-validation.ts 1

# Full validation (test case 2)
bun run tests/validation-harnesses/run-minibob-validation.ts 2

# Dev layer validation (test case 3)
bun run tests/validation-harnesses/run-minibob-validation.ts 3

# Staging layer validation (test case 4)
bun run tests/validation-harnesses/run-minibob-validation.ts 4
```

### Prerequisites

- Kind cluster running with minibob deployed
- Helm and helmfile installed
- kubectl configured for cluster access
- Backend (metabob-rpc-api) deployed and accessible
- bun runtime installed

### Expected Output

```
================================================================================
VALIDATION RESULTS
================================================================================
Status: ✅ PASS
Summary: ✅ ALL VALIDATION STEPS PASSED (6/6)
Timestamp: 2026-03-16T10:30:00.000Z

Step Results:
================================================================================

✅ Step 1: Local Development Phase
   Tests pass, types check, Docker ready

✅ Step 2: Deployment Phase
   Deployed to minibob-cluster, pods running

✅ Step 3: Self-Configuration Verification
   Environment detected, capabilities: activities, impulses, git, acp, acp-gossip, boredom

✅ Step 4: Capability Tests
   4 tests passed (>= 4 expected)

✅ Step 5: Metrics Collection
   Metrics file found: metrics-20260316-103000.json, 42 executions

✅ Step 6: Boredom Task Queue
   Boredom task queue accessible, 3 tasks

================================================================================
Final Status: ✅ PASS
================================================================================
```

### Architecture

The harness is designed to be:

- **LLM-Free**: No language model required for validation
- **Deterministic**: Same inputs always produce same pass/fail results
- **Observable**: Detailed step-by-step output for debugging
- **Historical**: Test cases stored as impulses can be replayed anytime
- **Fast**: Quick mode (6 steps) completes in ~2 minutes
- **Comprehensive**: Full mode (8 steps) validates autonomous behavior

### Integration with CI/CD

Add to your CI/CD pipeline:

```yaml
# .github/workflows/validate-minibob.yml
name: Validate minibob System Integration

on: [push, pull_request]

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: oven-sh/setup-bun@v1
      - name: Setup kind cluster
        run: ./scripts/setup-kind-cluster.sh
      - name: Deploy minibob
        run: cd helm && helmfile -e testing sync -l namespace=minibob-cluster
      - name: Run validation
        run: bun run tests/validation-harnesses/run-minibob-validation.ts 1
      - name: Collect results
        if: always()
        run: |
          kubectl logs -n minibob-cluster minibob-0 > validation-logs.txt
          ls -la repos/minibob/metrics/
```

### Extending the Harness

To add new validation steps:

1. Add a new `validateXYZ()` function following the pattern
2. Return a `StepResult` with pass/fail status
3. Add the step to `runValidation()` steps array
4. Update test case impulses with new expected step count
5. Document the new step in this README

### Troubleshooting

**Step 1 fails**: Check that bun test and bun typecheck work locally
**Step 2 fails**: Verify helmfile is installed and cluster is accessible
**Step 3 fails**: Check pod logs for startup errors
**Step 4 fails**: Run test-vessel-capabilities.sh manually to see which test fails
**Step 5 fails**: Check if metrics/ directory exists in repos/minibob
**Step 6 fails**: Verify backend is deployed and /boredom-tasks endpoint works
**Step 7 fails**: Wait longer or check boredom system is enabled in cluster mode
**Step 8 fails**: Requires boredom to execute and commit - may take time

### Related Files

- **Harness**: `minibob-complete-system-integration-harness.ts`
- **Runner**: `run-minibob-validation.ts`
- **Test Cases**: `impulses/validation-minibob-complete-system-integration-case-*.json`
- **Harness Impulse**: `impulses/harness-minibob-complete-system-integration.json`
- **Trace**: `MINIBOB_COMPLETE_SYSTEM_INTEGRATION_TRACE.md`
- **Enforcement**: `MINIBOB_COMPLETE_SYSTEM_INTEGRATION_ENFORCEMENT.md`

---

*"Validation without LLM proves the specification through observable, deterministic outcomes."*
