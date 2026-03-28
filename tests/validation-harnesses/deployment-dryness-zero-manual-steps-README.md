# Validation Harness: Deployment DRYness - Zero Manual Steps

## Purpose

This harness validates that Helm deployment works with **zero manual kubectl commands**. ENVIRONMENT variable and JWT_SECRET_KEY must be configured declaratively in helm values and templates, not manually added after deployment.

## Specification

**Goal**: After running `helmfile -e default apply`, the RPC API deployment should start successfully with ENVIRONMENT=development and JWT_SECRET_KEY configured from helm values/secrets, without requiring any manual `kubectl set env` or `kubectl edit configmap` commands.

## Test Strategy

The harness performs an end-to-end validation of the deployment process:

1. **Pre-deployment Validation**: Verify helm chart has proper values and templates
2. **Clean Deployment**: Run `helmfile destroy && helmfile apply` from scratch
3. **Resource Verification**: Confirm ConfigMap and Deployment exist
4. **Pod Startup**: Verify RPC API pod reaches Running state without manual intervention
5. **Configuration Check**: Verify ENVIRONMENT and JWT_SECRET_KEY are set correctly
6. **Functionality Test**: Run API health check to confirm application works
7. **Zero Manual Steps Meta-Test**: Verify no manual steps were needed

## Expected Behavior

### PASS Criteria ✅

All 8 tests must pass:

1. **Helm Chart Validation**: 
   - ConfigMap template exists at `helm/charts/metabob-rpc-api/templates/configmap.yaml`
   - Base values.yaml defines `environment` and `jwtSecretKey`
   - Local values.yaml defines `metabobRpcApi.environment` and `metabobRpcApi.jwtSecretKey`
   - Deployment templates have ENVIRONMENT env var

2. **Clean Deployment**:
   - `helmfile -e default destroy` completes (or no-op if nothing exists)
   - `helmfile -e default apply` exits with code 0

3. **ConfigMap Creation**:
   - `universal-config` ConfigMap exists in metabob namespace
   - Created automatically by helm (not manually)

4. **Pod Startup**:
   - RPC API pod reaches Running state within 120 seconds
   - No CrashLoopBackOff state
   - All containers ready

5. **Environment Variable**:
   - ENVIRONMENT env var exists in deployment spec
   - Value matches expected (development for local environment)

6. **JWT Secret Key**:
   - JWT_SECRET_KEY exists in ConfigMap data
   - Not empty

7. **API Health Check**:
   - GET /health returns 200 OK
   - API is functional

8. **Zero Manual Steps**:
   - Meta-test confirms all critical tests passed
   - No manual kubectl commands were needed

### FAIL Criteria ❌

Any of these conditions cause a FAIL:

- ConfigMap template missing
- Deployment values missing ENVIRONMENT or jwtSecretKey
- helmfile apply fails (non-zero exit code)
- ConfigMap not created automatically
- Pod enters CrashLoopBackOff
- Pod doesn't reach Running state within 120 seconds
- ENVIRONMENT variable not set or has wrong value
- JWT_SECRET_KEY missing from ConfigMap
- API health check fails (non-200 response)

## Usage

### Run the harness

```bash
# Install dependencies
npm install axios

# Run from repository root
ts-node tests/validation-harnesses/deployment-dryness-zero-manual-steps-harness.ts
```

### Expected Output

```
================================================================================
Deployment DRYness - Zero Manual Steps Validation
================================================================================

[TEST 1] Validating Helm chart configuration...
  ✅ ConfigMap template exists
  ✅ Base values.yaml has environment and jwtSecretKey
  ✅ Local values.yaml has metabobRpcApi config
  ✅ Deployment templates have ENVIRONMENT env var

[TEST 2] Running clean deployment (destroy + apply)...
  Destroying existing deployment...
  Destroy completed
  Waiting for cleanup...
  Applying fresh deployment...
  ✅ Deployment succeeded

[TEST 3] Verifying ConfigMap creation...
  ✅ ConfigMap universal-config exists

[TEST 4] Verifying pod startup...
  Pod status: Pending, waiting...
  Pod status: Running, containers not ready...
  ✅ Pod reached Running state in 45 seconds

[TEST 5] Verifying ENVIRONMENT variable...
  ✅ ENVIRONMENT=development

[TEST 6] Verifying JWT_SECRET_KEY in ConfigMap...
  ✅ JWT_SECRET_KEY found in ConfigMap (length: 41)

[TEST 7] Running API health check...
  ✅ API health check passed

[TEST 8] Verifying zero manual steps...
  ✅ Zero manual steps required

================================================================================
VALIDATION RESULTS
================================================================================
Total Tests: 8
Passed: 8
Failed: 0
Overall: PASS ✅

Detailed Results:
  ✅ helmChartValidation: PASS
      All helm chart files have required configuration
  ✅ cleanDeployment: PASS
      Clean deployment succeeded
  ✅ configMapCreation: PASS
      ConfigMap universal-config created successfully
  ✅ podStartup: PASS
      Pod reached Running state in 45 seconds
  ✅ environmentVariable: PASS
      ENVIRONMENT variable correctly set to development
  ✅ jwtSecretKey: PASS
      JWT_SECRET_KEY found in ConfigMap (length: 41)
  ✅ apiHealthCheck: PASS
      API health check passed
  ✅ zeroManualSteps: PASS
      Zero manual steps required - deployment fully declarative
```

## Test Cases

### Test Case 1: Clean Deployment Without Manual Steps

**Input**:
```json
{
  "namespace": "metabob",
  "helmfileEnvironment": "default",
  "rpcApiBaseUrl": "http://localhost:8000",
  "deploymentName": "metabob-rpc-api",
  "configMapName": "universal-config",
  "expectedEnvironment": "development",
  "expectedJwtSecretKey": "dev-secret-key-change-in-production-12345",
  "maxPodStartupSeconds": 120
}
```

**Expected Output**:
- All 8 tests PASS
- Pod reaches Running state without CrashLoopBackOff
- No manual kubectl commands needed

## Architecture

The harness tests the complete data flow:

```
helmfile.yaml
  ↓
environments/local.values.yaml (ENVIRONMENT=development, jwtSecretKey)
  ↓
charts/metabob-rpc-api/values.yaml (defaults)
  ↓
templates/configmap.yaml (creates universal-config with JWT_SECRET_KEY)
  ↓
templates/deployment-api.yaml (ENVIRONMENT env var from values)
  ↓
Pod starts with ENVIRONMENT=development
  ↓
RPC API validates JWT in development mode (relaxed)
  ↓
Running state - no manual intervention needed
```

## Historical Context

**Before Enforcement** ❌:
- helmfile apply would deploy pods
- Pods would enter CrashLoopBackOff (ENVIRONMENT undefined)
- Manual fix: `kubectl set env deployment/metabob-rpc-api ENVIRONMENT=development`
- Only then would pods start successfully

**After Enforcement** ✅:
- helmfile apply deploys pods with ENVIRONMENT from values
- ConfigMap created with JWT_SECRET_KEY
- Pods start successfully on first try
- Zero manual steps required

## Troubleshooting

### Harness Fails: ConfigMap Template Missing

**Symptom**: Test 1 fails with "ConfigMap template does not exist"

**Fix**: Ensure `helm/charts/metabob-rpc-api/templates/configmap.yaml` exists

### Harness Fails: Pod CrashLoopBackOff

**Symptom**: Test 4 fails with "Pod entered CrashLoopBackOff state"

**Fix**: Check deployment logs:
```bash
kubectl logs -n metabob deployment/metabob-rpc-api
```

Likely causes:
- ENVIRONMENT variable not set
- JWT_SECRET_KEY missing or invalid
- Other configuration errors

### Harness Fails: ENVIRONMENT Variable Not Set

**Symptom**: Test 5 fails with "ENVIRONMENT variable not found"

**Fix**: Verify deployment template has ENVIRONMENT env var:
```bash
kubectl get deployment metabob-rpc-api -n metabob -o yaml | grep -A 5 "name: ENVIRONMENT"
```

## Integration with Activity System

This harness can be called from an activity template:

```json
{
  "id": "validate-deployment-dryness",
  "prompt": {
    "template": "Run validation harness: ts-node tests/validation-harnesses/deployment-dryness-zero-manual-steps-harness.ts"
  },
  "validation": {
    "commands": [
      {
        "command": "ts-node tests/validation-harnesses/deployment-dryness-zero-manual-steps-harness.ts",
        "expectedExitCode": 0
      }
    ]
  }
}
```

## Related Files

- **Harness**: `tests/validation-harnesses/deployment-dryness-zero-manual-steps-harness.ts`
- **Test Cases**: `impulses/validation-deployment-dryness-zero-manual-steps-case-1.json`
- **Harness Impulse**: `impulses/harness-deployment-dryness-zero-manual-steps.json`
- **Trace Analysis**: `impulses/trace-deployment-dryness-zero-manual-steps.md`
- **Enforcement Summary**: `impulses/enforcement-deployment-dryness-zero-manual-steps.md`

## Success Criteria

The harness is considered successful when:

1. All 8 tests pass
2. Exit code is 0
3. No errors logged
4. Pod reaches Running state within 120 seconds
5. No manual kubectl commands needed at any point
