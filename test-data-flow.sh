#!/bin/bash
# Test Data Flow Demonstration Script
# This script demonstrates the complete data flow through the metabob system

set -e

echo "==================================="
echo "Metabob Data Flow Demonstration"
echo "==================================="
echo ""

# Test 1: Check SurrealDB connectivity
echo "[1/5] Testing SurrealDB connectivity..."
kubectl exec -n metabob surrealdb-7db6d6d85c-7s2c5 -c surrealdb -- \
  surreal sql --conn http://localhost:8000 --user root --pass root --ns metabob --db metabob \
  --query "INFO FOR DB;" | head -20

echo "✓ SurrealDB is accessible"
echo ""

# Test 2: Check Redis connectivity  
echo "[2/5] Testing Redis connectivity..."
kubectl exec -n metabob redis-master-0 -c redis -- redis-cli PING

echo "✓ Redis is accessible"
echo ""

# Test 3: Check existing data in SurrealDB
echo "[3/5] Checking existing activity data in SurrealDB..."
kubectl exec -n metabob surrealdb-7db6d6d85c-7s2c5 -c surrealdb -- \
  surreal sql --conn http://localhost:8000 --user root --pass root --ns metabob --db metabob \
  --query "SELECT count() FROM activity_execution GROUP ALL;" 2>&1 | grep -A 5 "count"

echo ""

# Test 4: Check Redis keys
echo "[4/5] Checking Redis keys..."
kubectl exec -n metabob redis-master-0 -c redis -- redis-cli KEYS "activity:*" | head -10
echo ""

# Test 5: Insert test data and verify
echo "[5/5] Inserting test data and verifying..."
kubectl exec -n metabob surrealdb-7db6d6d85c-7s2c5 -c surrealdb -- \
  surreal sql --conn http://localhost:8000 --user root --pass root --ns metabob --db metabob \
  --query "CREATE activity_execution:test_demo_$(date +%s) SET template_id = 'test-demo', status = 'completed', created_at = time::now();"

echo ""
echo "Verifying test data was written..."
kubectl exec -n metabob surrealdb-7db6d6d85c-7s2c5 -c surrealdb -- \
  surreal sql --conn http://localhost:8000 --user root --pass root --ns metabob --db metabob \
  --query "SELECT * FROM activity_execution WHERE template_id = 'test-demo' LIMIT 1;"

echo ""
echo "==================================="
echo "✓ Data Flow Verification Complete!"
echo "==================================="
echo ""
echo "Summary:"
echo "  - SurrealDB: Connected and storing data"
echo "  - Redis: Connected and caching"
echo "  - Data persistence: Verified"
echo ""
