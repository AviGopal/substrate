#!/bin/bash
# Development script for cloud dashboard
# Starts activity-api and dashboard with proper configuration

set -e

echo "🚀 Starting Development Environment for Cloud Dashboard"
echo ""

# Check if SurrealDB is running
if ! curl -s http://localhost:8000/health > /dev/null 2>&1; then
    echo "❌ SurrealDB not running on localhost:8000"
    echo "   Start it with: kubectl port-forward svc/surrealdb 8000:8000 -n activity-system"
    echo "   Or set SURREALDB_URL to point to a running instance"
    exit 1
fi

echo "✓ SurrealDB is running"

# Set environment variables for activity-api
export PORT=8080
export HOST=0.0.0.0
export SURREALDB_URL=${SURREALDB_URL:-"http://localhost:8000"}
export SURREALDB_NAMESPACE=${SURREALDB_NAMESPACE:-"activity-system"}
export SURREALDB_DATABASE=${SURREALDB_DATABASE:-"learning_loop"}
export SURREALDB_USERNAME=${SURREALDB_USERNAME:-"root"}
export SURREALDB_PASSWORD=${SURREALDB_PASSWORD:-"surrealdb-local-dev-123"}
export LOG_LEVEL=debug

# JWT secret (same as production for local testing)
export JWT_SECRET=${JWT_SECRET:-"your-256-bit-secret-key-for-jwt-signing-change-in-production"}

echo "✓ Environment configured"
echo "  - Activity API: http://localhost:8080"
echo "  - Dashboard: http://localhost:3000"
echo ""

# Start activity-api in background
echo "Starting activity-api..."
cd repos/metabob-activity-api
bun run dev &
ACTIVITY_PID=$!
cd ../..

# Wait for activity-api to be ready
echo "Waiting for activity-api to start..."
for i in {1..30}; do
    if curl -s http://localhost:8080/health > /dev/null 2>&1; then
        echo "✓ Activity API is ready"
        break
    fi
    sleep 1
done

# Set environment variables for dashboard
export PORT=3000
export ACTIVITY_API_URL=http://localhost:8080
export IDENTITY_VESSEL_URL=http://localhost:8080  # Use activity-api for auth
export USER_VESSEL_URL=http://localhost:8080      # Placeholder

# Start dashboard
echo "Starting cloud dashboard..."
cd repos/metabob-cloud-dashboard
bun run dev &
DASHBOARD_PID=$!
cd ../..

echo ""
echo "✓ Development environment running!"
echo ""
echo "  📊 Dashboard: http://localhost:3000"
echo "  🔧 Activity API: http://localhost:8080"
echo ""
echo "  Press Ctrl+C to stop all services"
echo ""

# Trap Ctrl+C and cleanup
trap "echo ''; echo 'Stopping services...'; kill $ACTIVITY_PID $DASHBOARD_PID 2>/dev/null; exit 0" INT

# Wait for processes
wait
