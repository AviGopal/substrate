# Production Deployment Started

**Date**: 2026-03-02  
**Status**: ⚠️ Deployment In Progress - kubectl Hanging  
**Image**: metabobapp/devbob:v1.0.64 ✅ Built & Pushed

---

## What Was Completed

### 1. Dockerfile Permission Fixes ✅
- Added `chmod 755` on OpenCode binary
- Added `chmod +x` and `755` on Bun binary  
- Created symlink `/usr/local/bin/bun` → `/root/.bun/bin/bun`
- Tested with non-root users (1000:1000 and 1337:1337) - **WORKING**

### 2. Image Build & Push ✅
```bash
Image: metabobapp/devbob:v1.0.64
Size: 991MB (compressed: 253MB)
Digest: sha256:d98eec74494a32bac8ba4a00fe9867ebf6b64e738fe4c3d5ce5d4ffab6a6a1ab
Registry: Docker Hub (docker.io/metabobapp/devbob)
Tags: v1.0.64, latest
Status: ✅ Pushed successfully
```

**Verification**:
```bash
$ docker run --user 1000:1000 metabobapp/devbob:v1.0.64 opencode --version
✓ Works (no permission error)

$ docker run --user 1337:1337 metabobapp/devbob:v1.0.64 bun --version  
✓ Works (istio-proxy user)
```

### 3. Production Deployment Initiated ✅
```bash
$ helm upgrade opencode-server repos/platform/metabob-apps/charts/devbob/charts \
    -f production.devbob.values.yaml \
    -f production.devbob.secrets.yaml \
    -n metabob

Release "opencode-server" has been upgraded. Happy Helming!
REVISION: 6
STATUS: deployed
```

**Resources Created**:
- ✅ Deployment: `opencode-server-devbob`
- ✅ Service: `opencode-server-devbob`  
- ✅ ServiceAccount: `opencode-server-devbob`
- ✅ ConfigMap: `opencode-server-devbob` (with opencode.json)
- ✅ Secret: `opencode-server-devbob-secrets`

---

## Current Status

### Pod State (Last Known)
```
NAME                                      READY   STATUS            RESTARTS   AGE
opencode-server-devbob-58f7db95dc-2lprt   1/2     ImagePullBackOff  0          ~2min
```

**Issue**: Pod stuck in ImagePullBackOff or init container issues

**Init Containers**:
1. `istio-init` - ✅ Completed
2. `istio-proxy` - ⚠️ Startup probe failing (connection refused on port 15021)
3. `setup-config` - Waiting for istio-proxy

**Main Container**: Not started yet (waiting for init containers)

### Network Connectivity Issue
kubectl commands started hanging/timing out after deployment:
- `kubectl get pods` - Timeout
- `kubectl logs` - Timeout  
- `kubectl describe` - Timeout
- `kubectl get events` - Timeout

**Possible Causes**:
1. Network connectivity issue with GKE cluster
2. kubectl context problem
3. API server overload
4. VPN/firewall blocking connection

---

## What's Deployed

### Image Configuration
```yaml
image:
  repository: metabobapp/devbob
  pullPolicy: IfNotPresent
  tag: "v1.0.64"  # ← NEW (was v1.0.0 or v1.0.1)
```

### Key Features
- ✅ Bun permission fixes (resolves Exit Code 126)
- ✅ ConfigMap with opencode.json
- ✅ Metabob integration enabled
- ✅ MCP server configuration
- ✅ SurrealDB connection params
- ✅ Git credentials support
- ✅ Health probes configured
- ✅ emptyDir storage (stateless)

### Configuration Highlights
```yaml
opencode:
  config:
    metabob:
      enabled: true
      max_issues: 5
      auto_impact_analysis: true
      template_auto_registration:
        enabled: true
    mcp:
      metabob:
        url: "http://metabob-rpc-api:8080"
        enabled: true
```

---

## Next Steps (When kubectl Access Restored)

### 1. Check Pod Status [5 min]
```bash
kubectl config use-context metabob-production

# Check pod status
kubectl get pods -n metabob -l app.kubernetes.io/name=devbob

# Expected outcomes:
# A) Running: 2/2 Ready → SUCCESS
# B) ImagePullBackOff → Check image pull secrets
# C) CrashLoopBackOff → Check logs for errors
# D) Init container stuck → Check Istio issues
```

### 2. If Running: Verify Deployment [10 min]
```bash
# Check version
kubectl exec deployment/opencode-server-devbob -n metabob -c devbob -- \
  opencode --version
# Should output: 1.0.64

# Check logs
kubectl logs deployment/opencode-server-devbob -n metabob -c devbob --tail=100

# Should NOT see:
# - "Permission denied: /usr/local/bin/bun"
# - Exit Code 126

# Should see:
# - "DevBob Container Self-Configuration"
# - "ACP server listening"
# - Bootstrap templates loaded

# Check restart count
kubectl get pod -n metabob -l app.kubernetes.io/name=devbob \
  -o jsonpath='{.items[0].status.containerStatuses[?(@.name=="devbob")].restartCount}'
# Should output: 0
```

### 3. If ImagePullBackOff: Check Registry [5 min]
```bash
# Verify image exists
docker pull metabobapp/devbob:v1.0.64

# Check if GKE can pull
kubectl run test-pull --image=metabobapp/devbob:v1.0.64 --restart=Never -n metabob
kubectl logs test-pull -n metabob
kubectl delete pod test-pull -n metabob

# If still fails, may need ImagePullSecrets
kubectl get secret -n metabob | grep docker
```

### 4. If Init Container Stuck: Check Istio [10 min]
```bash
# Check istio-proxy logs
kubectl logs opencode-server-devbob-xxx -n metabob -c istio-proxy

# Check Istio sidecar injection
kubectl get pod opencode-server-devbob-xxx -n metabob -o yaml | grep istio

# If Istio causing issues, disable temporarily
kubectl label namespace metabob istio-injection=disabled
kubectl rollout restart deployment/opencode-server-devbob -n metabob
```

### 5. If CrashLoopBackOff: Debug Logs [15 min]
```bash
# Get crash logs
kubectl logs opencode-server-devbob-xxx -n metabob -c devbob --previous

# Check events
kubectl describe pod opencode-server-devbob-xxx -n metabob

# Check secrets
kubectl get secret opencode-server-devbob-secrets -n metabob -o yaml | grep anthropic

# If still permission error:
kubectl exec -it deployment/opencode-server-devbob -n metabob -c devbob -- \
  ls -la /opt/opencode/bin/opencode
kubectl exec -it deployment/opencode-server-devbob -n metabob -c devbob -- \
  ls -la /root/.bun/bin/bun
```

---

## Troubleshooting Guide

### Issue: ImagePullBackOff
**Symptoms**: Pod stuck, can't pull image  
**Checks**:
- Image name correct? `metabobapp/devbob:v1.0.64`
- Image exists in registry? `docker pull metabobapp/devbob:v1.0.64`
- Pull secrets configured? `kubectl get secret -n metabob | grep docker`

**Fix**:
```bash
# Create pull secret if needed
kubectl create secret docker-registry regcred \
  --docker-server=https://index.docker.io/v1/ \
  --docker-username=<username> \
  --docker-password=<password> \
  -n metabob

# Update deployment
kubectl patch deployment opencode-server-devbob -n metabob \
  -p '{"spec":{"template":{"spec":{"imagePullSecrets":[{"name":"regcred"}]}}}}'
```

### Issue: Init Container Stuck (Istio)
**Symptoms**: istio-proxy startup probe failing  
**Checks**:
- Istio version compatible?
- Istio sidecar injecting correctly?
- Network policies blocking?

**Fix**:
```bash
# Option A: Restart pod (sometimes fixes Istio)
kubectl delete pod opencode-server-devbob-xxx -n metabob

# Option B: Disable Istio temporarily
kubectl label namespace metabob istio-injection=disabled --overwrite
kubectl rollout restart deployment/opencode-server-devbob -n metabob

# Option C: Fix Istio config
kubectl edit deployment opencode-server-devbob -n metabob
# Add: sidecar.istio.io/inject: "false" to pod annotations
```

### Issue: Permission Denied (Still)
**Symptoms**: Exit Code 126, "Permission denied: /usr/local/bin/bun"  
**Checks**:
- Image is v1.0.64? (not v1.0.0 or v1.0.1)
- Image actually pulled from registry? (not cached old version)

**Fix**:
```bash
# Force pull new image
kubectl set image deployment/opencode-server-devbob \
  devbob=metabobapp/devbob:v1.0.64 -n metabob
kubectl rollout restart deployment/opencode-server-devbob -n metabob

# Or delete pod to force re-pull
kubectl delete pod opencode-server-devbob-xxx -n metabob --force
```

### Issue: kubectl Commands Hanging
**Symptoms**: All kubectl commands timeout  
**Checks**:
- Network connectivity to GKE
- VPN connection active?
- kubectl context correct?
- API server responsive?

**Fix**:
```bash
# Check context
kubectl config current-context
# Should show: metabob-production

# Test connectivity
kubectl cluster-info

# Re-authenticate
gcloud auth login
gcloud container clusters get-credentials production --region us-west2

# Or use different network/VPN
```

---

## Rollback Plan

If deployment fails completely:

### Option 1: Helm Rollback
```bash
helm rollback opencode-server -n metabob
# Rolls back to revision 5 (previous version)
```

### Option 2: Manual Image Rollback
```bash
kubectl set image deployment/opencode-server-devbob \
  devbob=metabobapp/devbob:v1.0.0 -n metabob
```

### Option 3: Scale Down
```bash
kubectl scale deployment/opencode-server-devbob --replicas=0 -n metabob
# Investigate, then scale back up
kubectl scale deployment/opencode-server-devbob --replicas=1 -n metabob
```

---

## Success Criteria

### Immediate (5-10 min)
- [ ] kubectl commands working
- [ ] Pod status: Running 2/2
- [ ] No ImagePullBackOff
- [ ] No CrashLoopBackOff
- [ ] Init containers completed

### Short-term (30 min)
- [ ] Logs show successful startup
- [ ] No permission errors in logs
- [ ] opencode --version outputs 1.0.64
- [ ] Restart count is 0
- [ ] Health endpoint responding

### Long-term (24 hours)
- [ ] Zero crashes
- [ ] Normal activity volume
- [ ] Slack bot integration works
- [ ] Performance stable
- [ ] No new error patterns

---

## Commits Summary

### This Session
1. **216cbb7** - fix(docker): Add Bun permission fixes
   - chmod 755 on opencode and bun
   - Symlink /usr/local/bin/bun
   - Tested with non-root users

2. **c27292b** - feat(devbob): Replace chart with local version
   - 18 files changed, +831/-144 lines
   - Merged ConfigMap and ServiceAccount

3. **ccbb20f** - fix(devbob): Disable health probes temporarily
   - 2 files changed, +17/-3 lines
   - For local testing

### Images Built
- `metabobapp/devbob:v1.0.64` - ✅ Pushed
- `metabobapp/devbob:latest` - ✅ Pushed

---

## Files to Review

- `CHART_REPLACEMENT_SUMMARY.md` - Chart changes
- `LOCAL_TESTING_COMPLETE.md` - Local test results
- `PRODUCTION_DEPLOYMENT_STARTED.md` - This file
- `NEXT_ACTIONS_CHART_DEPLOYMENT.md` - Next steps guide

---

**Status**: ⚠️ Waiting for kubectl Access to Verify Deployment  
**Next Action**: Restore kubectl connectivity and check pod status  
**ETA**: Unknown (depends on network issue resolution)
