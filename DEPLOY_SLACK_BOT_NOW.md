# 🚀 Deploy Slack Bot - Quick Start

## Everything is Ready! Just Run This:

```bash
cd /home/avi/documents/work/exp-repo/metabob-devbob
./deploy-slack-bot.sh
```

## ✅ What's Been Completed

1. ✅ Slack app "devbob" created and configured
2. ✅ All 3 tokens collected and stored securely
3. ✅ Docker image built: `metabobapp/slack-bot:v1.0.0`
4. ✅ Kubernetes manifests configured
5. ✅ Secrets file created (gitignored)
6. ✅ Deployment script ready

## 🧪 After Deployment - Test It!

### 1. Check Status
```bash
kubectl -n metabob get pods -l app.kubernetes.io/name=slack-bot
```

### 2. View Logs
```bash
kubectl -n metabob logs -f deployment/slack-bot
```

### 3. Test in Slack
1. Open Slack (mahnarc.slack.com)
2. Find "devbob" bot in Apps
3. Send a DM: "Hello!"
4. Try: `/status`, `/activities`, `/session-info`

## 📋 Key Files Created

- `repos/platform/metabob-apps/charts/slack-bot/values/production.slack-bot.secrets.yaml` - Secrets
- `deploy-slack-bot.sh` - Deployment script
- `SLACK_BOT_DEPLOYMENT_SUMMARY.md` - Full documentation

## 🔧 If Something Goes Wrong

```bash
# Check pod details
kubectl -n metabob describe pod -l app.kubernetes.io/name=slack-bot

# Check events
kubectl -n metabob get events --sort-by='.lastTimestamp'

# Restart if needed
kubectl -n metabob rollout restart deployment/slack-bot
```

---

**Ready to deploy? Run:** `./deploy-slack-bot.sh` 🚀
