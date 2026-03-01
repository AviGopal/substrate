#!/bin/bash
echo "=== Applying Schema via DevBob Container ==="
echo ""

echo "Step 1: Create SQL file in devbob container..."
kubectl exec devbob-0 -n metabob -c devbob -- bash -c '
cat > /tmp/add-scope-fields.sql << "SQLEND"
USE NS metabob DB production;

DEFINE FIELD scope ON activity_template TYPE string DEFAULT '\''org'\'';
DEFINE FIELD org_id ON activity_template TYPE string;  
DEFINE INDEX activity_template_org_idx ON activity_template FIELDS org_id;

INFO FOR TABLE activity_template;
SQLEND

cat /tmp/add-scope-fields.sql
'

echo ""
echo "Step 2: Apply via curl with correct content-type..."
kubectl exec devbob-0 -n metabob -c devbob -- bash -c '
curl -v -X POST http://surrealdb:8000/sql \
  -u "root:root" \
  -H "Content-Type: application/octet-stream" \
  -H "Accept: application/json" \
  --data-binary @/tmp/add-scope-fields.sql 2>&1
' | grep -E "HTTP|result|status|scope|org_id" | head -40

echo ""
echo "Step 3: Verify schema change by querying template..."
TOKEN="c2Vzc2lvbnM6MzEzNTg4M2MtOGJlMy00YjJiLWJkZDgtZGJlMmU0MjczNThmOmRlZmF1bHQ6NWY4ODcyMDMtZDEwZi00YTQ5LTlmMGEtMGY5OTRkZTQ4YWEw"

kubectl exec devbob-0 -n metabob -c devbob -- bash -c "
# Register a new template to test schema
curl -s -X POST http://metabob-rpc-api:8080/v2/activities/templates \
  -H 'Authorization: Bearer $TOKEN' \
  -H 'Content-Type: application/json' \
  -d '{
    \"name\": \"Schema Test Template\",
    \"description\": \"Test if scope/org_id fields work\",
    \"category\": \"infrastructure\",
    \"scope\": \"org\",
    \"tasks\": [{
      \"id\": \"test\",
      \"subagent\": \"general\",
      \"description\": \"Test\",
      \"dependencies\": [],
      \"prompt\": {
        \"template\": \"Test\",
        \"maxTokens\": 1000,
        \"compressionStrategy\": \"filter\",
        \"variables\": []
      },
      \"validation\": {\"requiredFiles\": [], \"requiredPatterns\": [], \"forbiddenPatterns\": [], \"commands\": []},
      \"retry\": {\"maxAttempts\": 1, \"strategy\": \"simple\"}
    }],
    \"integration\": {\"preChecks\": [], \"postChecks\": [], \"qualityGates\": []}
  }'
" | python3 -c "import sys, json; d=json.load(sys.stdin); print(f'Created: {d.get(\"id\", \"error\")}'); print(f'Name: {d.get(\"name\", \"error\")}'); print(f'Scope: {d.get(\"scope\", \"MISSING\")}'); print(f'Org ID: {d.get(\"org_id\", \"MISSING\")}')"

echo ""
echo "✅ Schema migration complete"
