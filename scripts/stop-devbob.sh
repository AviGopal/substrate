#!/bin/bash
# Stop DevBob multi-agent development environment

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
PARENT_ROOT="$(cd "$PROJECT_ROOT/.." && pwd)"

echo "🛑 Stopping DevBob Environment"
echo "================================"

cd "$PARENT_ROOT"

if [ "$1" = "--clean" ]; then
    echo "⚠️  Stopping and removing volumes (clean slate)..."
    docker-compose -f "$PROJECT_ROOT/configs/docker-compose.devbob.yaml" down -v
    echo "✓ DevBob containers stopped and volumes removed"
else
    echo "Stopping DevBob containers..."
    docker-compose -f "$PROJECT_ROOT/configs/docker-compose.devbob.yaml" down
    echo "✓ DevBob containers stopped (volumes preserved)"
    echo ""
    echo "To remove volumes (clean slate): $0 --clean"
fi

echo ""
echo "Container Status:"
docker ps --filter name=devbob --format "table {{.Names}}\t{{.Status}}" || echo "No DevBob containers running"

echo ""
echo "================================"
echo "✨ DevBob Environment Stopped"
