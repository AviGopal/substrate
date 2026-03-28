# Validation Harness: Fix-Redis-ImagePullBackOff-Invalid-Tag

## Overview

This validation harness verifies that the Redis ImagePullBackOff issue has been properly fixed. It performs comprehensive checks on the deployment configuration, pod status, connectivity, and persistence.

## Test Cases

### 1. Image Tag Override Exists
- **Input**: `repos/platform/deployments/metabob/charts/redis/values/local.redis.values.yaml`
- **Expected**: File contains `image.tag` override with valid tag (not `7.4.1-debian-12-r2` or `7.0.12-debian-11-r0`)
- **Validation**: Parse YAML and verify image.tag field exists

### 2. Pod Phase is Running
- **Input**: `kubectl get pod -n metabob redis-master-0 -o jsonpath='{.status.phase}'`
- **Expected**: `Running`
- **Validation**: Query Kubernetes API for pod phase

### 3. No ImagePullBackOff State
- **Input**: `kubectl get pod -n metabob redis-master-0 -o jsonpath='{.status.containerStatuses[0].state}'`
- **Expected**: Container state is `running`, not `waiting` with `ImagePullBackOff`
- **Validation**: Check container state does not contain ImagePullBackOff or ErrImagePull

### 4. Redis Connectivity
- **Input**: `kubectl exec -n metabob redis-master-0 -- redis-cli ping`
- **Expected**: `PONG`
- **Validation**: Execute redis-cli ping and verify response

### 5. PVC Bound and Persistence
- **Input**: `kubectl get pvc -n metabob redis-data-redis-master-0`
- **Expected**: Status `Bound`, Size `8Gi`
- **Validation**: Verify PVC status and size

### 6. Pod Using Valid Image
- **Input**: `kubectl get pod -n metabob redis-master-0 -o jsonpath='{.spec.containers[0].image}'`
- **Expected**: `bitnami/redis` with valid tag (not blacklisted)
- **Validation**: Verify image repository and tag

## Usage

### Shell Script (No Dependencies)

```bash
cd /path/to/metabob-devbob
./tests/validation-harnesses/Fix-Redis-ImagePullBackOff-Invalid-Tag-harness.sh
```

**Exit Codes:**
- `0`: All tests passed
- `1`: Some tests failed

### TypeScript Script (Requires Node/TypeScript)

```bash
cd /path/to/metabob-devbob
ts-node tests/validation-harnesses/Fix-Redis-ImagePullBackOff-Invalid-Tag-harness.ts
```

**Output Format:**
```json
{
  "overallPass": true,
  "results": [...],
  "timestamp": "2026-02-26T20:15:00Z",
  "summary": {
    "total": 6,
    "passed": 6,
    "failed": 0
  }
}
```

## Requirements

- Kubernetes cluster with `metabob` namespace
- `kubectl` configured with access to the cluster
- Redis deployed via Bitnami Helm chart
- For TypeScript version: Node.js, TypeScript, js-yaml package

## Expected Outcome

When the fix is correctly applied:

✅ All 6 tests should PASS:
1. ✅ Image tag override exists in values file
2. ✅ Pod phase is Running
3. ✅ No ImagePullBackOff state
4. ✅ Redis responds to PING with PONG
5. ✅ PVC is Bound with 8Gi
6. ✅ Pod uses valid bitnami/redis image

## Troubleshooting

### Test 1 Fails: Image Tag Override Missing
- Verify `local.redis.values.yaml` contains:
  ```yaml
  image:
    tag: latest
  ```

### Test 2/3 Fails: Pod Not Running
- Check pod events: `kubectl describe pod redis-master-0 -n metabob`
- Verify image is pullable: `docker pull bitnami/redis:latest`

### Test 4 Fails: Redis Not Responding
- Check logs: `kubectl logs redis-master-0 -n metabob`
- Verify no auth required (auth.enabled: false in values)

### Test 5 Fails: PVC Not Bound
- Check PVC events: `kubectl describe pvc redis-data-redis-master-0 -n metabob`
- Verify storage class is available

### Test 6 Fails: Invalid Image
- Delete pod to force recreation: `kubectl delete pod redis-master-0 -n metabob`
- Verify StatefulSet spec: `kubectl get statefulset redis-master -n metabob -o yaml | grep image:`

## Integration with CI/CD

Add to your CI/CD pipeline:

```yaml
# GitLab CI example
validate-redis-fix:
  stage: test
  script:
    - ./tests/validation-harnesses/Fix-Redis-ImagePullBackOff-Invalid-Tag-harness.sh
  only:
    - merge_requests
    - main
```

```yaml
# GitHub Actions example
- name: Validate Redis Fix
  run: ./tests/validation-harnesses/Fix-Redis-ImagePullBackOff-Invalid-Tag-harness.sh
```

## Historical Test Cases (Impulses)

The following impulses contain historical test case data:
- `validation-Fix-Redis-ImagePullBackOff-Invalid-Tag-case-1` - Image Tag Override
- `validation-Fix-Redis-ImagePullBackOff-Invalid-Tag-case-2` - Pod Phase
- `validation-Fix-Redis-ImagePullBackOff-Invalid-Tag-case-3` - Container State
- `validation-Fix-Redis-ImagePullBackOff-Invalid-Tag-case-4` - Connectivity
- `validation-Fix-Redis-ImagePullBackOff-Invalid-Tag-case-5` - Persistence
- `validation-Fix-Redis-ImagePullBackOff-Invalid-Tag-case-6` - Image Validity

## Harness Impulse

The harness file itself is tracked as impulse:
- ID: `harness-Fix-Redis-ImagePullBackOff-Invalid-Tag`
- Type: file
- Pointer: `tests/validation-harnesses/Fix-Redis-ImagePullBackOff-Invalid-Tag-harness.ts`
- Budget: 2000 tokens

This allows the validation to be run without LLM inference - it's pure deterministic verification.
