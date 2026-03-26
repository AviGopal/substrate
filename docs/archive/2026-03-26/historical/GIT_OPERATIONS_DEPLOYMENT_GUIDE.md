# DevBob K8s Git Operations - Deployment Guide

**Date**: February 27, 2026  
**Specification**: devbob-k8s-git-operations  
**Status**: ✅ Ready for Deployment

---

## Quick Start

```bash
# 1. Export your GitHub token (or script will prompt)
export GITHUB_TOKEN=ghp_your_token_here

# 2. Run deployment
./deploy-devbob-k8s-git.sh

# 3. Validate
./tests/validation-harnesses/devbob-k8s-git-operations-harness.sh --skip-destructive
```

**Expected Time**: 10-20 minutes  
**Expected Result**: 15/15 tests passing (all git operations functional)

---

## What This Deployment Does

### Git Operations Being Enabled
1. ✅ Git user configuration (name, email)
2. ✅ GitHub CLI (gh) authentication
3. ✅ Repository cloning
4. ✅ Creating commits
5. ✅ Pushing to GitHub
6. ✅ Creating and merging PRs

### Components Modified
- `Dockerfile.devbob-local` - Added gh CLI installation
- `k8s-devbob-statefulset.yaml` - Added git env variables
- `repos/metabob-opencode/docker/entrypoint-self-config.sh` - Added git config logic
- Kubernetes secret - Extended with git credentials

---

## Prerequisites

### Required: GitHub Token
Create a Personal Access Token at: https://github.com/settings/tokens

**Required Scopes**:
- `repo` - Full control of private repositories
- `workflow` - Update GitHub Actions workflows
- `write:packages` - Upload packages to GitHub Package Registry

**Security Note**: This token will be stored in Kubernetes secret `devbob-secrets`

### Optional: Git User Info
- **User Name**: Default = "Devbob Agent"
- **User Email**: Default = "devbob@metabob.local"

You can customize these during deployment or use defaults.

---

## Deployment Script Details

### What `deploy-devbob-k8s-git.sh` Does

```
Step 1: Verify image devbob:local-fixed exists
Step 2: Gather credentials (Anthropic key + GitHub token + git user)
Step 3: Update Kubernetes secret (4 keys: anthropic-api-key, github-token, git-user-name, git-user-email)
Step 4: Apply StatefulSet configuration (k8s-devbob-statefulset.yaml)
Step 5: Wait for rollout to complete (~2-5 minutes)
Step 6: Verify pod status (all 3 pods Running)
Step 7: Check git configuration logs
```

### Interactive Prompts

If credentials are not in environment:
```
Enter GITHUB_TOKEN (or press Enter to skip git operations): [hidden input]
Enter git user name [Devbob Agent]: 
Enter git user email [devbob@metabob.local]: 
```

---

## Post-Deployment Validation

### Automated Testing

**Non-Destructive Tests** (safe, no side effects):
```bash
./tests/validation-harnesses/devbob-k8s-git-operations-harness.sh --skip-destructive
```

Tests:
- Workspace accessible
- Git config present
- GitHub CLI installed
- Git credentials present
- GitHub CLI authenticated

**Expected**: 15/15 PASS (5 tests × 3 pods)

**Destructive Tests** (requires clean workspace):
```bash
./tests/validation-harnesses/devbob-k8s-git-operations-harness.sh --destructive-only
```

Tests:
- Repository clone
- Create commit
- Push to GitHub
- Create PR

**Expected**: 12/12 PASS (4 tests × 3 pods)

### Manual Verification

```bash
# Check pod logs for git config
kubectl logs devbob-0 -n metabob | grep "Step 3b"

# Verify git configuration
kubectl exec -it devbob-0 -n metabob -- git config --global --list

# Verify GitHub CLI authentication
kubectl exec -it devbob-0 -n metabob -- gh auth status

# Test git workflow end-to-end
kubectl exec -it devbob-0 -n metabob -- bash -c "
  cd /workspace && \
  mkdir test-repo && cd test-repo && \
  git init && \
  echo '# Test' > README.md && \
  git add . && \
  git commit -m 'Initial commit' && \
  echo 'Git workflow successful!'
"
```

---

## Expected Pod Logs

After successful deployment, you should see:

```
[INFO] Step 3b: Configuring git...
[INFO]   ✓ Git user.name: Devbob Agent
[INFO]   ✓ Git user.email: devbob@metabob.local
[INFO]   Configuring GitHub CLI authentication...
[INFO]   ✓ GitHub CLI authenticated successfully
[INFO]   Git configuration summary:
[INFO]     user.name=Devbob Agent
[INFO]     user.email=devbob@metabob.local
[INFO]     init.defaultBranch=main
[INFO]     push.autoSetupRemote=true
```

---

## Rollback Plan

If something goes wrong:

```bash
# 1. Rollback StatefulSet to previous version
kubectl rollout undo statefulset/devbob -n metabob

# 2. Restore original secret (Anthropic key only)
ANTHROPIC_KEY=$(kubectl get secret devbob-secrets -n metabob -o jsonpath='{.data.anthropic-api-key}' | base64 -d)

kubectl create secret generic devbob-secrets -n metabob \
  --from-literal=anthropic-api-key="$ANTHROPIC_KEY" \
  --dry-run=client -o yaml | kubectl apply -f -

# 3. Verify rollback
kubectl get pods -n metabob
```

---

## Troubleshooting

### Issue: GitHub token authentication fails

**Symptoms**:
```
⚠ GitHub CLI authentication failed
```

**Solution**:
1. Verify token has correct scopes (repo, workflow)
2. Check token is not expired
3. Ensure token is correctly set in secret:
   ```bash
   kubectl get secret devbob-secrets -n metabob -o jsonpath='{.data.github-token}' | base64 -d
   ```

### Issue: Pods stuck in ImagePullBackOff

**Symptoms**:
```
devbob-0   0/1   ImagePullBackOff
```

**Solution**:
1. Verify image was built: `docker images | grep devbob`
2. Check image name in StatefulSet matches: `devbob:local-fixed`
3. Verify imagePullPolicy: `Never` (for local images)

### Issue: Validation tests fail after deployment

**Symptoms**:
```
FAIL: git-config-present (devbob-0)
```

**Solution**:
1. Check pod logs: `kubectl logs devbob-0 -n metabob | grep "Step 3b"`
2. Verify secret exists: `kubectl get secret devbob-secrets -n metabob`
3. Verify environment variables injected: `kubectl exec -it devbob-0 -n metabob -- env | grep GIT`
4. Manual git config: `kubectl exec -it devbob-0 -n metabob -- git config --global user.name "Test"`

---

## Architecture Compliance

### Specification: devbob-k8s-git-operations

**Requirement**: All devbob containers in Kubernetes StatefulSet must have fully functional git operations (config, clone, commit, push, PR creation/merge)

**Enforcement Strategy**:
1. ✅ Dockerfile includes gh CLI installation
2. ✅ Kubernetes secret stores git credentials
3. ✅ Environment variables inject credentials to pods
4. ✅ Entrypoint configures git at startup
5. ✅ Validation harness verifies all operations

**Validation**: 27 test cases across 3 pods (15 non-destructive + 12 destructive)

**Pass Criteria**: All 27 tests must pass

---

## Files Reference

### Created/Modified
- `Dockerfile.devbob-local` - gh CLI installation
- `k8s-devbob-statefulset.yaml` - Git env vars
- `repos/metabob-opencode/docker/entrypoint-self-config.sh` - Step 3b git config
- `deploy-devbob-k8s-git.sh` - Deployment automation
- `tests/validation-harnesses/devbob-k8s-git-operations-harness.sh` - Validation

### Documentation
- `TRACE_DEVBOB_K8S_GIT_OPERATIONS.md` - Gap analysis
- `ENFORCEMENT_DEVBOB_K8S_GIT_OPERATIONS.md` - Code changes
- `GIT_OPERATIONS_DEPLOYMENT_GUIDE.md` - This file

### Impulses
- `impulses/trace-devbob-k8s-git-operations.json`
- `impulses/enforcement-devbob-k8s-git-operations.json`
- `impulses/validation-devbob-k8s-git-operations-cases.json`
- `impulses/harness-devbob-k8s-git-operations.json`
- `impulses/conflict-analysis-devbob-k8s-git-operations.json`

---

## Success Metrics

| Metric | Target | Current | After Deploy |
|--------|--------|---------|--------------|
| Git Config | 3/3 pods | 0/3 | 3/3 ✅ |
| GH CLI Install | 3/3 pods | 0/3 | 3/3 ✅ |
| GH CLI Auth | 3/3 pods | 0/3 | 3/3 ✅ |
| Git Operations | Full workflow | None | Full ✅ |
| Validation | 27/27 tests | 3/27 | 27/27 ✅ |

---

## Next Steps After Deployment

1. ✅ Verify validation tests pass (15/15 non-destructive)
2. ✅ Test destructive operations (12/12)
3. ✅ Update validation results impulse
4. ✅ Mark specification as DEPLOYED
5. ✅ Document deployment in session summary

---

**Ready to Deploy**: All prerequisites met, all code changes applied, image built, script tested.

**Deploy Command**: `./deploy-devbob-k8s-git.sh`
