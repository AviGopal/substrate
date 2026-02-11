#!/usr/bin/env bash
# Simple session test - runs opencode with simple prompts to stress message system

set -euo pipefail

CONTAINER="devbob-opencode"
LOG_DIR="/home/avi/documents/work/exp-repo/metabob-devbob/.memory-profiles"
TEST_LOG="$LOG_DIR/session_test_$(date +%Y%m%d_%H%M%S).log"

mkdir -p "$LOG_DIR"

{
  echo "========================================="
  echo "Simple Session Memory Test"
  echo "========================================="
  echo "Container:   $CONTAINER"
  echo "Start time:  $(date)"
  echo "Iterations:  30"
  echo "Interval:    5 seconds"
  echo "========================================="
  echo ""
  
  # Get baseline
  MEM_BASELINE=$(docker stats "$CONTAINER" --no-stream --format "{{.MemUsage}}" | cut -d'/' -f1 | sed 's/MiB//g;s/GiB//g;s/ //g')
  echo "Baseline memory: ${MEM_BASELINE} MB"
  echo ""
  
  # Run iterations with simple prompts
  ITERATION=0
  FAILURES=0
  CRASHES=0
  
  while [[ $ITERATION -lt 30 ]]; do
    ITERATION=$((ITERATION + 1))
    
    printf "[%2d/30] %s | " "$ITERATION" "$(date '+%H:%M:%S')"
    
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
    
    # Run simple command that creates a session
    PROMPT="echo 'Test iteration $ITERATION at $(date)' && ls /workspace"
    
    if timeout 30 docker exec "$CONTAINER" opencode run "$PROMPT" > "$LOG_DIR/session_${ITERATION}.txt" 2>&1; then
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
        elif [[ $TOTAL_GROWTH -gt 1000 ]]; then
          echo " 🔴 HIGH"
        elif [[ $GROWTH -lt -20 ]]; then
          echo " ✓ GC"
        else
          echo " ✓"
        fi
        
        # Alert if approaching limit
        if [[ $MEM_AFTER -gt 4000 ]]; then
          echo "  ⚠️  WARNING: Memory above 4 GB, stopping test to prevent crash"
          break
        fi
      else
        echo "Mem: unavailable"
      fi
    else
      echo "✗ FAILED/TIMEOUT"
      FAILURES=$((FAILURES + 1))
      
      if [[ $FAILURES -gt 5 ]]; then
        echo ""
        echo "Too many failures, stopping test"
        break
      fi
    fi
    
    # Small wait between iterations
    sleep 5
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
      
      # Calculate growth rate
      if [[ $ITERATION -gt 0 ]]; then
        AVG_GROWTH=$((TOTAL / ITERATION))
        echo "Average growth per iteration: ${AVG_GROWTH} MB"
        
        # Projection
        PROJECTED_100=$((AVG_GROWTH * 100))
        echo "Projected growth (100 iterations): ${PROJECTED_100} MB"
        
        if [[ $PROJECTED_100 -gt 2000 ]]; then
          echo "  ⚠️  WARNING: High growth rate, OOM likely"
        elif [[ $PROJECTED_100 -lt 500 ]]; then
          echo "  ✓ GOOD: Low growth rate, fix working"
        fi
      fi
    fi
  else
    echo "Container is not running"
  fi
  
  echo "========================================="
  
} | tee "$TEST_LOG"

echo ""
echo "Test log: $TEST_LOG"
