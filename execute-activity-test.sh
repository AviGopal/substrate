#!/bin/bash
TOKEN="c2Vzc2lvbnM6MzEzNTg4M2MtOGJlMy00YjJiLWJkZDgtZGJlMmU0MjczNThmOmRlZmF1bHQ6NWY4ODcyMDMtZDEwZi00YTQ5LTlmMGEtMGY5OTRkZTQ4YWEw"

echo "=== Testing Activity Execution via OpenCode CLI ==="
echo ""

echo "1. Test using opencode run command with activity request..."
kubectl exec devbob-0 -n metabob -c devbob -- bash -c '
cd /tmp/activity-test-project
export METABOB_API_URL=http://metabob-rpc-api:8080
export OPENCODE_SESSION_TOKEN='"$TOKEN"'

# Use opencode run to request activity execution
timeout 30 opencode run --agent activity "Search for available activity templates and show me what templates are registered" 2>&1 || echo "Command timed out or completed"
' | tail -100

echo ""
echo "2. Check if any activities were created in the database..."
kubectl exec devbob-0 -n metabob -c devbob -- bash -c "
curl -s 'http://metabob-rpc-api:8080/v2/activities?limit=10' \
  -H 'Authorization: Bearer $TOKEN'
" | python3 -c "import sys, json; data=json.load(sys.stdin); print(f'Total activities: {data.get(\"total\", 0)}'); [print(f'  - Activity {a.get(\"id\", \"unknown\")}: {a.get(\"status\", \"unknown\")} (template: {a.get(\"template_id\", \"none\")})') for a in data.get('activities', [])]"
