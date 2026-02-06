#!/bin/bash
# Start DevBob multi-agent development environment

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
PARENT_ROOT="$(cd "$PROJECT_ROOT/.." && pwd)"

echo "🚀 Starting DevBob Environment"
echo "================================"

# Check if parent directory has required repositories
if [ ! -d "$PARENT_ROOT/metabob-rpc-api" ]; then
    echo "❌ Error: metabob-rpc-api not found in parent directory"
    exit 1
fi

# Check if .env.devbob exists
if [ ! -f "$PROJECT_ROOT/configs/.env.devbob" ]; then
    echo "⚠️  Warning: configs/.env.devbob not found"
    if [ -f "$PARENT_ROOT/.env.devbob" ]; then
        echo "   Using .env.devbob from parent directory"
        ENV_FILE="$PARENT_ROOT/.env.devbob"
    else
        echo "❌ Error: No .env.devbob file found"
        echo "   Create configs/.env.devbob with your API keys"
        exit 1
    fi
else
    ENV_FILE="$PROJECT_ROOT/configs/.env.devbob"
fi

# Check if backend is running
echo ""
echo "Checking Metabob backend..."
if curl -sf http://localhost:8000/status > /dev/null 2>&1; then
    echo "✓ Metabob backend is running"
else
    echo "⚠️  Metabob backend not detected"
    echo "   Start it with: docker-compose -f docker-compose.integration.yaml up -d"
fi

# Start DevBob containers
echo ""
echo "Starting DevBob containers..."
cd "$PARENT_ROOT"

if [ $# -eq 0 ]; then
    # Start all containers
    docker-compose -f "$PROJECT_ROOT/configs/docker-compose.devbob.yaml" --env-file "$ENV_FILE" up -d
    echo "✓ All DevBob containers started"
else
    # Start specific container
    docker-compose -f "$PROJECT_ROOT/configs/docker-compose.devbob.yaml" --env-file "$ENV_FILE" up -d "$1"
    echo "✓ DevBob container $1 started"
fi

# Wait for containers to be healthy
echo ""
echo "Waiting for containers to be ready..."
sleep 5

# Check container status
echo ""
echo "Container Status:"
docker ps --filter name=devbob --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

# Test ACP connectivity
echo ""
echo "Testing ACP connectivity..."
PORTS=(3001 3002 3003 3004)
NAMES=("devbob-rpc-api" "devbob-dashboard" "devbob-cli" "devbob-opencode")

for i in "${!PORTS[@]}"; do
    PORT="${PORTS[$i]}"
    NAME="${NAMES[$i]}"
    
    if curl -sf "http://localhost:$PORT/acp/sessions" > /dev/null 2>&1; then
        echo "✓ $NAME (port $PORT) - ACP accessible"
    else
        echo "✗ $NAME (port $PORT) - ACP not accessible"
        echo "   Try: curl http://localhost:$PORT/acp/sessions"
    fi
done

echo ""
echo "================================"
echo "✨ DevBob Environment Ready!"
echo ""
echo "Next steps:"
echo "1. Open OpenCode: opencode"
echo "2. Create a specification impulse"
echo "3. Delegate to DevBob: acp_delegate({ target: 'docker://devbob-opencode-agent', ... })"
echo ""
echo "See metabob-devbob/QUICK_START.md for detailed instructions"
