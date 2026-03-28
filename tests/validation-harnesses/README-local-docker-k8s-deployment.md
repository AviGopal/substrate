# Validation Harness: Local Docker Desktop Kubernetes Deployment

## Overview

This validation harness verifies that the metabob platform can be successfully deployed to a local docker-desktop kubernetes cluster with DRY (Don't Repeat Yourself) configuration that is reusable across multiple kubectx targets.

## Prerequisites

1. **Docker Desktop** installed and running with Kubernetes enabled
2. **kubectl** configured and pointing to docker-desktop context
3. **helmfile** installed (v0.144.0 or later)
4. **Node.js** and **tsx** for running the TypeScript harness

## Test Cases

### Test Case 1: Kubernetes Context Validation
- **Validates**: Current kubectl context is docker-desktop
- **Purpose**: Ensures deployment targets the correct cluster
- **Failure Impact**: Could accidentally deploy to production

### Test Case 2: Helmfile Configuration Validation
- **Validates**: Helmfile structure and environment definitions
- **Purpose**: Verifies DRY principle - single helmfile works across environments
- **Checks**:
  - helmfile.yaml.gotmpl exists
  - Environments defined: local, prod, integration, research, ops
  - Local environment targets docker-desktop

### Test Case 3: DRY Principles Validation
- **Validates**: Configuration cascading and reusability
- **Purpose**: Ensures no duplication across environment configs
- **Checks**:
  - common.values.yaml provides baseline
  - local.values.yaml contains only overrides
  - No duplication of configuration

### Test Case 4: Redis Resource Allocation Validation
- **Validates**: Redis memory and storage configuration
- **Purpose**: Ensures docker-desktop resource compatibility
- **Expected**:
  - Memory: 512Mi (not 6Gi)
  - Storage: 8Gi (not 32Gi)

### Test Case 5: Deployment Execution Validation
- **Validates**: helmfile -e local sync succeeds
- **Purpose**: Tests actual deployment to docker-desktop
- **Checks**:
  - No errors during deployment
  - All releases processed in dependency order

### Test Case 6: Pod Status Validation
- **Validates**: All pods reach Running status
- **Purpose**: Ensures deployment is healthy
- **Expected**: At least 4 pods running (config, redis, rpc-api, dashboard)

### Test Case 7: Service Exposure Validation
- **Validates**: Services are created and exposed
- **Purpose**: Ensures services are accessible
- **Expected**: At least 4 services, with at least 1 NodePort service

## Usage

### Quick Validation (Skip Deployment)

To validate configuration without deploying:

```bash
cd /home/avi/documents/work/exp-repo/metabob-devbob
SKIP_DEPLOYMENT=true npx tsx tests/validation-harnesses/local-docker-k8s-deployment-harness.ts
```

This runs tests 1-4 only (context, helmfile, DRY principles, redis resources).

### Full Validation (With Deployment)

To run all tests including actual deployment:

```bash
cd /home/avi/documents/work/exp-repo/metabob-devbob
npx tsx tests/validation-harnesses/local-docker-k8s-deployment-harness.ts
```

This runs all 7 tests, including deploying to docker-desktop (takes 2-5 minutes).

### Prerequisites Check

Before running the full validation:

1. Ensure docker-desktop is running:
   ```bash
   docker info
   ```

2. Check kubernetes is enabled:
   ```bash
   kubectl cluster-info
   ```

3. Switch to docker-desktop context:
   ```bash
   kubectl config use-context docker-desktop
   ```

4. Verify helmfile is installed:
   ```bash
   helmfile --version
   ```

## Expected Output

### Success Output

```
================================================================================
Validation Harness: Local Docker Desktop Kubernetes Deployment
================================================================================

Running test: Kubernetes Context...
  ✅ PASSED

Running test: Helmfile Configuration...
  ✅ PASSED

Running test: DRY Principles...
  ✅ PASSED

Running test: Redis Resources...
  ✅ PASSED

Running test: Deploy to Local...
  ✅ PASSED

Running test: Pods Running...
  ✅ PASSED

Running test: Services Exposed...
  ✅ PASSED

================================================================================
Overall Result: ✅ PASSED
Tests Passed: 7/7
================================================================================
```

### Failure Output

If any test fails, you'll see:

```
Running test: Redis Resources...
  ❌ FAILED
     Error: Redis memory should be 512Mi for docker-desktop, got 6Gi
```

## Troubleshooting

### Context Not Set

**Error**: "Expected kubectl context to be 'docker-desktop', but got 'minikube'"

**Fix**:
```bash
kubectl config use-context docker-desktop
```

### Helmfile Not Found

**Error**: "command not found: helmfile"

**Fix**:
```bash
# macOS
brew install helmfile

# Linux
wget https://github.com/helmfile/helmfile/releases/download/v0.144.0/helmfile_0.144.0_linux_amd64.tar.gz
tar -xzf helmfile_0.144.0_linux_amd64.tar.gz
sudo mv helmfile /usr/local/bin/
```

### Pods Not Running

**Error**: "Pod redis-master-0 is in Pending state"

**Possible Causes**:
1. Insufficient resources - check docker-desktop memory allocation
2. Image pull issues - check image registry accessibility
3. Resource requests too high - verify redis memory is 512Mi

**Debug**:
```bash
kubectl describe pod -n metabob <pod-name>
kubectl logs -n metabob <pod-name>
```

### Redis Memory Too High

**Error**: "Redis memory should be 512Mi for docker-desktop, got 6Gi"

**Fix**: This indicates the enforcement task wasn't applied. The redis memory should have been reduced to 512Mi in:
`repos/platform/deployments/metabob/charts/redis/values/local.redis.values.yaml`

## Integration with CI/CD

This harness can be integrated into CI/CD pipelines:

```yaml
# .github/workflows/validate-deployment.yml
name: Validate Local Deployment

on: [push, pull_request]

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Setup Docker Desktop
        uses: docker-practice/actions-setup-docker@master
      - name: Install Dependencies
        run: |
          npm install -g tsx
          brew install helmfile
      - name: Run Validation (Config Only)
        run: SKIP_DEPLOYMENT=true npx tsx tests/validation-harnesses/local-docker-k8s-deployment-harness.ts
```

## Test Case Impulses

All test cases are stored as impulses for historical reference:

- `validation-Local-Docker-Desktop-Kubernetes-Deployment-case-1` (Kubernetes Context)
- `validation-Local-Docker-Desktop-Kubernetes-Deployment-case-2` (Helmfile Config)
- `validation-Local-Docker-Desktop-Kubernetes-Deployment-case-3` (DRY Principles)
- `validation-Local-Docker-Desktop-Kubernetes-Deployment-case-4` (Redis Resources)
- `validation-Local-Docker-Desktop-Kubernetes-Deployment-case-5` (Deployment Execution)
- `validation-Local-Docker-Desktop-Kubernetes-Deployment-case-6` (Pod Status)
- `validation-Local-Docker-Desktop-Kubernetes-Deployment-case-7` (Service Exposure)

These impulses contain expected inputs and outputs and can be run without LLM assistance.

## Next Steps

After successful validation:

1. Test actual service endpoints:
   ```bash
   kubectl get svc -n metabob
   # Access NodePort services at http://localhost:<nodePort>
   ```

2. Run integration tests against deployed services

3. Extend to other environments (integration, prod) by changing `-e` flag:
   ```bash
   helmfile -e integration sync
   helmfile -e prod sync
   ```

## Related Documentation

- Trace Analysis: `impulses/trace-local-docker-k8s-deployment.json`
- Enforcement Summary: `impulses/enforcement-local-docker-k8s-deployment.json`
- Harness Definition: `impulses/harness-local-docker-k8s-deployment.json`
