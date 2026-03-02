# Next Actions: Chart Deployment & Testing

**Status**: ✅ Chart Replacement Complete  
**Branch**: `feat/replace-devbob-chart`  
**Commit**: `c27292b`

---

## What Was Accomplished

✅ **Replaced** platform devbob chart with working local version  
✅ **Merged** ConfigMap and ServiceAccount features from platform  
✅ **Updated** production image tag to v1.0.64  
✅ **Added** configurable persistence (PVC/emptyDir)  
✅ **Added** health probes, git credentials, comprehensive config  
✅ **Committed** all changes to `feat/replace-devbob-chart` branch

---

## Immediate Next Steps (Priority Order)

### 1. Fix Dockerfile Permissions [15 min] - **CRITICAL**
Before deploying to production, fix the permission error in the Dockerfile.

```bash
# Edit Dockerfile.devbob-local
nano Dockerfile.devbob-local

# Add after line 44 (Bun installation):
RUN chmod +x /root/.bun/bin/bun && \
    ln -s /root/.bun/bin/bun /usr/local/bin/bun && \
    chmod 755 /root/.bun/bin/bun

# Add after line 41 (OpenCode binary):
RUN chmod 755 /opt/opencode/bin/opencode
```

### 2. Build & Push v1.0.64 Image [30 min] - **CRITICAL**
Production needs the new image with permission fixes.

```bash
# Build OpenCode binary
cd repos/metabob-opencode/packages/opencode
bun install
bun run build

# Build Docker image
cd /home/avi/documents/work/exp-repo/metabob-devbob
docker build -f Dockerfile.devbob-local -t metabobapp/devbob:v1.0.64 .

# Test locally with non-root user (simulates production)
docker run --rm --user 1000:1000 metabobapp/devbob:v1.0.64 opencode --version
# Should output: 1.0.64 (not permission error!)

# Push to registry
docker login
docker push metabobapp/devbob:v1.0.64
docker tag metabobapp/devbob:v1.0.64 metabobapp/devbob:latest
docker push metabobapp/devbob:latest
```

### 3. Test Locally First [15 min] - **HIGH PRIORITY**
Validate the new chart works before deploying to production.

```bash
cd repos/platform/metabob-apps

# Preview changes
helmfile -e default diff

# Deploy to local cluster
helmfile -e default sync

# Verify deployment
kubectl get pods -n metabob -l app.kubernetes.io/name=devbob
kubectl logs -f deployment/devbob -n metabob

# Test health endpoint
kubectl exec deployment/devbob -n metabob -- curl -s http://localhost:8080/health
```

### 4. Deploy to Production [15 min] - **HIGH PRIORITY**
Once image is pushed and local testing passes.

```bash
# Switch to production context
kubectl config use-context metabob-production

# Preview changes (IMPORTANT - review carefully)
helmfile -e production diff --selector name=devbob

# Deploy
helmfile -e production apply --selector name=devbob

# Monitor rollout
kubectl rollout status deployment/opencode-server -n metabob

# Watch logs
kubectl logs -f deployment/opencode-server -n metabob -c devbob
```

### 5. Verify Production [15 min] - **CRITICAL**
Confirm production is healthy after deployment.

```bash
# Check pod status
kubectl get pods -n metabob -l app.kubernetes.io/name=opencode-server

# Should show:
# NAME                              READY   STATUS    RESTARTS   AGE
# opencode-server-xxxxxxxxx-xxxxx   2/2     Running   0          5m

# Verify version
kubectl exec deployment/opencode-server -n metabob -c devbob -- opencode --version
# Should output: 1.0.64

# Check health
kubectl exec deployment/opencode-server -n metabob -c devbob -- \
  curl -s http://localhost:8080/health

# Verify restart count is 0
kubectl get pod -n metabob -l app.kubernetes.io/name=opencode-server \
  -o jsonpath='{.items[0].status.containerStatuses[?(@.name=="devbob")].restartCount}'
```

---

## Additional Actions (After Production Deploy)

### 6. Push Platform Repo Changes [10 min]
```bash
cd repos/platform/metabob-apps

# Push feature branch
git push origin feat/replace-devbob-chart

# Create PR (if needed)
# GitHub UI or gh cli
```

### 7. Update Local Helm Chart [10 min]
Sync improvements back to local chart for consistency.

```bash
# Copy merged templates back to local
cp -r repos/platform/metabob-apps/charts/devbob/charts/templates/configmap.yaml \
  helm/charts/devbob/templates/

cp -r repos/platform/metabob-apps/charts/devbob/charts/templates/serviceaccount.yaml \
  helm/charts/devbob/templates/

# Update local values to match structure
# (Already mostly aligned)
```

### 8. Check RPC API Compatibility [30 min]
Verify RPC API has SurrealDB official library.

```bash
kubectl config use-context metabob-production

# Check RPC API version
kubectl get deployment metabob-rpc-api -n metabob -o jsonpath='{.spec.template.spec.containers[0].image}'

# Check logs for SurrealDB library
kubectl logs deployment/metabob-rpc-api -n metabob | grep -i surreal

# Test endpoints
kubectl exec deployment/opencode-server -n metabob -c devbob -- \
  curl -s http://metabob-rpc-api:8080/activity-recommendations/health
```

### 9. Test End-to-End Flow [30 min]
Verify full system integration.

```bash
# From local machine or jump host
# 1. Trigger activity via Slack bot (if available)
# 2. Or trigger activity via API:

curl -X POST http://opencode-server:8080/activities \
  -H "Content-Type: application/json" \
  -d '{
    "templateId": "add-feature-complete",
    "variables": {
      "featureName": "test feature",
      "files": ["test.ts"]
    }
  }'

# 3. Monitor logs
kubectl logs -f deployment/opencode-server -n metabob -c devbob

# 4. Verify activity completes
# 5. Check SurrealDB for activity record
```

---

## Troubleshooting Guide

### Issue: Image Pull Fails
```bash
# Check if image exists
docker pull metabobapp/devbob:v1.0.64

# Check imagePullSecrets
kubectl get secret -n metabob | grep docker

# If needed, create pull secret
kubectl create secret docker-registry regcred \
  --docker-server=https://index.docker.io/v1/ \
  --docker-username=<username> \
  --docker-password=<password> \
  -n metabob
```

### Issue: Permission Denied Error Persists
```bash
# Check Dockerfile has fixes
grep "chmod.*bun" Dockerfile.devbob-local

# Rebuild image with --no-cache
docker build --no-cache -f Dockerfile.devbob-local -t metabobapp/devbob:v1.0.64 .

# Test with non-root user again
docker run --rm --user 1000 metabobapp/devbob:v1.0.64 opencode --version
```

### Issue: ConfigMap Not Created
```bash
# Check if useConfigMap is enabled
helm get values opencode-server -n metabob | grep useConfigMap

# Manually create if needed
kubectl create configmap devbob-config -n metabob \
  --from-file=opencode.json=path/to/opencode.json
```

### Issue: Health Probes Fail
```bash
# Check endpoint manually
kubectl exec deployment/opencode-server -n metabob -c devbob -- \
  curl -v http://localhost:8080/health

# Disable probes temporarily if needed
# Edit production.devbob.values.yaml:
# livenessProbe:
#   enabled: false
```

---

## Success Criteria

### Immediate (15 min)
- [ ] Local deployment succeeds
- [ ] Pod reaches Running state
- [ ] Logs show no errors
- [ ] Health check returns 200 OK

### Production (1 hour)
- [ ] Image pushed successfully
- [ ] Production deployment succeeds
- [ ] Pod running without restarts
- [ ] No permission errors
- [ ] Activity execution works
- [ ] Slack bot integration works

### Long-term (24 hours)
- [ ] Zero crashes
- [ ] Normal activity volume
- [ ] Performance stable
- [ ] No new error patterns

---

## Rollback Plan

If deployment fails:

```bash
# Option 1: Helm rollback
helm rollback opencode-server -n metabob

# Option 2: Scale to 0 and back
kubectl scale deployment/opencode-server --replicas=0 -n metabob
kubectl scale deployment/opencode-server --replicas=1 -n metabob

# Option 3: Revert git and redeploy
cd repos/platform/metabob-apps
git checkout feat/add-redis-to-dev-storage
helmfile -e production apply --selector name=devbob
```

---

## Files to Review

**Created**:
- `CHART_REPLACEMENT_SUMMARY.md` - Detailed summary of changes
- `NEXT_ACTIONS_CHART_DEPLOYMENT.md` - This file (action items)
- `PRODUCTION_DEPLOYMENT_ANALYSIS.md` - Full production analysis
- `PRODUCTION_FIX_QUICKSTART.md` - Emergency fix guide
- `DEPLOYMENT_COMPARISON_EXECUTIVE_SUMMARY.md` - High-level overview

**Modified in `repos/platform/metabob-apps`**:
- `charts/devbob/charts/` - Replaced with local chart
- `charts/devbob/values/production.devbob.values.yaml` - Updated to v1.0.64
- `charts/devbob/values/default.devbob.values.yaml` - Updated structure

---

## Quick Reference Commands

```bash
# Build image
cd repos/metabob-opencode/packages/opencode && bun run build
cd ../../../ && docker build -f Dockerfile.devbob-local -t metabobapp/devbob:v1.0.64 .

# Test image
docker run --rm --user 1000 metabobapp/devbob:v1.0.64 opencode --version

# Push image
docker push metabobapp/devbob:v1.0.64

# Deploy local
cd repos/platform/metabob-apps && helmfile -e default sync

# Deploy production
kubectl config use-context metabob-production
cd repos/platform/metabob-apps && helmfile -e production apply --selector name=devbob

# Check status
kubectl get pods -n metabob -l app.kubernetes.io/name=opencode-server
kubectl logs -f deployment/opencode-server -n metabob -c devbob
```

---

**Next Command**: Edit `Dockerfile.devbob-local` to add permission fixes  
**ETA to Production**: ~90 minutes (including build, test, deploy, verify)
