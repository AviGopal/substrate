#!/bin/bash
# Validate SurrealDB Data Flow in Kubernetes
# Verifies that activity execution data flows properly through the K8s environment
set -e

NAMESPACE=${1:-metabob}
SURREALDB_POD=$(kubectl get pods -n $NAMESPACE -o name | grep surrealdb | head -1 | cut -d/ -f2)
DEVBOB_POD=$(kubectl get pods -n $NAMESPACE -o name | grep devbob | head -1 | cut -d/ -f2)

echo "================================================"
echo "K8s Data Flow Validation Report"
echo "================================================"
echo "Namespace: $NAMESPACE"
echo "SurrealDB Pod: $SURREALDB_POD"
echo "DevBob Pod: $DEVBOB_POD"
echo "================================================"

# 1. Verify SurrealDB service is running
echo ""
echo "[1/6] Verifying SurrealDB service..."
kubectl get svc -n $NAMESPACE surrealdb -o wide

# 2. Check schema initialization
echo ""
echo "[2/6] Checking database schema..."
kubectl port-forward -n $NAMESPACE svc/surrealdb 8001:8000 >/dev/null 2>&1 &
PF_PID=$!
sleep 2

TABLES=$(curl -s -X POST 'http://localhost:8001/sql' \
  -H 'Accept: application/json' \
  -u 'root:root' \
  --data 'USE NS metabob; USE DB devbob; INFO FOR DB;' | jq -r '.[2].result.tables | keys[]')

echo "Tables found:"
echo "$TABLES" | while read table; do echo "  - $table"; done

# 3. Query activity_execution table
echo ""
echo "[3/6] Querying activity_execution table..."
ACTIVITY_COUNT=$(curl -s -X POST 'http://localhost:8001/sql' \
  -H 'Accept: application/json' \
  -u 'root:root' \
  --data 'USE NS metabob; USE DB devbob; SELECT count() FROM activity_execution GROUP ALL;' | jq -r '.[2].result[0].count // 0')

echo "Activity executions recorded: $ACTIVITY_COUNT"

if [ "$ACTIVITY_COUNT" -gt 0 ]; then
  echo ""
  echo "Recent executions:"
  curl -s -X POST 'http://localhost:8001/sql' \
    -H 'Accept: application/json' \
    -u 'root:root' \
    --data 'USE NS metabob; USE DB devbob; SELECT template_id, success, duration_ms, cost_usd, created_at FROM activity_execution ORDER BY created_at DESC LIMIT 5;' | jq -r '.[2].result[] | "  - \(.template_id): \(if .success then "✓" else "✗" end) (\(.duration_ms)ms, $\(.cost_usd))"'
fi

# 4. Query template_metrics table
echo ""
echo "[4/6] Querying template_metrics table..."
TEMPLATE_COUNT=$(curl -s -X POST 'http://localhost:8001/sql' \
  -H 'Accept: application/json' \
  -u 'root:root' \
  --data 'USE NS metabob; USE DB devbob; SELECT count() FROM template_metrics GROUP ALL;' | jq -r '.[2].result[0].count // 0')

echo "Templates with metrics: $TEMPLATE_COUNT"

if [ "$TEMPLATE_COUNT" -gt 0 ]; then
  echo ""
  echo "Top templates by success rate:"
  curl -s -X POST 'http://localhost:8001/sql' \
    -H 'Accept: application/json' \
    -u 'root:root' \
    --data 'USE NS metabob; USE DB devbob; SELECT template_id, total_executions, success_count, (success_count / total_executions * 100) AS success_rate FROM template_metrics ORDER BY success_rate DESC LIMIT 5;' | jq -r '.[2].result[] | "  - \(.template_id): \(.success_rate)% (\(.success_count)/\(.total_executions))"'
fi

# 5. Check DevBob logs for SurrealDB connections
echo ""
echo "[5/6] Checking DevBob logs for database activity..."
kubectl logs -n $NAMESPACE $DEVBOB_POD -c devbob --tail=100 | grep -i "surrealdb\|activity.*saved\|execution.*recorded" | tail -10 || echo "  No recent database activity in logs"

# 6. Verify Redis connection (used for session state)
echo ""
echo "[6/6] Verifying Redis connectivity..."
kubectl exec -n $NAMESPACE $DEVBOB_POD -c devbob -- timeout 2 nc -zv redis-master 6379 2>&1 | grep -i "open\|succeeded" || echo "  Redis connection check failed"

# Cleanup
kill $PF_PID 2>/dev/null
wait $PF_PID 2>/dev/null

echo ""
echo "================================================"
echo "Summary:"
echo "  - Schema: ✓ Initialized with $(echo "$TABLES" | wc -w) tables"
echo "  - Activity Executions: $ACTIVITY_COUNT records"
echo "  - Template Metrics: $TEMPLATE_COUNT templates"
echo "================================================"

# Recommendations
echo ""
echo "To record activity data in K8s SurrealDB:"
echo "  1. Run OpenCode activities from within devbob pod:"
echo "     kubectl exec -it -n $NAMESPACE $DEVBOB_POD -c devbob -- opencode activity ..."
echo ""
echo "  2. Or configure local OpenCode to use K8s SurrealDB:"
echo "     export SURREALDB_URL=http://localhost:8001"
echo "     kubectl port-forward -n $NAMESPACE svc/surrealdb 8001:8000"
echo "     opencode activity ..."
echo ""
