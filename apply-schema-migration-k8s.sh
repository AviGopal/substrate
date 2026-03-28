#!/bin/bash
echo "=== Applying SurrealDB Schema Migration for Scope Support ==="
echo ""

echo "Step 1: Apply schema changes via HTTP API..."
kubectl exec devbob-0 -n metabob -c devbob -- bash -c '
curl -s -X POST http://surrealdb:8000/sql \
  -u "root:root" \
  -H "Content-Type: application/json" \
  -d "{
    \"ns\": \"metabob\",
    \"db\": \"production\",
    \"query\": \"DEFINE FIELD scope ON activity_template TYPE string DEFAULT '\''org'\''; DEFINE FIELD org_id ON activity_template TYPE string; DEFINE INDEX activity_template_org_idx ON activity_template FIELDS org_id;\"
  }"
' | python3 -m json.tool

echo ""
echo "Step 2: Verify schema changes..."
kubectl exec devbob-0 -n metabob -c devbob -- bash -c '
curl -s -X POST http://surrealdb:8000/sql \
  -u "root:root" \
  -H "Content-Type: application/json" \
  -d "{
    \"ns\": \"metabob\",
    \"db\": \"production\",
    \"query\": \"INFO FOR TABLE activity_template;\"
  }"
' | python3 -m json.tool | grep -E "scope|org_id" | head -20

echo ""
echo "✅ Schema migration complete!"
echo ""
echo "Note: Backend code changes require Docker image rebuild"
echo "For full deployment, use: ./deploy-activity-template-scope-fix.sh"
