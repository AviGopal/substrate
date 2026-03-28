#!/bin/bash
TOKEN="c2Vzc2lvbnM6MzEzNTg4M2MtOGJlMy00YjJiLWJkZDgtZGJlMmU0MjczNThmOmRlZmF1bHQ6NWY4ODcyMDMtZDEwZi00YTQ5LTlmMGEtMGY5OTRkZTQ4YWEw"

echo "=== Manually Registering Templates ==="
echo ""

TEMPLATES=(
  "create-activity"
  "debug-activity-self-contained"
  "trace-enforce-validate-loop"
)

for template_file in "${TEMPLATES[@]}"; do
  echo "Registering: $template_file..."
  
  RESULT=$(kubectl exec devbob-0 -n metabob -c devbob -- bash -c "
    TEMPLATE_DATA=\$(cat /root/.local/share/opencode/storage/activity-template/${template_file}.json)
    curl -s -w '\nHTTP_CODE:%{http_code}' -X POST http://metabob-rpc-api:8080/v2/activities/templates \
      -H 'Authorization: Bearer $TOKEN' \
      -H 'Content-Type: application/json' \
      -d \"\$TEMPLATE_DATA\"
  ")
  
  HTTP_CODE=$(echo "$RESULT" | grep "HTTP_CODE:" | cut -d: -f2)
  RESPONSE=$(echo "$RESULT" | grep -v "HTTP_CODE:")
  
  if [ "$HTTP_CODE" = "201" ]; then
    TEMPLATE_ID=$(echo "$RESPONSE" | python3 -c "import sys, json; data=json.load(sys.stdin); print(data.get('id', 'unknown'))" 2>/dev/null)
    echo "  ✅ Success - ID: $TEMPLATE_ID"
  else
    echo "  ❌ Failed - HTTP $HTTP_CODE"
    echo "$RESPONSE" | python3 -m json.tool 2>/dev/null | head -20
  fi
  echo ""
done

echo ""
echo "Final template count:"
kubectl exec devbob-0 -n metabob -c devbob -- bash -c "
curl -s 'http://metabob-rpc-api:8080/v2/activities/templates?limit=50' \
  -H 'Authorization: Bearer $TOKEN'
" | python3 -c "import sys, json; data=json.load(sys.stdin); print(f'Total: {data.get(\"total\", 0)} templates'); [print(f'  - {t[\"name\"]}') for t in data.get('templates', [])]"
