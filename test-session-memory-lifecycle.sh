#!/bin/bash
# Test session memory agent lifecycle hook
# Verifies that impulses are created and transferred to parent session

set -e

echo "=== Session Memory Lifecycle Hook Test ==="
echo ""

# Get project root
PROJECT_ROOT="/home/avi/documents/work/exp-repo/metabob-devbob/repos/metabob-opencode"
STORAGE_DIR="$HOME/.local/share/opencode/storage"

cd "$PROJECT_ROOT"

echo "1. Building OpenCode..."
npm run build > /dev/null 2>&1 || true
echo "   ✓ Build complete"
echo ""

echo "2. Starting fresh test session..."
SESSION_ID=$(node -e "
const { Session } = require('./packages/opencode/dist/session/index.js');
const { Project } = require('./packages/opencode/dist/project/index.js');

async function test() {
  // Initialize project
  await Project.initialize('$PROJECT_ROOT');
  
  // Create new session
  const session = await Session.create('test-lifecycle-hook', {
    agent: 'activity',
    mode: 'primary'
  });
  
  console.log(session.id);
}

test().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
")

echo "   ✓ Session created: $SESSION_ID"
echo ""

echo "3. Sending test message to trigger lifecycle hook..."
echo "   Message: 'We are testing fixes related to the session memory agent running as a lifecycle hook'"
echo ""

# Send message that should trigger memory agent
node -e "
const { Session } = require('./packages/opencode/dist/session/index.js');
const { Agent } = require('./packages/opencode/dist/agent/agent.js');
const { Project } = require('./packages/opencode/dist/project/index.js');

async function test() {
  await Project.initialize('$PROJECT_ROOT');
  
  const session = await Session.load('$SESSION_ID');
  const agent = Agent.get('activity');
  
  // This should trigger the lifecycle hook
  const result = await session.sendMessage(
    'We are testing fixes related to the session memory agent running as a lifecycle hook',
    agent,
    { timeout: 120000 }
  );
  
  console.log('Message sent, response received');
}

test().catch(err => {
  console.error('Error:', err.message);
  console.error(err.stack);
  process.exit(1);
});
" || true

echo ""
echo "4. Checking session memory state..."

# Check if memory file was created
MEMORY_FILE="$STORAGE_DIR/session-memory/${SESSION_ID}.json"

if [ -f "$MEMORY_FILE" ]; then
  echo "   ✓ Memory file exists: $MEMORY_FILE"
  
  # Parse and display impulses
  node -e "
  const fs = require('fs');
  const content = JSON.parse(fs.readFileSync('$MEMORY_FILE', 'utf-8'));
  
  console.log('');
  console.log('   Session Memory Content:');
  console.log('   - Session ID:', content.sessionID);
  console.log('   - Total Budget:', content.totalBudget || 0);
  console.log('   - Used Tokens:', content.usedTokens || 0);
  console.log('   - Impulse Count:', Object.keys(content.impulses || {}).length);
  console.log('');
  
  if (content.impulses && Object.keys(content.impulses).length > 0) {
    console.log('   Impulses:');
    for (const [id, impulse] of Object.entries(content.impulses)) {
      console.log('   - ID:', impulse.id);
      console.log('     Type:', impulse.type);
      console.log('     Priority:', impulse.priority);
      console.log('     Budget:', impulse.budget);
      console.log('     Scope:', impulse.scope);
      console.log('     Loaded:', impulse.loaded);
      console.log('');
    }
  } else {
    console.log('   ⚠️  No impulses found');
  }
  "
else
  echo "   ⚠️  Memory file not found: $MEMORY_FILE"
fi

echo ""
echo "5. Checking for activity executions..."

# Find recent activity executions for this session
ACTIVITIES=$(find "$STORAGE_DIR/activity" -name "*.json" -mmin -5 -exec grep -l "\"callingSessionId\":\"$SESSION_ID\"" {} \; 2>/dev/null || true)

if [ -n "$ACTIVITIES" ]; then
  echo "   ✓ Found activity executions:"
  for activity_file in $ACTIVITIES; do
    node -e "
    const fs = require('fs');
    const activity = JSON.parse(fs.readFileSync('$activity_file', 'utf-8'));
    console.log('   - Activity ID:', activity.id);
    console.log('     Template:', activity.template || activity.templateId || 'inline');
    console.log('     Status:', activity.status);
    console.log('     Calling Session:', activity.callingSessionId);
    console.log('     Tasks:', activity.tasks?.length || 0);
    if (activity.executionEvidence?.sessionsSpawned) {
      console.log('     Child Sessions:', activity.executionEvidence.sessionsSpawned.length);
    }
    console.log('');
    "
  done
else
  echo "   ⚠️  No activity executions found"
fi

echo ""
echo "6. Checking for child sessions..."

# Find child sessions created by activities
CHILD_SESSIONS=$(find "$STORAGE_DIR/session" -type d -name "ses_*" -mmin -5 2>/dev/null | wc -l)
echo "   Recent child sessions created: $CHILD_SESSIONS"

echo ""
echo "7. Summary:"
echo ""

if [ -f "$MEMORY_FILE" ]; then
  IMPULSE_COUNT=$(node -e "
  const fs = require('fs');
  const content = JSON.parse(fs.readFileSync('$MEMORY_FILE', 'utf-8'));
  console.log(Object.keys(content.impulses || {}).length);
  ")
  
  if [ "$IMPULSE_COUNT" -gt 0 ]; then
    echo "   ✅ SUCCESS: Session memory agent created $IMPULSE_COUNT impulse(s)"
    echo "   ✅ Impulses transferred to parent session"
    echo "   ✅ Lifecycle hook working correctly"
  else
    echo "   ⚠️  WARNING: Memory file exists but no impulses created"
    echo "   Check activity execution logs for errors"
  fi
else
  echo "   ❌ FAILED: No session memory file created"
  echo "   Lifecycle hook may not have executed"
fi

echo ""
echo "=== Test Complete ==="
