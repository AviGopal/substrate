#!/bin/bash
# Quick Start: K8s DevBob Testing
# Resume testing from where we left off

set -e

echo "========================================="
echo "DevBob K8s Quick Start"
echo "========================================="
echo

# Configuration
NAMESPACE="metabob"
RPC_POD=$(kubectl get pod -n ${NAMESPACE} -l app=metabob-rpc-api -o jsonpath='{.items[0].metadata.name}')
RPC_IP=$(kubectl get pod ${RPC_POD} -n ${NAMESPACE} -o jsonpath='{.status.podIP}')

echo "📦 Current Environment:"
echo "  Namespace: ${NAMESPACE}"
echo "  RPC API Pod: ${RPC_POD}"
echo "  RPC API IP: ${RPC_IP}:8080"
echo

# Verify infrastructure
echo "1️⃣ Verifying infrastructure..."
kubectl get pods -n ${NAMESPACE} | grep -E "(devbob|metabob-rpc-api|surrealdb|redis)" | grep "Running" > /dev/null 2>&1

if [ $? -eq 0 ]; then
    echo "   ✅ All services running"
else
    echo "   ❌ Some services not running!"
    kubectl get pods -n ${NAMESPACE}
    exit 1
fi

# Check RPC API health
echo ""
echo "2️⃣ Checking RPC API health..."
HEALTH=$(kubectl exec devbob-0 -n ${NAMESPACE} -c devbob -- curl -s "http://${RPC_IP}:8080/health" 2>/dev/null)

if [[ $HEALTH == *"ok"* ]]; then
    echo "   ✅ RPC API is healthy"
    echo "   Response: ${HEALTH}"
else
    echo "   ❌ RPC API health check failed!"
    echo "   Response: ${HEALTH}"
    exit 1
fi

echo ""
echo "========================================="
echo "✅ Environment Ready!"
echo "========================================="
echo
echo "📋 Available Commands:"
echo
echo "# Access DevBob pod:"
echo "kubectl exec -it devbob-0 -n ${NAMESPACE} -c devbob -- bash"
echo
echo "# View RPC API logs:"
echo "kubectl logs -f -n ${NAMESPACE} ${RPC_POD} -c rpc-api"
echo
echo "# Test RPC API endpoint:"
echo "kubectl exec devbob-0 -n ${NAMESPACE} -c devbob -- \\"
echo "  curl -s 'http://${RPC_IP}:8080/v2/activities/templates'"
echo
echo "# View API documentation:"
echo "kubectl exec devbob-0 -n ${NAMESPACE} -c devbob -- \\"
echo "  curl -s 'http://${RPC_IP}:8080/docs' | head -30"
echo
echo "# Query SurrealDB:"
echo "kubectl exec -it surrealdb-7db6d6d85c-7s2c5 -n ${NAMESPACE} -c surrealdb -- \\"
echo "  surreal sql --conn http://localhost:8000 \\"
echo "    --user root --pass root --ns metabob --db production \\"
echo "    'SELECT * FROM activities LIMIT 5;'"
echo
echo "========================================="
echo "🎯 Next Steps:"
echo "1. Test activity template submission"
echo "2. Verify data persistence in SurrealDB"
echo "3. Test boredom detection workflow"
echo "========================================="
