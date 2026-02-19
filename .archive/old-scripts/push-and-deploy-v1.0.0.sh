#!/bin/bash
# Push devbob v1.0.0 and deploy when ready

set -e

VERSION="v1.0.0"
IMAGE="metabobapp/devbob:${VERSION}"

echo "===================================================================="
echo "DevBob v1.0.0 Push and Deploy"
echo "===================================================================="

# Kill any hung docker processes
echo "Cleaning up hung Docker processes..."
pkill -9 -f "docker push" 2>/dev/null || true
sleep 2

# Check if image exists locally
if ! docker inspect ${IMAGE} > /dev/null 2>&1; then
  echo "ERROR: Image ${IMAGE} not found locally"
  echo "Available tags:"
  docker images metabobapp/devbob --format "{{.Tag}}"
  exit 1
fi

echo "✓ Image ${IMAGE} found locally"
echo "  SHA: $(docker inspect ${IMAGE} --format '{{.Id}}')"

# Push with timeout
echo ""
echo "Pushing to Docker Hub..."
echo "This may take several minutes for large images..."

timeout 600 docker push ${IMAGE} 2>&1 | tee /tmp/push-${VERSION}.log | grep -E "(digest|error|Error|denied)" || {
  echo ""
  echo "Push completed or timed out. Checking registry..."
}

# Verify in registry
echo ""
echo "Verifying image in registry..."
if docker manifest inspect ${IMAGE} > /dev/null 2>&1; then
  echo "✓ Image ${IMAGE} verified in Docker Hub"
  DIGEST=$(docker manifest inspect ${IMAGE} | jq -r '.manifests[0].digest')
  echo "  Digest: ${DIGEST}"
  
  # Deploy
  echo ""
  echo "===================================================================="
  echo "Deploying to Kubernetes..."
  echo "===================================================================="
  ./deploy-${VERSION}.sh
else
  echo "✗ Image not found in registry yet"
  echo ""
  echo "The push may still be in progress. Check with:"
  echo "  docker manifest inspect ${IMAGE}"
  echo ""
  echo "Once verified, deploy manually with:"
  echo "  ./deploy-${VERSION}.sh"
  exit 1
fi
