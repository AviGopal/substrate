#!/bin/bash
set -e

echo "=========================================================================="
echo "Applying Learning System Phase 1.1-1.6 Schema Migration via HTTP"
echo "=========================================================================="
echo

# SurrealDB endpoint (via port-forward or service)
SURREALDB_URL="http://api.minibob.local"

# Check if we need to use kubectl port-forward
if ! curl -s "$SURREALDB_URL/health" > /dev/null 2>&1; then
  echo "Using kubectl port-forward to SurrealDB..."
  SURREALDB_POD=$(kubectl get pods -n activity-system -l app=surrealdb -o jsonpath='{.items[0].metadata.name}')
  kubectl port-forward -n activity-system "pod/$SURREALDB_POD" 8001:8000 &
  PF_PID=$!
  trap "kill $PF_PID 2>/dev/null || true" EXIT
  sleep 2
  SURREALDB_URL="http://localhost:8001"
fi

# Read migration file
MIGRATION_FILE="repos/metabob-activity-api/sql/002-learning-system-phase1.surql"
if [ ! -f "$MIGRATION_FILE" ]; then
  echo "❌ Migration file not found: $MIGRATION_FILE"
  exit 1
fi

echo "✓ Migration file: $MIGRATION_FILE"
echo "✓ SurrealDB URL: $SURREALDB_URL"
echo

# Apply migration via HTTP API
echo "Applying migration..."
echo "----------------------------------------"

curl -X POST "$SURREALDB_URL/sql" \
  -H "Content-Type: application/json" \
  -H "surreal-ns: activity-system" \
  -H "surreal-db: learning_loop" \
  -u "root:root" \
  --data-binary "@$MIGRATION_FILE" \
  | jq .

echo "----------------------------------------"
echo "✅ Migration applied"
echo
