#!/bin/bash
# Test Slack bot with system Firefox

echo "🧪 Slack Bot Testing Script"
echo "==========================="
echo ""

# Step 1: Check if we have Slack credentials
if [ -z "$SLACK_BOT_TOKEN" ]; then
  echo "❌ SLACK_BOT_TOKEN not set"
  echo ""
  echo "To set up Slack app:"
  echo "1. Go to https://api.slack.com/apps"
  echo "2. Create new app or use existing"
  echo "3. Enable Socket Mode and get App Token"
  echo "4. Set OAuth scopes and get Bot Token"
  echo "5. Export credentials:"
  echo "   export SLACK_BOT_TOKEN='xoxb-...'"
  echo "   export SLACK_SIGNING_SECRET='...'"
  echo "   export SLACK_APP_TOKEN='xapp-...'"
  exit 1
fi

echo "✅ Credentials found"
echo ""

# Step 2: Start OpenCode server (if not running)
if ! pgrep -f "opencode.*src/index.ts" > /dev/null; then
  echo "🚀 Starting OpenCode server..."
  cd ../repos/metabob-opencode
  bun run --cwd packages/opencode ./src/index.ts ../.. &
  OPENCODE_PID=$!
  echo "Started with PID: $OPENCODE_PID"
  sleep 5
else
  echo "✅ OpenCode already running"
fi
echo ""

# Step 3: Start Slack bot
echo "🤖 Starting Slack bot..."
cd ../repos/metabob-opencode/packages/slack
npm start &
SLACK_BOT_PID=$!
echo "Started with PID: $SLACK_BOT_PID"
sleep 10
echo ""

# Step 4: Open Firefox to Slack
echo "🌐 Opening Slack in Firefox..."
firefox https://mahnarc.slack.com &
echo ""

echo "✅ Test environment ready!"
echo ""
echo "Manual test steps:"
echo "1. In Slack, find or invite the OpenCode bot"
echo "2. Send message: 'Hello, create a session'"
echo "3. Verify session URL appears"
echo "4. Send: 'List all files in this directory'"
echo "5. Verify activity started notification"
echo "6. Try /status command"
echo "7. Try /activities command"
echo "8. Try /session-info command"
echo ""
echo "Press Ctrl+C to stop test environment"

# Wait for user interrupt
trap "echo 'Stopping...'; kill $SLACK_BOT_PID 2>/dev/null; exit 0" INT
wait
