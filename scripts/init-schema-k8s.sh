#!/bin/bash
# Initialize SurrealDB schema in Kubernetes
set -e

NAMESPACE=${1:-metabob}
POD=${2:-devbob-0}
SURREALDB_HOST=${3:-surrealdb:8000}

echo "Initializing SurrealDB schema in namespace: $NAMESPACE"
echo "Using pod: $POD"
echo "SurrealDB host: $SURREALDB_HOST"

# Copy schema file to pod
echo "Copying schema file to pod..."
kubectl cp initialize-surrealdb-schema.sql $NAMESPACE/$POD:/tmp/schema.sql -c devbob

# Execute schema initialization
echo "Executing schema initialization..."
kubectl exec -n $NAMESPACE $POD -c devbob -- bash -c "
  /surreal sql --conn http://$SURREALDB_HOST --user root --pass root --ns metabob --db devbob --multi < /tmp/schema.sql
" 2>&1

echo ""
echo "Verifying schema tables..."
kubectl exec -n $NAMESPACE $POD -c devbob -- bash -c "
  echo 'INFO FOR DB;' | /surreal sql --conn http://$SURREALDB_HOST --user root --pass root --ns metabob --db devbob
" 2>&1

echo ""
echo "Schema initialization complete!"
