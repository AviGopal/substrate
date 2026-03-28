#!/bin/bash
echo "=== Testing SurrealDB Data Persistence ==="
echo ""
echo "1. Check SurrealDB connection and databases..."
kubectl exec -it surrealdb-7db6d6d85c-7s2c5 -n metabob -c surrealdb -- \
  surreal sql --conn http://localhost:8000 \
  --user root --pass root --ns metabob --db production \
  --pretty \
  'INFO FOR DB;' 2>&1 | head -40

echo ""
echo "2. Query activity_templates table..."
kubectl exec -it surrealdb-7db6d6d85c-7s2c5 -n metabob -c surrealdb -- \
  surreal sql --conn http://localhost:8000 \
  --user root --pass root --ns metabob --db production \
  --pretty \
  'SELECT * FROM activity_templates LIMIT 5;' 2>&1

echo ""
echo "3. Query activities table..."
kubectl exec -it surrealdb-7db6d6d85c-7s2c5 -n metabob -c surrealdb -- \
  surreal sql --conn http://localhost:8000 \
  --user root --pass root --ns metabob --db production \
  --pretty \
  'SELECT * FROM activities LIMIT 5;' 2>&1

echo ""
echo "4. Check all tables in database..."
kubectl exec -it surrealdb-7db6d6d85c-7s2c5 -n metabob -c surrealdb -- \
  surreal sql --conn http://localhost:8000 \
  --user root --pass root --ns metabob --db production \
  --pretty \
  'INFO FOR TABLE activity_templates;' 2>&1 | head -20
