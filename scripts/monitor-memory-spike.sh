#!/usr/bin/env bash
# Memory Spike Monitor
# Usage: ./monitor-memory-spike.sh <PID> [interval_seconds]
# Monitors RSS, heap, and message count over time

set -euo pipefail

PID=${1:-}
INTERVAL=${2:-5}

if [[ -z "$PID" ]]; then
  echo "Usage: $0 <PID> [interval_seconds]"
  echo "Example: $0 1980723 5"
  exit 1
fi

# Check if process exists
if ! kill -0 "$PID" 2>/dev/null; then
  echo "Error: Process $PID does not exist"
  exit 1
fi

echo "========================================="
echo "MEMORY SPIKE MONITOR"
echo "========================================="
echo "PID:        $PID"
echo "Interval:   ${INTERVAL}s"
echo "Start time: $(date)"
echo "========================================="
echo ""

# Header
printf "%-8s %-12s %-10s %-10s %-10s %-10s %-10s %-8s\n" \
  "Time" "RSS(MB)" "Δ(MB)" "VmData(GB)" "RssAnon(MB)" "RssFile(MB)" "Swap(MB)" "Threads"
echo "----------------------------------------------------------------------------------------"

# Baseline
BASELINE_RSS=0
PREV_RSS=0

while true; do
  # Check if process still exists
  if ! kill -0 "$PID" 2>/dev/null; then
    echo ""
    echo "Process $PID terminated"
    break
  fi
  
  # Get current time
  TIMESTAMP=$(date +%H:%M:%S)
  
  # Get RSS from ps
  RSS_KB=$(ps -p "$PID" -o rss= 2>/dev/null | tr -d ' ' || echo "0")
  RSS_MB=$((RSS_KB / 1024))
  
  # Set baseline on first iteration
  if [[ $BASELINE_RSS -eq 0 ]]; then
    BASELINE_RSS=$RSS_MB
    PREV_RSS=$RSS_MB
  fi
  
  # Calculate delta
  DELTA_MB=$((RSS_MB - PREV_RSS))
  DELTA_STR=$(printf "%+d" $DELTA_MB)
  
  # Get detailed memory from /proc
  if [[ -f "/proc/$PID/status" ]]; then
    VMDATA_KB=$(grep "^VmData:" "/proc/$PID/status" | awk '{print $2}')
    VMDATA_GB=$(awk "BEGIN {printf \"%.2f\", $VMDATA_KB / 1024 / 1024}")
    
    THREADS=$(grep "^Threads:" "/proc/$PID/status" | awk '{print $2}')
  else
    VMDATA_GB="N/A"
    THREADS="N/A"
  fi
  
  # Get RSS breakdown from smaps_rollup
  if [[ -f "/proc/$PID/smaps_rollup" ]]; then
    RSS_ANON_KB=$(grep "^Rss:" "/proc/$PID/smaps_rollup" | head -1 | awk '{print $2}' || echo "0")
    RSS_FILE_KB=$(grep "^Rss:" "/proc/$PID/smaps_rollup" | tail -1 | awk '{print $2}' || echo "0")
    SWAP_KB=$(grep "^Swap:" "/proc/$PID/smaps_rollup" | awk '{print $2}' || echo "0")
    
    RSS_ANON_MB=$((RSS_ANON_KB / 1024))
    RSS_FILE_MB=$((RSS_FILE_KB / 1024))
    SWAP_MB=$((SWAP_KB / 1024))
  else
    RSS_ANON_MB=0
    RSS_FILE_MB=0
    SWAP_MB=0
  fi
  
  # Color code based on growth
  COLOR=""
  RESET="\033[0m"
  if [[ $DELTA_MB -gt 50 ]]; then
    COLOR="\033[1;31m"  # Red for large spike
  elif [[ $DELTA_MB -gt 20 ]]; then
    COLOR="\033[1;33m"  # Yellow for moderate growth
  elif [[ $DELTA_MB -lt -20 ]]; then
    COLOR="\033[1;32m"  # Green for decrease
  fi
  
  # Print row
  printf "${COLOR}%-8s %-12d %-10s %-10s %-10d %-10d %-10d %-8s${RESET}\n" \
    "$TIMESTAMP" "$RSS_MB" "$DELTA_STR" "$VMDATA_GB" "$RSS_ANON_MB" "$RSS_FILE_MB" "$SWAP_MB" "$THREADS"
  
  # Alert on large spike
  if [[ $DELTA_MB -gt 100 ]]; then
    echo "  ⚠️  WARNING: Large memory spike detected (+${DELTA_MB} MB)"
  fi
  
  # Alert on critical threshold
  if [[ $RSS_MB -gt 2048 ]]; then
    echo "  🔴 CRITICAL: RSS exceeds 2 GB (${RSS_MB} MB)"
  fi
  
  # Update previous
  PREV_RSS=$RSS_MB
  
  # Sleep
  sleep "$INTERVAL"
done

echo ""
echo "========================================="
echo "MONITORING COMPLETE"
echo "Final RSS:   ${RSS_MB} MB"
echo "Baseline:    ${BASELINE_RSS} MB"
echo "Total Growth: $((RSS_MB - BASELINE_RSS)) MB"
echo "========================================="
