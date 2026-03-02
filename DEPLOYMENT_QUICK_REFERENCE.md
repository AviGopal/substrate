# DevBob Production Deployment - Quick Reference Card

## Current Status: ⚠️ READY TO DEPLOY (Waiting for Cluster Access)

### What's Done ✅
- Image v1.0.64 built and pushed to Docker Hub
- Permission fixes validated (Bun + OpenCode binaries)
- Chart replaced and merged (local + platform features)
- Local testing with production config: 100% working
- Documentation complete

### What's Blocking ⚠️
- kubectl connectivity to production cluster (all commands timeout)
- Need to verify/complete deployment revision 6

---

## Quick Deploy Commands

### 1. Check Cluster Access
```bash
kubectl config use-context metabob-production
timeout 10 kubectl cluster-info  # Should return cluster info
```

### 2. Check Current Status
```bash
# Is deployment already running?
kubectl get pods -n metabob -l app.kubernetes.io/name=devbob

# What version is deployed?
kubectl get deployment opencode-server-devbob -n metabob -o jsonpath='{.spec.template.spec.containers[0].image}'
```

### 3A. If v1.0.64 Already Running (Revision 6 Completed)
```bash
# Just verify health
kubectl logs deployment/opencode-server-devbob -n metabob -c devbob --tail=100
# Look for: "loaded bootstrap templates", NO "permission denied"

# SUCCESS → Skip to monitoring
```

### 3B. If NOT v1.0.64 or Pod Crashing
```bash
cd repos/platform/metabob-apps

# Deploy now
helm upgrade opencode-server charts/devbob/charts \
  -f charts/devbob/values/production.devbob.values.yaml \
  -f charts/devbob/values/production.devbob.secrets.yaml \
  -n metabob \
  --atomic \
  --timeout 10m
```

### 4. Monitor (10 minutes)
```bash
# Watch pod
watch -n 10 'kubectl get pods -n metabob -l app.kubernetes.io/name=devbob'

# Follow logs
kubectl logs -n metabob deployment/opencode-server-devbob -c devbob -f
```

---

## Success Checklist

Run these in order:

```bash
# 1. Pod running? (should be 2/2 with istio-proxy)
kubectl get pods -n metabob -l app.kubernetes.io/name=devbob

# 2. Correct version?
kubectl get deployment opencode-server-devbob -n metabob -o jsonpath='{.spec.template.spec.containers[0].image}'
# Should output: metabobapp/devbob:v1.0.64

# 3. No restarts? (restart count should be 0)
kubectl get pods -n metabob -l app.kubernetes.io/name=devbob -o wide

# 4. No permission errors?
kubectl logs deployment/opencode-server-devbob -n metabob -c devbob | grep -i "permission denied"
# Should output: nothing

# 5. Bootstrap templates loading?
kubectl logs deployment/opencode-server-devbob -n metabob -c devbob | grep "bootstrap templates"
# Should output: "loaded bootstrap templates" or "bootstrap registration complete"
```

✅ **If all 5 pass → SUCCESS!**

---

## Rollback (If Needed)

```bash
# Quick rollback to previous version
helm rollback opencode-server -n metabob

# Or specific revision
helm history opencode-server -n metabob
helm rollback opencode-server <revision-number> -n metabob
```

---

## Troubleshooting

### Pod CrashLooping
```bash
# Check events
kubectl describe pod -n metabob -l app.kubernetes.io/name=devbob

# Check previous logs (before crash)
kubectl logs -n metabob -l app.kubernetes.io/name=devbob -c devbob --previous
```

### Permission Errors Persist
```bash
# Verify image version (MUST be v1.0.64)
kubectl get deployment opencode-server-devbob -n metabob -o yaml | grep "image:"

# Check Bun binary in running pod
kubectl exec -n metabob deployment/opencode-server-devbob -c devbob -- ls -la /usr/local/bin/bun
```

### ConfigMap Not Applied
```bash
# Check ConfigMap exists
kubectl get configmap opencode-config -n metabob

# Verify init container ran
kubectl logs -n metabob -l app.kubernetes.io/name=devbob -c setup-config
```

---

## Files & Resources

### Documentation
- **Detailed Guide**: `PRODUCTION_DEPLOYMENT_GUIDE.md`
- **Full Summary**: `DEPLOYMENT_STATUS_SUMMARY.md`

### Key Locations
- **Image**: https://hub.docker.com/r/metabobapp/devbob/tags
- **Chart**: `repos/platform/metabob-apps/charts/devbob/charts/`
- **Values**: `repos/platform/metabob-apps/charts/devbob/values/production.devbob.values.yaml`

### Git Commits
```bash
cd repos/platform/metabob-apps
git log --oneline -4
# 2db2260 docs: Add local-prod values
# ccbb20f fix: Disable health probes
# c27292b feat: Replace chart with working local version
# 216cbb7 (main repo) fix: Bun permissions in Dockerfile
```

---

## After Successful Deployment

### 1. Push Changes
```bash
cd repos/platform/metabob-apps
git push origin feat/replace-devbob-chart
```

### 2. Create PR
Title: "Replace broken opencode-server chart with working devbob chart (v1.0.64)"

### 3. Test End-to-End
- Slack bot commands
- Activity execution
- Template auto-registration

---

## Contact

- **Cluster Issues**: Check GCP Console, verify VPN/credentials
- **Pod Issues**: Check logs, describe pod, verify image version
- **Chart Issues**: Compare with working local deployment

---

**Last Updated**: 2026-03-02  
**Version**: v1.0.64  
**Status**: Ready to Deploy
