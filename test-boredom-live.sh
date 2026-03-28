#!/bin/bash
echo "🧪 Testing Boredom System in DevBob Container"
echo ""

# Start ACP server
echo "📡 Starting ACP server..."
docker exec -d devbob-clean bash -c "cd /workspace && nohup opencode acp --port 3000 > /tmp/acp.log 2>&1 &"
sleep 5
echo "✓ ACP server started"
echo ""

# Create test session that will become idle
echo "📝 Creating test session..."
docker exec -d devbob-clean bash -c "cd /workspace && opencode --config /workspace/opencode.json 'Hello, testing boredom' > /tmp/session.log 2>&1 &"
sleep 3
echo "✓ Session started (will idle in 2 minutes)"
echo ""

# Monitor for 3 minutes
echo "⏰ Monitoring for boredom activity..."
for i in {1..9}; do
    echo "[$(date +%H:%M:%S)] Check $i/9"
    docker exec devbob-clean grep -i "boredom\|idle" /tmp/session.log 2>/dev/null | tail -2 || echo "  (no boredom activity yet)"
    sleep 20
done

echo ""
echo "📋 Session log:"
docker exec devbob-clean cat /tmp/session.log 2>/dev/null | tail -30
