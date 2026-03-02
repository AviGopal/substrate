#!/bin/bash
set -e

echo "=========================================="
echo "GitHub Token Setup for DevBob"
echo "=========================================="
echo ""

# Check if .env file exists
if [ ! -f .env ]; then
    echo "Creating .env file..."
    touch .env
fi

# Check if GITHUB_TOKEN is already in .env
if grep -q "GITHUB_TOKEN=" .env; then
    echo "✅ GITHUB_TOKEN found in .env"
    export $(grep GITHUB_TOKEN .env | xargs)
else
    echo "❌ GITHUB_TOKEN not found in .env"
    echo ""
    echo "Please add your GitHub token to .env:"
    echo "  1. Create token: https://github.com/settings/tokens/new"
    echo "  2. Select scope: 'repo' (full control)"
    echo "  3. Copy token and run:"
    echo ""
    echo "     echo 'GITHUB_TOKEN=ghp_yourTokenHere' >> .env"
    echo ""
    exit 1
fi

# Validate token format
if [[ ! $GITHUB_TOKEN =~ ^ghp_[a-zA-Z0-9]{36}$ ]] && [[ ! $GITHUB_TOKEN =~ ^github_pat_[a-zA-Z0-9_]{82}$ ]]; then
    echo "⚠️  Warning: Token format doesn't match expected pattern"
    echo "   Classic: ghp_XXXX (40 chars)"
    echo "   Fine-grained: github_pat_XXXX (90+ chars)"
    echo ""
    read -p "Continue anyway? (y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

echo ""
echo "=== Step 1: Test GitHub Token Locally ==="
echo "Testing token with GitHub API..."

RESPONSE=$(curl -s -H "Authorization: token $GITHUB_TOKEN" https://api.github.com/user)
USERNAME=$(echo $RESPONSE | grep -o '"login":"[^"]*"' | cut -d'"' -f4)

if [ -z "$USERNAME" ]; then
    echo "❌ Token validation failed"
    echo "Response: $RESPONSE"
    exit 1
fi

echo "✅ Token valid for user: $USERNAME"

# Check repo access
echo ""
echo "Checking repository access..."
REPOS=$(curl -s -H "Authorization: token $GITHUB_TOKEN" "https://api.github.com/user/repos?per_page=5&sort=updated" | grep -o '"full_name":"[^"]*"' | cut -d'"' -f4)

if [ -z "$REPOS" ]; then
    echo "⚠️  No repositories accessible with this token"
else
    echo "✅ Can access repositories:"
    echo "$REPOS" | head -5
fi

echo ""
echo "=== Step 2: Create Kubernetes Secret ==="

# Check if secret already exists
if kubectl get secret github-credentials -n metabob &>/dev/null; then
    echo "Secret 'github-credentials' already exists"
    read -p "Delete and recreate? (y/N) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        kubectl delete secret github-credentials -n metabob
        echo "Deleted existing secret"
    else
        echo "Keeping existing secret"
        echo ""
        echo "=== Step 3: Update Deployment ==="
        echo "Run: cd repos/platform/metabob-apps && helmfile -e default --selector 'name=devbob' sync"
        exit 0
    fi
fi

# Create secret
kubectl create secret generic github-credentials \
  --from-literal=token=$GITHUB_TOKEN \
  -n metabob \
  --dry-run=client -o yaml | kubectl apply -f -

echo "✅ Secret created in metabob namespace"

# Verify
kubectl get secret github-credentials -n metabob -o jsonpath='{.data.token}' | base64 -d | wc -c
echo "characters in secret"

echo ""
echo "=== Step 3: Update Deployment Configuration ==="
echo ""
echo "Next steps:"
echo "  1. Update deployment to mount GITHUB_TOKEN"
echo "  2. Redeploy devbob pod"
echo ""
echo "Run these commands:"
echo ""
echo "  cd repos/platform/metabob-apps"
echo "  export \$(grep ANTHROPIC /home/avi/documents/work/exp-repo/metabob-devbob/.env | xargs)"
echo "  helmfile -e default --selector 'name=devbob' sync"
echo ""
echo "Or use the quick deploy script:"
echo "  ./scripts/deploy-devbob-with-github-token.sh"
echo ""

echo "=========================================="
echo "✅ GitHub Token Setup Complete"
echo "=========================================="
