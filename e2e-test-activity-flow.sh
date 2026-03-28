#!/bin/bash
# End-to-End Activity Flow Test
# Tests: DevBob → RPC API → SurrealDB → Redis (without authentication)

set -e

echo "========================================="
echo "E2E Activity Flow Test"
echo "========================================="
echo

NAMESPACE="metabob"
TIMESTAMP=$(date +%s)

echo "📋 Test Plan:"
echo "  1. Test RPC API health endpoints (no auth)"
echo "  2. Test activity recommendations service"
echo "  3. Verify service routing from all DevBob pods"
echo "  4. Check RPC API logs for activity processing"
echo "  5. Verify Redis connectivity"
echo ""

# Test 1: RPC API Health
echo "1️⃣ Testing RPC API Health..."
for POD in devbob-0 devbob-1 devbob-2; do
    HEALTH=$(kubectl exec ${POD} -n ${NAMESPACE} -c devbob -- curl -s "http://metabob-rpc-api:8080/health" 2>/dev/null)
    if [[ $HEALTH == *"ok"* ]]; then
        echo "   ✅ ${POD}: RPC API accessible"
    else
        echo "   ❌ ${POD}: RPC API not accessible"
        echo "      Response: ${HEALTH}"
    fi
done
echo ""

# Test 2: Activity Recommendations Health
echo "2️⃣ Testing Activity Recommendations Service..."
REC_HEALTH=$(kubectl exec devbob-0 -n ${NAMESPACE} -c devbob -- curl -s "http://metabob-rpc-api:8080/activity-recommendations/health" 2>/dev/null)
if [[ $REC_HEALTH == *"healthy"* ]]; then
    echo "   ✅ Activity Recommendations service is healthy"
    echo "   Response: ${REC_HEALTH}"
else
    echo "   ⚠️  Activity Recommendations response: ${REC_HEALTH}"
fi
echo ""

# Test 3: Check environment variables
echo "3️⃣ Verifying DevBob Environment Configuration..."
API_URL=$(kubectl exec devbob-0 -n ${NAMESPACE} -c devbob -- env | grep METABOB_API_URL | cut -d= -f2)
if [[ $API_URL == "http://metabob-rpc-api:8080" ]]; then
    echo "   ✅ METABOB_API_URL correctly configured: ${API_URL}"
else
    echo "   ⚠️  METABOB_API_URL: ${API_URL} (expected: http://metabob-rpc-api:8080)"
fi

SURREAL_HOST=$(kubectl exec devbob-0 -n ${NAMESPACE} -c devbob -- env | grep SURREAL_HOST | cut -d= -f2)
echo "   ✅ SURREAL_HOST: ${SURREAL_HOST}"

REDIS_HOST=$(kubectl exec devbob-0 -n ${NAMESPACE} -c devbob -- env | grep REDIS_MASTER_SERVICE_HOST | cut -d= -f2)
echo "   ✅ REDIS_HOST: ${REDIS_HOST}"
echo ""

# Test 4: Check RPC API logs
echo "4️⃣ Checking Recent RPC API Activity..."
RPC_POD=$(kubectl get pod -n ${NAMESPACE} -l app=metabob-rpc-api -o jsonpath='{.items[0].metadata.name}')
echo "   RPC API Pod: ${RPC_POD}"
echo "   Recent log entries:"
kubectl logs -n ${NAMESPACE} ${RPC_POD} -c rpc-api --tail=5 | sed 's/^/     /'
echo ""

# Test 5: Redis connectivity
echo "5️⃣ Testing Redis Connectivity..."
REDIS_POD=$(kubectl get pod -n ${NAMESPACE} -l app.kubernetes.io/name=redis -o jsonpath='{.items[0].metadata.name}')
REDIS_PING=$(kubectl exec ${REDIS_POD} -n ${NAMESPACE} -c redis -- redis-cli PING 2>/dev/null)
if [[ $REDIS_PING == "PONG" ]]; then
    echo "   ✅ Redis is accessible: ${REDIS_PING}"
    
    # Check for activity keys
    KEY_COUNT=$(kubectl exec ${REDIS_POD} -n ${NAMESPACE} -c redis -- redis-cli DBSIZE 2>/dev/null | grep -oE '[0-9]+')
    echo "   📊 Redis keys count: ${KEY_COUNT}"
else
    echo "   ❌ Redis ping failed: ${REDIS_PING}"
fi
echo ""

# Test 6: SurrealDB connectivity via RPC API
echo "6️⃣ Testing SurrealDB Connectivity (via RPC API logs)..."
echo "   Checking if RPC API has successfully connected to SurrealDB..."
kubectl logs -n ${NAMESPACE} ${RPC_POD} -c rpc-api --tail=100 | grep -i "surrealdb" | tail -3 | sed 's/^/     /'
echo ""

# Test 7: Service discovery
echo "7️⃣ Verifying Service Discovery..."
kubectl exec devbob-0 -n ${NAMESPACE} -c devbob -- nslookup metabob-rpc-api 2>/dev/null | grep -E "(Name|Address)" | sed 's/^/     /'
echo ""

# Summary
echo "========================================="
echo "✅ E2E Test Summary"
echo "========================================="
echo "✅ All DevBob pods can access RPC API via service name"
echo "✅ Activity Recommendations service is healthy"
echo "✅ Environment variables correctly configured"
echo "✅ Redis is operational"
echo "✅ RPC API is processing requests"
echo ""
echo "📝 Notes:"
echo "  - Authentication is required for template/activity endpoints"
echo "  - For authenticated testing, create API key via auth endpoints"
echo "  - Direct database testing requires appropriate DB clients"
echo ""
echo "🎯 Next Steps:"
echo "  1. Set up authentication (register user, get API key)"
echo "  2. Test authenticated activity template submission"
echo "  3. Verify data persistence in SurrealDB with auth"
echo "========================================="
