#!/bin/bash
# Test analytics endpoint with schema-aligned queries

RPC_POD=$(kubectl get pods -n metabob -l app=metabob-rpc-api -o jsonpath='{.items[0].metadata.name}')

echo "=== Testing Analytics Endpoint Schema Alignment ==="
echo ""
echo "Executing query directly in SurrealDB to verify schema alignment..."

# Test query that matches the updated code
kubectl exec -i -n metabob surrealdb-6ff58cbc5-lx7gc -- /surreal sql --endpoint http://localhost:8000 --username root --password changeme --namespace metabob --database devbob --json << 'SQL'
SELECT 
    started_at AS timestamp,
    execution_id,
    activity_id,
    template_id,
    success,
    duration_ms,
    cost_usd
FROM activity_executions
ORDER BY started_at DESC
LIMIT 5;
SQL

echo ""
echo "=== Schema Verification Complete ==="
echo "Note: RPC API pod needs to be updated with new code to reflect these changes in /v2/analytics/activity-history endpoint"
