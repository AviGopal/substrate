#!/usr/bin/env bash
# Watch for docker crashes and capture logs immediately

CONTAINER="devbob-opencode"
LOG_DIR="/home/avi/documents/work/exp-repo/metabob-devbob/.memory-profiles"
mkdir -p "$LOG_DIR"

echo "========================================="
echo "Docker Crash Watcher"
echo "Container: $CONTAINER"
echo "Started: $(date)"
echo "========================================="
echo ""

CRASH_COUNT=0
LAST_STATUS="unknown"

while true; do
  # Check container status
  if docker ps --filter "name=$CONTAINER" --filter "status=running" | grep -q "$CONTAINER"; then
    STATUS="running"
    
    # If just recovered from crash
    if [[ "$LAST_STATUS" == "crashed" ]]; then
      echo "[$(date '+%H:%M:%S')] ✓ Container recovered and running"
    fi
    
    LAST_STATUS="running"
  else
    # Container not running
    if [[ "$LAST_STATUS" == "running" ]]; then
      CRASH_COUNT=$((CRASH_COUNT + 1))
      TIMESTAMP=$(date +%Y%m%d_%H%M%S)
      
      echo ""
      echo "💥 CRASH DETECTED at $(date '+%H:%M:%S') (Crash #$CRASH_COUNT)"
      echo "  Capturing logs..."
      
      # Capture logs immediately
      docker logs "$CONTAINER" --tail 500 > "$LOG_DIR/crash_${TIMESTAMP}.log" 2>&1
      
      # Capture system state
      {
        echo "=== Docker Inspect ==="
        docker inspect "$CONTAINER" 2>&1
        echo ""
        echo "=== System Memory ==="
        free -h
        echo ""
        echo "=== Docker Events (last 20) ==="
        docker events --since 5m --until 1s 2>&1 | tail -20
      } > "$LOG_DIR/crash_${TIMESTAMP}_system.log"
      
      echo "  ✓ Logs saved to:"
      echo "    - $LOG_DIR/crash_${TIMESTAMP}.log"
      echo "    - $LOG_DIR/crash_${TIMESTAMP}_system.log"
      echo ""
      
      LAST_STATUS="crashed"
      
      # Wait for potential restart
      sleep 5
    fi
  fi
  
  sleep 2
done
