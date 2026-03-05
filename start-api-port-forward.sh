#!/bin/bash
# Port-forward metabob-rpc-api to localhost:8080
# This allows api.metabob.local (127.0.0.1) to reach the K8s API

echo "🔌 Starting port-forward for metabob-rpc-api..."
echo "   From: localhost:8080"
echo "   To:   metabob-rpc-api service (K8s)"
echo ""

# Kill any existing port-forward on 8080
EXISTING=$(lsof -ti:8080 2>/dev/null)
if [ -n "$EXISTING" ]; then
    echo "⚠️  Port 8080 already in use by PID: $EXISTING"
    echo "   Killing existing process..."
    kill $EXISTING 2>/dev/null
    sleep 1
fi

# Start port-forward in background
kubectl port-forward svc/metabob-rpc-api 8080:8080 > /tmp/metabob-api-port-forward.log 2>&1 &
PF_PID=$!

echo "   Port-forward started (PID: $PF_PID)"
echo "   Logs: /tmp/metabob-api-port-forward.log"
echo ""

# Wait for port-forward to be ready
echo "⏳ Waiting for port-forward to be ready..."
for i in {1..10}; do
    if timeout 1 curl -s http://localhost:8080/ > /dev/null 2>&1; then
        echo "✅ Port-forward is ready!"
        echo ""
        
        # Test API
        echo "📊 Testing API:"
        RESPONSE=$(curl -s http://localhost:8080/)
        echo "   Response: $RESPONSE"
        echo ""
        
        echo "✅ api.metabob.local is now accessible!"
        echo ""
        echo "To stop port-forward:"
        echo "   kill $PF_PID"
        echo ""
        echo "To check logs:"
        echo "   tail -f /tmp/metabob-api-port-forward.log"
        exit 0
    fi
    sleep 1
done

echo "❌ Port-forward failed to start"
echo "   Check logs: /tmp/metabob-api-port-forward.log"
kill $PF_PID 2>/dev/null
exit 1
