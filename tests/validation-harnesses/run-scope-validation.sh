#!/bin/bash
set -e

cd /home/avi/documents/work/exp-repo/metabob-devbob/tests/validation-harnesses

echo "=== Activity Template Scope Assignment Validation ==="
echo ""
echo "Environment: Kubernetes (K8s)"
echo "RPC API: http://metabob-rpc-api:8080"
echo ""

# Test 1: Explicit scope assignment
echo "Test 1: Explicit scope assignment"
TEMPLATE_NAME="test-scope-explicit-$(date +%s)"
TOKEN="c2Vzc2lvbnM6MzEzNTg4M2MtOGJlMy00YjJiLWJkZDgtZGJlMmU0MjczNThmOmRlZmF1bHQ6NWY4ODcyMDMtZDEwZi00YTQ5LTlmMGEtMGY5OTRkZTQ4YWEw"

CREATE_RESULT=$(kubectl exec devbob-0 -n metabob -c devbob -- bash -c "
curl -s -X POST http://metabob-rpc-api:8080/v2/activities/templates \
  -H 'Authorization: Bearer $TOKEN' \
  -H 'Content-Type: application/json' \
  -d '{
    \"name\": \"$TEMPLATE_NAME\",
    \"description\": \"Test template for scope validation\",
    \"category\": \"feature\",
    \"scope\": \"org\",
    \"tasks\": [{
      \"id\": \"task-1\",
      \"subagent\": \"general\",
      \"description\": \"Test task\",
      \"dependencies\": [],
      \"prompt\": {
        \"template\": \"Test\",
        \"max_tokens\": 1000,
        \"compression_strategy\": \"filter\",
        \"variables\": []
      },
      \"validation\": {
        \"required_files\": [],
        \"required_patterns\": [],
        \"forbidden_patterns\": [],
        \"commands\": []
      },
      \"retry\": {
        \"max_attempts\": 1,
        \"strategy\": \"simple\"
      }
    }],
    \"variables\": {},
    \"context_requirements\": []
  }'
")

echo "Create response: $CREATE_RESULT"

VARIANT_ID=$(echo "$CREATE_RESULT" | python3 -c "import sys, json; data=json.load(sys.stdin); print(data.get('variant_id', ''))" 2>/dev/null || echo "")

if [ -z "$VARIANT_ID" ]; then
  echo "❌ FAIL: Failed to create template"
  exit 1
fi

echo "Template created: $VARIANT_ID"

# Query template
GET_RESULT=$(kubectl exec devbob-0 -n metabob -c devbob -- bash -c "
curl -s http://metabob-rpc-api:8080/v2/activities/templates/$VARIANT_ID \
  -H 'Authorization: Bearer $TOKEN'
")

echo "Get response: $GET_RESULT"

SCOPE=$(echo "$GET_RESULT" | python3 -c "import sys, json; data=json.load(sys.stdin); print(data.get('scope', 'null'))" 2>/dev/null || echo "null")
ORG_ID=$(echo "$GET_RESULT" | python3 -c "import sys, json; data=json.load(sys.stdin); print(data.get('org_id', 'null'))" 2>/dev/null || echo "null")

echo "Extracted - scope: $SCOPE, org_id: $ORG_ID"

if [ "$SCOPE" = "org" ] && [ "$ORG_ID" != "null" ] && [ "$ORG_ID" != "None" ]; then
  echo "✅ Test 1 PASS: scope=$SCOPE, org_id=$ORG_ID"
  TEST1_STATUS="PASS"
else
  echo "❌ Test 1 FAIL: Expected scope='org' and org_id to be set, got scope=$SCOPE, org_id=$ORG_ID"
  TEST1_STATUS="FAIL"
fi

echo ""

# Test 2: Default scope assignment
echo "Test 2: Default scope assignment (no scope field)"
TEMPLATE_NAME2="test-scope-default-$(date +%s)"

CREATE_RESULT2=$(kubectl exec devbob-0 -n metabob -c devbob -- bash -c "
curl -s -X POST http://metabob-rpc-api:8080/v2/activities/templates \
  -H 'Authorization: Bearer $TOKEN' \
  -H 'Content-Type: application/json' \
  -d '{
    \"name\": \"$TEMPLATE_NAME2\",
    \"description\": \"Test template without scope\",
    \"category\": \"feature\",
    \"tasks\": [{
      \"id\": \"task-1\",
      \"subagent\": \"general\",
      \"description\": \"Test task\",
      \"dependencies\": [],
      \"prompt\": {
        \"template\": \"Test\",
        \"max_tokens\": 1000,
        \"compression_strategy\": \"filter\",
        \"variables\": []
      },
      \"validation\": {
        \"required_files\": [],
        \"required_patterns\": [],
        \"forbidden_patterns\": [],
        \"commands\": []
      },
      \"retry\": {
        \"max_attempts\": 1,
        \"strategy\": \"simple\"
      }
    }],
    \"variables\": {},
    \"context_requirements\": []
  }'
")

VARIANT_ID2=$(echo "$CREATE_RESULT2" | python3 -c "import sys, json; data=json.load(sys.stdin); print(data.get('variant_id', ''))" 2>/dev/null || echo "")

if [ -z "$VARIANT_ID2" ]; then
  echo "❌ FAIL: Failed to create template"
  TEST2_STATUS="FAIL"
else
  GET_RESULT2=$(kubectl exec devbob-0 -n metabob -c devbob -- bash -c "
  curl -s http://metabob-rpc-api:8080/v2/activities/templates/$VARIANT_ID2 \
    -H 'Authorization: Bearer $TOKEN'
  ")

  SCOPE2=$(echo "$GET_RESULT2" | python3 -c "import sys, json; data=json.load(sys.stdin); print(data.get('scope', 'null'))" 2>/dev/null || echo "null")
  ORG_ID2=$(echo "$GET_RESULT2" | python3 -c "import sys, json; data=json.load(sys.stdin); print(data.get('org_id', 'null'))" 2>/dev/null || echo "null")

  if [ "$SCOPE2" = "org" ]; then
    echo "✅ Test 2 PASS: scope defaulted to 'org'"
    TEST2_STATUS="PASS"
  else
    echo "❌ Test 2 FAIL: Expected default scope='org', got scope=$SCOPE2"
    TEST2_STATUS="FAIL"
  fi
fi

echo ""
echo "=== Validation Summary ==="
echo "Test 1 (Explicit scope): $TEST1_STATUS"
echo "Test 2 (Default scope): $TEST2_STATUS"

if [ "$TEST1_STATUS" = "PASS" ] && [ "$TEST2_STATUS" = "PASS" ]; then
  echo "Overall: ✅ PASS"
  exit 0
else
  echo "Overall: ❌ FAIL"
  exit 1
fi
