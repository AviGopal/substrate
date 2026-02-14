#!/bin/bash
set -e

echo "======================================================================"
echo "Phase 2 E2E Test Preparation"
echo "======================================================================"

echo ""
echo "[1] Backend Services Health Check"
echo "-----------------------------------"
echo -n "Redis: "
docker exec metabob-redis redis-cli ping 2>/dev/null || echo "❌ FAILED"

echo -n "API Server: "
curl -s http://localhost:8080/health | jq -r '.status' 2>/dev/null || echo "❌ FAILED"

echo ""
echo "[2] Current Redis State"
echo "------------------------"
KEY_COUNT=$(docker exec metabob-redis redis-cli KEYS "agent_execution:session:*" | wc -l)
echo "Found $KEY_COUNT existing session keys"

echo ""
echo "[3] Test File Status"
echo "---------------------"
if [ -f "test_code_intelligence.py" ]; then
    echo "✓ Test file exists: test_code_intelligence.py"
    COMPONENTS=$(grep -c "def \|class " test_code_intelligence.py)
    echo "  - Contains $COMPONENTS components (classes + functions)"
else
    echo "❌ Test file missing"
fi

echo ""
echo "======================================================================"
echo "Ready for Testing"
echo "======================================================================"
echo ""
echo "Manual Test Steps:"
echo ""
echo "1. Start OpenCode CLI:"
echo "   cd repos/metabob-opencode"
echo "   opencode"
echo ""
echo "2. In OpenCode session, execute:"
echo "   > read ../../test_code_intelligence.py"
echo ""
echo "3. Verify enrichment in Redis:"
echo "   docker exec metabob-redis redis-cli --scan --pattern 'agent_execution:session:*' | \\"
echo "     xargs -I {} docker exec metabob-redis redis-cli GET {} | \\"
echo "     jq '.tool_invocations[] | select(.code_context != null)'"
echo ""
echo "4. Look for code_context fields with:"
echo "   - components: [class names, function names]"
echo "   - impact_score: numerical value"
echo "   - dependents_count, dependencies_count"
echo "   - similar_files: array"
echo ""
echo "======================================================================"
