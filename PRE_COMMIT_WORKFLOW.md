# Pre-Commit Workflow

This document describes the automated pre-commit workflow that ensures all changes are incrementally built, tested, and deployed.

## Overview

Every commit triggers an automated workflow that:
1. **Cleans deprecated code** - Identifies and warns about deprecated code older than 2 commits
2. **Syncs vessels** - Copies changed repos to deployment workspace
3. **Builds containers** - Builds only changed vessel Docker images
4. **Deploys to local cluster** - Updates Kubernetes deployments via Helmfile
5. **Validates health** - Waits for pods to be ready
6. **Commits deployment changes** - Tracks deployment state in separate repo

## Philosophy: Commit Early, Commit Often

**When to commit:**
- After demonstrating a working feature in the deployed environment
- After completing a logical unit of work (endpoint, migration, bug fix)
- Before making destructive changes (namespace deletion, major refactoring)

**Why incremental commits:**
- Continuous deployment ensures every change is tested in cluster
- Learning system collects traces from each deployment
- Easier rollback to last known-good state
- Deployment history is independent from source history

## The Six-Step Process

### Step 1: Clean Deprecated Code

Searches for markers in source code:
- `DEPRECATED`
- `@deprecated ... remove`
- `TODO ... remove ... legacy`

If found in code from 2+ commits ago:
- **Warning displayed** with file locations
- **Manual review recommended** before committing
- **Commit still allowed** (soft enforcement)

**How to mark code as deprecated:**

```typescript
// DEPRECATED: This function moved to src/new-location.ts
// TODO: remove after 2025-04-01
function oldFunction() {
  // ...
}
```

After 2 commits with this marker, the pre-commit hook will warn you to remove it.

### Step 2: Check Deployment Repository

- Ensures `repos/deployment/` exists
- Switches to `dev` branch
- Pulls latest changes
- **Skips entire workflow** if deployment repo not found

### Step 3: Discover and Sync Vessels

**Dynamic vessel discovery:**
- Scans `repos/deployment/vessels/*` as source of truth (registry)
- For each vessel, checks if matching `repos/<vessel-name>` exists
- Only syncs vessels with staged changes

**Rsync configuration:**
```bash
rsync -av --delete \
  --exclude='node_modules' \
  --exclude='bun.lockb' \
  --exclude='.git' \
  --exclude='dist' \
  --exclude='build' \
  --exclude='.env*' \
  --exclude='*.log' \
  repos/<vessel-name>/ \
  repos/deployment/vessels/<vessel-name>/
```

**Example:**
```
Discovered vessels from deployment/vessels/:
  - metabob-activity-api
  - minibob
  - concept-db
  - identity-vessel

Changed in this commit:
  → metabob-activity-api (changes detected)
  → minibob (changes detected)

Syncing 2 vessels...
```

### Step 4: Build Changed Vessels

Calls `repos/deployment/scripts/build_changed.sh --dev`:

**What it does:**
- Dynamically discovers vessels from `vessels/*` (same as Step 3)
- Checks git diff to detect changed vessels
- For each changed vessel:
  - Gets version from `package.json`
  - Generates tag: `metabobapp/<vessel>:dev-<version>-<sha>-<buildnum>`
  - Builds Docker image
  - Tags as `:dev-latest`
  - Updates `environments/local.values.yaml` with new tag

**Example build tag:**
```
metabobapp/metabob-activity-api:dev-0.3.0-2d05e08-12345
```

**No hardcoded vessel list** - fully dynamic based on directory structure.

### Step 5: Deploy via Helmfile

Runs `helmfile -e local sync` from `repos/deployment/helm/`:

**Prerequisites:**
- Kubernetes cluster running (checks `kubectl cluster-info`)
- Istio installed
- Namespace `activity-system` labeled for Istio injection

**What happens:**
- Helmfile deploys all charts with updated image tags
- Pods restart with new containers
- Hook waits for `condition=ready` (120s timeout)
- **Soft failure** - if deployment fails, commit still allowed

**Pod health checks:**
```bash
kubectl wait --for=condition=ready pod \
  -l app.kubernetes.io/name=<vessel> \
  -n activity-system --timeout=120s
```

### Step 6: Commit Deployment Changes

In `repos/deployment/`:
- Stages all changes (synced code, updated tags, values files)
- Creates commit with descriptive message
- Pushes to `origin dev`

**Example commit message:**
```
deploy: sync and deploy from main@2d05e08

Vessels updated:
  - metabob-activity-api
  - minibob

Main workspace commit:
feat: add new impulse resolution endpoint

Auto-deployed via pre-commit hook
```

## Failure Handling

**Soft failures** - commit is always allowed, even if steps fail:
1. Failure logged to `.git/hooks/logs/pre-commit-<timestamp>.log`
2. Marker created: `.git/hooks/LAST_FAILURE`
3. Next commit shows warning banner
4. User can fix manually and re-commit

**When to intervene:**
- Pod not ready within timeout (check logs: `kubectl logs ...`)
- Helmfile deployment failed (review helmfile output)
- Build failed (check Docker build logs)

## Skipped Scenarios

Workflow is skipped when:
- **No vessels changed** - only non-vessel files modified
- **No deployment repo** - `repos/deployment/` not found
- **Git operation in progress** - during rebase, merge, etc.
- **Kubernetes not available** - cluster not reachable

## Logs

All execution logged to:
```
.git/hooks/logs/pre-commit-<timestamp>.log
```

**Check recent logs:**
```bash
ls -lt .git/hooks/logs/ | head -5
tail -100 .git/hooks/logs/pre-commit-<latest>.log
```

## Manual Deployment

If pre-commit fails and you need to deploy manually:

```bash
cd repos/deployment
git checkout dev
git pull origin dev

# Sync changes manually
rsync -av --delete --exclude='node_modules' \
  ../metabob-activity-api/ vessels/metabob-activity-api/

# Build
./scripts/build_changed.sh --dev

# Deploy
cd helm
helmfile -e local sync

# Verify
kubectl get pods -n activity-system
kubectl logs -n activity-system -l app.kubernetes.io/name=metabob-activity-api

# Commit deployment changes
cd ..
git add -A
git commit -m "deploy: manual deployment of metabob-activity-api"
git push origin dev
```

## Registry Concept

**`repos/deployment/vessels/*` is the registry** (source of truth):
- Only vessels present here are considered for deployment
- Not every repo in `repos/*` is a deployable vessel
- To add a new vessel to deployment:
  1. Create `repos/deployment/vessels/<new-vessel>/`
  2. Add Dockerfile
  3. Add Helm chart in `repos/deployment/helm/charts/<new-vessel>/`
  4. Next commit will auto-sync and deploy

**Example structure:**
```
repos/
  deployment/
    vessels/             ← REGISTRY (source of truth)
      metabob-activity-api/
      minibob/
      concept-db/
  metabob-activity-api/  ← Main development workspace
  minibob/               ← Main development workspace
  concept-db/            ← Main development workspace
  terminal/              ← NOT in registry, won't deploy
  react-renderer/        ← NOT in registry, won't deploy
```

## Deprecated Code Cleanup

**Strategy:**
1. When replacing old code, mark it `DEPRECATED` with date
2. Leave it in place for 2 commits (grace period)
3. Pre-commit hook warns after 2 commits
4. Manually remove deprecated code before next commit

**Why 2 commits:**
- Allows rollback if new implementation has issues
- Gives time for integration testing
- Ensures traces collected for both versions

**Example workflow:**
```typescript
// Commit 1: Add new implementation
export function newAuthFlow() { ... }

// Commit 2: Mark old as deprecated
// DEPRECATED: Use newAuthFlow() instead. Remove after 2025-04-01
export function oldAuthFlow() { ... }

// Commit 3: Pre-commit warns "deprecated code from 2+ commits ago"
// Manually remove oldAuthFlow() before committing
```

## Environment Variables

**Required in main workspace:**
```bash
ANTHROPIC_API_KEY="sk-ant-..."
```

**Optional:**
```bash
SURREALDB_USERNAME="root"
SURREALDB_PASSWORD="surrealdb-local-dev-123"
```

**Auto-configured by Helmfile:**
- Image registry: `metabobapp/`
- Namespace: `activity-system`
- Database: `learning_loop`

## Troubleshooting

**Pre-commit hook not running:**
```bash
chmod +x .git/hooks/pre-commit
```

**Deployment repo out of sync:**
```bash
cd repos/deployment
git fetch origin
git reset --hard origin/dev
```

**Kubernetes cluster issues:**
```bash
kubectl cluster-info
kubectl get nodes
istioctl version
```

**View failure details:**
```bash
cat .git/hooks/LAST_FAILURE
tail -200 .git/hooks/logs/pre-commit-*.log
```

**Force rebuild all vessels:**
```bash
cd repos/deployment
./scripts/build_changed.sh --dev --force
```

## Best Practices

1. **Commit working states** - Ensure feature works in cluster before committing
2. **Review logs** - Check `.git/hooks/logs/` after first commit of the day
3. **Clean deprecated code** - Don't let it accumulate beyond 2 commits
4. **Monitor pod health** - If deployment slow, check pod status
5. **Keep registry minimal** - Only add vessels that truly need deployment
6. **Use descriptive commit messages** - They appear in deployment repo

## Related Documentation

- `CLAUDE.md` - Main project instructions and architecture
- `docs/architecture/IMPULSE_ACTIVITY_FOUNDATION.md` - Core system model
- `repos/deployment/README.md` - Deployment repository structure
