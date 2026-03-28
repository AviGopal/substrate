# Validation Harness: devbob-k8s-deployment-pattern

**Specification**: devbob-k8s-deployment-pattern  
**Harness File**: `devbob-k8s-deployment-pattern-harness.sh`  
**Test Cases**: `test-cases/devbob-k8s-deployment-pattern-cases.json`  
**Created**: 2026-03-01

## Overview

This validation harness verifies that the DevBob Kubernetes deployment conforms to the specification defined in `TRACE_devbob-k8s-deployment-pattern.md` and enforced in `ENFORCEMENT_devbob-k8s-deployment-pattern.md`.

## What It Validates

### 1. Pod Ready State ✅
- Pod starts successfully
- Reaches Ready 1/1 status
- Within 60 seconds
- Zero restarts

### 2. ACP Server Listening ✅
- ACP server starts successfully
- Logs "listening on port 8080" message
- Server actually listening on configured port

### 3. Health Endpoint ✅
- `/health` endpoint accessible
- Returns HTTP 200
- Response within 3 seconds

### 4. Secrets Injection ✅
- ANTHROPIC_API_KEY set and non-empty
- GITHUB_TOKEN set
- GIT_USER_NAME set
- GIT_USER_EMAIL set

### 5. Backend Services Connectivity ✅
- redis-master.metabob.svc DNS resolves
- surrealdb.metabob.svc DNS resolves
- metabob-rpc-api.metabob.svc DNS resolves
- All ports accessible

### 6. Pod Configuration Compliance ✅
- Image tag: `latest`
- Image pull policy: `Never`
- Command: `opencode` with proper args
- Args include `--print-logs` flag
- PORT: 8080
- HOME: `/workspace`
- Restart count: 0

### 7. Deployment Method ✅
- Deployed via Helm (canonical method)
- Helm release `devbob` exists
- Deployment resource exists
- StatefulSet does NOT exist (deprecated)

## Usage

### Basic Usage

```bash
./devbob-k8s-deployment-pattern-harness.sh
```

### Custom Namespace

```bash
./devbob-k8s-deployment-pattern-harness.sh --namespace=my-namespace
```

### Custom Timeout

```bash
./devbob-k8s-deployment-pattern-harness.sh --timeout=120
```

### Environment Variables

```bash
NAMESPACE=staging TIMEOUT=90 ./devbob-k8s-deployment-pattern-harness.sh
```

## Prerequisites

- `kubectl` configured with access to the cluster
- `helm` installed (for deployment method validation)
- `jq` installed (for JSON parsing)
- DevBob deployed in the target namespace

## Output

### Console Output

The harness prints color-coded test results:
- ✅ **PASS** (green) - Test passed
- ❌ **FAIL** (red) - Test failed with error message

Example:
```
======================================================================
DevBob K8s Deployment Pattern Validation
======================================================================
Namespace: metabob
Timeout: 60s
======================================================================

[Test 1/7] Checking if pod is ready within 60s...
Pod devbob-7d4f8b9c5-x7k2p is ready!
✅ PASS pod-ready Pod devbob-7d4f8b9c5-x7k2p ready in 12s

[Test 2/7] Checking if ACP server is listening on port 8080...
✅ PASS acp-server-listening Found: INFO ACP server listening on http://0.0.0.0:8080

[Test 3/7] Testing health endpoint at http://localhost:8080/health...
✅ PASS health-endpoint HTTP 200 OK

[Test 4/7] Verifying ANTHROPIC_API_KEY is set...
✅ PASS secrets-injected ANTHROPIC_API_KEY set (length: 108)

[Test 5/7] Testing connectivity to backend services...
  - Checking redis-master.metabob.svc.cluster.local:6379...
    ✓ DNS resolved
  - Checking surrealdb.metabob.svc.cluster.local:8000...
    ✓ DNS resolved
  - Checking metabob-rpc-api.metabob.svc.cluster.local:80...
    ✓ DNS resolved
✅ PASS backend-services All backend services accessible via DNS

[Test 6/7] Checking pod configuration...
✅ PASS pod-configuration Image: devbob:latest, Pull: Never, Restarts: 0

[Test 7/7] Verifying deployment uses Helm chart (canonical method)...
✅ PASS deployment-method Deployed via Helm with Deployment resource (canonical)

======================================================================
Validation Results Summary
======================================================================
Total Tests: 7
Passed: 7
Failed: 0
======================================================================

Results written to: validation-results-devbob-k8s-deployment-pattern.json

✅ All tests passed!
```

### JSON Output

Results are written to `validation-results-devbob-k8s-deployment-pattern.json`:

```json
{
  "specification": "devbob-k8s-deployment-pattern",
  "namespace": "metabob",
  "timestamp": "2026-03-01T22:15:30Z",
  "summary": {
    "total": 7,
    "passed": 7,
    "failed": 0,
    "success": true
  },
  "tests": [
    {
      "name": "pod-ready",
      "status": "PASS",
      "message": "Pod devbob-7d4f8b9c5-x7k2p ready in 12s"
    },
    {
      "name": "acp-server-listening",
      "status": "PASS",
      "message": "Found: INFO ACP server listening on http://0.0.0.0:8080"
    },
    {
      "name": "health-endpoint",
      "status": "PASS",
      "message": "HTTP 200 OK"
    },
    {
      "name": "secrets-injected",
      "status": "PASS",
      "message": "ANTHROPIC_API_KEY set (length: 108)"
    },
    {
      "name": "backend-services",
      "status": "PASS",
      "message": "All backend services accessible via DNS"
    },
    {
      "name": "pod-configuration",
      "status": "PASS",
      "message": "Image: devbob:latest, Pull: Never, Restarts: 0"
    },
    {
      "name": "deployment-method",
      "status": "PASS",
      "message": "Deployed via Helm with Deployment resource (canonical)"
    }
  ]
}
```

## Exit Codes

- **0**: All tests passed
- **1**: One or more tests failed

## Integration with CI/CD

### In Deployment Pipeline

```bash
# Deploy DevBob
./deploy-devbob-helm.sh

# Wait for deployment to stabilize
sleep 10

# Run validation
./tests/validation-harnesses/devbob-k8s-deployment-pattern-harness.sh

# Exit code determines pipeline success
```

### In Pre-Push Hook

```bash
#!/bin/bash
# .git/hooks/pre-push

echo "Running DevBob K8s deployment validation..."
./tests/validation-harnesses/devbob-k8s-deployment-pattern-harness.sh

if [ $? -ne 0 ]; then
    echo "Validation failed. Push aborted."
    exit 1
fi
```

## Troubleshooting

### Test 1 Fails: Pod Not Ready

**Symptom**: `❌ FAIL pod-ready Pod did not become ready within 60s`

**Actions**:
1. Check pod status: `kubectl get pods -n metabob -l app.kubernetes.io/name=devbob`
2. Check pod events: `kubectl describe pod <pod-name> -n metabob`
3. Check logs: `kubectl logs <pod-name> -n metabob --tail=100`
4. Increase timeout: `./devbob-k8s-deployment-pattern-harness.sh --timeout=120`

**Common Causes**:
- Image pull error (check `imagePullPolicy: Never` and image exists)
- Resource constraints (check node resources)
- Backend services not available (redis, surrealdb)
- Configuration errors in Helm values

---

### Test 2 Fails: ACP Server Not Listening

**Symptom**: `❌ FAIL acp-server-listening No 'listening on port 8080' message found in logs`

**Actions**:
1. Check logs: `kubectl logs <pod-name> -n metabob --tail=200`
2. Look for errors in logs
3. Verify `--print-logs` flag in deployment args
4. Check port configuration (should be 8080)

**Common Causes**:
- Port mismatch (3000 vs 8080)
- Missing `--print-logs` flag
- Configuration file issues
- SurrealDB connection blocking

**Resolution**: Refer to `ENFORCEMENT_devbob-k8s-deployment-pattern.md` section "Root Cause Resolutions"

---

### Test 3 Fails: Health Endpoint Not Accessible

**Symptom**: `❌ FAIL health-endpoint HTTP 500 (expected 200)`

**Actions**:
1. Test manually: `kubectl exec <pod-name> -n metabob -- curl http://localhost:8080/health`
2. Check if port is open: `kubectl exec <pod-name> -n metabob -- netstat -tlnp | grep 8080`
3. Check logs for server errors

**Common Causes**:
- Server started but health endpoint not implemented
- Port mismatch (server on different port)
- Health check logic failing

---

### Test 4 Fails: Secrets Not Injected

**Symptom**: `❌ FAIL secrets-injected ANTHROPIC_API_KEY not set or empty`

**Actions**:
1. Verify secret exists: `kubectl get secret devbob-secrets -n metabob`
2. Check secret data: `kubectl get secret devbob-secrets -n metabob -o jsonpath='{.data}'`
3. Verify secretKeyRef in deployment: `kubectl get deployment devbob -n metabob -o yaml | grep -A 5 secretKeyRef`

**Common Causes**:
- Secret not created
- Secret name mismatch
- Key name mismatch in secretKeyRef
- Deployment not updated after secret creation

---

### Test 5 Fails: Backend Services Not Accessible

**Symptom**: `❌ FAIL backend-services Some backend services not accessible`

**Actions**:
1. Check if services exist: `kubectl get svc -n metabob`
2. Test DNS resolution: `kubectl exec <pod-name> -n metabob -- nslookup redis-master.metabob.svc.cluster.local`
3. Check if backend pods are running: `kubectl get pods -n metabob`

**Common Causes**:
- Backend services not deployed
- Network policy blocking traffic
- Service names incorrect
- Namespace mismatch

---

### Test 6 Fails: Pod Configuration Non-Compliant

**Symptom**: `❌ FAIL pod-configuration Image tag not 'latest' (got: devbob:unified-test)`

**Actions**:
1. Check values.yaml: `cat helm/charts/devbob/values.yaml | grep -A 3 image`
2. Update Helm values if needed
3. Redeploy: `helm upgrade devbob helm/charts/devbob/ -n metabob`

**Common Causes**:
- Helm values not updated per enforcement
- Old deployment still running
- Wrong Helm values file used

---

### Test 7 Fails: Wrong Deployment Method

**Symptom**: `❌ FAIL deployment-method Using deprecated StatefulSet (should use Helm Deployment)`

**Actions**:
1. Check deployment type: `kubectl get deployment,statefulset -n metabob`
2. Migrate to Helm: Follow `DEPLOYMENT_GUIDE_devbob-k8s.md` migration section
3. Delete StatefulSet: `kubectl delete statefulset devbob -n metabob`
4. Deploy via Helm: `./deploy-devbob-helm.sh`

**Common Causes**:
- Using deprecated `deploy-devbob-k8s-git.sh` script
- StatefulSet not cleaned up after migration
- Manual deployment instead of Helm

---

## Test Cases Reference

All test cases are defined in `test-cases/devbob-k8s-deployment-pattern-cases.json`. Each test case includes:
- **id**: Unique identifier for the test case
- **name**: Human-readable test name
- **input**: Test parameters
- **expectedOutput**: Expected results
- **description**: What the test validates

## Related Documentation

- **Trace Analysis**: `TRACE_devbob-k8s-deployment-pattern.md`
- **Enforcement Summary**: `ENFORCEMENT_devbob-k8s-deployment-pattern.md`
- **Deployment Guide**: `DEPLOYMENT_GUIDE_devbob-k8s.md`
- **Helm Chart**: `helm/charts/devbob/`
- **Deployment Script**: `deploy-devbob-helm.sh`

## Maintenance

This validation harness should be updated when:
- Specification changes (e.g., different port, new requirements)
- New configuration requirements added
- Deployment method changes
- Backend services change

To update:
1. Modify `devbob-k8s-deployment-pattern-harness.sh`
2. Update `test-cases/devbob-k8s-deployment-pattern-cases.json`
3. Update this README
4. Update trace and enforcement documents if spec changed
5. Test the harness against a working deployment
6. Commit changes with clear message

---

**Last Updated**: 2026-03-01  
**Version**: 1.0  
**Maintainer**: DevBob Platform Team
