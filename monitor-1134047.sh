#!/bin/bash
# Monitor specific PID: 1134047

PID=1134047
echo "========================================="
echo "Monitoring OpenCode PID: $PID"
echo "========================================="
echo ""

for i in {1..12}; do
  if ! ps -p $PID > /dev/null 2>&1; then
    echo "Process $PID no longer exists"
    exit 1
  fi
  
  stats=$(ps -p $PID -o pid,%mem,rss,vsz --no-headers)
  timestamp=$(date '+%H:%M:%S')
  
  echo "[$timestamp] $stats"
  
  if [ $i -lt 12 ]; then
    sleep 10
  fi
done

echo ""
echo "Monitoring complete. Getting memory endpoint stats..."
curl -s http://localhost:3000/debug/memory | python3 -m json.tool 2>/dev/null || echo "Endpoint not available"
