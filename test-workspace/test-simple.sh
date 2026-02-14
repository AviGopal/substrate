#!/bin/bash
# Simple test without opencode run command
cd /home/avi/documents/work/exp-repo/metabob-devbob/test-workspace
echo "Testing session tracking..."
echo ""
echo "Current sessions in Redis:"
docker exec metabob-redis redis-cli KEYS "agent_execution:session:*" | wc -l
