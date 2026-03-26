# Production Deployment Guide - DevBob v1.0.64

## Current Status
- **Image**: `metabobapp/devbob:v1.0.64` pushed to Docker Hub ✅
- **Branch**: `feat/replace-devbob-chart` in `repos/platform/metabob-apps` ✅
- **Local Testing**: 100% working with production config ✅
- **Production**: Deployment attempted (revision 6) but not verified ❌

## What Changed
### 1. Chart Replacement
Replaced broken production chart with working local `devbob` chart, merging best features:
- **From Local**: Full env vars, health probes, PVC support, git credentials, Istio
- **From Platform**: ConfigMap-based config, ServiceAccount, init container

### 2. Permission Fixes
Fixed Bun execution permission issue (Exit Code 126):
```dockerfile
# Make Bun executable by all users
RUN chmod +x /root/.bun/bin/bun && \
    ln -s /root/.bun/bin/bun /usr/local/bin/bun && \
    chmod 755 /root/.bun/bin/bun

# Make OpenCode binary executable
RUN chmod 755 /opt/opencode/bin/opencode
```

### 3. Version Update
Updated production from v1.0.0 → v1.0.64 (64 versions!)

## Prerequisites
1. **kubectl access** to `metabob-production` cluster
2. **Helm 3** installed
3. **Production secrets** file: `production.devbob.secrets.yaml`

## Deployment Steps

### Step 1: Verify Cluster Access
```bash
# Switch to production context
kubectl config use-context metabob-production

# Verify connectivity
kubectl get nodes
kubectl get pods -n metabob
```

### Step 2: Check Current Deployment Status
```bash
# Check if deployment already completed from previous attempt
kubectl get pods -n metabob -l app.kubernetes.io/name=devbob

# Check helm releases
helm list -n metabob -a

# If pod is running, check logs
kubectl logs deployment/opencode-server-devbob -n metabob -c devbob --tail=100

# Check for permission errors
kubectl logs deployment/opencode-server-devbob -n metabob -c devbob | grep -i "permission denied"
```

### Step 3: Deploy/Upgrade (if needed)
```bash
cd repos/platform/metabob-apps

# Option A: If revision 6 didn't complete
helm upgrade opencode-server charts/devbob/charts \
  -f charts/devbob/values/production.devbob.values.yaml \
  -f charts/devbob/values/production.devbob.secrets.yaml \
  -n metabob \
  --atomic \
  --timeout 10m

# Option B: If you need to rollback first
helm rollback opencode-server 5 -n metabob
# Then run Option A
```

### Step 4: Verify Deployment
```bash
# Check pod status (should be Running 2/2 with istio-proxy)
kubectl get pods -n metabob -l app.kubernetes.io/name=devbob

# Verify version
kubectl get deployment opencode-server-devbob -n metabob -o jsonpath='{.spec.template.spec.containers[0].image}'
# Should output: metabobapp/devbob:v1.0.64

# Check restart count (should be 0)
kubectl get pods -n metabob -l app.kubernetes.io/name=devbob -o wide

# Check logs for errors
kubectl logs deployment/opencode-server-devbob -n metabob -c devbob --tail=200
```

### Step 5: Verify Configuration
```bash
# Check ConfigMap was created
kubectl get configmap opencode-config -n metabob

# Verify ConfigMap content
kubectl get configmap opencode-config -n metabob -o yaml

# Check ServiceAccount
kubectl get serviceaccount opencode-server-devbob -n metabob

# Verify no permission errors
kubectl logs deployment/opencode-server-devbob -n metabob -c devbob | grep -E "permission denied|Exit Code 126"
```

## Success Criteria
- [ ] **Pod Status**: Running 2/2 (devbob + istio-proxy)
- [ ] **Restart Count**: 0 (no more CrashLoopBackOff)
- [ ] **Image Version**: v1.0.64
- [ ] **Logs**: No "permission denied" or "Exit Code 126" errors
- [ ] **Bootstrap**: "loaded bootstrap templates" in logs
- [ ] **Metabob Integration**: Connecting to metabob-rpc-api
- [ ] **Health**: Pod stays running for 5+ minutes

## Expected Log Output
```
INFO service=plugin loading plugins
INFO service=bun installing packages
INFO service=template-library initializing bootstrap templates via MCP
INFO service=bootstrap-templates count=6 loaded bootstrap templates
INFO service=mcp key=metabob type=remote found
INFO service=template-service-client registering templates with Metabob
```

## Troubleshooting

### If Pod Still CrashLooping
```bash
# Check events
kubectl describe pod -n metabob -l app.kubernetes.io/name=devbob

# Check init container logs
kubectl logs -n metabob -l app.kubernetes.io/name=devbob -c setup-config

# Check main container logs
kubectl logs -n metabob -l app.kubernetes.io/name=devbob -c devbob --previous
```

### If Permission Errors Persist
1. Verify image is `v1.0.64` (not v1.0.0)
2. Check Bun binary permissions in running container:
   ```bash
   kubectl exec -n metabob deployment/opencode-server-devbob -c devbob -- ls -la /usr/local/bin/bun
   kubectl exec -n metabob deployment/opencode-server-devbob -c devbob -- ls -la /root/.bun/bin/bun
   ```

### If Metabob Integration Not Working
1. Check metabob-rpc-api service is running:
   ```bash
   kubectl get svc -n metabob metabob-rpc-api
   kubectl get pods -n metabob -l app=metabob-rpc-api
   ```
2. Verify network connectivity:
   ```bash
   kubectl exec -n metabob deployment/opencode-server-devbob -c devbob -- curl http://metabob-rpc-api:8080/health
   ```

### If Health Probes Fail
Health probes are currently disabled due to `:health` endpoint making external API calls that timeout. To re-enable:
1. Create `/healthz` endpoint without external dependencies
2. Update `charts/devbob/values/production.devbob.values.yaml`:
   ```yaml
   livenessProbe:
     enabled: true
     httpGet:
       path: /healthz  # Not :health
   ```

## Rollback Plan
If deployment fails critically:
```bash
# Rollback to previous version
helm rollback opencode-server -n metabob

# Or to specific revision
helm history opencode-server -n metabob
helm rollback opencode-server <revision> -n metabob
```

## Post-Deployment Tasks

### 1. Monitor Production
```bash
# Watch pod for 10 minutes
watch -n 10 'kubectl get pods -n metabob -l app.kubernetes.io/name=devbob'

# Monitor logs
kubectl logs -n metabob deployment/opencode-server-devbob -c devbob -f
```

### 2. Test End-to-End
- **Slack Bot**: Test activity execution via Slack
- **Direct API**: Test ACP delegation if exposed
- **Metabob Integration**: Verify template registration

### 3. Merge Platform Changes
```bash
cd repos/platform/metabob-apps
git add charts/devbob/values/local-prod.devbob.values.yaml
git commit -m "docs: Add local-prod values for testing production config"
git push origin feat/replace-devbob-chart
```

### 4. Create PR
- **Title**: "Replace broken opencode-server chart with working devbob chart"
- **Description**: Include summary of fixes (Bun permissions, chart merge, v1.0.64)
- **Testing**: Link to this deployment guide
- **Breaking Changes**: None (ConfigMap feature is backward compatible)

## Configuration Details

### Image
```yaml
image:
  repository: metabobapp/devbob
  tag: "v1.0.64"
  pullPolicy: IfNotPresent
```

### Resources
```yaml
resources:
  requests:
    memory: "2Gi"
    cpu: "1000m"
  limits:
    memory: "4Gi"
    cpu: "2000m"
```

### Persistence
```yaml
persistence:
  enabled: false  # Using emptyDir (stateless pods)
```

### Metabob Integration
```yaml
opencode:
  useConfigMap: true
  config:
    metabob:
      enabled: true
      api_key: "${METABOB_API_KEY}"
      template_auto_registration:
        enabled: true
        on_activity_complete: true
    mcp:
      metabob:
        type: "remote"
        url: "http://metabob-rpc-api:8080"
        enabled: true
```

## Known Issues
1. **Health Probes Disabled**: `:health` endpoint makes external API calls causing timeouts
2. **kubectl Timeout**: Production cluster had connectivity issues (reason for this guide)

## Files Changed
- `repos/platform/metabob-apps/charts/devbob/charts/` - Replaced entire chart
- `repos/platform/metabob-apps/charts/devbob/values/production.devbob.values.yaml` - Updated to v1.0.64
- `repos/platform/metabob-apps/charts/devbob/values/default.devbob.values.yaml` - Disabled health probes
- `Dockerfile.devbob-local` - Fixed Bun and OpenCode permissions

## Commits
- `216cbb7` - Fix Bun and OpenCode binary permissions in Dockerfile
- `c27292b` - Replace chart with working local version
- `ccbb20f` - Disable health probes temporarily

## Contact
If deployment fails or questions arise, check:
- Docker Hub: https://hub.docker.com/r/metabobapp/devbob/tags
- Image manifest: `docker manifest inspect metabobapp/devbob:v1.0.64`
- Local testing: Use `local-prod.devbob.values.yaml` to reproduce production config
