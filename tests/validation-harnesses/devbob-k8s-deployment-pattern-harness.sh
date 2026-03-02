#!/bin/bash
# Validation Harness: devbob-k8s-deployment-pattern
# 
# Validates the DevBob Kubernetes deployment pattern per specification:
# - DevBob pod starts successfully (Ready 1/1 within 60s)
# - ACP server listening on http://0.0.0.0:8080
# - Health endpoint returns 200
# - Secrets properly injected (ANTHROPIC_API_KEY)
# - Backend services accessible via DNS
# 
# Usage:
#   ./devbob-k8s-deployment-pattern-harness.sh [--namespace metabob] [--timeout 60]

set -euo pipefail

# Configuration
NAMESPACE="${NAMESPACE:-metabob}"
TIMEOUT="${TIMEOUT:-60}"
OUTPUT_FILE="validation-results-devbob-k8s-deployment-pattern.json"

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --namespace=*)
            NAMESPACE="${1#*=}"
            shift
            ;;
        --timeout=*)
            TIMEOUT="${1#*=}"
            shift
            ;;
        *)
            echo "Unknown option: $1"
            exit 1
            ;;
    esac
done

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test results
PASS_COUNT=0
FAIL_COUNT=0
declare -a TEST_RESULTS

# Helper: Print test result
print_result() {
    local test_name="$1"
    local pass="$2"
    local message="$3"
    
    if [ "$pass" == "true" ]; then
        echo -e "${GREEN}✅ PASS${NC} $test_name"
        ((PASS_COUNT++))
        TEST_RESULTS+=("$test_name:PASS:$message")
    else
        echo -e "${RED}❌ FAIL${NC} $test_name"
        echo -e "   ${RED}$message${NC}"
        ((FAIL_COUNT++))
        TEST_RESULTS+=("$test_name:FAIL:$message")
    fi
}

# Helper: Get pod name
get_pod_name() {
    kubectl get pods -n "$NAMESPACE" -l app.kubernetes.io/name=devbob -o jsonpath='{.items[0].metadata.name}' 2>/dev/null || echo ""
}

# Helper: Wait for pod to be ready
wait_for_pod_ready() {
    local max_wait="$1"
    local start_time=$(date +%s)
    local end_time=$((start_time + max_wait))
    
    while [ $(date +%s) -lt $end_time ]; do
        local pod_name=$(get_pod_name)
        if [ -z "$pod_name" ]; then
            echo "Waiting for pod to be created..."
            sleep 2
            continue
        fi
        
        local ready_status=$(kubectl get pod "$pod_name" -n "$NAMESPACE" -o jsonpath='{.status.conditions[?(@.type=="Ready")].status}' 2>/dev/null || echo "False")
        
        if [ "$ready_status" == "True" ]; then
            echo "Pod $pod_name is ready!"
            return 0
        fi
        
        echo "Pod $pod_name not ready yet ($ready_status), waiting..."
        sleep 2
    done
    
    return 1
}

echo "======================================================================"
echo "DevBob K8s Deployment Pattern Validation"
echo "======================================================================"
echo "Namespace: $NAMESPACE"
echo "Timeout: ${TIMEOUT}s"
echo "======================================================================"
echo

# Test 1: Pod Starts Successfully (Ready 1/1)
echo "[Test 1/7] Checking if pod is ready within ${TIMEOUT}s..."
START_TIME=$(date +%s)
if wait_for_pod_ready "$TIMEOUT"; then
    POD_NAME=$(get_pod_name)
    DURATION=$(($(date +%s) - START_TIME))
    print_result "pod-ready" "true" "Pod $POD_NAME ready in ${DURATION}s"
else
    print_result "pod-ready" "false" "Pod did not become ready within ${TIMEOUT}s"
fi
echo

# Get pod name for subsequent tests
POD_NAME=$(get_pod_name)
if [ -z "$POD_NAME" ]; then
    echo -e "${RED}ERROR: Could not find devbob pod. Remaining tests will fail.${NC}"
    echo
fi

# Test 2: ACP Server Listening on Port 8080
echo "[Test 2/7] Checking if ACP server is listening on port 8080..."
if [ -n "$POD_NAME" ]; then
    LOGS=$(kubectl logs "$POD_NAME" -n "$NAMESPACE" --tail=200 2>/dev/null || echo "")
    
    if echo "$LOGS" | grep -qi "listening.*8080\|ACP.*8080\|server.*listening.*8080"; then
        LISTENING_LINE=$(echo "$LOGS" | grep -i "listening.*8080\|ACP.*8080" | tail -1)
        print_result "acp-server-listening" "true" "Found: $LISTENING_LINE"
    else
        print_result "acp-server-listening" "false" "No 'listening on port 8080' message found in logs"
    fi
else
    print_result "acp-server-listening" "false" "Pod not found"
fi
echo

# Test 3: Health Endpoint Returns 200
echo "[Test 3/7] Testing health endpoint at http://localhost:8080/health..."
if [ -n "$POD_NAME" ]; then
    HTTP_CODE=$(kubectl exec "$POD_NAME" -n "$NAMESPACE" -- curl -s -w "%{http_code}" -o /dev/null http://localhost:8080/health 2>/dev/null || echo "0")
    
    if [ "$HTTP_CODE" == "200" ]; then
        print_result "health-endpoint" "true" "HTTP 200 OK"
    else
        print_result "health-endpoint" "false" "HTTP $HTTP_CODE (expected 200)"
    fi
else
    print_result "health-endpoint" "false" "Pod not found"
fi
echo

# Test 4: Secrets Properly Injected
echo "[Test 4/7] Verifying ANTHROPIC_API_KEY is set..."
if [ -n "$POD_NAME" ]; then
    ANTHROPIC_KEY=$(kubectl exec "$POD_NAME" -n "$NAMESPACE" -- sh -c 'echo $ANTHROPIC_API_KEY' 2>/dev/null || echo "")
    
    if [ -n "$ANTHROPIC_KEY" ] && [ "$ANTHROPIC_KEY" != "" ]; then
        KEY_LENGTH=${#ANTHROPIC_KEY}
        print_result "secrets-injected" "true" "ANTHROPIC_API_KEY set (length: $KEY_LENGTH)"
    else
        print_result "secrets-injected" "false" "ANTHROPIC_API_KEY not set or empty"
    fi
else
    print_result "secrets-injected" "false" "Pod not found"
fi
echo

# Test 5: Backend Services Accessible
echo "[Test 5/7] Testing connectivity to backend services..."
if [ -n "$POD_NAME" ]; then
    ALL_ACCESSIBLE=true
    
    # Test redis
    echo "  - Checking redis-master.metabob.svc.cluster.local:6379..."
    if kubectl exec "$POD_NAME" -n "$NAMESPACE" -- nslookup redis-master.metabob.svc.cluster.local >/dev/null 2>&1; then
        echo "    ✓ DNS resolved"
    else
        echo "    ✗ DNS failed"
        ALL_ACCESSIBLE=false
    fi
    
    # Test surrealdb
    echo "  - Checking surrealdb.metabob.svc.cluster.local:8000..."
    if kubectl exec "$POD_NAME" -n "$NAMESPACE" -- nslookup surrealdb.metabob.svc.cluster.local >/dev/null 2>&1; then
        echo "    ✓ DNS resolved"
    else
        echo "    ✗ DNS failed"
        ALL_ACCESSIBLE=false
    fi
    
    # Test metabob-rpc-api
    echo "  - Checking metabob-rpc-api.metabob.svc.cluster.local:80..."
    if kubectl exec "$POD_NAME" -n "$NAMESPACE" -- nslookup metabob-rpc-api.metabob.svc.cluster.local >/dev/null 2>&1; then
        echo "    ✓ DNS resolved"
    else
        echo "    ✗ DNS failed"
        ALL_ACCESSIBLE=false
    fi
    
    if [ "$ALL_ACCESSIBLE" == "true" ]; then
        print_result "backend-services" "true" "All backend services accessible via DNS"
    else
        print_result "backend-services" "false" "Some backend services not accessible"
    fi
else
    print_result "backend-services" "false" "Pod not found"
fi
echo

# Test 6: Pod Configuration (Image, Restarts, Args)
echo "[Test 6/7] Checking pod configuration..."
if [ -n "$POD_NAME" ]; then
    POD_JSON=$(kubectl get pod "$POD_NAME" -n "$NAMESPACE" -o json 2>/dev/null || echo "{}")
    
    IMAGE=$(echo "$POD_JSON" | jq -r '.spec.containers[0].image')
    PULL_POLICY=$(echo "$POD_JSON" | jq -r '.spec.containers[0].imagePullPolicy')
    RESTART_COUNT=$(echo "$POD_JSON" | jq -r '.status.containerStatuses[0].restartCount')
    ARGS=$(echo "$POD_JSON" | jq -r '.spec.containers[0].args[]' 2>/dev/null | tr '\n' ' ')
    
    CONFIG_OK=true
    CONFIG_ISSUES=""
    
    if ! echo "$IMAGE" | grep -q "latest"; then
        CONFIG_OK=false
        CONFIG_ISSUES="$CONFIG_ISSUES Image tag not 'latest' (got: $IMAGE);"
    fi
    
    if [ "$PULL_POLICY" != "Never" ]; then
        CONFIG_OK=false
        CONFIG_ISSUES="$CONFIG_ISSUES imagePullPolicy not 'Never' (got: $PULL_POLICY);"
    fi
    
    if [ "$RESTART_COUNT" != "0" ]; then
        CONFIG_OK=false
        CONFIG_ISSUES="$CONFIG_ISSUES Restart count is $RESTART_COUNT (expected 0);"
    fi
    
    if ! echo "$ARGS" | grep -q -- "--print-logs"; then
        CONFIG_OK=false
        CONFIG_ISSUES="$CONFIG_ISSUES Missing --print-logs flag in args;"
    fi
    
    if [ "$CONFIG_OK" == "true" ]; then
        print_result "pod-configuration" "true" "Image: $IMAGE, Pull: $PULL_POLICY, Restarts: $RESTART_COUNT"
    else
        print_result "pod-configuration" "false" "$CONFIG_ISSUES"
    fi
else
    print_result "pod-configuration" "false" "Pod not found"
fi
echo

# Test 7: Deployment Method (Helm vs StatefulSet)
echo "[Test 7/7] Verifying deployment uses Helm chart (canonical method)..."

# Check if Helm release exists
HELM_EXISTS=false
if helm list -n "$NAMESPACE" -o json 2>/dev/null | jq -e '.[] | select(.name=="devbob")' >/dev/null 2>&1; then
    HELM_EXISTS=true
fi

# Check deployment type
DEPLOYMENT_EXISTS=false
if kubectl get deployment devbob -n "$NAMESPACE" >/dev/null 2>&1; then
    DEPLOYMENT_EXISTS=true
fi

STATEFULSET_EXISTS=false
if kubectl get statefulset devbob -n "$NAMESPACE" >/dev/null 2>&1; then
    STATEFULSET_EXISTS=true
fi

if [ "$HELM_EXISTS" == "true" ] && [ "$DEPLOYMENT_EXISTS" == "true" ] && [ "$STATEFULSET_EXISTS" == "false" ]; then
    print_result "deployment-method" "true" "Deployed via Helm with Deployment resource (canonical)"
elif [ "$STATEFULSET_EXISTS" == "true" ]; then
    print_result "deployment-method" "false" "Using deprecated StatefulSet (should use Helm Deployment)"
elif [ "$HELM_EXISTS" == "false" ]; then
    print_result "deployment-method" "false" "No Helm release found (should use Helm chart)"
else
    print_result "deployment-method" "false" "Unknown deployment method"
fi
echo

# Summary
echo "======================================================================"
echo "Validation Results Summary"
echo "======================================================================"
TOTAL_COUNT=$((PASS_COUNT + FAIL_COUNT))
echo "Total Tests: $TOTAL_COUNT"
echo -e "Passed: ${GREEN}$PASS_COUNT${NC}"
echo -e "Failed: ${RED}$FAIL_COUNT${NC}"
echo "======================================================================"
echo

# Write JSON results
cat > "$OUTPUT_FILE" << EOF
{
  "specification": "devbob-k8s-deployment-pattern",
  "namespace": "$NAMESPACE",
  "timestamp": "$(date -Iseconds)",
  "summary": {
    "total": $TOTAL_COUNT,
    "passed": $PASS_COUNT,
    "failed": $FAIL_COUNT,
    "success": $([ $FAIL_COUNT -eq 0 ] && echo "true" || echo "false")
  },
  "tests": [
EOF

FIRST=true
for result in "${TEST_RESULTS[@]}"; do
    IFS=':' read -r name status message <<< "$result"
    if [ "$FIRST" == "true" ]; then
        FIRST=false
    else
        echo "," >> "$OUTPUT_FILE"
    fi
    cat >> "$OUTPUT_FILE" << EOF
    {
      "name": "$name",
      "status": "$status",
      "message": "$message"
    }
EOF
done

cat >> "$OUTPUT_FILE" << EOF

  ]
}
EOF

echo "Results written to: $OUTPUT_FILE"
echo

# Exit with appropriate code
if [ $FAIL_COUNT -eq 0 ]; then
    echo -e "${GREEN}✅ All tests passed!${NC}"
    exit 0
else
    echo -e "${RED}❌ Some tests failed.${NC}"
    exit 1
fi
