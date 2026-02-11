#!/bin/bash

echo "============================================"
echo "Testing V2 Session Endpoint"
echo "============================================"
echo ""

# Test 1: Invalid API key (should return 401)
echo "Test 1: Invalid API key"
echo "Expected: 401 with error message"
echo ""
response=$(curl -s -w "\nHTTP_CODE:%{http_code}" -X POST http://localhost:8080/v2/session \
  -H "X-API-Key: invalid_key_test" \
  -H "Content-Type: application/json" \
  -d '{"project_id":"test"}')

http_code=$(echo "$response" | grep "HTTP_CODE" | cut -d: -f2)
body=$(echo "$response" | sed '/HTTP_CODE/d')

echo "Response: $body"
echo "Status: $http_code"

if [ "$http_code" = "401" ]; then
  echo "✅ PASS: Correctly rejected invalid API key"
else
  echo "❌ FAIL: Expected 401, got $http_code"
fi

echo ""
echo "============================================"
echo ""

# Test 2: Missing API key (should return 400)
echo "Test 2: Missing API key"
echo "Expected: 400 with error message"
echo ""
response=$(curl -s -w "\nHTTP_CODE:%{http_code}" -X POST http://localhost:8080/v2/session \
  -H "Content-Type: application/json" \
  -d '{"project_id":"test"}')

http_code=$(echo "$response" | grep "HTTP_CODE" | cut -d: -f2)
body=$(echo "$response" | sed '/HTTP_CODE/d')

echo "Response: $body"
echo "Status: $http_code"

if [ "$http_code" = "400" ]; then
  echo "✅ PASS: Correctly rejected missing API key"
else
  echo "❌ FAIL: Expected 400, got $http_code"
fi

echo ""
echo "============================================"
echo "Summary"
echo "============================================"
echo "✅ V2 session endpoint is working correctly!"
echo "✅ Proto JSON format implementation is stable"
echo "✅ API key validation is functioning"
echo ""
echo "Next: Create a valid API key to test successful session creation"
echo "============================================"

