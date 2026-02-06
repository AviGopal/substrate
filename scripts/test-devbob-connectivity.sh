#!/bin/bash
# Test DevBob container connectivity and ACP delegation

set -e

echo "🧪 Testing DevBob ACP Connectivity"
echo "=================================="

CONTAINERS=(
    "docker://devbob-rpc-api"
    "docker://devbob-cli" 
    "docker://devbob-opencode"
)

PORTS=(3001 3003 3004)
NAMES=("RPC-API" "CLI" "OpenCode")

echo ""
echo "Step 1: Basic HTTP Health Checks"
echo "--------------------------------"

for i in "${!PORTS[@]}"; do
    PORT="${PORTS[$i]}"
    NAME="${NAMES[$i]}"
    
    echo -n "Testing $NAME (port $PORT): "
    if curl -sf "http://localhost:$PORT/acp/sessions" > /dev/null 2>&1; then
        echo "✅ Healthy"
    else
        echo "❌ Not responding"
    fi
done

echo ""
echo "Step 2: Test Simple ACP Delegation"
echo "----------------------------------"

# This would be done from within OpenCode, but we can test basic connectivity
for i in "${!CONTAINERS[@]}"; do
    CONTAINER="${CONTAINERS[$i]}"
    NAME="${NAMES[$i]}"
    
    echo -n "Testing ACP delegation to $NAME: "
    
    # Try a basic HTTP POST to the ACP endpoint
    RESPONSE=$(curl -s -w "%{http_code}" -X POST \
        "http://localhost:${PORTS[$i]}/acp/sessions" \
        -H "Content-Type: application/json" \
        -d '{"prompt": "echo test", "timeout": 30}' \
        -o /tmp/acp_test_response.json)
    
    if [ "$RESPONSE" = "200" ] || [ "$RESPONSE" = "201" ]; then
        echo "✅ ACP endpoint accessible"
    else
        echo "❌ ACP endpoint returned $RESPONSE"
    fi
done

echo ""
echo "Step 3: Container Resource Check"
echo "-------------------------------"

docker stats --no-stream --format "table {{.Container}}\t{{.CPUPerc}}\t{{.MemUsage}}" $(docker ps --filter name=devbob --format "{{.Names}}")

echo ""
echo "Step 4: Log Preview"
echo "------------------"

for container in $(docker ps --filter name=devbob --format "{{.Names}}"); do
    echo ""
    echo "=== $container (last 5 lines) ==="
    docker logs --tail 5 "$container" 2>&1 || echo "No logs available"
done

echo ""
echo "=================================="
echo "Test completed!"
echo ""
echo "If all tests passed, DevBob is ready for:"
echo "  - ACP delegation from OpenCode"  
echo "  - Multi-agent task coordination"
echo "  - Git repository management"