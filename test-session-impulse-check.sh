#!/bin/bash

echo "=== Session Impulse Detection ==="
echo ""

SESSION_DIR=$(ls -td ~/.local/share/opencode/storage/session/*/ 2>/dev/null | grep -v "global" | head -1)
SESSION_ID=$(basename "$SESSION_DIR")

echo "📍 Session ID: $SESSION_ID"
echo ""

# Check for impulse-related activity
echo "=== Checking for Impulse Activity in Session ==="

# Look for recent impulse messages
IMPULSE_MSGS=$(grep -r "impulse" "$SESSION_DIR" 2>/dev/null | wc -l)
echo "📝 Files mentioning 'impulse': $IMPULSE_MSGS"

# Check for memory agent activity
MEMORY_AGENT=$(grep -r "memory.*agent\|SessionMemory" "$SESSION_DIR" 2>/dev/null | wc -l)
echo "🤖 Files mentioning memory agent: $MEMORY_AGENT"

# Check for manage-session-memory activity
MANAGE_MEM=$(grep -r "manage-session-memory" "$SESSION_DIR" 2>/dev/null | wc -l)
echo "🔧 Files mentioning manage-session-memory: $MANAGE_MEM"

echo ""
echo "=== Recent Session Messages ==="
ls -lt "$SESSION_DIR"/*.json 2>/dev/null | head -3 | while read line; do
    file=$(echo "$line" | awk '{print $NF}')
    echo ""
    echo "File: $(basename $file)"
    cat "$file" | jq -r '.role, .type // "no type"' 2>/dev/null | head -5
done

echo ""
echo "=== Session Memory File Check ==="
MEMORY_FILE="$HOME/.local/share/opencode/storage/session-memory/${SESSION_ID}.json"

if [ -f "$MEMORY_FILE" ]; then
    echo "✅ Memory file exists!"
    echo ""
    cat "$MEMORY_FILE" | jq '{
      sessionID,
      impulseCount: (.impulses | length),
      totalBudget,
      usedTokens,
      impulseIds: (.impulses | keys)
    }' 2>/dev/null
else
    echo "⚠️  Memory file not created yet"
    echo "   This is normal if no impulses have been created in this session"
fi

echo ""
echo "=== Verify Single Session Usage ==="
# Check how many sessions were active in the last hour
ONE_HOUR_AGO=$(date -d '1 hour ago' +%s 2>/dev/null || echo "0")

RECENT_SESSIONS=0
for dir in ~/.local/share/opencode/storage/session/*/; do
    if [ "$dir" = "~/.local/share/opencode/storage/session/global/" ]; then
        continue
    fi
    
    # Get most recent file modification in the directory
    LATEST_MOD=$(find "$dir" -type f -printf '%T@\n' 2>/dev/null | sort -n | tail -1 | cut -d. -f1)
    
    if [ ! -z "$LATEST_MOD" ] && [ "$LATEST_MOD" -gt "$ONE_HOUR_AGO" ]; then
        RECENT_SESSIONS=$((RECENT_SESSIONS + 1))
        sid=$(basename "$dir")
        if [ "$sid" = "$SESSION_ID" ]; then
            echo "  ✅ $sid (CURRENT SESSION)"
        else
            echo "  ⚠️  $sid (OTHER SESSION - unexpected!)"
        fi
    fi
done

echo ""
if [ "$RECENT_SESSIONS" -eq 1 ]; then
    echo "✅ PASS: Only 1 session active in the last hour (this one)"
else
    echo "⚠️  WARNING: $RECENT_SESSIONS sessions active in the last hour"
fi

