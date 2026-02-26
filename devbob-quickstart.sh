#!/bin/bash
# DevBob Quick Start Script
# Deploys full stack and runs verification tests

set -e

echo "🚀 DevBob Quick Start"
echo "===================="
echo ""

# Check prerequisites
echo "📋 Checking prerequisites..."
docker --version || { echo "❌ Docker not found"; exit 1; }
docker-compose --version || { echo "❌ Docker Compose not found"; exit 1; }
test -n "$ANTHROPIC_API_KEY" || { echo "⚠️  ANTHROPIC_API_KEY not set"; }
echo "✅ Prerequisites OK"
echo ""

# Deploy stack
echo "🏗️  Deploying DevBob stack..."
echo "This will take 2-3 minutes..."
echo ""

docker-compose -f docker-compose.unified.yaml --profile all up -d

echo ""
echo "⏳ Waiting for services to initialize..."
sleep 10

# Wait for services
echo "🔍 Checking service health..."

# Check Redis
docker exec metabob-redis redis-cli ping > /dev/null 2>&1 && echo "✅ Redis ready" || echo "⚠️  Redis not ready"

# Check SurrealDB
docker exec metabob-surreal /surreal isready --conn http://localhost:8000 > /dev/null 2>&1 && echo "✅ SurrealDB ready" || echo "⚠️  SurrealDB not ready"

# Check API
curl -sf http://localhost:8080/health > /dev/null 2>&1 && echo "✅ API ready" || echo "⚠️  API not ready"

# Check devbob containers
docker ps --filter name=devbob-clean --filter status=running | grep -q devbob-clean && echo "✅ devbob-clean running" || echo "⚠️  devbob-clean not running"
docker ps --filter name=devbob-rpc-api --filter status=running | grep -q devbob-rpc-api && echo "✅ devbob-rpc-api running" || echo "⚠️  devbob-rpc-api not running"
docker ps --filter name=devbob-dashboard --filter status=running | grep -q devbob-dashboard && echo "✅ devbob-dashboard running" || echo "⚠️  devbob-dashboard not running"

echo ""
echo "✅ DevBob deployment complete!"
echo ""
echo "📊 Service URLs:"
echo "  - Surrealist UI:    http://localhost:8001"
echo "  - Metabob API:      http://localhost:8080"
echo "  - API Health:       curl http://localhost:8080/health"
echo ""
echo "🤖 DevBob Agents (ACP):"
echo "  - devbob-clean:     docker://devbob-clean (port 3100)"
echo "  - devbob-rpc-api:   docker://devbob-rpc-api (port 3101)"
echo "  - devbob-dashboard: docker://devbob-dashboard (port 3102)"
echo ""
echo "📖 Next steps:"
echo "  1. View deployment details:"
echo "     docker ps --filter name=metabob- --filter name=devbob-"
echo ""
echo "  2. Test delegation:"
echo "     opencode activity execute delegate-to-devbob \\"
echo "       --variables '{\"target\": \"docker://devbob-clean\", \"taskDescription\": \"Test\", \"prompt\": \"List available tools\"}'"
echo ""
echo "  3. View logs:"
echo "     docker logs devbob-clean"
echo ""
echo "  4. Stop deployment:"
echo "     docker-compose -f docker-compose.unified.yaml --profile all down"
echo ""
