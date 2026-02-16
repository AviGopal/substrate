#!/bin/bash
# Test if we can execute activity directly via OpenCode CLI

cd /home/avi/documents/work/exp-repo/metabob-devbob

echo "Testing direct activity execution via OpenCode CLI..."
echo ""

# Try to execute activity using CLI
~/.local/bin/opencode activity execute \
  --template-id="fix-bug-complete" \
  --variables='{"bug_description":"getUserProfile crashes with null user","affected_files":"test-cochange-learning/src/auth.ts"}' \
  --reason="Test cochange integration" \
  2>&1 | head -50
