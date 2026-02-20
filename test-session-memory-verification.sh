#!/bin/bash

echo "=== Session Memory Verification Test ==="
echo ""

# Get the current OpenCode session directory (most recent)
SESSION_DIR=$(ls -td ~/.local/share/opencode/storage/session/*/ 2>/dev/null | grep -v "global" | head -1)

if [ -z "$SESSION_DIR" ]; then
    echo "❌ No active session directory found"
    exit 1
fi

SESSION_ID=$(basename "$SESSION_DIR")
echo "📍 Current Session ID: $SESSION_ID"
echo ""

# Check session memory file
MEMORY_FILE="$HOME/.local/share/opencode/storage/session-memory/${SESSION_ID}.json"

if [ ! -f "$MEMORY_FILE" ]; then
    echo "⚠️  No session memory file found yet (may be created on first impulse)"
    echo "   Expected location: $MEMORY_FILE"
else
    echo "✅ Session memory file exists"
    echo ""
    echo "=== Session Memory Contents ==="
    cat "$MEMORY_FILE" | jq '.' 2>/dev/null || cat "$MEMORY_FILE"
    echo ""
    
    # Extract impulse IDs
    IMPULSE_COUNT=$(cat "$MEMORY_FILE" | jq '.impulses | length' 2>/dev/null || echo "0")
    echo "📊 Impulse Count: $IMPULSE_COUNT"
    
    if [ "$IMPULSE_COUNT" -gt 0 ]; then
        echo ""
        echo "=== Impulse IDs ==="
        cat "$MEMORY_FILE" | jq -r '.impulses | keys[]' 2>/dev/null
    fi
fi

echo ""
echo "=== Session Count Verification ==="

# Count all session directories
TOTAL_SESSIONS=$(find ~/.local/share/opencode/storage/session -maxdepth 1 -type d | grep -v "/session$" | grep -v "/global$" | wc -l)
echo "📈 Total session directories: $TOTAL_SESSIONS"

# List recent sessions
echo ""
echo "=== Recent Sessions (last 5) ==="
ls -td ~/.local/share/opencode/storage/session/*/ 2>/dev/null | grep -v "global" | head -5 | while read dir; do
    sid=$(basename "$dir")
    file_count=$(ls "$dir" | wc -l)
    echo "  - $sid (${file_count} files)"
done

echo ""
echo "=== Session Files in Current Session ==="
ls -lh "$SESSION_DIR" | head -10

echo ""
echo "✅ Verification complete"
