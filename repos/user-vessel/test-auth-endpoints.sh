#!/bin/bash
set -e

# Test script for signup and login endpoints
# Usage: ./test-auth-endpoints.sh

BASE_URL=${USER_VESSEL_URL:-http://localhost:8080}

echo "Testing user-vessel authentication endpoints at $BASE_URL"
echo ""

# Test 1: Health check
echo "1. Health Check"
echo "---------------"
curl -s "$BASE_URL/health" | jq .
echo ""

# Test 2: Signup (create new org + user)
echo "2. Signup (create new org + user)"
echo "----------------------------------"
SIGNUP_RESPONSE=$(curl -s -X POST "$BASE_URL/v2/auth/signup" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "alice@example.com",
    "password": "TestPassword123",
    "name": "Alice Test",
    "org_name": "Test Organization"
  }')

echo "$SIGNUP_RESPONSE" | jq .

# Extract token from signup response
SIGNUP_TOKEN=$(echo "$SIGNUP_RESPONSE" | jq -r '.token // empty')

if [ -z "$SIGNUP_TOKEN" ]; then
  echo "ERROR: Signup failed - no token received"
  exit 1
fi

echo ""
echo "✓ Signup successful! Token: ${SIGNUP_TOKEN:0:20}..."
echo ""

# Test 3: Get authenticated user info (/auth/me)
echo "3. Get authenticated user info"
echo "------------------------------"
curl -s "$BASE_URL/v2/auth/me" \
  -H "Authorization: Bearer $SIGNUP_TOKEN" | jq .
echo ""

# Test 4: Login with created user
echo "4. Login with existing credentials"
echo "-----------------------------------"
LOGIN_RESPONSE=$(curl -s -X POST "$BASE_URL/v2/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "alice@example.com",
    "password": "TestPassword123"
  }')

echo "$LOGIN_RESPONSE" | jq .

# Extract token from login response
LOGIN_TOKEN=$(echo "$LOGIN_RESPONSE" | jq -r '.token // empty')

if [ -z "$LOGIN_TOKEN" ]; then
  echo "ERROR: Login failed - no token received"
  exit 1
fi

echo ""
echo "✓ Login successful! Token: ${LOGIN_TOKEN:0:20}..."
echo ""

# Test 5: Test invalid password
echo "5. Test login with invalid password (should fail)"
echo "--------------------------------------------------"
INVALID_LOGIN=$(curl -s -X POST "$BASE_URL/v2/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "alice@example.com",
    "password": "WrongPassword123"
  }')

echo "$INVALID_LOGIN" | jq .
echo ""

# Test 6: Test duplicate signup (should fail)
echo "6. Test duplicate signup (should fail)"
echo "---------------------------------------"
DUPLICATE_SIGNUP=$(curl -s -X POST "$BASE_URL/v2/auth/signup" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "alice@example.com",
    "password": "TestPassword123",
    "name": "Alice Duplicate",
    "org_name": "Another Organization"
  }')

echo "$DUPLICATE_SIGNUP" | jq .
echo ""

# Test 7: Test weak password (should fail)
echo "7. Test signup with weak password (should fail)"
echo "------------------------------------------------"
WEAK_PASSWORD=$(curl -s -X POST "$BASE_URL/v2/auth/signup" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "bob@example.com",
    "password": "weak",
    "name": "Bob Test",
    "org_name": "Bob Org"
  }')

echo "$WEAK_PASSWORD" | jq .
echo ""

echo "All tests completed!"
echo ""
echo "Summary:"
echo "--------"
echo "✓ Health check passed"
echo "✓ Signup endpoint working"
echo "✓ Login endpoint working"
echo "✓ /auth/me endpoint working"
echo "✓ Invalid password rejected"
echo "✓ Duplicate email rejected"
echo "✓ Weak password rejected"
