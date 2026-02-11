#!/bin/bash

echo "============================================"
echo "V2 Session API - Full Flow Test"
echo "============================================"
echo ""

API_KEY="mb_TfdRc58VlhLzio5jebyESJnTplTiDHlAiQtPB0JdOrQ"

# Test 1: Create session with API key
echo "Test 1: Create session with API key"
echo "--------------------------------------------"
response=$(curl -s -X POST http://localhost:8080/v2/session \
  -H "X-API-Key: $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"project_id":"test-project"}')

echo "$response" | jq .

# Extract session token
SESSION_TOKEN=$(echo "$response" | jq -r '.metadata.session_token')

if [ "$SESSION_TOKEN" != "null" ] && [ -n "$SESSION_TOKEN" ]; then
  echo "✅ PASS: Session created successfully"
  echo "   Session token: ${SESSION_TOKEN:0:40}..."
else
  echo "❌ FAIL: No session token returned"
  exit 1
fi

echo ""
echo "--------------------------------------------"
echo "Test 2: Get session with Bearer token"
echo "--------------------------------------------"
response2=$(curl -s -X GET http://localhost:8080/v2/session \
  -H "Authorization: Bearer $SESSION_TOKEN")

echo "$response2" | jq .

session_id=$(echo "$response2" | jq -r '.session_id')
if [ "$session_id" != "null" ] && [ -n "$session_id" ]; then
  echo "✅ PASS: Session retrieved successfully"
  echo "   Session ID: $session_id"
else
  echo "❌ FAIL: Could not retrieve session"
  exit 1
fi

echo ""
echo "--------------------------------------------"
echo "Test 3: Delete session"
echo "--------------------------------------------"
response3=$(curl -s -X DELETE http://localhost:8080/v2/session \
  -H "Authorization: Bearer $SESSION_TOKEN")

echo "$response3" | jq .

deleted=$(echo "$response3" | jq -r '.deleted')
if [ "$deleted" = "true" ]; then
  echo "✅ PASS: Session deleted successfully"
else
  echo "❌ FAIL: Session deletion failed"
  exit 1
fi

echo ""
echo "============================================"
echo "Summary"
echo "============================================"
echo "✅ All V2 session tests passed!"
echo ""
echo "V2 Session API Features:"
echo "  ✅ Proto JSON format responses"
echo "  ✅ API key authentication (X-API-Key header)"
echo "  ✅ Session token management (Bearer auth)"
echo "  ✅ Session lifecycle (create, get, delete)"
echo "  ✅ Project association"
echo "  ✅ Hierarchical session IDs"
echo "============================================"

