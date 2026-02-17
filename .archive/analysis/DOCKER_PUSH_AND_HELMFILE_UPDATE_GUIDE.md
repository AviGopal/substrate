# Docker Push and Helmfile Update Guide - February 16, 2026

**Objective**: Push latest Docker images to Docker Hub (metabobapp org) and prepare Helmfile diff for production deployment

---

## Overview

This guide covers:
1. Building and pushing Docker images to `metabobapp` organization
2. Updating Helm values files in `metabob-apps/`
3. Running Helmfile diff for production environment
4. Verifying changes before deployment

---

## Prerequisites

### 1. Docker Hub Authentication
```bash
# Login to Docker Hub (if not already logged in)
docker login

# Verify login
docker info | grep Username
# Expected: Username: <your-dockerhub-username>
```

### 2. Current Image Versions

Based on docker-compose files:

**metabob-rpc-api**:
- Current: `metabobapp/metabob-rpc-api:0.16.12`
- Worker: `metabobapp/metabob-rpc-api-worker:0.16.0`

**metabob-dashboard**:
- Current: `metabobapp/metabob-dashboard:2.2.1`

### 3. Verify Platform Directory
```bash
# Platform directory location
cd /home/avi/documents/work/platform

# Verify metabob-apps exists
ls -la metabob-apps/

# Verify helmfile config
ls -la environments/helmfile.yaml
```

---

## Step 1: Build and Push metabob-rpc-api Images

### 1.1 Navigate to RPC API Directory
```bash
cd /home/avi/documents/work/exp-repo/metabob-devbob/repos/metabob-rpc-api
```

### 1.2 Build and Push API Server Image
```bash
# Build the API server image
docker compose build server

# Tag with new version (increment as needed)
NEW_API_VERSION="0.16.13"  # Increment from 0.16.12
docker tag metabobapp/metabob-rpc-api:0.16.12 metabobapp/metabob-rpc-api:${NEW_API_VERSION}
docker tag metabobapp/metabob-rpc-api:0.16.12 metabobapp/metabob-rpc-api:latest

# Push to Docker Hub
docker push metabobapp/metabob-rpc-api:${NEW_API_VERSION}
docker push metabobapp/metabob-rpc-api:latest
```

**Or use docker-compose push**:
```bash
# Push all images defined in docker-compose
docker compose push server
```

### 1.3 Build and Push Worker Image (if changed)
```bash
# Build the worker image
docker compose build worker

# Tag with new version
NEW_WORKER_VERSION="0.16.1"  # Increment from 0.16.0
docker tag metabobapp/metabob-rpc-api-worker:0.16.0 metabobapp/metabob-rpc-api-worker:${NEW_WORKER_VERSION}
docker tag metabobapp/metabob-rpc-api-worker:0.16.0 metabobapp/metabob-rpc-api-worker:latest

# Push to Docker Hub
docker push metabobapp/metabob-rpc-api-worker:${NEW_WORKER_VERSION}
docker push metabobapp/metabob-rpc-api-worker:latest
```

**Or**:
```bash
docker compose push worker
```

---

## Step 2: Build and Push metabob-dashboard Image

### 2.1 Navigate to Dashboard Directory
```bash
cd /home/avi/documents/work/exp-repo/metabob-devbob/repos/metabob-dashboard
```

### 2.2 Build and Push Dashboard Image
```bash
# Build the dashboard image
docker compose build dashboard

# Tag with new version
NEW_DASHBOARD_VERSION="2.2.2"  # Increment from 2.2.1
docker tag metabobapp/metabob-dashboard:2.2.1 metabobapp/metabob-dashboard:${NEW_DASHBOARD_VERSION}
docker tag metabobapp/metabob-dashboard:2.2.1 metabobapp/metabob-dashboard:latest

# Push to Docker Hub
docker push metabobapp/metabob-dashboard:${NEW_DASHBOARD_VERSION}
docker push metabobapp/metabob-dashboard:latest
```

**Or**:
```bash
docker compose push dashboard
```

---

## Step 3: Verify Images on Docker Hub

```bash
# Check pushed images
docker images | grep metabobapp

# Expected output:
# metabobapp/metabob-rpc-api          0.16.13    <image-id>   <timestamp>   <size>
# metabobapp/metabob-rpc-api          latest     <image-id>   <timestamp>   <size>
# metabobapp/metabob-rpc-api-worker   0.16.1     <image-id>   <timestamp>   <size>
# metabobapp/metabob-dashboard        2.2.2      <image-id>   <timestamp>   <size>
```

Verify on Docker Hub:
- https://hub.docker.com/r/metabobapp/metabob-rpc-api/tags
- https://hub.docker.com/r/metabobapp/metabob-rpc-api-worker/tags
- https://hub.docker.com/r/metabobapp/metabob-dashboard/tags

---

## Step 4: Update Helm Values Files

Navigate to platform directory:
```bash
cd /home/avi/documents/work/platform
```

### 4.1 Locate Helm Charts
```bash
# metabob-apps structure
ls -la metabob-apps/charts/

# Expected charts:
# - metabob-rpc-api/
# - metabob-dashboard/
# - (potentially others)
```

### 4.2 Update metabob-rpc-api Values

**File**: `metabob-apps/charts/metabob-rpc-api/values.yaml`

Find and update image tags:
```yaml
# Before
image:
  repository: metabobapp/metabob-rpc-api
  tag: "0.16.12"
  pullPolicy: IfNotPresent

worker:
  image:
    repository: metabobapp/metabob-rpc-api-worker
    tag: "0.16.0"
    pullPolicy: IfNotPresent
```

Update to:
```yaml
# After
image:
  repository: metabobapp/metabob-rpc-api
  tag: "0.16.13"  # ← Updated
  pullPolicy: IfNotPresent

worker:
  image:
    repository: metabobapp/metabob-rpc-api-worker
    tag: "0.16.1"  # ← Updated
    pullPolicy: IfNotPresent
```

**Command to update**:
```bash
cd metabob-apps/charts/metabob-rpc-api

# Backup current values
cp values.yaml values.yaml.bak

# Update image tag (option 1: manual edit)
vim values.yaml

# Or option 2: sed replacement
sed -i 's/tag: "0.16.12"/tag: "0.16.13"/' values.yaml
sed -i 's/tag: "0.16.0"/tag: "0.16.1"/' values.yaml
```

### 4.3 Update metabob-dashboard Values

**File**: `metabob-apps/charts/metabob-dashboard/values.yaml`

Find and update:
```yaml
# Before
image:
  repository: metabobapp/metabob-dashboard
  tag: "2.2.1"
  pullPolicy: IfNotPresent
```

Update to:
```yaml
# After
image:
  repository: metabobapp/metabob-dashboard
  tag: "2.2.2"  # ← Updated
  pullPolicy: IfNotPresent
```

**Command to update**:
```bash
cd metabob-apps/charts/metabob-dashboard

# Backup
cp values.yaml values.yaml.bak

# Update
sed -i 's/tag: "2.2.1"/tag: "2.2.2"/' values.yaml
```

### 4.4 Update Environment-Specific Values (if needed)

Check for environment-specific values files:
```bash
# Production values
ls -la metabob-apps/charts/metabob-rpc-api/values-production.yaml
ls -la metabob-apps/charts/metabob-dashboard/values-production.yaml

# Staging values
ls -la metabob-apps/charts/metabob-rpc-api/values-staging.yaml

# If they exist, update image tags there too
```

---

## Step 5: Run Helmfile Diff for Production

Navigate to platform environments directory:
```bash
cd /home/avi/documents/work/platform/environments
```

### 5.1 Check Current Helmfile Configuration
```bash
# Verify helmfile exists
ls -la helmfile.yaml

# List available environments
helmfile list
```

### 5.2 Run Helmfile Diff (Dry Run)
```bash
# Run diff for production environment
helmfile -e production diff

# This will show:
# - What will change (image tags)
# - What resources will be updated
# - Configuration differences
```

**Expected Output**:
```diff
# Example diff output

Comparing release=metabob-rpc-api, chart=metabob-apps/charts/metabob-rpc-api
--- production   (current)
+++ production   (new)

@@ deployment/metabob-rpc-api @@
 spec:
   template:
     spec:
       containers:
       - name: api-server
-        image: metabobapp/metabob-rpc-api:0.16.12
+        image: metabobapp/metabob-rpc-api:0.16.13

       - name: worker
-        image: metabobapp/metabob-rpc-api-worker:0.16.0
+        image: metabobapp/metabob-rpc-api-worker:0.16.1

Comparing release=metabob-dashboard, chart=metabob-apps/charts/metabob-dashboard
@@ deployment/metabob-dashboard @@
 spec:
   template:
     spec:
       containers:
       - name: dashboard
-        image: metabobapp/metabob-dashboard:2.2.1
+        image: metabobapp/metabob-dashboard:2.2.2
```

### 5.3 Save Diff Output
```bash
# Save diff to file for review
helmfile -e production diff > /tmp/helmfile-production-diff-$(date +%Y%m%d-%H%M%S).txt

# Or with color output
helmfile -e production diff --color | tee /tmp/helmfile-production-diff-$(date +%Y%m%d-%H%M%S).txt
```

---

## Step 6: Review and Validate Changes

### 6.1 Review Diff Output
```bash
# Review the diff file
cat /tmp/helmfile-production-diff-*.txt

# Or use less for scrolling
less /tmp/helmfile-production-diff-*.txt
```

### 6.2 Validate Changes Checklist

**Before proceeding, verify**:

- [ ] Only image tags changed (no unexpected config changes)
- [ ] Image versions are correct (0.16.13, 0.16.1, 2.2.2)
- [ ] No changes to:
  - Environment variables
  - Resource limits
  - Service configurations
  - Ingress rules
  - Secrets or ConfigMaps (unless intentional)

**Red Flags** (stop and investigate):
- ❌ Unexpected service deletions
- ❌ Changed environment variables you didn't intend
- ❌ Modified resource limits
- ❌ Changed secrets or ConfigMaps
- ❌ Ingress/Gateway configuration changes

**Expected Changes** (safe to proceed):
- ✅ Image tag updates only
- ✅ Deployment metadata (revision numbers, timestamps)
- ✅ Pod template spec (from image changes)

### 6.3 Verify Image Availability
```bash
# Pull images to verify they exist on Docker Hub
docker pull metabobapp/metabob-rpc-api:0.16.13
docker pull metabobapp/metabob-rpc-api-worker:0.16.1
docker pull metabobapp/metabob-dashboard:2.2.2

# Check image sizes and details
docker images | grep metabobapp
```

---

## Step 7: Apply Changes (When Ready)

### 7.1 Helmfile Apply (Production)
```bash
# Apply changes to production
helmfile -e production apply

# Or with confirmation prompt
helmfile -e production apply --interactive
```

### 7.2 Monitor Deployment
```bash
# Watch pod rollout
kubectl get pods -n metabob-production -w

# Check deployment status
helmfile -e production status

# Verify new image versions
kubectl describe deployment metabob-rpc-api -n metabob-production | grep Image
kubectl describe deployment metabob-dashboard -n metabob-production | grep Image
```

---

## Rollback Procedure (If Issues Occur)

### If Deployment Fails
```bash
# Option 1: Helmfile rollback
helmfile -e production apply --rollback

# Option 2: Restore values files from backup
cd /home/avi/documents/work/platform/metabob-apps/charts/metabob-rpc-api
cp values.yaml.bak values.yaml

cd ../metabob-dashboard
cp values.yaml.bak values.yaml

# Re-run diff and apply with old versions
helmfile -e production diff
helmfile -e production apply
```

### If Pods CrashLoop
```bash
# Check logs
kubectl logs -f deployment/metabob-rpc-api -n metabob-production
kubectl logs -f deployment/metabob-dashboard -n metabob-production

# Scale down
kubectl scale deployment metabob-rpc-api --replicas=0 -n metabob-production

# Fix issue and scale up
kubectl scale deployment metabob-rpc-api --replicas=2 -n metabob-production
```

---

## Quick Reference Commands

### Docker Push Workflow
```bash
# RPC API
cd repos/metabob-rpc-api
docker compose build server worker
docker compose push server worker

# Dashboard
cd repos/metabob-dashboard
docker compose build dashboard
docker compose push dashboard
```

### Helm Values Update
```bash
cd /home/avi/documents/work/platform/metabob-apps/charts

# metabob-rpc-api
sed -i 's/tag: "0.16.12"/tag: "0.16.13"/' metabob-rpc-api/values.yaml

# metabob-dashboard
sed -i 's/tag: "2.2.1"/tag: "2.2.2"/' metabob-dashboard/values.yaml
```

### Helmfile Diff
```bash
cd /home/avi/documents/work/platform/environments
helmfile -e production diff > /tmp/diff-output.txt
```

---

## Troubleshooting

### Issue: "Cannot access /home/avi/documents/work/platform"

**Cause**: Platform directory is outside metabob-devbob scope

**Solution**: Run commands from correct directory
```bash
# Navigate to platform directory first
cd /home/avi/documents/work/platform

# Then run helmfile commands
cd environments
helmfile -e production diff
```

### Issue: "Docker push denied"

**Cause**: Not logged in to Docker Hub or insufficient permissions

**Solution**:
```bash
# Login to Docker Hub
docker login

# Verify you have push access to metabobapp org
# Contact org admin if needed
```

### Issue: "Image not found" during deployment

**Cause**: Image wasn't pushed or wrong tag

**Solution**:
```bash
# Verify image exists on Docker Hub
docker pull metabobapp/metabob-rpc-api:0.16.13

# Check Docker Hub web interface
# https://hub.docker.com/r/metabobapp/metabob-rpc-api/tags
```

### Issue: Helmfile diff shows unexpected changes

**Cause**: Values file has other modifications

**Solution**:
```bash
# Review git diff
cd /home/avi/documents/work/platform/metabob-apps
git diff

# Restore to clean state if needed
git checkout -- charts/*/values.yaml

# Re-apply just the image tag changes
```

---

## What to Expect

### Helmfile Diff Output Size

**Normal**: 50-200 lines per service
- Image tag changes
- Deployment metadata updates
- Pod template hash changes

**Concerning**: 500+ lines or widespread changes
- Review carefully before proceeding
- May indicate configuration drift

### Deployment Duration

**Expected Times**:
- metabob-rpc-api: 2-5 minutes (rolling update)
- metabob-dashboard: 1-3 minutes (rolling update)
- Total: 5-10 minutes for complete rollout

### Health Checks

**After deployment, verify**:
```bash
# API health
curl https://api.metabob.com/health

# Dashboard access
curl -I https://dashboard.metabob.com

# Pod status
kubectl get pods -n metabob-production
```

---

## Version Tracking

### Current Versions (Before Update)
- metabob-rpc-api: `0.16.12`
- metabob-rpc-api-worker: `0.16.0`
- metabob-dashboard: `2.2.1`

### New Versions (After Update)
- metabob-rpc-api: `0.16.13` ← **Update includes template migration**
- metabob-rpc-api-worker: `0.16.1` ← **Update if worker changed**
- metabob-dashboard: `2.2.2` ← **Update if dashboard changed**

### What's Included in This Update

**metabob-rpc-api 0.16.13**:
- ✅ V2 template schema migration (16/16 templates)
- ✅ Template loading fixes
- ✅ Backend template registration improvements
- ✅ Activity system enhancements

**metabob-rpc-api-worker 0.16.1**:
- Check if worker code changed
- May not need update if no changes

**metabob-dashboard 2.2.2**:
- Check if dashboard code changed
- May not need update if no changes

---

## Summary Workflow

```bash
# 1. Build and push images
cd ~/documents/work/exp-repo/metabob-devbob/repos/metabob-rpc-api
docker compose build server && docker compose push server

cd ~/documents/work/exp-repo/metabob-devbob/repos/metabob-dashboard
docker compose build dashboard && docker compose push dashboard

# 2. Update Helm values
cd ~/documents/work/platform/metabob-apps/charts
vim metabob-rpc-api/values.yaml  # Update image tag to 0.16.13
vim metabob-dashboard/values.yaml  # Update image tag to 2.2.2

# 3. Run Helmfile diff
cd ~/documents/work/platform/environments
helmfile -e production diff > /tmp/diff-output.txt

# 4. Review diff
cat /tmp/diff-output.txt

# 5. Apply when ready
helmfile -e production apply --interactive
```

---

**Document Created**: February 16, 2026  
**Status**: Ready for execution  
**Next Steps**: Follow workflow above to push images and check Helmfile diff
