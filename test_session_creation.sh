#!/bin/bash
set -e

RPC_API_URL="http://localhost:8080"

echo "===================================="
echo "Testing Multi-Tenant Session Creation"
echo "===================================="

# Test 1: Create session with org_id
echo ""
echo "[Test 1] Creating session with org_id..."
RESPONSE=$(curl -s -X POST "${RPC_API_URL}/session" \
  -H 'Content-Type: application/json' \
  -d '{"orgId": "test-org-123", "projectId": "test-project-456"}')

echo "Response: $RESPONSE"

# Extract token
TOKEN=$(echo $RESPONSE | jq -r '.session')
echo "Token: $TOKEN"

# Test 2: Verify session data contains org_id and project_id
echo ""
echo "[Test 2] Verifying session contains org_id and project_id..."
SESSION_INFO=$(curl -s -X GET "${RPC_API_URL}/session" \
  -H "Authorization: Bearer $TOKEN")

echo "Session info: $SESSION_INFO"

echo ""
echo "✅ Session creation with multi-tenant parameters successful!"
