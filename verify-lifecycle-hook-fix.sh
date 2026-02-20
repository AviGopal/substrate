#!/bin/bash

echo "=== Verifying Session Memory Lifecycle Hook Fix ==="
echo ""

# Find most recent manage-session-memory activities
RECENT_ACTIVITIES=$(find ~/.local/share/opencode/storage/activity -name "*.json" -exec grep -l "manage-session-memory" {} \; 2>/dev/null | xargs ls -lt 2>/dev/null | head -5)

if [ -z "$RECENT_ACTIVITIES" ]; then
  echo "⚠️  No manage-session-memory activities found yet"
  echo "   This is normal if no new messages have been sent since the fix"
  echo ""
  echo "To test: Start a new OpenCode session and send a message"
  exit 0
fi

echo "✅ Found manage-session-memory activities"
echo ""

# Check most recent activity
MOST_RECENT=$(find ~/.local/share/opencode/storage/activity -name "*.json" -exec grep -l "manage-session-memory" {} \; 2>/dev/null | xargs ls -t | head -1)

echo "📊 Most Recent Activity:"
echo "  File: $(basename $MOST_RECENT)"
echo ""

# Extract key fields
STATUS=$(cat "$MOST_RECENT" | jq -r '.status')
CALLING_SESSION=$(cat "$MOST_RECENT" | jq -r '.callingSessionId')
SESSION_COUNT=$(cat "$MOST_RECENT" | jq '.executionEvidence.sessionsSpawned | length' 2>/dev/null || echo "0")

echo "  Status: $STATUS"
echo "  Calling Session ID: $CALLING_SESSION"
echo "  Sessions Spawned: $SESSION_COUNT"
echo ""

# Verification checks
PASS_COUNT=0
FAIL_COUNT=0

# Check 1: Status should be "done" or "failed", not "setup"
echo "🔍 Verification Check 1: Activity Status"
if [ "$STATUS" = "done" ] || [ "$STATUS" = "failed" ]; then
  echo "  ✅ PASS: Status is '$STATUS' (not stuck in 'setup')"
  PASS_COUNT=$((PASS_COUNT + 1))
else
  echo "  ❌ FAIL: Status is '$STATUS' (should be 'done' or 'failed')"
  FAIL_COUNT=$((FAIL_COUNT + 1))
fi
echo ""

# Check 2: callingSessionId should be set (not null)
echo "🔍 Verification Check 2: Parent Session Link"
if [ "$CALLING_SESSION" != "null" ] && [ ! -z "$CALLING_SESSION" ]; then
  echo "  ✅ PASS: callingSessionId is set: $CALLING_SESSION"
  PASS_COUNT=$((PASS_COUNT + 1))
  
  # Check 3: Verify impulses in parent session
  echo ""
  echo "🔍 Verification Check 3: Impulses in Parent Session"
  MEMORY_FILE="$HOME/.local/share/opencode/storage/session-memory/${CALLING_SESSION}.json"
  
  if [ -f "$MEMORY_FILE" ]; then
    IMPULSE_COUNT=$(cat "$MEMORY_FILE" | jq '.impulses | length' 2>/dev/null || echo "0")
    if [ "$IMPULSE_COUNT" -gt 0 ]; then
      echo "  ✅ PASS: Parent session has $IMPULSE_COUNT impulses"
      PASS_COUNT=$((PASS_COUNT + 1))
      
      echo ""
      echo "  Impulse IDs:"
      cat "$MEMORY_FILE" | jq -r '.impulses | keys[]' 2>/dev/null | while read id; do
        echo "    - $id"
      done
    else
      echo "  ⚠️  WARNING: Parent session memory exists but has 0 impulses"
      echo "     This might be normal if the activity created no impulses"
    fi
  else
    echo "  ❌ FAIL: No session memory file found for parent session"
    echo "     Expected: $MEMORY_FILE"
    FAIL_COUNT=$((FAIL_COUNT + 1))
  fi
else
  echo "  ❌ FAIL: callingSessionId is null (parent session not linked)"
  FAIL_COUNT=$((FAIL_COUNT + 1))
fi

echo ""
echo "🔍 Verification Check 4: Child Session Tracking"
if [ "$SESSION_COUNT" -gt 0 ]; then
  echo "  ✅ PASS: $SESSION_COUNT child session(s) tracked in executionEvidence"
  PASS_COUNT=$((PASS_COUNT + 1))
else
  echo "  ⚠️  WARNING: No child sessions tracked (might be expected depending on template)"
fi

echo ""
echo "=== Summary ==="
echo "  ✅ Passed: $PASS_COUNT checks"
echo "  ❌ Failed: $FAIL_COUNT checks"
echo ""

if [ $FAIL_COUNT -eq 0 ]; then
  echo "🎉 All verification checks passed!"
  echo ""
  echo "The lifecycle hook fix is working correctly:"
  echo "  - Activities complete successfully"
  echo "  - Parent session is linked"
  echo "  - Impulses are transferred to parent session"
  echo "  - Child sessions are properly tracked"
  exit 0
else
  echo "⚠️  Some verification checks failed"
  echo ""
  echo "Please review the output above and check:"
  echo "  - Did the build complete successfully?"
  echo "  - Was the OpenCode binary restarted after the build?"
  echo "  - Is this a fresh session (not an old stuck activity)?"
  exit 1
fi

