#!/bin/bash
# Verify Activity Dashboard + API deployment
set -e

echo "🔍 Activity Dashboard Deployment Verification"
echo "=============================================="
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check kubectl context
echo "📍 Kubernetes Context:"
CONTEXT=$(kubectl config current-context)
if [ "$CONTEXT" == "docker-desktop" ]; then
    echo -e "${GREEN}✓${NC} Using docker-desktop"
else
    echo -e "${YELLOW}⚠${NC}  Not using docker-desktop (found: $CONTEXT)"
fi
echo ""

# Check namespace
echo "📦 Namespace Status:"
if kubectl get namespace activity-system &> /dev/null; then
    echo -e "${GREEN}✓${NC} activity-system namespace exists"
    ISTIO_LABEL=$(kubectl get namespace activity-system -o jsonpath='{.metadata.labels.istio-injection}')
    if [ "$ISTIO_LABEL" == "enabled" ]; then
        echo -e "${GREEN}✓${NC} Istio injection enabled"
    else
        echo -e "${RED}✗${NC} Istio injection not enabled"
    fi
else
    echo -e "${RED}✗${NC} activity-system namespace missing"
    exit 1
fi
echo ""

# Check pods
echo "🚀 Pod Status:"
kubectl get pods -n activity-system | grep -E "NAME|activity-dashboard|metabob-activity-api|redis|surrealdb" | while read line; do
    if echo "$line" | grep -q "Running"; then
        echo -e "${GREEN}✓${NC} $line"
    elif echo "$line" | grep -q "NAME"; then
        echo "$line"
    else
        echo -e "${RED}✗${NC} $line"
    fi
done
echo ""

# Check services
echo "🌐 Service Status:"
kubectl get svc -n activity-system | grep -E "NAME|activity-dashboard|metabob-activity-api|redis|surrealdb" | while read line; do
    if echo "$line" | grep -qE "ClusterIP|LoadBalancer"; then
        echo -e "${GREEN}✓${NC} $line"
    elif echo "$line" | grep -q "NAME"; then
        echo "$line"
    else
        echo "$line"
    fi
done
echo ""

# Check Istio resources
echo "🔀 Istio Configuration:"
if kubectl get gateway activity-system-gateway -n activity-system &> /dev/null; then
    echo -e "${GREEN}✓${NC} Gateway: activity-system-gateway exists"
else
    echo -e "${RED}✗${NC} Gateway missing"
fi

if kubectl get virtualservice activity-dashboard -n activity-system &> /dev/null; then
    echo -e "${GREEN}✓${NC} VirtualService: activity-dashboard exists"
else
    echo -e "${RED}✗${NC} VirtualService: activity-dashboard missing"
fi

if kubectl get virtualservice metabob-activity-api -n activity-system &> /dev/null; then
    echo -e "${GREEN}✓${NC} VirtualService: metabob-activity-api exists"
else
    echo -e "${RED}✗${NC} VirtualService: metabob-activity-api missing"
fi
echo ""

# Check Istio ingress gateway
echo "🚪 Istio Ingress Gateway:"
INGRESS_IP=$(kubectl get svc istio-ingressgateway -n istio-system -o jsonpath='{.status.loadBalancer.ingress[0].ip}')
INGRESS_HOSTNAME=$(kubectl get svc istio-ingressgateway -n istio-system -o jsonpath='{.status.loadBalancer.ingress[0].hostname}')
if [ -n "$INGRESS_IP" ]; then
    echo -e "${GREEN}✓${NC} External IP: $INGRESS_IP"
elif [ -n "$INGRESS_HOSTNAME" ]; then
    echo -e "${GREEN}✓${NC} External Hostname: $INGRESS_HOSTNAME"
else
    echo -e "${YELLOW}⚠${NC}  No external IP/hostname (checking localhost)"
fi
echo ""

# Check /etc/hosts
echo "📝 DNS Configuration (/etc/hosts):"
if grep -q "dashboard.minibob.local" /etc/hosts && grep -q "api.minibob.local" /etc/hosts; then
    HOSTS_LINE=$(grep "minibob.local" /etc/hosts)
    if echo "$HOSTS_LINE" | grep -q ","; then
        echo -e "${RED}✗${NC} Syntax error in /etc/hosts (commas found):"
        echo "  $HOSTS_LINE"
        echo ""
        echo -e "${YELLOW}Fix with:${NC} sudo bash helm/fix-hosts.sh"
    else
        echo -e "${GREEN}✓${NC} Hosts configured correctly:"
        echo "  $HOSTS_LINE"
    fi
else
    echo -e "${RED}✗${NC} Missing entries in /etc/hosts"
    echo ""
    echo -e "${YELLOW}Add this line to /etc/hosts:${NC}"
    echo "127.0.0.1  dashboard.minibob.local api.minibob.local"
fi
echo ""

# Test endpoints
echo "🏥 Health Check:"

echo -n "API (http://api.minibob.local/health): "
API_STATUS=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 http://api.minibob.local/health 2>/dev/null || echo "000")
if [ "$API_STATUS" == "200" ]; then
    echo -e "${GREEN}✓${NC} $API_STATUS OK"
elif [ "$API_STATUS" == "000" ]; then
    echo -e "${RED}✗${NC} Connection failed (check DNS or Istio)"
else
    echo -e "${YELLOW}⚠${NC}  Status: $API_STATUS"
fi

echo -n "Dashboard (http://dashboard.minibob.local/): "
DASH_STATUS=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 http://dashboard.minibob.local/ 2>/dev/null || echo "000")
if [ "$DASH_STATUS" == "200" ]; then
    echo -e "${GREEN}✓${NC} $DASH_STATUS OK"
elif [ "$DASH_STATUS" == "000" ]; then
    echo -e "${RED}✗${NC} Connection failed (check DNS or Istio)"
else
    echo -e "${YELLOW}⚠${NC}  Status: $DASH_STATUS"
fi
echo ""

# Summary
echo "📊 Summary:"
echo "==========="
if [ "$API_STATUS" == "200" ] && [ "$DASH_STATUS" == "200" ]; then
    echo -e "${GREEN}✓${NC} All systems operational!"
    echo ""
    echo "Access URLs:"
    echo "  • Dashboard: http://dashboard.minibob.local"
    echo "  • API: http://api.minibob.local"
elif grep -q "," /etc/hosts | grep -q "minibob"; then
    echo -e "${YELLOW}⚠${NC}  Fix /etc/hosts syntax, then retest"
    echo ""
    echo "Run: sudo bash helm/fix-hosts.sh"
else
    echo -e "${RED}✗${NC} Issues detected. Check logs:"
    echo ""
    echo "  kubectl logs -n activity-system -l app.kubernetes.io/name=activity-dashboard"
    echo "  kubectl logs -n activity-system -l app.kubernetes.io/name=metabob-activity-api"
fi
echo ""
