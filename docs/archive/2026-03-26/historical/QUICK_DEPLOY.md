# Quick Deploy Guide - DevBob v1.0.0

## Current Status: READY TO PUSH ✓

**All code fixes complete. Docker image built. Helmfile values updated. Ready to push and deploy.**

## One-Command Deploy (PROPER METHOD - Uses Helmfile)

```bash
# Push to registry and deploy with Helmfile
./push-and-helmfile-deploy-v1.0.0.sh
```

This will:
1. Push `metabobapp/devbob:v1.0.0` to Docker Hub
2. Update `latest` tag
3. Deploy using Helmfile (proper GitOps workflow)
4. Wait for rollout and verify

## What's Fixed in v1.0.0

- ✅ `opencode serve` command (was incorrectly using `acp`)
- ✅ `tsx` dependency fixed in slack package
- ✅ Bun path fixed in Docker wrapper
- ✅ Slack bot backend URL points to internal service

## Manual Steps (If Automated Script Fails)

```bash
# 1. Push image
docker push metabobapp/devbob:v1.0.0
docker push metabobapp/devbob:latest

# 2. Verify in registry
docker manifest inspect metabobapp/devbob:v1.0.0

# 3. Deploy with Helmfile (PROPER METHOD)
./helmfile-deploy-v1.0.0.sh

# 4. Check deployment
kubectl get pods -n metabob -l app.kubernetes.io/name=opencode-server
kubectl logs -n metabob -l app.kubernetes.io/name=opencode-server --tail=30

# 5. Test in Slack
# Send "Hello" and verify AI response
```

## Why Helmfile?

We use **Helmfile** (not raw `kubectl`) because:
- ✅ Changes are tracked in Git
- ✅ Environment-specific configs (prod/integration/default)  
- ✅ Can preview changes before applying (`helmfile diff`)
- ✅ Proper rollback capability
- ✅ Manages service dependencies

See `HELMFILE_DEPLOYMENT_GUIDE.md` for details.

## Expected Result

**Before**: "I received your message but didn't have a response"  
**After**: Real AI-generated responses from Claude

## Rollback (If Needed)

```bash
kubectl set image deployment/opencode-server -n metabob \
  opencode-server=metabobapp/devbob:fixed-serve-v1
kubectl rollout restart deployment/opencode-server -n metabob
```

## Files Created This Session

- `VERSION.md` - Versioning system documentation
- `deploy-v1.0.0.sh` - Deployment script for v1.0.0
- `push-and-deploy-v1.0.0.sh` - Automated push+deploy
- `DEPLOYMENT_STATUS.md` - Detailed status and troubleshooting
- `QUICK_DEPLOY.md` - This file

## Next Session Checklist

- [ ] Restart Docker daemon
- [ ] Run `./push-and-deploy-v1.0.0.sh`
- [ ] Verify pod logs show "opencode server listening"
- [ ] Test Slack bot with "Hello" message
- [ ] Remove debug route: `kubectl delete virtualservice devbob-debug -n metabob`
- [ ] Document successful deployment in VERSION.md
