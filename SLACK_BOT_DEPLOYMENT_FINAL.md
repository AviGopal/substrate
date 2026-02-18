# Slack Bot Deployment - Final Configuration

## ✅ Setup Complete - Ready for Helmfile Deployment

The Slack bot is now configured to use the `ide.metabob.com` backend and is ready to be deployed as part of your regular helmfile deployment.

---

## 📋 What Was Changed

### 1. Backend Configuration
- **Bot now connects to**: `https://ide.metabob.com` (shared backend)
- **No local server**: Uses existing metabob-rpc-api infrastructure
- **Environment variable**: `OPENCODE_BACKEND_URL` controls backend connection

### 2. Slack Bot Code Updated
- Modified `repos/metabob-opencode/packages/slack/src/index.ts`
- Added support for external backend via `createOpencodeClient()`
- Falls back to local server if `OPENCODE_BACKEND_URL` not set

### 3. Docker Image
- **Image**: `metabobapp/slack-bot:v1.0.1`
- **Latest tag**: `metabobapp/slack-bot:latest`
- **Published**: ✅ Pushed to Docker Hub
- **Dockerfile**: `repos/metabob-opencode/packages/slack/Dockerfile.prod`

### 4. Kubernetes Configuration
- **Values file (production)**: `repos/platform/metabob-apps/charts/slack-bot/values/production.slack-bot.values.yaml`
  ```yaml
  opencode:
    backendUrl: "https://ide.metabob.com"
  image:
    tag: "v1.0.1"
  ```

- **Secrets file**: `repos/platform/metabob-apps/charts/slack-bot/values/production.slack-bot.secrets.yaml`
  - Contains: SLACK_BOT_TOKEN, SLACK_SIGNING_SECRET, SLACK_APP_TOKEN
  - **Gitignored**: ✅ Safe from accidental commits

- **Helmfile**: Already configured in `repos/platform/metabob-apps/helmfile.yaml.gotmpl`
  - Depends on: `config`, `metabob-rpc-api`
  - Namespace: `metabob`

---

## 🚀 Deployment Instructions

### Deploy slack-bot with Regular Helmfile Workflow

```bash
# Navigate to metabob-apps
cd repos/platform/metabob-apps

# Deploy to production environment
helmfile -e production apply

# Or deploy only slack-bot
helmfile -e production -l name=slack-bot apply
```

### Verify Deployment

```bash
# Check deployment status
kubectl -n metabob get deployments slack-bot

# Check pod logs
kubectl -n metabob logs -f deployment/slack-bot

# Expected logs:
# 🔧 Bot configuration:
# - Bot token present: true
# - Signing secret present: true
# - App token present: true
# 🔗 Connecting to external backend: https://ide.metabob.com
# ✅ Connected to external backend
# ⚡️ Slack bot is running!
```

---

## 🔧 Configuration Files Summary

| File | Location | Purpose |
|------|----------|---------|
| **Production Values** | `charts/slack-bot/values/production.slack-bot.values.yaml` | Backend URL, image tag |
| **Production Secrets** | `charts/slack-bot/values/production.slack-bot.secrets.yaml` | Slack tokens (gitignored) |
| **Default Values** | `charts/slack-bot/values/default.slack-bot.values.yaml` | Local dev configuration |
| **Deployment Template** | `charts/slack-bot/templates/deployment.yaml` | Kubernetes deployment |
| **Secret Template** | `charts/slack-bot/templates/secret.yaml` | Kubernetes secret |
| **Helmfile** | `helmfile.yaml.gotmpl` | Release configuration |

---

## 🧪 Testing the Bot

### 1. After Deployment

```bash
# Wait for pod to be running
kubectl -n metabob wait --for=condition=ready pod -l app.kubernetes.io/name=slack-bot --timeout=60s

# Check logs for successful connection
kubectl -n metabob logs deployment/slack-bot | grep -E "(Connected|running)"
```

### 2. Test in Slack

1. Open Slack (mahnarc.slack.com)
2. Find "devbob" app in Apps
3. Send a DM: `Hello!`
4. Expected response: Bot creates a session and responds
5. Try commands:
   - `/status` - View session state
   - `/activities` - List active activities
   - `/session-info` - Detailed info

### 3. Verify Backend Connection

The bot should:
- ✅ Connect to `ide.metabob.com`
- ✅ Create sessions on the shared backend
- ✅ Not start a local server
- ✅ Use existing metabob-rpc-api infrastructure

---

## 🎯 Architecture

```
┌─────────────────┐
│   Slack Users   │
└────────┬────────┘
         │ Socket Mode (WebSocket)
         ▼
┌─────────────────┐
│   Slack Bot     │  ← Deployed via helmfile
│  (Kubernetes)   │     namespace: metabob
└────────┬────────┘
         │ HTTP/WebSocket
         ▼
┌─────────────────┐
│ ide.metabob.com │  ← Existing backend
│  (RPC API)      │     metabob-rpc-api service
└─────────────────┘
         │
         ▼
┌─────────────────┐
│   SurrealDB     │
│     Redis       │
└─────────────────┘
```

---

## 🔐 Security Notes

1. **Secrets Management**:
   - Tokens stored in Kubernetes secrets
   - Secrets file gitignored (pattern: `*secrets.yaml`)
   - Never commit tokens to git

2. **Backend Connection**:
   - Uses HTTPS to ide.metabob.com
   - Shared backend with existing infrastructure
   - No exposed endpoints (Socket Mode)

3. **Network**:
   - Bot connects outbound to Slack via Socket Mode
   - No inbound connections required
   - Internal-only connection to metabob-rpc-api

---

## 📚 Additional Commands

### Update Image

```bash
# After rebuilding image with new version
cd repos/platform/metabob-apps
helmfile -e production -l name=slack-bot apply

# Or force pod restart
kubectl -n metabob rollout restart deployment/slack-bot
```

### View Full Logs

```bash
# Stream logs
kubectl -n metabob logs -f deployment/slack-bot

# Last 100 lines
kubectl -n metabob logs --tail=100 deployment/slack-bot

# Logs from all replicas
kubectl -n metabob logs -l app.kubernetes.io/name=slack-bot
```

### Scale Bot

```bash
# Scale to 2 replicas (if needed)
kubectl -n metabob scale deployment/slack-bot --replicas=2

# Or update in production.slack-bot.values.yaml:
# replicaCount: 2
```

### Debug Issues

```bash
# Describe pod
kubectl -n metabob describe pod -l app.kubernetes.io/name=slack-bot

# Get events
kubectl -n metabob get events --sort-by='.lastTimestamp' | grep slack-bot

# Check secret
kubectl -n metabob get secret slack-bot -o yaml

# Exec into pod
kubectl -n metabob exec -it deployment/slack-bot -- /bin/sh
```

---

## ✨ Key Benefits of This Setup

1. **Shared Backend**: Uses ide.metabob.com infrastructure
2. **No Duplication**: Single backend for dashboard, CLI, and Slack
3. **Simplified Management**: Deploy via regular helmfile workflow
4. **Production Ready**: Proper secrets, health checks, resource limits
5. **Scalable**: Can scale independently if needed

---

## 🎉 Ready to Deploy!

```bash
cd repos/platform/metabob-apps
helmfile -e production -l name=slack-bot apply
```

---

**Date**: February 17, 2026  
**Environment**: Production (metabob-apps)  
**Backend**: ide.metabob.com  
**Image**: metabobapp/slack-bot:v1.0.1  
**Workspace**: Metabob (mahnarc.slack.com)  
**App**: devbob (A0AGF05JFPA)
