#!/bin/bash
# Quick check if backend has the new endpoint loaded

BACKEND_URL="${METABOB_API_URL:-http://localhost:8080}"

echo "Checking backend: $BACKEND_URL"
echo ""

# Test POST /v2/impulses/record-usage
echo "Testing POST /v2/impulses/record-usage..."
response=$(curl -s -o /dev/null -w "%{http_code}" -X POST \
  "$BACKEND_URL/v2/impulses/record-usage" \
  -H "Content-Type: application/json" \
  -d '{"execution_id":"test","activity_id":"test","task_id":"test","success":true,"impulse_usages":[]}')

if [ "$response" = "404" ]; then
    echo "❌ ENDPOINT NOT FOUND (404) - Backend needs restart"
    exit 1
elif [ "$response" = "400" ] || [ "$response" = "401" ] || [ "$response" = "422" ]; then
    echo "✅ ENDPOINT EXISTS ($response) - Backend ready (validation error expected)"
    exit 0
elif [ "$response" = "200" ]; then
    echo "✅ ENDPOINT EXISTS (200) - Backend ready"
    exit 0
else
    echo "⚠️  UNEXPECTED STATUS ($response)"
    exit 2
fi
