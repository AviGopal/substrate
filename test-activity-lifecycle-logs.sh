#!/bin/bash
# Runtime validation for Activity System Complete Execution Lifecycle

POD_NAME="devbob-794b69b4f4-dxr4q"
NAMESPACE="metabob"
LOG_FILE="./activity-runtime-logs.txt"

echo "════════════════════════════════════════════════════════════"
echo "  Activity System Complete Execution Lifecycle - Runtime Test"
echo "════════════════════════════════════════════════════════════"
echo ""

# Check if template exists
echo "Step 1: Checking if trace-data-flow-single-feature template exists..."
if kubectl exec -n $NAMESPACE $POD_NAME -- test -f /root/.local/share/opencode/storage/activity-template/trace-data-flow-single-feature.json 2>/dev/null; then
  echo "✅ Template found"
else
  echo "❌ Template not found"
  echo ""
  echo "Available templates:"
  kubectl exec -n $NAMESPACE $POD_NAME -- ls -la /root/.local/share/opencode/storage/activity-template/ 2>/dev/null || echo "Cannot list templates"
  exit 1
fi
echo ""

# Start log monitoring in background
echo "Step 2: Starting log monitor..."
kubectl logs -f -n $NAMESPACE $POD_NAME > "$LOG_FILE" 2>&1 &
LOG_PID=$!
echo "Log monitor PID: $LOG_PID"
echo ""

# Give logs a moment to start streaming
sleep 1

# Execute activity
echo "Step 3: Executing activity via kubectl exec..."
echo "Command: opencode run '%trace-data-flow-single-feature Test activity execution logs'"
echo ""

kubectl exec -it -n $NAMESPACE $POD_NAME -- \
  opencode run '%trace-data-flow-single-feature Test activity execution logs' 2>&1

EXEC_EXIT_CODE=$?

echo ""
echo "Activity execution exit code: $EXEC_EXIT_CODE"
echo ""

# Wait for logs to flush
sleep 3

# Kill log monitor
kill $LOG_PID 2>/dev/null || true
sleep 1

echo "════════════════════════════════════════════════════════════"
echo "  Analyzing captured logs..."
echo "════════════════════════════════════════════════════════════"
echo ""

# Analyze logs for expected patterns
echo "Checking for expected log patterns:"
echo ""

declare -a patterns=(
  "Activity:.*starting"
  "Memory agent initializing"
  "Memory agent gathered.*impulses"
  "Task starting:"
  "Task completed:"
  "Git commit created:"
  "storage write confirmed"
  "Activity completed:"
)

passed=0
failed=0

for pattern in "${patterns[@]}"; do
  if grep -E "$pattern" "$LOG_FILE" >/dev/null 2>&1; then
    echo "✅ Found: $pattern"
    # Show matching line
    grep -E "$pattern" "$LOG_FILE" | head -1 | sed 's/^/   /'
    ((passed++))
  else
    echo "❌ Missing: $pattern"
    ((failed++))
  fi
done

echo ""
echo "════════════════════════════════════════════════════════════"
echo "  Results: $passed passed, $failed failed (out of ${#patterns[@]})"
echo "════════════════════════════════════════════════════════════"
echo ""

if [ $failed -eq 0 ]; then
  echo "✅ VALIDATION PASSED - All lifecycle logs confirmed"
  echo ""
  echo "Full logs saved to: $LOG_FILE"
  exit 0
else
  echo "❌ VALIDATION FAILED - Some logs missing"
  echo ""
  echo "Full logs saved to: $LOG_FILE"
  echo ""
  echo "Tip: Review the log file to see what was captured:"
  echo "  cat $LOG_FILE | grep -E 'Activity|Task|Memory agent|storage|Git commit'"
  exit 1
fi
