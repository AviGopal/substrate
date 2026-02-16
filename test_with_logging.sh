#!/bin/bash
# Test activity execution with enhanced logging
# This will show exactly where the hang occurs

cd /home/avi/documents/work/exp-repo/metabob-devbob

echo "======================================================================"
echo "Activity Execution Test with Enhanced Logging"
echo "======================================================================"
echo ""
echo "Starting OpenCode with activity execution..."
echo "Watch for 🔵 (TaskTool call), 🟢 (success), 🔴 (busy/queued)"
echo ""
echo "Test: 3-task template (feature-fdb6afae)"
echo ""
echo "Press Ctrl+C after 30 seconds if hung"
echo ""

# Clear old debug log
> activity-debug.log

# Start OpenCode in background
cd repos/metabob-opencode
timeout 60s bun run dev ../../.. <<'EOF' &
activity({
  activityId: "feature-fdb6afae",
  variables: {
    method: "GET",
    path: "/api/test",
    description: "Test endpoint"
  },
  reason: "Test activity execution with logging"
})
EOF

OPENCODE_PID=$!

# Monitor logs in real-time
echo "Monitoring activity-debug.log and OpenCode output..."
cd ../..

# Wait a bit for startup
sleep 5

# Tail both logs
tail -f activity-debug.log 2>/dev/null &
TAIL_PID=$!

# Wait for OpenCode
wait $OPENCODE_PID 2>/dev/null
EXIT_CODE=$?

# Cleanup
kill $TAIL_PID 2>/dev/null

echo ""
echo "======================================================================"
echo "Test completed with exit code: $EXIT_CODE"
echo "======================================================================"
echo ""
echo "Check activity-debug.log for full trace"

exit $EXIT_CODE
