#!/bin/bash

# Dashboard Components Implementation Verification Script
# Verifies all files were created and basic compilation works

set -e

echo "====================================="
echo "Dashboard Implementation Verification"
echo "====================================="
echo ""

# Check backend files
echo "Checking backend files..."
BACKEND_DIR="repos/metabob-activity-api/src/routes"

if [ -f "$BACKEND_DIR/execution-traces.ts" ]; then
    echo "✓ execution-traces.ts exists"
else
    echo "✗ execution-traces.ts missing"
    exit 1
fi

if [ -f "$BACKEND_DIR/code-variants.ts" ]; then
    echo "✓ code-variants.ts exists"
else
    echo "✗ code-variants.ts missing"
    exit 1
fi

if [ -f "$BACKEND_DIR/vessels.ts" ]; then
    echo "✓ vessels.ts exists"
else
    echo "✗ vessels.ts missing"
    exit 1
fi

echo ""

# Check frontend files
echo "Checking frontend files..."
FRONTEND_DIR="repos/activity-dashboard/src/components"

if [ -f "$FRONTEND_DIR/ExecutionHistory.tsx" ]; then
    echo "✓ ExecutionHistory.tsx exists"
else
    echo "✗ ExecutionHistory.tsx missing"
    exit 1
fi

if [ -f "$FRONTEND_DIR/CodeVariants.tsx" ]; then
    echo "✓ CodeVariants.tsx exists"
else
    echo "✗ CodeVariants.tsx missing"
    exit 1
fi

if [ -f "$FRONTEND_DIR/VesselStatus.tsx" ]; then
    echo "✓ VesselStatus.tsx exists"
else
    echo "✗ VesselStatus.tsx missing"
    exit 1
fi

echo ""

# Check if backend builds
echo "Testing backend build..."
cd repos/metabob-activity-api
if bun build --target=node src/index.ts --outfile=/tmp/api-test.js >/dev/null 2>&1; then
    echo "✓ Backend builds successfully"
else
    echo "✗ Backend build failed"
    exit 1
fi
cd ../..

echo ""

# Check route registration
echo "Checking route registration in index.ts..."
if grep -q "executionTracesRoutes" repos/metabob-activity-api/src/index.ts; then
    echo "✓ executionTracesRoutes registered"
else
    echo "✗ executionTracesRoutes not registered"
    exit 1
fi

if grep -q "codeVariantsRoutes" repos/metabob-activity-api/src/index.ts; then
    echo "✓ codeVariantsRoutes registered"
else
    echo "✗ codeVariantsRoutes not registered"
    exit 1
fi

if grep -q "vesselsRoutes" repos/metabob-activity-api/src/index.ts; then
    echo "✓ vesselsRoutes registered"
else
    echo "✗ vesselsRoutes not registered"
    exit 1
fi

echo ""

# Check App.tsx updates
echo "Checking App.tsx updates..."
if grep -q "ExecutionHistory" repos/activity-dashboard/src/App.tsx; then
    echo "✓ ExecutionHistory imported in App.tsx"
else
    echo "✗ ExecutionHistory not imported"
    exit 1
fi

if grep -q "CodeVariants" repos/activity-dashboard/src/App.tsx; then
    echo "✓ CodeVariants imported in App.tsx"
else
    echo "✗ CodeVariants not imported"
    exit 1
fi

if grep -q "VesselStatus" repos/activity-dashboard/src/App.tsx; then
    echo "✓ VesselStatus imported in App.tsx"
else
    echo "✗ VesselStatus not imported"
    exit 1
fi

if grep -q 'value="executions"' repos/activity-dashboard/src/App.tsx; then
    echo "✓ Executions tab added"
else
    echo "✗ Executions tab missing"
    exit 1
fi

if grep -q 'value="variants"' repos/activity-dashboard/src/App.tsx; then
    echo "✓ Variants tab added"
else
    echo "✗ Variants tab missing"
    exit 1
fi

if grep -q 'value="vessels"' repos/activity-dashboard/src/App.tsx; then
    echo "✓ Vessels tab added"
else
    echo "✗ Vessels tab missing"
    exit 1
fi

echo ""

# Check API client updates
echo "Checking API client updates..."
if grep -q "listExecutionTraces" repos/activity-dashboard/src/lib/api-client.ts; then
    echo "✓ listExecutionTraces method added"
else
    echo "✗ listExecutionTraces method missing"
    exit 1
fi

if grep -q "listCodeVariants" repos/activity-dashboard/src/lib/api-client.ts; then
    echo "✓ listCodeVariants method added"
else
    echo "✗ listCodeVariants method missing"
    exit 1
fi

if grep -q "listVessels" repos/activity-dashboard/src/lib/api-client.ts; then
    echo "✓ listVessels method added"
else
    echo "✗ listVessels method missing"
    exit 1
fi

echo ""

# Check types updates
echo "Checking types updates..."
if grep -q "ExecutionTrace" repos/activity-dashboard/src/lib/types.ts; then
    echo "✓ ExecutionTrace type added"
else
    echo "✗ ExecutionTrace type missing"
    exit 1
fi

if grep -q "CodeVariant" repos/activity-dashboard/src/lib/types.ts; then
    echo "✓ CodeVariant type added"
else
    echo "✗ CodeVariant type missing"
    exit 1
fi

if grep -q "VesselStatus" repos/activity-dashboard/src/lib/types.ts; then
    echo "✓ VesselStatus type added"
else
    echo "✗ VesselStatus type missing"
    exit 1
fi

echo ""
echo "====================================="
echo "✓ All verification checks passed!"
echo "====================================="
echo ""
echo "Next steps:"
echo "1. Create database tables (activity_execution_traces, vessel_heartbeats)"
echo "2. Deploy backend: cd repos/metabob-activity-api && bun run start"
echo "3. Deploy dashboard: cd repos/activity-dashboard && bun run dev"
echo "4. Implement MiniBob heartbeat sending"
echo "5. Test WebSocket real-time updates"
echo ""
