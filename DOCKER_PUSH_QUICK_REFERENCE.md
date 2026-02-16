# Docker Push and Helmfile Diff - Quick Reference

**Date**: February 16, 2026  
**Context**: Push latest images (includes V2 template migration) to production

---

## Quick Commands (Copy-Paste Ready)

### Option 1: Run Automated Script
```bash
cd ~/documents/work/exp-repo/metabob-devbob
./docker-push-commands.sh
```

### Option 2: Manual Commands

#### 1. Push metabob-rpc-api
```bash
cd ~/documents/work/exp-repo/metabob-devbob/repos/metabob-rpc-api
docker compose build server
docker compose push server
```

#### 2. Push metabob-dashboard
```bash
cd ~/documents/work/exp-repo/metabob-devbob/repos/metabob-dashboard
docker compose build dashboard
docker compose push dashboard
```

#### 3. Update Helm Values
```bash
cd ~/documents/work/platform/metabob-apps/charts

# Backup
cp metabob-rpc-api/values.yaml metabob-rpc-api/values.yaml.bak
cp metabob-dashboard/values.yaml metabob-dashboard/values.yaml.bak

# Update rpc-api (0.16.12 → 0.16.13)
sed -i 's/tag: "0.16.12"/tag: "0.16.13"/' metabob-rpc-api/values.yaml

# Update dashboard (2.2.1 → 2.2.2)
sed -i 's/tag: "2.2.1"/tag: "2.2.2"/' metabob-dashboard/values.yaml

# Verify
grep -A 1 "tag:" metabob-rpc-api/values.yaml
grep -A 1 "tag:" metabob-dashboard/values.yaml
```

#### 4. Run Helmfile Diff
```bash
cd ~/documents/work/platform/environments
helmfile -e production diff | tee /tmp/helmfile-diff-$(date +%Y%m%d).txt
```

#### 5. Review and Apply (if diff looks good)
```bash
# Review
cat /tmp/helmfile-diff-*.txt

# Apply
helmfile -e production apply --interactive
```

---

## What to Check in Helmfile Diff

### ✅ Expected Changes (Good)
- Image tag: `0.16.12` → `0.16.13` (metabob-rpc-api)
- Image tag: `2.2.1` → `2.2.2` (metabob-dashboard)
- Deployment metadata (revision, timestamps)
- Pod template hash changes

### ❌ Unexpected Changes (Investigate)
- Environment variable changes
- Resource limit changes
- Service configuration changes
- Ingress/Gateway modifications
- Secret or ConfigMap changes

---

## Version Summary

| Component | Current | New | What's Included |
|-----------|---------|-----|-----------------|
| metabob-rpc-api | 0.16.12 | **0.16.13** | V2 template migration (16/16), template loading fixes |
| metabob-rpc-api-worker | 0.16.0 | 0.16.1 (optional) | Only if worker code changed |
| metabob-dashboard | 2.2.1 | **2.2.2** | Only if dashboard code changed |

---

## Rollback Commands (If Needed)

```bash
# Restore Helm values
cd ~/documents/work/platform/metabob-apps/charts
cp metabob-rpc-api/values.yaml.bak metabob-rpc-api/values.yaml
cp metabob-dashboard/values.yaml.bak metabob-dashboard/values.yaml

# Apply old versions
cd ~/documents/work/platform/environments
helmfile -e production apply
```

---

## Docker Hub Verification

After pushing, verify images exist:
- https://hub.docker.com/r/metabobapp/metabob-rpc-api/tags
- https://hub.docker.com/r/metabobapp/metabob-dashboard/tags

Or via CLI:
```bash
docker pull metabobapp/metabob-rpc-api:0.16.13
docker pull metabobapp/metabob-dashboard:2.2.2
```

---

## Troubleshooting

### "Cannot access platform directory"
```bash
# Verify platform path
cd ~/documents/work/platform
ls -la metabob-apps/
```

### "Docker push denied"
```bash
# Login to Docker Hub
docker login
# Enter credentials for metabobapp org
```

### "Image not found"
```bash
# Verify image was built
docker images | grep metabobapp

# Check compose file references correct image
cd repos/metabob-rpc-api
grep "image:" docker-compose.yaml
```

---

**Full Guide**: See `DOCKER_PUSH_AND_HELMFILE_UPDATE_GUIDE.md`  
**Automated Script**: Run `./docker-push-commands.sh`
