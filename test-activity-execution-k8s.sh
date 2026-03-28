#!/bin/bash
TOKEN="c2Vzc2lvbnM6MzEzNTg4M2MtOGJlMy00YjJiLWJkZDgtZGJlMmU0MjczNThmOmRlZmF1bHQ6NWY4ODcyMDMtZDEwZi00YTQ5LTlmMGEtMGY5OTRkZTQ4YWEw"

echo "=== Testing Activity Execution from DevBob Pod ==="
echo ""

echo "1. Create test project with simple code..."
kubectl exec devbob-0 -n metabob -c devbob -- bash -c '
cd /tmp
rm -rf activity-test-project
mkdir -p activity-test-project
cd activity-test-project
git init
git config user.email "test@devbob.local"
git config user.name "DevBob Test"

# Create simple test file
cat > test.js << "CODE"
function calculateSum(a, b) {
  // TODO: Add input validation
  return a + b;
}

function divide(x, y) {
  // Bug: No zero check
  return x / y;
}

module.exports = { calculateSum, divide };
CODE

git add test.js
git commit -m "Initial test code"
echo "✅ Project created at /tmp/activity-test-project"
ls -la
'

echo ""
echo "2. List available templates visible to this user..."
kubectl exec devbob-0 -n metabob -c devbob -- bash -c "
cd /tmp/activity-test-project
curl -s 'http://metabob-rpc-api:8080/v2/activities/templates?category=infrastructure&limit=10' \
  -H 'Authorization: Bearer $TOKEN'
" | python3 -c "import sys, json; data=json.load(sys.stdin); print(f'Available templates: {data.get(\"total\", 0)}'); [print(f'  - {t[\"id\"]}: {t[\"name\"]}') for t in data.get('templates', [])]"

echo ""
echo "3. Check activity execution endpoint..."
kubectl exec devbob-0 -n metabob -c devbob -- bash -c "
curl -s -X POST 'http://metabob-rpc-api:8080/docs' | grep -o 'POST /v2/activities/execute' | head -1
"
