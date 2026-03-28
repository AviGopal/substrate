# SurrealDB v3.0.0 Authentication Validation Harness

## Overview

This validation harness tests that Activity API successfully authenticates to SurrealDB v3.0.0 using proper scope-based credentials (NS/DB parameters in signin).

## Specification

**Name**: surrealdb-v3-authentication  
**Enforcement**: Fixed signin() method to include NS and DB parameters, fixed namespace configuration mismatch  
**Goal**: Verify Activity API authenticates successfully and templates endpoint works

## Test Strategy

The harness performs multi-layer validation:

### Layer 1: Application Layer
- **Test 1**: GET /v2/activities/templates returns HTTP 200 (not 500)
- **Test 2**: Activity API logs show successful SurrealDB connection with verification

### Layer 2: Database Layer
- **Test 3**: SurrealDB logs show no authentication rejection errors
- **Test 4**: Direct SQL connection with kubectl exec using NS/DB scope succeeds

### Layer 3: Infrastructure Layer
- **Test 5**: Kubernetes secret contains rendered credentials (not Helmfile templates)
- **Test 6**: Namespace configuration is consistent (activity-system)

## Prerequisites

1. **Kubernetes cluster accessible** via kubectl
2. **Activity system deployed** to `activity-system` namespace:
   - SurrealDB pod running
   - Activity API pod running
3. **Enforcement applied**:
   - Activity API image rebuilt with signin() NS/DB fix
   - Helmfile applied with namespace configuration fix

## Running the Harness

### Command Line

```bash
# Run directly with ts-node
ts-node tests/validation-harnesses/surrealdb-v3-authentication-harness.ts

# Or make executable and run
chmod +x tests/validation-harnesses/surrealdb-v3-authentication-harness.ts
./tests/validation-harnesses/surrealdb-v3-authentication-harness.ts
```

### Programmatic Usage

```typescript
import { runValidation } from './tests/validation-harnesses/surrealdb-v3-authentication-harness';

const exitCode = await runValidation();
// 0 = all tests passed
// 1 = validation failed
// 2 = setup error (K8s not accessible, pods not ready)
```

## Exit Codes

- **0**: All validations PASSED - authentication working correctly
- **1**: Validation FAILED - one or more tests failed
- **2**: Setup error - kubectl not accessible, pods not running, etc.

## Expected Output

### Success Case

```
═══════════════════════════════════════════════════════════
  SurrealDB v3.0.0 Authentication Validation Harness
═══════════════════════════════════════════════════════════

Running pre-flight checks...

✓ kubectl access: PASS
✓ Activity API pod: PASS (Running)
✓ SurrealDB pod: PASS (Running)

✓ All pre-flight checks passed

Starting port-forward to Activity API...
Port-forward ready
✓ Port-forward established

Running validation test cases...

Testing: Templates Endpoint HTTP 200
  Description: GET /v2/activities/templates returns HTTP 200 (not 500)
  ✓ PASS
    Templates endpoint accessible, authentication successful

Testing: Activity API Logs
  Description: Activity API logs show successful SurrealDB connection
  ✓ PASS
    Activity API logs show successful SurrealDB connection with namespace verification

Testing: SurrealDB Logs
  Description: SurrealDB logs show no authentication errors
  ✓ PASS
    SurrealDB logs show no authentication rejections

Testing: Direct SurrealDB Connection
  Description: Direct SQL connection with kubectl exec works
  ✓ PASS
    Direct SurrealDB connection with credentials works

Testing: Namespace Configuration
  Description: Namespace configuration is consistent
  ✓ PASS
    Namespace configuration is consistent

═══════════════════════════════════════════════════════════
  Validation Summary
═══════════════════════════════════════════════════════════

Tests Passed: 5/5
Tests Failed: 0/5

✓ All validations PASSED

SurrealDB v3.0.0 authentication is working correctly:
  - Activity API authenticates successfully with NS/DB scope
  - Templates endpoint returns HTTP 200
  - No authentication errors in logs
  - Direct SurrealDB connection works
  - Namespace configuration is consistent

Cleaning up port-forward...
```

### Failure Case

```
Testing: Templates Endpoint HTTP 200
  Description: GET /v2/activities/templates returns HTTP 200 (not 500)
  ✗ FAIL
    Expected: HTTP 200
    Actual: HTTP 500
    Details: Expected HTTP 200 but got 500. Response: {"error":"There was a problem with authentication"}

Testing: Activity API Logs
  Description: Activity API logs show successful SurrealDB connection
  ✗ FAIL
    Expected: {"hasSuccessMessage":true,"hasVerified":true,"noAuthError":true,"noNamespaceError":true}
    Actual: {"hasSuccessMessage":false,"hasVerified":false,"noAuthError":false,"noNamespaceError":true}
    Details: Activity API logs indicate connection issues. Check: missing success message, missing verification, has auth error

═══════════════════════════════════════════════════════════
  Validation Summary
═══════════════════════════════════════════════════════════

Tests Passed: 3/5
Tests Failed: 2/5

✗ Validation FAILED

Failed tests:
  - Templates Endpoint HTTP 200: Expected HTTP 200 but got 500. Response: {"error":"There was a problem with authentication"}
  - Activity API Logs: Activity API logs indicate connection issues. Check: missing success message, missing verification, has auth error
```

## Troubleshooting

### Test 1 Fails: Templates Endpoint HTTP 500

**Symptom**: GET /v2/activities/templates returns HTTP 500  
**Likely Causes**:
1. Activity API image not rebuilt after signin() fix
2. Helmfile not applied with namespace configuration fix
3. Credentials secret contains template placeholders

**Remediation**:
```bash
# Rebuild Activity API
cd repos/metabob-activity-api
docker build -t metabob-activity-api:latest .

# Apply helmfile with credentials
export SURREALDB_USERNAME="root"
export SURREALDB_PASSWORD="surrealdb-local-dev-123"
helmfile -f helm/helmfile-activity-minimal.yaml -e local apply

# Wait for pod restart
kubectl rollout status deployment/metabob-activity-api -n activity-system
```

### Test 2 Fails: Activity API Logs Show Auth Errors

**Symptom**: Logs contain "There was a problem with authentication"  
**Likely Causes**:
1. signin() method still missing NS/DB parameters
2. Client library incompatible with v3.0.0
3. Credentials invalid

**Remediation**:
```bash
# Check current code
cat repos/metabob-activity-api/src/db/surreal.ts | grep -A 5 "signin"

# Should show:
# await this.db.signin({
#   NS: config.surrealdb.namespace,
#   DB: config.surrealdb.database,
#   username: config.surrealdb.username,
#   password: config.surrealdb.password,
# });

# If not, apply enforcement changes and rebuild
```

### Test 4 Fails: Direct Connection Fails

**Symptom**: kubectl exec SQL query fails  
**Likely Causes**:
1. SurrealDB v3.0.0 requires different authentication method
2. Credentials are invalid or not rendered
3. Namespace doesn't exist

**Remediation**:
```bash
# Check SurrealDB version
kubectl get pods -n activity-system -l app.kubernetes.io/name=surrealdb -o jsonpath='{.items[0].spec.containers[0].image}'

# Should show: surrealdb/surrealdb:v3.0.0

# Check credentials
kubectl get secret -n activity-system surrealdb-credentials -o jsonpath="{.data.username}" | base64 -d
# Should NOT contain "{{ env"

# Check SurrealDB logs
kubectl logs -n activity-system -l app.kubernetes.io/name=surrealdb --tail=50
```

### Test 5 Fails: Secret Contains Templates

**Symptom**: Secret contains literal `{{ env "SURREALDB_USERNAME" }}`  
**Likely Causes**: Helmfile applied without environment variables set

**Remediation**:
```bash
# Set credentials and reapply
export SURREALDB_USERNAME="root"
export SURREALDB_PASSWORD="surrealdb-local-dev-123"
helmfile -f helm/helmfile-activity-minimal.yaml -e local apply

# Verify secret
kubectl get secret -n activity-system surrealdb-credentials -o jsonpath="{.data.username}" | base64 -d
# Should show: root
```

## Test Case Details

See `surrealdb-v3-authentication-test-cases.json` for detailed test case definitions including:
- Input parameters
- Expected outputs
- Rationale for each test
- Success criteria

## Related Files

- **Harness**: `tests/validation-harnesses/surrealdb-v3-authentication-harness.ts`
- **Test Cases**: `tests/validation-harnesses/surrealdb-v3-authentication-test-cases.json`
- **Trace Analysis**: `impulses/trace-surrealdb-v3-authentication.md`
- **Enforcement**: `impulses/enforcement-surrealdb-v3-authentication.md`
- **Specification**: See calling agent context

## Success Criteria

All 5 test cases must pass:
- ✓ Templates endpoint HTTP 200
- ✓ Activity API logs show success
- ✓ SurrealDB logs show no errors
- ✓ Direct connection works
- ✓ Namespace configuration consistent

Critical tests (1, 2, 4) are essential - their failure indicates authentication is still broken.
