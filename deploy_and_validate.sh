#!/bin/bash
set -e

echo "=== Complete Deployment and Validation Pipeline ==="
echo ""

# Configuration
VERSION="0.30.2-gap9-fix"
IMAGE_NAME="metabobapp/metabob-rpc-api:$VERSION"
PLATFORM_DIR="/home/avi/documents/work/exp-repo/metabob-devbob/repos/platform/metabob-apps"
RPC_API_DIR="/home/avi/documents/work/exp-repo/metabob-devbob/repos/metabob-rpc-api"

# Step 1: Build Docker image
echo "[1/6] Building Docker image..."
cd $RPC_API_DIR
docker build -t $IMAGE_NAME -f ../../docker/Dockerfile .

if [ $? -ne 0 ]; then
  echo "✗ Docker build failed"
  exit 1
fi
echo "✓ Built: $IMAGE_NAME"

# Step 2: Push image (if needed)
echo ""
echo "[2/6] Pushing image to registry..."
docker push $IMAGE_NAME
echo "✓ Pushed to registry"

# Step 3: Update Helm values
echo ""
echo "[3/6] Updating Helm values..."
cd $PLATFORM_DIR
VALUES_FILE="charts/metabob-rpc-api/values/default.metabob-rpc-api.values.yaml"

# Backup current values
cp $VALUES_FILE ${VALUES_FILE}.backup

# Update image tag
sed -i "s/tag: .*/tag: $VERSION/" $VALUES_FILE

echo "✓ Updated $VALUES_FILE"
echo "  New tag: $VERSION"

# Show diff
echo "  Changes:"
diff ${VALUES_FILE}.backup $VALUES_FILE || true

# Step 4: Deploy with helmfile
echo ""
echo "[4/6] Deploying with helmfile..."
cd $PLATFORM_DIR

helmfile -e default sync --selector name=metabob-rpc-api

# Step 5: Wait for rollout
echo ""
echo "[5/6] Waiting for deployment..."
kubectl rollout status deployment/metabob-rpc-api -n metabob --timeout=180s

echo "✓ Deployment complete"

# Step 6: Verify deployment
echo ""
echo "[6/6] Verifying deployment..."
echo "  Checking pod status..."
kubectl get pods -n metabob -l app=metabob-rpc-api

echo "  Checking image version..."
CURRENT_IMAGE=$(kubectl get deployment metabob-rpc-api -n metabob -o jsonpath='{.spec.template.spec.containers[0].image}')
echo "  Running image: $CURRENT_IMAGE"

if [ "$CURRENT_IMAGE" == "$IMAGE_NAME" ]; then
  echo "  ✓ Image version matches"
else
  echo "  ⚠ Image mismatch: expected $IMAGE_NAME, got $CURRENT_IMAGE"
fi

echo "  Checking recent logs..."
kubectl logs -n metabob deployment/metabob-rpc-api --tail=10 | head -10

echo ""
echo "=== Deployment Complete ==="
echo "Next: Run validation tests"
echo "  ./FINAL_VALIDATION_SCRIPT.sh"
