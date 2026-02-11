#!/bin/bash
# Test Agent Activity Request - End-to-End

set -e

BASE_URL="http://localhost:3004"

echo "==================================================================="
echo "Agent Activity Request Test"
echo "==================================================================="

# Create session
echo ""
echo "[1] Creating session..."
SESSION_ID=$(curl -s -X POST "${BASE_URL}/session" \
  -H 'Content-Type: application/json' \
  -d '{}' | jq -r '.id')

echo "✓ Session: ${SESSION_ID}"

# Send message asking agent to list activities
echo ""
echo "[2] Asking agent about available activities..."
echo "   Request: 'What activities are available? Please list them.'"

MESSAGE_RESPONSE=$(curl -s -X POST "${BASE_URL}/session/${SESSION_ID}/message" \
  -H 'Content-Type: application/json' \
  -d '{
    "parts": [
      {
        "type": "text",
        "text": "What activities are available? Please list the activity IDs you can see in your context."
      }
    ]
  }')

# Check if we got a message ID back
MSG_ID=$(echo "$MESSAGE_RESPONSE" | jq -r '.id // empty')

if [ -z "$MSG_ID" ]; then
  echo "✗ Failed to send message:"
  echo "$MESSAGE_RESPONSE" | jq '.'
  exit 1
fi

echo "✓ Message sent: ${MSG_ID}"
echo "   Status: $(echo "$MESSAGE_RESPONSE" | jq -r '.status')"

# Wait for response
echo ""
echo "[3] Waiting for agent response (15 seconds)..."
sleep 15

# Get messages
MESSAGES=$(curl -s "${BASE_URL}/session/${SESSION_ID}/messages?limit=10")
LAST_MESSAGE=$(echo "$MESSAGES" | jq -r '.[0].content // empty')

if [ -z "$LAST_MESSAGE" ]; then
  echo "⚠ No response yet, checking status..."
  STATUS=$(curl -s "${BASE_URL}/session/${SESSION_ID}" | jq -r '.status')
  echo "   Session status: ${STATUS}"
else
  echo "✓ Agent responded:"
  echo "$LAST_MESSAGE" | head -20
fi

echo ""
echo "==================================================================="
echo "Manual Verification Steps:"
echo "==================================================================="
echo ""
echo "1. Check full conversation:"
echo "   curl http://localhost:3004/session/${SESSION_ID}/messages | jq '.'"
echo ""
echo "2. Stream events in real-time:"
echo "   curl http://localhost:3004/session/${SESSION_ID}/stream"
echo ""
echo "3. Send activity execution request:"
echo "   curl -X POST http://localhost:3004/session/${SESSION_ID}/message \\"
echo "     -H 'Content-Type: application/json' \\"
echo "     -d '{\"parts\":[{\"type\":\"text\",\"text\":\"Execute the refactor-5fccfc17 activity with variables: scope='docs', recentDays='7', mediumDays='30', obsoleteDays='90', mode='dryRun', archiveInsteadOfDelete='true'. Reason: testing documentation organization workflow.\"}]}'"
echo ""
echo "==================================================================="
