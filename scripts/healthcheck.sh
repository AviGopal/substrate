#!/bin/bash
# Health check script for devbob containers
# Checks if OpenCode ACP server is responding

# Check if ACP port is set, default to 3004
ACP_PORT=${ACP_PORT:-3004}

# Test 1: Check if the ACP port is listening
if ! nc -z localhost $ACP_PORT 2>/dev/null; then
    echo "❌ ACP server not listening on port $ACP_PORT"
    exit 1
fi

# Test 2: Check if opencode process is running
if ! pgrep -f "opencode" >/dev/null 2>&1; then
    echo "❌ OpenCode process not running"
    exit 1
fi

# Test 3: Check if opencode binary is available
if ! opencode --version >/dev/null 2>&1; then
    echo "❌ OpenCode binary not available"
    exit 1
fi

# Test 4: Check if metabob-cli is available (optional, for CLI container)
if command -v metabob-cli >/dev/null 2>&1; then
    if ! metabob-cli --help >/dev/null 2>&1; then
        echo "❌ Metabob CLI not working"
        exit 1
    fi
fi

echo "✅ Container healthy"
exit 0