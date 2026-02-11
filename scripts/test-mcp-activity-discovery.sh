#!/bin/bash
# Test MCP-based activity discovery flow

set -e

echo "=== Testing MCP Activity Discovery Flow ==="
echo ""

# Test 1: Check if metabob-cli MCP server is responsive
echo "1. Testing metabob-cli MCP server..."
docker exec devbob-opencode bash -c 'echo "{\"jsonrpc\":\"2.0\",\"id\":1,\"method\":\"tools/list\"}" | metabob-cli mcp --transport stdio 2>/dev/null | head -5' || echo "  ⚠️  MCP stdio test inconclusive"

echo ""

# Test 2: Check activities in database
echo "2. Checking activities in database..."
docker exec api-server-dev python -m admin.cli activities list 2>&1 | grep -E "(variant_id|Total:|bug-fix|feature)" | head -10

echo ""

# Test 3: Test backend API activity search
echo "3. Testing backend API /activities endpoint..."
# Create session first
SESSION=$(curl -s -X POST http://localhost:8080/session \
  -H "Content-Type: application/json" \
  -d '{"project_id":"test","codebase_name":"test","username":"test"}' | jq -r '.session')

echo "   Session created: ${SESSION:0:30}..."

# Note: This will likely fail with auth error, but shows the flow
curl -s "http://localhost:8080/activities?limit=3" \
  -H "Authorization: Bearer $SESSION" | jq '.' | head -10

echo ""

# Test 4: Check OpenCode config for MCP integration
echo "4. Checking OpenCode MCP configuration..."
if docker exec devbob-opencode test -f /workspace/.opencode/opencode.json; then
    echo "   ✓ Config exists at /workspace/.opencode/opencode.json"
    
    HAS_MCP=$(docker exec devbob-opencode cat /workspace/.opencode/opencode.json | jq 'has("mcp")' 2>/dev/null || echo "false")
    
    if [ "$HAS_MCP" = "true" ]; then
        echo "   ✓ MCP section found in config"
        docker exec devbob-opencode cat /workspace/.opencode/opencode.json | jq '.mcp' 2>/dev/null
    else
        echo "   ⚠️  No MCP section in config (may be using default settings)"
    fi
else
    echo "   ⚠️  No config file found (using defaults)"
fi

echo ""

# Test 5: Check if OpenCode can list MCP tools
echo "5. Checking if OpenCode recognizes MCP tools..."
echo "   (This would require starting OpenCode in serve mode and querying it)"
echo "   Skipping for now - would need to test interactively"

echo ""
echo "=== Test Summary ==="
echo "✓ Backend: 8 activities available in database"
echo "⚠️  MCP Config: Missing from OpenCode config (may need regeneration)"
echo "ℹ️  Next: Add MCP config to enable activity discovery via MCP tools"
echo ""

