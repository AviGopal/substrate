#!/bin/bash
set -e

echo "=========================================="
echo "Running activity-template-query-filtering"
echo "Multi-Tenant Isolation Validation"
echo "=========================================="
echo ""

# Configuration
RPC_API_URL="http://metabob-rpc-api:8080"
USER1_TOKEN="c2Vzc2lvbnM6MzEzNTg4M2MtOGJlMy00YjJiLWJkZDgtZGJlMmU0MjczNThmOmRlZmF1bHQ6NWY4ODcyMDMtZDEwZi00YTQ5LTlmMGEtMGY5OTRkZTQ4YWEw"
USER1_ORG_ID="3135883c-8be3-4b2b-bdd8-dbe2e427358f"
TEMPLATE_NAME="org-isolation-test-$(date +%s)"

# Test 1: Setup User 2
echo "[Test 1/5] Setup User 2"
echo "  Creating/retrieving User 2..."

USER2_RESPONSE=$(kubectl exec devbob-0 -n metabob -c devbob -- bash -c "
curl -s -X POST $RPC_API_URL/auth/register \
  -H 'Content-Type: application/json' \
  -d '{
    \"name\": \"DevBob Test User 2\",
    \"email\": \"devbob-test2@local.dev\",
    \"password\": \"test-password-456\",
    \"organization_name\": \"DevBob K8s Test Org 2\"
  }'
")

USER2_TOKEN=$(echo "$USER2_RESPONSE" | python3 -c "import sys, json; data=json.load(sys.stdin); print(data.get('token', ''))" 2>/dev/null || echo "")
USER2_ORG_ID=$(echo "$USER2_RESPONSE" | python3 -c "import sys, json; data=json.load(sys.stdin); print(data.get('org', {}).get('org_id', ''))" 2>/dev/null || echo "")

if [ -n "$USER2_TOKEN" ] && [ -n "$USER2_ORG_ID" ]; then
    echo "  ✅ User 2 ready: Org ID = $USER2_ORG_ID"
else
    echo "  ⚠️  User 2 setup failed (may already exist), will try to continue"
    # Try to use cached credentials or skip User 2 tests
fi

echo ""

# Test 2: Register org-scoped template as User 1
echo "[Test 2/5] Register Org-Scoped Template as User 1"
echo "  Creating template with scope='org'..."

TEMPLATE_DATA=$(cat << TEMPLATE_EOF
{
  "name": "$TEMPLATE_NAME",
  "description": "Test template for multi-tenant isolation validation",
  "category": "feature",
  "scope": "org",
  "tasks": [
    {
      "id": "task-1",
      "subagent": "general",
      "description": "Test task for isolation",
      "dependencies": [],
      "prompt": {
        "template": "This is a test template for org isolation",
        "max_tokens": 1000,
        "compression_strategy": "filter",
        "variables": []
      },
      "validation": {
        "required_files": [],
        "required_patterns": [],
        "forbidden_patterns": [],
        "commands": []
      },
      "retry": {
        "max_attempts": 1,
        "strategy": "simple"
      }
    }
  ],
  "integration": {
    "preChecks": [],
    "postChecks": [],
    "qualityGates": []
  }
}
TEMPLATE_EOF
)

CREATE_RESPONSE=$(kubectl exec devbob-0 -n metabob -c devbob -- bash -c "
curl -s -X POST $RPC_API_URL/v2/activities/templates \
  -H 'Authorization: Bearer $USER1_TOKEN' \
  -H 'Content-Type: application/json' \
  -d '$TEMPLATE_DATA'
")

TEMPLATE_ID=$(echo "$CREATE_RESPONSE" | python3 -c "import sys, json; data=json.load(sys.stdin); print(data.get('variant_id', ''))" 2>/dev/null || echo "")
TEMPLATE_SCOPE=$(echo "$CREATE_RESPONSE" | python3 -c "import sys, json; data=json.load(sys.stdin); print(data.get('scope', ''))" 2>/dev/null || echo "")
TEMPLATE_ORG=$(echo "$CREATE_RESPONSE" | python3 -c "import sys, json; data=json.load(sys.stdin); print(data.get('org_id', ''))" 2>/dev/null || echo "")

if [ -n "$TEMPLATE_ID" ] && [ "$TEMPLATE_SCOPE" = "org" ] && [ "$TEMPLATE_ORG" = "$USER1_ORG_ID" ]; then
    echo "  ✅ PASS: Template created with scope='org' and org_id=$USER1_ORG_ID"
    echo "  Template ID: $TEMPLATE_ID"
    TEST2_PASS=1
else
    echo "  ❌ FAIL: Template not properly scoped"
    echo "  Expected: scope='org', org_id='$USER1_ORG_ID'"
    echo "  Actual: scope='$TEMPLATE_SCOPE', org_id='$TEMPLATE_ORG'"
    TEST2_PASS=0
fi

echo ""

# Test 3: User 2 isolation check
echo "[Test 3/5] User 2 Isolation Check"
echo "  Querying templates as User 2..."

if [ -n "$USER2_TOKEN" ]; then
    USER2_TEMPLATES=$(kubectl exec devbob-0 -n metabob -c devbob -- bash -c "
    curl -s $RPC_API_URL/v2/activities/templates?limit=100 \
      -H 'Authorization: Bearer $USER2_TOKEN'
    ")
    
    USER2_HAS_USER1_TEMPLATE=$(echo "$USER2_TEMPLATES" | python3 -c "
import sys, json
data = json.load(sys.stdin)
templates = data.get('templates', [])
found = any(t.get('name') == '$TEMPLATE_NAME' or t.get('variant_id') == '$TEMPLATE_ID' for t in templates)
print('yes' if found else 'no')
    " 2>/dev/null || echo "error")
    
    if [ "$USER2_HAS_USER1_TEMPLATE" = "no" ]; then
        echo "  ✅ PASS: User 2 correctly isolated - cannot see User 1's org template"
        TEST3_PASS=1
    elif [ "$USER2_HAS_USER1_TEMPLATE" = "yes" ]; then
        echo "  ❌ FAIL: SECURITY ISSUE - User 2 can see User 1's org template!"
        TEST3_PASS=0
    else
        echo "  ⚠️  SKIP: Could not determine User 2 template visibility"
        TEST3_PASS=0
    fi
else
    echo "  ⚠️  SKIP: User 2 token not available"
    TEST3_PASS=0
fi

echo ""

# Test 4: User 1 can see own template
echo "[Test 4/5] User 1 Own Template Visibility"
echo "  Querying templates as User 1..."

USER1_TEMPLATES=$(kubectl exec devbob-0 -n metabob -c devbob -- bash -c "
curl -s $RPC_API_URL/v2/activities/templates?limit=100 \
  -H 'Authorization: Bearer $USER1_TOKEN'
")

USER1_HAS_OWN_TEMPLATE=$(echo "$USER1_TEMPLATES" | python3 -c "
import sys, json
data = json.load(sys.stdin)
templates = data.get('templates', [])
found_template = next((t for t in templates if t.get('name') == '$TEMPLATE_NAME' or t.get('variant_id') == '$TEMPLATE_ID'), None)
if found_template:
    scope = found_template.get('scope')
    org_id = found_template.get('org_id')
    if scope == 'org' and org_id == '$USER1_ORG_ID':
        print('yes')
    else:
        print('wrong_scope')
else:
    print('no')
" 2>/dev/null || echo "error")

if [ "$USER1_HAS_OWN_TEMPLATE" = "yes" ]; then
    echo "  ✅ PASS: User 1 can see their own org template"
    TEST4_PASS=1
elif [ "$USER1_HAS_OWN_TEMPLATE" = "no" ]; then
    echo "  ❌ FAIL: User 1 cannot see their own org template (filtering too strict)"
    TEST4_PASS=0
else
    echo "  ❌ FAIL: Template has wrong scope or org_id"
    TEST4_PASS=0
fi

echo ""

# Test 5: Unauthenticated access
echo "[Test 5/5] Unauthenticated Access Restriction"
echo "  Querying templates without authentication..."

UNAUTH_TEMPLATES=$(kubectl exec devbob-0 -n metabob -c devbob -- bash -c "
curl -s $RPC_API_URL/v2/activities/templates?limit=100
")

UNAUTH_RESULTS=$(echo "$UNAUTH_TEMPLATES" | python3 -c "
import sys, json
data = json.load(sys.stdin)
templates = data.get('templates', [])
org_scoped = [t for t in templates if t.get('scope') == 'org']
project_scoped = [t for t in templates if t.get('scope') == 'project']
print(f'{len(org_scoped)} {len(project_scoped)}')
" 2>/dev/null || echo "error error")

ORG_COUNT=$(echo "$UNAUTH_RESULTS" | awk '{print $1}')
PROJECT_COUNT=$(echo "$UNAUTH_RESULTS" | awk '{print $2}')

if [ "$ORG_COUNT" = "0" ] && [ "$PROJECT_COUNT" = "0" ]; then
    echo "  ✅ PASS: Unauthenticated access correctly restricted to global templates only"
    TEST5_PASS=1
else
    echo "  ❌ FAIL: SECURITY ISSUE - Unauthenticated users can see scoped templates!"
    echo "  Org-scoped templates visible: $ORG_COUNT"
    echo "  Project-scoped templates visible: $PROJECT_COUNT"
    TEST5_PASS=0
fi

echo ""

# Summary
echo "=========================================="
echo "Summary"
echo "=========================================="
TOTAL=5
PASSED=$((TEST2_PASS + TEST3_PASS + TEST4_PASS + TEST5_PASS + 0))  # +0 for User2 setup
echo "Total Tests: $TOTAL"
echo "Passed: $PASSED"
echo "Failed: $((TOTAL - PASSED))"

if [ $PASSED -eq $TOTAL ]; then
    echo "Status: ✅ ALL TESTS PASSED"
    echo "=========================================="
    exit 0
else
    echo "Status: ❌ SOME TESTS FAILED"
    echo "=========================================="
    exit 1
fi
