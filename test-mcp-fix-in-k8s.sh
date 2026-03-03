#!/bin/bash
set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}Test MCP Architecture Fix in K8s${NC}"
echo -e "${BLUE}========================================${NC}\n"

DEVBOB_POD="devbob-6f744bd7ff-967b8"
NAMESPACE="metabob"

# Step 1: Copy fixed file to devbob pod
echo -e "${YELLOW}[Step 1]${NC} Copy fixed template-metrics-client.ts to devbob pod"

# First, build the TypeScript to get the JavaScript output
echo "Building metabob-opencode locally..."
cd repos/metabob-opencode
npm run build 2>&1 | tail -5 || true
cd ../..

if [ ! -f "repos/metabob-opencode/dist/session/template-metrics-client.js" ]; then
    echo -e "${RED}ERROR: Build failed${NC}"
    exit 1
fi

echo "Copying dist file to pod..."
kubectl cp \
    repos/metabob-opencode/dist/session/template-metrics-client.js \
    $NAMESPACE/$DEVBOB_POD:/opt/opencode/dist/session/template-metrics-client.js

echo -e "${GREEN}✓${NC} File copied\n"

# Step 2: Verify the fix in the pod
echo -e "${YELLOW}[Step 2]${NC} Verify MCP tool name in deployed code"

kubectl exec -n $NAMESPACE $DEVBOB_POD -- sh -c '
    if grep -q "metabob_post_activity_result" /opt/opencode/dist/session/template-metrics-client.js; then
        echo "✓ Found correct MCP tool name: metabob_post_activity_result"
    else
        echo "✗ MCP tool name not found or incorrect"
        exit 1
    fi
'

echo ""

# Step 3: Test MCP tool call
echo -e "${YELLOW}[Step 3]${NC} Test MCP tool invocation"
echo "Creating test script..."

kubectl exec -n $NAMESPACE $DEVBOB_POD -- sh -c 'cat > /tmp/test-mcp.js << '\''TESTEOF'\''
const { TemplateMetricsClient } = require("/opt/opencode/dist/session/template-metrics-client.js");

async function testMCPCall() {
    console.log("Testing MCP tool call...");
    
    const testData = {
        activity_id: "test-activity-123",
        template_id: "test-template",
        success: true,
        duration: 1000,
        cost: 0.01,
        tokens: {
            input: 100,
            output: 50,
            cache: 0
        }
    };
    
    try {
        await TemplateMetricsClient.reportExecution(testData);
        console.log("✓ MCP call completed (check logs for result)");
    } catch (error) {
        console.log("✗ MCP call failed:", error.message);
    }
}

testMCPCall().catch(console.error);
TESTEOF
'

echo "Running test..."
kubectl exec -n $NAMESPACE $DEVBOB_POD -- node /tmp/test-mcp.js 2>&1

echo ""

# Step 4: Check MCP server availability
echo -e "${YELLOW}[Step 4]${NC} Check metabob-cli MCP server status"

# Check if metabob-cli is available
kubectl exec -n $NAMESPACE $DEVBOB_POD -- which opencode 2>&1 || echo "opencode CLI not in PATH"

# Check opencode config
echo "Checking opencode.json MCP configuration..."
kubectl exec -n $NAMESPACE $DEVBOB_POD -- cat /workspace/.config/opencode/opencode.json 2>&1 | grep -A 5 "mcp" || echo "No MCP config found"

echo ""

# Step 5: Test with actual activity execution
echo -e "${YELLOW}[Step 5]${NC} Execute test activity to trigger metrics recording"

kubectl exec -n $NAMESPACE $DEVBOB_POD -- sh -c '
cd /workspace
echo "Listing available activities..."
opencode activity:list 2>&1 | head -10 || echo "Activity list failed"
'

echo ""
echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}TEST SUMMARY${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""
echo "Results:"
echo "  1. ✓ Fixed code deployed to pod"
echo "  2. ✓ MCP tool name verified"
echo "  3. Test MCP call (see output above)"
echo "  4. MCP server status (see output above)"
echo "  5. Activity execution test (see output above)"
echo ""
echo "Next: Check if execution was recorded in database"
echo "  kubectl exec -n $NAMESPACE $DEVBOB_POD -- curl -X POST http://surrealdb:8000/sql \\"
echo "    -u 'root:changeme' \\"
echo "    -d 'USE NS metabob DB devbob; SELECT * FROM activity_execution LIMIT 5;'"
echo ""
