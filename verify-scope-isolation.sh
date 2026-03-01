#!/bin/bash
TOKEN1="c2Vzc2lvbnM6MzEzNTg4M2MtOGJlMy00YjJiLWJkZDgtZGJlMmU0MjczNThmOmRlZmF1bHQ6NWY4ODcyMDMtZDEwZi00YTQ5LTlmMGEtMGY5OTRkZTQ4YWEw"
TOKEN2="c2Vzc2lvbnM6ZTZiN2M5OWQtMWE1Yi00NDRiLTk0MzctNWM1Mzc5MzkzM2ExOmRlZmF1bHQ6MTQ3MWQ1MDktMTJmYS00M2EwLWE4NWEtZDk0YzYyN2E5ODY3"
ORG1="3135883c-8be3-4b2b-bdd8-dbe2e427358f"
ORG2="e6b7c99d-1a5b-444b-9437-5c53793933a1"

echo "=========================================="
echo "Verifying Scope Isolation"
echo "=========================================="
echo ""

echo "1. Check the org-scoped template details..."
kubectl exec devbob-0 -n metabob -c devbob -- bash -c "
curl -s 'http://metabob-rpc-api:8080/v2/activities/templates/infrastructure-313e5bea' \
  -H 'Authorization: Bearer $TOKEN1'
" | python3 -c "
import sys, json
data = json.load(sys.stdin)
print(f'Template: {data.get(\"name\", \"unknown\")}')
print(f'ID: {data.get(\"id\", \"unknown\")}')
print(f'Scope: {data.get(\"scope\", \"null\")}')
print(f'Org ID: {data.get(\"org_id\", \"null\")}')
print(f'Project ID: {data.get(\"project_id\", \"null\")}')
"

echo ""
echo "2. User 1 (Org $ORG1) template list:"
kubectl exec devbob-0 -n metabob -c devbob -- bash -c "
curl -s 'http://metabob-rpc-api:8080/v2/activities/templates?limit=50' \
  -H 'Authorization: Bearer $TOKEN1'
" | python3 -c "
import sys, json
data = json.load(sys.stdin)
print(f'Total: {data.get(\"total\", 0)} templates')
for t in data.get('templates', []):
    org = t.get('org_id', 'null')
    scope = t.get('scope', 'null')
    print(f'  • {t[\"name\"]} (scope={scope}, org={org})')
"

echo ""
echo "3. User 2 (Org $ORG2) template list:"
kubectl exec devbob-0 -n metabob -c devbob -- bash -c "
curl -s 'http://metabob-rpc-api:8080/v2/activities/templates?limit=50' \
  -H 'Authorization: Bearer $TOKEN2'
" | python3 -c "
import sys, json
data = json.load(sys.stdin)
print(f'Total: {data.get(\"total\", 0)} templates')
for t in data.get('templates', []):
    org = t.get('org_id', 'null')
    scope = t.get('scope', 'null')
    print(f'  • {t[\"name\"]} (scope={scope}, org={org})')
"

echo ""
echo "4. Can User 2 access User 1's org-scoped template?"
RESULT=$(kubectl exec devbob-0 -n metabob -c devbob -- bash -c "
curl -s -w '\nHTTP_CODE:%{http_code}' \
  'http://metabob-rpc-api:8080/v2/activities/templates/infrastructure-313e5bea' \
  -H 'Authorization: Bearer $TOKEN2'
")

HTTP_CODE=$(echo "$RESULT" | grep "HTTP_CODE:" | cut -d: -f2)
RESPONSE=$(echo "$RESULT" | grep -v "HTTP_CODE:")

if [ "$HTTP_CODE" = "200" ]; then
    echo "❌ ISOLATION FAILURE: User 2 can access User 1's org-scoped template!"
    echo "$RESPONSE" | python3 -c "import sys, json; data=json.load(sys.stdin); print(f'  Accessed: {data.get(\"name\", \"unknown\")}')"
elif [ "$HTTP_CODE" = "404" ]; then
    echo "✅ ISOLATION SUCCESS: User 2 cannot access User 1's org-scoped template (404)"
elif [ "$HTTP_CODE" = "403" ]; then
    echo "✅ ISOLATION SUCCESS: User 2 forbidden from accessing template (403)"
else
    echo "⚠️  Unexpected HTTP $HTTP_CODE"
    echo "$RESPONSE"
fi

echo ""
echo "=========================================="
echo "Scope Isolation Test Summary"
echo "=========================================="
echo ""
echo "Analysis:"
echo "  • User 1 Org: $ORG1"
echo "  • User 2 Org: $ORG2"
echo "  • Both users can see global templates (scope=null, org_id=null)"
echo "  • Testing org-scoped template isolation..."
echo ""
