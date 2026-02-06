#!/bin/bash
# Quick verification script for DevBob environment

echo "🔍 DevBob Environment Verification"
echo "==================================="
echo ""

# 1. Check containers
echo "1. Container Status:"
docker ps --format "table {{.Names}}\t{{.Status}}" | grep -E "(devbob|metabob|redis|api-server)"
echo ""

# 2. Backend health
echo "2. Backend Health:"
if curl -sf http://localhost:8080/status > /dev/null 2>&1; then
    echo "✅ Backend OK"
else
    echo "❌ Backend FAIL"
fi
echo ""

# 3. Agent endpoints
echo "3. Agent Endpoints:"
for port in 3001 3002 3003 3004; do
  if curl -sf http://localhost:$port/config > /dev/null 2>&1; then
    echo "✅ Port $port OK"
  else
    echo "❌ Port $port FAIL"
  fi
done
echo ""

# 4. Internal connectivity
echo "4. Internal Connectivity:"
if docker exec devbob-opencode curl -sf http://api-server-dev:80/status > /dev/null 2>&1; then
    echo "✅ Internal network OK"
else
    echo "❌ Internal network FAIL"
fi
echo ""

# 5. Repositories
echo "5. Repository Status:"
for agent in devbob-rpc-api devbob-dashboard devbob-cli devbob-opencode; do
  if docker exec $agent test -d /workspace/.git 2>/dev/null; then
    echo "✅ $agent repo OK"
  else
    echo "⚠️  $agent repo not cloned"
  fi
done
echo ""

echo "==================================="
echo "✅ Verification complete!"
