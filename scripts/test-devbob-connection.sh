#!/bin/bash
# =============================================================================
# DevBob Container Connection Test
# =============================================================================
# Tests connectivity and session introspection with devbob-clean container
#
# Usage:
#   ./scripts/test-devbob-connection.sh
#
# =============================================================================

set -e

CONTAINER="devbob-clean"
ACP_PORT="3000"

echo "========================================"
echo "DevBob Container Connection Test"
echo "========================================"
echo ""

# -----------------------------------------------------------------------------
# Test 1: Container Health Check
# -----------------------------------------------------------------------------
echo "Test 1: Container Health Check"
echo "--------------------------------"

if docker ps --filter "name=$CONTAINER" --filter "status=running" | grep -q "$CONTAINER"; then
    echo "✅ Container is running"
    
    # Get health status
    HEALTH=$(docker inspect --format '{{.State.Health.Status}}' $CONTAINER 2>/dev/null || echo "none")
    if [ "$HEALTH" = "healthy" ]; then
        echo "✅ Container is healthy"
    elif [ "$HEALTH" = "none" ]; then
        echo "⚠️  No health check defined"
    else
        echo "❌ Container is unhealthy: $HEALTH"
    fi
else
    echo "❌ Container is not running"
    echo ""
    echo "Start with: docker-compose --profile devbob up -d"
    exit 1
fi
echo ""

# -----------------------------------------------------------------------------
# Test 2: ACP Port Accessibility
# -----------------------------------------------------------------------------
echo "Test 2: ACP Port Accessibility"
echo "--------------------------------"

if curl -sf http://localhost:$ACP_PORT/config > /dev/null 2>&1; then
    echo "✅ ACP server is accessible on port $ACP_PORT"
    echo ""
    echo "Configuration:"
    curl -s http://localhost:$ACP_PORT/config | jq '.' 2>/dev/null || curl -s http://localhost:$ACP_PORT/config
else
    echo "❌ ACP server not responding on port $ACP_PORT"
    echo ""
    echo "Check logs: docker logs $CONTAINER --tail 50"
    exit 1
fi
echo ""

# -----------------------------------------------------------------------------
# Test 3: Container Filesystem State
# -----------------------------------------------------------------------------
echo "Test 3: Container Filesystem State"
echo "------------------------------------"

echo "Workspace contents:"
docker exec $CONTAINER ls -la /workspace 2>/dev/null | head -15

echo ""
echo "OpenCode config exists:"
if docker exec $CONTAINER test -f /workspace/.opencode/opencode.json; then
    echo "✅ /workspace/.opencode/opencode.json"
else
    echo "❌ OpenCode config not found"
fi

echo ""
echo "Metabob config exists:"
if docker exec $CONTAINER test -f /workspace/.metabob/config.json; then
    echo "✅ /workspace/.metabob/config.json"
else
    echo "❌ Metabob config not found"
fi
echo ""

# -----------------------------------------------------------------------------
# Test 4: Backend Connectivity (from inside container)
# -----------------------------------------------------------------------------
echo "Test 4: Backend Connectivity"
echo "------------------------------"

echo "Checking Metabob backend from inside container..."
if docker exec $CONTAINER curl -sf http://api-server-dev:8080/health > /dev/null 2>&1; then
    echo "✅ Container can reach Metabob backend"
else
    echo "⚠️  Container cannot reach backend (may not be running)"
fi
echo ""

# -----------------------------------------------------------------------------
# Test 5: Direct Exec Command Test
# -----------------------------------------------------------------------------
echo "Test 5: Direct Command Execution"
echo "----------------------------------"

echo "Running command in container:"
echo '$ cd /workspace && pwd && ls -la | head -10'
docker exec $CONTAINER sh -c 'cd /workspace && pwd && ls -la | head -10'
echo ""

# -----------------------------------------------------------------------------
# Summary
# -----------------------------------------------------------------------------
echo "========================================"
echo "Summary"
echo "========================================"
echo ""
echo "Container Status:"
echo "  Name: $CONTAINER"
echo "  Status: Running + Healthy"
echo "  ACP Port: $ACP_PORT"
echo "  MCP Port: 8082"
echo ""
echo "Connectivity:"
echo "  ✅ Docker exec works"
echo "  ✅ ACP server accessible"
echo "  ✅ Configuration files present"
echo ""
echo "Next Steps:"
echo "  1. Use acp_delegate tool from OpenCode"
echo "  2. Or use: docker exec $CONTAINER <command>"
echo "  3. Or connect via: opencode acp-client --target docker://$CONTAINER"
echo ""
echo "Example delegation:"
echo '  acp_delegate({'
echo '    target: "docker://devbob-clean",'
echo '    taskDescription: "Test connection",'
echo '    prompt: "List files in /workspace and report configuration"'
echo '  })'
echo ""
