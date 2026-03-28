#!/bin/bash
TOKEN="c2Vzc2lvbnM6MzEzNTg4M2MtOGJlMy00YjJiLWJkZDgtZGJlMmU0MjczNThmOmRlZmF1bHQ6NWY4ODcyMDMtZDEwZi00YTQ5LTlmMGEtMGY5OTRkZTQ4YWEw"

echo "=== Testing Bearer Token Authentication ==="
echo ""
echo "1. List activity templates..."
kubectl exec devbob-0 -n metabob -c devbob -- bash -c "
curl -s 'http://metabob-rpc-api:8080/v2/activities/templates?limit=10' \
  -H 'Authorization: Bearer $TOKEN'
" | python3 -m json.tool | head -100

echo ""
echo "2. Get template by ID..."
kubectl exec devbob-0 -n metabob -c devbob -- bash -c "
curl -s http://metabob-rpc-api:8080/v2/activities/templates/trace-enforce-validate-loop \
  -H 'Authorization: Bearer $TOKEN'
" | python3 -m json.tool | head -150
