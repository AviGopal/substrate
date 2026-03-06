#!/bin/bash
set -e

echo "🚀 Deploying SurrealDB Authentication Fix"
echo "=========================================="

cd repos/metabob-rpc-api

# Get current version
CURRENT_VERSION=$(grep '__version__ =' server/__version__.py | cut -d'"' -f2)
echo "📦 Current version: $CURRENT_VERSION"

# Increment patch version
IFS='.' read -r major minor patch <<< "$CURRENT_VERSION"
NEW_VERSION="$major.$minor.$((patch + 1))"
echo "📦 New version: $NEW_VERSION"

# Update version file
echo "__version__ = \"$NEW_VERSION\"" > server/__version__.py
echo "✅ Updated version to $NEW_VERSION"

# Build Docker image
IMAGE_NAME="metabob-rpc-api:$NEW_VERSION-auth-fix"
echo "🐳 Building Docker image: $IMAGE_NAME"
docker build -t $IMAGE_NAME . || exit 1
echo "✅ Image built successfully"

# Update deployment
echo "☸️  Updating Kubernetes deployment..."
kubectl set image deployment/metabob-rpc-api metabob-rpc-api=$IMAGE_NAME -n metabob || exit 1

# Wait for rollout
echo "⏳ Waiting for rollout to complete..."
kubectl rollout status deployment/metabob-rpc-api -n metabob --timeout=5m || exit 1

# Check pod status
echo "✅ Rollout complete. Checking pod status..."
kubectl get pods -n metabob | grep metabob-rpc-api

# Check logs
echo ""
echo "📋 Recent logs:"
kubectl logs -n metabob deployment/metabob-rpc-api --tail=20

echo ""
echo "✅ Deployment complete!"
echo "Image: $IMAGE_NAME"
echo "Version: $NEW_VERSION"
