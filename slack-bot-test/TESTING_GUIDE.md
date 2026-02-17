# Slack Bot Testing Guide

This guide walks through testing the Slack bot with Playwright automation.

## Prerequisites

1. **Slack App Created** at https://api.slack.com/apps with:
   - Socket Mode enabled
   - Bot Token (xoxb-...)
   - App Token (xapp-...)
   - Signing Secret
   - Slash commands configured

2. **Environment Ready**:
   ```bash
   # Install Playwright
   npm install playwright
   npx playwright install firefox
   
   # Set credentials
   cp .env.example .env
   # Edit .env with your actual tokens
   ```

3. **Bot Running**:
   ```bash
   cd ../repos/metabob-opencode/packages/slack
   source ../../slack-bot-test/.env
   npm start
   ```

## Manual Testing with Playwright MCP

### Step 1: Navigate to Slack

The test will:
1. Open Firefox with your profile (authenticated to mahnarc.slack.com)
2. Navigate to the Slack workspace
3. Search for the OpenCode bot

### Step 2: Basic Interaction Test

Send messages and verify bot responds:
- "Hello" → Should create session
- See session URL in response
- Verify "Available Commands" message

### Step 3: Activity Monitoring Test

Send complex request:
- "List all TypeScript files in packages/slack"
- Watch for activity notifications:
  - 🚀 Activity Started
  - 🔧 Tool updates
  - ⏳ Progress updates
  - ✅ Activity Completed

### Step 4: Slash Commands Test

Test each command:
- `/status` → Session state display
- `/activities` → Active activities list
- `/session-info` → Detailed session info

## Automated Testing

Run the full test suite:

```bash
cd slack-bot-test
tsx playwright-slack-test.ts
```

This will:
1. Navigate to Slack automatically
2. Find and open bot DM
3. Send test messages
4. Verify activity monitoring
5. Test all slash commands
6. Take screenshots at each step
7. Generate test report

## Expected Results

### Success Criteria

✅ Bot responds within 5 seconds
✅ Session created and URL shared
✅ Activity start notification appears
✅ Tool execution updates stream in real-time
✅ Progress updates appear every 30 seconds
✅ Activity completion summary includes duration
✅ `/status` shows session state
✅ `/activities` lists running activities
✅ `/session-info` displays detailed info

### Example Flow

```
User: Hello!

Bot: 🔗 Session created: https://opencode.dev/session/abc123

     Available Commands:
     • /status - View session state
     • /activities - List active activities
     • /session-info - Detailed session information

User: List all TypeScript files

Bot: 🚀 Activity Started: Add Feature Complete
     Status: executing
     Progress: 1/4 tasks (25%)

Bot: 🔧 glob - Search for *.ts files

Bot: ⏳ Activity Progress: Add Feature Complete
     Status: executing
     Progress: 2/4 tasks (50%)
     Elapsed: 15s

Bot: ✅ Activity Completed: Add Feature Complete
     Duration: 34s
     Tasks: 4/4 completed

Bot: Found 127 TypeScript files:
     - packages/slack/src/index.ts
     - packages/opencode/src/index.ts
     ...

User: /status

Bot: 📊 Session State

     Activities:
     • Active: 0
     • Total: 1
     • Completed: 1

     Context Window:
     • Usage: 23.4% (35,123/150,000 tokens)
     • Cache Hit Rate: 82.1%

     Impulses:
     • Count: 8
     • Loaded: 6 / Unloaded: 2
     • Budget Utilization: 45.2%

     Agent:
     • Mode: activity
     • Model: anthropic/claude-opus-4-20250514
     • Messages: 6
     • Locked: No
```

## Troubleshooting

### Bot Not Responding

1. Check bot is running:
   ```bash
   ps aux | grep slack
   ```

2. Check logs:
   ```bash
   # In bot terminal
   # Look for "⚡️ Slack bot is running!"
   ```

3. Verify credentials:
   ```bash
   echo $SLACK_BOT_TOKEN | head -c 20
   # Should show: xoxb-...
   ```

### Activity Updates Missing

1. Check OpenCode server is running
2. Verify event subscription in bot logs
3. Test polling manually:
   ```bash
   curl http://localhost:<port>/session/<id>/state
   ```

### Playwright Fails

1. Ensure Firefox is installed:
   ```bash
   npx playwright install firefox
   ```

2. Check Firefox profile exists:
   ```bash
   ls -la ~/.mozilla/firefox/qcd6s4a4.default-release/
   ```

3. Try with visible browser (headless: false)

## Screenshots

Test script saves screenshots to:
- `screenshot-01-slack-loaded-*.png`
- `screenshot-02-bot-found-*.png`
- `screenshot-03-basic-message-*.png`
- `screenshot-04-activity-monitoring-*.png`
- `screenshot-05-status-command-*.png`
- `screenshot-06-activities-command-*.png`
- `screenshot-07-session-info-command-*.png`
- `screenshot-08-final-state-*.png`

## Manual Testing Checklist

- [ ] Bot responds to messages
- [ ] Session URL is generated
- [ ] Activity starts notification appears
- [ ] Tool updates stream in real-time
- [ ] Progress updates show percentage
- [ ] Activity completion shows duration
- [ ] `/status` works
- [ ] `/activities` works
- [ ] `/session-info` works
- [ ] Context window stats are accurate
- [ ] ACP agent connections show (if devbob active)
- [ ] Memory stats are displayed

## Next Steps

After successful testing:

1. **Docker Build**:
   ```bash
   cd ../repos/metabob-opencode/packages/slack
   ./build-and-push.sh
   ```

2. **Deploy to Kubernetes**:
   ```bash
   cd ../repos/platform/metabob-apps
   helmfile -e default apply
   ```

3. **Verify Deployment**:
   ```bash
   kubectl get pods -n metabob | grep slack-bot
   kubectl logs -n metabob -f deployment/slack-bot
   ```

4. **Test in Production**:
   - Send message in Slack
   - Verify bot responds
   - Test all commands
   - Monitor logs

## Support

- Bot code: `repos/metabob-opencode/packages/slack/src/index.ts`
- Deployment: `repos/platform/metabob-apps/charts/slack-bot/`
- Documentation: `SLACK_BOT_DEPLOYMENT_GUIDE.md`
