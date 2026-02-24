# DevBob + Slack Bot Production Deployment Guide

## 📋 Overview

This guide covers deploying DevBob (OpenCode server) and Slack Bot integration to production Kubernetes cluster.

---

## 🏗️ Architecture

```
Slack Workspace (mahnarc.slack.com)
         ↕ Socket Mode (WebSocket)
    slack-bot pod
         ↓ HTTP
    opencode-server:8080 (ClusterIP)
         ↓ WebSocket
    surrealdb:8000
         ↓ PersistentVolume (50Gi)
    Persistent Storage
```

### Components:

| Component | Image | Purpose |
|-----------|-------|---------|
| **opencode-server** | `metabobapp/devbob:latest` | OpenCode ACP server for LLM orchestration |
| **slack-bot** | `metabobapp/slack-bot:v1.0.3` | Slack integration bridge |
| **surrealdb** | `surrealdb/surrealdb` | Persistent data store |

### Communication Flow:

1. **User → Slack → slack-bot** (Socket Mode WebSocket)
2. **slack-bot → opencode-server** (HTTP: POST /sessions/:id/prompt)
3. **opencode-server → Claude API** (LLM orchestration)
4. **opencode-server → surrealdb** (Session persistence)
5. **opencode-server → slack-bot** (Response + SSE events)
6. **slack-bot → Slack** (Status updates, tool events)

---

## 🚀 Deployment Steps

### Prerequisites:

- Access to `metabob-production` Kubernetes cluster
- kubectl configured for production context
- Helmfile installed
- Anthropic API key in secrets file

### Step 1: Deploy All Components

Run the deployment script:

```bash
./deploy-devbob-and-slack-bot.sh
```

This script will:
1. ✅ Deploy `opencode-server` (devbob) pod
2. ✅ Update and deploy `slack-bot` with correct backend URL
3. ✅ Add temporary `devbob.metabob.com` VirtualService for debugging
4. ✅ Verify all deployments
5. ✅ Test connectivity

### Step 2: Verify Deployment

Check pod status:
```bash
kubectl get pods -n metabob -l app.kubernetes.io/name=opencode-server
kubectl get pods -n metabob -l app.kubernetes.io/name=slack-bot
```

Expected output:
```
NAME                               READY   STATUS    RESTARTS   AGE
opencode-server-xxxxxxxxxx-xxxxx   1/1     Running   0          2m
slack-bot-xxxxxxxxxx-xxxxx         1/1     Running   0          1m
```

Check logs:
```bash
# OpenCode server logs
kubectl logs -n metabob -l app.kubernetes.io/name=opencode-server --tail=50

# Slack bot logs
kubectl logs -n metabob -l app.kubernetes.io/name=slack-bot --tail=50
```

### Step 3: Test Slack Integration

1. Open Slack workspace (mahnarc.slack.com)
2. Send a message to the bot: `"Hello"`
3. Verify bot responds
4. Try a complex task: `"Add a REST endpoint for user profiles"`
5. Watch for activity updates in thread

Expected behavior:
- Bot creates OpenCode session
- Bot shares session URL
- Bot posts activity start notification
- Bot streams tool execution events
- Bot posts completion notification

### Step 4: Debug (If Needed)

#### Debug via External Route (TEMPORARY):

Access DevBob directly:
```bash
# Health check
curl https://devbob.metabob.com/health

# Create session
curl -X POST https://devbob.metabob.com/sessions \
  -H "Content-Type: application/json" \
  -d '{"title": "Test Session"}'

# Send prompt
curl -X POST https://devbob.metabob.com/sessions/SESSION_ID/prompt \
  -H "Content-Type: application/json" \
  -d '{"parts": [{"type": "text", "text": "Hello"}]}'
```

#### Debug via Kubectl Port-Forward:

```bash
# Forward opencode-server port
kubectl port-forward -n metabob svc/opencode-server 8080:8080

# Test locally
curl http://localhost:8080/health
```

#### Check Slack Bot Logs:

```bash
# Follow logs in real-time
kubectl logs -n metabob -l app.kubernetes.io/name=slack-bot -f

# Search for errors
kubectl logs -n metabob -l app.kubernetes.io/name=slack-bot | grep -i error
```

### Step 5: Remove Debug Route (AFTER TESTING)

⚠️ **IMPORTANT**: The `devbob.metabob.com` external route is for debugging ONLY.

Remove it after testing:
```bash
./remove-devbob-debug-route.sh
```

This will:
- Remove the `devbob-debug` VirtualService
- Keep internal `opencode-server:8080` service intact
- Slack bot continues to work via internal service

---

## 🔧 Configuration

### OpenCode Server Configuration:

**File**: `repos/platform/metabob-apps/charts/opencode-server/values/production.opencode-server.values.yaml`

```yaml
replicaCount: 1

image:
  repository: metabobapp/devbob
  tag: "latest"

resources:
  limits:
    cpu: 1000m
    memory: 2Gi
  requests:
    cpu: 250m
    memory: 1Gi

opencode:
  hostname: "0.0.0.0"
  port: 8080

service:
  type: ClusterIP
  port: 8080
```

**Secrets**: `production.opencode-server.secrets.yaml`
```yaml
providers:
  anthropic: "sk-ant-api03-..."
```

### Slack Bot Configuration:

**File**: `repos/platform/metabob-apps/charts/slack-bot/values/production.slack-bot.values.yaml`

```yaml
replicaCount: 1

image:
  repository: metabobapp/slack-bot
  tag: "v1.0.3"

resources:
  limits:
    cpu: 1000m
    memory: 512Mi
  requests:
    cpu: 200m
    memory: 256Mi

# OpenCode configuration - connect to internal devbob service
opencode:
  backendUrl: "http://opencode-server:8080"
```

**Secrets**: `production.slack-bot.secrets.yaml`
```yaml
slack:
  botToken: "xoxb-..."
  appToken: "xapp-..."
  signingSecret: "..."
```

---

## 📊 Data Flow & Persistence

### Session Data:

All OpenCode session data persists in SurrealDB:
- **Database**: `production`
- **Namespace**: `metabob`
- **Storage**: 50Gi PVC (survives pod restarts)

Tables:
- `sessions` - Session metadata
- `messages` - Conversation history
- `activities` - Activity execution state
- `impulses` - Context data
- `templates` - Activity templates

### Temporary Storage:

- `/workspace` (emptyDir) - Activity workspace files
- Lost on pod restart
- Not critical (session state persists in DB)

---

## 🔍 Troubleshooting

### Issue: Slack bot not responding

**Check 1**: Verify opencode-server is running
```bash
kubectl get pods -n metabob -l app.kubernetes.io/name=opencode-server
```

**Check 2**: Verify slack-bot config
```bash
kubectl get deployment -n metabob slack-bot -o yaml | grep OPENCODE_BACKEND_URL
```
Should show: `http://opencode-server:8080`

**Check 3**: Check slack-bot logs for connection errors
```bash
kubectl logs -n metabob -l app.kubernetes.io/name=slack-bot --tail=100 | grep -i error
```

### Issue: "Failed to create session" error

**Check 1**: Verify opencode-server health
```bash
kubectl exec -n metabob deployment/opencode-server -- curl -s http://localhost:8080/health
```

**Check 2**: Check opencode-server logs
```bash
kubectl logs -n metabob -l app.kubernetes.io/name=opencode-server --tail=100
```

**Check 3**: Verify SurrealDB connection
```bash
kubectl get svc -n metabob surrealdb
kubectl logs -n metabob -l app.kubernetes.io/name=surrealdb --tail=50
```

### Issue: Anthropic API errors

**Check 1**: Verify API key is in secret
```bash
kubectl get secret -n metabob opencode-server -o yaml | grep anthropic
```

**Check 2**: Test API key manually
```bash
# From opencode-server pod
kubectl exec -n metabob deployment/opencode-server -- sh -c 'echo $ANTHROPIC_API_KEY'
```

### Issue: devbob.metabob.com returns 404

**Check 1**: Verify VirtualService exists
```bash
kubectl get virtualservice -n metabob devbob-debug
```

**Check 2**: Check Istio gateway
```bash
kubectl get gateway -n metabob metabob-gateway -o yaml | grep devbob
```

**Check 3**: DNS resolution
```bash
nslookup devbob.metabob.com
```

---

## 🧹 Cleanup (Remove Debug Route)

### When to Remove:

After confirming:
- ✅ Slack bot is responding correctly
- ✅ Activities are executing successfully
- ✅ Session persistence is working
- ✅ No debugging needed anymore

### How to Remove:

```bash
./remove-devbob-debug-route.sh
```

### What Gets Removed:

- ❌ External route: `devbob.metabob.com`
- ❌ VirtualService: `devbob-debug`

### What Stays:

- ✅ Internal service: `opencode-server:8080`
- ✅ Slack bot connectivity (uses internal service)
- ✅ All pods and deployments
- ✅ SurrealDB data

---

## 📝 Manual Deployment Commands

If you prefer manual deployment:

```bash
cd repos/platform/metabob-apps

# Deploy opencode-server
helmfile -e production sync --selector name=opencode-server --wait

# Deploy slack-bot
helmfile -e production sync --selector name=slack-bot --wait

# Deploy istio routing
helmfile -e production sync --selector name=istio-application --wait

# Verify
kubectl get pods -n metabob -l 'app.kubernetes.io/name in (opencode-server,slack-bot)'
```

---

## 🎯 Success Criteria

Deployment is successful when:

1. ✅ `opencode-server` pod is Running
2. ✅ `slack-bot` pod is Running
3. ✅ Slack bot responds to messages
4. ✅ Activities execute successfully
5. ✅ Session data persists in SurrealDB
6. ✅ Tool events stream to Slack in real-time

---

## 📚 Related Documentation

- [Slack Bot Architecture](./repos/platform/metabob-apps/charts/slack-bot/SLACK_BOT_ARCHITECTURE.md)
- [OpenCode Server Chart](./repos/platform/metabob-apps/charts/opencode-server/)
- [Istio Routing](./repos/platform/metabob-apps/charts/istio-application/)

---

## ⚠️ Important Notes

1. **devbob.metabob.com is TEMPORARY** - Remove after debugging
2. **Internal service always available** - `opencode-server:8080` for cluster-internal access
3. **Data persists in SurrealDB** - Session data survives pod restarts
4. **Slack bot uses internal service** - No external access needed for production
5. **Anthropic API key required** - Must be in secrets file

---

## 🔐 Security Considerations

- Slack tokens stored in Kubernetes secrets
- Anthropic API key stored in Kubernetes secrets
- OpenCode server only accessible via ClusterIP (internal)
- External route (devbob.metabob.com) is TEMPORARY and should be removed
- All traffic uses TLS via Istio gateway

---

*Last updated: $(date)*
