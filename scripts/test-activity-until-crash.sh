#!/usr/bin/env bash
# Test Activity Execution Until Crash
# Runs repeated activity executions to trigger memory issues

set -euo pipefail

CONTAINER_NAME="devbob-opencode"
TEST_DIR="/home/avi/documents/work/exp-repo/metabob-devbob/.activity-test"
LOG_DIR="/home/avi/documents/work/exp-repo/metabob-devbob/.memory-profiles"
ITERATION_LOG="${LOG_DIR}/activity_iterations_$(date +%Y%m%d_%H%M%S).log"

mkdir -p "$TEST_DIR"
mkdir -p "$LOG_DIR"

echo "=========================================" | tee -a "$ITERATION_LOG"
echo "ACTIVITY EXECUTION TEST - MEMORY LEAK" | tee -a "$ITERATION_LOG"
echo "=========================================" | tee -a "$ITERATION_LOG"
echo "Container:   $CONTAINER_NAME" | tee -a "$ITERATION_LOG"
echo "Test dir:    $TEST_DIR" | tee -a "$ITERATION_LOG"
echo "Log file:    $ITERATION_LOG" | tee -a "$ITERATION_LOG"
echo "Start time:  $(date)" | tee -a "$ITERATION_LOG"
echo "=========================================" | tee -a "$ITERATION_LOG"
echo "" | tee -a "$ITERATION_LOG"

# Create test activity template
cat > "$TEST_DIR/01-test.md" << 'EOFTEMPLATE'
# Test Activity - Memory Profiling

This is a test activity to trigger memory usage patterns.

## Task

Create a simple test file with some content, run basic operations, then clean up.

Steps:
1. Create a test file
2. Read it back
3. Run some git commands
4. Delete the file

This simulates typical activity patterns that may cause memory accumulation.
EOFTEMPLATE

echo "✓ Created test activity template" | tee -a "$ITERATION_LOG"
echo "" | tee -a "$ITERATION_LOG"

# Function to check if container is healthy
check_container() {
  if docker ps --filter "name=$CONTAINER_NAME" --filter "status=running" | grep -q "$CONTAINER_NAME"; then
    return 0
  else
    return 1
  fi
}

# Function to get container memory
get_memory() {
  docker stats "$CONTAINER_NAME" --no-stream --format "{{.MemUsage}}" 2>/dev/null | cut -d'/' -f1 | sed 's/MiB//g;s/GiB//g;s/ //g' || echo "N/A"
}

# Main test loop
ITERATION=0
MAX_ITERATIONS=100
FAILURE_COUNT=0

while [[ $ITERATION -lt $MAX_ITERATIONS ]]; do
  ITERATION=$((ITERATION + 1))
  
  echo "----------------------------------------" | tee -a "$ITERATION_LOG"
  echo "[Iteration $ITERATION/$MAX_ITERATIONS] $(date '+%H:%M:%S')" | tee -a "$ITERATION_LOG"
  
  # Check container health
  if ! check_container; then
    echo "  ❌ Container is not running!" | tee -a "$ITERATION_LOG"
    echo "  💥 CRASH DETECTED after $((ITERATION - 1)) iterations" | tee -a "$ITERATION_LOG"
    echo "" | tee -a "$ITERATION_LOG"
    
    # Capture crash logs
    echo "  Capturing crash logs..." | tee -a "$ITERATION_LOG"
    docker logs "$CONTAINER_NAME" --tail 100 > "${LOG_DIR}/crash_logs_iter${ITERATION}_$(date +%H%M%S).log" 2>&1 || true
    
    echo "  Waiting 30 seconds for potential restart..." | tee -a "$ITERATION_LOG"
    sleep 30
    
    if ! check_container; then
      echo "  Container did not restart. Exiting test." | tee -a "$ITERATION_LOG"
      break
    else
      echo "  ✓ Container restarted, continuing..." | tee -a "$ITERATION_LOG"
    fi
  fi
  
  # Get memory before
  MEM_BEFORE=$(get_memory)
  echo "  Memory before: ${MEM_BEFORE}" | tee -a "$ITERATION_LOG"
  
  # Execute activity
  echo "  Executing activity..." | tee -a "$ITERATION_LOG"
  START_TIME=$(date +%s)
  
  if docker exec "$CONTAINER_NAME" opencode agent run "$TEST_DIR" --format json > "${LOG_DIR}/activity_output_iter${ITERATION}.json" 2>&1; then
    END_TIME=$(date +%s)
    DURATION=$((END_TIME - START_TIME))
    echo "  ✓ Activity completed in ${DURATION}s" | tee -a "$ITERATION_LOG"
    
    # Get memory after
    sleep 2
    MEM_AFTER=$(get_memory)
    echo "  Memory after:  ${MEM_AFTER}" | tee -a "$ITERATION_LOG"
    
    # Calculate growth (if numeric)
    if [[ "$MEM_BEFORE" =~ ^[0-9]+$ ]] && [[ "$MEM_AFTER" =~ ^[0-9]+$ ]]; then
      GROWTH=$((MEM_AFTER - MEM_BEFORE))
      echo "  Growth: ${GROWTH} MB" | tee -a "$ITERATION_LOG"
      
      if [[ $GROWTH -gt 50 ]]; then
        echo "  ⚠️  Large growth detected!" | tee -a "$ITERATION_LOG"
      fi
    fi
    
  else
    echo "  ❌ Activity execution failed" | tee -a "$ITERATION_LOG"
    FAILURE_COUNT=$((FAILURE_COUNT + 1))
    
    # Save failure output
    cp "${LOG_DIR}/activity_output_iter${ITERATION}.json" "${LOG_DIR}/activity_failure_iter${ITERATION}.json" 2>/dev/null || true
    
    # Check if container crashed during execution
    if ! check_container; then
      echo "  💥 Container crashed during activity execution!" | tee -a "$ITERATION_LOG"
      docker logs "$CONTAINER_NAME" --tail 100 > "${LOG_DIR}/crash_logs_during_execution_iter${ITERATION}.log" 2>&1 || true
      break
    fi
  fi
  
  echo "" | tee -a "$ITERATION_LOG"
  
  # Small delay between iterations
  sleep 3
  
  # Check failure threshold
  if [[ $FAILURE_COUNT -gt 5 ]]; then
    echo "Too many failures ($FAILURE_COUNT), stopping test" | tee -a "$ITERATION_LOG"
    break
  fi
done

echo "=========================================" | tee -a "$ITERATION_LOG"
echo "TEST COMPLETE" | tee -a "$ITERATION_LOG"
echo "=========================================" | tee -a "$ITERATION_LOG"
echo "Total iterations: $ITERATION" | tee -a "$ITERATION_LOG"
echo "Failures: $FAILURE_COUNT" | tee -a "$ITERATION_LOG"
echo "End time: $(date)" | tee -a "$ITERATION_LOG"
echo "=========================================" | tee -a "$ITERATION_LOG"
echo "" | tee -a "$ITERATION_LOG"
echo "Review logs in: $LOG_DIR" | tee -a "$ITERATION_LOG"
