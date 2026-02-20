#!/bin/bash
# Test bootstrap activity execution in devbob container
set -e

echo "=== Testing Bootstrap Activity Execution ==="
echo

echo "1. Testing hello-world-minimal activity..."
docker exec devbob-clean bash -c "
  cd /workspace && 
  timeout 120s opencode run -m anthropic/claude-3-7-sonnet-latest --prompt 'Execute the hello-world-minimal activity. This is a test of the bootstrap system.'
" 2>&1 | tee activity-execution-test.log | tail -100

echo
echo "✅ Activity test complete. Check activity-execution-test.log for full output"
