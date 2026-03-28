#!/bin/bash
# Deploy DevBob v1.0.0 using Helmfile (PROPER METHOD)

set -e

VERSION="v1.0.0"
PLATFORM_DIR="repos/platform/metabob-apps"

echo "===================================================================="
echo "DevBob ${VERSION} Helmfile Deployment"
echo "===================================================================="

# Verify we're in the right directory
if [ ! -d "$PLATFORM_DIR" ]; then
  echo "ERROR: Platform directory not found: $PLATFORM_DIR"
  exit 1
fi

# Verify image tag is updated in values
CURRENT_TAG=$(grep "tag:" ${PLATFORM_DIR}/charts/opencode-server/values/production.opencode-server.values.yaml | awk '{print $2}' | tr -d '"')
if [ "$CURRENT_TAG" != "$VERSION" ]; then
  echo "ERROR: Image tag in values.yaml is '$CURRENT_TAG', expected '$VERSION'"
  echo "Please update: ${PLATFORM_DIR}/charts/opencode-server/values/production.opencode-server.values.yaml"
  exit 1
fi

echo "✓ Image tag verified: $CURRENT_TAG"

# Check if image exists in registry
echo ""
echo "Verifying image in Docker Hub registry..."
if docker manifest inspect metabobapp/devbob:${VERSION} > /dev/null 2>&1; then
  DIGEST=$(docker manifest inspect metabobapp/devbob:${VERSION} 2>/dev/null | jq -r '.manifests[0].digest' 2>/dev/null || echo "unknown")
  echo "✓ Image metabobapp/devbob:${VERSION} found in registry"
  echo "  Digest: ${DIGEST}"
else
  echo "✗ Image metabobapp/devbob:${VERSION} not found in registry"
  echo ""
  echo "Please push the image first:"
  echo "  docker push metabobapp/devbob:${VERSION}"
  exit 1
fi

# Navigate to platform directory
cd "$PLATFORM_DIR"

# Show what will be deployed
echo ""
echo "===================================================================="
echo "Helmfile Diff (changes to be applied)"
echo "===================================================================="
helmfile -e production diff --skip-deps --context 3 2>&1 | grep -A 10 -B 10 "opencode-server" || echo "No changes detected for opencode-server"

# Ask for confirmation
echo ""
read -p "Deploy opencode-server with ${VERSION}? (y/N) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
  echo "Deployment cancelled"
  exit 1
fi

# Deploy using helmfile
echo ""
echo "===================================================================="
echo "Deploying with Helmfile..."
echo "===================================================================="
helmfile -e production apply --skip-deps --selector name=opencode-server

# Wait for rollout
echo ""
echo "Waiting for rollout to complete..."
kubectl rollout status deployment/opencode-server -n metabob --timeout=300s

# Check pod status
echo ""
echo "===================================================================="
echo "Pod Status"
echo "===================================================================="
kubectl get pods -n metabob -l app.kubernetes.io/name=opencode-server

# Show logs
echo ""
echo "===================================================================="
echo "Pod Logs (last 30 lines)"
echo "===================================================================="
kubectl logs -n metabob -l app.kubernetes.io/name=opencode-server --tail=30

# Verify the image
echo ""
echo "===================================================================="
echo "Verification"
echo "===================================================================="
DEPLOYED_IMAGE=$(kubectl get deployment opencode-server -n metabob -o jsonpath='{.spec.template.spec.containers[0].image}')
echo "Deployed image: ${DEPLOYED_IMAGE}"

if [[ "$DEPLOYED_IMAGE" == *"${VERSION}"* ]]; then
  echo "✓ Deployment successful!"
  echo ""
  echo "Next steps:"
  echo "1. Test Slack bot: Send 'Hello' and verify AI response"
  echo "2. Monitor logs: kubectl logs -n metabob -l app.kubernetes.io/name=opencode-server -f"
  echo "3. Clean up debug routes if any exist"
else
  echo "✗ Deployment may have failed - image mismatch"
  exit 1
fi
