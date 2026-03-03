#!/bin/bash
# Wrapper script to run validation harness with actual pod names

set -euo pipefail

NAMESPACE="metabob"

# Get actual pod names using label selectors
echo "Detecting pod names in namespace: $NAMESPACE"

DEVBOB_POD=$(kubectl get pod -n $NAMESPACE -l app.kubernetes.io/name=devbob -o jsonpath='{.items[0].metadata.name}' 2>/dev/null || echo "")
RPC_API_POD=$(kubectl get pod -n $NAMESPACE -l app=metabob-rpc-api -o jsonpath='{.items[0].metadata.name}' 2>/dev/null || echo "")
SURREALDB_POD=$(kubectl get pod -n $NAMESPACE -l app=surrealdb -o jsonpath='{.items[0].metadata.name}' 2>/dev/null || echo "")

if [ -z "$DEVBOB_POD" ] || [ -z "$RPC_API_POD" ] || [ -z "$SURREALDB_POD" ]; then
    echo "❌ ERROR: Could not detect all required pods"
    echo "DevBob pod: $DEVBOB_POD"
    echo "RPC API pod: $RPC_API_POD"
    echo "SurrealDB pod: $SURREALDB_POD"
    exit 1
fi

echo "✅ Detected pods:"
echo "  DevBob: $DEVBOB_POD"
echo "  RPC API: $RPC_API_POD"
echo "  SurrealDB: $SURREALDB_POD"
echo

# Create temporary modified harness with actual pod names
TEMP_HARNESS=$(mktemp /tmp/validation-harness-XXXXX.ts)

sed -e "s/const DEVBOB_POD = 'devbob-pod'/const DEVBOB_POD = '$DEVBOB_POD'/" \
    -e "s/const RPC_API_POD = 'rpc-api-pod'/const RPC_API_POD = '$RPC_API_POD'/" \
    -e "s/const SURREALDB_POD = 'surrealdb-pod'/const SURREALDB_POD = '$SURREALDB_POD'/" \
    tests/validation-harnesses/dynamic-activity-creation-with-trailblazing-pass2-harness.ts > $TEMP_HARNESS

echo "Running validation harness..."
echo "================================================"
echo

# Run the modified harness
bun run $TEMP_HARNESS

EXIT_CODE=$?

# Cleanup
rm -f $TEMP_HARNESS

exit $EXIT_CODE
