#!/bin/bash
set -e

echo "🚀 Deploying Slack Bot to Kubernetes"
echo "======================================"
echo ""

# Navigate to the metabob-apps directory
cd repos/platform/metabob-apps

# Check if kubectl is configured
echo "📋 Checking Kubernetes connection..."
if ! kubectl cluster-info &>/dev/null; then
    echo "❌ Error: kubectl is not configured or cannot connect to cluster"
    echo "Please configure your kubeconfig file first"
    exit 1
fi

echo "✅ Kubernetes connection verified"
echo ""

# Check if metabob namespace exists
echo "📋 Checking metabob namespace..."
if ! kubectl get namespace metabob &>/dev/null; then
    echo "⚠️  metabob namespace does not exist. Creating it..."
    kubectl create namespace metabob
    echo "✅ Created metabob namespace"
else
    echo "✅ metabob namespace exists"
fi
echo ""

# Deploy using helmfile
echo "📦 Deploying slack-bot with helmfile..."
echo ""
helmfile -e default -l name=slack-bot apply

echo ""
echo "✅ Deployment complete!"
echo ""
echo "📋 Checking deployment status..."
kubectl -n metabob get deployments slack-bot
echo ""
kubectl -n metabob get pods -l app.kubernetes.io/name=slack-bot
echo ""
echo "📋 To view logs:"
echo "  kubectl -n metabob logs -f deployment/slack-bot"
echo ""
echo "📋 To check bot status in Slack:"
echo "  Open Slack and DM the 'devbob' bot"
echo "  Try commands: /status, /activities, /session-info"
