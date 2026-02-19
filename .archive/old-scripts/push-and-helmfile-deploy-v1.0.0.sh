#!/bin/bash
# PROPER DEPLOYMENT: Push devbob v1.0.0 and deploy using Helmfile

set -e

VERSION="v1.0.0"
IMAGE="metabobapp/devbob:${VERSION}"

echo "===================================================================="
echo "DevBob v1.0.0 Push and Helmfile Deploy (PROPER METHOD)"
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
echo "===================================================================="
echo "Pushing to Docker Hub..."
echo "===================================================================="
echo "This may take several minutes for large images..."

# Push in background and monitor
docker push ${IMAGE} > /tmp/push-${VERSION}.log 2>&1 &
PUSH_PID=$!

# Monitor push progress
TIMEOUT=600
ELAPSED=0
while [ $ELAPSED -lt $TIMEOUT ]; do
  if ! ps -p $PUSH_PID > /dev/null 2>&1; then
    echo "✓ Push process completed"
    break
  fi
  
  if [ $(( $ELAPSED % 30 )) -eq 0 ]; then
    echo "[$ELAPSED s] Pushing..."
    tail -3 /tmp/push-${VERSION}.log | grep -E "(Pushed|Pushing|Layer)" | tail -1 || true
  fi
  
  sleep 5
  ELAPSED=$((ELAPSED + 5))
done

if [ $ELAPSED -ge $TIMEOUT ]; then
  echo "⚠ Push timeout reached (${TIMEOUT}s), checking registry..."
fi

# Verify in registry
echo ""
echo "===================================================================="
echo "Verifying image in registry..."
echo "===================================================================="
sleep 5  # Give registry a moment to update

if docker manifest inspect ${IMAGE} > /dev/null 2>&1; then
  echo "✓ Image ${IMAGE} verified in Docker Hub"
  DIGEST=$(docker manifest inspect ${IMAGE} | jq -r '.manifests[0].digest')
  echo "  Digest: ${DIGEST}"
  
  # Update latest tag
  echo ""
  echo "Updating 'latest' tag..."
  docker tag ${IMAGE} metabobapp/devbob:latest
  docker push metabobapp/devbob:latest > /dev/null 2>&1 &
  echo "✓ Latest tag update started in background"
  
  # Deploy with Helmfile
  echo ""
  echo "===================================================================="
  echo "Deploying with Helmfile (PROPER METHOD)"
  echo "===================================================================="
  ./helmfile-deploy-v1.0.0.sh
else
  echo "✗ Image not found in registry yet"
  echo ""
  echo "Push may still be in progress. Check with:"
  echo "  tail -f /tmp/push-${VERSION}.log"
  echo ""
  echo "Once verified, deploy with:"
  echo "  ./helmfile-deploy-v1.0.0.sh"
  exit 1
fi
