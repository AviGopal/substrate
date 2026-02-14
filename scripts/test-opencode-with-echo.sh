#!/bin/bash
# Test OpenCode by piping a message via stdin

cd /home/avi/documents/work/exp-repo/metabob-devbob/test-workspace

echo "Testing OpenCode with echo/pipe method..."
echo "Sending: 'Read test.py'"
echo ""

# Send message via stdin and exit immediately
echo -e "Read test.py\nexit" | timeout 20 opencode 2>&1 | head -100

echo ""
echo "Checking Redis for sessions..."
docker exec metabob-redis redis-cli KEYS "agent_execution:session:*"
