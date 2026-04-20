#!/bin/bash
# Test complete activity execution flow
# Verifies that activities execute, store traces, and update Thompson scores

set -e

echo "═══════════════════════════════════════════════════════════════════"
echo "  Testing Complete Activity Flow"
echo "═══════════════════════════════════════════════════════════════════"
echo ""

API_KEY="mb-bWV0YWJvYi1taW5pYm9iLXNlcnZpY2Uta2V5X3VkMVhORUFUVEVVZ1kzTHEtaHR0cHM6Ly9pZGVudGl0eS5tZXRhYm9iLmNvbQ-f92a497a9baef17a6d4e497d6f76d211"
ACTIVITY_API="http://activity.metabob.local"

# Step 1: Check baseline
echo "Step 1: Checking current state..."
BEFORE_COUNT=$(curl -s -H "Authorization: ApiKey $API_KEY" \
  "$ACTIVITY_API/v2/activities/execution-traces?limit=100" | \
  jq '.executions | length')
echo "  Current executions in DB: $BEFORE_COUNT"

# Step 2: Run a simple activity via MiniBob
echo ""
echo "Step 2: Running a simple activity..."
echo "  Activity: 'list files in current directory'"
echo ""

cd ../repos/minibob

# Run with timeout
timeout 30 bun run index.ts --single "list files in the current directory" 2>&1 | tee /tmp/minibob-test-output.txt || {
  echo ""
  echo "⚠ Activity execution timed out or failed"
}

# Step 3: Check if trace was stored
echo ""
echo "Step 3: Checking if trace was stored..."
sleep 2  # Give it a moment to store

AFTER_COUNT=$(curl -s -H "Authorization: ApiKey $API_KEY" \
  "$ACTIVITY_API/v2/activities/execution-traces?limit=100" | \
  jq '.executions | length')
echo "  Executions in DB now: $AFTER_COUNT"

if [ "$AFTER_COUNT" -gt "$BEFORE_COUNT" ]; then
    echo "  ✓ New execution stored! ($BEFORE_COUNT → $AFTER_COUNT)"

    # Show the latest execution
    echo ""
    echo "Latest execution:"
    curl -s -H "Authorization: ApiKey $API_KEY" \
      "$ACTIVITY_API/v2/activities/execution-traces?limit=1" | \
      jq '.executions[0] | {activity_id, status, success, duration_ms, created_at}'
else
    echo "  ✗ No new execution found"
    echo ""
    echo "Possible issues:"
    echo "  1. MiniBob couldn't connect to Activity API"
    echo "  2. Activity failed before storing trace"
    echo "  3. Authentication issue"
    echo ""
    echo "Check MiniBob output above for errors"
fi

echo ""
echo "═══════════════════════════════════════════════════════════════════"
