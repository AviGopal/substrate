#!/bin/bash

echo "=== Testing Session Memory Lifecycle Hook Fix ==="
echo ""

# Clean up old stuck activities
echo "📌 Removing old manage-session-memory activities..."
find ~/.local/share/opencode/storage/activity -name "*.json" -exec grep -l "manage-session-memory" {} \; 2>/dev/null | while read file; do
  echo "  Removing: $(basename $file)"
  rm "$file"
done

echo ""
echo "=== Test Results Will Appear After Fix is Applied ==="
echo ""
echo "Expected behavior AFTER fix:"
echo "  1. ✅ Activities should have status 'done' or 'failed' (not 'setup')"
echo "  2. ✅ Activities should have callingSessionId set (not null)"
echo "  3. ✅ Impulses should appear in parent session memory"
echo "  4. ✅ Child sessions should be created but properly tracked"
echo ""
echo "To test, start a new OpenCode session and send a message."
echo "Then run this verification:"
echo ""
echo "  bash verify-lifecycle-hook-fix.sh"
echo ""

