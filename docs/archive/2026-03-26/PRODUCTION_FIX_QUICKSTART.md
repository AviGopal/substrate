# Production DevBob Fix - Quick Start Guide

**CRITICAL**: Production `opencode-server` has been crashing for 5+ days (Exit Code 126: Permission denied)

---

## TL;DR - Emergency Fix (2-3 hours)

1. Fix Dockerfile permissions
2. Build image `v1.0.64` from current code
3. Push to `metabobapp/devbob:v1.0.64`
4. Update production helm values
5. Deploy to production
6. Verify it's running

---

## Current Situation

### Production Status
```
Pod: opencode-server-bb4f6cbc4-dw22c
Status: CrashLoopBackOff (1432 restarts over 5 days!)
Image: metabobapp/devbob:v1.0.0 (OUTDATED)
Error: /usr/local/bin/bun: Permission denied (Exit Code 126)
```

### Code Status
```
OpenCode: v1.0.64 (current) vs v1.0.0 (production) - 64 versions behind!
RPC API: spec-async-ripple-surrealdb-v1 (using official SurrealDB lib)
Platform: 4803b14 (10 commits ahead, needs push)
```

---

## Step-by-Step Fix

### Step 1: Fix Dockerfile (15 min)

Edit `Dockerfile.devbob-local` - Add after line 44 (Bun installation):

```dockerfile
# Install Bun for plugin management
RUN curl -fsSL https://bun.sh/install | bash
ENV PATH="/root/.bun/bin:$PATH"

# FIX: Ensure Bun is executable by all users (CRITICAL for production)
RUN chmod +x /root/.bun/bin/bun && \
    ln -s /root/.bun/bin/bun /usr/local/bin/bun && \
    chmod 755 /root/.bun/bin/bun
```

Also add after line 41 (OpenCode binary copy):

```dockerfile
# Make binary executable (ensure proper permissions)
RUN chmod 755 /opt/opencode/bin/opencode
```

### Step 2: Build Image (20 min)

```bash
# Ensure OpenCode is built first
cd repos/metabob-opencode/packages/opencode
bun install
bun run build
# This creates: dist/opencode-linux-x64/bin/opencode

# Build Docker image
cd /home/avi/documents/work/exp-repo/metabob-devbob
docker build -f Dockerfile.devbob-local -t metabobapp/devbob:v1.0.64 .

# Test locally with non-root user (simulates production)
docker run --rm -it --user 1000:1000 metabobapp/devbob:v1.0.64 opencode --version
# Should output: 1.0.64 (not permission error!)

# Test server startup
docker run --rm -p 8080:8080 metabobapp/devbob:v1.0.64 opencode serve
# CTRL+C to stop
```

### Step 3: Push to Registry (10 min)

```bash
# Login to Docker Hub (need credentials for metabobapp org)
docker login
# Username: metabobapp (or your username)
# Password: [DOCKER_HUB_TOKEN]

# Push versioned image
docker push metabobapp/devbob:v1.0.64

# Also tag as latest
docker tag metabobapp/devbob:v1.0.64 metabobapp/devbob:latest
docker push metabobapp/devbob:latest

# Verify push succeeded
docker pull metabobapp/devbob:v1.0.64
```

### Step 4: Update Helm Values (10 min)

```bash
cd repos/platform/metabob-apps

# Edit production values
nano charts/devbob/values/production.devbob.values.yaml

# Change line 8:
#   tag: "v1.0.1"  →  tag: "v1.0.64"

# Commit change
git add charts/devbob/values/production.devbob.values.yaml
git commit -m "fix(devbob): Update production image to v1.0.64 - fixes permission error"

# Push to remote (if needed)
git push origin feat/add-redis-to-dev-storage
```

### Step 5: Deploy to Production (15 min)

```bash
# Switch to production context
kubectl config use-context metabob-production

# Verify you're in the right place
kubectl config current-context
# Should show: metabob-production

# Deploy using helmfile
cd repos/platform/metabob-apps
helmfile -e production diff --selector name=opencode-server
# Review changes (should show image tag change)

helmfile -e production apply --selector name=opencode-server
# This will upgrade the helm release

# Or use helm directly
helm upgrade opencode-server charts/devbob/charts \
  -f charts/devbob/values/production.devbob.values.yaml \
  -f charts/devbob/values/production.devbob.secrets.yaml \
  -n metabob

# Watch the rollout
kubectl rollout status deployment/opencode-server -n metabob
```

### Step 6: Verify Fix (15 min)

```bash
# Check pod status
kubectl get pods -n metabob -l app.kubernetes.io/name=opencode-server

# Should show:
# NAME                               READY   STATUS    RESTARTS   AGE
# opencode-server-xxxxxxxxxx-xxxxx   2/2     Running   0          2m

# Check logs (should show successful startup)
kubectl logs -f deployment/opencode-server -n metabob -c opencode-server

# Should see:
# ✓ OpenCode server started
# ✓ Listening on http://0.0.0.0:8080
# (No permission errors!)

# Test binary inside container
kubectl exec -it deployment/opencode-server -n metabob -c opencode-server -- opencode --version
# Should output: 1.0.64

# Test health endpoint
kubectl exec -it deployment/opencode-server -n metabob -c opencode-server -- \
  curl -s http://localhost:8080/health
# Should return: {"status":"ok",...}

# Check restart count (should be 0 or low)
kubectl get pod -n metabob -l app.kubernetes.io/name=opencode-server -o jsonpath='{.items[0].status.containerStatuses[?(@.name=="opencode-server")].restartCount}'
```

---

## Rollback Plan (If Something Goes Wrong)

```bash
# Rollback to previous helm release
helm rollback opencode-server -n metabob

# Or scale down new, scale up old
kubectl scale deployment/opencode-server --replicas=0 -n metabob
# Wait for old deployment to come back (if it exists)

# Or manually change image back
kubectl set image deployment/opencode-server opencode-server=metabobapp/devbob:v1.0.0 -n metabob
```

---

## What Changed in v1.0.64 vs v1.0.0

**Major improvements** (64 versions!):
- ✅ Nested activity message forwarding
- ✅ Impulse learning architectural refactoring (moved to RPC API)
- ✅ Activity vessel system
- ✅ Complete architecture separation (ML logic in RPC API only)
- ✅ Improved ACP delegation
- ✅ Better error handling
- ✅ Performance improvements

**Critical fix**:
- ✅ Bun executable permissions (fixes Exit Code 126)

---

## Post-Deployment Checks

### Immediate (First 15 minutes)
- [ ] Pod shows `Running` status (not CrashLoopBackOff)
- [ ] No permission errors in logs
- [ ] Health endpoint returns 200 OK
- [ ] Restart count is 0

### Within 1 Hour
- [ ] Slack bot can trigger DevBob
- [ ] Activity execution works end-to-end
- [ ] Metabob integration functional
- [ ] No new error patterns in logs

### Within 24 Hours
- [ ] Zero crashes or restarts
- [ ] Normal activity volume restored
- [ ] Performance metrics stable
- [ ] No alerts from monitoring

---

## Common Issues & Solutions

### Issue 1: "Permission denied" still appears
**Cause**: Dockerfile fix not applied correctly  
**Solution**: Verify `chmod +x` lines are in Dockerfile, rebuild image

### Issue 2: Pod won't start (ImagePullBackOff)
**Cause**: Image not pushed to registry  
**Solution**: Run `docker push metabobapp/devbob:v1.0.64` again

### Issue 3: Different error than before
**Cause**: New code has different dependencies  
**Solution**: Check logs, may need to update RPC API or SurrealDB

### Issue 4: Helm upgrade fails
**Cause**: Chart version mismatch or values error  
**Solution**: Use `helm diff` to preview, check values syntax

---

## Next Steps After Fix

### This Week
1. **Check RPC API** - Verify it has official SurrealDB library
2. **Test full flow** - Execute an activity end-to-end
3. **Update monitoring** - Add alerts for CrashLoopBackOff
4. **Document** - Update runbook with this fix

### Next Week
1. **Setup CI/CD** - Auto-build images on commit
2. **Implement GitOps** - Auto-deploy with ArgoCD/Flux
3. **Add staging** - Test before production
4. **Chart rename** - Decide: keep opencode-server or rename to devbob

---

## Need Help?

**Check logs**:
```bash
kubectl logs deployment/opencode-server -n metabob --tail=100
```

**Check events**:
```bash
kubectl get events -n metabob --sort-by='.lastTimestamp' | tail -20
```

**Check pod details**:
```bash
kubectl describe pod -n metabob -l app.kubernetes.io/name=opencode-server
```

**Get shell in pod** (if running):
```bash
kubectl exec -it deployment/opencode-server -n metabob -c opencode-server -- bash
```

---

## Files Created

- ✅ `PRODUCTION_DEPLOYMENT_ANALYSIS.md` - Full analysis (8000+ words)
- ✅ `PRODUCTION_FIX_QUICKSTART.md` - This file (quick steps)

---

**Status**: Ready to Execute  
**Time Required**: 2-3 hours  
**Risk Level**: Low (production already broken, fix is straightforward)  
**Next Command**: Edit `Dockerfile.devbob-local` and add permission fixes
