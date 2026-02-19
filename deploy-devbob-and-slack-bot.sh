#!/bin/bash
# Deploy DevBob (opencode-server) and fix Slack Bot configuration
# This script deploys all necessary components for Slack integration

set -e

echo "🚀 Starting DevBob and Slack Bot deployment..."
echo ""

# Change to metabob-apps directory
cd repos/platform/metabob-apps

# Check kubectl connection
echo "📡 Checking Kubernetes connection..."
if ! kubectl cluster-info &>/dev/null; then
    echo "❌ Cannot connect to Kubernetes cluster"
    echo "Please ensure kubectl is configured for metabob-production context"
    exit 1
fi

echo "✅ Connected to cluster"
echo ""

# Step 1: Deploy opencode-server (devbob)
echo "📦 Step 1: Deploying opencode-server (devbob)..."
echo "  - Image: metabobapp/devbob:latest"
echo "  - Command: opencode acp --hostname=0.0.0.0 --port=8080"
echo "  - Service: opencode-server:8080 (ClusterIP)"
echo ""

helmfile -e production sync --selector name=opencode-server --wait

echo "✅ opencode-server deployed"
echo ""

# Step 2: Update and deploy slack-bot with fixed config
echo "📦 Step 2: Deploying slack-bot with fixed configuration..."
echo "  - Fixed OPENCODE_BACKEND_URL: http://opencode-server:8080"
echo "  - Image: metabobapp/slack-bot:v1.0.3"
echo ""

helmfile -e production sync --selector name=slack-bot --wait

echo "✅ slack-bot deployed"
echo ""

# Step 3: Deploy istio-application (includes devbob.metabob.com route)
echo "📦 Step 3: Deploying Istio routing (includes temporary devbob.metabob.com)..."
echo "  - Added VirtualService: devbob-debug"
echo "  - Route: devbob.metabob.com → opencode-server:8080"
echo "  - ⚠️  TEMPORARY: For debugging only, remove after testing"
echo ""

helmfile -e production sync --selector name=istio-application --wait

echo "✅ Istio routing deployed"
echo ""

# Step 4: Verify deployments
echo "🔍 Step 4: Verifying deployments..."
echo ""

echo "Checking opencode-server pod..."
kubectl get pods -n metabob -l app.kubernetes.io/name=opencode-server

echo ""
echo "Checking slack-bot pod..."
kubectl get pods -n metabob -l app.kubernetes.io/name=slack-bot

echo ""
echo "Checking services..."
kubectl get svc -n metabob | grep -E "NAME|opencode-server"

echo ""
echo "✅ Deployment verification complete"
echo ""

# Step 5: Test connectivity
echo "🧪 Step 5: Testing connectivity..."
echo ""

echo "Testing opencode-server health endpoint..."
OPENCODE_POD=$(kubectl get pods -n metabob -l app.kubernetes.io/name=opencode-server -o jsonpath='{.items[0].metadata.name}' 2>/dev/null || echo "")

if [ -n "$OPENCODE_POD" ]; then
    echo "Pod: $OPENCODE_POD"
    echo "Testing HTTP GET /health..."
    kubectl exec -n metabob "$OPENCODE_POD" -- curl -s http://localhost:8080/health || echo "Health check endpoint not responding"
else
    echo "⚠️  opencode-server pod not found"
fi

echo ""
echo "Testing slack-bot logs..."
SLACK_POD=$(kubectl get pods -n metabob -l app.kubernetes.io/name=slack-bot -o jsonpath='{.items[0].metadata.name}' 2>/dev/null || echo "")

if [ -n "$SLACK_POD" ]; then
    echo "Pod: $SLACK_POD"
    echo "Last 10 log lines:"
    kubectl logs -n metabob "$SLACK_POD" --tail=10
else
    echo "⚠️  slack-bot pod not found"
fi

echo ""
echo "✅ Testing complete"
echo ""

# Summary
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🎉 DEPLOYMENT COMPLETE!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📊 Summary:"
echo "  ✅ opencode-server (devbob) deployed"
echo "  ✅ slack-bot configured to use http://opencode-server:8080"
echo "  ✅ Istio routing updated"
echo "  ⚠️  TEMPORARY: devbob.metabob.com route added for debugging"
echo ""
echo "🔗 Access Points:"
echo "  • Internal: http://opencode-server:8080 (slack-bot uses this)"
echo "  • External: https://devbob.metabob.com (DEBUG ONLY)"
echo ""
echo "📝 Next Steps:"
echo "  1. Test Slack bot by sending a message in the Slack workspace"
echo "  2. Verify responses are working"
echo "  3. Check logs: kubectl logs -n metabob -l app.kubernetes.io/name=slack-bot"
echo "  4. Debug via: https://devbob.metabob.com/health"
echo "  5. IMPORTANT: Remove devbob.metabob.com route after testing (see REMOVE_DEVBOB_ROUTE.md)"
echo ""
echo "⚠️  REMINDER: The devbob.metabob.com route is TEMPORARY"
echo "    Remove it after debugging using: ./remove-devbob-debug-route.sh"
echo ""
