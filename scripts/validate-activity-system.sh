#!/usr/bin/env bash
# Validate Activity System Deployment
# 
# This script validates that the activity system is properly deployed and functional

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
NAMESPACE="activity-system"
RETRY_COUNT=5
RETRY_DELAY=3

# Test results
TESTS_PASSED=0
TESTS_FAILED=0

# Functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $*"
}

log_success() {
    echo -e "${GREEN}[✓]${NC} $*"
    TESTS_PASSED=$((TESTS_PASSED + 1))
}

log_failure() {
    echo -e "${RED}[✗]${NC} $*"
    TESTS_FAILED=$((TESTS_FAILED + 1))
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $*"
}

retry_command() {
    local cmd="$*"
    local count=0
    
    while [ $count -lt $RETRY_COUNT ]; do
        if eval "$cmd" >/dev/null 2>&1; then
            return 0
        fi
        count=$((count + 1))
        sleep $RETRY_DELAY
    done
    
    return 1
}

# Test functions
test_namespace_exists() {
    log_info "Testing namespace exists..."
    if kubectl get namespace "$NAMESPACE" >/dev/null 2>&1; then
        log_success "Namespace '$NAMESPACE' exists"
        return 0
    else
        log_failure "Namespace '$NAMESPACE' does not exist"
        return 1
    fi
}

test_redis_running() {
    log_info "Testing Redis is running..."
    if kubectl get pods -n "$NAMESPACE" -l app.kubernetes.io/name=redis -o jsonpath='{.items[0].status.phase}' | grep -q "Running"; then
        log_success "Redis is running"
        return 0
    else
        log_failure "Redis is not running"
        return 1
    fi
}

test_surrealdb_running() {
    log_info "Testing SurrealDB is running..."
    if kubectl get pods -n "$NAMESPACE" -l app=surrealdb -o jsonpath='{.items[0].status.phase}' | grep -q "Running"; then
        log_success "SurrealDB is running"
        return 0
    else
        log_failure "SurrealDB is not running"
        return 1
    fi
}

test_activity_api_running() {
    log_info "Testing metabob-activity-api is running..."
    local running_pods
    running_pods=$(kubectl get pods -n "$NAMESPACE" -l app.kubernetes.io/name=metabob-activity-api -o jsonpath='{.items[*].status.phase}' | grep -o "Running" | wc -l)
    
    if [ "$running_pods" -gt 0 ]; then
        log_success "metabob-activity-api is running ($running_pods pod(s))"
        return 0
    else
        log_failure "metabob-activity-api is not running"
        return 1
    fi
}

test_minibob_running() {
    log_info "Testing minibob is running..."
    if kubectl get pods -n "$NAMESPACE" -l app.kubernetes.io/name=minibob -o jsonpath='{.items[0].status.phase}' | grep -q "Running"; then
        log_success "minibob is running"
        return 0
    else
        log_failure "minibob is not running"
        return 1
    fi
}

test_surrealdb_health() {
    log_info "Testing SurrealDB health endpoint..."
    
    # Port-forward in background
    kubectl port-forward -n "$NAMESPACE" svc/surrealdb 8000:8000 >/dev/null 2>&1 &
    local pf_pid=$!
    sleep 2
    
    if retry_command "curl -f http://localhost:8000/health"; then
        log_success "SurrealDB health endpoint responding"
        kill $pf_pid 2>/dev/null || true
        return 0
    else
        log_failure "SurrealDB health endpoint not responding"
        kill $pf_pid 2>/dev/null || true
        return 1
    fi
}

test_activity_api_health() {
    log_info "Testing metabob-activity-api health endpoint..."
    
    # Port-forward in background
    kubectl port-forward -n "$NAMESPACE" svc/metabob-activity-api 8080:8080 >/dev/null 2>&1 &
    local pf_pid=$!
    sleep 2
    
    if retry_command "curl -f http://localhost:8080/health"; then
        local response
        response=$(curl -s http://localhost:8080/health)
        log_success "metabob-activity-api health endpoint responding"
        log_info "Response: $response"
        kill $pf_pid 2>/dev/null || true
        return 0
    else
        log_failure "metabob-activity-api health endpoint not responding"
        kill $pf_pid 2>/dev/null || true
        return 1
    fi
}

test_minibob_health() {
    log_info "Testing minibob health endpoint..."
    
    # Port-forward in background
    kubectl port-forward -n "$NAMESPACE" svc/minibob 8081:8080 >/dev/null 2>&1 &
    local pf_pid=$!
    sleep 2
    
    if retry_command "curl -f http://localhost:8081/health"; then
        log_success "minibob health endpoint responding"
        kill $pf_pid 2>/dev/null || true
        return 0
    else
        log_failure "minibob health endpoint not responding"
        kill $pf_pid 2>/dev/null || true
        return 1
    fi
}

test_services_exist() {
    log_info "Testing services exist..."
    local services=("redis-master" "surrealdb" "metabob-activity-api" "minibob")
    local all_exist=true
    
    for svc in "${services[@]}"; do
        if kubectl get svc -n "$NAMESPACE" "$svc" >/dev/null 2>&1; then
            log_info "  Service '$svc' exists"
        else
            log_failure "  Service '$svc' not found"
            all_exist=false
        fi
    done
    
    if [ "$all_exist" = true ]; then
        log_success "All required services exist"
        return 0
    else
        log_failure "Some services are missing"
        return 1
    fi
}

test_persistent_volumes() {
    log_info "Testing persistent volumes..."
    
    local pvc_count
    pvc_count=$(kubectl get pvc -n "$NAMESPACE" | grep -c "Bound" || true)
    
    if [ "$pvc_count" -gt 0 ]; then
        log_success "Persistent volumes bound ($pvc_count PVC(s))"
        return 0
    else
        log_warning "No persistent volume claims found (may be using in-memory storage)"
        return 0
    fi
}

show_pod_logs() {
    log_info "Showing recent pod logs for debugging..."
    echo ""
    
    log_info "Activity API logs:"
    kubectl logs -n "$NAMESPACE" -l app.kubernetes.io/name=metabob-activity-api --tail=20 2>/dev/null || log_warning "No logs available"
    echo ""
    
    log_info "SurrealDB logs:"
    kubectl logs -n "$NAMESPACE" -l app=surrealdb --tail=20 2>/dev/null || log_warning "No logs available"
    echo ""
}

# Main execution
main() {
    log_info "Starting Activity System validation"
    log_info "Namespace: $NAMESPACE"
    echo ""
    
    # Basic infrastructure tests
    test_namespace_exists
    test_services_exist
    test_persistent_volumes
    echo ""
    
    # Pod running tests
    test_redis_running
    test_surrealdb_running
    test_activity_api_running
    test_minibob_running
    echo ""
    
    # Health endpoint tests
    test_surrealdb_health
    test_activity_api_health
    test_minibob_health
    echo ""
    
    # Summary
    log_info "=========================================="
    log_info "Validation Summary"
    log_info "=========================================="
    log_success "Passed: $TESTS_PASSED"
    if [ $TESTS_FAILED -gt 0 ]; then
        log_failure "Failed: $TESTS_FAILED"
        echo ""
        show_pod_logs
        exit 1
    else
        log_success "All tests passed!"
        echo ""
        log_info "Activity System is fully operational"
        echo ""
        log_info "You can now:"
        echo "  1. Test activity execution via minibob"
        echo "  2. Access API endpoints via port-forwarding"
        echo "  3. Query SurrealDB for learning loop data"
        echo "  4. Run Playwright validation: ./scripts/validate-deployment-playwright.sh"
        exit 0
    fi
}

# Run main
main "$@"
