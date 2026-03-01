#!/bin/bash
# Deploy activity-template-scope-assignment enforcement to K8s
# This script completes the deployment phase of the Trace → Enforce → Validate loop

set -euo pipefail

NAMESPACE="metabob"
IMAGE_NAME="metabobapp/metabob-rpc-api"
IMAGE_TAG="0.16.14-scope-fix"
SCHEMA_FILE="scripts/init-surrealdb-devbob-schema.sql"

echo "=============================================="
echo "Activity Template Scope Assignment - Deployment"
echo "=============================================="
echo
echo "SPECIFICATION: activity-template-scope-assignment"
echo "CHANGES:"
echo "  - Schema: Add scope and org_id fields to activity_template table"
echo "  - Business Logic: Update create_template() to accept and persist scope/org_id"
echo "  - API Routes: Extract scope from body, org_id from Bearer token"
echo
echo "=============================================="
echo

# Step 1: Apply SurrealDB schema migration
echo "Step 1: Applying SurrealDB schema migration..."
echo "-------------------------------------------"
echo
echo "CRITICAL: Schema changes must be applied BEFORE code deployment"
echo "Schema changes:"
echo "  1. DEFINE FIELD scope ON activity_template TYPE string DEFAULT 'org'"
echo "  2. DEFINE FIELD org_id ON activity_template TYPE string"
echo "  3. DEFINE INDEX activity_template_org_idx ON activity_template FIELDS org_id"
echo

# Try to find SurrealDB pod
SURREAL_POD=$(kubectl get pods -n $NAMESPACE -l app=surrealdb -o jsonpath='{.items[0].metadata.name}' 2>/dev/null || echo "")

if [ -z "$SURREAL_POD" ]; then
    echo "❌ SurrealDB pod not found in namespace $NAMESPACE"
    echo "   Listing all pods:"
    kubectl get pods -n $NAMESPACE 2>/dev/null || echo "   kubectl not configured"
    echo
    echo "⚠️  MANUAL ACTION REQUIRED:"
    echo "   1. Connect to SurrealDB pod or use port-forward"
    echo "   2. Execute SQL from $SCHEMA_FILE lines 46-50:"
    echo
    echo "   DEFINE FIELD scope ON activity_template TYPE string DEFAULT 'org';"
    echo "   DEFINE FIELD org_id ON activity_template TYPE string;"
    echo "   DEFINE INDEX activity_template_org_idx ON activity_template FIELDS org_id;"
    echo
    read -p "Press Enter when schema migration is complete..." _
else
    echo "✓ SurrealDB pod found: $SURREAL_POD"
    echo
    echo "Attempting to apply schema migration..."
    
    # Try to execute schema migration
    if kubectl exec -n $NAMESPACE $SURREAL_POD -- surreal sql --help &>/dev/null; then
        echo "Executing schema migration..."
        kubectl exec -n $NAMESPACE $SURREAL_POD -- surreal sql \
            --conn http://localhost:8000 \
            --user root \
            --pass root \
            --ns metabob \
            --db production <<'EOF'
-- Add scope and org_id fields to activity_template
DEFINE FIELD scope ON activity_template TYPE string DEFAULT 'org';
DEFINE FIELD org_id ON activity_template TYPE string;
DEFINE INDEX activity_template_org_idx ON activity_template FIELDS org_id;

-- Verify changes
INFO FOR TABLE activity_template;
EOF
        echo "✅ Schema migration applied"
    else
        echo "⚠️  surreal CLI not available in pod"
        echo "   MANUAL ACTION REQUIRED: Apply schema changes manually"
        read -p "Press Enter when schema migration is complete..." _
    fi
fi
echo

# Step 2: Build new Docker image
echo "Step 2: Building new Docker image..."
echo "-------------------------------------------"
echo "Image: $IMAGE_NAME:$IMAGE_TAG"
echo "Context: repos/metabob-rpc-api"
echo

cd repos/metabob-rpc-api

if [ ! -f "docker/Dockerfile.server" ]; then
    echo "❌ Dockerfile not found: docker/Dockerfile.server"
    exit 1
fi

echo "Building image..."
docker build -f docker/Dockerfile.server -t $IMAGE_NAME:$IMAGE_TAG . || {
    echo "❌ Docker build failed"
    exit 1
}

echo "✅ Image built: $IMAGE_NAME:$IMAGE_TAG"
echo

# Step 3: Tag image for local registry or push to remote
echo "Step 3: Preparing image for deployment..."
echo "-------------------------------------------"

# Check if we need to push to a registry
read -p "Push to remote registry? (y/N): " PUSH_REMOTE
if [[ "$PUSH_REMOTE" =~ ^[Yy]$ ]]; then
    echo "Pushing image to registry..."
    docker push $IMAGE_NAME:$IMAGE_TAG || {
        echo "❌ Docker push failed"
        echo "   Make sure you're logged in: docker login"
        exit 1
    }
    echo "✅ Image pushed to registry"
else
    echo "Skipping registry push (using local image)"
    echo "⚠️  Note: K8s cluster must have access to this local image"
fi
echo

cd ../..

# Step 4: Update K8s deployment
echo "Step 4: Updating Kubernetes deployment..."
echo "-------------------------------------------"

# Create a patched version of the deployment manifest
DEPLOYMENT_FILE="k8s-metabob-rpc-api-simple.yaml"
PATCHED_FILE="k8s-metabob-rpc-api-simple-patched.yaml"

if [ ! -f "$DEPLOYMENT_FILE" ]; then
    echo "❌ Deployment file not found: $DEPLOYMENT_FILE"
    exit 1
fi

echo "Patching deployment manifest with new image..."
sed "s|image: metabobapp/metabob-rpc-api:.*|image: $IMAGE_NAME:$IMAGE_TAG|" \
    "$DEPLOYMENT_FILE" > "$PATCHED_FILE"

echo "Applying deployment..."
kubectl apply -f "$PATCHED_FILE" || {
    echo "❌ kubectl apply failed"
    echo "   Make sure kubectl is configured and namespace exists"
    exit 1
}

echo "✅ Deployment updated"
echo

# Step 5: Wait for rollout
echo "Step 5: Waiting for rollout to complete..."
echo "-------------------------------------------"
kubectl rollout status deployment/metabob-rpc-api -n $NAMESPACE --timeout=5m || {
    echo "❌ Rollout timeout or failed"
    echo "   Check pod status: kubectl get pods -n $NAMESPACE"
    echo "   Check logs: kubectl logs -n $NAMESPACE -l app=metabob-rpc-api"
    exit 1
}

echo "✅ Rollout complete"
echo

# Step 6: Verify deployment
echo "Step 6: Verifying deployment..."
echo "-------------------------------------------"

echo "Pod status:"
kubectl get pods -n $NAMESPACE -l app=metabob-rpc-api -o wide
echo

echo "Checking pod image version..."
POD_IMAGE=$(kubectl get pods -n $NAMESPACE -l app=metabob-rpc-api -o jsonpath='{.items[0].spec.containers[0].image}')
echo "Pod image: $POD_IMAGE"

if [[ "$POD_IMAGE" == "$IMAGE_NAME:$IMAGE_TAG" ]]; then
    echo "✅ Pod is running correct image"
else
    echo "⚠️  Pod is running different image: $POD_IMAGE"
    echo "   Expected: $IMAGE_NAME:$IMAGE_TAG"
fi
echo

# Step 7: Validate the fix
echo "Step 7: Running validation harness..."
echo "-------------------------------------------"

if [ -f "tests/validation-harnesses/run-activity-template-scope-assignment-validation.ts" ]; then
    echo "Running validation tests..."
    npx tsx tests/validation-harnesses/run-activity-template-scope-assignment-validation.ts || {
        echo "⚠️  Validation failed - check output above"
        echo "   Results saved to: tests/validation-harnesses/validation-results-activity-template-scope-assignment.json"
    }
else
    echo "⚠️  Validation harness not found"
    echo "   Manual validation required:"
    echo
    echo "   1. Create a template via RPC API:"
    echo "      POST /v2/activities/templates"
    echo "      Body: { \"name\": \"test-template\", \"scope\": \"org\" }"
    echo "      Headers: Authorization: Bearer <session_token>"
    echo
    echo "   2. Verify template has scope and org_id fields in response"
    echo
    echo "   3. Query SurrealDB to verify persistence:"
    echo "      SELECT * FROM activity_template WHERE name = 'test-template';"
fi
echo

echo "=============================================="
echo "Deployment Complete!"
echo "=============================================="
echo
echo "Summary:"
echo "  ✅ Schema migration applied (scope, org_id fields added)"
echo "  ✅ Docker image built: $IMAGE_NAME:$IMAGE_TAG"
echo "  ✅ K8s deployment updated"
echo "  ✅ Pods rolled out successfully"
echo
echo "Next steps:"
echo "  1. Review validation results above"
echo "  2. If validation passes, specification is ENFORCED"
echo "  3. Update validation results impulse with PASS status"
echo "  4. Mark specification as complete in tracking system"
echo
echo "Rollback (if needed):"
echo "  kubectl set image deployment/metabob-rpc-api -n $NAMESPACE \\"
echo "    rpc-api=metabobapp/metabob-rpc-api:0.16.13"
echo

