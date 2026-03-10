# Validation Harness: acp-kubernetes-service-discovery

**Date**: 2026-03-09  
**Specification**: acp-kubernetes-service-discovery  
**Harness File**: `tests/validation-harnesses/acp-kubernetes-service-discovery-harness.ts`

## Overview

This validation harness tests all 7 validation criteria for the acp-kubernetes-service-discovery specification without requiring LLM interaction. It validates that ACP delegation works via Kubernetes service DNS (`devbob.metabob.svc.cluster.local:8080`) without port-forward dependency.

## Validation Criteria

1. ✅ K8s service DNS resolution works for `devbob.metabob.svc.cluster.local`
2. ✅ tcp:// transport connects via service name (not localhost)
3. ✅ Simple prompt execution succeeds
4. ✅ Impulse sharing works bidirectionally
5. ✅ Activity execution in DevBob via delegation
6. ✅ Results return to calling session
7. ✅ No dependency on kubectl port-forward

## Test Cases

### Test Case 1: DNS Resolution
**Impulse**: `validation-acp-kubernetes-service-discovery-case-1`

**Input**:
```json
{
  "target": "tcp://devbob.metabob.svc.cluster.local:8080",
  "testType": "dns-resolution"
}
```

**Expected Output**:
```json
{
  "resolvable": true,
  "usesServiceDNS": true,
  "notLocalhost": true
}
```

**Validation Method**:
- Run `nslookup devbob.metabob.svc.cluster.local` from test pod
- Verify target format contains service DNS
- Confirm no localhost reference

**Success Criteria**:
- DNS resolves to valid ClusterIP
- Target uses service DNS format
- No localhost/127.0.0.1 in target

---

### Test Case 2: Simple Prompt Execution
**Impulse**: `validation-acp-kubernetes-service-discovery-case-2`

**Input**:
```json
{
  "target": "tcp://devbob.metabob.svc.cluster.local:8080",
  "taskDescription": "Echo test",
  "prompt": "Echo the exact text: k8s-dns-validation-test-12345",
  "timeout": 30
}
```

**Expected Output**:
```json
{
  "success": true,
  "responseContains": "k8s-dns-validation-test-12345",
  "usedServiceDNS": true
}
```

**Validation Method**:
- Send simple echo prompt via acp_delegate
- Verify response contains expected text
- Confirm connection used service DNS

**Success Criteria**:
- Delegation succeeds
- Response contains echoed text
- Connection via k8s service (not localhost)

---

### Test Case 3: Impulse Sharing
**Impulse**: `validation-acp-kubernetes-service-discovery-case-3`

**Input**:
```json
{
  "target": "tcp://devbob.metabob.svc.cluster.local:8080",
  "taskDescription": "Impulse test",
  "prompt": "Read and echo the content from the shared impulse 'test-impulse-data'",
  "impulseData": {
    "id": "test-impulse-data",
    "content": "IMPULSE_TEST_DATA_ABC123"
  },
  "shareImpulses": ["test-impulse-data"],
  "timeout": 30
}
```

**Expected Output**:
```json
{
  "success": true,
  "responseContains": "IMPULSE_TEST_DATA_ABC123",
  "impulseShared": true
}
```

**Validation Method**:
- Create impulse with test data
- Share impulse via acp_delegate
- Verify response contains impulse content

**Success Criteria**:
- Impulse serialization succeeds
- DevBob receives impulse
- Response contains impulse data

---

### Test Case 4: Bidirectional Result Return
**Impulse**: `validation-acp-kubernetes-service-discovery-case-4`

**Input**:
```json
{
  "target": "tcp://devbob.metabob.svc.cluster.local:8080",
  "taskDescription": "Result return test",
  "prompt": "Return a JSON object: {test: 'bidirectional-result', timestamp: <current-timestamp>}",
  "timeout": 30
}
```

**Expected Output**:
```json
{
  "success": true,
  "responseIsJSON": true,
  "responseContainsKey": "test",
  "responseValue": "bidirectional-result"
}
```

**Validation Method**:
- Request structured JSON response
- Parse returned result
- Verify bidirectional communication

**Success Criteria**:
- JSON response received
- Response contains expected key/value
- Results returned to calling session

---

### Test Case 5: Activity Execution
**Impulse**: `validation-acp-kubernetes-service-discovery-case-5`

**Input**:
```json
{
  "target": "tcp://devbob.metabob.svc.cluster.local:8080",
  "taskDescription": "Activity execution",
  "prompt": "List available activity templates and return the count",
  "timeout": 60
}
```

**Expected Output**:
```json
{
  "success": true,
  "responseContainsNumber": true,
  "activitySystemAccessible": true
}
```

**Validation Method**:
- Execute activity-related command in DevBob
- Verify activity system is accessible
- Confirm results returned

**Success Criteria**:
- Activity system accessible via delegation
- Command executes successfully
- Numeric result returned

---

### Test Case 6: No Port-Forward Dependency
**Impulse**: `validation-acp-kubernetes-service-discovery-case-6`

**Input**:
```json
{
  "target": "tcp://devbob.metabob.svc.cluster.local:8080",
  "testType": "port-forward-independence"
}
```

**Expected Output**:
```json
{
  "noPortForwardRequired": true,
  "usesDirectServiceAccess": true
}
```

**Validation Method**:
- Check for running `kubectl port-forward` processes
- Verify direct service access
- Confirm no localhost dependency

**Success Criteria**:
- No port-forward process detected
- Connection uses service DNS directly
- Works without manual port-forward setup

---

### Test Case 7: Connection via Service Name
**Impulse**: `validation-acp-kubernetes-service-discovery-case-7`

**Input**:
```json
{
  "target": "tcp://devbob.metabob.svc.cluster.local:8080",
  "testType": "connection-method-verification"
}
```

**Expected Output**:
```json
{
  "usesServiceDNS": true,
  "notLocalhost": true,
  "targetFormat": "tcp://devbob.metabob.svc.cluster.local:8080"
}
```

**Validation Method**:
- Verify target format
- Confirm service DNS usage
- Validate no localhost reference

**Success Criteria**:
- Target uses correct format
- Service DNS in target string
- No localhost/IP address used

## Execution

### Prerequisites

1. **Kubernetes Cluster Access**:
   ```bash
   kubectl cluster-info
   ```

2. **DevBob Deployed**:
   ```bash
   kubectl get pods -n metabob -l app=devbob
   ```

3. **Service Accessible**:
   ```bash
   kubectl get svc -n metabob devbob
   ```

### Running the Harness

#### Method 1: Direct Execution

```bash
cd /home/avi/documents/work/exp-repo/metabob-devbob
bun run tests/validation-harnesses/acp-kubernetes-service-discovery-harness.ts
```

#### Method 2: Import and Run Programmatically

```typescript
import { runValidation } from "./tests/validation-harnesses/acp-kubernetes-service-discovery-harness"

const results = await runValidation()

console.log(`Overall: ${results.overallPass ? "PASS" : "FAIL"}`)
console.log(`Passed: ${results.passed}/${results.totalTests}`)
```

#### Method 3: From Within Cluster

Deploy test pod:

```bash
kubectl run -it --rm validation-test \
  --image=node:20-alpine \
  --restart=Never \
  --namespace=metabob \
  -- sh -c "npm install -g bun && bun run /harness/acp-kubernetes-service-discovery-harness.ts"
```

### Output

The harness generates a JSON result file:

**File**: `validation-results-acp-k8s-service-discovery.json`

**Format**:
```json
{
  "overallPass": true,
  "totalTests": 7,
  "passed": 7,
  "failed": 0,
  "results": [
    {
      "pass": true,
      "testCase": "DNS Resolution Test",
      "actual": {...},
      "expected": {...},
      "duration": 1234
    },
    ...
  ],
  "timestamp": "2026-03-09T23:22:00.000Z",
  "environment": {
    "k8sAccessible": true,
    "serviceResolvable": true,
    "portForwardDetected": false
  }
}
```

### Exit Codes

- `0`: All tests passed
- `1`: One or more tests failed

## Environment Checks

The harness performs automatic environment validation:

1. **Kubernetes Access**: Verifies `kubectl cluster-info` succeeds
2. **Service DNS Resolution**: Tests DNS resolution from within cluster
3. **Port-Forward Detection**: Checks for running port-forward processes

These checks are reported before running test cases:

```
Environment Checks:
  - Kubernetes Access: ✅
  - Service DNS Resolution: ✅
  - Port-Forward Detected: ✅ NO
```

## Troubleshooting

### DNS Resolution Fails

**Symptom**: `serviceResolvable: false`

**Cause**: Not running from within cluster network

**Solution**:
```bash
# Test from within cluster
kubectl run -it --rm dns-test --image=busybox --restart=Never -- \
  nslookup devbob.metabob.svc.cluster.local
```

### Service Not Accessible

**Symptom**: Connection refused errors

**Cause**: DevBob pod not ready or wrong port

**Solution**:
```bash
# Check pod status
kubectl get pods -n metabob -l app=devbob

# Check service endpoints
kubectl get endpoints -n metabob devbob

# Test from debug pod
kubectl run -it --rm debug --image=nicolaka/netshoot --restart=Never -- \
  curl http://devbob.metabob.svc.cluster.local:8080/health
```

### Port-Forward Detected

**Symptom**: `portForwardDetected: true`

**Cause**: Manual port-forward still running

**Solution**:
```bash
# Kill port-forward processes
pkill -f "kubectl port-forward"

# Verify none running
ps aux | grep "kubectl port-forward"
```

## Artifacts

### Impulses Created

1. `impulses/validation-acp-kubernetes-service-discovery-case-1.json` - DNS Resolution Test
2. `impulses/validation-acp-kubernetes-service-discovery-case-2.json` - Prompt Execution Test
3. `impulses/validation-acp-kubernetes-service-discovery-case-3.json` - Impulse Sharing Test
4. `impulses/validation-acp-kubernetes-service-discovery-case-4.json` - Bidirectional Results Test
5. `impulses/validation-acp-kubernetes-service-discovery-case-5.json` - Activity Execution Test
6. `impulses/validation-acp-kubernetes-service-discovery-case-6.json` - Port-Forward Independence Test
7. `impulses/validation-acp-kubernetes-service-discovery-case-7.json` - Connection Method Test
8. `impulses/harness-acp-kubernetes-service-discovery.json` - Harness Metadata

### Files Created

1. `tests/validation-harnesses/acp-kubernetes-service-discovery-harness.ts` - Main harness
2. `VALIDATION_HARNESS_acp-kubernetes-service-discovery.md` - This documentation
3. `validation-results-acp-k8s-service-discovery.json` - Output file (generated on run)

## Integration with CI/CD

### GitHub Actions Example

```yaml
name: ACP K8s Service Discovery Validation

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Kubernetes
        uses: helm/kind-action@v1.5.0
      
      - name: Deploy DevBob
        run: |
          helm install devbob ./helm/charts/devbob
          kubectl wait --for=condition=ready pod -l app=devbob -n metabob --timeout=300s
      
      - name: Run Validation Harness
        run: |
          bun run tests/validation-harnesses/acp-kubernetes-service-discovery-harness.ts
      
      - name: Upload Results
        uses: actions/upload-artifact@v3
        with:
          name: validation-results
          path: validation-results-acp-k8s-service-discovery.json
```

## Success Metrics

For the harness to pass:

- ✅ All 7 test cases must pass
- ✅ Kubernetes cluster must be accessible
- ✅ DevBob service must be resolvable
- ✅ No port-forward process should be detected
- ✅ Connection must use service DNS
- ✅ Results must return within timeout

## Historical Results

Test cases are stored as impulses with fixed input/output pairs, allowing historical validation without LLM interaction. This enables:

- Regression testing
- Performance baseline comparison
- CI/CD integration
- Automated validation on deployment

## References

- **Specification Trace**: `TRACE_acp-kubernetes-service-discovery.md`
- **Enforcement Summary**: `ENFORCEMENT_acp-kubernetes-service-discovery.md`
- **User Guide**: `docs/guides/ACP_KUBERNETES_SERVICE_DISCOVERY.md`
- **Trace Impulse**: `impulses/trace-acp-kubernetes-service-discovery.json`
- **Enforcement Impulse**: `impulses/enforcement-acp-kubernetes-service-discovery.json`

---

**Status**: ✅ Ready for Validation  
**Test Cases**: 7 (all implemented)  
**Impulses Created**: 8  
**Execution Method**: `bun run tests/validation-harnesses/acp-kubernetes-service-discovery-harness.ts`  
**Output**: `validation-results-acp-k8s-service-discovery.json`
