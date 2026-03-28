#!/bin/bash
# Import local development data to production SurrealDB

set -e

if [ $# -lt 1 ]; then
    echo "Usage: $0 <backup-file.surql>"
    echo ""
    echo "Example: $0 ./backups/surrealdb-local-20260327_120000.surql"
    exit 1
fi

BACKUP_FILE="$1"

if [ ! -f "$BACKUP_FILE" ]; then
    echo "❌ Error: Backup file not found: $BACKUP_FILE"
    exit 1
fi

echo "=== Importing Data to Production SurrealDB ==="
echo "Source: $BACKUP_FILE"

# Verify we're on production cluster
CURRENT_CONTEXT=$(kubectl config current-context)
echo "Current kubectl context: $CURRENT_CONTEXT"

if [[ ! "$CURRENT_CONTEXT" =~ "metabob-production" ]]; then
    echo "⚠️  Warning: Current context does not contain 'metabob-production'"
    read -p "Continue anyway? (yes/no): " CONFIRM
    if [ "$CONFIRM" != "yes" ]; then
        echo "Aborted."
        exit 1
    fi
fi

# Check if production SurrealDB is running
echo "Checking if production SurrealDB is accessible..."
if ! kubectl get pods -n activity-system -l app.kubernetes.io/name=surrealdb &>/dev/null; then
    echo "❌ Error: SurrealDB not found in activity-system namespace"
    echo "Make sure the new stack is deployed first"
    exit 1
fi

# Get SurrealDB pod name
POD_NAME=$(kubectl get pods -n activity-system -l app.kubernetes.io/name=surrealdb -o jsonpath='{.items[0].metadata.name}')
echo "Found SurrealDB pod: $POD_NAME"

# Get credentials from secrets or environment
SURREAL_USER="${SURREALDB_USERNAME:-root}"
SURREAL_PASS="${SURREALDB_PASSWORD:-$(kubectl get secret -n activity-system surrealdb-auth -o jsonpath='{.data.password}' 2>/dev/null | base64 -d)}"
SURREAL_NS="${SURREALDB_NAMESPACE:-activity-system}"
SURREAL_DB="${SURREALDB_DATABASE:-learning_loop}"

if [ -z "$SURREAL_PASS" ]; then
    echo "❌ Error: Could not retrieve SurrealDB password"
    echo "Set SURREALDB_PASSWORD environment variable"
    exit 1
fi

echo "Target namespace: $SURREAL_NS, database: $SURREAL_DB"

# Confirm before proceeding
echo ""
echo "⚠️  This will import data into PRODUCTION"
read -p "Type 'import' to continue: " CONFIRM
if [ "$CONFIRM" != "import" ]; then
    echo "Aborted."
    exit 1
fi

# Copy backup file to pod
echo "Copying backup to pod..."
kubectl cp "$BACKUP_FILE" "activity-system/${POD_NAME}:/tmp/import.surql"

# Import data
echo "Running import inside pod..."
kubectl exec -n activity-system "$POD_NAME" -- \
    surreal import \
    --conn http://localhost:8000 \
    --user "$SURREAL_USER" \
    --pass "$SURREAL_PASS" \
    --ns "$SURREAL_NS" \
    --db "$SURREAL_DB" \
    /tmp/import.surql

# Clean up
kubectl exec -n activity-system "$POD_NAME" -- rm -f /tmp/import.surql

echo ""
echo "✅ Import successful!"
echo ""
echo "=== Verify Data ==="
echo "Run queries to verify data was imported:"
echo ""
echo "kubectl exec -n activity-system $POD_NAME -- surreal sql \\"
echo "  --conn http://localhost:8000 \\"
echo "  --user $SURREAL_USER --pass [REDACTED] \\"
echo "  --ns $SURREAL_NS --db $SURREAL_DB \\"
echo "  --command 'INFO FOR DB;'"
