# Deployment Plan - Session Tracking Fix to Local Kubernetes

## Objective
Deploy OpenCode with complete session tracking fix (commit c38a83f0) to local Kubernetes cluster (docker-desktop) and validate the fix works end-to-end.

---

## Steps

### 1. Build Docker Image with Fixed Code ✅
**Location**: `repos/metabob-opencode`  
**Dockerfile**: `docker/Dockerfile.devbob-ci`  
**Tag**: `metabobapp/devbob:session-tracking-fix` or `latest`

```bash
cd repos/metabob-opencode
docker build -f docker/Dockerfile.devbob-ci -t metabobapp/devbob:latest .
```

**Verification**:
- Image builds successfully
- Image contains commit c38a83f0 code
- Binary is executable

### 2. Push Image to Local Registry
Since we're deploying to local docker-desktop, the image needs to be available:

**Option A**: Use local Docker images (IfNotPresent pull policy)
```bash
# Image already available in local Docker daemon after build
# Helm chart uses imagePullPolicy: IfNotPresent
```

**Option B**: Push to Docker Hub (if needed)
```bash
docker push metabobapp/devbob:latest
```

### 3. Deploy with Helmfile
**Location**: `repos/platform/metabob-apps`  
**Environment**: `default` (maps to docker-desktop context)  
**Service**: `devbob`

```bash
cd repos/platform/metabob-apps
./deploy.sh -e default -s devbob
```

**What This Does**:
- Uses helmfile to deploy devbob chart
- Applies `environments/default/default.values.yaml`
- Applies `charts/devbob/values/default.devbob.values.yaml`
- Creates/updates devbob deployment in metabob namespace
- Pulls `metabobapp/devbob:latest` image

### 4. Verify Deployment
```bash
# Check pod is running
kubectl get pods -n metabob -l app=devbob

# Check pod logs
kubectl logs -n metabob -l app=devbob --tail=50

# Check pod is using new image
kubectl get pod -n metabob <devbob-pod-name> -o jsonpath='{.spec.containers[0].image}'

# Port forward to access devbob
kubectl port-forward -n metabob svc/devbob 8080:8080
```

### 5. Validate Session Tracking Fix
**Execute test activity via ACP delegation**:

```bash
# From local machine with port-forward active
curl http://localhost:8080/acp
```

Or use `acp_delegate` tool to execute activity on devbob pod.

**Validate**:
1. Execute `manage-session-memory` activity (5 tasks)
2. Check activity storage shows `sessionsSpawned.length === 5`
3. Verify task completion logs emit
4. Verify correctness verdict is "correct" not "incorrect"

### 6. Complete Validation
**Success Criteria**:
- [ ] Docker image builds with c38a83f0 code
- [ ] Devbob pod running in metabob namespace
- [ ] Pod using new image (check image hash)
- [ ] Activity execution succeeds
- [ ] Session tracking works (5 sessions tracked)
- [ ] Task completion logs emit (5 logs found)
- [ ] Correctness verdict passes

---

## Current State

### Kubernetes Context
```
Context: docker-desktop ✅
Namespace: metabob ✅
```

### Current Devbob Deployment
```
Pod: devbob-794b69b4f4-rhnwg
Status: Running
Image: metabobapp/devbob:latest (old version)
Age: 17h
```

### Code Version
```
On Disk: c38a83f0 (session tracking fix) ✅
Current Image: Pre-fix version ❌
```

---

## Execution

### Build Command
```bash
cd /home/avi/documents/work/exp-repo/metabob-devbob/repos/metabob-opencode
docker build -f docker/Dockerfile.devbob-ci \
  -t metabobapp/devbob:latest \
  -t metabobapp/devbob:session-tracking-fix \
  .
```

### Deploy Command
```bash
cd /home/avi/documents/work/exp-repo/metabob-devbob/repos/platform/metabob-apps
./deploy.sh -e default -s devbob --skip-diff
```

### Validation Command
```bash
# Check pod started with new image
kubectl get pod -n metabob -l app=devbob \
  -o jsonpath='{.items[0].spec.containers[0].image}'

# Check logs show new version
kubectl logs -n metabob -l app=devbob --tail=20

# Port forward for testing
kubectl port-forward -n metabob svc/devbob 8080:8080 &

# Test activity execution
# (via ACP or direct API call)
```

---

## Rollback Plan

If deployment fails:
```bash
# Rollback helm release
helm rollback -n metabob devbob

# Or redeploy previous version
cd repos/platform/metabob-apps
./deploy.sh -e default -s devbob
```

---

## Timeline

1. Build image: ~5-10 minutes
2. Deploy with helmfile: ~2-3 minutes
3. Pod startup: ~30-60 seconds
4. Validation: ~2-5 minutes

**Total**: ~10-20 minutes

---

## Notes

- Local deployment doesn't require image push (uses local Docker daemon)
- Helm chart uses `imagePullPolicy: IfNotPresent`
- Pod will restart automatically when deployment updates
- PVC persists data across deployments
- Port 8080 exposed via NodePort 30080
