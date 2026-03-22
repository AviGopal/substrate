#!/bin/bash

# Deploy Learning System Updates (Phases 1.1-1.6)
# 
# This script:
# 1. Builds updated metabob-activity-api Docker image with Phase 1.1-1.6 endpoints
# 2. Deploys to Kubernetes cluster via helmfile
# 3. Verifies health and new endpoints
# 4. Runs integration tests

set -e

echo "=================================================================="
echo "LEARNING SYSTEM DEPLOYMENT - Phases 1.1-1.6"
echo "=================================================================="
echo ""

# Configuration
IMAGE_NAME="metabob-activity-api"
IMAGE_TAG="learning-v1.1-1.6"
NAMESPACE="activity-system"
API_URL="http://api.minibob.local"

# Step 1: Build Docker image
echo "===================================================================="
echo "Step 1: Building Docker image with Phase 1.1-1.6 changes"
echo "===================================================================="
echo ""

cd repos/metabob-activity-api

echo "Building image: ${IMAGE_NAME}:${IMAGE_TAG}"
docker build -t ${IMAGE_NAME}:${IMAGE_TAG} -t ${IMAGE_NAME}:latest .

if [ $? -ne 0 ]; then
    echo "❌ Docker build failed!"
    exit 1
fi

echo "✅ Docker image built successfully"
echo ""

# Step 2: Check current deployment
echo "===================================================================="
echo "Step 2: Checking current deployment status"
echo "===================================================================="
echo ""

kubectl get pods -n ${NAMESPACE} -l app.kubernetes.io/name=metabob-activity-api || true
echo ""

# Step 3: Deploy with helmfile
echo "===================================================================="
echo "Step 3: Deploying with helmfile"
echo "===================================================================="
echo ""

cd ../../helm

# Check if activity-dev helmfile exists
if [ -f "helmfile-activity-dev.yaml" ]; then
    echo "Using helmfile-activity-dev.yaml"
    HELMFILE="helmfile-activity-dev.yaml"
elif [ -f "helmfile-activity-minimal.yaml" ]; then
    echo "Using helmfile-activity-minimal.yaml"
    HELMFILE="helmfile-activity-minimal.yaml"
else
    echo "⚠️  No activity-specific helmfile found, using main helmfile.yaml"
    HELMFILE="helmfile.yaml"
fi

echo "Syncing helmfile: ${HELMFILE}"
helmfile -f ${HELMFILE} sync

if [ $? -ne 0 ]; then
    echo "❌ Helmfile sync failed!"
    exit 1
fi

echo "✅ Helmfile sync completed"
echo ""

# Step 4: Wait for rollout
echo "===================================================================="
echo "Step 4: Waiting for deployment rollout"
echo "===================================================================="
echo ""

kubectl rollout status deployment -n ${NAMESPACE} metabob-activity-api --timeout=300s

if [ $? -ne 0 ]; then
    echo "❌ Deployment rollout failed!"
    echo "Checking pod status..."
    kubectl get pods -n ${NAMESPACE} -l app.kubernetes.io/name=metabob-activity-api
    echo ""
    echo "Checking logs..."
    kubectl logs -n ${NAMESPACE} -l app.kubernetes.io/name=metabob-activity-api --tail=50
    exit 1
fi

echo "✅ Deployment rolled out successfully"
echo ""

# Step 5: Verify health
echo "===================================================================="
echo "Step 5: Verifying API health"
echo "===================================================================="
echo ""

echo "Waiting for API to be ready..."
for i in {1..30}; do
    if curl -s ${API_URL}/health > /dev/null 2>&1; then
        echo "✅ API is healthy!"
        break
    fi
    echo "  Waiting... ($i/30)"
    sleep 2
done

# Show health status
echo ""
echo "Health check response:"
curl -s ${API_URL}/health | jq . || curl -s ${API_URL}/health
echo ""

# Step 6: Verify new endpoints
echo "===================================================================="
echo "Step 6: Verifying Phase 1.1-1.6 endpoints"
echo "===================================================================="
echo ""

echo "Testing endpoints..."
echo ""

# Test composition endpoint
echo "1. Testing POST /v2/activities/composition..."
COMPOSE_RESPONSE=$(curl -s -w "\n%{http_code}" -X POST ${API_URL}/v2/activities/composition \
  -H "Content-Type: application/json" \
  -d '{
    "parent_activity_id": "test-deploy-parent",
    "child_activity_id": "test-deploy-child",
    "execution_id": "test-exec-'$(date +%s)'",
    "goal_context": "Deployment test",
    "success": true
  }')

HTTP_CODE=$(echo "$COMPOSE_RESPONSE" | tail -n1)
if [ "$HTTP_CODE" = "200" ]; then
    echo "   ✅ Composition endpoint working"
else
    echo "   ❌ Composition endpoint failed (HTTP $HTTP_CODE)"
fi
echo ""

# Test impulse relevance endpoint
echo "2. Testing POST /v2/activities/impulse-relevance..."
IMPULSE_RESPONSE=$(curl -s -w "\n%{http_code}" -X POST ${API_URL}/v2/activities/impulse-relevance \
  -H "Content-Type: application/json" \
  -d '{
    "impulse_id": "test-deploy-impulse",
    "activity_variant_id": "test-deploy-activity",
    "was_loaded": true,
    "execution_succeeded": true
  }')

HTTP_CODE=$(echo "$IMPULSE_RESPONSE" | tail -n1)
if [ "$HTTP_CODE" = "200" ]; then
    echo "   ✅ Impulse relevance endpoint working"
else
    echo "   ❌ Impulse relevance endpoint failed (HTTP $HTTP_CODE)"
fi
echo ""

# Test tool usage endpoint
echo "3. Testing POST /v2/activities/tool-usage..."
TOOL_RESPONSE=$(curl -s -w "\n%{http_code}" -X POST ${API_URL}/v2/activities/tool-usage \
  -H "Content-Type: application/json" \
  -d '{
    "tool_name": "bash",
    "activity_variant_id": "test-deploy-activity",
    "execution_id": "test-exec-'$(date +%s)'",
    "tool_succeeded": true,
    "activity_succeeded": true
  }')

HTTP_CODE=$(echo "$TOOL_RESPONSE" | tail -n1)
if [ "$HTTP_CODE" = "200" ]; then
    echo "   ✅ Tool usage endpoint working"
else
    echo "   ❌ Tool usage endpoint failed (HTTP $HTTP_CODE)"
fi
echo ""

# Test execution sequences endpoint
echo "4. Testing POST /v2/activities/execution-sequences..."
SEQ_RESPONSE=$(curl -s -w "\n%{http_code}" -X POST ${API_URL}/v2/activities/execution-sequences \
  -H "Content-Type: application/json" \
  -d '{
    "session_id": "test-deploy-session-'$(date +%s)'",
    "goal_context": "Deployment verification",
    "sequence": [
      {
        "activity_id": "test-activity-1",
        "execution_id": "exec-1-'$(date +%s)'",
        "order": 0,
        "trigger_type": "goal",
        "success": true,
        "duration_ms": 1000,
        "cost_usd": 0.1
      }
    ],
    "outcome": "success"
  }')

HTTP_CODE=$(echo "$SEQ_RESPONSE" | tail -n1)
if [ "$HTTP_CODE" = "200" ]; then
    echo "   ✅ Execution sequences endpoint working"
else
    echo "   ❌ Execution sequences endpoint failed (HTTP $HTTP_CODE)"
fi
echo ""

# Step 7: Run integration tests
echo "===================================================================="
echo "Step 7: Running integration tests"
echo "===================================================================="
echo ""

cd ..
MCP_ENDPOINT=${API_URL} bun run test-learning-system-integration.ts

TEST_EXIT_CODE=$?

# Final summary
echo ""
echo "===================================================================="
echo "DEPLOYMENT SUMMARY"
echo "===================================================================="
echo ""
echo "Image: ${IMAGE_NAME}:${IMAGE_TAG}"
echo "Namespace: ${NAMESPACE}"
echo "API URL: ${API_URL}"
echo ""

if [ $TEST_EXIT_CODE -eq 0 ]; then
    echo "🎉 DEPLOYMENT SUCCESSFUL!"
    echo ""
    echo "All Phase 1.1-1.6 endpoints are live and working:"
    echo "  ✅ POST /v2/activities/composition"
    echo "  ✅ GET  /v2/activities/composition/graph"
    echo "  ✅ POST /v2/activities/impulse-relevance"
    echo "  ✅ GET  /v2/activities/impulse-relevance"
    echo "  ✅ POST /v2/activities/tool-usage"
    echo "  ✅ GET  /v2/activities/tool-usage"
    echo "  ✅ POST /v2/activities/execution-sequences"
    echo "  ✅ GET  /v2/activities/execution-sequences"
    echo ""
    echo "Next: Continue to Phase 1.7 (Goal Execution Paths)"
else
    echo "⚠️  DEPLOYMENT COMPLETED WITH TEST FAILURES"
    echo ""
    echo "The backend is deployed but some integration tests failed."
    echo "Check the test output above for details."
fi

echo ""
echo "Useful commands:"
echo "  kubectl logs -n ${NAMESPACE} -l app.kubernetes.io/name=metabob-activity-api -f"
echo "  kubectl get pods -n ${NAMESPACE}"
echo "  curl ${API_URL}/health"
echo ""

exit $TEST_EXIT_CODE
