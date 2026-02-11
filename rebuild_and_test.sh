#!/bin/bash
set -e

echo "============================================"
echo "Rebuilding and Testing Devbob Environment"
echo "============================================"
echo ""

# Step 1: Build metabob-rpc-api
echo "Step 1: Building metabob-rpc-api..."
cd repos/metabob-rpc-api
docker build -t metabob-rpc-api:latest .
echo "✓ metabob-rpc-api built"
echo ""

# Step 2: Build metabob-cli
echo "Step 2: Building metabob-cli..."
cd ../metabob-cli
docker build -t metabob-cli:latest .
echo "✓ metabob-cli built"
echo ""

# Step 3: Build metabob-opencode
echo "Step 3: Building metabob-opencode..."
cd ../metabob-opencode
docker build -t metabob-opencode:latest .
echo "✓ metabob-opencode built"
echo ""

# Step 4: Restart devbob containers
echo "Step 4: Restarting devbob containers..."
cd ../..
docker-compose -f docker-compose.devbob-dev.yaml down
docker-compose -f docker-compose.devbob-dev.yaml up -d

echo ""
echo "Waiting for services to start (10 seconds)..."
sleep 10
echo ""

# Step 5: Check service health
echo "Step 5: Checking service health..."
echo ""

echo "=== metabob-rpc-api logs ==="
docker logs --tail=30 metabob-rpc-api-server-dev-1 2>&1 | grep -E "ERROR|WARNING|Uvicorn|Started|Exception" | tail -10
echo ""

echo "=== Redis status ==="
docker exec metabob-rpc-api-redis-dev-1 redis-cli ping 2>&1 || echo "Redis not responding"
echo ""

echo "=== SurrealDB status ==="
docker exec metabob-rpc-api-surrealdb-dev-1 ps aux | grep surreal | head -1 || echo "SurrealDB not running"
echo ""

echo "=== API Health Check ==="
curl -s http://localhost:8080/health 2>&1 | head -5 || echo "API not responding"
echo ""

echo "============================================"
echo "Build and startup complete!"
echo "============================================"
echo ""
echo "To check logs:"
echo "  docker logs -f metabob-rpc-api-server-dev-1"
echo ""
echo "To test v2 session:"
echo "  curl -X POST http://localhost:8080/v2/session -H 'X-API-Key: test' -d '{\"project_id\":\"test\"}'"
echo ""

