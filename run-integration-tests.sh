#!/bin/bash

# Integration Test Runner for Learning System

set -e

echo "====================================================================="
echo "Learning System Integration Test Runner"
echo "====================================================================="
echo ""

# Check if backend is already running
echo "Checking if backend is already running..."
if curl -s http://localhost:3000/health > /dev/null 2>&1; then
    echo "✅ Backend is already running"
    BACKEND_ALREADY_RUNNING=true
else
    echo "⚠️  Backend not running, will start it"
    BACKEND_ALREADY_RUNNING=false
fi

# Start backend if needed
if [ "$BACKEND_ALREADY_RUNNING" = false ]; then
    echo ""
    echo "Starting backend..."
    cd repos/metabob-activity-api
    
    # Check if .env exists
    if [ ! -f .env ]; then
        echo "Creating .env file..."
        cat > .env << 'EOF'
PORT=3000
SURREAL_URL=memory
SURREAL_NAMESPACE=test
SURREAL_DATABASE=learning_test
LOG_LEVEL=info
EOF
    fi
    
    # Start backend in background
    bun run dev > /tmp/backend.log 2>&1 &
    BACKEND_PID=$!
    echo "Backend started with PID: $BACKEND_PID"
    
    # Wait for backend to be ready
    echo "Waiting for backend to initialize..."
    for i in {1..30}; do
        if curl -s http://localhost:3000/health > /dev/null 2>&1; then
            echo "✅ Backend is ready"
            break
        fi
        echo "  Waiting... ($i/30)"
        sleep 1
    done
    
    if ! curl -s http://localhost:3000/health > /dev/null 2>&1; then
        echo "❌ Backend failed to start"
        echo "Check logs at /tmp/backend.log"
        exit 1
    fi
    
    cd ../..
fi

# Run integration tests
echo ""
echo "Running integration tests..."
bun run test-learning-system-integration.ts

TEST_EXIT_CODE=$?

# Cleanup
if [ "$BACKEND_ALREADY_RUNNING" = false ] && [ -n "$BACKEND_PID" ]; then
    echo ""
    echo "Stopping backend (PID: $BACKEND_PID)..."
    kill $BACKEND_PID 2>/dev/null || true
    echo "✅ Backend stopped"
fi

# Report results
echo ""
if [ $TEST_EXIT_CODE -eq 0 ]; then
    echo "====================================================================="
    echo "🎉 ALL INTEGRATION TESTS PASSED!"
    echo "====================================================================="
else
    echo "====================================================================="
    echo "❌ SOME TESTS FAILED (exit code: $TEST_EXIT_CODE)"
    echo "====================================================================="
fi

exit $TEST_EXIT_CODE
