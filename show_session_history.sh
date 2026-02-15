#!/bin/bash

SESSION_ID="ses_3a4c36d61ffeQBBaB5sS176Fh8"
STORAGE_PATH="$HOME/.local/share/opencode/storage"

echo "==================================================================="
echo "SESSION HISTORY: $SESSION_ID"
echo "==================================================================="
echo

# Get session info
SESSION_FILE="$STORAGE_PATH/session/5a663c16ed174f011286a37c5e65ff7a9a5bc940/$SESSION_ID.json"
echo "📋 Session Info:"
cat "$SESSION_FILE" | jq -r '"  Title: \(.title)\n  Created: \(.time.created | todate)\n  Updated: \(.time.updated | todate)"'
echo

# Get messages sorted by time
MESSAGE_DIR="$STORAGE_PATH/message/$SESSION_ID"
echo "💬 Messages (oldest to newest):"
echo

MSG_COUNT=0
for msg_file in $(ls -r "$MESSAGE_DIR"/*.json 2>/dev/null); do
  MSG_COUNT=$((MSG_COUNT + 1))
  msg_id=$(basename "$msg_file" .json)
  
  # Read message metadata
  role=$(cat "$msg_file" | jq -r '.role')
  timestamp=$(cat "$msg_file" | jq -r '.time.created | todate')
  
  echo "[$MSG_COUNT] $role ($timestamp)"
  echo "---"
  
  # Get message parts
  PART_DIR="$STORAGE_PATH/part/$msg_id"
  if [ -d "$PART_DIR" ]; then
    for part_file in $(ls "$PART_DIR"/*.json 2>/dev/null | sort); do
      part_type=$(cat "$part_file" | jq -r '.type')
      
      case "$part_type" in
        text)
          text=$(cat "$part_file" | jq -r '.text')
          echo "$text"
          ;;
        tool-use)
          tool=$(cat "$part_file" | jq -r '.name')
          echo "🔧 Tool: $tool"
          ;;
        tool-result)
          tool=$(cat "$part_file" | jq -r '.name')
          echo "✓ Tool result: $tool"
          ;;
        reasoning)
          reasoning=$(cat "$part_file" | jq -r '.text // .content // "thinking..."')
          echo "💭 Reasoning: ${reasoning:0:100}..."
          ;;
        *)
          echo "[$part_type]"
          ;;
      esac
    done
  fi
  
  echo
  echo
done

echo "==================================================================="
echo "Total messages: $MSG_COUNT"
echo "==================================================================="
