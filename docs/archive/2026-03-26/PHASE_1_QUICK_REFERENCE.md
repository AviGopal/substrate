# Phase 1: Repository Access - Quick Reference

## One-Line Deploy

```bash
export ANTHROPIC_API_KEY="sk-ant-xxx" GITHUB_TOKEN="ghp_xxx" && ./helm/deploy-devbob-with-repos.sh
```

## One-Line Validate

```bash
./test-phase1-repo-access.sh
```

## Common Commands

### Deployment

```bash
# Full deployment
helm upgrade --install devbob ./helm/charts/devbob \
  --namespace activity-system \
  --create-namespace \
  --set secrets.anthropicApiKey="$ANTHROPIC_API_KEY" \
  --set repositories.git.token="$GITHUB_TOKEN" \
  --wait

# Update repository list
helm upgrade devbob ./helm/charts/devbob \
  --namespace activity-system \
  --reuse-values \
  --set repositories.repos[1].url="https://github.com/org/new-repo.git" \
  --set repositories.repos[1].branch="main" \
  --set repositories.repos[1].path="new-repo"
```

### Inspection

```bash
# Get pod name
POD=$(kubectl get pod -n activity-system -l app.kubernetes.io/name=devbob -o jsonpath='{.items[0].metadata.name}')

# Check /repos mount
kubectl exec -n activity-system $POD -- ls -la /repos

# View git status
kubectl exec -n activity-system $POD -- git -C /repos/metabob-devbob status

# View recent commits
kubectl exec -n activity-system $POD -- git -C /repos/metabob-devbob log --oneline -10

# Check git config
kubectl exec -n activity-system $POD -- git -C /repos/metabob-devbob config user.name
kubectl exec -n activity-system $POD -- git -C /repos/metabob-devbob config user.email

# Check environment variables
kubectl exec -n activity-system $POD -- printenv | grep -E 'REPOS_PATH|GIT_'
```

### Debugging

```bash
# View init container logs (repository cloning)
kubectl logs -n activity-system $POD -c clone-repos

# View main container logs
kubectl logs -n activity-system $POD -c devbob -f

# Check PVC status
kubectl get pvc -n activity-system
kubectl describe pvc -n activity-system devbob-repos-pvc

# Check secret
kubectl get secret -n activity-system devbob-git-credentials
kubectl get secret -n activity-system devbob-git-credentials -o jsonpath='{.data.\.gitconfig}' | base64 -d

# Exec into pod
kubectl exec -it -n activity-system $POD -- /bin/bash
```

### Testing

```bash
# Run validation script
./test-phase1-repo-access.sh

# Run test activity
kubectl exec -n activity-system $POD -- opencode run /workspace/test-git-repo-access.json

# Manual git test
kubectl exec -n activity-system $POD -- sh -c '
  cd /repos/metabob-devbob
  git status
  git log --oneline -5
  git branch
  git branch test-branch
  git branch -d test-branch
'
```

### Cleanup

```bash
# Delete deployment
helm uninstall devbob -n activity-system

# Delete PVCs (WARNING: deletes all data)
kubectl delete pvc -n activity-system devbob-pvc devbob-repos-pvc

# Delete namespace
kubectl delete namespace activity-system
```

## Configuration Snippets

### Add New Repository

```yaml
# values.yaml
repositories:
  repos:
    - url: "https://github.com/metabob/metabob-devbob.git"
      branch: "main"
      path: "metabob-devbob"
    - url: "https://github.com/org/new-repo.git"  # Add this
      branch: "develop"                            # Add this
      path: "new-repo"                             # Add this
```

### Use SSH Instead of HTTPS

```yaml
# values.yaml
repositories:
  git:
    enabled: true
    username: "MiniBob Agent"
    email: "minibob@metabob.local"
    token: ""  # Leave empty for SSH
    sshKey: |   # Add SSH private key
      -----BEGIN OPENSSH PRIVATE KEY-----
      b3BlbnNzaC1rZXktdjEAAAAABG5vbmUAAAAEbm9uZQAAAAAAAAABAAABFwAAAAdzc2gtcn
      ...
      -----END OPENSSH PRIVATE KEY-----
  repos:
    - url: "git@github.com:org/repo.git"  # Use SSH URL
      branch: "main"
      path: "repo"
```

### Customize Storage Size

```yaml
# values.yaml
repositories:
  persistence:
    size: 50Gi  # Increase for large repositories
```

### Use Different Storage Class

```yaml
# values.yaml
repositories:
  persistence:
    storageClass: "nfs-client"  # Or "efs-sc", "azurefile", etc.
```

## Environment Variables

| Variable | Default | Purpose |
|----------|---------|---------|
| `ANTHROPIC_API_KEY` | (required) | Claude API authentication |
| `GITHUB_TOKEN` | (optional) | GitHub personal access token |
| `GIT_USER_NAME` | "MiniBob Agent" | Git commit author name |
| `GIT_USER_EMAIL` | "minibob@metabob.local" | Git commit author email |
| `NAMESPACE` | "activity-system" | Kubernetes namespace |
| `RELEASE_NAME` | "devbob" | Helm release name |

## File Locations

| Path | Description |
|------|-------------|
| `/repos/` | Shared repository storage (all pods) |
| `/workspace/` | Pod-specific workspace |
| `/root/.gitconfig` | Git configuration (copied from secret) |
| `/root/.git-credentials` | HTTPS credentials (if token provided) |
| `/root/.ssh/id_rsa` | SSH key (if provided) |

## Success Indicators

✓ PVC `devbob-repos-pvc` is `Bound`
✓ Secret `devbob-git-credentials` exists
✓ Pod is `Running`
✓ Init container `clone-repos` completed successfully
✓ `/repos/metabob-devbob/.git` exists
✓ `git status` returns current branch
✓ `git config user.name` returns configured name

## Common Issues

| Symptom | Cause | Fix |
|---------|-------|-----|
| PVC stuck in Pending | Storage class doesn't support RWX | Change `storageClass` in values.yaml |
| Init container fails | Invalid GitHub token | Check token permissions and expiry |
| Repository not found | Wrong URL or private repo without token | Verify URL and add token |
| Git operations fail | .gitconfig not copied | Check init container logs |
| Permission denied | Wrong secret permissions | Verify `defaultMode: 0600` |

## Performance Tips

- **Large repos**: Increase PVC size and use shallow clone
- **Many repos**: Increase init container timeout
- **Slow storage**: Use local storage class for testing
- **Network issues**: Add retry logic to init container

## Security Checklist

- [ ] GitHub token has minimal required scopes
- [ ] SSH private key is not committed to git
- [ ] Secrets are not exposed in logs or environment
- [ ] PVC is not world-readable
- [ ] Git credentials are in files, not env vars

## Links

- [Full Documentation](./PHASE_1_REPOSITORY_ACCESS.md)
- [Implementation Summary](./PHASE_1_IMPLEMENTATION_SUMMARY.md)
- [Deployment Script](./helm/deploy-devbob-with-repos.sh)
- [Validation Script](./test-phase1-repo-access.sh)

## Support

For issues or questions:
1. Check logs: `kubectl logs -n activity-system $POD`
2. Run validation: `./test-phase1-repo-access.sh`
3. Review troubleshooting guide in [PHASE_1_REPOSITORY_ACCESS.md](./PHASE_1_REPOSITORY_ACCESS.md)
