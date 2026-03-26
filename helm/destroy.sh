#!/bin/bash
# =============================================================================
# Destroy Activity System (Full Cleanup)
# =============================================================================
# Usage: ./destroy.sh [--keep-data]
#   --keep-data: Keep PVCs (preserves database and workspace data)
# =============================================================================

set -euo pipefail
cd "$(dirname "$0")"

NAMESPACE="activity-system"
KEEP_DATA=false

for arg in "$@"; do
  case $arg in
    --keep-data)
      KEEP_DATA=true
      shift
      ;;
  esac
done

echo "=== Activity System Teardown ==="
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

# Destroy releases (postuninstall hooks will clean up PVCs if hooks enabled)
echo "=== Destroying Helm Releases ==="
helmfile -f activity-system-minimal.yaml.gotmpl destroy || true

# Additional cleanup if not keeping data
if [ "$KEEP_DATA" = false ]; then
  echo ""
  echo "=== Cleaning Up Persistent Data ==="

  # Delete any remaining PVCs (in case hooks failed or were skipped)
  echo "Deleting PVCs..."
  kubectl delete pvc -n "$NAMESPACE" --all --ignore-not-found=true 2>/dev/null || true

  # Delete secrets
  echo "Deleting secrets..."
  kubectl delete secret -n "$NAMESPACE" surrealdb-credentials --ignore-not-found=true 2>/dev/null || true
  kubectl delete secret -n "$NAMESPACE" minibob-instance-credentials --ignore-not-found=true 2>/dev/null || true
  kubectl delete secret -n "$NAMESPACE" minibob-api-keys --ignore-not-found=true 2>/dev/null || true

  # Delete any remaining jobs
  echo "Deleting orphaned jobs..."
  kubectl delete jobs -n "$NAMESPACE" --all --ignore-not-found=true 2>/dev/null || true
else
  echo ""
  echo "NOTE: Keeping PVCs (--keep-data specified)"
  echo "  Data will be preserved for next deployment"
fi

# Check if namespace is empty
remaining=$(kubectl get all -n "$NAMESPACE" 2>/dev/null | wc -l || echo "0")
if [ "$remaining" -le 1 ]; then
  echo ""
  echo "Namespace is clean."

  # Optionally delete namespace
  read -p "Delete namespace '$NAMESPACE'? [y/N] " -n 1 -r
  echo
  if [[ $REPLY =~ ^[Yy]$ ]]; then
    kubectl delete namespace "$NAMESPACE" --ignore-not-found=true
    echo "Namespace deleted."
  fi
else
  echo ""
  echo "Remaining resources in namespace:"
  kubectl get all -n "$NAMESPACE" 2>/dev/null || true
fi

echo ""
echo "=== Teardown Complete ==="
echo ""
