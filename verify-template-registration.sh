#!/bin/bash
TOKEN="c2Vzc2lvbnM6MzEzNTg4M2MtOGJlMy00YjJiLWJkZDgtZGJlMmU0MjczNThmOmRlZmF1bHQ6NWY4ODcyMDMtZDEwZi00YTQ5LTlmMGEtMGY5OTRkZTQ4YWEw"

echo "=== Verifying Template Registration ==="
echo ""
echo "1. List all templates with detailed info..."
kubectl exec devbob-0 -n metabob -c devbob -- bash -c "
curl -s 'http://metabob-rpc-api:8080/v2/activities/templates?limit=50' \
  -H 'Authorization: Bearer $TOKEN'
" | python3 -c "
import sys, json
data = json.load(sys.stdin)
total = data.get('total', 0)
print(f'Total templates in database: {total}')
print()
for t in data.get('templates', []):
    print(f'  ID: {t[\"id\"]}')
    print(f'  Name: {t[\"name\"]}')
    print(f'  Category: {t[\"category\"]}')
    print(f'  Scope: {t.get(\"scope\", \"null\")}')
    print(f'  Org ID: {t.get(\"org_id\", \"null\")}')
    print(f'  Project ID: {t.get(\"project_id\", \"null\")}')
    print()
"

echo ""
echo "2. Check if we can query templates by scope..."
kubectl exec devbob-0 -n metabob -c devbob -- bash -c "
curl -s 'http://metabob-rpc-api:8080/v2/activities/templates?limit=50&scope=global' \
  -H 'Authorization: Bearer $TOKEN' 2>&1
" | python3 -m json.tool | head -20

echo ""
echo "3. Try fetching a specific template..."
kubectl exec devbob-0 -n metabob -c devbob -- bash -c "
curl -s 'http://metabob-rpc-api:8080/v2/activities/templates/infrastructure-cbfca84f' \
  -H 'Authorization: Bearer $TOKEN'
" | python3 -m json.tool | grep -E "\"id\"|\"name\"|\"scope\"|\"org_id\"|\"project_id\"" | head -10
