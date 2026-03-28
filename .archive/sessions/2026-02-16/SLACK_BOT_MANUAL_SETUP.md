# Slack Bot - Manual Setup Steps

Since the Slack API UI requires complex interactions, here's the manual setup process:

## Step 1: Create Slack App (5 minutes)

### A. Create App
1. Go to https://api.slack.com/apps
2. Click "Create New App"
3. Choose "From scratch"
4. **App Name:** `OpenCode Bot`
5. **Workspace:** Select "Metabob" (mahnarc.slack.com)
6. Click "Create App"

### B. Enable Socket Mode
1. In left sidebar → "Socket Mode"
2. **Enable Socket Mode** toggle → ON
3. Click "Generate Token"
   - **Token Name:** `opencode-socket`
   - **Scopes:** `connections:write`
   - Click "Generate"
4. **Copy the token** (starts with `xapp-`) → Save as `SLACK_APP_TOKEN`

### C. Configure OAuth & Permissions
1. In left sidebar → "OAuth & Permissions"
2. Scroll to "Bot Token Scopes"
3. Click "Add an OAuth Scope" and add:
   - `app_mentions:read`
   - `chat:write`
   - `chat:write.public`
   - `commands`
   - `im:history`
   - `im:read`
   - `im:write`
4. Scroll to top → Click "Install to Workspace"
5. Click "Allow"
6. **Copy "Bot User OAuth Token"** (starts with `xoxb-`) → Save as `SLACK_BOT_TOKEN`

### D. Add Slash Commands
1. In left sidebar → "Slash Commands"
2. Click "Create New Command" for each:

**Command 1:**
- Command: `/status`
- Request URL: `https://your-server.com/slack/events` (not used in Socket Mode)
- Short Description: `View OpenCode session state`
- Usage Hint: `[no parameters]`

**Command 2:**
- Command: `/activities`
- Request URL: `https://your-server.com/slack/events`
- Short Description: `List active OpenCode activities`
- Usage Hint: `[no parameters]`

**Command 3:**
- Command: `/session-info`
- Request URL: `https://your-server.com/slack/events`
- Short Description: `Detailed OpenCode session information`
- Usage Hint: `[no parameters]`

**Command 4:**
- Command: `/test`
- Request URL: `https://your-server.com/slack/events`
- Short Description: `Test bot connectivity`
- Usage Hint: `[no parameters]`

### E. Enable Event Subscriptions
1. In left sidebar → "Event Subscriptions"
2. **Enable Events** toggle → ON
3. Scroll to "Subscribe to bot events"
4. Click "Add Bot User Event" and add:
   - `app_mention`
   - `message.im`
5. Click "Save Changes"

### F. Get Signing Secret
1. In left sidebar → "Basic Information"
2. Scroll to "App Credentials"
3. **Copy "Signing Secret"** → Save as `SLACK_SIGNING_SECRET`

## Step 2: Save Credentials

Create a `.env` file:

```bash
cd /home/avi/documents/work/exp-repo/metabob-devbob/repos/metabob-opencode/packages/slack

cat > .env << 'EOF'
SLACK_BOT_TOKEN=xoxb-YOUR-TOKEN-HERE
SLACK_SIGNING_SECRET=YOUR-SECRET-HERE
SLACK_APP_TOKEN=xapp-YOUR-TOKEN-HERE
EOF

chmod 600 .env
```

## Step 3: Test Locally

```bash
cd /home/avi/documents/work/exp-repo/metabob-devbob/repos/metabob-opencode/packages/slack

# Load environment variables
export $(cat .env | xargs)

# Start bot
npm start
```

**Expected output:**
```
🔧 Bot configuration:
- Bot token present: true
- Signing secret present: true
- App token present: true
🚀 Starting opencode server...
✅ Opencode server ready
⚡️ Slack bot is running!
```

## Step 4: Test in Slack

1. Open Slack workspace (https://app.slack.com/client/T014E5ZGWED)
2. Find "OpenCode Bot" in Apps or DMs
3. Send message: `Hello!`

**Expected response:**
```
🔗 Session created: https://opencode.dev/session/abc123

Available Commands:
• /status - View session state
• /activities - List active activities
• /session-info - Detailed session information
```

4. Test activity monitoring:
   - Send: `List all TypeScript files in packages/slack`
   - Watch for:
     - 🚀 Activity Started
     - 🔧 Tool updates
     - ⏳ Progress updates
     - ✅ Activity Completed

5. Test slash commands:
   - `/status` → Should show session state
   - `/activities` → Should list activities
   - `/session-info` → Should show detailed info

## Step 5: Deploy (Optional)

Once local testing works:

### A. Build Docker Image
```bash
cd /home/avi/documents/work/exp-repo/metabob-devbob/repos/metabob-opencode/packages/slack
./build-and-push.sh
```

### B. Configure Kubernetes Secrets
```bash
cd /home/avi/documents/work/exp-repo/metabob-devbob/repos/platform/metabob-apps

cat > charts/slack-bot/values/secrets.yaml << EOF
slack:
  botToken: "xoxb-YOUR-TOKEN"
  signingSecret: "YOUR-SECRET"
  appToken: "xapp-YOUR-TOKEN"
EOF

chmod 600 charts/slack-bot/values/secrets.yaml
```

### C. Deploy to Kubernetes
```bash
helmfile -e default apply
```

### D. Verify Deployment
```bash
kubectl get pods -n metabob | grep slack-bot
kubectl logs -n metabob -f deployment/slack-bot
```

## Troubleshooting

### Bot Not Responding
- Check bot logs for errors
- Verify Socket Mode is enabled
- Ensure bot is invited to channel: `/invite @OpenCode Bot`
- Check credentials are correct

### Activity Updates Missing
- Verify OpenCode server is running
- Check event subscription logs
- Test session state endpoint

### Slash Commands Not Working
- Verify commands are created in Slack app settings
- Check bot has `commands` scope
- Look for errors in bot logs

## Quick Reference

**Tokens you need:**
1. `SLACK_BOT_TOKEN` (xoxb-...) - From OAuth & Permissions
2. `SLACK_SIGNING_SECRET` - From Basic Information
3. `SLACK_APP_TOKEN` (xapp-...) - From Socket Mode

**Scopes needed:**
- app_mentions:read
- chat:write
- chat:write.public
- commands
- im:history, im:read, im:write

**Socket Mode:** Must be enabled with connections:write scope

**Event Subscriptions:** app_mention, message.im

---

**Total setup time:** ~10 minutes

After setup, you'll have a fully functional Slack bot with:
- ✅ Real-time activity monitoring
- ✅ Session state inspection
- ✅ Interactive slash commands
- ✅ Tool execution updates
- ✅ devbob integration support
