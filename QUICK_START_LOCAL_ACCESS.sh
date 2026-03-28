#!/bin/bash
# Quick start script for local Metabob K8s access

echo "=== Metabob Local K8s Quick Start ==="
echo ""

# Check if Istio ingress is running
echo "1. Checking Istio ingress gateway..."
INGRESS_IP=$(kubectl get svc -n istio-system istio-ingressgateway -o jsonpath='{.status.loadBalancer.ingress[0].hostname}')
if [ -z "$INGRESS_IP" ]; then
    INGRESS_IP=$(kubectl get svc -n istio-system istio-ingressgateway -o jsonpath='{.status.loadBalancer.ingress[0].ip}')
fi
echo "   Ingress IP: ${INGRESS_IP:-localhost}"

# Check gateway
echo ""
echo "2. Checking Istio gateway..."
kubectl get gateway -n metabob 2>/dev/null && echo "   ✅ Gateway found" || echo "   ❌ Gateway not found"

# Check virtual services
echo ""
echo "3. Checking VirtualServices..."
VS_COUNT=$(kubectl get virtualservice -n metabob 2>/dev/null | wc -l)
echo "   VirtualServices: $((VS_COUNT - 1))"

# Test connectivity
echo ""
echo "4. Testing metabob-rpc-api connectivity..."
RESPONSE=$(curl -s -H "Host: api.metabob.com" http://localhost/ | jq -r '.status' 2>/dev/null)
if [ "$RESPONSE" = "ok" ]; then
    echo "   ✅ metabob-rpc-api is accessible!"
else
    echo "   ❌ metabob-rpc-api not responding"
fi

echo ""
echo "=== Quick Access Commands ==="
echo ""
echo "# Health check"
echo "curl -H 'Host: api.metabob.com' http://localhost/"
echo ""
echo "# Activity templates"
echo "curl -H 'Host: api.metabob.com' http://localhost/v2/activities/templates"
echo ""
echo "# Analysis endpoint"
echo "curl -H 'Host: api.metabob.com' http://localhost/analysis"
echo ""
echo "=== Add to /etc/hosts for easier access ==="
echo "echo '127.0.0.1 api.metabob.com app.metabob.com devbob.metabob.com' | sudo tee -a /etc/hosts"
echo ""
echo "Then you can use: curl http://api.metabob.com/"
echo ""
