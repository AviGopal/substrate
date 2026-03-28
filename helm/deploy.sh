#!/bin/bash
# =============================================================================
# Deploy Activity System
# =============================================================================
# Usage: ./deploy.sh [--clean]
#   --clean: Delete PVCs and secrets before deploying (fresh start)
# =============================================================================

set -euo pipefail
cd "$(dirname "$0")"

NAMESPACE="activity-system"
CLEAN=false

for arg in "$@"; do
  case $arg in
    --clean)
      CLEAN=true
      shift
      ;;
  esac
done

echo "=== Activity System Deployment ==="
echo ""

# Check prerequisites
if ! command -v kubectl &> /dev/null; then
  echo "ERROR: kubectl not found"
  exit 1
fi

if ! command -v helmfile &> /dev/null; then
  echo "ERROR: helmfile not found"
  exit 1
fi

# Check for required environment variables
if [ -z "${ANTHROPIC_API_KEY:-}" ]; then
  echo "WARNING: ANTHROPIC_API_KEY not set"
  echo "  MiniBob will fail to start without an API key"
  echo ""
fi

# Clean slate if requested
if [ "$CLEAN" = true ]; then
  echo "=== Clean Start: Removing existing data ==="

  # Delete PVCs (contains old credentials/data)
  echo "Deleting PVCs..."
  kubectl delete pvc -n "$NAMESPACE" -l app=surrealdb --ignore-not-found=true 2>/dev/null || true
  kubectl delete pvc -n "$NAMESPACE" -l app.kubernetes.io/name=minibob --ignore-not-found=true 2>/dev/null || true

  # Delete secrets (forces regeneration)
  echo "Deleting secrets..."
  kubectl delete secret -n "$NAMESPACE" surrealdb-credentials --ignore-not-found=true 2>/dev/null || true
  kubectl delete secret -n "$NAMESPACE" minibob-instance-credentials --ignore-not-found=true 2>/dev/null || true

  # Delete old migration jobs
  echo "Deleting old jobs..."
  kubectl delete jobs -n "$NAMESPACE" -l app.kubernetes.io/component=migration --ignore-not-found=true 2>/dev/null || true
  kubectl delete jobs -n "$NAMESPACE" -l app.kubernetes.io/component=init-data --ignore-not-found=true 2>/dev/null || true

  echo "Clean complete."
  echo ""
fi

# Create namespace if needed
kubectl create namespace "$NAMESPACE" --dry-run=client -o yaml | kubectl apply -f -

# Create API key secret if not exists
if ! kubectl get secret minibob-api-keys -n "$NAMESPACE" &>/dev/null; then
  if [ -n "${ANTHROPIC_API_KEY:-}" ]; then
    echo "Creating minibob-api-keys secret..."
    kubectl create secret generic minibob-api-keys \
      --namespace="$NAMESPACE" \
      --from-literal=anthropic-api-key="$ANTHROPIC_API_KEY" \
      --from-literal=github-token="${GITHUB_TOKEN:-}" \
      --dry-run=client -o yaml | kubectl apply -f -
  else
    echo "WARNING: Skipping minibob-api-keys secret (ANTHROPIC_API_KEY not set)"
  fi
fi

# Deploy
echo "=== Deploying with Helmfile ==="
echo ""
helmfile -f activity-system-minimal.yaml.gotmpl sync

echo ""
echo "=== Deployment Complete ==="
echo ""
echo "Endpoints (ensure /etc/hosts has 127.0.0.1 entries):"
echo "  Dashboard:   http://app.metabob.local"
echo "  Activity API: http://activity.metabob.local"
echo "  Analysis API: http://api.metabob.local"
echo "  SurrealDB:   http://surql.metabob.local"
echo "  MiniBob:     http://minibob.metabob.local"
echo ""
echo "Add to /etc/hosts:"
echo "  127.0.0.1 app.metabob.local activity.metabob.local api.metabob.local"
echo "  127.0.0.1 surql.metabob.local minibob.metabob.local"
echo ""
echo "To verify:"
echo "  kubectl get pods -n $NAMESPACE"
echo "  kubectl get jobs -n $NAMESPACE"
echo ""
