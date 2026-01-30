#!/bin/bash
# Simple memory monitoring for OpenCode process

PID=751729
LOG_FILE="memory_tracking.log"
INTERVAL=120  # 2 minutes

function take_measurement() {
  local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
  local pid=$1
  
  # Check if process still exists
  if ! kill -0 $pid 2>/dev/null; then
    echo "[$timestamp] Process $pid terminated"
    exit 1
  fi
  
  local runtime=$(ps -p $pid -o etime --no-headers | tr -d ' ')
  local memory_info=$(cat /proc/$pid/status | grep -E "(VmSize|VmRSS|VmData|VmSwap)" | awk '{print $2}' | paste -sd ',' -)
  local rss=$(echo $memory_info | cut -d',' -f2)
  local vmdata=$(echo $memory_info | cut -d',' -f3) 
  local vmswap=$(echo $memory_info | cut -d',' -f4)
  
  echo "$timestamp,$runtime,$rss,$vmdata,$vmswap" >> $LOG_FILE
  echo "[$timestamp] RSS: $(($rss/1024)) MB | VmData: $(($vmdata/1024)) MB | VmSwap: $(($vmswap/1024)) MB | Runtime: $runtime"
  
  # Alert if memory is high
  if [ $rss -gt 10000000 ]; then  # > 10GB RSS
    echo "🚨 HIGH MEMORY ALERT: RSS $(($rss/1024)) MB"
  fi
  
  if [ $vmswap -gt 1000000 ]; then  # > 1GB Swap
    echo "🚨 SWAP ALERT: VmSwap $(($vmswap/1024)) MB"
  fi
}

echo "🔍 Starting memory monitoring for PID $PID every ${INTERVAL}s"
echo "📝 Logging to: $LOG_FILE"

# Initial measurement
take_measurement $PID

# Monitoring loop
while true; do
  sleep $INTERVAL
  take_measurement $PID
done