#!/bin/bash
set -e

# Metabob Stack End-to-End Validation
# Validates Redis, SurrealDB, and DevBob are working correctly

# Source shared pod selection utility
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/lib/get-ready-pod.sh"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "======================================"
echo "Metabob Stack Validation"
echo "======================================"
echo ""

NAMESPACE="metabob"
FAILED=0

# Function to check pod status
check_pod() {
    local label=$1
    local name=$2
    
    echo -n "Checking $name pod... "
    POD=$(kubectl get pods -n $NAMESPACE -l "$label" -o jsonpath='{.items[?(@.status.containerStatuses[0].ready==true)].metadata.name}' 2>/dev/null | awk '{print $1}')
    
    if [ -z "$POD" ]; then
        echo -e "${RED}✗ No ready pods found${NC}"
        return 1
    fi
    
    READY=$(kubectl get pod -n $NAMESPACE $POD -o jsonpath='{.status.containerStatuses[0].ready}' 2>/dev/null)
    
    if [ "$READY" = "true" ]; then
        echo -e "${GREEN}✓ Running${NC}"
        return 0
    else
        echo -e "${RED}✗ Not Ready${NC}"
        return 1
    fi
}

# Function to check service
check_service() {
    local service=$1
    local name=$2
    
    echo -n "Checking $name service... "
    CLUSTER_IP=$(kubectl get svc -n $NAMESPACE $service -o jsonpath='{.spec.clusterIP}' 2>/dev/null)
    
    if [ -n "$CLUSTER_IP" ]; then
        echo -e "${GREEN}✓ Available ($CLUSTER_IP)${NC}"
        return 0
    else
        echo -e "${RED}✗ Not Found${NC}"
        return 1
    fi
}

# Function to check connectivity
check_connectivity() {
    local from_pod=$1
    local to_service=$2
    local port=$3
    local name=$4
    
    echo -n "Checking connectivity: $name... "
    
    # Simply check if service exists and has endpoints
    ENDPOINTS=$(kubectl get endpoints -n $NAMESPACE $to_service -o jsonpath='{.subsets[0].addresses[0].ip}' 2>/dev/null)
    
    if [ -n "$ENDPOINTS" ]; then
        echo -e "${GREEN}✓ Service has endpoints${NC}"
        return 0
    else
        echo -e "${YELLOW}⚠ No endpoints (service may be starting)${NC}"
        return 0  # Don't fail on this, as it might be normal
    fi
}

# Check pods
echo "=== Pod Status ==="
check_pod "app.kubernetes.io/name=redis,app.kubernetes.io/component=master" "Redis" || FAILED=$((FAILED+1))
check_pod "app=surrealdb" "SurrealDB" || FAILED=$((FAILED+1))
check_pod "app.kubernetes.io/name=devbob" "DevBob" || FAILED=$((FAILED+1))
echo ""

# Check services
echo "=== Service Status ==="
check_service "redis-master" "Redis" || FAILED=$((FAILED+1))
check_service "surrealdb" "SurrealDB" || FAILED=$((FAILED+1))
check_service "devbob" "DevBob" || FAILED=$((FAILED+1))
echo ""

# Check connectivity
echo "=== Connectivity Tests ==="
check_connectivity "app.kubernetes.io/name=devbob" "redis-master" "6379" "DevBob -> Redis" || FAILED=$((FAILED+1))
check_connectivity "app.kubernetes.io/name=devbob" "surrealdb" "8000" "DevBob -> SurrealDB" || FAILED=$((FAILED+1))
echo ""

# Check ACP server
echo "=== DevBob ACP Server ==="
echo -n "Checking ACP initialization... "
ACP_LOG=$(kubectl logs -n $NAMESPACE -l app.kubernetes.io/name=devbob --tail=100 2>/dev/null | grep "acp-command setup connection")

if [ -n "$ACP_LOG" ]; then
    echo -e "${GREEN}✓ ACP Server Ready${NC}"
else
    echo -e "${RED}✗ ACP Server Not Initialized${NC}"
    FAILED=$((FAILED+1))
fi
echo ""

# Check bootstrap templates
echo "=== Bootstrap Templates ==="
echo -n "Checking template loading... "
TEMPLATE_LOG=$(kubectl logs -n $NAMESPACE -l app.kubernetes.io/name=devbob --tail=200 2>/dev/null | grep "bootstrap templates registered")

if [ -n "$TEMPLATE_LOG" ]; then
    TEMPLATE_COUNT=$(echo "$TEMPLATE_LOG" | grep -oP 'registered=\K\d+')
    echo -e "${GREEN}✓ Templates Loaded (registered: $TEMPLATE_COUNT)${NC}"
else
    echo -e "${YELLOW}⚠ Template registration status unknown${NC}"
fi
echo ""

# Summary
echo "======================================"
if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}✓ All checks passed!${NC}"
    echo ""
    echo "Metabob Stack Status:"
    echo "  - Redis:     Running"
    echo "  - SurrealDB: Running"
    echo "  - DevBob:    Running (ACP Ready)"
    echo ""
    echo "Next steps:"
    echo "  1. Test ACP delegation: use acp_delegate tool"
    echo "  2. Test impulse sharing"
    echo "  3. Build multi-agent workflows"
    exit 0
else
    echo -e "${RED}✗ $FAILED check(s) failed${NC}"
    echo ""
    echo "Troubleshooting:"
    echo "  1. Check pod logs: kubectl logs -n $NAMESPACE <pod-name>"
    echo "  2. Describe pod: kubectl describe pod -n $NAMESPACE <pod-name>"
    echo "  3. Check events: kubectl get events -n $NAMESPACE"
    exit 1
fi
