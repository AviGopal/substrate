#!/bin/bash
set -e

echo "=========================================================================="
echo "Applying Learning System Phase 1.1-1.6 Schema Migration"
echo "=========================================================================="
echo

# Get SurrealDB connection info
SURREALDB_POD=$(kubectl get pods -n activity-system -l app=surrealdb -o name | head -1)
if [ -z "$SURREALDB_POD" ]; then
  echo "❌ SurrealDB pod not found in activity-system namespace"
  exit 1
fi

echo "✓ Found SurrealDB pod: $SURREALDB_POD"
echo

# Read migration file
MIGRATION_FILE="repos/metabob-activity-api/sql/002-learning-system-phase1.surql"
if [ ! -f "$MIGRATION_FILE" ]; then
  echo "❌ Migration file not found: $MIGRATION_FILE"
  exit 1
fi

echo "✓ Migration file: $MIGRATION_FILE"
echo

# Apply migration via kubectl exec
echo "Applying migration to SurrealDB..."
echo "----------------------------------------"

kubectl exec -n activity-system "$SURREALDB_POD" -c surrealdb -- \
  surreal sql \
  --endpoint http://localhost:8000 \
  --namespace activity-system \
  --database learning_loop \
  --username root \
  --password root \
  --pretty \
  < "$MIGRATION_FILE"

RESULT=$?

echo "----------------------------------------"
echo

if [ $RESULT -eq 0 ]; then
  echo "✅ Migration applied successfully"
  echo
  echo "Created tables:"
  echo "  - activity_composition_graph (Phase 1.1-1.2)"
  echo "  - impulse_relevance_metrics (Phase 1.3)"
  echo "  - tool_usage_patterns (Phase 1.5)"
else
  echo "❌ Migration failed with exit code: $RESULT"
  exit $RESULT
fi

echo
echo "=========================================================================="
echo "Verifying tables..."
echo "=========================================================================="
echo

# Verify tables exist
kubectl exec -n activity-system "$SURREALDB_POD" -c surrealdb -- \
  surreal sql \
  --endpoint http://localhost:8000 \
  --namespace activity-system \
  --database learning_loop \
  --username root \
  --password root \
  --pretty \
  <<EOF
INFO FOR TABLE activity_composition_graph;
INFO FOR TABLE impulse_relevance_metrics;
INFO FOR TABLE tool_usage_patterns;
EOF

echo
echo "✅ Migration complete and verified"
