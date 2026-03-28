#!/bin/bash
set -e

echo "=== Deploying GAP-9 Fix to Kubernetes ==="
echo ""

# Step 1: Rebuild RPC API Docker image
echo "[1/5] Building metabob-rpc-api Docker image..."
cd /home/avi/documents/work/exp-repo/metabob-devbob/repos/metabob-rpc-api

# Get version from current tag
VERSION="0.30.2-gap9-fix"
IMAGE_NAME="metabobapp/metabob-rpc-api:$VERSION"

echo "  Building: $IMAGE_NAME"
docker build -t $IMAGE_NAME -f ../../docker/Dockerfile . 2>&1 | tail -5

if [ $? -eq 0 ]; then
  echo "  ✓ Build successful"
else
  echo "  ✗ Build failed"
  exit 1
fi

# Step 2: Push to registry
echo ""
echo "[2/5] Pushing image to registry..."
docker push $IMAGE_NAME 2>&1 | tail -3
echo "  ✓ Image pushed"

# Step 3: Update Helm values
echo ""
echo "[3/5] Updating Helm values..."
cd /home/avi/documents/work/exp-repo/metabob-devbob/repos/platform/metabob-apps

# Update rpc-api image version
VALUES_FILE="values.yaml"
if grep -q "metabob-rpc-api" $VALUES_FILE; then
  # Update existing version
  sed -i "s|metabobapp/metabob-rpc-api:.*|metabobapp/metabob-rpc-api:$VERSION|g" $VALUES_FILE
  echo "  ✓ Updated $VALUES_FILE"
else
  echo "  ⚠ Could not find rpc-api in values.yaml"
fi

# Step 4: Deploy with helmfile
echo ""
echo "[4/5] Deploying with helmfile..."
cd /home/avi/documents/work/exp-repo/metabob-devbob/repos/platform/metabob-apps
helmfile -e default apply 2>&1 | tail -20

echo ""
echo "[5/5] Waiting for deployment rollout..."
kubectl rollout status deployment/metabob-rpc-api -n metabob --timeout=120s

echo ""
echo "=== Deployment Complete ==="
echo "Image: $IMAGE_NAME"
echo "Namespace: metabob"
echo "Endpoints: api.metabob.local, app.metabob.local"
echo ""
echo "Next: Run validation script"
