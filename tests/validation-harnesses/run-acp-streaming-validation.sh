#!/bin/bash
# Quick runner for ACP Bidirectional Streaming Protocol Handler validation
set -e

echo "🚀 ACP Bidirectional Streaming Protocol Handler Validation"
echo "=========================================================="
echo ""

# Check prerequisites
echo "📋 Checking prerequisites..."

# Check if DevBob is running
if ! kubectl get pods -n metabob -l app.kubernetes.io/name=devbob 2>/dev/null | grep -q Running; then
  echo "❌ DevBob pod is not running"
  echo "   Run: helmfile -e local -l app=devbob apply"
  exit 1
fi
echo "✅ DevBob pod is running"

# Check if test script exists
TEST_SCRIPT="../../repos/metabob-opencode/packages/opencode/test-acp-tcp-transport.ts"
if [ ! -f "$TEST_SCRIPT" ]; then
  echo "❌ Test script not found: $TEST_SCRIPT"
  exit 1
fi
echo "✅ Test script found"

# Check port forwarding (optional)
if ! curl -s http://localhost:8080/health > /dev/null 2>&1; then
  echo "⚠️  Port forwarding not active (optional)"
  echo "   To enable: kubectl port-forward -n metabob svc/devbob 8080:8080 &"
else
  echo "✅ Port forwarding active"
fi

echo ""
echo "📋 Running validation harness..."
echo ""

# Run the validation harness
bun run acp-bidirectional-streaming-protocol-handler-harness.ts

# Check exit code
if [ $? -eq 0 ]; then
  echo ""
  echo "🎉 All validation tests passed!"
  exit 0
else
  echo ""
  echo "❌ Some validation tests failed"
  exit 1
fi
