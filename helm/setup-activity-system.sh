#!/bin/bash
# Setup script for Activity System - runs after helmfile sync
# Creates secrets and Istio networking

set -e

echo "🔧 Setting up Activity System..."

# Validate ANTHROPIC_API_KEY is set
if [ -z "$ANTHROPIC_API_KEY" ]; then
  echo "❌ ERROR: ANTHROPIC_API_KEY environment variable not set"
  echo "   Run: export ANTHROPIC_API_KEY='sk-ant-...'"
  exit 1
fi

NAMESPACE="activity-system"

# Create namespace (already created by helmfile, but ensure it exists)
kubectl create namespace $NAMESPACE --dry-run=client -o yaml | kubectl apply -f -
echo "✅ Namespace $NAMESPACE ready"

# Create secret for MiniBob API keys
kubectl create secret generic minibob-api-keys \
  --from-literal=anthropic-api-key="$ANTHROPIC_API_KEY" \
  --from-literal=github-token="" \
  --namespace=$NAMESPACE \
  --dry-run=client -o yaml | kubectl apply -f -
echo "✅ Created minibob-api-keys secret"

# Label namespace for Istio injection (handled by Helm chart too)
kubectl label namespace $NAMESPACE istio-injection=enabled --overwrite
echo "✅ Enabled Istio injection on namespace"

# Check if Istio is installed
if ! kubectl get namespace istio-system &> /dev/null; then
  echo "⚠️  WARNING: Istio not installed"
  echo "   Install with: istioctl install --set profile=demo -y"
  echo "   Helm chart will create Gateway/VirtualService resources,"
  echo "   but they won't work without Istio ingress gateway"
fi

echo "✅ Istio networking configured via Helm chart"
echo ""
echo "🎉 Activity System deployment complete!"
echo ""
echo "📍 Access:"
echo "   Dashboard:  http://dashboard.minibob.local"
echo "   API:        http://api.minibob.local/health"
echo ""
echo "📊 Monitor pods:"
echo "   kubectl -n activity-system get pods -w"
