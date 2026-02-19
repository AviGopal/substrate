# DevBob Deployment Status - 2026-02-19

## Current Situation

### ✅ COMPLETED: Code Fixes
All necessary fixes have been made to the codebase:

1. **Dockerfile.devbob** (line 90): Fixed bun path to `/usr/local/bin/bun`
2. **packages/slack/package.json**: Fixed tsx dependency from `"catalog:"` to `"^4.19.0"`
3. **charts/opencode-server/templates/deployment.yaml**: Fixed args from `["acp"]` to `["serve"]`
4. **charts/slack-bot/values/production.slack-bot.values.yaml**: Fixed backend URL to `http://opencode-server:8080`

### ✅ COMPLETED: Image Build
New Docker image built locally with all fixes:
- **Image SHA**: `sha256:158c2e370373801026be8234a78c4c2075ff598b8759ec6b8a312c1fbaa3da41`
- **Tags**: `metabobapp/devbob:v1.0.0`, `metabobapp/devbob:latest`
- **Size**: 11.5GB (3.19GB compressed)

### ✅ COMPLETED: Versioning System & Helmfile Integration
- Created `VERSION.md` with semantic versioning scheme
- Updated Helmfile values: `charts/opencode-server/values/production.opencode-server.values.yaml`
- Created `helmfile-deploy-v1.0.0.sh` - Proper Helmfile deployment script
- Created `push-and-helmfile-deploy-v1.0.0.sh` - Automated push+deploy pipeline
- Created `HELMFILE_DEPLOYMENT_GUIDE.md` - Comprehensive Helmfile documentation

### ❌ BLOCKED: Docker Push
Cannot push image to Docker Hub registry due to:
- Docker daemon hanging on layer push (layer `7f77c0f566aa` stuck in "Waiting")
- System load was high (5-6) causing timeouts
- Docker daemon now unresponsive, needs restart with sudo

## Images in Registry (OLD - WITHOUT FIXES)

| Tag | Digest | Status |
|-----|--------|--------|
| `metabobapp/devbob:latest` | `sha256:679ce6754b58...` | ❌ Old, missing fixes |
| `metabobapp/devbob:fixed-serve-v1` | `sha256:679ce6754b58...` | ❌ Old, missing fixes |

## Next Steps

### Option 1: Automated Push and Helmfile Deploy (RECOMMENDED)
```bash
# Push to registry and deploy with Helmfile (proper method)
./push-and-helmfile-deploy-v1.0.0.sh
```

This script:
1. Pushes image to Docker Hub
2. Verifies image in registry
3. Deploys using Helmfile (GitOps workflow)
4. Waits for rollout completion
5. Shows logs and verification

### Option 2: Manual Helmfile Deploy
```bash
# Push image
docker push metabobapp/devbob:v1.0.0
docker push metabobapp/devbob:latest

# Verify in registry
docker manifest inspect metabobapp/devbob:v1.0.0

# Deploy with Helmfile (PROPER METHOD)
./helmfile-deploy-v1.0.0.sh

# Or manually:
cd repos/platform/metabob-apps
helmfile -e production diff --selector name=opencode-server  # Preview
helmfile -e production apply --selector name=opencode-server # Deploy
```

### Option 3: Use Alternative Registry
```bash
# Configure GCR authentication
gcloud auth configure-docker --quiet

# Tag for GCR
docker tag metabobapp/devbob:v1.0.0 gcr.io/metabob/devbob:v1.0.0

# Push to GCR
docker push gcr.io/metabob/devbob:v1.0.0

# Update deployment to use GCR image
kubectl set image deployment/opencode-server -n metabob \
  opencode-server=gcr.io/metabob/devbob:v1.0.0
```

## Verification Steps (After Successful Push)

1. **Verify Image in Registry**:
   ```bash
   docker manifest inspect metabobapp/devbob:v1.0.0
   ```

2. **Deploy to Cluster**:
   ```bash
   ./deploy-v1.0.0.sh
   ```

3. **Check Pod Logs**:
   ```bash
   kubectl logs -n metabob -l app.kubernetes.io/name=opencode-server --tail=50
   # Should see: "opencode server listening on http://0.0.0.0:8080"
   # Should NOT see: "bun: command not found"
   ```

4. **Test Slack Bot**:
   - Send message in Slack: "Hello"
   - Should get AI-generated response
   - Should NOT see: "I received your message but didn't have a response"

5. **Cleanup Debug Routes**:
   ```bash
   # Remove temporary devbob.metabob.com route
   kubectl delete virtualservice devbob-debug -n metabob
   ```

## Root Cause Summary

The Slack bot was failing because:
1. **Wrong command**: Deployment was using `opencode acp` (stdin/stdout mode) instead of `opencode serve` (HTTP server mode)
2. **Missing dependencies**: slack package had invalid `tsx: "catalog:"` dependency
3. **Path issues**: opencode wrapper script called `bun` without absolute path
4. **Wrong backend URL**: slack-bot was configured to use `https://ide.metabob.com` instead of internal service

All code fixes are complete. Only remaining task is pushing the Docker image once Docker daemon is restarted.
