# Slack Bot - Quick Start Guide

**Project Status:** ✅ Complete and Ready for Deployment

## 🚀 Quick Deploy (5 minutes)

### 1. Get Slack Credentials (2 min)

Visit https://api.slack.com/apps:
1. Create app: "OpenCode Bot"
2. Enable Socket Mode → Get App Token (xapp-...)
3. Add scopes: `app_mentions:read`, `chat:write`, `commands`, `im:history`, `im:write`
4. Install app → Get Bot Token (xoxb-...)
5. Copy Signing Secret

### 2. Test Locally (2 min)

```bash
export SLACK_BOT_TOKEN="xoxb-..."
export SLACK_SIGNING_SECRET="..."
export SLACK_APP_TOKEN="xapp-..."

cd repos/metabob-opencode/packages/slack
npm start

# Test in Slack: Send "Hello!" to bot
```

### 3. Deploy to Kubernetes (1 min)

```bash
# Build image
cd repos/metabob-opencode/packages/slack
./build-and-push.sh

# Configure secrets
cat > ../../platform/metabob-apps/charts/slack-bot/values/secrets.yaml << EOF
slack:
  botToken: "xoxb-..."
  signingSecret: "..."
  appToken: "xapp-..."
EOF

# Deploy
cd ../../platform/metabob-apps
helmfile -e default apply
```

## 📊 Usage

### Basic Interaction
```
You: Hello!
Bot: 🔗 Session created: https://opencode.dev/session/abc123
     Commands: /status, /activities, /session-info

You: List TypeScript files
Bot: 🚀 Activity Started: Add Feature Complete
     🔧 glob - Search for *.ts files
     ✅ Activity Completed (34s)
```

### Slash Commands
- `/status` - Session state (activities, context, impulses)
- `/activities` - Active activities with progress
- `/session-info` - Detailed info (ACP, MCP, memory)

## 📁 Key Files

- **Bot Code**: `repos/metabob-opencode/packages/slack/src/index.ts`
- **Docker**: `repos/metabob-opencode/packages/slack/Dockerfile`
- **Helm Chart**: `repos/platform/metabob-apps/charts/slack-bot/`
- **Full Guide**: `SLACK_BOT_DEPLOYMENT_GUIDE.md`
- **Testing**: `slack-bot-test/TESTING_GUIDE.md`
- **Summary**: `SLACK_BOT_PROJECT_SUMMARY.md`

## ✅ Features

- ✅ Real-time activity tracking (start/progress/completion)
- ✅ Session state monitoring (context, impulses, memory)
- ✅ Slash commands for inspection
- ✅ devbob container integration
- ✅ Firefox profile support (mahnarc.slack.com)
- ✅ Docker containerization (metabobapp/slack-bot)
- ✅ Kubernetes deployment ready
- ✅ Comprehensive documentation

## 🐛 Troubleshooting

**Bot not responding?**
```bash
# Check logs
kubectl logs -n metabob deployment/slack-bot

# Verify secrets
kubectl get secret slack-bot -n metabob
```

**Need help?**
- See `SLACK_BOT_DEPLOYMENT_GUIDE.md` for detailed steps
- Check `slack-bot-test/TESTING_GUIDE.md` for testing

---

**Total Setup Time:** ~5 minutes  
**Status:** Production ready! 🎉
