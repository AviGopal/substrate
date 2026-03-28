#!/bin/bash
set -e

POD="devbob-678c8b59dc-tvksd"
NAMESPACE="metabob"

echo "=========================================="
echo "Executing vessel-codebase-pull-and-validate"
echo "=========================================="
echo ""
echo "Repository: https://github.com/avigopal/opencode.git"
echo "Vessel Name: opencode"
echo "Pod: $POD"
echo ""

# Start log monitoring in background
echo "Starting log monitor..."
kubectl logs -n $NAMESPACE $POD -f --tail=0 > /tmp/devbob-activity-logs.txt 2>&1 &
LOG_PID=$!

echo "Log PID: $LOG_PID"
sleep 2

# Execute the activity
echo ""
echo "Executing activity via opencode CLI..."
echo ""

kubectl exec -n $NAMESPACE $POD -- sh -c '
cd /workspace

# Execute activity using opencode CLI
/opt/opencode/bin/opencode activity execute vessel-codebase-pull-and-validate \
  --variable repoUrl="https://github.com/avigopal/opencode.git" \
  --variable vesselName="opencode" \
  --variable branch="main" \
  --variable gitUserName="DevBob Agent" \
  --variable gitUserEmail="devbob@metabob.local" \
  --variable skipTestsOnFailure="true" \
  --variable hasGitHubToken="false" \
  --reason "Validate devbob K8s deployment can pull and process vessel codebase from avigopal/opencode.git. Test all 8 core capabilities systematically." \
  --print-logs \
  --log-level INFO
' 2>&1 | tee /tmp/devbob-activity-execution.txt

EXEC_STATUS=${PIPESTATUS[0]}

# Stop log monitoring
echo ""
echo "Stopping log monitor (PID: $LOG_PID)..."
kill $LOG_PID 2>/dev/null || true
wait $LOG_PID 2>/dev/null || true

echo ""
echo "=========================================="
if [ $EXEC_STATUS -eq 0 ]; then
    echo "✅ Activity execution initiated successfully"
else
    echo "❌ Activity execution failed with exit code: $EXEC_STATUS"
fi
echo "=========================================="
echo ""

echo "📋 Execution logs saved to: /tmp/devbob-activity-execution.txt"
echo "📋 Container logs saved to: /tmp/devbob-activity-logs.txt"
echo ""

# Show last 50 lines of container logs
echo "Last 50 lines of container logs:"
echo "----------------------------------------"
tail -50 /tmp/devbob-activity-logs.txt

exit $EXEC_STATUS
