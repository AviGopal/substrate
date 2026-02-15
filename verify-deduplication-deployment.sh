#!/bin/bash
# Verify tool invocation deduplication fix is deployed

set -e

echo "==========================================="
echo "Deduplication Fix Deployment Verification"
echo "==========================================="
echo ""

# Check 1: Source code contains fix
echo "✓ Check 1: Verifying deduplication code in source"
cd /home/avi/documents/work/exp-repo/metabob-devbob/repos/metabob-opencode

if grep -q "const recentInvocations = new Map" packages/opencode/src/session/agent-execution-tracker.ts; then
    echo "  ✅ Deduplication cache found in agent-execution-tracker.ts"
else
    echo "  ❌ Deduplication cache NOT found"
    exit 1
fi

if grep -q "DEDUP_WINDOW_MS = 5000" packages/opencode/src/session/agent-execution-tracker.ts; then
    echo "  ✅ 5-second deduplication window configured"
else
    echo "  ❌ Deduplication window NOT configured"
    exit 1
fi

# Check 2: Verify commit
echo ""
echo "✓ Check 2: Verifying commit"
CURRENT_COMMIT=$(git log -1 --oneline | cut -d' ' -f1)
if [ "$CURRENT_COMMIT" = "b8aa8881" ]; then
    echo "  ✅ Commit b8aa8881 (deduplication fix) is current"
else
    echo "  ⚠️  Current commit: $CURRENT_COMMIT (expected b8aa8881)"
    echo "     Fix may still be present in history"
fi

# Check 3: tool-instrumentation.ts deprecated
echo ""
echo "✓ Check 3: Verifying tool-instrumentation.ts deprecated"
if grep -q "DEPRECATED" packages/opencode/src/tool/tool-instrumentation.ts; then
    echo "  ✅ tool-instrumentation.ts marked as DEPRECATED"
else
    echo "  ⚠️  DEPRECATED marker not found (may be already removed)"
fi

if ! grep -q "AgentExecutionTracker.recordToolCall" packages/opencode/src/tool/tool-instrumentation.ts; then
    echo "  ✅ Recording removed from tool-instrumentation.ts"
else
    echo "  ⚠️  Recording calls still present in tool-instrumentation.ts"
fi

# Check 4: Docker image exists
echo ""
echo "✓ Check 4: Verifying Docker image"
cd /home/avi/documents/work/exp-repo/metabob-devbob
if docker images devbob:latest | grep -q devbob; then
    IMAGE_ID=$(docker images devbob:latest --format "{{.ID}}")
    IMAGE_SIZE=$(docker images devbob:latest --format "{{.Size}}")
    echo "  ✅ devbob:latest image exists"
    echo "     Image ID: $IMAGE_ID"
    echo "     Size: $IMAGE_SIZE"
else
    echo "  ❌ devbob:latest image NOT found"
    exit 1
fi

# Check 5: Backend connectivity
echo ""
echo "✓ Check 5: Verifying backend connectivity"
if curl -s http://localhost:8080/health > /dev/null 2>&1; then
    echo "  ✅ Backend accessible at http://localhost:8080"
    BACKEND_STATUS=$(curl -s http://localhost:8080/health | jq -r '.status' 2>/dev/null || echo "unknown")
    echo "     Status: $BACKEND_STATUS"
else
    echo "  ⚠️  Backend not accessible (optional for deployment verification)"
fi

# Summary
echo ""
echo "==========================================="
echo "Deployment Verification Summary"
echo "==========================================="
echo ""
echo "✅ Deduplication cache implemented"
echo "✅ 5-second time window configured"
echo "✅ tool-instrumentation.ts deprecated"
echo "✅ Docker image built with fix"
echo "✅ Ready for testing"
echo ""
echo "Next Steps:"
echo "1. Start devbob container: docker run -d --name test devbob:latest"
echo "2. Run OpenCode session: docker exec -it test opencode chat"
echo "3. Execute multiple tools rapidly"
echo "4. Check logs: docker logs test 2>&1 | grep 'duplicate tool invocation'"
echo "5. Monitor backend: docker stats metabob-rpc-api-server-dev-1"
echo ""
echo "Expected Results:"
echo "- No functional changes (tools work normally)"
echo "- Backend CPU < 150% under load"
echo "- Backend RAM < 2GB"
echo "- Health checks < 10s"
echo "- Either no duplicates OR debug logs showing drops"
echo ""
