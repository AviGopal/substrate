#!/bin/bash
TOKEN="c2Vzc2lvbnM6MzEzNTg4M2MtOGJlMy00YjJiLWJkZDgtZGJlMmU0MjczNThmOmRlZmF1bHQ6NWY4ODcyMDMtZDEwZi00YTQ5LTlmMGEtMGY5OTRkZTQ4YWEw"

echo "=== Testing Template Registration & Scope System ==="
echo ""
echo "1. Check API docs for template registration endpoint..."
kubectl exec devbob-0 -n metabob -c devbob -- bash -c '
curl -s http://metabob-rpc-api:8080/docs | grep -A 30 "POST.*template" | head -40
' || echo "Could not fetch docs"

echo ""
echo "2. Try registering a template with 'global' scope..."
kubectl exec devbob-0 -n metabob -c devbob -- bash -c "
TEMPLATE_DATA=\$(cat /root/.local/share/opencode/storage/activity-template/manage-session-memory.json)
curl -s -X POST http://metabob-rpc-api:8080/v2/activities/templates \
  -H 'Authorization: Bearer $TOKEN' \
  -H 'Content-Type: application/json' \
  -d \"\$TEMPLATE_DATA\"
" | python3 -m json.tool | head -50

echo ""
echo "3. List templates after registration..."
kubectl exec devbob-0 -n metabob -c devbob -- bash -c "
curl -s 'http://metabob-rpc-api:8080/v2/activities/templates?limit=10' \
  -H 'Authorization: Bearer $TOKEN'
" | python3 -m json.tool | head -100
