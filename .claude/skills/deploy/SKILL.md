# Deploy Vessel

Deploy a vessel — either to the local single-container substrate (fast iteration) or to canary/production via Helm.

## Overview

Two deployment targets:

1. **Local substrate** (`--substrate`, Phase 26+) — restart a vessel inside the running container. No Docker build, no Helm. Use this for development iterations.
2. **Canary / production** (default) — full Docker build → push → helmfile sync. Use this after local validation to promote changes.

## Input

**Required**: Vessel name - one of:

*Helm-managed (canary/production):*
- `metabob-activity-api`
- `metabob-analysis-api`
- `metabob-cloud-dashboard`
- `metabob-internal-dashboard`
- `minibob`
- `discovery-vessel`
- `identity-vessel`
- `user-vessel`
- `concept-db`

*Substrate-only (local container, not Helm-managed):*
- `development-vessel`

**Optional**:
- Version (e.g., `1.8.1`) - If not specified, deploys the latest from origin/dev
- `--substrate` - Restart the vessel inside the local container instead of deploying to Helm
- `--dry-run` - Show what would be deployed without making changes

## Local Substrate Deployment (Phase 26+)

Use this path when iterating locally against `http://localhost:8080`.

```bash
# Restart a single vessel in the running substrate container
make -C scripts/substrate substrate-restart-<vessel-name>

# Check unit status
make -C scripts/substrate substrate-status

# View vessel logs
make -C scripts/substrate substrate-logs-<vessel-name>
```

**When to use:**
- After editing vessel source in `repos/<vessel-name>/`
- For any vessel including `development-vessel` (which has no Helm chart)
- When `~/.metabob/config.json` points to `http://localhost:8080`

**Validate after restart:**
```bash
curl http://localhost:8080/health
bun run validation/scripts/failure-mode-harness.ts
```

After local validation passes, proceed with the canary deploy below to promote the change.

## Deployment Procedure

Execute these steps **exactly in order**, one at a time:

### Step 0: Pull Latest from Vessel Repository

The vessel code lives in a **git submodule** at `repos/deployment/vessels/<vessel-name>`. First, pull the latest from the actual vessel source repo (e.g., `repos/<vessel-name>`):

```bash
cd /home/avi/documents/work/exp-repo/metabob-devbob/repos/<vessel-name>
git fetch origin
git checkout origin/main  # or origin/dev depending on vessel
git rev-parse --short=7 HEAD
git show HEAD:package.json | jq -r '.version'
```

**Expected output**: 7-character SHA and version number
**Record**: `VERSION` and `SHA` for next steps

### Step 1: Sync Submodule in Deployment Repo

Update the deployment repository's submodule pointer to match the vessel version you just fetched:

```bash
cd /home/avi/documents/work/exp-repo/metabob-devbob/repos/deployment
git checkout dev
git submodule update --remote -- vessels/<vessel-name>
git add vessels/<vessel-name>
git diff --cached vessels/<vessel-name>  # Verify the SHA matches
```

**Expected output**: Submodule pointer updated to new SHA
**Note**: Don't commit yet - this is just to sync the deployment repo's pointer

### Step 2: Verify Version Matches

Confirm the version from Step 0 is what you want:

```bash
cd /home/avi/documents/work/exp-repo/metabob-devbob/repos/deployment/vessels/<vessel-name>
git rev-parse --short=7 HEAD  # Should match SHA from Step 0
cat package.json | jq -r '.version'  # Should match VERSION from Step 0
```

### Step 3: Update production.values.yaml

Edit `/home/avi/documents/work/exp-repo/metabob-devbob/repos/deployment/environments/production.values.yaml`:

Find the vessel's image tag section:
```yaml
<vessel-name>:
  replicaCount: N
  image:
    tag: "<old-version>-<old-sha>" # old comment
```

Replace with:
```yaml
<vessel-name>:
  replicaCount: N
  image:
    tag: "<VERSION>-<SHA>" # <brief description from commit>
```

### Step 4: Build Docker Image

The build context and Dockerfile location depend on the vessel's structure:

#### For Single-Service Vessels (discovery-vessel, concept-db, identity-vessel, user-vessel)

```bash
cd /home/avi/documents/work/exp-repo/metabob-devbob/repos/deployment/vessels/<vessel-name>
docker build -t metabobapp/<docker-image-name>:<VERSION>-<SHA> \
  --build-arg BUILD_SHA=<SHA> \
  --build-arg BUILD_VERSION=<VERSION> \
  .
```

**Example:**
```bash
cd /home/avi/documents/work/exp-repo/metabob-devbob/repos/deployment/vessels/discovery-vessel
docker build -t metabobapp/discovery-vessel:0.4.0-bb57b02 \
  --build-arg BUILD_SHA=bb57b02 \
  --build-arg BUILD_VERSION=0.4.0 \
  .
```

#### For Multi-Service Vessels (metabob-activity-api, minibob, dashboards)

```bash
cd /home/avi/documents/work/exp-repo/metabob-devbob/repos/deployment/vessels
docker build -t metabobapp/<docker-image-name>:<VERSION>-<SHA> \
  -f <vessel-name>/Dockerfile \
  --build-arg BUILD_SHA=<SHA> \
  --build-arg BUILD_VERSION=<VERSION> \
  .
```

**Example:**
```bash
cd /home/avi/documents/work/exp-repo/metabob-devbob/repos/deployment/vessels
docker build -t metabobapp/metabob-activity-api:1.10.0-e6641e1 \
  -f metabob-activity-api/Dockerfile \
  --build-arg BUILD_SHA=e6641e1 \
  --build-arg BUILD_VERSION=1.10.0 \
  .
```

**Docker image naming**:
| Vessel | Docker Image Name | Build Type |
|--------|-------------------|-----------|
| metabob-activity-api | metabob-activity-api | Multi-service |
| metabob-analysis-api | metabob-analysis-api | Multi-service |
| metabob-cloud-dashboard | metabob-cloud-dashboard | Multi-service |
| metabob-internal-dashboard | metabob-internal-dashboard | Multi-service |
| minibob | minibob | Multi-service |
| discovery-vessel | discovery-vessel | Single-service |
| identity-vessel | identity-vessel | Single-service |
| user-vessel | user-vessel | Single-service |
| concept-db | concept-db | Single-service |

**If build fails**: 
- Check Dockerfile exists at expected path
- Verify build context includes required files
- Check Dockerfile for `COPY` statements that reference parent dependencies
- Run with `--progress=plain` to see detailed build steps

### Step 5: Push Docker Image

```bash
docker push metabobapp/<docker-image-name>:<VERSION>-<SHA>
```

**If push fails with auth error**: Check Docker Hub login
**If push fails with "repository does not exist"**: Verify image name matches registry

### Step 6: Deploy with Helmfile (Recommended for Production)

Using helmfile ensures consistent configuration across canary and production with environment-specific overrides:

#### Deploy to Canary First

```bash
cd /home/avi/documents/work/exp-repo/metabob-devbob/repos/deployment
helmfile --environment canary -l name=<vessel-name> sync
```

**Expected output**: "Release "<vessel-name>" has been upgraded. Happy Helming!"
**If helm fails with "pending" release**: Run `helm rollback <vessel-name> 0 -n activity-system`
**If helm fails with other error**: Read error, diagnose, fix

**Wait for pods to be ready:**
```bash
kubectl wait --for=condition=ready pod -n activity-system -l app.kubernetes.io/name=<vessel-name> --timeout=120s
```

#### Deploy to Production

After validating in canary:

```bash
helmfile --environment production -l name=<vessel-name> sync
```

**Monitor pod rollout:**
```bash
kubectl rollout status deployment <vessel-name> -n activity-system --timeout=120s
```

#### Deploy Multiple Vessels Together

For breaking changes affecting multiple vessels (must deploy together):

```bash
# Update all image tags in environments/production.values.yaml first
helmfile --environment canary -l 'name in (discovery-vessel, concept-db, metabob-activity-api)' sync
# Wait for canary validation...
helmfile --environment production -l 'name in (discovery-vessel, concept-db, metabob-activity-api)' sync
```

#### Alternative: Direct Helm (Single Vessel)

If you prefer direct helm instead of helmfile:

```bash
helm upgrade <vessel-name> vessels/<vessel-name>/helm/<vessel-name> \
  --namespace activity-system \
  --set image.repository=metabobapp/<docker-image-name> \
  --set image.tag=<VERSION>-<SHA> \
  --set image.pullPolicy=Always \
  --reuse-values \
  --wait --timeout 300s
```

### Step 7: Verify Health

```bash
sleep 5
curl -s https://<health-endpoint>/health | jq '{version,status}'
```

**Health endpoints**:
| Vessel | Health Endpoint |
|--------|-----------------|
| metabob-activity-api | https://activity.metabob.com |
| metabob-analysis-api | https://api.metabob.com |
| identity-vessel | https://identity.metabob.com |
| discovery-vessel | https://discovery.metabob.com |
| metabob-cloud-dashboard | https://app.metabob.com |
| minibob | (check pods directly) |

**Expected output**: `{"version": "<VERSION>", "status": "healthy"}`
**If unhealthy**: Check pod logs with `kubectl logs -n activity-system -l app.kubernetes.io/name=<vessel-name>`

### Step 8: Commit and Push

```bash
git add vessels/<vessel-name> environments/production.values.yaml
git commit --no-verify -m "chore(deploy): update <vessel-name> to <VERSION>-<SHA>

<brief description from commit message>

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"

git stash
git pull --rebase origin dev
git stash pop 2>/dev/null
git push origin dev
```

**If push fails**: Pull, rebase, and push again
**If merge conflicts**: Resolve conflicts in non-production files with `git checkout --ours`

### Step 9: Report Completion

Output a summary table:
```
**Deployment Complete: <vessel-name> <VERSION>-<SHA>** ✅

| Step | Status |
|------|--------|
| Submodule sync | ✅ <SHA> |
| Docker build/push | ✅ metabobapp/<image>:<VERSION>-<SHA> |
| Helm deploy | ✅ Revision <N> |
| Health check | ✅ Version <VERSION>, healthy |
| Git push | ✅ <commit-sha> |
```

## Error Handling

### Helm Pending Release
```bash
helm rollback <vessel-name> 0 -n activity-system
# Then retry Step 6
```

### Docker Build Failure
- Check Dockerfile exists at `vessels/<vessel-name>/Dockerfile`
- Verify build context includes required files
- Check for syntax errors in Dockerfile

### Health Check Failure
```bash
# Check pod status
kubectl get pods -n activity-system -l app.kubernetes.io/name=<vessel-name>

# Check logs
kubectl logs -n activity-system -l app.kubernetes.io/name=<vessel-name> --tail=100

# Describe pod for events
kubectl describe pod -n activity-system -l app.kubernetes.io/name=<vessel-name>
```

### Git Push Rejection
```bash
git stash
git pull --rebase origin dev
git stash pop 2>/dev/null
git push origin dev
```

## Example Invocations

```bash
# Deploy latest metabob-activity-api
/deploy metabob-activity-api

# Deploy specific version
/deploy metabob-activity-api 1.8.1

# Deploy minibob
/deploy minibob

# Dry run
/deploy metabob-activity-api --dry-run
```

## Important Notes

1. **Vessel Submodules** - Each vessel in `repos/deployment/vessels/<vessel-name>` is a git submodule. Always pull from the source repo (`repos/<vessel-name>`) first, then sync the submodule in the deployment repo.

2. **Single vs. Multi-Vessel Deployments**
   - **Single vessel**: Follow steps 0-9 one vessel at a time
   - **Multiple vessels (breaking changes)**: Update all image tags, build all images, then deploy all together using helmfile with multiple `-l name in (...)` selectors

3. **Helmfile vs. Direct Helm**
   - **Helmfile** (recommended): Manages canary and production environments with separate value overrides
   - **Direct helm**: For single vessel deployments or when helmfile is unavailable

4. **Environment Deployment Order**
   - Always deploy to **canary first** (test environment)
   - Wait for pods to be ready and health checks to pass
   - Then deploy to **production** (uses same namespace but separate pod replicas)

5. **Breaking Changes** - When deploying breaking changes (auth, API contracts, schema):
   - Investigate impact across all dependent services with subagents
   - Update Helm charts/values with config fixes upfront
   - Build all affected images
   - Deploy all together to canary, validate, then production

6. **Working Directory** - Always execute from `/home/avi/documents/work/exp-repo/metabob-devbob/repos/deployment` for helmfile and docker build commands

7. **Image Registry** - All images go to `metabobapp/` on Docker Hub

8. **Kubernetes Namespace** - All deployments go to `activity-system` namespace

9. **Commit Strategy** - Commit deployment changes only after successful canary validation:
   ```bash
   git add charts/<vessel-name> environments/production*.values.yaml
   git commit -m "chore(deploy): update <vessel-name> to <VERSION>-<SHA>
   
   <description of breaking changes or features>"
   ```
