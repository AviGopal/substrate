# Slack Bot Deployment Plan - Option 2: Shared Server

## Architecture

```
┌──────────────────────────────────────┐
│  opencode-server Deployment          │
│  Image: metabobapp/devbob:latest     │
│  Command: opencode acp --port=8080   │
│  Size: 11.2GB (3GB compressed)       │
│  Service: opencode-server:8080       │
└────────────────┬─────────────────────┘
                 │ HTTP
        ┌────────┴────────┐
        │                 │
┌───────▼──────┐  ┌──────▼──────┐
│ slack-bot-1  │  │ slack-bot-2 │
│ v1.0.2       │  │ v1.0.2      │
│ 1.56GB       │  │ 1.56GB      │
└──────────────┘  └─────────────┘
        │                 │
        └────────┬────────┘
                 │ Socket Mode
        ┌────────▼────────┐
        │  Slack Workspace│
        └─────────────────┘
```

## Components Created

### 1. OpenCode Server Chart
**Location**: `repos/platform/metabob-apps/charts/opencode-server/`

**Files**:
- `charts/Chart.yaml` - Chart metadata
- `charts/values.yaml` - Default values
- `charts/templates/deployment.yaml` - Deployment
- `charts/templates/service.yaml` - Service (ClusterIP on port 8080)
- `charts/templates/secret.yaml` - API keys
- `charts/templates/serviceaccount.yaml` - ServiceAccount
- `charts/templates/_helpers.tpl` - Template helpers
- `values/production.opencode-server.values.yaml` - Production config
- `values/production.opencode-server.secrets.yaml` - Production secrets

**Configuration**:
```yaml
image: devbob:latest
command: ["opencode", "acp", "--hostname=0.0.0.0", "--port=8080"]
env:
  ANTHROPIC_API_KEY: <from-secret>
  WORKSPACE_PATH: /workspace
resources:
  limits: {cpu: 2000m, memory: 4Gi}
  requests: {cpu: 500m, memory: 2Gi}
```

### 2. Updated Slack Bot Configuration

**Changed Files**:
- `helmfile.yaml.gotmpl` - Added opencode-server release, made slack-bot depend on it
- `slack-bot/values/production.slack-bot.secrets.yaml`:
  - `opencode.backendUrl: "http://opencode-server:8080"` (was: "")
- `slack-bot/charts/templates/secret.yaml` - Fixed duplicate secret
- `slack-bot/charts/templates/deployment.yaml` - Added ANTHROPIC_API_KEY env var

**Configuration**:
```yaml
image: metabobapp/slack-bot:v1.0.2  # Already pushed
env:
  OPENCODE_BACKEND_URL: "http://opencode-server:8080"
  SLACK_BOT_TOKEN: <from-secret>
  SLACK_APP_TOKEN: <from-secret>
  SLACK_SIGNING_SECRET: <from-secret>
```

## Deployment Status

### Images

| Image | Status | Size | Location |
|-------|--------|------|----------|
| `metabobapp/slack-bot:v1.0.2` | ✅ Pushed | 1.56GB (389MB) | Docker Hub |
| `metabobapp/devbob:latest` | ⏳ Pushing | 11.2GB (3GB est.) | Docker Hub |

**DevBob Push Progress**: Started at 00:20, estimated 2-4 hours

### Helm Releases

**Order**:
1. `config` (existing)
2. `opencode-server` (NEW)
3. `slack-bot` (updated)

## Deployment Steps

### Step 1: Wait for DevBob Image Push
```bash
# Check push status
ps aux | grep "docker push.*devbob"

# Or try to pull (will fail until push completes)
docker pull metabobapp/devbob:latest
```

### Step 2: Deploy OpenCode Server
```bash
cd repos/platform/metabob-apps

# Dry run first
helmfile -e production diff --selector name=opencode-server

# Deploy
helmfile -e production sync --selector name=opencode-server

# Verify
kubectl -n metabob get pods -l app.kubernetes.io/name=opencode-server
kubectl -n metabob logs -f -l app.kubernetes.io/name=opencode-server
```

**Expected logs**:
```
========================================
Devbob Container Starting
========================================
...
opencode server listening on http://0.0.0.0:8080
```

### Step 3: Update Slack Bot
```bash
# Dry run
helmfile -e production diff --selector name=slack-bot

# Deploy
helmfile -e production sync --selector name=slack-bot

# Verify
kubectl -n metabob get pods -l app.kubernetes.io/name=slack-bot
kubectl -n metabob logs -f -l app.kubernetes.io/name=slack-bot -c slack-bot
```

**Expected logs**:
```
🔧 Bot configuration:
- Bot token present: true
- Signing secret present: true
- App token present: true
🔗 Connecting to external backend: http://opencode-server:8080
✅ Connected to external backend
⚡️ Slack bot is running!
```

### Step 4: Test in Slack
1. Go to Slack channel
2. Send message to bot
3. Bot should create session and respond
4. Try an activity: "Add a logging function to the codebase"
5. Bot should show activity progress updates

## Health Checks

### OpenCode Server
```bash
# Check if service is accessible
kubectl -n metabob run curl-test --image=curlimages/curl --rm -it -- \
  curl -v http://opencode-server:8080/health

# Expected: {"status":"ok"}
```

### Slack Bot
```bash
# Check env vars are correct
kubectl -n metabob exec -it deployment/slack-bot -c slack-bot -- \
  env | grep -E "OPENCODE|SLACK|ANTHROPIC"

# Expected:
# OPENCODE_BACKEND_URL=http://opencode-server:8080
# SLACK_BOT_TOKEN=xoxb-...
# SLACK_APP_TOKEN=xapp-...
# SLACK_SIGNING_SECRET=...
# ANTHROPIC_API_KEY=sk-ant-... (if set)
```

## Rollback Plan

If something goes wrong:

### Rollback Slack Bot
```bash
# Revert to previous config (pointing to ide.metabob.com)
git revert <commit-hash>
helmfile -e production sync --selector name=slack-bot
```

### Remove OpenCode Server
```bash
helmfile -e production destroy --selector name=opencode-server
```

## Monitoring

### OpenCode Server Metrics
```bash
kubectl -n metabob top pod -l app.kubernetes.io/name=opencode-server
kubectl -n metabob describe pod -l app.kubernetes.io/name=opencode-server
```

### Slack Bot Metrics
```bash
kubectl -n metabob top pod -l app.kubernetes.io/name=slack-bot
kubectl -n metabob get events --field-selector involvedObject.name=slack-bot --sort-by='.lastTimestamp'
```

## Known Limitations

1. **Session Persistence**: Sessions stored in opencode-server pod
   - If pod restarts, active sessions lost
   - Solution: Add persistent volume for `/workspace`

2. **Single Point of Failure**: Only 1 opencode-server replica
   - If server crashes, slack-bot can't work
   - Solution: Add health checks and auto-restart

3. **No Session Sharing**: Each slack thread = new session
   - Can't continue session across threads
   - Solution: Implement session persistence/lookup

4. **Image Size**: devbob:latest is 11.2GB
   - Slow to pull on new nodes
   - Solution: Build optimized image (future)

## Future Improvements

1. **Persistent Storage**: Add PVC for `/workspace`
2. **Multiple Replicas**: Scale opencode-server with session affinity
3. **Optimized Image**: Build slim opencode server image (~2GB)
4. **Metrics**: Add Prometheus metrics for session/activity tracking
5. **Ingress**: Expose opencode-server web UI for debugging

## Timeline

| Task | Duration | Status |
|------|----------|--------|
| Create opencode-server chart | 30min | ✅ Done |
| Update slack-bot config | 15min | ✅ Done |
| Push devbob image | 2-4hrs | ⏳ In Progress |
| Deploy opencode-server | 5min | ⏸️ Waiting for image |
| Deploy slack-bot | 5min | ⏸️ Waiting for server |
| Test in Slack | 10min | ⏸️ Waiting for deployment |

**Total Estimated Time**: 3-5 hours (mostly waiting for image push)

---

**Created**: February 18, 2026  
**Status**: Image push in progress  
**Next**: Wait for push, then deploy opencode-server  
