#!/bin/bash
TOKEN="c2Vzc2lvbnM6MzEzNTg4M2MtOGJlMy00YjJiLWJkZDgtZGJlMmU0MjczNThmOmRlZmF1bHQ6NWY4ODcyMDMtZDEwZi00YTQ5LTlmMGEtMGY5OTRkZTQ4YWEw"
ORG_ID="3135883c-8be3-4b2b-bdd8-dbe2e427358f"

echo "=== Testing Template Scope System ==="
echo ""
echo "Current User Context:"
echo "  Email: devbob-test@local.dev"
echo "  Org ID: $ORG_ID"
echo ""

echo "1. Check registered template for scope field..."
kubectl exec devbob-0 -n metabob -c devbob -- bash -c "
curl -s 'http://metabob-rpc-api:8080/v2/activities/templates/infrastructure-cbfca84f' \
  -H 'Authorization: Bearer $TOKEN'
" | python3 -c "import sys, json; data=json.load(sys.stdin); print(json.dumps({'id': data.get('id'), 'name': data.get('name'), 'scope': data.get('scope'), 'org_id': data.get('org_id'), 'project_id': data.get('project_id')}, indent=2))"

echo ""
echo "2. Register CLI command to register all templates..."
kubectl exec devbob-0 -n metabob -c devbob -- bash -c '
cd /tmp/test-workspace
export METABOB_API_URL=http://metabob-rpc-api:8080
export OPENCODE_SESSION_TOKEN='"$TOKEN"'
opencode activity template register all 2>&1
' | tail -50

echo ""
echo "3. List all templates after bulk registration..."
kubectl exec devbob-0 -n metabob -c devbob -- bash -c "
curl -s 'http://metabob-rpc-api:8080/v2/activities/templates?limit=20' \
  -H 'Authorization: Bearer $TOKEN'
" | python3 -c "import sys, json; data=json.load(sys.stdin); print(f'Total templates: {data.get(\"total\", 0)}'); [print(f'  - {t[\"id\"]}: {t[\"name\"]} (scope: {t.get(\"scope\", \"null\")}, org: {t.get(\"org_id\", \"null\")})') for t in data.get('templates', [])]"
