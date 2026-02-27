# Validation Harness: devbob-k8s-git-operations

## Overview

This validation harness tests that all devbob containers in the Kubernetes StatefulSet can perform complete autonomous git workflows including: git config, clone, commit, push, PR creation, and PR merge operations.

**Specification**: devbob-k8s-git-operations  
**Strategy**: kubectl-exec-commands  
**Language**: Bash  
**File**: `tests/validation-harnesses/devbob-k8s-git-operations-harness.sh`

## Test Cases

### Non-Destructive Tests (5)

These tests only read state and do not modify anything:

1. **git-config-present**: Verify git global configuration includes user.name, user.email, defaultBranch, and autoSetupRemote
2. **gh-cli-installed**: Verify GitHub CLI (gh) is installed and accessible in PATH
3. **git-credentials-present**: Verify git credentials (GIT_USER_NAME, GIT_USER_EMAIL, GITHUB_TOKEN) are present in environment
4. **gh-cli-authenticated**: Verify gh CLI is authenticated with GitHub token
5. **workspace-accessible**: Verify /workspace directory is accessible

### Destructive Tests (4)

These tests modify state (create files, push to remote, create PRs):

6. **git-clone-success**: Verify git clone works without authentication errors
7. **git-commit-success**: Verify git commit works with proper author attribution
8. **git-push-success**: Verify git push works without authentication errors
9. **gh-pr-create**: Verify gh pr create works

## Usage

### Basic Usage (All Pods, Non-Destructive Only)
```bash
./tests/validation-harnesses/devbob-k8s-git-operations-harness.sh --skip-destructive
```

### Test All Pods (Including Destructive Tests)
```bash
./tests/validation-harnesses/devbob-k8s-git-operations-harness.sh
```

### Test Single Pod
```bash
./tests/validation-harnesses/devbob-k8s-git-operations-harness.sh --pod devbob-0
```

### JSON Output
```bash
./tests/validation-harnesses/devbob-k8s-git-operations-harness.sh --json
```

### Custom Test Repo
```bash
./tests/validation-harnesses/devbob-k8s-git-operations-harness.sh --test-repo https://github.com/your-org/test-repo.git
```

### Custom Namespace
```bash
./tests/validation-harnesses/devbob-k8s-git-operations-harness.sh --namespace my-namespace
```

## Output Format

### Human-Readable Output
```
================================================================================
Validation Harness: devbob-k8s-git-operations
================================================================================
Namespace: metabob
Pods: devbob-0 devbob-1 devbob-2
Skip Destructive: false
================================================================================

[INFO] Validating pod: devbob-0
[TEST] devbob-0: Testing git config...
  ✓ git-config-present
[TEST] devbob-0: Testing gh CLI installation...
  ✓ gh-cli-installed
[TEST] devbob-0: Testing git credentials...
  ✓ git-credentials-present
[TEST] devbob-0: Testing gh CLI authentication...
  ✓ gh-cli-authenticated
[TEST] devbob-0: Testing workspace access...
  ✓ workspace-accessible
[TEST] devbob-0: Testing git clone...
  ✓ git-clone-success
[TEST] devbob-0: Testing git commit...
  ✓ git-commit-success
[TEST] devbob-0: Testing git push...
  ✓ git-push-success
[TEST] devbob-0: Testing PR creation...
  ✓ gh-pr-create

================================================================================
Validation Results
================================================================================
Total Tests: 27
Passed: 27 ✓
Failed: 0 ✗
===============================================================================
Overall: ✓ PASS
================================================================================
```

### JSON Output
```json
{
  "pass": true,
  "totalTests": 27,
  "passedTests": 27,
  "failedTests": 0,
  "timestamp": "2026-02-27T11:00:00+00:00",
  "results": [
    {
      "podName": "devbob-0",
      "testName": "git-config-present",
      "pass": true,
      "expected": "user.name and user.email configured",
      "actual": "user.name=Devbob Agent\nuser.email=devbob@metabob.local",
      "error": ""
    }
  ]
}
```

## Exit Codes

- `0`: All tests passed
- `1`: One or more tests failed

## Prerequisites

### Before Running Validation

1. **Devbob pods must be running**:
   ```bash
   kubectl get pods -n metabob -l app.kubernetes.io/name=devbob
   ```

2. **Secrets must be populated** (for non-destructive tests to pass):
   ```bash
   kubectl get secret devbob-secrets -n metabob -o jsonpath='{.data}' | jq 'keys'
   # Should show: ["anthropic-api-key", "git-user-email", "git-user-name", "github-token"]
   ```

3. **Test repository must exist** (for destructive tests):
   - Default: https://github.com/metabob-labs/test-repo.git
   - Must have write access via GITHUB_TOKEN
   - Can be overridden with `--test-repo`

### After Enforcement (Expected State)

After running the enforcement from `ENFORCEMENT_DEVBOB_K8S_GIT_OPERATIONS.md`:

- Container image rebuilt with gh CLI
- Secrets populated with GitHub token and git credentials
- Pods restarted with new environment variables
- Git configured at container startup

All **non-destructive tests should PASS**.  
**Destructive tests** require actual GitHub repository write access.

## Troubleshooting

### Non-Destructive Tests Failing

#### git-config-present fails
```bash
# Check if git config exists
kubectl exec -n metabob devbob-0 -- git config --global --list

# Expected to see:
# user.name=...
# user.email=...
# init.defaultBranch=main
# push.autoSetupRemote=true
```

**Fix**: Verify entrypoint-self-config.sh was updated with Step 3b (git configuration).

#### gh-cli-installed fails
```bash
# Check if gh is installed
kubectl exec -n metabob devbob-0 -- which gh
kubectl exec -n metabob devbob-0 -- gh --version
```

**Fix**: Rebuild container image from Dockerfile.devbob-local (includes gh CLI installation).

#### git-credentials-present fails
```bash
# Check environment variables
kubectl exec -n metabob devbob-0 -- env | grep -E '(GIT|GITHUB)'
```

**Fix**: Update devbob-secrets and rollout restart StatefulSet.

#### gh-cli-authenticated fails
```bash
# Check gh auth status
kubectl exec -n metabob devbob-0 -- gh auth status
```

**Fix**: Ensure GITHUB_TOKEN is valid and has correct scopes (repo, workflow, write:packages).

### Destructive Tests Failing

#### git-clone-success fails
- Check GITHUB_TOKEN has read access to test repository
- Verify test repository URL is correct and accessible

#### git-push-success fails
- Check GITHUB_TOKEN has write access to test repository
- Verify repository allows force pushes (if using -f flag)

#### gh-pr-create fails
- Check GITHUB_TOKEN has workflow scope
- Verify repository allows PR creation from test branches
- Check if PR already exists (tool considers this a pass)

## Integration with CI/CD

### In GitHub Actions
```yaml
- name: Validate devbob git operations
  run: |
    ./tests/validation-harnesses/devbob-k8s-git-operations-harness.sh --skip-destructive --json > validation-results.json
    if [ $? -ne 0 ]; then
      echo "Validation failed"
      cat validation-results.json
      exit 1
    fi
```

### In Pre-Deployment Script
```bash
#!/bin/bash
set -e

echo "Running devbob git operations validation..."
./tests/validation-harnesses/devbob-k8s-git-operations-harness.sh --skip-destructive

if [ $? -eq 0 ]; then
  echo "✓ Validation passed - proceeding with deployment"
else
  echo "✗ Validation failed - blocking deployment"
  exit 1
fi
```

## Related Files

- **Trace**: `TRACE_DEVBOB_K8S_GIT_OPERATIONS.md`
- **Enforcement**: `ENFORCEMENT_DEVBOB_K8S_GIT_OPERATIONS.md`
- **Test Cases**: `impulses/validation-devbob-k8s-git-operations-cases.json`
- **Harness Impulse**: `impulses/harness-devbob-k8s-git-operations.json`

## Maintenance

### Adding New Test Cases

1. Add test function to harness script:
   ```bash
   test_new_feature() {
       local pod=$1
       log_test "$pod: Testing new feature..."
       local output=$(exec_kubectl "$pod" "your command here")
       # ... validation logic ...
       record_test "$pod" "test-name" "true/false" "$output" "expected" "error"
   }
   ```

2. Call in `validate_pod` function
3. Update test case impulses
4. Update this README

### Modifying Expected Outputs

Edit `impulses/validation-devbob-k8s-git-operations-cases.json` to update expected outputs for each test case.

## Performance

- **Non-destructive tests only**: ~30 seconds (5 tests × 3 pods)
- **Full validation (including destructive)**: ~3-5 minutes (9 tests × 3 pods)
- **Single pod validation**: ~1-2 minutes

Times may vary based on network speed and cluster performance.
