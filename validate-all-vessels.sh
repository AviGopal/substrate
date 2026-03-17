#!/bin/bash

echo "=================================================="
echo "Activity System - Full Vessel Validation"
echo "=================================================="
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

PASSED=0
FAILED=0

# Function to test endpoint
test_endpoint() {
    local name=$1
    local url=$2
    local expected_field=$3
    
    echo -n "Testing $name... "
    
    response=$(curl -s -w "\n%{http_code}" "$url" 2>/dev/null)
    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | head -n-1)
    
    if [ "$http_code" = "200" ]; then
        if echo "$body" | jq -e ".$expected_field" > /dev/null 2>&1; then
            echo -e "${GREEN}✓ PASSED${NC} (HTTP $http_code)"
            echo "   Response: $(echo "$body" | jq -c .)"
            ((PASSED++))
            return 0
        else
            echo -e "${RED}✗ FAILED${NC} (Missing field: $expected_field)"
            echo "   Response: $body"
            ((FAILED++))
            return 1
        fi
    else
        echo -e "${RED}✗ FAILED${NC} (HTTP $http_code)"
        echo "   Response: $body"
        ((FAILED++))
        return 1
    fi
}

# Test Activity API
echo "1. Activity API (http://localhost:8080)"
echo "----------------------------------------"
test_endpoint "Health Check" "http://localhost:8080/health" "status"
test_endpoint "List Templates" "http://localhost:8080/v2/activities/templates" "[0]"
echo ""

# Test MiniBob
echo "2. MiniBob (http://localhost:8081)"
echo "----------------------------------------"
test_endpoint "Health Check" "http://localhost:8081/health" "status"
echo ""

# Test Dashboard
echo "3. Activity Dashboard (http://localhost:3000)"
echo "----------------------------------------"
echo -n "Testing Dashboard... "
response=$(curl -s -w "\n%{http_code}" "http://localhost:3000/" 2>/dev/null)
http_code=$(echo "$response" | tail -n1)
body=$(echo "$response" | head -n-1)

if [ "$http_code" = "200" ] && echo "$body" | grep -q "<!doctype html"; then
    echo -e "${GREEN}✓ PASSED${NC} (HTTP $http_code)"
    echo "   Response: HTML page loaded successfully"
    ((PASSED++))
else
    echo -e "${RED}✗ FAILED${NC} (HTTP $http_code)"
    echo "   Response: $body"
    ((FAILED++))
fi
echo ""

# Test Kubernetes pods
echo "4. Kubernetes Pods"
echo "----------------------------------------"
pods=$(kubectl get pods -n activity-system --no-headers 2>/dev/null | wc -l)
running=$(kubectl get pods -n activity-system --no-headers 2>/dev/null | grep -c "Running")

echo "Total pods: $pods"
echo "Running pods: $running"

if [ "$running" -ge 5 ]; then
    echo -e "${GREEN}✓ PASSED${NC} (All pods running)"
    ((PASSED++))
else
    echo -e "${YELLOW}⚠ WARNING${NC} (Expected 5+ running pods)"
fi
echo ""

# Summary
echo "=================================================="
echo "VALIDATION SUMMARY"
echo "=================================================="
echo -e "Passed: ${GREEN}$PASSED${NC}"
echo -e "Failed: ${RED}$FAILED${NC}"
echo ""

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}✓ ALL VALIDATIONS PASSED!${NC}"
    exit 0
else
    echo -e "${RED}✗ SOME VALIDATIONS FAILED${NC}"
    exit 1
fi
