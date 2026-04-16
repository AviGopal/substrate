#!/bin/bash
# Smoke Test Script
# Minimal tests to verify system is working
# Target runtime: < 1 minute

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

ENV=${1:-production}

if [ "$ENV" = "canary" ]; then
  ACTIVITY_API_URL="https://activity.metabob.com"
  echo "🧪 Smoke Tests (Canary Environment)"
elif [ "$ENV" = "production" ]; then
  ACTIVITY_API_URL="https://activity.metabob.com"
  echo "🧪 Smoke Tests (Production Environment)"
else
  ACTIVITY_API_URL=${ACTIVITY_API_URL:-http://activity.metabob.local}
  echo "🧪 Smoke Tests (Local Environment)"
fi

echo "=================================="
echo "Endpoint: $ACTIVITY_API_URL"
echo ""

# Track failures
FAILURES=0

# Helper function
smoke_test() {
  local name="$1"
  shift
  echo -n "  $name... "
  if "$@" > /tmp/smoke-$$.log 2>&1; then
    echo "✅"
    return 0
  else
    echo "❌"
    cat /tmp/smoke-$$.log | sed 's/^/    /'
    FAILURES=$((FAILURES + 1))
    return 1
  fi
}

# Test 1: Health endpoint
echo "Test 1: Health endpoint"
smoke_test "GET /health" curl -sf "$ACTIVITY_API_URL/health"

# Test 2: Health response format
echo ""
echo "Test 2: Health response format"
smoke_test "JSON response" bash -c "curl -s '$ACTIVITY_API_URL/health' | jq -e '.status' > /dev/null"

# Test 3: Authentication (if API key available)
if [ -n "$METABOB_API_KEY" ]; then
  echo ""
  echo "Test 3: Authentication"
  smoke_test "API key auth" curl -sf \
    -H "Authorization: ApiKey $METABOB_API_KEY" \
    "$ACTIVITY_API_URL/v2/activities/templates"
else
  echo ""
  echo "Test 3: Authentication - ⚠️  SKIPPED (no API key)"
fi

# Test 4: Template list endpoint
if [ -n "$METABOB_API_KEY" ]; then
  echo ""
  echo "Test 4: Template list"
  smoke_test "GET /v2/activities/templates" bash -c "curl -s \
    -H 'Authorization: ApiKey $METABOB_API_KEY' \
    '$ACTIVITY_API_URL/v2/activities/templates' | jq -e '.templates' > /dev/null"
else
  echo ""
  echo "Test 4: Template list - ⚠️  SKIPPED (no API key)"
fi

# Test 5: Recommendation endpoint
if [ -n "$METABOB_API_KEY" ]; then
  echo ""
  echo "Test 5: Recommendations"
  smoke_test "POST /v2/activities/recommend" bash -c "curl -s -X POST \
    -H 'Authorization: ApiKey $METABOB_API_KEY' \
    -H 'Content-Type: application/json' \
    -d '{\"goal\": \"test\", \"availableShapes\": [\"memo\"]}' \
    '$ACTIVITY_API_URL/v2/activities/recommend' | jq -e '.recommendations' > /dev/null"
else
  echo ""
  echo "Test 5: Recommendations - ⚠️  SKIPPED (no API key)"
fi

# Summary
echo ""
echo "=================================="
if [ $FAILURES -eq 0 ]; then
  echo "✅ All smoke tests passed!"
  exit 0
else
  echo "❌ $FAILURES smoke test(s) failed"
  exit 1
fi
