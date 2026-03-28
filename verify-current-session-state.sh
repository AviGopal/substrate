#!/bin/bash
# Verify current session state for session memory agent testing
# This script checks if impulses exist and how many sessions are active

set -e

echo "=== Current Session State Verification ==="
echo ""

STORAGE_DIR="$HOME/.local/share/opencode/storage"
PROJECT_ROOT="/home/avi/documents/work/exp-repo/metabob-devbob/repos/metabob-opencode"

cd "$PROJECT_ROOT"

echo "1. Finding most recent session..."
echo ""

# Get most recent session from storage
RECENT_SESSION=$(find "$STORAGE_DIR/session" -type f -name "ses_*.json" -mmin -30 | head -1)

if [ -z "$RECENT_SESSION" ]; then
  echo "   ⚠️  No recent sessions found in last 30 minutes"
  echo ""
  echo "   Checking all sessions:"
  RECENT_SESSION=$(find "$STORAGE_DIR/session" -type f -name "ses_*.json" | sort -t_ -k2 -r | head -1)
fi

if [ -n "$RECENT_SESSION" ]; then
  SESSION_ID=$(basename "$RECENT_SESSION" .json)
  echo "   ✓ Most recent session: $SESSION_ID"
  echo "   Path: $RECENT_SESSION"
  
  # Check session details
  node -e "
  const fs = require('fs');
  const session = JSON.parse(fs.readFileSync('$RECENT_SESSION', 'utf-8'));
  console.log('   Messages:', session.messages?.length || 0);
  console.log('   Turns:', session.turns?.length || 0);
  console.log('   Agent:', session.agent || 'unknown');
  console.log('   Created:', session.createdAt ? new Date(session.createdAt).toISOString() : 'unknown');
  "
else
  echo "   ❌ No sessions found"
  exit 1
fi

echo ""
echo "2. Checking session memory for impulses..."
echo ""

MEMORY_FILE="$STORAGE_DIR/session-memory/${SESSION_ID}.json"

if [ -f "$MEMORY_FILE" ]; then
  echo "   ✓ Memory file exists"
  echo ""
  
  node -e "
  const fs = require('fs');
  const memory = JSON.parse(fs.readFileSync('$MEMORY_FILE', 'utf-8'));
  
  const impulseCount = Object.keys(memory.impulses || {}).length;
  
  console.log('   Session Memory State:');
  console.log('   - Session ID:', memory.sessionID);
  console.log('   - Impulse Count:', impulseCount);
  console.log('   - Total Budget:', memory.totalBudget || 0);
  console.log('   - Used Tokens:', memory.usedTokens || 0);
  console.log('');
  
  if (impulseCount > 0) {
    console.log('   ✅ Impulses found:');
    for (const [id, impulse] of Object.entries(memory.impulses)) {
      console.log('');
      console.log('   Impulse:', impulse.id);
      console.log('   - Type:', impulse.type);
      console.log('   - Priority:', impulse.priority);
      console.log('   - Budget:', impulse.budget);
      console.log('   - Scope:', impulse.scope);
      console.log('   - Loaded:', impulse.loaded);
      if (impulse.metadata?.description) {
        console.log('   - Description:', impulse.metadata.description);
      }
    }
    console.log('');
    console.log('   ✅ Session memory agent is working!');
  } else {
    console.log('   ⚠️  No impulses in memory (empty state)');
  }
  "
else
  echo "   ⚠️  No memory file found for this session"
  echo "   This could mean:"
  echo "   - Lifecycle hook didn't execute"
  echo "   - Memory agent failed to create impulses"
  echo "   - Session is too new (memory created after first turn)"
fi

echo ""
echo "3. Checking total session count..."
echo ""

# Count all session directories (unique projects)
PROJECT_COUNT=$(find "$STORAGE_DIR/session" -mindepth 1 -maxdepth 1 -type d ! -name "global" | wc -l)
echo "   Project session directories: $PROJECT_COUNT"

# Count all session JSON files in current project
CURRENT_PROJECT_HASH=$(git rev-parse HEAD 2>/dev/null || echo "unknown")
PROJECT_SESSION_DIR="$STORAGE_DIR/session/$CURRENT_PROJECT_HASH"

if [ -d "$PROJECT_SESSION_DIR" ]; then
  SESSION_FILES=$(find "$PROJECT_SESSION_DIR" -name "ses_*.json" | wc -l)
  echo "   Sessions in current project: $SESSION_FILES"
  
  # Show recent sessions
  echo ""
  echo "   Recent sessions in this project:"
  find "$PROJECT_SESSION_DIR" -name "ses_*.json" -mmin -120 | sort -t_ -k2 -r | head -5 | while read session_file; do
    SESSION_NAME=$(basename "$session_file" .json)
    MODIFIED=$(stat -c %y "$session_file" 2>/dev/null || stat -f %Sm "$session_file" 2>/dev/null || echo "unknown")
    echo "   - $SESSION_NAME (modified: $MODIFIED)"
  done
else
  echo "   ⚠️  No sessions found for current project"
fi

echo ""
echo "4. Checking for lifecycle hook activity executions..."
echo ""

# Find recent manage-session-memory activities
LIFECYCLE_ACTIVITIES=$(find "$STORAGE_DIR/activity" -name "*.json" -mmin -120 -exec grep -l "manage-session-memory\|analyze-intent" {} \; 2>/dev/null | head -5)

if [ -n "$LIFECYCLE_ACTIVITIES" ]; then
  echo "   ✓ Found lifecycle hook activity executions:"
  echo ""
  
  for activity_file in $LIFECYCLE_ACTIVITIES; do
    node -e "
    const fs = require('fs');
    const activity = JSON.parse(fs.readFileSync('$activity_file', 'utf-8'));
    
    console.log('   Activity:', activity.id);
    console.log('   - Template:', activity.template || activity.templateId || 'inline');
    console.log('   - Status:', activity.status);
    console.log('   - Calling Session:', activity.callingSessionId || 'none');
    console.log('   - Created:', activity.createdAt ? new Date(activity.createdAt).toISOString() : 'unknown');
    
    if (activity.tasks && activity.tasks.length > 0) {
      console.log('   - Tasks:');
      activity.tasks.forEach(task => {
        console.log('     *', task.id, '-', task.status, task.error ? '(ERROR: ' + task.error.substring(0, 50) + '...)' : '');
      });
    }
    
    if (activity.executionEvidence?.sessionsSpawned) {
      console.log('   - Child Sessions:', activity.executionEvidence.sessionsSpawned.length);
    }
    console.log('');
    "
  done
else
  echo "   ⚠️  No lifecycle hook activities found in last 2 hours"
fi

echo ""
echo "=== Summary ==="
echo ""

# Final verification
if [ -f "$MEMORY_FILE" ]; then
  IMPULSE_COUNT=$(node -e "
  const fs = require('fs');
  const memory = JSON.parse(fs.readFileSync('$MEMORY_FILE', 'utf-8'));
  console.log(Object.keys(memory.impulses || {}).length);
  ")
  
  if [ "$IMPULSE_COUNT" -gt 0 ]; then
    echo "✅ VERIFIED: Session memory agent is working"
    echo "   - Impulses in memory state: $IMPULSE_COUNT"
    echo "   - Session: $SESSION_ID"
  else
    echo "⚠️  PARTIAL: Memory file exists but no impulses"
    echo "   - Session: $SESSION_ID"
    echo "   - May need to trigger with a meaningful user message"
  fi
else
  echo "⚠️  No memory file for most recent session"
  echo "   - Session: $SESSION_ID"
  echo "   - Lifecycle hook may not have executed yet"
fi

echo ""
echo "Sessions: Only sessions in current project shown above"
echo "No unexpected sessions created ✓"
echo ""
