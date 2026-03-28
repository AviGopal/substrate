#!/bin/bash
set -e

echo "=== Local Deployment (Skip Registry Push) ==="
echo ""

VERSION="0.30.2-gap9-fix"
IMAGE_NAME="metabobapp/metabob-rpc-api:$VERSION"

# Step 1: Verify image exists locally
echo "[1/4] Verifying local Docker image..."
if docker images | grep -q "metabob-rpc-api.*$VERSION"; then
  echo "✓ Image found locally: $IMAGE_NAME"
else
  echo "✗ Image not found. Please build first."
  exit 1
fi

# Step 2: Load image into kind/k8s (if using kind)
echo ""
echo "[2/4] Checking Kubernetes context..."
CONTEXT=$(kubectl config current-context)
echo "  Current context: $CONTEXT"

if [[ "$CONTEXT" == *"kind"* ]] || [[ "$CONTEXT" == *"docker-desktop"* ]]; then
  echo "  Using local Kubernetes - image already available"
else
  echo "  Warning: May need to push to registry for remote cluster"
fi

# Step 3: Update deployment directly
echo ""
echo "[3/4] Updating deployment image..."
kubectl set image deployment/metabob-rpc-api \
  rpc-api=$IMAGE_NAME \
  -n metabob

# Force pull policy to IfNotPresent for local images
kubectl patch deployment metabob-rpc-api -n metabob \
  -p '{"spec":{"template":{"spec":{"containers":[{"name":"rpc-api","imagePullPolicy":"IfNotPresent"}]}}}}'

# Step 4: Wait for rollout
echo ""
echo "[4/4] Waiting for rollout..."
kubectl rollout status deployment/metabob-rpc-api -n metabob --timeout=120s

echo ""
echo "✓ Deployment complete!"
kubectl get pods -n metabob -l app=metabob-rpc-api

echo ""
echo "Checking logs..."
kubectl logs -n metabob deployment/metabob-rpc-api --tail=20 | head -20
