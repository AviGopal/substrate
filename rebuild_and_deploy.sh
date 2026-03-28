#!/bin/bash
set -e

echo "=== Rebuild and Deploy RPC API with GAP-9 Fix ==="
echo ""

# Configuration
VERSION="0.30.2-gap9-fix"
IMAGE_NAME="metabobapp/metabob-rpc-api:$VERSION"

# Step 1: Build RPC API Docker image
echo "[1/5] Building RPC API Docker image..."
cd /home/avi/documents/work/exp-repo/metabob-devbob/repos/metabob-rpc-api

docker build -t $IMAGE_NAME -f docker/Dockerfile.server .

if [ $? -ne 0 ]; then
  echo "✗ Docker build failed"
  exit 1
fi
echo "✓ Built: $IMAGE_NAME"

# Step 2: Push image
echo ""
echo "[2/5] Pushing image to registry..."
docker push $IMAGE_NAME 2>&1 | tail -5
echo "✓ Pushed to registry"

# Step 3: Update Helm values
echo ""
echo "[3/5] Updating Helm values..."
cd /home/avi/documents/work/exp-repo/metabob-devbob/repos/platform/metabob-apps
VALUES_FILE="charts/metabob-rpc-api/values/default.metabob-rpc-api.values.yaml"

# Backup
cp $VALUES_FILE ${VALUES_FILE}.backup.$(date +%s)

# Update tag
sed -i "s/tag: .*/tag: $VERSION/" $VALUES_FILE
echo "✓ Updated tag to: $VERSION"

# Step 4: Deploy with helmfile
echo ""
echo "[4/5] Deploying with helmfile..."
helmfile -e default sync --selector name=metabob-rpc-api 2>&1 | tail -30

# Step 5: Wait for rollout
echo ""
echo "[5/5] Waiting for deployment..."
kubectl rollout status deployment/metabob-rpc-api -n metabob --timeout=180s

echo ""
echo "✓ Deployment complete!"
echo ""
kubectl get pods -n metabob -l app=metabob-rpc-api

echo ""
echo "=== Next: Run Validation ==="
echo "./FINAL_VALIDATION_SCRIPT.sh"
