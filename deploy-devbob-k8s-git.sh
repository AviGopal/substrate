#!/bin/bash
# ⚠️ DEPRECATED: This script uses the deprecated StatefulSet manifest
# Use deploy-devbob-helm.sh for new deployments (canonical method)
# This script is kept for backward compatibility only

# Deploy devbob with git operations to Kubernetes
# This script completes the deployment phase of the Trace → Enforce → Validate loop

echo "⚠️  WARNING: This deployment script is deprecated"
echo "    Use deploy-devbob-helm.sh for new deployments"
echo "    Continuing with StatefulSet deployment in 5 seconds..."
echo
sleep 5

set -euo pipefail

NAMESPACE="metabob"
SECRET_NAME="devbob-secrets"
STATEFULSET_FILE="k8s-devbob-statefulset.yaml"

echo "=============================================="
echo "DevBob K8s Git Operations Deployment"
echo "=============================================="
echo

# Step 1: Verify image is built
echo "Step 1: Verifying image..."
if docker images 2>&1 | grep -v "WARNING" | grep -q "devbob.*local-fixed"; then
    echo "✓ Image devbob:local-fixed exists"
else
    echo "✗ Image devbob:local-fixed not found"
    echo "  Run: docker build -t devbob:local-fixed -f Dockerfile.devbob-local ."
    exit 1
fi
echo

# Step 2: Get credentials
echo "Step 2: Gathering credentials..."

# Get existing Anthropic key from secret
ANTHROPIC_KEY=$(kubectl get secret $SECRET_NAME -n $NAMESPACE -o jsonpath='{.data.anthropic-api-key}' 2>/dev/null | base64 -d || echo "")
if [ -z "$ANTHROPIC_KEY" ]; then
    echo "✗ Could not retrieve existing Anthropic API key from secret"
    read -p "Enter ANTHROPIC_API_KEY: " -s ANTHROPIC_KEY
    echo
fi
echo "✓ Anthropic API key: ${ANTHROPIC_KEY:0:20}..."

# Get GitHub token
if [ -n "${GITHUB_TOKEN:-}" ]; then
    echo "✓ Using GITHUB_TOKEN from environment"
else
    echo "GitHub token required for PR operations (scopes: repo, workflow)"
    read -p "Enter GITHUB_TOKEN (or press Enter to skip git operations): " -s GITHUB_TOKEN
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

# Step 3: Update secret
echo "Step 3: Updating Kubernetes secret..."
kubectl create secret generic $SECRET_NAME \
    --namespace=$NAMESPACE \
    --from-literal=anthropic-api-key="$ANTHROPIC_KEY" \
    --from-literal=github-token="$GITHUB_TOKEN" \
    --from-literal=git-user-name="$GIT_USER_NAME" \
    --from-literal=git-user-email="$GIT_USER_EMAIL" \
    --dry-run=client -o yaml | kubectl apply -f -

echo "✓ Secret updated with 4 keys"
echo

# Step 4: Apply StatefulSet
echo "Step 4: Applying StatefulSet configuration..."
if [ ! -f "$STATEFULSET_FILE" ]; then
    echo "✗ StatefulSet file not found: $STATEFULSET_FILE"
    exit 1
fi

kubectl apply -f "$STATEFULSET_FILE"
echo "✓ StatefulSet applied"
echo

# Step 5: Wait for rollout
echo "Step 5: Waiting for rollout to complete..."
echo "This may take 2-5 minutes..."
kubectl rollout status statefulset/devbob -n $NAMESPACE --timeout=10m

echo
echo "✓ Rollout complete"
echo

# Step 6: Verify pods
echo "Step 6: Verifying pod status..."
kubectl get pods -n $NAMESPACE -l app.kubernetes.io/name=devbob -o wide
echo

# Step 7: Check pod logs for git configuration
echo "Step 7: Checking git configuration in pods..."
for pod in $(kubectl get pods -n $NAMESPACE -l app.kubernetes.io/name=devbob -o jsonpath='{.items[*].metadata.name}'); do
    echo "--- $pod ---"
    kubectl logs $pod -n $NAMESPACE --tail=50 | grep -A 5 "Step 3b: Configuring git" || echo "  (git config logs not found yet - pod may still be starting)"
    echo
done

echo "=============================================="
echo "Deployment Complete!"
echo "=============================================="
echo
echo "Next steps:"
echo "1. Run validation harness:"
echo "   ./tests/validation-harnesses/devbob-k8s-git-operations-harness.sh --skip-destructive"
echo
echo "2. Test git operations manually:"
echo "   kubectl exec -it devbob-0 -n metabob -- git config --list"
echo "   kubectl exec -it devbob-0 -n metabob -- gh auth status"
echo
