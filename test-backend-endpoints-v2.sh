#!/bin/bash
set -e

API_URL="http://127.0.0.1:8000"

echo "=== Testing Backend Endpoints ==="
echo ""

# Step 1: Register a test user
echo "Step 1: Registering test user..."
REGISTER_RESPONSE=$(curl -s -X POST "$API_URL/auth/register" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test-'$(date +%s)'@metabob.com",
    "password": "Test123!@#",
    "name": "Test User",
    "org_name": "Test Org"
  }')

echo "Register response (truncated): $(echo "$REGISTER_RESPONSE" | head -c 200)..."
echo ""

# Extract token and org_id (try both token and access_token)
TOKEN=$(echo "$REGISTER_RESPONSE" | python3 -c "import sys,json; data=json.load(sys.stdin); print(data.get('token') or data.get('access_token', ''))" 2>/dev/null || echo "")
ORG_ID=$(echo "$REGISTER_RESPONSE" | python3 -c "import sys,json; data=json.load(sys.stdin); print(data.get('organization', {}).get('org_id', '') or data.get('org_id', ''))" 2>/dev/null || echo "")

if [ -z "$TOKEN" ]; then
  echo "ERROR: Failed to get auth token"
  echo "Full response: $REGISTER_RESPONSE"
  exit 1
fi

if [ -z "$ORG_ID" ]; then
  echo "ERROR: Failed to get org_id"
  echo "Full response: $REGISTER_RESPONSE"
  exit 1
fi

echo "✓ Got auth token (${#TOKEN} chars) and org_id: $ORG_ID"
echo ""

# Step 2: Test POST /auth/orgs/{org_id}/projects
echo "Step 2: Creating project via POST /auth/orgs/$ORG_ID/projects..."
CREATE_PROJECT_RESPONSE=$(curl -s -w "\nHTTP_STATUS:%{http_code}" -X POST "$API_URL/auth/orgs/$ORG_ID/projects" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "name": "test-project",
    "repository_url": "https://github.com/test/repo",
    "branch": "main",
    "git_root_hash": "abc123"
  }')

HTTP_STATUS=$(echo "$CREATE_PROJECT_RESPONSE" | grep "HTTP_STATUS:" | cut -d':' -f2)
BODY=$(echo "$CREATE_PROJECT_RESPONSE" | grep -v "HTTP_STATUS:")

echo "HTTP Status: $HTTP_STATUS"
echo "Response body: $BODY"
echo ""

# Check for success (201 Created or 200 OK)
if [ "$HTTP_STATUS" != "201" ] && [ "$HTTP_STATUS" != "200" ]; then
  echo "ERROR: Project creation failed with status $HTTP_STATUS"
  exit 1
fi

echo "✓ Project created successfully (status: $HTTP_STATUS)"
echo ""

# Step 3: Test GET /auth/orgs/{org_id}/projects
echo "Step 3: Fetching projects via GET /auth/orgs/$ORG_ID/projects..."
GET_PROJECTS_RESPONSE=$(curl -s -w "\nHTTP_STATUS:%{http_code}" -X GET "$API_URL/auth/orgs/$ORG_ID/projects?limit=10&offset=0" \
  -H "Authorization: Bearer $TOKEN")

HTTP_STATUS=$(echo "$GET_PROJECTS_RESPONSE" | grep "HTTP_STATUS:" | cut -d':' -f2)
BODY=$(echo "$GET_PROJECTS_RESPONSE" | grep -v "HTTP_STATUS:")

echo "HTTP Status: $HTTP_STATUS"
echo "Response body: $BODY"
echo ""

# Check if response contains projects array
if [ "$HTTP_STATUS" != "200" ]; then
  echo "ERROR: GET projects failed with status $HTTP_STATUS"
  exit 1
fi

if ! echo "$BODY" | grep -q "projects"; then
  echo "ERROR: GET projects response missing 'projects' field"
  exit 1
fi

# Count projects
PROJECT_COUNT=$(echo "$BODY" | python3 -c "import sys,json; data=json.load(sys.stdin); print(len(data.get('projects', [])))" 2>/dev/null || echo "0")
echo "✓ Projects fetched successfully ($PROJECT_COUNT projects found)"
echo ""

echo "=== All Backend Tests Passed! ==="
echo "Summary:"
echo "  - User registration: ✓"
echo "  - Project creation (POST): ✓"
echo "  - Project listing (GET): ✓"
