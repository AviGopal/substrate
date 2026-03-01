#!/bin/bash
echo "=== Testing SurrealDB via HTTP API ==="
echo ""
echo "1. Query database info..."
kubectl exec devbob-0 -n metabob -c devbob -- bash -c '
curl -s -X POST http://surrealdb:8000/sql \
  -H "NS: metabob" \
  -H "DB: production" \
  -H "Accept: application/json" \
  -u "root:root" \
  -d "INFO FOR DB;"
' | python3 -m json.tool 2>/dev/null || echo "JSON parsing failed"

echo ""
echo "2. Query activity_templates table..."
kubectl exec devbob-0 -n metabob -c devbob -- bash -c '
curl -s -X POST http://surrealdb:8000/sql \
  -H "NS: metabob" \
  -H "DB: production" \
  -H "Accept: application/json" \
  -u "root:root" \
  -d "SELECT * FROM activity_templates LIMIT 3;"
' | python3 -m json.tool 2>/dev/null | head -100

echo ""
echo "3. Count records in key tables..."
kubectl exec devbob-0 -n metabob -c devbob -- bash -c '
curl -s -X POST http://surrealdb:8000/sql \
  -H "NS: metabob" \
  -H "DB: production" \
  -H "Accept: application/json" \
  -u "root:root" \
  -d "SELECT count() FROM activity_templates GROUP ALL; SELECT count() FROM activities GROUP ALL; SELECT count() FROM users GROUP ALL;"
' | python3 -m json.tool 2>/dev/null | head -50
