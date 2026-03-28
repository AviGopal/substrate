#!/bin/bash
echo "=== Applying SurrealDB Schema Migration (Multiple Methods) ==="
echo ""

echo "Method 1: Port-forward and use local curl..."
echo "Starting port-forward in background..."
kubectl port-forward -n metabob svc/surrealdb 8000:8000 &
PF_PID=$!
sleep 3

echo "Applying schema via localhost..."
curl -X POST http://localhost:8000/sql \
  -u "root:root" \
  --data-binary @- <<'SQL'
USE NS metabob DB production;
DEFINE FIELD scope ON activity_template TYPE string DEFAULT 'org';
DEFINE FIELD org_id ON activity_template TYPE string;
DEFINE INDEX activity_template_org_idx ON activity_template FIELDS org_id;
INFO FOR TABLE activity_template;
SQL

echo ""
echo "Killing port-forward..."
kill $PF_PID 2>/dev/null
wait $PF_PID 2>/dev/null

echo ""
echo "Method 2: Direct exec with sh -c and heredoc..."
kubectl exec -n metabob svc/surrealdb -- sh -c '
curl -X POST http://localhost:8000/sql \
  -u "root:root" \
  --data-binary @- <<SQL
USE NS metabob DB production;
DEFINE FIELD scope ON activity_template TYPE string DEFAULT '\''org'\'';
DEFINE FIELD org_id ON activity_template TYPE string;
DEFINE INDEX activity_template_org_idx ON activity_template FIELDS org_id;
SELECT * FROM activity_template LIMIT 1;
SQL
' 2>&1 | head -50

echo ""
echo "Verification: Query existing templates..."
TOKEN="c2Vzc2lvbnM6MzEzNTg4M2MtOGJlMy00YjJiLWJkZDgtZGJlMmU0MjczNThmOmRlZmF1bHQ6NWY4ODcyMDMtZDEwZi00YTQ5LTlmMGEtMGY5OTRkZTQ4YWEw"
kubectl exec devbob-0 -n metabob -c devbob -- bash -c "
curl -s 'http://metabob-rpc-api:8080/v2/activities/templates/infrastructure-cbfca84f' \
  -H 'Authorization: Bearer $TOKEN'
" | python3 -c "import sys, json; d=json.load(sys.stdin); print(f'Template: {d.get(\"name\", \"unknown\")}'); print(f'Has scope field: {\"scope\" in d}'); print(f'Has org_id field: {\"org_id\" in d}')"

echo ""
echo "✅ Schema migration attempted"
