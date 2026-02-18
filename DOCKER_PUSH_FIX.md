# Docker Push Issue - Authentication Required

## Problem

The slack-bot image was built successfully but cannot be pulled by Kubernetes because:
1. The `metabobapp/slack-bot` repository doesn't exist on Docker Hub yet
2. We need Docker Hub credentials to create the repository and push to it

## Current Status

- ✅ Image built locally: `metabobapp/slack-bot:v1.0.1`
- ❌ Cannot push to Docker Hub: "push access denied"
- ❌ Kubernetes cannot pull: "image not found"

## Solution

### Step 1: Log in to Docker Hub

```bash
# Log in with metabobapp organization credentials
docker login

Username: <metabobapp username>
Password: <access token or password>
```

### Step 2: Push the Image

```bash
# Push v1.0.1
docker push metabobapp/slack-bot:v1.0.1

# Push latest
docker push metabobapp/slack-bot:latest
```

### Step 3: Restart the Deployment

```bash
# Restart to pull the now-available image
kubectl -n metabob rollout restart deployment/slack-bot

# Watch the pod start
kubectl -n metabob get pods -l app.kubernetes.io/name=slack-bot -w
```

### Step 4: Verify

```bash
# Check logs for successful connection
kubectl -n metabob logs -f deployment/slack-bot

# Expected output:
# 🔧 Bot configuration:
# - Bot token present: true
# - Signing secret present: true
# - App token present: true
# 🔗 Connecting to external backend: https://ide.metabob.com
# ✅ Connected to external backend
# ⚡️ Slack bot is running!
```

## Alternative: Use a Different Registry

If you don't have access to the metabobapp Docker Hub organization, you can:

### Option A: Use GitHub Container Registry (ghcr.io)

```bash
# Tag for GitHub Container Registry
docker tag metabobapp/slack-bot:v1.0.1 ghcr.io/metabob/slack-bot:v1.0.1

# Login to GitHub Container Registry
echo $GITHUB_TOKEN | docker login ghcr.io -u USERNAME --password-stdin

# Push
docker push ghcr.io/metabob/slack-bot:v1.0.1

# Update Kubernetes deployment
kubectl -n metabob set image deployment/slack-bot slack-bot=ghcr.io/metabob/slack-bot:v1.0.1
```

### Option B: Use Your Personal Docker Hub Account

```bash
# Tag with your username
docker tag metabobapp/slack-bot:v1.0.1 YOUR_USERNAME/slack-bot:v1.0.1

# Push
docker push YOUR_USERNAME/slack-bot:v1.0.1

# Update values file
# Edit: repos/platform/metabob-apps/charts/slack-bot/charts/values.yaml
# Change: repository: YOUR_USERNAME/slack-bot

# Apply changes
cd repos/platform/metabob-apps
helmfile -e production -l name=slack-bot apply
```

## Quick Fix Script

```bash
#!/bin/bash
# Run this after docker login

echo "🔐 Pushing slack-bot images to Docker Hub..."
docker push metabobapp/slack-bot:v1.0.1
docker push metabobapp/slack-bot:latest

echo "🔄 Restarting deployment..."
kubectl -n metabob rollout restart deployment/slack-bot

echo "⏳ Waiting for pod to be ready..."
kubectl -n metabob wait --for=condition=ready pod -l app.kubernetes.io/name=slack-bot --timeout=120s

echo "📋 Checking logs..."
kubectl -n metabob logs -f deployment/slack-bot
```

## Image Details

- **Local Image ID**: `3bd965b2f14b`
- **Digest**: `sha256:3bd965b2f14bf65254b5abc165825b2031e94d3481a2c57560942142976aadfc`
- **Size**: 1.56GB (389MB compressed)
- **Created**: 2026-02-17 22:00:19
- **Target Repository**: `metabobapp/slack-bot`
- **Tags Needed**: `v1.0.1`, `latest`
