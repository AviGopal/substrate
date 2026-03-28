# Validation Harness: Kubernetes-Deployment-Validation-Exit-Codes

## Purpose

Validate that `repos/platform/scripts/validate-local-deployment.sh` returns correct exit codes based on deployment health, enabling programmatic failure detection for CI/CD automation.

## Specification

The deployment validation script MUST:
- Return **exit code 0** when deployment is healthy (all pods Running, all services have endpoints)
- Return **exit code 1** when deployment has failures (pods in CrashLoopBackOff/ImagePullBackOff, services without endpoints)
- Output **"✅ VALIDATION PASSED"** on success
- Output **"❌ VALIDATION FAILED"** on failure

## Test Strategy

1. Get current deployment state (pods not ready, services without endpoints)
2. Run `repos/platform/scripts/validate-local-deployment.sh`
3. Capture exit code and output
4. Verify exit code matches deployment health
5. Verify output contains correct message
6. Ensure both messages don't appear simultaneously

**Result:** PASS/FAIL without LLM interaction

## Files

- **Harness (TypeScript):** `Kubernetes-Deployment-Validation-Exit-Codes-harness.ts`
- **Runner (Bash):** `run-kubernetes-deployment-validation-exit-codes.sh` ✅ Recommended
- **Test Cases:** `test-cases/kubernetes-deployment-validation-exit-codes-cases.json`
- **Results:** `validation-results-kubernetes-deployment-validation-exit-codes.json`

## Usage

### Bash Runner (Recommended)

```bash
# Run from repo root
bash tests/validation-harnesses/run-kubernetes-deployment-validation-exit-codes.sh
```

**Why bash?** Avoids ESM/CommonJS module issues with ts-node.

### TypeScript (Alternative)

```bash
# Run from repo root
npx ts-node tests/validation-harnesses/Kubernetes-Deployment-Validation-Exit-Codes-harness.ts
```

Note: May encounter module system issues. Bash runner is more reliable.

## Test Cases

### Case 1: Exit Code with Unhealthy Deployment
- **Input:** Current deployment state (with CrashLoopBackOff and ImagePullBackOff)
- **Expected:** Exit code 1, output contains "❌ VALIDATION FAILED"
- **Impulse:** `validation-Kubernetes-Deployment-Validation-Exit-Codes-case-1`

### Case 2: Detect CrashLoopBackOff
- **Input:** Deployment with pod in CrashLoopBackOff
- **Expected:** Exit code 1, failure detected
- **Impulse:** `validation-Kubernetes-Deployment-Validation-Exit-Codes-case-2`

### Case 3: Detect ImagePullBackOff
- **Input:** Deployment with pod in ImagePullBackOff
- **Expected:** Exit code 1, failure detected
- **Impulse:** `validation-Kubernetes-Deployment-Validation-Exit-Codes-case-3`

### Case 4: Detect Missing Endpoints
- **Input:** Deployment with service without endpoints
- **Expected:** Exit code 1, failure detected
- **Impulse:** `validation-Kubernetes-Deployment-Validation-Exit-Codes-case-4`

## Current Test Results

**Status:** ✅ PASSED

**Deployment State:**
- Total pods: 2
- Pods not ready: 2 (devbob CrashLoopBackOff, redis ImagePullBackOff)
- Services without endpoints: 1 (redis-replicas)

**Validation Results:**
- ✅ Exit code correct: 1
- ✅ Output message correct: "❌ VALIDATION FAILED"
- ✅ Minimum pod count satisfied: 2 >= 1

**Conclusion:** Validation script correctly returns exit code 1 when deployment has failures.

## CI/CD Integration

### GitHub Actions

```yaml
name: Validate Deployment Exit Codes

on:
  push:
    paths:
      - 'repos/platform/scripts/validate-local-deployment.sh'

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      
      - name: Setup Kubernetes
        uses: engineerd/setup-kind@v0.5.0
      
      - name: Deploy Test Environment
        run: |
          cd repos/platform/deployments/metabob
          helmfile -e local sync
      
      - name: Run Validation Harness
        run: bash tests/validation-harnesses/run-kubernetes-deployment-validation-exit-codes.sh
        timeout-minutes: 5
```

### GitLab CI

```yaml
validate-exit-codes:
  stage: test
  script:
    - bash tests/validation-harnesses/run-kubernetes-deployment-validation-exit-codes.sh
  timeout: 5 minutes
```

## Impulses Created

### Harness Impulse
- **ID:** `harness-Kubernetes-Deployment-Validation-Exit-Codes`
- **Type:** file
- **Pointer:** `tests/validation-harnesses/Kubernetes-Deployment-Validation-Exit-Codes-harness.ts`
- **Budget:** 2000 tokens

### Test Case Impulses
- `validation-Kubernetes-Deployment-Validation-Exit-Codes-case-1` (exit code with unhealthy deployment)
- `validation-Kubernetes-Deployment-Validation-Exit-Codes-case-2` (detect CrashLoopBackOff)
- `validation-Kubernetes-Deployment-Validation-Exit-Codes-case-3` (detect ImagePullBackOff)
- `validation-Kubernetes-Deployment-Validation-Exit-Codes-case-4` (detect missing endpoints)

Each test case impulse:
- **Type:** memo
- **Budget:** 1000 tokens
- **Content:** Test description, input, expected output, validation logic

## Validation Logic

```bash
# Get deployment state
PODS_NOT_READY=$(kubectl get pods -n metabob --no-headers | grep -v "Running\|Completed" | wc -l)
SERVICES_WITHOUT_ENDPOINTS=$(kubectl get endpoints -n metabob --no-headers | awk '$2 == "<none>"' | wc -l)

# Run validation script
bash repos/platform/scripts/validate-local-deployment.sh
ACTUAL_EXIT_CODE=$?

# Determine expected exit code
if [ "$PODS_NOT_READY" -gt 0 ] || [ "$SERVICES_WITHOUT_ENDPOINTS" -gt 0 ]; then
  EXPECTED_EXIT_CODE=1
else
  EXPECTED_EXIT_CODE=0
fi

# Validate
if [ "$ACTUAL_EXIT_CODE" == "$EXPECTED_EXIT_CODE" ]; then
  echo "✅ PASS: Exit code correct"
else
  echo "❌ FAIL: Exit code mismatch"
fi
```

## Related Specifications

- **Trace:** `trace-Kubernetes-Deployment-Validation-Exit-Codes`
- **Enforcement:** `enforcement-Kubernetes-Deployment-Validation-Exit-Codes`

## Future Test Cases (When Deployment is Healthy)

### Case 5: Exit Code with Healthy Deployment
- **Input:** All pods Running, all services have endpoints
- **Expected:** Exit code 0, output contains "✅ VALIDATION PASSED"
- **Status:** Pending - requires fixing current deployment issues

## Troubleshooting

### Harness Fails to Run

**Issue:** TypeScript module system errors

**Solution:** Use bash runner instead:
```bash
bash tests/validation-harnesses/run-kubernetes-deployment-validation-exit-codes.sh
```

### Exit Code Verification Fails

**Issue:** Script returns wrong exit code

**Solution:** Check script implementation in `repos/platform/scripts/validate-local-deployment.sh`:
- Ensure explicit `exit 0` on success
- Ensure explicit `exit 1` on failure
- Verify conditional logic at lines 90-101

### Test Passes But Shouldn't

**Issue:** Deployment is healthy but expected unhealthy

**Solution:** Update test cases JSON to match current deployment state:
```json
{
  "expectedOutput": {
    "exitCode": 0,
    "shouldDetectFailures": false,
    "outputPattern": "✅ VALIDATION PASSED"
  }
}
```

## Summary

This validation harness provides **automated, LLM-free testing** of the deployment validation script's exit code behavior. It ensures programmatic failure detection works correctly for CI/CD automation.

**Key Features:**
- ✅ No LLM required
- ✅ Fully automated
- ✅ CI/CD ready
- ✅ Historical test cases stored as impulses
- ✅ Bash runner avoids module issues
- ✅ JSON results for integration
