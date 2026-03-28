#!/bin/bash
TOKEN="c2Vzc2lvbnM6MzEzNTg4M2MtOGJlMy00YjJiLWJkZDgtZGJlMmU0MjczNThmOmRlZmF1bHQ6NWY4ODcyMDMtZDEwZi00YTQ5LTlmMGEtMGY5OTRkZTQ4YWEw"
ORG_ID="3135883c-8be3-4b2b-bdd8-dbe2e427358f"

echo "=========================================="
echo "Template Scope & Isolation Testing"
echo "=========================================="
echo ""
echo "Current User:"
echo "  Email: devbob-test@local.dev"
echo "  Org ID: $ORG_ID"
echo "  Token: ${TOKEN:0:20}..."
echo ""

echo "PHASE 1: Understanding Current Scope Implementation"
echo "=================================================="
echo ""

echo "1.1 List all templates for current user..."
TEMPLATES=$(kubectl exec devbob-0 -n metabob -c devbob -- bash -c "
curl -s 'http://metabob-rpc-api:8080/v2/activities/templates?limit=50' \
  -H 'Authorization: Bearer $TOKEN'
")

echo "$TEMPLATES" | python3 << 'PY'
import json, sys
data = json.loads(sys.stdin.read())
print(f"Total templates: {data.get('total', 0)}")
print()
for t in data.get('templates', []):
    scope = t.get('scope') or 'null'
    org = t.get('org_id') or 'null'
    proj = t.get('project_id') or 'null'
    print(f"  • {t['name']}")
    print(f"    ID: {t['id']}")
    print(f"    Scope: {scope}")
    print(f"    Org: {org}")
    print(f"    Project: {proj}")
    print()
PY

echo ""
echo "1.2 Create a second organization and user..."
REGISTER2=$(kubectl exec devbob-0 -n metabob -c devbob -- bash -c '
curl -s -X POST http://metabob-rpc-api:8080/auth/register \
  -H "Content-Type: application/json" \
  -d "{
    \"name\": \"DevBob Test User 2\",
    \"email\": \"devbob-test2@local.dev\",
    \"password\": \"test-password-456\",
    \"organization_name\": \"DevBob K8s Test Org 2\"
  }"
')

TOKEN2=$(echo "$REGISTER2" | python3 -c "import sys, json; data=json.load(sys.stdin); print(data.get('token', ''))" 2>/dev/null)
ORG2=$(echo "$REGISTER2" | python3 -c "import sys, json; data=json.load(sys.stdin); print(data.get('org', {}).get('org_id', ''))" 2>/dev/null)

if [ -n "$TOKEN2" ] && [ -n "$ORG2" ]; then
    echo "✅ Created second user/org:"
    echo "   Email: devbob-test2@local.dev"
    echo "   Org ID: $ORG2"
    echo "   Token: ${TOKEN2:0:20}..."
else
    echo "❌ Failed to create second user"
    echo "$REGISTER2" | python3 -m json.tool
fi

echo ""
echo "PHASE 2: Testing Scope Visibility"
echo "=================================="
echo ""

echo "2.1 User 1 sees these templates:"
kubectl exec devbob-0 -n metabob -c devbob -- bash -c "
curl -s 'http://metabob-rpc-api:8080/v2/activities/templates?limit=50' \
  -H 'Authorization: Bearer $TOKEN'
" | python3 -c "import sys, json; data=json.load(sys.stdin); print(f'Count: {data.get(\"total\", 0)}'); [print(f'  - {t[\"name\"]}') for t in data.get('templates', [])]"

echo ""
echo "2.2 User 2 (different org) sees these templates:"
kubectl exec devbob-0 -n metabob -c devbob -- bash -c "
curl -s 'http://metabob-rpc-api:8080/v2/activities/templates?limit=50' \
  -H 'Authorization: Bearer $TOKEN2'
" | python3 -c "import sys, json; data=json.load(sys.stdin); print(f'Count: {data.get(\"total\", 0)}'); [print(f'  - {t[\"name\"]}') for t in data.get('templates', [])]"

echo ""
echo "PHASE 3: Testing Scope Assignment (if API supports it)"
echo "======================================================"
echo ""

echo "3.1 Try to create org-scoped template for User 1's org..."
kubectl exec devbob-0 -n metabob -c devbob -- bash -c "
TEMPLATE=\$(cat << 'TEMPLATE_JSON'
{
  \"name\": \"Org-Specific Test Template\",
  \"description\": \"Test template scoped to org\",
  \"category\": \"infrastructure\",
  \"scope\": \"org\",
  \"org_id\": \"$ORG_ID\",
  \"tasks\": [
    {
      \"id\": \"test-task\",
      \"subagent\": \"general\",
      \"description\": \"Test task\",
      \"dependencies\": [],
      \"prompt\": {
        \"template\": \"This is a test template scoped to org $ORG_ID\",
        \"maxTokens\": 1000,
        \"compressionStrategy\": \"filter\",
        \"variables\": []
      },
      \"validation\": {
        \"requiredFiles\": [],
        \"requiredPatterns\": [],
        \"forbiddenPatterns\": [],
        \"commands\": []
      },
      \"retry\": {
        \"maxAttempts\": 1,
        \"strategy\": \"simple\"
      }
    }
  ],
  \"integration\": {
    \"preChecks\": [],
    \"postChecks\": [],
    \"qualityGates\": []
  }
}
TEMPLATE_JSON
)
curl -s -X POST http://metabob-rpc-api:8080/v2/activities/templates \
  -H 'Authorization: Bearer $TOKEN' \
  -H 'Content-Type: application/json' \
  -d \"\$TEMPLATE\"
" | python3 -m json.tool 2>/dev/null | grep -E "\"id\"|\"name\"|\"scope\"|\"org_id\"|error" | head -10

echo ""
echo "=========================================="
echo "Test Complete"
echo "=========================================="
