#!/bin/bash
# Export mission-critical data from local development SurrealDB

set -e

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="./backups"
BACKUP_FILE="$BACKUP_DIR/surrealdb-local-${TIMESTAMP}.surql"

echo "=== Exporting Local Development SurrealDB ==="
echo "Backup will be saved to: $BACKUP_FILE"

# Create backups directory
mkdir -p "$BACKUP_DIR"

# Check if local SurrealDB is running
echo "Checking if local SurrealDB is accessible..."
if ! kubectl get pods -n activity-system -l app.kubernetes.io/name=surrealdb &>/dev/null; then
    echo "❌ Error: SurrealDB not found in activity-system namespace"
    echo "Make sure your kubectl context is set to docker-desktop"
    exit 1
fi

# Get SurrealDB pod name
POD_NAME=$(kubectl get pods -n activity-system -l app.kubernetes.io/name=surrealdb -o jsonpath='{.items[0].metadata.name}')
echo "Found SurrealDB pod: $POD_NAME"

# Get SurrealDB credentials from environment or defaults
SURREAL_USER="${SURREALDB_USERNAME:-root}"
SURREAL_PASS="${SURREALDB_PASSWORD:-surrealdb-local-dev-123}"
SURREAL_NS="${SURREALDB_NAMESPACE:-activity-system}"
SURREAL_DB="${SURREALDB_DATABASE:-learning_loop}"

echo "Exporting namespace: $SURREAL_NS, database: $SURREAL_DB"

# Export to pod's /tmp directory first
echo "Running export inside pod..."
kubectl exec -n activity-system "$POD_NAME" -- \
    surreal export \
    --conn http://localhost:8000 \
    --user "$SURREAL_USER" \
    --pass "$SURREAL_PASS" \
    --ns "$SURREAL_NS" \
    --db "$SURREAL_DB" \
    /tmp/backup.surql

# Copy from pod to local
echo "Copying backup from pod to local filesystem..."
kubectl cp "activity-system/${POD_NAME}:/tmp/backup.surql" "$BACKUP_FILE"

# Verify backup exists and has content
if [ -f "$BACKUP_FILE" ]; then
    SIZE=$(wc -c < "$BACKUP_FILE")
    LINES=$(wc -l < "$BACKUP_FILE")
    echo ""
    echo "✅ Export successful!"
    echo "   File: $BACKUP_FILE"
    echo "   Size: $SIZE bytes"
    echo "   Lines: $LINES"
    echo ""
    echo "Preview (first 10 lines):"
    head -10 "$BACKUP_FILE"
else
    echo "❌ Error: Backup file not created"
    exit 1
fi

# Clean up pod's /tmp
kubectl exec -n activity-system "$POD_NAME" -- rm -f /tmp/backup.surql

echo ""
echo "=== Next Steps ==="
echo "1. Verify backup contents: less $BACKUP_FILE"
echo "2. Copy to safe location: cp $BACKUP_FILE /path/to/safe/storage/"
echo "3. Ready for production import"
