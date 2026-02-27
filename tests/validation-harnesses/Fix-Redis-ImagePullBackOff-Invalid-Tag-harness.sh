#!/bin/bash
# Validation Harness Runner for Fix-Redis-ImagePullBackOff-Invalid-Tag
# This is a shell wrapper for environments without TypeScript

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

echo "🔍 Running Validation Harness: Fix-Redis-ImagePullBackOff-Invalid-Tag"
echo ""

PASSED=0
FAILED=0
TOTAL=0

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Test Case 1: Verify image.tag override exists in local.redis.values.yaml
echo "Test 1: Image Tag Override Exists"
TOTAL=$((TOTAL + 1))
VALUES_FILE="$PROJECT_ROOT/repos/platform/deployments/metabob/charts/redis/values/local.redis.values.yaml"
if [ -f "$VALUES_FILE" ]; then
    if grep -q "image:" "$VALUES_FILE" && grep -q "tag:" "$VALUES_FILE"; then
        TAG=$(grep -A1 "^image:" "$VALUES_FILE" | grep "tag:" | awk '{print $2}')
        if [ "$TAG" != "7.4.1-debian-12-r2" ] && [ "$TAG" != "7.0.12-debian-11-r0" ] && [ -n "$TAG" ]; then
            echo -e "  ${GREEN}✅ PASS${NC} - Found valid image.tag override: $TAG"
            PASSED=$((PASSED + 1))
        else
            echo -e "  ${RED}❌ FAIL${NC} - Invalid or missing tag: $TAG"
            FAILED=$((FAILED + 1))
        fi
    else
        echo -e "  ${RED}❌ FAIL${NC} - No image.tag override found"
        FAILED=$((FAILED + 1))
    fi
else
    echo -e "  ${RED}❌ FAIL${NC} - Values file not found"
    FAILED=$((FAILED + 1))
fi
echo ""

# Test Case 2: Verify Redis pod is in Running phase
echo "Test 2: Pod Phase is Running"
TOTAL=$((TOTAL + 1))
POD_PHASE=$(kubectl get pod -n metabob redis-master-0 -o jsonpath='{.status.phase}' 2>/dev/null || echo "NotFound")
if [ "$POD_PHASE" = "Running" ]; then
    echo -e "  ${GREEN}✅ PASS${NC} - Pod phase: $POD_PHASE"
    PASSED=$((PASSED + 1))
else
    echo -e "  ${RED}❌ FAIL${NC} - Pod phase: $POD_PHASE (expected: Running)"
    FAILED=$((FAILED + 1))
fi
echo ""

# Test Case 3: Verify container is not in ImagePullBackOff state
echo "Test 3: No ImagePullBackOff State"
TOTAL=$((TOTAL + 1))
CONTAINER_STATE=$(kubectl get pod -n metabob redis-master-0 -o jsonpath='{.status.containerStatuses[0].state}' 2>/dev/null || echo "{}")
if echo "$CONTAINER_STATE" | grep -q "ImagePullBackOff\|ErrImagePull"; then
    echo -e "  ${RED}❌ FAIL${NC} - Container in ImagePullBackOff state"
    FAILED=$((FAILED + 1))
else
    echo -e "  ${GREEN}✅ PASS${NC} - Container not in ImagePullBackOff state"
    PASSED=$((PASSED + 1))
fi
echo ""

# Test Case 4: Verify Redis connectivity with redis-cli ping
echo "Test 4: Redis Connectivity (PING)"
TOTAL=$((TOTAL + 1))
PING_RESULT=$(kubectl exec -n metabob redis-master-0 -- redis-cli ping 2>/dev/null || echo "FAILED")
if [ "$PING_RESULT" = "PONG" ]; then
    echo -e "  ${GREEN}✅ PASS${NC} - Redis responding: $PING_RESULT"
    PASSED=$((PASSED + 1))
else
    echo -e "  ${RED}❌ FAIL${NC} - Redis not responding: $PING_RESULT (expected: PONG)"
    FAILED=$((FAILED + 1))
fi
echo ""

# Test Case 5: Verify PVC is bound and persistence is working
echo "Test 5: PVC Bound and Persistence"
TOTAL=$((TOTAL + 1))
PVC_STATUS=$(kubectl get pvc -n metabob redis-data-redis-master-0 -o jsonpath='{.status.phase}' 2>/dev/null || echo "NotFound")
if [ "$PVC_STATUS" = "Bound" ]; then
    PVC_SIZE=$(kubectl get pvc -n metabob redis-data-redis-master-0 -o jsonpath='{.spec.resources.requests.storage}' 2>/dev/null)
    echo -e "  ${GREEN}✅ PASS${NC} - PVC status: $PVC_STATUS, Size: $PVC_SIZE"
    PASSED=$((PASSED + 1))
else
    echo -e "  ${RED}❌ FAIL${NC} - PVC status: $PVC_STATUS (expected: Bound)"
    FAILED=$((FAILED + 1))
fi
echo ""

# Test Case 6: Verify pod image is valid
echo "Test 6: Pod Using Valid Image"
TOTAL=$((TOTAL + 1))
POD_IMAGE=$(kubectl get pod -n metabob redis-master-0 -o jsonpath='{.spec.containers[0].image}' 2>/dev/null || echo "NotFound")
if echo "$POD_IMAGE" | grep -q "bitnami/redis"; then
    if echo "$POD_IMAGE" | grep -q "7.4.1-debian-12-r2\|7.0.12-debian-11-r0"; then
        echo -e "  ${RED}❌ FAIL${NC} - Pod using invalid image: $POD_IMAGE"
        FAILED=$((FAILED + 1))
    else
        echo -e "  ${GREEN}✅ PASS${NC} - Pod using valid image: $POD_IMAGE"
        PASSED=$((PASSED + 1))
    fi
else
    echo -e "  ${RED}❌ FAIL${NC} - Pod not using bitnami/redis image: $POD_IMAGE"
    FAILED=$((FAILED + 1))
fi
echo ""

# Summary
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📈 Summary:"
echo "   Total:  $TOTAL"
echo "   Passed: $PASSED"
echo "   Failed: $FAILED"
if [ $FAILED -eq 0 ]; then
    echo -e "   Status: ${GREEN}✅ ALL TESTS PASSED${NC}"
    exit 0
else
    echo -e "   Status: ${RED}❌ SOME TESTS FAILED${NC}"
    exit 1
fi
