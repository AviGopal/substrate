#!/bin/bash
# System observation script for debugging

echo "=== Docker Containers ==="
docker ps -a --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}'

echo -e "\n=== Running Metabob/DevBob Processes ==="
ps aux | grep -E '(metabob|devbob|opencode|node.*metabob)' | grep -v grep | awk '{print $2, $11, $12, $13}'

echo -e "\n=== Git Status ==="
git status --short

echo -e "\n=== Recent Activity Executions ==="
find ~/.opencode/activities -name "*.json" -mmin -60 2>/dev/null | head -5

echo -e "\n=== Port Listeners ==="
netstat -tlnp 2>/dev/null | grep -E '(8080|3000|6379|5432)' || ss -tlnp | grep -E '(8080|3000|6379|5432)'

echo -e "\n=== Disk Space ==="
df -h . | tail -1

echo -e "\n=== Memory Usage ==="
free -h | grep -E '(Mem|Swap)'
