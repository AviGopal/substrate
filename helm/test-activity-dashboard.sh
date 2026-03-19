#!/bin/bash
# Test Activity Dashboard and API Deployment
# Quick verification script for local deployment

set -e

echo "🧪 Testing Activity Dashboard and API Deployment"
echo "================================================"
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test function
test_endpoint() {
    local name=$1
    local url=$2
    local expected=$3
    
    echo -n "Testing $name... "
    response=$(curl -s -o /dev/null -w "%{http_code}" "$url" 2>&1)
    
    if [ "$response" == "$expected" ]; then
        echo -e "${GREEN}✅ PASS${NC} (HTTP $response)"
    else
        echo -e "${RED}❌ FAIL${NC} (Expected $expected, got $response)"
        return 1
    fi
}

echo "📊 Checking Kubernetes Pods"
echo "----------------------------"
kubectl get pods -n activity-system

echo ""
echo "🌐 Testing Endpoints"
echo "-------------------"

# Test dashboard health
test_endpoint "Dashboard Health" "http://dashboard.minibob.local/health" "200"

# Test API health
test_endpoint "API Health" "http://api.minibob.local/health" "200"

# Test API templates endpoint
test_endpoint "API Templates" "http://api.minibob.local/v2/activities/templates" "200"

echo ""
echo "📝 Testing API Response Content"
echo "-------------------------------"

# Check templates count
template_count=$(curl -s http://api.minibob.local/v2/activities/templates | jq '.templates | length' 2>/dev/null)
if [ ! -z "$template_count" ] && [ "$template_count" -gt 0 ]; then
    echo -e "${GREEN}✅ Templates endpoint returns $template_count templates${NC}"
else
    echo -e "${RED}❌ Templates endpoint not returning data${NC}"
fi

echo ""
echo "🔍 Testing Dashboard UI"
echo "----------------------"

# Check if dashboard returns HTML
if curl -s http://dashboard.minibob.local | grep -q "<title>"; then
    echo -e "${GREEN}✅ Dashboard UI is serving HTML${NC}"
else
    echo -e "${RED}❌ Dashboard UI not serving HTML${NC}"
fi

echo ""
echo "🔗 Istio Configuration"
echo "---------------------"
echo "Gateway:"
kubectl get gateway -n activity-system activity-system-gateway -o jsonpath='{.spec.servers[0].hosts}' | jq -r '.'
echo ""
echo "VirtualServices:"
kubectl get virtualservice -n activity-system -o custom-columns=NAME:.metadata.name,HOSTS:.spec.hosts

echo ""
echo "✨ Test Summary"
echo "=============="
echo ""
echo "Dashboard: http://dashboard.minibob.local"
echo "API:       http://api.minibob.local"
echo ""
echo -e "${GREEN}All tests completed!${NC}"
