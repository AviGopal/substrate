#!/bin/bash
# Test OpenCode in interactive mode with session tracking

cd /home/avi/documents/work/exp-repo/metabob-devbob/test-workspace

echo "Starting OpenCode interactive mode..."
echo "Instructions:"
echo "  1. Type: Read test.py"
echo "  2. Wait for response"
echo "  3. Type: exit"
echo ""
echo "We'll check Redis for sessions after you exit."
echo ""
echo "Press Enter to start..."
read

# Start OpenCode TUI
opencode

echo ""
echo "Checking Redis for sessions..."
docker exec metabob-redis redis-cli KEYS "agent_execution:session:*"

echo ""
echo "Done!"
