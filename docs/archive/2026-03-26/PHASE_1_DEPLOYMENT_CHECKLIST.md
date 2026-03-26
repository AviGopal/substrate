# Phase 1: Repository Access - Deployment Checklist

## Pre-Deployment Checklist

### Environment Setup
- [ ] Kubernetes cluster is running (`kubectl cluster-info`)
- [ ] Docker Desktop or equivalent is running
- [ ] kubectl context is correct (`kubectl config current-context`)
- [ ] Istio is installed (`istioctl version`)
- [ ] Storage class supports ReadWriteMany (check with `kubectl get storageclass`)

### Environment Variables
- [ ] `ANTHROPIC_API_KEY` is set and valid
- [ ] `GITHUB_TOKEN` is set (if using private repositories)
- [ ] `GIT_USER_NAME` is set (optional, defaults to "MiniBob Agent")
- [ ] `GIT_USER_EMAIL` is set (optional, defaults to "minibob@metabob.local")

### Docker Images
- [ ] devbob:latest image exists (`docker images | grep devbob`)
- [ ] If not, built with: `cd repos/minibob && docker build -t devbob:latest .`

### /etc/hosts Configuration (for Istio ingress)
- [ ] Entry exists: `127.0.0.1  api.minibob.local dashboard.minibob.local`

## Deployment Steps

### 1. Quick Deployment (Recommended)
```bash
# One-line deploy
export ANTHROPIC_API_KEY="sk-ant-xxx"
export GITHUB_TOKEN="ghp_xxx"  # Optional
./helm/deploy-devbob-with-repos.sh
```

**Checklist:**
- [ ] Script completes without errors
- [ ] All pods are running
- [ ] PVCs are bound
- [ ] Init container completed successfully

### 2. Manual Deployment (Alternative)
```bash
# Create namespace
kubectl create namespace activity-system

# Enable Istio injection
kubectl label namespace activity-system istio-injection=enabled --overwrite

# Deploy with Helm
helm upgrade --install devbob ./helm/charts/devbob \
  --namespace activity-system \
  --set secrets.anthropicApiKey="$ANTHROPIC_API_KEY" \
  --set repositories.git.token="$GITHUB_TOKEN" \
  --wait
```

**Checklist:**
- [ ] Namespace created
- [ ] Istio injection enabled
- [ ] Helm deployment succeeded
- [ ] Pods are in Running state

## Post-Deployment Validation

### Automated Validation
```bash
./test-phase1-repo-access.sh
```

**Expected Results:**
- [ ] All 18 tests pass
- [ ] Summary shows: "All tests passed!"
- [ ] No failures in output

### Manual Validation Steps

#### 1. Check Resources
```bash
# Check namespace
kubectl get all -n activity-system

# Check PVCs
kubectl get pvc -n activity-system

# Check secrets
kubectl get secrets -n activity-system
```

**Checklist:**
- [ ] devbob pod is Running
- [ ] devbob-pvc is Bound
- [ ] devbob-repos-pvc is Bound
- [ ] devbob-git-credentials secret exists
- [ ] devbob-secrets secret exists

#### 2. Verify Init Container
```bash
POD=$(kubectl get pod -n activity-system -l app.kubernetes.io/name=devbob -o jsonpath='{.items[0].metadata.name}')
kubectl logs -n activity-system $POD -c clone-repos
```

**Expected Output:**
- [ ] "Setting up git credentials" message
- [ ] "Cloning https://github.com/metabob/metabob-devbob.git"
- [ ] "Successfully cloned metabob-devbob"
- [ ] No error messages

#### 3. Verify Repository Mount
```bash
kubectl exec -n activity-system $POD -- ls -la /repos
```

**Expected Output:**
- [ ] Directory exists
- [ ] Contains subdirectory: metabob-devbob
- [ ] metabob-devbob contains .git directory

#### 4. Test Git Operations
```bash
# Git status
kubectl exec -n activity-system $POD -- git -C /repos/metabob-devbob status

# Git log
kubectl exec -n activity-system $POD -- git -C /repos/metabob-devbob log --oneline -5

# Git branch
kubectl exec -n activity-system $POD -- git -C /repos/metabob-devbob branch
```

**Checklist:**
- [ ] git status shows clean working directory or current branch
- [ ] git log shows recent commits
- [ ] git branch shows current branch

#### 5. Verify Git Configuration
```bash
kubectl exec -n activity-system $POD -- git -C /repos/metabob-devbob config user.name
kubectl exec -n activity-system $POD -- git -C /repos/metabob-devbob config user.email
```

**Expected Output:**
- [ ] user.name returns "MiniBob Agent" (or custom value)
- [ ] user.email returns "minibob@metabob.local" (or custom value)

#### 6. Test Branch Operations
```bash
kubectl exec -n activity-system $POD -- sh -c '
  cd /repos/metabob-devbob
  git branch test-branch
  git branch | grep test-branch
  git branch -d test-branch
'
```

**Checklist:**
- [ ] test-branch created successfully
- [ ] test-branch appears in branch list
- [ ] test-branch deleted successfully

#### 7. Check Environment Variables
```bash
kubectl exec -n activity-system $POD -- printenv | grep -E 'REPOS_PATH|GIT_'
```

**Expected Output:**
- [ ] REPOS_PATH=/repos
- [ ] GIT_USER_NAME=MiniBob Agent (or custom)
- [ ] GIT_USER_EMAIL=minibob@metabob.local (or custom)

## Troubleshooting Checklist

### If PVC is stuck in Pending
```bash
kubectl describe pvc -n activity-system devbob-repos-pvc
kubectl get storageclass
```

**Actions:**
- [ ] Check if storage class supports ReadWriteMany
- [ ] Verify sufficient storage available
- [ ] Consider using different storage class: `--set repositories.persistence.storageClass=nfs-client`

### If Init Container Fails
```bash
kubectl logs -n activity-system $POD -c clone-repos
kubectl describe pod -n activity-system $POD
```

**Common Issues:**
- [ ] Invalid GitHub token (check expiration and permissions)
- [ ] Wrong repository URL
- [ ] Network connectivity issues
- [ ] Git credentials not properly configured

**Actions:**
- [ ] Verify GITHUB_TOKEN has repo access
- [ ] Check repository URL is correct
- [ ] Ensure secret was created: `kubectl get secret -n activity-system devbob-git-credentials`

### If Git Operations Fail
```bash
kubectl exec -n activity-system $POD -- cat /root/.gitconfig
kubectl exec -n activity-system $POD -- test -f /root/.git-credentials && echo "exists" || echo "missing"
```

**Actions:**
- [ ] Verify .gitconfig exists in container
- [ ] Check .git-credentials exists (if using HTTPS)
- [ ] Verify init container logs show successful credential copy

### If Repository Not Cloned
```bash
kubectl exec -n activity-system $POD -- ls -la /repos
kubectl logs -n activity-system $POD -c clone-repos
```

**Actions:**
- [ ] Check init container completed successfully
- [ ] Verify repository URL is accessible
- [ ] Check GitHub token has access to repository
- [ ] Manually clone to debug: `kubectl exec -n activity-system $POD -- git clone <url> /repos/test`

## Success Criteria

All of the following must be true:

### Infrastructure
- [x] Kubernetes cluster is operational
- [x] activity-system namespace exists
- [x] Istio is installed and enabled on namespace
- [x] Storage class supports ReadWriteMany

### Resources
- [x] devbob deployment is created
- [x] devbob-pvc (workspace) is Bound
- [x] devbob-repos-pvc (repositories) is Bound
- [x] devbob-git-credentials secret exists
- [x] devbob-secrets secret exists

### Pod State
- [x] devbob pod is Running
- [x] Init container (clone-repos) completed successfully
- [x] Main container (devbob) is ready

### Repository Access
- [x] /repos directory exists and is mounted
- [x] metabob-devbob repository is cloned
- [x] .git directory exists in repository
- [x] Git operations work (status, log, branch)

### Configuration
- [x] Git user.name is configured
- [x] Git user.email is configured
- [x] .gitconfig exists at /root/.gitconfig
- [x] REPOS_PATH environment variable is set
- [x] Git tool defaults to /repos

### Testing
- [x] Automated test suite passes (./test-phase1-repo-access.sh)
- [x] All 18 validation checks pass
- [x] Manual verification commands work
- [x] Branch create/delete operations succeed

## Sign-off

Date: __________

Deployed by: __________

Validated by: __________

Notes:
_________________________________________________________________
_________________________________________________________________
_________________________________________________________________

## Next Steps

After successful deployment and validation:

1. **Explore the system**
   ```bash
   # Exec into pod
   kubectl exec -it -n activity-system $POD -- /bin/bash
   
   # Navigate to repos
   cd /repos/metabob-devbob
   
   # Explore the codebase
   ls -la
   ```

2. **Run test activity**
   ```bash
   kubectl exec -n activity-system $POD -- opencode run /workspace/test-git-repo-access.json
   ```

3. **View logs**
   ```bash
   kubectl logs -n activity-system $POD -f
   ```

4. **Access dashboard**
   ```bash
   open http://dashboard.minibob.local
   ```

5. **Plan Phase 2**
   - Review PHASE_1_REPOSITORY_ACCESS.md for recommendations
   - Consider branch management automation
   - Plan commit automation workflows

## Emergency Rollback

If deployment fails and needs rollback:

```bash
# Uninstall Helm release
helm uninstall devbob -n activity-system

# Delete PVCs (WARNING: deletes all data)
kubectl delete pvc -n activity-system devbob-pvc devbob-repos-pvc

# Delete namespace (if needed)
kubectl delete namespace activity-system
```

## Support Resources

- **Full Documentation**: `PHASE_1_REPOSITORY_ACCESS.md`
- **Quick Reference**: `PHASE_1_QUICK_REFERENCE.md`
- **Architecture Diagram**: `PHASE_1_ARCHITECTURE_DIAGRAM.md`
- **Implementation Summary**: `PHASE_1_IMPLEMENTATION_SUMMARY.md`

For issues:
1. Check pod logs: `kubectl logs -n activity-system $POD`
2. Check init container logs: `kubectl logs -n activity-system $POD -c clone-repos`
3. Describe pod: `kubectl describe pod -n activity-system $POD`
4. Run validation: `./test-phase1-repo-access.sh`
