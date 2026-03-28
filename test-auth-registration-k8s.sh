#!/bin/bash
echo "=== Testing Authentication & Registration ==="
echo ""
echo "1. Check auth endpoints documentation..."
kubectl exec devbob-0 -n metabob -c devbob -- bash -c '
curl -s http://metabob-rpc-api:8080/docs 2>&1 | grep -A 5 -B 2 "auth\|register\|login" | head -50
'

echo ""
echo "2. Try registering a test user..."
kubectl exec devbob-0 -n metabob -c devbob -- bash -c '
curl -s -X POST http://metabob-rpc-api:8080/auth/register \
  -H "Content-Type: application/json" \
  -d "{
    \"email\": \"devbob-test@local.dev\",
    \"username\": \"devbob-test\",
    \"password\": \"test-password-123\",
    \"organization_name\": \"DevBob K8s Test Org\"
  }" 2>&1
' | python3 -m json.tool 2>/dev/null || echo "Raw response"

echo ""
echo "3. Try logging in..."
kubectl exec devbob-0 -n metabob -c devbob -- bash -c '
curl -s -X POST http://metabob-rpc-api:8080/auth/login \
  -H "Content-Type: application/json" \
  -d "{
    \"email\": \"devbob-test@local.dev\",
    \"password\": \"test-password-123\"
  }" 2>&1
' | python3 -m json.tool 2>/dev/null || kubectl exec devbob-0 -n metabob -c devbob -- bash -c 'curl -s -X POST http://metabob-rpc-api:8080/auth/login -H "Content-Type: application/json" -d "{\"email\": \"devbob-test@local.dev\", \"password\": \"test-password-123\"}"'
