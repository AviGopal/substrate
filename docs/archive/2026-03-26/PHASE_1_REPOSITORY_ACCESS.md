# Phase 1: Repository Access for MiniBob

## Overview

Phase 1 enables MiniBob pods to work with actual git repositories instead of isolated `/workspace` directories. This is the foundation for autonomous development workflows where MiniBob can read, modify, and commit changes to real codebases.

## Architecture

### Components

1. **Shared Repository Storage (PVC)**
   - `ReadWriteMany` PersistentVolumeClaim for repositories
   - Mounted at `/repos` in all MiniBob pods
   - Default size: 20Gi
   - Shared across all MiniBob replicas

2. **Git Credentials Secret**
   - Contains `.gitconfig`, `.git-credentials`, and optional SSH keys
   - Mounted into init container for repository cloning
   - Copied to `/root/.gitconfig` for git operations

3. **Init Container (`clone-repos`)**
   - Runs before main MiniBob container
   - Clones configured repositories on first boot
   - Updates repositories on subsequent restarts
   - Uses `alpine/git:latest` image

4. **Updated Git Tool**
   - Defaults to `/repos` as working directory when `REPOS_PATH` is set
   - Automatically uses mounted git credentials
   - Supports all git operations: status, log, branch, commit, push

### File Structure

```
helm/charts/devbob/
├── templates/
│   ├── deployment.yaml        # Updated with init container and volumes
│   ├── pvc-repos.yaml         # New: Repositories PVC
│   ├── secret-git.yaml        # New: Git credentials secret
│   └── secrets.yaml           # Existing: API keys
└── values.yaml                # Updated with repository configuration

repos/minibob/
├── src/tools.ts               # Updated: git tool defaults to /repos
└── templates/
    └── test-git-repo-access.json  # New: Validation activity

helm/
├── deploy-devbob-with-repos.sh   # New: Deployment script
└── test-phase1-repo-access.sh     # New: Validation script
```

## Configuration

### values.yaml

```yaml
repositories:
  # Enable repository cloning and shared storage
  persistence:
    enabled: true
    storageClass: ""  # Use default
    accessMode: ReadWriteMany  # Shared across pods
    size: 20Gi
    mountPath: /repos

  # Git configuration for authentication
  git:
    enabled: true
    username: "MiniBob Agent"
    email: "minibob@metabob.local"
    token: ""  # GitHub/GitLab personal access token
    sshKey: ""  # Optional SSH private key

  # List of repositories to clone
  repos:
    - url: "https://github.com/metabob/metabob-devbob.git"
      branch: "main"
      path: "metabob-devbob"
```

### Environment Variables

Set these before deployment:

```bash
# Required
export ANTHROPIC_API_KEY="sk-ant-your-key-here"

# Optional (for private repositories)
export GITHUB_TOKEN="ghp_your_token_here"

# Optional (customize git user)
export GIT_USER_NAME="MiniBob Agent"
export GIT_USER_EMAIL="minibob@metabob.local"
```

## Deployment

### Option 1: Using Deployment Script

```bash
# Set required environment variables
export ANTHROPIC_API_KEY="sk-ant-your-key-here"
export GITHUB_TOKEN="ghp_your_token_here"  # Optional

# Run deployment script
./helm/deploy-devbob-with-repos.sh
```

### Option 2: Manual Helm Deployment

```bash
# Create namespace
kubectl create namespace activity-system

# Enable Istio injection
kubectl label namespace activity-system istio-injection=enabled --overwrite

# Deploy with Helm
helm upgrade --install devbob \
  ./helm/charts/devbob \
  --namespace activity-system \
  --set secrets.anthropicApiKey="$ANTHROPIC_API_KEY" \
  --set repositories.git.token="$GITHUB_TOKEN" \
  --wait
```

## Validation

### Automated Testing

Run the comprehensive validation script:

```bash
./test-phase1-repo-access.sh
```

This script tests:
- ✓ PersistentVolumeClaims exist and are bound
- ✓ Git credentials secret exists
- ✓ Pod is running
- ✓ `/repos` directory is mounted
- ✓ Repositories are cloned
- ✓ Git operations work (status, log, branch)
- ✓ Git configuration is correct
- ✓ Environment variables are set

### Manual Verification

```bash
# Get pod name
POD=$(kubectl get pod -n activity-system -l app.kubernetes.io/name=devbob -o jsonpath='{.items[0].metadata.name}')

# Check /repos mount
kubectl exec -n activity-system $POD -- ls -la /repos

# Verify repository was cloned
kubectl exec -n activity-system $POD -- ls -la /repos/metabob-devbob

# Test git operations
kubectl exec -n activity-system $POD -- git -C /repos/metabob-devbob status
kubectl exec -n activity-system $POD -- git -C /repos/metabob-devbob log --oneline -5
kubectl exec -n activity-system $POD -- git -C /repos/metabob-devbob branch

# Check git configuration
kubectl exec -n activity-system $POD -- git -C /repos/metabob-devbob config user.name
kubectl exec -n activity-system $POD -- git -C /repos/metabob-devbob config user.email
```

### Activity-Based Test

MiniBob includes a test activity to verify repository access:

```bash
# Copy test activity to pod (if not already there)
POD=$(kubectl get pod -n activity-system -l app.kubernetes.io/name=devbob -o jsonpath='{.items[0].metadata.name}')

# Run test activity
kubectl exec -n activity-system $POD -- opencode run /workspace/test-git-repo-access.json
```

The activity performs:
1. Verify /repos directory exists
2. Run git status
3. View recent commits
4. List branches
5. Verify git configuration
6. Create and delete test branch

## Implementation Details

### Init Container Flow

```bash
1. Mount git credentials secret to /git-config
2. Copy .gitconfig to /root/.gitconfig
3. Copy .git-credentials to /root/.git-credentials (if token provided)
4. Copy SSH key to /root/.ssh/id_rsa (if SSH key provided)
5. For each repository in values.yaml:
   a. Check if repository already exists
   b. If not: git clone --branch <branch> <url> /repos/<path>
   c. If exists: cd /repos/<path> && git pull origin <branch>
6. List /repos contents
```

### Git Tool Enhancements

The MiniBob git tool now:

1. **Defaults to `/repos`**: When `REPOS_PATH` environment variable is set, git operations default to that directory
2. **Uses mounted credentials**: Sets `GIT_CONFIG_GLOBAL=/root/.gitconfig` in environment
3. **Supports custom working directory**: Can still override with `cwd` parameter

Example tool usage:

```typescript
// Uses /repos as default cwd (if REPOS_PATH is set)
await tools.git({
  command: "status"
})

// Override with custom path
await tools.git({
  command: "status",
  cwd: "/workspace/custom-repo"
})
```

## Storage Considerations

### Access Modes

- **Workspace PVC**: `ReadWriteOnce` (pod-specific)
- **Repos PVC**: `ReadWriteMany` (shared across all MiniBob pods)

### Storage Classes

Default storage class is used unless specified. For production:

- **Local development**: Use default (usually `standard` or `hostpath`)
- **Cloud (GKE/EKS/AKS)**: Use provider-specific RWX storage class
  - GKE: `pd-standard` with RWX support
  - EKS: `efs-sc` (requires EFS CSI driver)
  - AKS: `azurefile`

### Sizing Guidelines

- **Workspace PVC** (per pod): 10Gi (logs, temp files, activity state)
- **Repos PVC** (shared): 20Gi base + 5Gi per large repository
  - Adjust based on repository sizes
  - Include space for branches and git history

## Security

### Git Credentials

Three authentication methods supported:

1. **HTTPS with Personal Access Token** (recommended)
   - Set `repositories.git.token` in values.yaml
   - Creates `.git-credentials` with token
   - Works with GitHub, GitLab, Bitbucket

2. **SSH with Private Key**
   - Set `repositories.git.sshKey` in values.yaml (base64 encoded)
   - Installs key to `/root/.ssh/id_rsa`
   - Adds GitHub to known_hosts

3. **Public repositories only**
   - Leave token and SSH key empty
   - Only public repos can be cloned

### Secret Management

Secrets are stored in Kubernetes Secret:
- `devbob-git-credentials` contains all git authentication data
- Mounted read-only in init container
- Not exposed to main MiniBob container (copied during init)

For production, use external secret management:
- Sealed Secrets
- External Secrets Operator
- Vault integration

## Troubleshooting

### Repository not cloning

**Symptom**: Init container fails with "authentication failed"

**Solution**:
1. Verify token has correct permissions (repo read access)
2. Check token is correctly set in values.yaml
3. For private repos, ensure token is provided

```bash
# Check init container logs
kubectl logs -n activity-system $POD -c clone-repos
```

### PVC not binding

**Symptom**: PVC stuck in "Pending" state

**Solution**:
1. Check if storage class supports ReadWriteMany
2. Verify sufficient storage available
3. Use different storage class if needed

```bash
# Check PVC status
kubectl describe pvc -n activity-system devbob-repos-pvc

# List available storage classes
kubectl get storageclass
```

### Git operations fail

**Symptom**: `git status` returns "not a git repository"

**Solution**:
1. Verify repository was cloned in init container
2. Check init container logs
3. Manually clone if needed

```bash
# Check init container logs
kubectl logs -n activity-system $POD -c clone-repos

# Verify repo exists
kubectl exec -n activity-system $POD -- ls -la /repos

# Manual clone (if needed)
kubectl exec -n activity-system $POD -- git clone https://github.com/org/repo.git /repos/repo
```

### Git credentials not working

**Symptom**: `git push` fails with "authentication required"

**Solution**:
1. Verify secret exists and contains correct data
2. Check .gitconfig was copied to /root
3. Verify token permissions include push access

```bash
# Check if secret exists
kubectl get secret -n activity-system devbob-git-credentials

# Verify .gitconfig in pod
kubectl exec -n activity-system $POD -- cat /root/.gitconfig

# Check credential helper
kubectl exec -n activity-system $POD -- git -C /repos/metabob-devbob config credential.helper
```

## Next Steps

With Phase 1 complete, MiniBob can now:
- ✓ Access real git repositories
- ✓ Perform all git operations
- ✓ Use authenticated access for private repos

### Phase 2 Recommendations

1. **Multi-repository workflows**: Activities that work across multiple repos
2. **Branch management**: Automatic branch creation for isolated work
3. **Commit automation**: Activities that create commits with proper messages
4. **Pull request creation**: Integration with GitHub/GitLab APIs
5. **Code review**: Activities that analyze diffs and provide feedback

## Files Changed

### New Files
- `helm/charts/devbob/templates/pvc-repos.yaml` - Repositories PVC
- `helm/charts/devbob/templates/secret-git.yaml` - Git credentials secret
- `repos/minibob/templates/test-git-repo-access.json` - Validation activity
- `helm/deploy-devbob-with-repos.sh` - Deployment script
- `test-phase1-repo-access.sh` - Validation script
- `PHASE_1_REPOSITORY_ACCESS.md` - This documentation

### Modified Files
- `helm/charts/devbob/values.yaml` - Added repository configuration
- `helm/charts/devbob/templates/deployment.yaml` - Added init container and volumes
- `repos/minibob/src/tools.ts` - Updated git tool to default to /repos

## Success Criteria

Phase 1 is successful when:
- [x] PVC for repositories is created and bound
- [x] Git credentials secret is created
- [x] Init container successfully clones repositories
- [x] Repositories are accessible at `/repos`
- [x] Git operations work (status, log, branch)
- [x] Git configuration is correct (user.name, user.email)
- [x] Environment variables are set correctly
- [x] Test activity passes all validation steps

Run `./test-phase1-repo-access.sh` to verify all criteria are met.
