#!/usr/bin/env bash
#
# Phase 1 Validation: Repository Access for MiniBob
#
# This script validates that MiniBob pods can:
# 1. Access shared repository storage via PVC
# 2. Perform git operations (status, log, branch)
# 3. Use git credentials for authentication
#

set -euo pipefail

NAMESPACE="${NAMESPACE:-activity-system}"
RELEASE_NAME="${RELEASE_NAME:-devbob}"

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Test results
TESTS_PASSED=0
TESTS_FAILED=0

pass() {
    echo -e "${GREEN}✓${NC} $1"
    ((TESTS_PASSED++))
}

fail() {
    echo -e "${RED}✗${NC} $1"
    ((TESTS_FAILED++))
}

info() {
    echo -e "${BLUE}ℹ${NC} $1"
}

section() {
    echo ""
    echo -e "${YELLOW}=== $1 ===${NC}"
    echo ""
}

# Get pod name
get_pod_name() {
    kubectl get pods -n "$NAMESPACE" \
        -l "app.kubernetes.io/name=devbob,app.kubernetes.io/instance=$RELEASE_NAME" \
        -o jsonpath='{.items[0].metadata.name}' 2>/dev/null || echo ""
}

# Test 1: Check PVCs exist
test_pvcs_exist() {
    section "Test 1: PersistentVolumeClaims"

    local workspace_pvc="${RELEASE_NAME}-pvc"
    local repos_pvc="${RELEASE_NAME}-repos-pvc"

    if kubectl get pvc -n "$NAMESPACE" "$workspace_pvc" &> /dev/null; then
        pass "Workspace PVC exists: $workspace_pvc"
    else
        fail "Workspace PVC not found: $workspace_pvc"
    fi

    if kubectl get pvc -n "$NAMESPACE" "$repos_pvc" &> /dev/null; then
        pass "Repos PVC exists: $repos_pvc"

        # Check if bound
        local status
        status=$(kubectl get pvc -n "$NAMESPACE" "$repos_pvc" -o jsonpath='{.status.phase}')
        if [ "$status" = "Bound" ]; then
            pass "Repos PVC is bound"
        else
            fail "Repos PVC status: $status (expected: Bound)"
        fi
    else
        fail "Repos PVC not found: $repos_pvc"
    fi
}

# Test 2: Check secrets exist
test_secrets_exist() {
    section "Test 2: Secrets"

    local git_secret="${RELEASE_NAME}-git-credentials"

    if kubectl get secret -n "$NAMESPACE" "$git_secret" &> /dev/null; then
        pass "Git credentials secret exists: $git_secret"

        # Check keys
        if kubectl get secret -n "$NAMESPACE" "$git_secret" -o jsonpath='{.data.\.gitconfig}' &> /dev/null; then
            pass "Git credentials secret contains .gitconfig"
        else
            fail "Git credentials secret missing .gitconfig"
        fi
    else
        fail "Git credentials secret not found: $git_secret"
    fi
}

# Test 3: Check pod is running
test_pod_running() {
    section "Test 3: Pod Status"

    local pod_name
    pod_name=$(get_pod_name)

    if [ -z "$pod_name" ]; then
        fail "No DevBob pod found"
        return
    fi

    info "Pod name: $pod_name"

    local status
    status=$(kubectl get pod -n "$NAMESPACE" "$pod_name" -o jsonpath='{.status.phase}')

    if [ "$status" = "Running" ]; then
        pass "Pod is running"
    else
        fail "Pod status: $status (expected: Running)"
    fi
}

# Test 4: Check /repos directory mounted
test_repos_mounted() {
    section "Test 4: Repository Mount"

    local pod_name
    pod_name=$(get_pod_name)

    if [ -z "$pod_name" ]; then
        fail "No pod available for testing"
        return
    fi

    # Check if /repos exists
    if kubectl exec -n "$NAMESPACE" "$pod_name" -- test -d /repos &> /dev/null; then
        pass "/repos directory exists in pod"
    else
        fail "/repos directory not found in pod"
        return
    fi

    # List contents
    local repos_content
    repos_content=$(kubectl exec -n "$NAMESPACE" "$pod_name" -- ls -la /repos 2>/dev/null || echo "")

    if [ -n "$repos_content" ]; then
        info "Contents of /repos:"
        echo "$repos_content" | sed 's/^/    /'
        pass "/repos directory is accessible"
    else
        fail "/repos directory is empty or not accessible"
    fi
}

# Test 5: Check repositories cloned
test_repos_cloned() {
    section "Test 5: Repository Cloning"

    local pod_name
    pod_name=$(get_pod_name)

    if [ -z "$pod_name" ]; then
        fail "No pod available for testing"
        return
    fi

    # Check for metabob-devbob repo
    if kubectl exec -n "$NAMESPACE" "$pod_name" -- test -d /repos/metabob-devbob/.git &> /dev/null; then
        pass "metabob-devbob repository cloned"

        # Check if it's a valid git repo
        local repo_path="/repos/metabob-devbob"
        local git_status
        git_status=$(kubectl exec -n "$NAMESPACE" "$pod_name" -- git -C "$repo_path" status --porcelain 2>&1 || echo "error")

        if [ "$git_status" != "error" ]; then
            pass "Repository is a valid git repository"
        else
            fail "Repository exists but git status failed"
        fi
    else
        fail "metabob-devbob repository not found in /repos"
    fi
}

# Test 6: Git operations
test_git_operations() {
    section "Test 6: Git Operations"

    local pod_name
    pod_name=$(get_pod_name)

    if [ -z "$pod_name" ]; then
        fail "No pod available for testing"
        return
    fi

    local repo_path="/repos/metabob-devbob"

    # Test 6.1: git status
    if kubectl exec -n "$NAMESPACE" "$pod_name" -- git -C "$repo_path" status &> /dev/null; then
        pass "git status works"
    else
        fail "git status failed"
    fi

    # Test 6.2: git log
    local log_output
    log_output=$(kubectl exec -n "$NAMESPACE" "$pod_name" -- git -C "$repo_path" log --oneline -5 2>&1 || echo "error")

    if [ "$log_output" != "error" ]; then
        pass "git log works"
        info "Recent commits:"
        echo "$log_output" | sed 's/^/    /'
    else
        fail "git log failed"
    fi

    # Test 6.3: git branch
    local branch_output
    branch_output=$(kubectl exec -n "$NAMESPACE" "$pod_name" -- git -C "$repo_path" branch 2>&1 || echo "error")

    if [ "$branch_output" != "error" ]; then
        pass "git branch works"
        info "Current branch: $(echo "$branch_output" | grep '*' | sed 's/\* //')"
    else
        fail "git branch failed"
    fi

    # Test 6.4: Create and delete test branch
    if kubectl exec -n "$NAMESPACE" "$pod_name" -- git -C "$repo_path" branch minibob-test &> /dev/null; then
        if kubectl exec -n "$NAMESPACE" "$pod_name" -- git -C "$repo_path" branch -d minibob-test &> /dev/null; then
            pass "git branch creation and deletion works"
        else
            fail "git branch deletion failed"
        fi
    else
        fail "git branch creation failed"
    fi
}

# Test 7: Git configuration
test_git_config() {
    section "Test 7: Git Configuration"

    local pod_name
    pod_name=$(get_pod_name)

    if [ -z "$pod_name" ]; then
        fail "No pod available for testing"
        return
    fi

    local repo_path="/repos/metabob-devbob"

    # Check git user.name
    local git_user
    git_user=$(kubectl exec -n "$NAMESPACE" "$pod_name" -- git -C "$repo_path" config user.name 2>/dev/null || echo "")

    if [ -n "$git_user" ]; then
        pass "git user.name is configured: $git_user"
    else
        fail "git user.name not configured"
    fi

    # Check git user.email
    local git_email
    git_email=$(kubectl exec -n "$NAMESPACE" "$pod_name" -- git -C "$repo_path" config user.email 2>/dev/null || echo "")

    if [ -n "$git_email" ]; then
        pass "git user.email is configured: $git_email"
    else
        fail "git user.email not configured"
    fi

    # Check if .gitconfig is mounted
    if kubectl exec -n "$NAMESPACE" "$pod_name" -- test -f /root/.gitconfig &> /dev/null; then
        pass ".gitconfig is mounted at /root/.gitconfig"
    else
        fail ".gitconfig not found at /root/.gitconfig"
    fi
}

# Test 8: Environment variables
test_environment_vars() {
    section "Test 8: Environment Variables"

    local pod_name
    pod_name=$(get_pod_name)

    if [ -z "$pod_name" ]; then
        fail "No pod available for testing"
        return
    fi

    # Check REPOS_PATH
    local repos_path
    repos_path=$(kubectl exec -n "$NAMESPACE" "$pod_name" -- printenv REPOS_PATH 2>/dev/null || echo "")

    if [ "$repos_path" = "/repos" ]; then
        pass "REPOS_PATH environment variable is set correctly: $repos_path"
    else
        fail "REPOS_PATH not set or incorrect (got: '$repos_path', expected: '/repos')"
    fi

    # Check GIT_USER_NAME
    local git_user_name
    git_user_name=$(kubectl exec -n "$NAMESPACE" "$pod_name" -- printenv GIT_USER_NAME 2>/dev/null || echo "")

    if [ -n "$git_user_name" ]; then
        pass "GIT_USER_NAME is set: $git_user_name"
    else
        fail "GIT_USER_NAME not set"
    fi

    # Check GIT_USER_EMAIL
    local git_user_email
    git_user_email=$(kubectl exec -n "$NAMESPACE" "$pod_name" -- printenv GIT_USER_EMAIL 2>/dev/null || echo "")

    if [ -n "$git_user_email" ]; then
        pass "GIT_USER_EMAIL is set: $git_user_email"
    else
        fail "GIT_USER_EMAIL not set"
    fi
}

# Print summary
print_summary() {
    section "Test Summary"

    local total=$((TESTS_PASSED + TESTS_FAILED))

    echo "Total tests: $total"
    echo -e "Passed: ${GREEN}$TESTS_PASSED${NC}"
    echo -e "Failed: ${RED}$TESTS_FAILED${NC}"

    echo ""

    if [ $TESTS_FAILED -eq 0 ]; then
        echo -e "${GREEN}✓ All tests passed!${NC}"
        echo ""
        echo "Phase 1 implementation is successful. MiniBob can now:"
        echo "  - Access shared repository storage"
        echo "  - Perform git operations"
        echo "  - Use configured git credentials"
        return 0
    else
        echo -e "${RED}✗ Some tests failed${NC}"
        echo ""
        echo "Please review the failures above and fix the deployment."
        return 1
    fi
}

# Main execution
main() {
    echo ""
    echo -e "${YELLOW}╔════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${YELLOW}║  Phase 1 Validation: Repository Access for MiniBob        ║${NC}"
    echo -e "${YELLOW}╚════════════════════════════════════════════════════════════╝${NC}"
    echo ""

    info "Namespace: $NAMESPACE"
    info "Release: $RELEASE_NAME"

    test_pvcs_exist
    test_secrets_exist
    test_pod_running
    test_repos_mounted
    test_repos_cloned
    test_git_operations
    test_git_config
    test_environment_vars

    echo ""
    print_summary
}

main "$@"
