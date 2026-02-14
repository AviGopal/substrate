#!/bin/bash
# Quick test to inspect Redis agent execution data

echo "======================================================================"
echo "Redis Agent Execution Data Inspector"
echo "======================================================================"
echo ""

# Find all agent execution keys
echo "[1] Scanning for agent execution keys..."
KEYS=$(docker exec metabob-redis redis-cli --scan --pattern "agent_execution:*" 2>/dev/null)

if [ -z "$KEYS" ]; then
    echo "❌ No agent execution keys found"
    echo ""
    echo "This means either:"
    echo "- No OpenCode sessions have been run yet"
    echo "- The tracking system hasn't recorded any data"
    echo ""
    echo "Next steps:"
    echo "1. Start an OpenCode session"
    echo "2. Run a tool command (read, edit, etc.)"
    echo "3. Re-run this script"
    exit 0
fi

echo "✓ Found $(echo "$KEYS" | wc -l) keys"
echo ""

# Show all keys
echo "[2] Keys found:"
echo "$KEYS" | while read -r key; do
    if [ -n "$key" ]; then
        echo "  - $key"
    fi
done
echo ""

# Find session keys
SESSION_KEYS=$(echo "$KEYS" | grep "agent_execution:session:")

if [ -n "$SESSION_KEYS" ]; then
    echo "[3] Inspecting session data..."
    echo ""
    
    # Get the most recent session
    LATEST_SESSION=$(echo "$SESSION_KEYS" | head -1)
    
    if [ -n "$LATEST_SESSION" ]; then
        echo "Latest session: $LATEST_SESSION"
        echo ""
        
        # Get the data
        SESSION_DATA=$(docker exec metabob-redis redis-cli GET "$LATEST_SESSION" 2>/dev/null)
        
        if [ -n "$SESSION_DATA" ]; then
            # Pretty print if jq is available
            if command -v jq &> /dev/null; then
                echo "Session data:"
                echo "$SESSION_DATA" | jq '.'
                echo ""
                
                # Check for code_context in tool invocations
                HAS_CODE_CONTEXT=$(echo "$SESSION_DATA" | jq '.tool_invocations[]?.code_context' 2>/dev/null)
                
                if [ -n "$HAS_CODE_CONTEXT" ] && [ "$HAS_CODE_CONTEXT" != "null" ]; then
                    echo "✓✓✓ SUCCESS! code_context field found in tool invocations!"
                    echo ""
                    echo "Example code_context:"
                    echo "$SESSION_DATA" | jq '.tool_invocations[0].code_context' 2>/dev/null
                    echo ""
                    echo "======================================================================"
                    echo "✅ Agent Execution CLI Intelligence is WORKING!"
                    echo "======================================================================"
                else
                    echo "⚠️  code_context field not found (may be old data or non-file tool)"
                    echo ""
                    echo "Tool invocations:"
                    echo "$SESSION_DATA" | jq '.tool_invocations[]? | {tool: .tool_name, file: .file_path, has_context: .code_context != {}}' 2>/dev/null
                fi
            else
                echo "$SESSION_DATA"
                
                # Basic check for code_context without jq
                if echo "$SESSION_DATA" | grep -q "code_context"; then
                    echo ""
                    echo "✓ code_context field found!"
                else
                    echo ""
                    echo "⚠️  code_context field not found"
                fi
            fi
        fi
    fi
else
    echo "[3] No session keys found"
fi

echo ""
echo "======================================================================"
echo "To generate new test data:"
echo "1. Start OpenCode in repos/metabob-opencode:"
echo "   cd repos/metabob-opencode && opencode"
echo ""
echo "2. Run a command that uses files:"
echo "   > read src/some-file.ts"
echo ""
echo "3. Check Redis again:"
echo "   ./scripts/test-redis-data.sh"
echo "======================================================================"
