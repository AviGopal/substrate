#!/bin/bash
set -e

POD="devbob-794b69b4f4-rhnwg"
NS="metabob"
LOG_FILE="lifecycle-validation-$(date +%s).log"

echo "=== Activity System Lifecycle Validation ==="
echo "Pod: $POD"
echo "Namespace: $NS"
echo "Log file: $LOG_FILE"
echo ""

# Start capturing logs in background
echo "Starting log capture..."
kubectl logs -n $NS $POD -f > "$LOG_FILE" 2>&1 &
LOG_PID=$!
echo "Log capture started (PID: $LOG_PID)"

# Give logs time to start capturing
sleep 2

# Execute a simple activity
echo ""
echo "Executing test activity..."
kubectl exec -it -n $NS $POD -- sh -c 'echo "Create a file named test.txt with content Hello World" | opencode run' 2>&1 | tee activity-output.log

# Wait for activity to complete
echo ""
echo "Waiting 30 seconds for activity completion..."
sleep 30

# Stop log capture
echo ""
echo "Stopping log capture..."
kill $LOG_PID 2>/dev/null || true
sleep 2

# Validate patterns
echo ""
echo "=== Validating Lifecycle Log Patterns ==="
echo ""

PATTERNS=(
  "Activity:.*starting"
  "Memory agent initializing"
  "Memory agent gathered.*impulses"
  "Task starting:"
  "Task completed:"
  "storage write confirmed"
  "Git commit created:"
  "Activity completed:"
)

FOUND=0
for i in "${!PATTERNS[@]}"; do
  PATTERN="${PATTERNS[$i]}"
  if grep -qE "$PATTERN" "$LOG_FILE"; then
    echo "✅ Pattern $((i+1))/8 FOUND: $PATTERN"
    FOUND=$((FOUND+1))
  else
    echo "❌ Pattern $((i+1))/8 MISSING: $PATTERN"
  fi
done

echo ""
echo "=== Results ==="
echo "Patterns found: $FOUND / 8"
echo "Log file: $LOG_FILE"
echo ""

if [ $FOUND -eq 8 ]; then
  echo "✅ VALIDATION PASSED - All lifecycle logs visible"
  exit 0
else
  echo "❌ VALIDATION FAILED - Missing $((8 - FOUND)) patterns"
  echo ""
  echo "Sample of captured logs:"
  head -50 "$LOG_FILE"
  exit 1
fi
