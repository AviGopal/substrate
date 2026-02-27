# Helmfile Deployment Pattern Validation Harness

## Overview

This validation harness ensures the **Helmfile-driven Kubernetes Deployment Pattern** specification is fully implemented and compliant. It validates that all Kubernetes deployments in the metabob namespace are managed exclusively through helmfile, with no direct kubectl modifications.

## Specification

All Kubernetes deployments in the metabob namespace must be:
1. Managed exclusively through `helmfile sync` operations
2. Never modified via direct `kubectl` commands (antipattern)
3. Reference images built from source code
4. Support both local (docker-desktop) and production (with Istio) environments

## Validation Strategy

The harness performs 7 comprehensive validations:

### 1. kubectl Availability Check
- **Purpose**: Verify kubectl is installed and context is configured
- **Method**: Execute `kubectl config current-context`
- **Expected**: Command succeeds and returns a valid context name

### 2. Multi-Environment Support
- **Purpose**: Verify helmfile.yaml defines both local and production environments
- **Method**: Parse `helm/helmfile.yaml` for environment definitions
- **Expected**: Both `local` and `production` environments present

### 3. Istio Templates Exist
- **Purpose**: Verify all required Istio templates for production deployment exist
- **Method**: Check filesystem for required files
- **Expected Files**:
  - `helm/charts/devbob/templates/virtualservice.yaml`
  - `helm/charts/devbob/templates/destinationrule.yaml`
  - `helm/charts/metabob-rpc-api/templates/virtualservice.yaml`
  - `helm/environments/production.values.yaml`

### 4. Helmfile Template Rendering (Local)
- **Purpose**: Verify helmfile can render manifests for local environment
- **Method**: Execute `helmfile -e local template`
- **Expected**: 
  - Command succeeds without errors
  - Output contains Deployments/StatefulSets
  - Output contains Services

### 5. Helmfile Template Rendering (Production)
- **Purpose**: Verify helmfile can render manifests for production with Istio resources
- **Method**: Execute `helmfile -e production template`
- **Expected**:
  - Command succeeds without errors
  - Output contains Deployments/StatefulSets
  - Output contains VirtualServices (Istio)
  - Output contains DestinationRules (Istio)

### 6. No kubectl Antipatterns
- **Purpose**: Verify all deployments are managed by Helm (not manually created)
- **Method**: Compare all resources vs Helm-managed resources
- **Expected**: All deployments/statefulsets have `app.kubernetes.io/managed-by=Helm` label

### 7. Configuration Drift Check
- **Purpose**: Verify running deployment versions match configured values
- **Method**: Compare image versions in `local.values.yaml` vs running deployments
- **Expected**: No version drift (e.g., metabob-rpc-api should be 0.12.6)

## Usage

### Basic Usage
```bash
# Run from project root
./tests/validation-harnesses/helmfile-deployment-pattern-harness.sh

# Run with custom base directory
./tests/validation-harnesses/helmfile-deployment-pattern-harness.sh /path/to/project

# Run with custom namespace
./tests/validation-harnesses/helmfile-deployment-pattern-harness.sh . staging
```

### Parameters
- **BASE_DIR** (optional): Base directory of the project (default: current directory)
- **NAMESPACE** (optional): Kubernetes namespace to validate (default: `metabob`)

### Prerequisites
- `kubectl` installed and configured with a valid context
- `helmfile` installed (optional, but recommended for template validation)
- Access to a Kubernetes cluster (for cluster-based validations)

### Exit Codes
- **0**: All validations passed
- **1**: One or more validations failed

## Output Format

The harness provides color-coded output:
- ✅ Green: Test passed
- ❌ Red: Test failed
- ⚠️  Yellow: Warning (test skipped due to missing dependencies)
- ℹ️  Blue: Information

Example output:
```
🔍 Running Helmfile Deployment Pattern Validation

Base directory: /home/user/metabob-devbob
Namespace: metabob

📊 Running Tests...

ℹ Test 1: Validating kubectl availability and context...
✅ kubectl available, context: docker-desktop

ℹ Test 2: Validating multi-environment support...
✅ Both local and production environments configured in helmfile.yaml

ℹ Test 3: Validating Istio template files...
✅ All Istio templates present (4 files)

...

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📈 Summary:
   Total Tests: 7
   Passed: 7
   Failed: 0

   Overall: ✅ PASS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

## Test Cases

Test cases are documented in `helmfile-deployment-pattern-test-cases.json` with historical inputs and expected outputs. These can be run without LLM intervention.

### Test Case Structure
```json
{
  "impulseId": "validation-helmfile-deployment-pattern-case-N",
  "name": "test-name",
  "description": "What this test validates",
  "input": { "command": "...", "params": "..." },
  "expectedOutput": { "result": "..." },
  "validation": "How to verify the test passed"
}
```

## Integration with CI/CD

This harness can be integrated into CI/CD pipelines:

```yaml
# Example: GitHub Actions
- name: Validate Helmfile Deployment Pattern
  run: |
    ./tests/validation-harnesses/helmfile-deployment-pattern-harness.sh
  env:
    KUBECONFIG: ${{ secrets.KUBECONFIG }}
```

## Troubleshooting

### Test 1 Fails: kubectl not available
- **Solution**: Install kubectl or set PATH correctly
- **Alternative**: Set a valid kubeconfig file

### Test 2 Fails: Missing production environment
- **Solution**: Verify `helm/helmfile.yaml` has `production:` section
- **Check**: Enforcement step may not have completed

### Test 3 Fails: Missing Istio templates
- **Solution**: Run enforcement step to create missing files
- **Check**: Verify `helm/charts/*/templates/virtualservice.yaml` exist

### Test 4/5 Fails: helmfile template errors
- **Solution**: Check helmfile syntax and values files
- **Check**: Verify all referenced values files exist
- **Alternative**: Install helmfile if not available

### Test 6 Fails: Unmanaged resources
- **Solution**: Delete manually-created resources
- **Command**: `kubectl delete <resource> -n metabob`
- **Re-deploy**: Use `helmfile sync` to recreate via Helm

### Test 7 Fails: Configuration drift
- **Solution**: Run `helmfile sync` to align cluster with configuration
- **Alternative**: Update values files to match running versions

## Files

- **helmfile-deployment-pattern-harness.sh**: Main validation script
- **helmfile-deployment-pattern-test-cases.json**: Test case definitions
- **README-helmfile-deployment-pattern.md**: This documentation

## Related Specifications

- **Trace**: `TRACE_HELMFILE_DEPLOYMENT_PATTERN.json`
- **Enforcement**: `ENFORCEMENT_HELMFILE_DEPLOYMENT_PATTERN.json`
- **Documentation**: `docs/guides/HELMFILE_DEPLOYMENT_GUIDE.md`

## Maintenance

This harness should be run:
- ✅ After any changes to `helm/helmfile.yaml`
- ✅ After creating/modifying Helm charts
- ✅ Before deploying to production
- ✅ As part of CI/CD pipeline
- ✅ When validating specification compliance

## Version History

- **v1.0** (2026-02-27): Initial version with 7 validation tests
