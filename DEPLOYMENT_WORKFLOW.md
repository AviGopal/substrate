# DevBob Deployment Workflow

## The Simple Way (How It Should Be)

```bash
# 1. Make code changes
vim docker/Dockerfile.devbob
vim repos/metabob-opencode/...

# 2. Build and tag new version
docker build -f docker/Dockerfile.devbob -t metabobapp/devbob:v1.0.2 .
docker push metabobapp/devbob:v1.0.2

# 3. Update version in Helmfile values
vim repos/platform/metabob-apps/charts/opencode-server/values/production.opencode-server.values.yaml
# Change: tag: "v1.0.1" → tag: "v1.0.2"

# 4. Deploy
cd repos/platform/metabob-apps
helmfile -e production apply

# That's it!
```

## What We Had Wrong

❌ `deploy-v1.0.0.sh` - Unnecessary script  
❌ `push-and-deploy-v1.0.0.sh` - Unnecessary script  
❌ `push-and-helmfile-deploy-v1.0.0.sh` - Unnecessary script  
❌ `helmfile-deploy-v1.0.0.sh` - Unnecessary script  
❌ Manual `kubectl` commands - Bypasses Helmfile  

## What We Need

✅ Helmfile in `repos/platform/metabob-apps/` (already exists)  
✅ Values in `charts/opencode-server/values/production.opencode-server.values.yaml`  
✅ That's it!

## Production Deployment

### Full Deployment (All Services)
```bash
cd repos/platform/metabob-apps
helmfile -e production apply
```

### Single Service Deployment
```bash
cd repos/platform/metabob-apps
helmfile -e production apply --selector name=opencode-server
```

### Preview Changes
```bash
cd repos/platform/metabob-apps
helmfile -e production diff --selector name=opencode-server
```

## Version Management

### Semantic Versioning
- **Major** (v2.0.0): Breaking changes
- **Minor** (v1.1.0): New features, backwards compatible
- **Patch** (v1.0.1): Bug fixes, backwards compatible

### Where Versions Live
1. **Docker image tag**: `metabobapp/devbob:v1.0.1`
2. **Helm chart version**: `charts/opencode-server/charts/Chart.yaml` → `version: 1.0.1`
3. **Helm values**: `charts/opencode-server/values/production.opencode-server.values.yaml` → `tag: "v1.0.1"`

### Keeping Versions in Sync

```bash
# After building new Docker image v1.0.2:

# 1. Update Helm chart version
vim repos/platform/metabob-apps/charts/opencode-server/charts/Chart.yaml
# version: 1.0.2
# appVersion: "1.0.2"

# 2. Update values file
vim repos/platform/metabob-apps/charts/opencode-server/values/production.opencode-server.values.yaml
# tag: "v1.0.2"

# 3. Deploy
cd repos/platform/metabob-apps
helmfile -e production apply --selector name=opencode-server
```

## Environment-Specific Deployments

### Production
```bash
helmfile -e production apply
```

### Integration (if configured)
```bash
helmfile -e integration apply
```

### Default/Local (if configured)
```bash
helmfile -e default apply
```

## Common Tasks

### Check What Will Change
```bash
helmfile -e production diff
```

### See What's Currently Deployed
```bash
helmfile -e production list
```

### Sync (Deploy Only If Needed)
```bash
helmfile -e production sync
```

### Destroy/Rollback a Service
```bash
# Rollback to previous Helm release
helm rollback opencode-server -n metabob

# Or update values to previous version and apply
```

## Configuration Changes

Configuration is now in Helmfile values - NO image rebuild needed!

```bash
# 1. Edit config
vim repos/platform/metabob-apps/charts/opencode-server/values/production.opencode-server.values.yaml

# Example: Increase memory budget
opencode:
  config:
    sessionMemory:
      budgets:
        perImpulse: 3000  # Changed

# 2. Apply
cd repos/platform/metabob-apps
helmfile -e production apply --selector name=opencode-server

# 3. Restart pods (if config doesn't auto-reload)
kubectl rollout restart deployment/opencode-server -n metabob
```

## Cleanup Old Scripts

These can be deleted:
- `deploy-*.sh`
- `push-and-*.sh`
- `helmfile-deploy-*.sh`

Keep these for documentation:
- `VERSION.md` - Version history
- `DEPLOYMENT_WORKFLOW.md` - This file
- `HELMFILE_CONFIG_MANAGEMENT.md` - Config guide

## Troubleshooting

### Image Not Found
```bash
# Check image exists in registry
docker manifest inspect metabobapp/devbob:v1.0.1

# Push if missing
docker push metabobapp/devbob:v1.0.1
```

### Helmfile Errors
```bash
# Validate syntax
cd repos/platform/metabob-apps
helmfile -e production lint

# Check specific chart
helm lint charts/opencode-server/charts \
  -f charts/opencode-server/values/production.opencode-server.values.yaml
```

### Pod Not Starting
```bash
# Check pod status
kubectl get pods -n metabob -l app.kubernetes.io/name=opencode-server

# Check logs
kubectl logs -n metabob -l app.kubernetes.io/name=opencode-server --tail=50

# Describe pod
kubectl describe pod -n metabob -l app.kubernetes.io/name=opencode-server
```

## Best Practices

✅ **Always preview** with `helmfile diff` before applying  
✅ **Version everything** - Git commit with version number  
✅ **Tag Docker images** with semantic versions  
✅ **Keep versions in sync** - Chart, values, and Docker tag  
✅ **Use Helmfile selectors** to deploy single services  
✅ **Test in integration** before production (if environment exists)  
✅ **Document breaking changes** in VERSION.md  

❌ Don't use `kubectl apply` directly - use Helmfile  
❌ Don't create version-specific scripts - Helmfile handles it  
❌ Don't hardcode versions in scripts - keep in values files  
❌ Don't skip the diff step - always preview changes  

## The Golden Path

```bash
# Complete workflow for a bug fix:

# 1. Fix code
vim docker/Dockerfile.devbob

# 2. Build new version (patch bump)
docker build -f docker/Dockerfile.devbob -t metabobapp/devbob:v1.0.2 .
docker push metabobapp/devbob:v1.0.2

# 3. Update versions
vim repos/platform/metabob-apps/charts/opencode-server/charts/Chart.yaml
# version: 1.0.2, appVersion: "1.0.2"

vim repos/platform/metabob-apps/charts/opencode-server/values/production.opencode-server.values.yaml  
# tag: "v1.0.2"

# 4. Preview and deploy
cd repos/platform/metabob-apps
helmfile -e production diff --selector name=opencode-server
helmfile -e production apply --selector name=opencode-server

# 5. Verify
kubectl get pods -n metabob -l app.kubernetes.io/name=opencode-server
kubectl logs -n metabob -l app.kubernetes.io/name=opencode-server --tail=30

# Done! 🎉
```
