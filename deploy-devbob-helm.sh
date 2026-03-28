#!/bin/bash
# Deploy devbob using Helm chart (CANONICAL METHOD)
# This replaces the deprecated StatefulSet-based deployment

set -euo pipefail

NAMESPACE="metabob"
RELEASE_NAME="devbob"
CHART_PATH="helm/charts/devbob"
VALUES_FILE="${VALUES_FILE:-}"

echo "=============================================="
echo "DevBob Helm Deployment (Canonical Method)"
echo "=============================================="
echo

# Step 1: Verify image is built
echo "Step 1: Verifying image..."
if docker images 2>&1 | grep -v "WARNING" | grep -q "devbob.*latest"; then
    echo "✓ Image devbob:latest exists"
else
    echo "✗ Image devbob:latest not found"
    echo "  Run: docker build -t devbob:latest -f docker/Dockerfile.devbob ."
    exit 1
fi
echo

# Step 2: Get credentials
echo "Step 2: Gathering credentials..."

# Get existing Anthropic key from secret or prompt
ANTHROPIC_KEY=$(kubectl get secret $RELEASE_NAME-secrets -n $NAMESPACE -o jsonpath='{.data.anthropic-api-key}' 2>/dev/null | base64 -d || echo "")
if [ -z "$ANTHROPIC_KEY" ]; then
    if [ -n "${ANTHROPIC_API_KEY:-}" ]; then
        ANTHROPIC_KEY="$ANTHROPIC_API_KEY"
        echo "✓ Using ANTHROPIC_API_KEY from environment"
    else
        echo "Anthropic API key required"
        read -p "Enter ANTHROPIC_API_KEY: " -s ANTHROPIC_KEY
        echo
    fi
fi
echo "✓ Anthropic API key: ${ANTHROPIC_KEY:0:20}..."

# Get Metabob API key
METABOB_KEY=$(kubectl get secret $RELEASE_NAME-secrets -n $NAMESPACE -o jsonpath='{.data.metabob-api-key}' 2>/dev/null | base64 -d || echo "")
if [ -z "$METABOB_KEY" ]; then
    if [ -n "${METABOB_API_KEY:-}" ]; then
        METABOB_KEY="$METABOB_API_KEY"
        echo "✓ Using METABOB_API_KEY from environment"
    else
        echo "Metabob API key required"
        read -p "Enter METABOB_API_KEY: " -s METABOB_KEY
        echo
    fi
fi
echo "✓ Metabob API key: ${METABOB_KEY:0:20}..."

# Get GitHub token
if [ -n "${GITHUB_TOKEN:-}" ]; then
    echo "✓ Using GITHUB_TOKEN from environment"
else
    echo "GitHub token required for PR operations (scopes: repo, workflow)"
    read -p "Enter GITHUB_TOKEN (or press Enter to skip): " -s GITHUB_TOKEN
    echo
    if [ -z "$GITHUB_TOKEN" ]; then
        echo "⚠ No GitHub token provided - git operations will be limited"
        GITHUB_TOKEN="none"
    fi
fi

# Get git user info
read -p "Enter git user name [Devbob Agent]: " GIT_USER_NAME
GIT_USER_NAME="${GIT_USER_NAME:-Devbob Agent}"

read -p "Enter git user email [devbob@metabob.local]: " GIT_USER_EMAIL
GIT_USER_EMAIL="${GIT_USER_EMAIL:-devbob@metabob.local}"

echo "✓ Git user: $GIT_USER_NAME <$GIT_USER_EMAIL>"
echo

# Step 3: Install/upgrade via Helm
echo "Step 3: Deploying via Helm..."

HELM_ARGS=(
    upgrade
    --install
    --namespace "$NAMESPACE"
    --create-namespace
    "$RELEASE_NAME"
    "$CHART_PATH"
    --set "secrets.anthropicApiKey=$ANTHROPIC_KEY"
    --set "secrets.metabobApiKey=$METABOB_KEY"
    --set "secrets.githubToken=$GITHUB_TOKEN"
    --set "secrets.gitUserName=$GIT_USER_NAME"
    --set "secrets.gitUserEmail=$GIT_USER_EMAIL"
)

# Add custom values file if specified
if [ -n "$VALUES_FILE" ]; then
    HELM_ARGS+=(--values "$VALUES_FILE")
fi

# Execute Helm command
helm "${HELM_ARGS[@]}"

echo "✓ Helm release deployed: $RELEASE_NAME"
echo

# Step 4: Wait for deployment
echo "Step 4: Waiting for deployment to be ready..."
echo "This may take 2-5 minutes..."
kubectl rollout status deployment/$RELEASE_NAME -n $NAMESPACE --timeout=10m

echo
echo "✓ Deployment ready"
echo

# Step 5: Verify pods
echo "Step 5: Verifying pod status..."
kubectl get pods -n $NAMESPACE -l app.kubernetes.io/name=devbob -o wide
echo

# Step 6: Check pod logs
echo "Step 6: Checking pod logs..."
POD_NAME=$(kubectl get pods -n $NAMESPACE -l app.kubernetes.io/name=devbob -o jsonpath='{.items[0].metadata.name}')
if [ -n "$POD_NAME" ]; then
    echo "--- $POD_NAME (last 50 lines) ---"
    kubectl logs $POD_NAME -n $NAMESPACE --tail=50 || echo "  (logs not available yet)"
    echo
fi

echo "=============================================="
echo "Deployment Complete!"
echo "=============================================="
echo
echo "Deployment info:"
echo "  Release: $RELEASE_NAME"
echo "  Namespace: $NAMESPACE"
echo "  Chart: $CHART_PATH"
echo
echo "Next steps:"
echo "1. Check ACP server status:"
echo "   kubectl logs $POD_NAME -n $NAMESPACE | grep 'listening on'"
echo
echo "2. Test health endpoint:"
echo "   kubectl exec $POD_NAME -n $NAMESPACE -- curl http://localhost:8080/health"
echo
echo "3. Test git operations:"
echo "   kubectl exec -it $POD_NAME -n $NAMESPACE -- git config --list"
echo
echo "4. View Helm release info:"
echo "   helm status $RELEASE_NAME -n $NAMESPACE"
echo
echo "5. Uninstall (if needed):"
echo "   helm uninstall $RELEASE_NAME -n $NAMESPACE"
echo
