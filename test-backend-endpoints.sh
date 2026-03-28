#!/bin/bash
set -e

API_URL="http://localhost:8000"

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

echo "Register response: $REGISTER_RESPONSE"

# Extract token and org_id
TOKEN=$(echo "$REGISTER_RESPONSE" | grep -o '"access_token":"[^"]*"' | cut -d'"' -f4 || echo "")
ORG_ID=$(echo "$REGISTER_RESPONSE" | grep -o '"org_id":"[^"]*"' | cut -d'"' -f4 || echo "")

if [ -z "$TOKEN" ]; then
  echo "ERROR: Failed to get auth token"
  exit 1
fi

echo "✓ Got auth token and org_id: $ORG_ID"
echo ""

# Step 2: Test POST /auth/orgs/{org_id}/projects
echo "Step 2: Creating project via POST /auth/orgs/$ORG_ID/projects..."
CREATE_PROJECT_RESPONSE=$(curl -s -X POST "$API_URL/auth/orgs/$ORG_ID/projects" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "name": "test-project",
    "repository_url": "https://github.com/test/repo",
    "branch": "main",
    "git_root_hash": "abc123"
  }')

echo "Create project response: $CREATE_PROJECT_RESPONSE"

# Check for error
if echo "$CREATE_PROJECT_RESPONSE" | grep -q "detail"; then
  echo "ERROR: Project creation failed"
  exit 1
fi

echo "✓ Project created successfully"
echo ""

# Step 3: Test GET /auth/orgs/{org_id}/projects
echo "Step 3: Fetching projects via GET /auth/orgs/$ORG_ID/projects..."
GET_PROJECTS_RESPONSE=$(curl -s -X GET "$API_URL/auth/orgs/$ORG_ID/projects?limit=10&offset=0" \
  -H "Authorization: Bearer $TOKEN")

echo "Get projects response: $GET_PROJECTS_RESPONSE"

# Check if response contains projects array
if ! echo "$GET_PROJECTS_RESPONSE" | grep -q "projects"; then
  echo "ERROR: GET projects failed - no 'projects' field in response"
  exit 1
fi

echo "✓ Projects fetched successfully"
echo ""

echo "=== All Backend Tests Passed! ==="
