# Trace Analysis: devbob-k8s-git-operations

**Date**: 2026-02-27  
**Specification**: All devbob containers in the Kubernetes StatefulSet must have fully functional git operations  
**Status**: ⚠️ PARTIALLY_IMPLEMENTED  
**Impulse ID**: trace-devbob-k8s-git-operations

---

## Executive Summary

### Current State
Git operations are **NOT functional** in K8s devbob pods. While the codebase contains complete git configuration logic and APIs, they are not integrated into the K8s deployment.

### Validation Results
All 4 validation checks **FAILED**:
- ❌ `git config --list` returns exit code 1 (no configuration)
- ❌ `which gh` returns exit code 1 (GitHub CLI not installed)
- ❌ `/workspace` is not a git repository
- ❌ No git credentials in environment variables

### Gap Summary
**Missing 4 Critical Components**:
1. **gh CLI not installed** in container image (required for PR operations)
2. **Git credentials not in Kubernetes secrets** (GITHUB_TOKEN, GIT_USER_NAME, GIT_USER_EMAIL)
3. **Git not configured at startup** (entrypoint lacks configuration logic)
4. **No vessel repositories initialized** in /workspace mount

---

## Components Traced

### 1. k8s-devbob-statefulset.yaml
**Location**: Lines 1-123  
**Current Behavior**: Defines 3 devbob pods with persistent workspace volumes. Only exposes ANTHROPIC_API_KEY secret.  
**Gap**: No git credential secrets in env, no SSH key volumeMount, no gh CLI verification  
**Required Changes**:
- Add `GIT_USER_NAME` env from secret
- Add `GIT_USER_EMAIL` env from secret  
- Add `GITHUB_TOKEN` env from secret
- Optionally: Add SSH key volume mount to /root/.ssh

### 2. Dockerfile.devbob-local
**Location**: Lines 1-95  
**Current Behavior**: Installs git (line 11) but NOT GitHub CLI (gh)  
**Gap**: Missing gh CLI installation (required by activity-git.ts:202-206)  
**Required Changes**:
```dockerfile
# After line 17 (after git installation)
RUN curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg | \
    gpg --dearmor -o /usr/share/keyrings/githubcli-archive-keyring.gpg && \
    echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" | \
    tee /etc/apt/sources.list.d/github-cli.list > /dev/null && \
    apt-get update && apt-get install -y gh && \
    gh --version
```

### 3. repos/metabob-opencode/docker/entrypoint-self-config.sh
**Location**: Lines 1-180  
**Current Behavior**: Validates environment, waits for backend. **Does NOT configure git**.  
**Gap**: Missing entire git configuration section  
**Required Changes**: Merge git config logic from `configs/devbob-entrypoint.sh:330-380`:
- Set git user.name and user.email
- Configure push behavior (autoSetupRemote)
- Set safe.directory for /workspace
- Configure gh CLI authentication if GITHUB_TOKEN present
- Log git configuration summary

### 4. configs/devbob-entrypoint.sh (NOT USED)
**Location**: Lines 330-380  
**Current Behavior**: Contains complete git configuration logic but is NOT used by K8s deployment  
**Required Action**: Extract and migrate this logic to entrypoint-self-config.sh

### 5. repos/metabob-opencode/packages/opencode/src/session/activity-git.ts
**Location**: Lines 1-230  
**Current Behavior**: Provides complete git operations API (createBranch, commit, push, createPR)  
**Status**: ✅ API is correct, but prerequisites not met in K8s deployment  
**Requirements**:
- Git configured with user.name/email
- gh CLI installed and authenticated
- SSH keys or HTTPS tokens for push authentication

### 6. helm/charts/devbob/templates/secrets.yaml
**Location**: Lines 1-10  
**Current Behavior**: Only stores `anthropic-api-key`  
**Gap**: Missing all git-related secrets  
**Required Changes**:
```yaml
data:
  anthropic-api-key: {{ .Values.secrets.anthropicApiKey | b64enc | quote }}
  github-token: {{ .Values.secrets.githubToken | b64enc | quote }}
  git-user-name: {{ .Values.secrets.gitUserName | b64enc | quote }}
  git-user-email: {{ .Values.secrets.gitUserEmail | b64enc | quote }}
```

### 7. helm/charts/devbob/values.yaml
**Location**: Lines 53-56  
**Current Behavior**: Only defines `anthropicApiKey` in secrets  
**Required Changes**:
```yaml
secrets:
  # REQUIRED: Anthropic API key
  anthropicApiKey: ""
  
  # Git credentials for autonomous operations
  githubToken: ""        # GitHub PAT with repo, workflow, write:packages scopes
  gitUserName: "Devbob Agent"
  gitUserEmail: "devbob@metabob.local"
```

---

## Data Flow Analysis

### Entry Point
`k8s-devbob-statefulset.yaml` (Pod Spec)

### Flow Steps

**Step 1: Inject Git Credentials**
- **Component**: StatefulSet env variables
- **Current**: Only ANTHROPIC_API_KEY injected
- **Required**: Add GIT_USER_NAME, GIT_USER_EMAIL, GITHUB_TOKEN from devbob-secrets

**Step 2: Install GitHub CLI**
- **Component**: Dockerfile.devbob-local
- **Current**: git installed, gh CLI missing
- **Required**: Add gh CLI installation after line 17

**Step 3: Configure Git at Startup**
- **Component**: entrypoint-self-config.sh
- **Current**: No git configuration
- **Required**: Add git config section from configs/devbob-entrypoint.sh:330-380

**Step 4: Execute Git Operations**
- **Component**: activity-git.ts operations
- **Current**: API exists but prerequisites missing
- **Required**: Prerequisites must be met in steps 1-3

### Exit Point
Successful git operations with proper attribution and authentication

---

## Implementation Plan

### Phase 1: Dockerfile (15 minutes) - HIGH PRIORITY
**Files**: `Dockerfile.devbob-local`  
**Changes**:
- Add gh CLI installation after git installation (after line 17)
- Verify gh --version in RUN command

### Phase 2: Secrets (20 minutes) - HIGH PRIORITY
**Files**: `helm/charts/devbob/values.yaml`, `helm/charts/devbob/templates/secrets.yaml`  
**Changes**:
- Add githubToken, gitUserName, gitUserEmail to values.yaml secrets section
- Add corresponding keys to secrets.yaml template
- Document secret requirements in values.yaml comments

### Phase 3: StatefulSet (15 minutes) - HIGH PRIORITY
**Files**: `k8s-devbob-statefulset.yaml`  
**Changes**:
- Add GIT_USER_NAME env from secret (after line 66)
- Add GIT_USER_EMAIL env from secret
- Add GITHUB_TOKEN env from secret
- Optionally: Add SSH key volume mount to /root/.ssh

### Phase 4: Entrypoint (30 minutes) - CRITICAL PRIORITY
**Files**: `repos/metabob-opencode/docker/entrypoint-self-config.sh`  
**Changes**:
- Add git configuration section (merge from configs/devbob-entrypoint.sh:330-380)
- Add gh auth login using GITHUB_TOKEN if present
- Add validation checks for git config and gh auth status
- Log git configuration summary

### Phase 5: Vessel Initialization (45 minutes) - MEDIUM PRIORITY
**Files**: New activity template or entrypoint enhancement  
**Changes**:
- Clone vessel repos (metabob-opencode, metabob-cli, metabob-dashboard) to /workspace if not present
- Configure git remotes for each repo
- Verify git operations work (git fetch, git status)
- Create initialization activity template for reusability

**Total Estimated Effort**: 2-3 hours

---

## Validation Checks

After implementation, verify with these commands:

### 1. Git Config Present
```bash
kubectl exec -n metabob devbob-0 -- git config --list
```
**Expected**:
```
user.name=Devbob Agent
user.email=devbob@metabob.local
init.defaultBranch=main
push.autoSetupRemote=true
```

### 2. GitHub CLI Installed
```bash
kubectl exec -n metabob devbob-0 -- which gh
```
**Expected**: `/usr/bin/gh` or `/usr/local/bin/gh`

### 3. Workspace is Git Repo
```bash
kubectl exec -n metabob devbob-0 -- sh -c 'cd /workspace && git remote -v'
```
**Expected**:
```
origin https://github.com/org/repo.git (fetch)
origin https://github.com/org/repo.git (push)
```

### 4. GitHub Credentials Present
```bash
kubectl exec -n metabob devbob-0 -- env | grep -E '(GIT|GITHUB)'
```
**Expected**:
```
GIT_USER_NAME=Devbob Agent
GIT_USER_EMAIL=devbob@metabob.local
GITHUB_TOKEN=ghp_...
```

---

## Critical Dependencies

Before implementation, ensure:

1. **GitHub Personal Access Token (classic)** with scopes:
   - `repo` (full repository access)
   - `workflow` (update GitHub Actions workflows)
   - `write:packages` (publish packages)

2. **Git user.name and user.email** for commit attribution

3. **Network connectivity** from K8s cluster to github.com (verify with curl/wget)

4. **Sufficient disk space** in PersistentVolume for repo clones (recommend 10Gi minimum)

5. **gh CLI version >= 2.0** for PR operations

---

## References

### Existing Implementation
- **Git configuration logic**: `configs/devbob-entrypoint.sh:330-380`
- **Git operations API**: `repos/metabob-opencode/packages/opencode/src/session/activity-git.ts`
- **Remote setup guide**: `repos/metabob-opencode/packages/opencode/.archive/docs/REMOTE_SETUP_CHECKLIST.md:60-66`
- **Activity git tests**: `repos/metabob-opencode/packages/opencode/test/session/activity-git.test.ts`

### Related Documentation
- Distributed DevBob Deployment Guide
- Kubernetes Deployment Readiness Summary
- K8s Deployment Validation Complete

---

## Next Actions

For downstream validation and enforcement tasks:

1. **Load impulse**: `impulses/trace-devbob-k8s-git-operations.json`
2. **Review implementation plan**: 5 phases with priorities
3. **Execute phases sequentially**: Dockerfile → Secrets → StatefulSet → Entrypoint → Vessel Init
4. **Validate after each phase**: Use validation checks above
5. **Document results**: Update deployment validation reports

---

**Impulse Created**: `trace-devbob-k8s-git-operations`  
**Budget**: 5000 tokens  
**Ready for**: Downstream validation and enforcement activities
