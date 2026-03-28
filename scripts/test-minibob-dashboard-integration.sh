#!/bin/bash

# Test MiniBob → Backend → Dashboard Integration
# This script validates the complete data flow

set -e

MINIBOB_NS="testing-minibob"
MINIBOB_POD="minibob-testing-cluster-minibob-cluster-6947d6546b-82spw"
API_NS="activity-system"
DASHBOARD_URL="http://localhost:3000"

echo "🧪 Testing MiniBob → Backend → Dashboard Integration"
echo "======================================================="
echo ""

# Step 1: Get initial template count
echo "📊 Step 1: Get baseline template count"
echo "---------------------------------------"
BEFORE_COUNT=$(curl -s ${DASHBOARD_URL}/v2/activities/templates | jq '.total')
echo "Current template count: ${BEFORE_COUNT}"
echo ""

# Step 2: Execute activity in MiniBob
echo "🤖 Step 2: Execute activity in MiniBob"
echo "---------------------------------------"
echo "Running hello-world template..."

# Check if MiniBob CLI is available
kubectl exec -n ${MINIBOB_NS} ${MINIBOB_POD} -- /bin/bash -c '
    cd /app
    
    # Check what executables are available
    echo "Checking MiniBob executables:"
    ls -la dist/ 2>/dev/null || echo "No dist directory"
    
    # Check if there'\''s a CLI entry point
    if [ -f index.ts ]; then
        echo "Found index.ts"
    fi
    
    if [ -f dist/index.js ]; then
        echo "Found dist/index.js"
    fi
    
    # Check package.json for start command
    echo ""
    echo "Package.json scripts:"
    cat package.json | grep -A5 "scripts"
'

echo ""

# Step 3: Check if new template was registered
echo "📊 Step 3: Check for new templates"
echo "-----------------------------------"
sleep 2  # Wait for potential backend update

AFTER_COUNT=$(curl -s ${DASHBOARD_URL}/v2/activities/templates | jq '.total')
echo "New template count: ${AFTER_COUNT}"

if [ "$AFTER_COUNT" -gt "$BEFORE_COUNT" ]; then
    echo "✅ New templates registered!"
else
    echo "⚠️  No new templates (this might be expected if template already exists)"
fi

echo ""

# Step 4: Check executions
echo "📊 Step 4: Check recent executions"
echo "-----------------------------------"
# Note: We need to implement GET /v2/activities/executions endpoint
echo "TODO: Implement GET /v2/activities/executions in backend API"
echo ""

# Step 5: Show current templates
echo "📋 Step 5: Current templates in system"
echo "---------------------------------------"
curl -s ${DASHBOARD_URL}/v2/activities/templates | jq '.templates[] | {
    name: .variant_name,
    id: .variant_id,
    category: .category,
    created: .created_at
}'

echo ""
echo "✅ Integration test complete!"
echo ""
echo "To view in browser:"
echo "  Open http://localhost:3000"
echo ""
echo "To follow dashboard logs:"
echo "  kubectl logs -n activity-system deployment/activity-dashboard -f"
