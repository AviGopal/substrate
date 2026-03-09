#!/bin/bash
# Cleanup test impulses from SurrealDB

set -e

echo "============================================"
echo "Test Impulse Cleanup Script"
echo "============================================"
echo

# Check if kubectl is available
if ! command -v kubectl &> /dev/null; then
    echo "❌ kubectl not found. Cannot cleanup database."
    exit 1
fi

# Check if surrealdb pod is running
POD_NAME=$(kubectl get pods -n metabob -l app=surrealdb -o jsonpath='{.items[0].metadata.name}' 2>/dev/null)

if [ -z "$POD_NAME" ]; then
    echo "❌ SurrealDB pod not found in metabob namespace"
    exit 1
fi

echo "✅ Found SurrealDB pod: $POD_NAME"
echo

# Execute cleanup query
echo "Executing cleanup query..."
kubectl exec -n metabob "$POD_NAME" -- surreal sql \
    --conn http://localhost:8000 \
    --user root \
    --pass root \
    --ns test \
    --db test \
    --pretty \
    "DELETE FROM impulse_data WHERE project_id ~ 'test-project-.*';" 2>&1

echo
echo "✅ Cleanup complete"
echo
echo "You can now run the validation harness:"
echo "  python tests/validation-harnesses/cross-vessel-type-preservation-harness.py"
