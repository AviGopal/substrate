#!/usr/bin/env bash
# Docker Memory Monitor with Crash Detection
# Monitors docker container memory and logs to file
# Survives container crashes and restarts

set -euo pipefail

CONTAINER_NAME=${1:-devbob-opencode}
INTERVAL=${2:-5}
LOG_DIR="/home/avi/documents/work/exp-repo/metabob-devbob/.memory-profiles"
LOG_FILE="${LOG_DIR}/docker_memory_$(date +%Y%m%d_%H%M%S).log"

mkdir -p "$LOG_DIR"

echo "=========================================" | tee -a "$LOG_FILE"
echo "DOCKER MEMORY MONITOR" | tee -a "$LOG_FILE"
echo "=========================================" | tee -a "$LOG_FILE"
echo "Container:  $CONTAINER_NAME" | tee -a "$LOG_FILE"
echo "Interval:   ${INTERVAL}s" | tee -a "$LOG_FILE"
echo "Log file:   $LOG_FILE" | tee -a "$LOG_FILE"
echo "Start time: $(date)" | tee -a "$LOG_FILE"
echo "=========================================" | tee -a "$LOG_FILE"
echo "" | tee -a "$LOG_FILE"

# Header
{
  printf "%-19s %-15s %-12s %-12s %-10s %-10s %-8s %s\n" \
    "Timestamp" "Status" "MemUsage(MB)" "MemLimit(MB)" "MemPct" "Δ(MB)" "PIDs" "Event"
  echo "----------------------------------------------------------------------------------------------------------------"
} | tee -a "$LOG_FILE"

BASELINE_MEM=0
PREV_MEM=0
PREV_STATUS="unknown"
RESTART_COUNT=0
CRASH_COUNT=0

while true; do
  TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')
  
  # Get container stats
  if STATS=$(docker stats "$CONTAINER_NAME" --no-stream --format "{{.MemUsage}}|{{.MemPerc}}|{{.PIDs}}" 2>/dev/null); then
    # Parse stats
    MEM_USAGE=$(echo "$STATS" | cut -d'|' -f1 | cut -d'/' -f1 | sed 's/MiB//g;s/GiB//g;s/ //g')
    MEM_LIMIT=$(echo "$STATS" | cut -d'|' -f1 | cut -d'/' -f2 | sed 's/MiB//g;s/GiB//g;s/ //g')
    MEM_PCT=$(echo "$STATS" | cut -d'|' -f2 | sed 's/%//g;s/ //g')
    PIDS=$(echo "$STATS" | cut -d'|' -f3)
    
    # Convert to MB if needed
    if echo "$MEM_USAGE" | grep -q "G"; then
      MEM_USAGE_MB=$(echo "$MEM_USAGE" | awk '{print $1 * 1024}')
    else
      MEM_USAGE_MB=$(echo "$MEM_USAGE" | awk '{print int($1)}')
    fi
    
    if echo "$MEM_LIMIT" | grep -q "G"; then
      MEM_LIMIT_MB=$(echo "$MEM_LIMIT" | awk '{print $1 * 1024}')
    else
      MEM_LIMIT_MB=$(echo "$MEM_LIMIT" | awk '{print int($1)}')
    fi
    
    # Set baseline
    if [[ $BASELINE_MEM -eq 0 ]]; then
      BASELINE_MEM=$MEM_USAGE_MB
      PREV_MEM=$MEM_USAGE_MB
    fi
    
    # Calculate delta
    DELTA_MB=$((MEM_USAGE_MB - PREV_MEM))
    DELTA_STR=$(printf "%+d" $DELTA_MB)
    
    # Check status change
    STATUS="running"
    EVENT=""
    
    if [[ "$PREV_STATUS" == "stopped" ]] || [[ "$PREV_STATUS" == "unknown" ]]; then
      if [[ "$PREV_STATUS" == "stopped" ]]; then
        EVENT="🔄 RESTARTED"
        RESTART_COUNT=$((RESTART_COUNT + 1))
      else
        EVENT="✅ Started"
      fi
    fi
    
    # Alert conditions
    if [[ $DELTA_MB -gt 100 ]]; then
      EVENT="${EVENT} ⚠️  SPIKE +${DELTA_MB}MB"
    fi
    
    if [[ $(echo "$MEM_PCT > 80" | bc -l 2>/dev/null || echo 0) -eq 1 ]]; then
      EVENT="${EVENT} 🔴 HIGH MEMORY ${MEM_PCT}%"
    fi
    
    if [[ $(echo "$MEM_PCT > 95" | bc -l 2>/dev/null || echo 0) -eq 1 ]]; then
      EVENT="${EVENT} 🚨 CRITICAL ${MEM_PCT}%"
    fi
    
    # Print row
    {
      printf "%-19s %-15s %-12d %-12d %-10s %-10s %-8s %s\n" \
        "$TIMESTAMP" "$STATUS" "$MEM_USAGE_MB" "$MEM_LIMIT_MB" "${MEM_PCT}%" "$DELTA_STR" "$PIDS" "$EVENT"
    } | tee -a "$LOG_FILE"
    
    PREV_MEM=$MEM_USAGE_MB
    PREV_STATUS="running"
    
  else
    # Container not found or stopped
    if [[ "$PREV_STATUS" == "running" ]]; then
      EVENT="💥 CRASHED/STOPPED"
      CRASH_COUNT=$((CRASH_COUNT + 1))
      
      {
        printf "%-19s %-15s %-12s %-12s %-10s %-10s %-8s %s\n" \
          "$TIMESTAMP" "STOPPED" "N/A" "N/A" "N/A" "N/A" "0" "$EVENT"
        echo "  └─ Last memory: ${PREV_MEM} MB"
        echo "  └─ Total crashes: $CRASH_COUNT"
        echo "  └─ Total restarts: $RESTART_COUNT"
      } | tee -a "$LOG_FILE"
    fi
    
    PREV_STATUS="stopped"
  fi
  
  sleep "$INTERVAL"
done
