# Slack Bot Deployment Guide

Complete guide for deploying the OpenCode Slack bot with activity monitoring to your infrastructure.

## Prerequisites Checklist

- [ ] Slack workspace with admin access
- [ ] Docker installed and logged in to metabobapp
- [ ] Kubernetes cluster access
- [ ] helmfile installed
- [ ] Firefox profile with mahnarc.slack.com cookies (optional)
- [ ] devbob container running

## Step 1: Slack App Configuration

### Create Slack App

1. Go to https://api.slack.com/apps
2. Click "Create New App" → "From scratch"
3. Name: "OpenCode Bot"
4. Workspace: Select your workspace

### Enable Socket Mode

1. Go to "Socket Mode" in sidebar
2. Enable Socket Mode
3. Generate App-Level Token:
   - Name: "opencode-socket"
   - Scopes: `connections:write`
   - Save the token (starts with `xapp-`)

### OAuth & Permissions

1. Go to "OAuth & Permissions"
2. Add Bot Token Scopes:
   ```
   app_mentions:read
   chat:write
   chat:write.public
   commands
   im:history
   im:read
   im:write
   ```
3. Install app to workspace
4. Copy "Bot User OAuth Token" (starts with `xoxb-`)

### Slash Commands

Create the following slash commands:

| Command | Request URL | Short Description |
|---------|-------------|-------------------|
| `/status` | (not used - Socket Mode) | View session state |
| `/activities` | (not used - Socket Mode) | List active activities |
| `/session-info` | (not used - Socket Mode) | Detailed session info |
| `/test` | (not used - Socket Mode) | Test bot connectivity |

### Event Subscriptions

1. Go to "Event Subscriptions"
2. Enable Events
3. Subscribe to bot events:
   ```
   app_mention
   message.im
   ```

### Signing Secret

1. Go to "Basic Information"
2. Copy "Signing Secret"

### Token Summary

You should now have:
- ✅ Bot Token (xoxb-...) → `SLACK_BOT_TOKEN`
- ✅ Signing Secret → `SLACK_SIGNING_SECRET`
- ✅ App Token (xapp-...) → `SLACK_APP_TOKEN`

## Step 2: Local Testing

### Set Environment Variables

```bash
export SLACK_BOT_TOKEN="xoxb-your-token-here"
export SLACK_SIGNING_SECRET="your-signing-secret-here"
export SLACK_APP_TOKEN="xapp-your-token-here"
```

### Start Bot Locally

```bash
cd repos/metabob-opencode/packages/slack
npm install
npm start
```

### Test in Slack

1. Invite bot to a channel: `/invite @OpenCode Bot`
2. Send a message: `@OpenCode Bot hello`
3. Bot should respond with session URL
4. Try commands:
   - `/status` - Check session state
   - `/activities` - List activities
   - `/session-info` - Detailed info

## Step 3: Docker Build

### Build Image

```bash
cd repos/metabob-opencode/packages/slack

# Build and push to Docker Hub
./build-and-push.sh

# Or build specific version
./build-and-push.sh v1.0.0
```

### Verify Image

```bash
docker pull metabobapp/slack-bot:latest
docker run --rm metabobapp/slack-bot:latest node --version
# Should output: v22.x.x
```

## Step 4: Kubernetes Deployment

### Configure Secrets

Create secrets file (DO NOT commit to git):

```bash
# Create secrets file
cat > repos/platform/metabob-apps/charts/slack-bot/values/secrets.yaml << EOF
slack:
  botToken: "xoxb-your-actual-token"
  signingSecret: "your-actual-secret"
  appToken: "xapp-your-actual-token"
EOF

# Secure it
chmod 600 repos/platform/metabob-apps/charts/slack-bot/values/secrets.yaml
```

### Configure Firefox Profile (Optional)

If using Firefox profile for Slack auth:

```yaml
# Edit charts/slack-bot/values/default.slack-bot.values.yaml
firefox:
  enabled: true
  profilePath: "/home/avi/.mozilla/firefox/qcd6s4a4.default-release"
```

### Deploy with Helmfile

```bash
cd repos/platform/metabob-apps

# Deploy to default environment
helmfile -e default apply

# Check deployment status
kubectl get pods -n metabob | grep slack-bot

# View logs
kubectl logs -n metabob -f deployment/slack-bot
```

### Verify Deployment

```bash
# Check pod is running
kubectl get pods -n metabob -l app.kubernetes.io/name=slack-bot

# Check logs for startup messages
kubectl logs -n metabob -l app.kubernetes.io/name=slack-bot --tail=50

# Expected logs:
# 🔧 Bot configuration:
# - Bot token present: true
# - Signing secret present: true
# - App token present: true
# 🚀 Starting opencode server...
# ✅ Opencode server ready
# ⚡️ Slack bot is running!
```

## Step 5: Testing End-to-End

### Test Basic Messaging

1. Open Slack workspace (mahnarc.slack.com)
2. DM the bot or mention in channel
3. Send: "Hello, create a session"
4. Expected response:
   ```
   🔗 Session created: https://opencode.dev/session/xyz

   Available Commands:
   • /status - View session state
   • /activities - List active activities
   • /session-info - Detailed session information
   ```

### Test Activity Monitoring

1. Send a complex request:
   ```
   Implement a REST API endpoint for user authentication with JWT tokens
   ```

2. Watch for activity updates:
   ```
   🚀 Activity Started: Add Feature Complete
   Status: executing
   Progress: 1/4 tasks (25%)

   🔧 metabob_search_codebase_issues - Search for similar patterns

   ⏳ Activity Progress: Add Feature Complete
   Status: executing
   Progress: 2/4 tasks (50%)
   Elapsed: 45s

   ✅ Activity Completed: Add Feature Complete
   Duration: 127s
   Tasks: 4/4 completed
   ```

### Test Slash Commands

```
/status
→ Should show session state

/activities
→ Should list active activities

/session-info
→ Should show detailed info
```

### Test devbob Integration

1. Ensure devbob container is running:
   ```bash
   docker ps | grep devbob
   ```

2. Send request that requires devbob:
   ```
   Deploy the application to staging environment
   ```

3. Bot should delegate to devbob and report progress

## Step 6: Production Deployment

### Production Checklist

- [ ] Secrets stored in secure vault (not in git)
- [ ] Resource limits configured appropriately
- [ ] Health checks enabled
- [ ] Monitoring and alerts configured
- [ ] Backup strategy for session data
- [ ] Rate limiting configured
- [ ] Logging configured to centralized system

### Production Values

```yaml
# charts/slack-bot/values/production.slack-bot.values.yaml
replicaCount: 2

resources:
  limits:
    cpu: 2000m
    memory: 1Gi
  requests:
    cpu: 500m
    memory: 256Mi

autoscaling:
  enabled: true
  minReplicas: 2
  maxReplicas: 5
  targetCPUUtilizationPercentage: 70

firefox:
  enabled: true
  profilePath: "/mnt/firefox-profile"
```

### Deploy to Production

```bash
cd repos/platform/metabob-apps

# Deploy to production
helmfile -e production apply

# Verify deployment
kubectl get pods -n metabob | grep slack-bot

# Check both replicas are healthy
kubectl get pods -n metabob -l app.kubernetes.io/name=slack-bot -o wide
```

## Troubleshooting

### Bot Not Responding

**Symptom**: Bot doesn't respond to messages

**Debug steps**:
```bash
# Check pod logs
kubectl logs -n metabob -l app.kubernetes.io/name=slack-bot --tail=100

# Check events
kubectl get events -n metabob --sort-by='.lastTimestamp' | grep slack-bot

# Verify secrets
kubectl get secret slack-bot -n metabob -o yaml

# Test connectivity
kubectl exec -it -n metabob deployment/slack-bot -- node -e "console.log('test')"
```

**Common causes**:
- Socket Mode not enabled
- Incorrect SLACK_APP_TOKEN
- Bot not invited to channel
- Network connectivity issues

### Activity Updates Missing

**Symptom**: Activities run but no progress updates appear

**Debug steps**:
```bash
# Check event subscription logs
kubectl logs -n metabob -l app.kubernetes.io/name=slack-bot | grep "message.part.updated"

# Verify polling is running
kubectl logs -n metabob -l app.kubernetes.io/name=slack-bot | grep "polling"

# Check OpenCode SDK connection
kubectl logs -n metabob -l app.kubernetes.io/name=slack-bot | grep "Opencode server ready"
```

**Solutions**:
- Restart pod to reinitialize event stream
- Check OpenCode server connectivity
- Verify session state endpoint is accessible

### Docker Build Fails

**Symptom**: Build script errors out

**Debug steps**:
```bash
# Build with verbose output
docker build --no-cache --progress=plain -t metabobapp/slack-bot:debug .

# Check Docker version
docker --version

# Check available disk space
df -h
```

**Common causes**:
- Insufficient disk space
- Docker Hub authentication failed
- Network issues downloading base image

### devbob Not Connecting

**Symptom**: Bot can't connect to devbob container

**Debug steps**:
```bash
# Check devbob is running
docker ps | grep devbob

# Verify ACP server is running in devbob
docker exec devbob-container ps aux | grep opencode

# Test connectivity from bot pod
kubectl exec -it -n metabob deployment/slack-bot -- ping devbob-backend-agent
```

**Solutions**:
- Ensure devbob container has ACP server running
- Verify network policies allow pod-to-pod communication
- Check DEVBOB_HOST environment variable

## Monitoring

### Key Metrics

Monitor these metrics in production:

1. **Bot Health**:
   - Pod restart count
   - Memory usage
   - CPU utilization

2. **Message Throughput**:
   - Messages received per minute
   - Response latency
   - Error rate

3. **Activity Monitoring**:
   - Active sessions count
   - Average activity duration
   - Activity success rate

### Logging

```bash
# Stream logs
kubectl logs -n metabob -f deployment/slack-bot

# Search for errors
kubectl logs -n metabob deployment/slack-bot | grep -i error

# Filter by session
kubectl logs -n metabob deployment/slack-bot | grep "session-id-here"
```

### Alerts

Configure alerts for:
- Pod crashes (restarts > 3 in 10 minutes)
- High memory usage (> 80%)
- Error rate spike (> 5 errors/minute)
- Activity timeout (> 10 minutes)

## Maintenance

### Updating the Bot

```bash
# Build new version
cd repos/metabob-opencode/packages/slack
./build-and-push.sh v1.1.0

# Update image tag in values
# Edit charts/slack-bot/values/default.slack-bot.values.yaml
image:
  tag: "v1.1.0"

# Deploy update
cd repos/platform/metabob-apps
helmfile -e production apply

# Verify rollout
kubectl rollout status deployment/slack-bot -n metabob
```

### Rollback

```bash
# Rollback to previous version
kubectl rollout undo deployment/slack-bot -n metabob

# Rollback to specific revision
kubectl rollout history deployment/slack-bot -n metabob
kubectl rollout undo deployment/slack-bot -n metabob --to-revision=2
```

## Security Best Practices

1. **Secrets Management**:
   - Never commit secrets to git
   - Use Kubernetes secrets or external vault
   - Rotate tokens quarterly

2. **Network Security**:
   - Use NetworkPolicies to restrict traffic
   - Enable TLS for all external connections
   - Implement rate limiting

3. **Access Control**:
   - Limit Slack permissions to minimum required
   - Use RBAC for Kubernetes access
   - Audit bot actions regularly

4. **Data Privacy**:
   - Don't log sensitive data
   - Encrypt session data at rest
   - Implement data retention policies

## Support

- **Documentation**: See README.md in packages/slack/
- **Issues**: https://github.com/metabob/opencode/issues
- **Slack**: #opencode-support on mahnarc.slack.com

---

Last updated: February 16, 2026
