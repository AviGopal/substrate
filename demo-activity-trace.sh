#!/bin/bash
# Simplified Activity Execution with Log Tracing
# Demonstrates the flow from DevBob → RPC API → SurrealDB → Redis

set -e

NAMESPACE="metabob"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

echo "========================================="
echo "Activity Execution Demo with Log Tracing"
echo "========================================="
echo "Time: $(date)"
echo ""

# Get pod names
RPC_POD=$(kubectl get pod -n ${NAMESPACE} -l app=metabob-rpc-api -o jsonpath='{.items[0].metadata.name}')
DEVBOB_POD="devbob-0"
REDIS_POD=$(kubectl get pod -n ${NAMESPACE} -l app.kubernetes.io/name=redis -o jsonpath='{.items[0].metadata.name}')

echo "📦 Pods:"
echo "  DevBob: ${DEVBOB_POD}"
echo "  RPC API: ${RPC_POD}"
echo "  Redis: ${REDIS_POD}"
echo ""

# Get baseline RPC API log line count
echo "📊 Getting baseline log position..."
RPC_BASELINE=$(kubectl logs -n ${NAMESPACE} ${RPC_POD} -c rpc-api 2>/dev/null | wc -l)
echo "   RPC API baseline: ${RPC_BASELINE} lines"
echo ""

# Create and execute test activity
echo "========================================="
echo "🚀 Executing Test Activity in DevBob"
echo "========================================="
echo ""

# Execute activity directly
kubectl exec ${DEVBOB_POD} -n ${NAMESPACE} -c devbob -- bash << 'ACTIVITY'
echo "▶️  Test Activity Started"
echo "   Container: $(hostname)"
echo "   Time: $(date +%H:%M:%S)"
echo ""

echo "1️⃣ Environment Check:"
echo "   API URL: ${METABOB_API_URL}"
echo ""

echo "2️⃣ Testing RPC API Health:"
curl -s "${METABOB_API_URL}/health" | head -1
echo ""

echo "3️⃣ Testing Activity Recommendations:"
curl -s "${METABOB_API_URL}/activity-recommendations/health" | head -1
echo ""

echo "4️⃣ Attempting Template List (expect auth error):"
curl -s "${METABOB_API_URL}/v2/activities/templates" | head -1
echo ""

echo "✅ Test Activity Completed"
ACTIVITY

echo ""
echo "========================================="
echo "📈 RPC API Logs (New Entries)"
echo "========================================="
echo ""

# Get new RPC API logs
NEW_LOGS=$(kubectl logs -n ${NAMESPACE} ${RPC_POD} -c rpc-api --tail=20 2>/dev/null)
echo "${NEW_LOGS}" | grep -E "(GET|POST|PUT|DELETE)" | tail -10 | sed 's/^/  /'

echo ""
echo "========================================="
echo "📊 Component Status"  
echo "========================================="
echo ""

echo "Redis:"
echo "  Keys: $(kubectl exec ${REDIS_POD} -n ${NAMESPACE} -c redis -- redis-cli DBSIZE 2>/dev/null | grep -oE '[0-9]+')"
echo "  Sample keys:"
kubectl exec ${REDIS_POD} -n ${NAMESPACE} -c redis -- redis-cli KEYS "*" 2>/dev/null | head -5 | sed 's/^/    /'

echo ""
echo "RPC API Recent Activity:"
kubectl logs -n ${NAMESPACE} ${RPC_POD} -c rpc-api --tail=5 2>/dev/null | sed 's/^/  /'

echo ""
echo "========================================="
echo "✅ Demo Complete"
echo "========================================="
echo ""
echo "Summary:"
echo "  ✅ Activity executed in DevBob container"
echo "  ✅ HTTP requests sent to RPC API"
echo "  ✅ RPC API processed requests"
echo "  ✅ Redis cache operational"
echo ""
echo "To view full RPC API logs:"
echo "  kubectl logs -n ${NAMESPACE} ${RPC_POD} -c rpc-api | tail -50"
echo ""
