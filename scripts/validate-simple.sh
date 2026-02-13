#!/bin/bash
# Simple Activity Validation - Direct Testing
# Tests activity execution without ACP dependencies

set -e

echo "=== Simple Activity Validation ==="
echo "Date: $(date)"
echo ""

# Test 1: Backend health
echo "[Test 1] Backend health check"
curl -s http://localhost:8080/health | grep -q "ok" && echo "  ✅ Backend is healthy" || (echo "  ❌ Backend unhealthy" && exit 1)
echo ""

# Test 2: Template exists
echo "[Test 2] Template exists (infrastructure-86af0790)"
SESSION_TOKEN=$(python3 -c "import json; print(json.load(open('.metabob/state'))['session_metadata']['session_token'])")
TEMPLATE=$(curl -s -H "Authorization: Bearer $SESSION_TOKEN" http://localhost:8080/v2/activities/templates/infrastructure-86af0790)
echo "$TEMPLATE" | grep -q "variant_name" && echo "  ✅ Template found" || (echo "  ❌ Template not found" && exit 1)
echo ""

# Test 3: Activity execution (in current session)
echo "[Test 3] Activity execution"
echo "  NOTE: This will execute activity in current OpenCode session"
echo "  Running activity infrastructure-86af0790..."
echo ""
echo "  Please run this command in your OpenCode session:"
echo '  activity({activityId: "infrastructure-86af0790", variables: {message: "validation"}, reason: "test"})'
echo ""
echo "  Then check that:"
echo "    - Activity completes with ✅"
echo "    - Task 'Echo message' appears"
echo "    - Cost and duration reported"
echo ""

read -p "Did the activity execute successfully? (y/n): " response
if [ "$response" = "y" ]; then
    echo "  ✅ Activity execution confirmed"
else
    echo "  ❌ Activity execution failed"
    exit 1
fi

echo ""
echo "=== All Tests Passed ✅ ==="
