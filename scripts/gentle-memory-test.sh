#!/usr/bin/env bash
# Gentle memory test - runs a few iterations with careful monitoring
# Designed to catch crashes without overwhelming the system

set -euo pipefail

CONTAINER="devbob-opencode"
LOG_DIR="/home/avi/documents/work/exp-repo/metabob-devbob/.memory-profiles"
TEST_LOG="$LOG_DIR/gentle_test_$(date +%Y%m%d_%H%M%S).log"

mkdir -p "$LOG_DIR"

{
  echo "========================================="
  echo "Gentle Memory Test"
  echo "========================================="
  echo "Container:   $CONTAINER"
  echo "Start time:  $(date)"
  echo "Iterations:  20 (conservative)"
  echo "Interval:    10 seconds"
  echo "========================================="
  echo ""
  
  # Create simple test activity
  ACTIVITY_DIR="/home/avi/documents/work/exp-repo/metabob-devbob/.activity-test"
  mkdir -p "$ACTIVITY_DIR"
  
  cat > "$ACTIVITY_DIR/01-simple.md" << 'EOF'
# Simple Memory Test

Test basic operations.

## Steps

1. Echo test:
   ```bash
   echo "Iteration test at $(date)"
   ```

2. Create temp file:
   ```bash
   echo "test" > /tmp/memtest_$$.txt
   ```

3. Read it back:
   ```bash
   cat /tmp/memtest_$$.txt
   ```

4. Clean up:
   ```bash
   rm -f /tmp/memtest_$$.txt
   ```
EOF
  
  echo "✓ Test activity created"
  echo ""
  
  # Get baseline
  MEM_BASELINE=$(docker stats "$CONTAINER" --no-stream --format "{{.MemUsage}}" | cut -d'/' -f1 | sed 's/MiB//g;s/GiB//g;s/ //g')
  echo "Baseline memory: ${MEM_BASELINE} MB"
  echo ""
  
  # Run iterations
  ITERATION=0
  FAILURES=0
  CRASHES=0
  
  while [[ $ITERATION -lt 20 ]]; do
    ITERATION=$((ITERATION + 1))
    
    printf "[%2d/20] %s | " "$ITERATION" "$(date '+%H:%M:%S')"
    
    # Check if container is still running
    if ! docker ps --filter "name=$CONTAINER" --filter "status=running" | grep -q "$CONTAINER"; then
      echo "💥 CONTAINER CRASHED!"
      CRASHES=$((CRASHES + 1))
      
      echo ""
      echo "Test stopped due to container crash"
      echo "Crashes detected: $CRASHES"
      echo "Iterations completed: $((ITERATION - 1))"
      break
    fi
    
    # Get memory before
    MEM_BEFORE=$(docker stats "$CONTAINER" --no-stream --format "{{.MemUsage}}" | cut -d'/' -f1 | sed 's/MiB//g;s/GiB//g;s/ //g' || echo "0")
    
    # Run activity
    if docker exec "$CONTAINER" opencode agent run "$ACTIVITY_DIR" --format json > "$LOG_DIR/iteration_${ITERATION}.json" 2>&1; then
      # Success
      sleep 2
      
      # Get memory after
      MEM_AFTER=$(docker stats "$CONTAINER" --no-stream --format "{{.MemUsage}}" | cut -d'/' -f1 | sed 's/MiB//g;s/GiB//g;s/ //g' || echo "0")
      
      # Calculate growth
      if [[ "$MEM_BEFORE" =~ ^[0-9]+$ ]] && [[ "$MEM_AFTER" =~ ^[0-9]+$ ]]; then
        GROWTH=$((MEM_AFTER - MEM_BEFORE))
        TOTAL_GROWTH=$((MEM_AFTER - MEM_BASELINE))
        
        printf "Mem: %4d MB → %4d MB (%+4d MB) | Total: %+4d MB" "$MEM_BEFORE" "$MEM_AFTER" "$GROWTH" "$TOTAL_GROWTH"
        
        # Alert on large growth
        if [[ $GROWTH -gt 50 ]]; then
          echo " ⚠️  SPIKE!"
        elif [[ $TOTAL_GROWTH -gt 500 ]]; then
          echo " 🔴 HIGH"
        else
          echo " ✓"
        fi
        
        # Alert if approaching limit
        if [[ $MEM_AFTER -gt 3000 ]]; then
          echo "  ⚠️  WARNING: Memory above 3 GB, stopping test to prevent crash"
          break
        fi
      else
        echo "Mem: unavailable"
      fi
    else
      echo "✗ FAILED"
      FAILURES=$((FAILURES + 1))
      
      if [[ $FAILURES -gt 5 ]]; then
        echo ""
        echo "Too many failures, stopping test"
        break
      fi
    fi
    
    # Wait between iterations
    sleep 10
  done
  
  echo ""
  echo "========================================="
  echo "Test Complete"
  echo "========================================="
  echo "Iterations:  $ITERATION"
  echo "Failures:    $FAILURES"
  echo "Crashes:     $CRASHES"
  echo "End time:    $(date)"
  
  # Final memory
  if docker ps --filter "name=$CONTAINER" --filter "status=running" | grep -q "$CONTAINER"; then
    FINAL_MEM=$(docker stats "$CONTAINER" --no-stream --format "{{.MemUsage}}" | cut -d'/' -f1 | sed 's/MiB//g;s/GiB//g;s/ //g' || echo "N/A")
    echo "Final memory: ${FINAL_MEM} MB"
    
    if [[ "$FINAL_MEM" =~ ^[0-9]+$ ]] && [[ "$MEM_BASELINE" =~ ^[0-9]+$ ]]; then
      TOTAL=$((FINAL_MEM - MEM_BASELINE))
      echo "Total growth: $TOTAL MB"
    fi
  else
    echo "Container is not running"
  fi
  
  echo "========================================="
  
} | tee "$TEST_LOG"

echo ""
echo "Test log: $TEST_LOG"
