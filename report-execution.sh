#!/bin/bash
# Report activity execution to backend API

BACKEND_URL="http://localhost:8081"

# Create-activity execution from our test (act_mlv8a9pa_cf367c3b822e567c)
# Duration: 259.2s (from session summary)
# Cost: $0.4794
# Tokens: 150,004 input, 1,275 output
# Status: SUCCESS (despite false negative)

EXECUTION_DATA='{
  "execution_id": "act_mlv8a9pa_cf367c3b822e567c",
  "variant_id": "create-activity-template-(self-contained)-ed6cce82",
  "success": true,
  "cost": 0.4794,
  "duration_ms": 259200,
  "tokens": {
    "input": 150004,
    "output": 1275,
    "cache": 0
  },
  "error": null
}'

echo "Reporting execution to ${BACKEND_URL}/v2/activities/executions"
echo ""
echo "Execution data:"
echo "$EXECUTION_DATA" | jq '.'
echo ""

response=$(curl -s -X POST \
  -H "Content-Type: application/json" \
  -d "$EXECUTION_DATA" \
  "${BACKEND_URL}/v2/activities/executions")

echo "Response:"
echo "$response" | jq '.'
echo ""

# Check updated stats
echo "Updated template stats:"
curl -s "${BACKEND_URL}/v2/activities/templates/create-activity/stats" | jq '.variants[] | select(.variant_id | contains("self-contained")) | {variant_id, success_rate, thompson_alpha, thompson_beta, total_selections}'
