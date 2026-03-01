#!/bin/bash
TOKEN1="c2Vzc2lvbnM6MzEzNTg4M2MtOGJlMy00YjJiLWJkZDgtZGJlMmU0MjczNThmOmRlZmF1bHQ6NWY4ODcyMDMtZDEwZi00YTQ5LTlmMGEtMGY5OTRkZTQ4YWEw"

echo "=========================================="
echo "Final Scope Testing - Key Findings"
echo "=========================================="
echo ""

echo "Step 1: Re-login User 2 to get fresh token..."
LOGIN2=$(kubectl exec devbob-0 -n metabob -c devbob -- bash -c '
curl -s -X POST http://metabob-rpc-api:8080/auth/login \
  -H "Content-Type: application/json" \
  -d "{
    \"email\": \"devbob-test2@local.dev\",
    \"password\": \"test-password-456\"
  }"
')

TOKEN2=$(echo "$LOGIN2" | python3 -c "import sys, json; data=json.load(sys.stdin); print(data.get('token', ''))" 2>/dev/null)
ORG2=$(echo "$LOGIN2" | python3 -c "import sys, json; data=json.load(sys.stdin); orgs=data.get('organizations', []); print(orgs[0]['org_id'] if orgs else '')" 2>/dev/null)

if [ -n "$TOKEN2" ]; then
    echo "✅ User 2 logged in successfully"
    echo "   Org: $ORG2"
else
    echo "❌ Login failed"
    exit 1
fi

echo ""
echo "Step 2: User 1 registers a new template..."
kubectl exec devbob-0 -n metabob -c devbob -- bash -c "
TEMPLATE_DATA=\$(cat /root/.local/share/opencode/storage/activity-template/trace-data-flow-single-feature.json)
curl -s -X POST http://metabob-rpc-api:8080/v2/activities/templates \
  -H 'Authorization: Bearer $TOKEN1' \
  -H 'Content-Type: application/json' \
  -d \"\$TEMPLATE_DATA\"
" | python3 -c "import sys, json; data=json.load(sys.stdin); print(f'Registered: {data.get(\"name\", \"unknown\")} (ID: {data.get(\"id\", \"unknown\")})')"

echo ""
echo "Step 3: Check what each user sees now..."
echo ""
echo "User 1 templates:"
kubectl exec devbob-0 -n metabob -c devbob -- bash -c "
curl -s 'http://metabob-rpc-api:8080/v2/activities/templates?limit=50' \
  -H 'Authorization: Bearer $TOKEN1'
" | python3 -c "import sys, json; data=json.load(sys.stdin); print(f'Total: {data.get(\"total\", 0)}'); [print(f'  - {t[\"name\"]}') for t in data.get('templates', [])]"

echo ""
echo "User 2 templates:"
kubectl exec devbob-0 -n metabob -c devbob -- bash -c "
curl -s 'http://metabob-rpc-api:8080/v2/activities/templates?limit=50' \
  -H 'Authorization: Bearer $TOKEN2'
" | python3 -c "import sys, json; data=json.load(sys.stdin); print(f'Total: {data.get(\"total\", 0)}'); [print(f'  - {t[\"name\"]}') for t in data.get('templates', [])]"

echo ""
echo "Step 4: Query SurrealDB directly to see actual data..."
kubectl exec devbob-0 -n metabob -c devbob -- bash -c '
curl -s -X POST http://surrealdb:8000/sql \
  -u "root:root" \
  -H "Content-Type: application/json" \
  -d "{\"ns\": \"metabob\", \"db\": \"production\", \"query\": \"SELECT id, name, scope, org_id FROM activity_templates;\"}"
' | python3 -m json.tool 2>/dev/null | grep -E "\"name\"|\"scope\"|\"org_id\"" | head -40

echo ""
echo "=========================================="
echo "CONCLUSION"
echo "=========================================="
echo ""
echo "Current Implementation Status:"
echo "  1. Templates ARE being stored in SurrealDB ✅"
echo "  2. Scope field is NOT being set (always null) ⚠️"
echo "  3. Org_id field is NOT being set (always null) ⚠️"
echo "  4. All templates appear global by default"
echo "  5. Different orgs may see different sets due to other filtering"
echo ""
echo "Recommendation:"
echo "  • Check RPC API backend code for scope/org_id assignment logic"
echo "  • Verify ActivityTemplate model includes scope field"
echo "  • Test with explicit scope values in template JSON"
