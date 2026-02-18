# Slack Bot Deployment Summary

## 🎉 Status: READY FOR DEPLOYMENT

All configuration and setup is complete. The Slack bot is ready to be deployed to your Kubernetes production environment.

---

## ✅ Completed Steps

### 1. Slack App Configuration ✅
- **App Created**: `devbob` (App ID: A0AGF05JFPA)
- **Workspace**: Metabob (mahnarc.slack.com)
- **Socket Mode**: Enabled
- **OAuth Scopes**: Configured with required permissions
  - `app_mentions:read`
  - `chat:write`
  - `chat:write.public`
  - `commands`
  - `im:history`
  - `im:read`
  - `im:write`

### 2. Credentials Collected ✅
All three required tokens have been collected and securely stored:
- ✅ **SLACK_BOT_TOKEN**: `xoxb-921441651264-10527633422293-***`
- ✅ **SLACK_SIGNING_SECRET**: `535f83fa9a45bcd8cf254fafa4879316`
- ✅ **SLACK_APP_TOKEN**: `xapp-1-A0AGF05JFPA-10524708962595-***`

### 3. Kubernetes Configuration ✅
- **Secrets File**: `repos/platform/metabob-apps/charts/slack-bot/values/production.slack-bot.secrets.yaml`
- **Deployment**: `repos/platform/metabob-apps/charts/slack-bot/templates/deployment.yaml`
- **Helmfile**: Configured in `repos/platform/metabob-apps/helmfile.yaml.gotmpl`
- **Gitignore**: Secrets file properly excluded from git

### 4. Docker Image ✅
- **Image Built**: `metabobapp/slack-bot:v1.0.0`
- **Image Pushed**: Ready on Docker Hub
- **Latest Tag**: Also tagged as `latest`

---

## 🚀 Deployment Instructions

### Quick Deploy

Run the automated deployment script:

```bash
cd /home/avi/documents/work/exp-repo/metabob-devbob
./deploy-slack-bot.sh
```

This script will:
1. ✅ Verify Kubernetes connectivity
2. ✅ Create `metabob` namespace if needed
3. ✅ Deploy slack-bot using helmfile
4. ✅ Show deployment status and pod information

### Manual Deploy (Alternative)

If you prefer to deploy manually:

```bash
# Navigate to metabob-apps
cd repos/platform/metabob-apps

# Deploy only the slack-bot
helmfile -e default -l name=slack-bot apply

# Check deployment status
kubectl -n metabob get deployments slack-bot
kubectl -n metabob get pods -l app.kubernetes.io/name=slack-bot

# View logs
kubectl -n metabob logs -f deployment/slack-bot
```

---

## 🧪 Testing the Bot

### 1. Check Pod Status

```bash
kubectl -n metabob get pods -l app.kubernetes.io/name=slack-bot
```

Expected output:
```
NAME                         READY   STATUS    RESTARTS   AGE
slack-bot-xxxxxxxxxx-xxxxx   1/1     Running   0          1m
```

### 2. View Logs

```bash
kubectl -n metabob logs -f deployment/slack-bot
```

Expected logs:
```
⚡️ Bolt app is running on Socket Mode!
✅ Connected to Slack workspace: Metabob
```

### 3. Test in Slack

1. **Open Slack** (mahnarc.slack.com)
2. **Find the Bot**: Search for "devbob" in the Apps section
3. **Send a DM**: 
   - Message: `Hello!`
   - Expected: Bot responds with greeting and session info

4. **Try Slash Commands**:
   - `/status` - View current session state
   - `/activities` - List active activities
   - `/session-info` - Detailed session information

### 4. Expected Behavior

When you message the bot:
- ✅ Bot creates a new OpenCode session
- ✅ Bot responds with session ID and instructions
- ✅ You can ask the bot to code, debug, or run activities
- ✅ Bot provides real-time updates on progress

---

## 📁 File Locations

### Configuration Files
- **Secrets**: `repos/platform/metabob-apps/charts/slack-bot/values/production.slack-bot.secrets.yaml`
- **Values**: `repos/platform/metabob-apps/charts/slack-bot/values/default.slack-bot.values.yaml`
- **Deployment**: `repos/platform/metabob-apps/charts/slack-bot/templates/deployment.yaml`
- **Secret Template**: `repos/platform/metabob-apps/charts/slack-bot/templates/secret.yaml`

### Source Code
- **Slack Bot**: `repos/metabob-opencode/packages/slack/src/index.ts`
- **Dockerfile**: `repos/metabob-opencode/packages/slack/Dockerfile`
- **Build Script**: `repos/metabob-opencode/packages/slack/build-and-push.sh`

### Deployment Files
- **Helmfile**: `repos/platform/metabob-apps/helmfile.yaml.gotmpl`
- **Deployment Script**: `./deploy-slack-bot.sh`

---

## 🔧 Troubleshooting

### Pod Not Starting

```bash
# Check pod status
kubectl -n metabob describe pod -l app.kubernetes.io/name=slack-bot

# Check events
kubectl -n metabob get events --sort-by='.lastTimestamp'
```

Common issues:
- **ImagePullBackOff**: Docker image not found or credentials issue
- **CrashLoopBackOff**: Check logs for connection errors
- **Pending**: Insufficient resources or namespace issue

### Bot Not Responding in Slack

1. **Check Logs**:
   ```bash
   kubectl -n metabob logs deployment/slack-bot
   ```

2. **Verify Tokens**: Ensure secrets are correctly set
   ```bash
   kubectl -n metabob get secret slack-bot -o yaml
   ```

3. **Check Socket Mode**: Verify Socket Mode is enabled in Slack App settings

4. **Reinstall App**: If needed, reinstall the Slack app to workspace

### Update Secrets

If you need to update the Slack tokens:

1. Edit the secrets file:
   ```bash
   nano repos/platform/metabob-apps/charts/slack-bot/values/production.slack-bot.secrets.yaml
   ```

2. Redeploy:
   ```bash
   ./deploy-slack-bot.sh
   ```

3. Restart pods:
   ```bash
   kubectl -n metabob rollout restart deployment/slack-bot
   ```

---

## 🔐 Security Notes

1. **Secrets File**: `production.slack-bot.secrets.yaml` is in `.gitignore` - DO NOT COMMIT
2. **Tokens**: Keep Slack tokens secure and rotate periodically
3. **Access**: Only deploy from trusted machines with proper kubectl access
4. **Namespace**: Bot runs in `metabob` namespace with appropriate RBAC

---

## 📚 Additional Resources

### Slack API Documentation
- **Socket Mode**: https://api.slack.com/apis/connections/socket
- **Bot Users**: https://api.slack.com/bot-users
- **Slash Commands**: https://api.slack.com/interactivity/slash-commands

### OpenCode Documentation
- **Package Documentation**: `repos/metabob-opencode/packages/slack/README.md`
- **Testing Guide**: `slack-bot-test/TESTING_GUIDE.md`

### Kubernetes Commands
```bash
# View all resources
kubectl -n metabob get all

# Scale deployment
kubectl -n metabob scale deployment/slack-bot --replicas=2

# Update image
kubectl -n metabob set image deployment/slack-bot slack-bot=metabobapp/slack-bot:v1.0.1

# Port forward (for local testing)
kubectl -n metabob port-forward deployment/slack-bot 3000:3000
```

---

## ✨ Next Steps

1. **Deploy**: Run `./deploy-slack-bot.sh`
2. **Verify**: Check pod status and logs
3. **Test**: Send a message to the bot in Slack
4. **Monitor**: Watch logs for any issues
5. **Iterate**: Make improvements based on usage

---

## 🎯 Success Criteria

- ✅ Pod running and healthy
- ✅ Logs show successful Socket Mode connection
- ✅ Bot responds to DMs in Slack
- ✅ Slash commands work correctly
- ✅ Sessions are created and tracked

---

**Status**: All setup complete! Ready for deployment! 🚀

**Date**: February 17, 2026  
**Environment**: Production (metabob-apps)  
**Workspace**: Metabob (mahnarc.slack.com)  
**App**: devbob (A0AGF05JFPA)
