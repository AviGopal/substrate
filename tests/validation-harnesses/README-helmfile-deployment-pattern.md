# Validation Harness: helmfile-deployment-pattern-with-versioned-builds

## Overview

This validation harness verifies GitOps compliance for Kubernetes deployments managed by Helmfile. It ensures:

- ✅ No configuration drift (helmfile state = cluster state)
- ✅ Images use proper version tags (not :latest in production)
- ✅ No kubectl bypass antipatterns
- ✅ No hardcoded credentials in Helm values
- ✅ Istio configuration present in production
- ✅ CI/CD → GitOps automation configured
- ✅ CI validation workflow blocks violations
- ✅ Kubernetes Secrets used correctly
- ✅ Reproducible deployments (idempotent)

## Quick Start

### Prerequisites

```bash
# Required tools
kubectl version --client
helm version
helmfile --version
jq --version

# Optional: for cluster access
export KUBECONFIG=~/.kube/config
```

### Run Validation (Non-Destructive)

```bash
# Local environment
./tests/validation-harnesses/helmfile-deployment-pattern-harness.sh

# Production environment
ENVIRONMENT=production ./tests/validation-harnesses/helmfile-deployment-pattern-harness.sh

# Custom namespace
NAMESPACE=my-namespace ./tests/validation-harnesses/helmfile-deployment-pattern-harness.sh
```

### Run Full Validation (Includes Destructive Tests)

```bash
# This will re-sync helmfile to test idempotency
SKIP_DESTRUCTIVE=false ./tests/validation-harnesses/helmfile-deployment-pattern-harness.sh
```

## Test Cases

### Test 1: No Configuration Drift
- **Purpose:** Verify helmfile diff shows no changes
- **Command:** `helmfile -e {environment} diff`
- **Pass Criteria:** Exit code 0, no "has changed" messages
- **Failure:** Configuration drift detected - run `helmfile sync`

### Test 2: No :latest Tags in Production
- **Purpose:** Enforce explicit version tags in production
- **Command:** `kubectl get pods -n metabob -o json`
- **Pass Criteria:** All images have version tags (main-abc1234, 1.0.64)
- **Failure:** Found :latest tags in production

### Test 3: All Resources Managed by Helm
- **Purpose:** Detect kubectl bypass antipatterns
- **Command:** `kubectl get all -n metabob -o json`
- **Pass Criteria:** All resources have `app.kubernetes.io/managed-by=Helm` label
- **Failure:** Found unmanaged resources (deployed via kubectl apply)

### Test 4: No Hardcoded Credentials
- **Purpose:** Detect CWE-798 security violations
- **Files:** `helm/charts/*/values.yaml`, `helm/environments/*.values.yaml`
- **Pass Criteria:** No plaintext passwords or API keys
- **Failure:** Found hardcoded credentials in values files

### Test 5: Istio Configuration (Production)
- **Purpose:** Verify production readiness
- **File:** `helm/environments/production.values.yaml`
- **Pass Criteria:** Contains `istio:`, `enabled:`, `mtls:` keys
- **Failure:** Istio configuration missing in production

### Test 6: Stable Istio Subset Names
- **Purpose:** Detect canary deployment antipatterns
- **File:** `helm/charts/devbob/templates/destinationrule.yaml`
- **Pass Criteria:** Uses stable names (`stable`, `canary`) not version-based
- **Failure:** Version-based subset naming detected

### Test 7: CI/CD GitOps Automation
- **Purpose:** Verify automated Helm values updates
- **File:** `.github/workflows/build-devbob.yml`
- **Pass Criteria:** Contains `update-helm-values` job with `yq` and `git commit`
- **Failure:** CI/CD automation missing

### Test 8: CI Validation Workflow
- **Purpose:** Verify PR validation blocks violations
- **File:** `.github/workflows/validate-helmfile-gitops.yml`
- **Pass Criteria:** Checks for kubectl, credentials, Istio antipatterns
- **Failure:** Validation workflow incomplete

### Test 9: Kubernetes Secrets Usage
- **Purpose:** Verify secure credential management
- **Command:** `kubectl get deployment -n metabob -o yaml`
- **Pass Criteria:** Uses `valueFrom.secretKeyRef`, no plaintext values
- **Failure:** Plaintext credentials in deployment

### Test 10: Reproducible Deployment
- **Purpose:** Verify idempotent deployments
- **Commands:** `helmfile sync` twice, then `helmfile diff`
- **Pass Criteria:** No changes after second sync
- **Failure:** Deployment is not idempotent (WARNING: Destructive test)

## Exit Codes

- **0**: All tests passed ✅
- **1**: One or more tests failed ❌
- **2**: All tests skipped (prerequisites missing) ⚠️

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `ENVIRONMENT` | `local` | Environment to test (local, production) |
| `NAMESPACE` | `metabob` | Kubernetes namespace |
| `HELMFILE` | `./helmfile.yaml` | Path to helmfile |
| `SKIP_DESTRUCTIVE` | `true` | Skip test 10 (reproducible deployment) |

## Example Usage

### Development Workflow

```bash
# 1. Make changes to Helm charts
vim helm/charts/devbob/values.yaml

# 2. Run validation (non-destructive)
./tests/validation-harnesses/helmfile-deployment-pattern-harness.sh

# 3. If validation passes, commit
git add helm/
git commit -m "chore: update Helm values"
```

### CI/CD Integration

```yaml
# .github/workflows/test.yml
- name: Validate GitOps Compliance
  run: |
    ./tests/validation-harnesses/helmfile-deployment-pattern-harness.sh
```

### Production Deployment Check

```bash
# Before deploying to production
ENVIRONMENT=production \
NAMESPACE=metabob \
./tests/validation-harnesses/helmfile-deployment-pattern-harness.sh

# If validation passes, deploy
helmfile -e production sync
```

## Troubleshooting

### "Helmfile not installed"
```bash
# Install helmfile
wget -O helmfile https://github.com/helmfile/helmfile/releases/latest/download/helmfile_linux_amd64
chmod +x helmfile
sudo mv helmfile /usr/local/bin/
```

### "Cannot access namespace"
```bash
# Check cluster connection
kubectl cluster-info
kubectl get namespaces

# Create namespace if missing
kubectl create namespace metabob
```

### "Secret 'devbob-secrets' not found"
```bash
# Create required secret
kubectl create secret generic devbob-secrets \
  --namespace=metabob \
  --from-literal=anthropic-api-key=sk-ant-xxx \
  --from-literal=github-token=ghp_xxx \
  --from-literal=surreal-user=root \
  --from-literal=surreal-pass=YOUR_SECURE_PASSWORD \
  --from-literal=git-user-name="Devbob Agent" \
  --from-literal=git-user-email="devbob@metabob.local"
```

### "Configuration drift detected"
```bash
# Reconcile drift
helmfile -e local sync

# Verify no drift
helmfile -e local diff
```

## Expected Output

### ✅ Successful Validation

```
==============================================
Validation Harness: helmfile-deployment-pattern-with-versioned-builds
==============================================
Environment: local
Namespace: metabob
Skip Destructive: true

ℹ Test 1: Checking for configuration drift...
✓ PASS: No configuration drift detected

ℹ Test 2: Validating image version tags...
✓ PASS: All images use explicit version tags

ℹ Test 3: Checking for unmanaged resources (kubectl bypass)...
✓ PASS: All resources managed by Helm

ℹ Test 4: Checking for hardcoded credentials in Helm values...
✓ PASS: No hardcoded credentials found in Helm values

ℹ Test 5: Validating Istio configuration...
⊘ SKIP: Istio check (production only)
  Reason: Current environment: local

ℹ Test 6: Validating CI/CD → GitOps automation...
✓ PASS: CI/CD → GitOps automation configured

ℹ Test 7: Checking CI validation workflow...
✓ PASS: CI validation workflow configured

ℹ Test 8: Testing reproducible deployment...
⊘ SKIP: Destructive test skipped
  Reason: Set SKIP_DESTRUCTIVE=false to enable

ℹ Test 9: Validating Kubernetes Secrets usage...
✓ PASS: Deployment correctly references Kubernetes Secrets

==============================================
Validation Summary
==============================================
Passed: 7
Failed: 0
Skipped: 2

✅ VALIDATION PASSED
GitOps compliance verified successfully.
```

### ❌ Failed Validation

```
ℹ Test 4: Checking for hardcoded credentials in Helm values...
  Found hardcoded 'root' password in: helm/charts/devbob/values.yaml
✗ FAIL: Found 1 hardcoded credentials
  Reason: Use Kubernetes Secrets with secretKeyRef

==============================================
Validation Summary
==============================================
Passed: 6
Failed: 1
Skipped: 2

❌ VALIDATION FAILED
GitOps compliance issues detected. Review failures above.
```

## Related Files

- **Harness Script:** `tests/validation-harnesses/helmfile-deployment-pattern-harness.sh`
- **Test Cases:** `tests/validation-harnesses/helmfile-deployment-pattern-test-cases.json`
- **Trace Analysis:** `TRACE_OUTPUT_helmfile-deployment-pattern.json`
- **Enforcement Summary:** `ENFORCEMENT_SUMMARY_helmfile-deployment-pattern.md`

## References

- **Specification:** helmfile-deployment-pattern-with-versioned-builds
- **Activity:** trace-enforce-validate-loop
- **Created:** 2026-02-27
- **GitOps Compliance Target:** 90%+
