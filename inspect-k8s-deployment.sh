#!/bin/bash
# Comprehensive K8s Deployment Inspection Script
# Purpose: Verify boredom detection, activity flow, and backend integration

set -e

echo "=========================================="
echo "K8S LOCAL DEPLOYMENT INSPECTION REPORT"
echo "=========================================="
echo ""

echo "1. CLUSTER AND POD STATUS"
echo "----------------------------------------"
kubectl config current-context
echo ""
kubectl get pods -n metabob
echo ""

echo "2. DEVBOB CONFIGURATION"
echo "----------------------------------------"
kubectl get statefulset -n metabob devbob -o jsonpath='{.spec.template.spec.containers[0].env}' | jq '.' 2>/dev/null || echo "Could not parse env"
echo ""

echo "3. SURREALDB CONNECTION TEST"
echo "----------------------------------------"
kubectl exec -n metabob devbob-0 -- curl -s http://surrealdb:8000/health && echo "✓ SurrealDB is healthy" || echo "✗ SurrealDB unreachable"
echo ""

echo "4. DATABASE SCHEMA STATUS"
echo "----------------------------------------"
SCHEMA_RESULT=$(kubectl exec -n metabob devbob-0 -- curl -s -X POST http://surrealdb:8000/sql \
  -H "Accept: application/json" \
  -H "NS: metabob" \
  -H "DB: devbob" \
  -u "root:root" \
  --data "INFO FOR DB;")
echo "$SCHEMA_RESULT" | jq '.'
echo ""

echo "5. ACTIVITY COUNT IN DATABASE"
echo "----------------------------------------"
ACTIVITY_COUNT=$(kubectl exec -n metabob devbob-0 -- curl -s -X POST http://surrealdb:8000/sql \
  -H "Accept: application/json" \
  -H "NS: metabob" \
  -H "DB: devbob" \
  -u "root:root" \
  --data "SELECT COUNT() FROM activity GROUP ALL;")
echo "$ACTIVITY_COUNT" | jq '.'
echo ""

echo "6. TEMPLATE COUNT IN DATABASE"
echo "----------------------------------------"
TEMPLATE_COUNT=$(kubectl exec -n metabob devbob-0 -- curl -s -X POST http://surrealdb:8000/sql \
  -H "Accept: application/json" \
  -H "NS: metabob" \
  -H "DB: devbob" \
  -u "root:root" \
  --data "SELECT COUNT() FROM activity_template GROUP ALL;")
echo "$TEMPLATE_COUNT" | jq '.'
echo ""

echo "7. DEVBOB LOGS (BOOTSTRAP & ACTIVITY)"
echo "----------------------------------------"
kubectl logs -n metabob devbob-0 --tail=100 | grep -E "(bootstrap|activity|template|boredom)" -i | tail -20
echo ""

echo "8. REDIS CONNECTION TEST"
echo "----------------------------------------"
kubectl exec -n metabob redis-master-0 -- redis-cli PING
kubectl exec -n metabob redis-master-0 -- redis-cli DBSIZE
echo ""

echo "9. METABOB RPC API STATUS"
echo "----------------------------------------"
kubectl get pods -n metabob | grep metabob-rpc-api
kubectl logs -n metabob -l app=metabob-rpc-api --tail=10 2>/dev/null || echo "Could not fetch logs"
echo ""

echo "=========================================="
echo "INSPECTION COMPLETE"
echo "=========================================="
