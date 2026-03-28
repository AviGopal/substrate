#!/bin/bash
set -e

POD="devbob-794b69b4f4-rhnwg"
NS="metabob"

echo "=== Quick Lifecycle Log Validation ==="
echo "Pod: $POD"
echo ""

# Get current log size
BEFORE=$(kubectl logs -n $NS $POD 2>&1 | wc -l)
echo "Log lines before activity: $BEFORE"

# Execute very simple activity
echo ""
echo "Executing: List files in current directory..."
timeout 60 kubectl exec -n $NS $POD -- sh -c 'echo "list files" | opencode run --no-tui' 2>&1 | head -50 &
EXEC_PID=$!

# Wait for execution
sleep 30

# Check if still running
if kill -0 $EXEC_PID 2>/dev/null; then
  echo "Activity still running, waiting..."
  wait $EXEC_PID || true
fi

# Get logs after
echo ""
echo "Checking logs..."
AFTER=$(kubectl logs -n $NS $POD --tail=200 2>&1 | wc -l)
echo "Log lines after activity: $AFTER"

# Check for lifecycle patterns
echo ""
echo "=== Checking for Lifecycle Patterns ==="
kubectl logs -n $NS $POD --tail=200 2>&1 > /tmp/quick-val-logs.txt

PATTERNS=(
  "Activity.*starting"
  "Memory agent initializing"
  "Task starting:"
  "Activity completed:"
)

FOUND=0
for pattern in "${PATTERNS[@]}"; do
  if grep -qE "$pattern" /tmp/quick-val-logs.txt; then
    echo "✓ Found: $pattern"
    FOUND=$((FOUND+1))
  else
    echo "✗ Missing: $pattern"
  fi
done

echo ""
echo "Result: $FOUND / ${#PATTERNS[@]} patterns found"

if [ $FOUND -gt 0 ]; then
  echo ""
  echo "Sample matching logs:"
  grep -E "Activity|Task|Memory" /tmp/quick-val-logs.txt | head -10
fi
