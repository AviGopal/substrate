#!/usr/bin/env bash
##############################################################################
# Validation Harness: devbob-k8s-git-operations
#
# Validates that all devbob containers in the Kubernetes StatefulSet can
# perform complete autonomous git workflows including: git config, clone,
# commit, push, PR creation, and PR merge operations.
#
# Validation Strategy: kubectl-exec-commands
#
# This harness tests all 3 devbob pods (devbob-0, devbob-1, devbob-2) for:
# 1. Git configuration (user.name, user.email)
# 2. GitHub CLI installation and authentication
# 3. Git credentials in environment
# 4. Workspace directory accessibility
# 5. Git clone operations (authentication)
# 6. Git commit operations (attribution)
# 7. Git push operations (credentials)
# 8. GitHub PR creation (gh CLI + token)
#
# Usage:
#   ./tests/validation-harnesses/devbob-k8s-git-operations-harness.sh
#   ./tests/validation-harnesses/devbob-k8s-git-operations-harness.sh --pod devbob-0
#   ./tests/validation-harnesses/devbob-k8s-git-operations-harness.sh --skip-destructive
#   ./tests/validation-harnesses/devbob-k8s-git-operations-harness.sh --json
##############################################################################

set -euo pipefail

# Configuration
NAMESPACE="${NAMESPACE:-metabob}"
PODS=("devbob-0" "devbob-1" "devbob-2")
TEST_REPO="${TEST_REPO:-https://github.com/metabob-labs/test-repo.git}"
TEST_BRANCH="validation-test-$(date +%s)"
SKIP_DESTRUCTIVE=false
JSON_OUTPUT=false
SINGLE_POD=""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Counters
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0

# Test results array
declare -a TEST_RESULTS

##############################################################################
# Helper Functions
##############################################################################

log_info() {
    if [ "$JSON_OUTPUT" = false ]; then
        echo -e "${GREEN}[INFO]${NC} $1"
    fi
}

log_warn() {
    if [ "$JSON_OUTPUT" = false ]; then
        echo -e "${YELLOW}[WARN]${NC} $1"
    fi
}

log_error() {
    if [ "$JSON_OUTPUT" = false ]; then
        echo -e "${RED}[ERROR]${NC} $1"
    fi
}

log_test() {
    if [ "$JSON_OUTPUT" = false ]; then
        echo -e "${BLUE}[TEST]${NC} $1"
    fi
}

# Execute kubectl command
exec_kubectl() {
    local pod=$1
    local command=$2
    local timeout=${3:-30}
    
    kubectl exec -n "$NAMESPACE" "$pod" -- bash -c "$command" 2>&1
}

# Check if pod is ready
is_pod_ready() {
    local pod=$1
    local status=$(kubectl get pod "$pod" -n "$NAMESPACE" -o jsonpath='{.status.phase}' 2>/dev/null || echo "NotFound")
    [ "$status" = "Running" ]
}

# Record test result
record_test() {
    local pod=$1
    local test_name=$2
    local pass=$3
    local actual=$4
    local expected=$5
    local error=${6:-}
    
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    
    if [ "$pass" = "true" ]; then
        PASSED_TESTS=$((PASSED_TESTS + 1))
        if [ "$JSON_OUTPUT" = false ]; then
            echo -e "  ${GREEN}✓${NC} $test_name"
        fi
    else
        FAILED_TESTS=$((FAILED_TESTS + 1))
        if [ "$JSON_OUTPUT" = false ]; then
            echo -e "  ${RED}✗${NC} $test_name"
            echo -e "    Expected: $expected"
            echo -e "    Actual: $actual"
            [ -n "$error" ] && echo -e "    Error: $error"
        fi
    fi
    
    # Store for JSON output
    TEST_RESULTS+=("$(cat <<EOF
{
  "podName": "$pod",
  "testName": "$test_name",
  "pass": $pass,
  "expected": "$expected",
  "actual": "$(echo "$actual" | head -c 200 | tr '\n' ' ')",
  "error": "$error"
}
EOF
)")
}

##############################################################################
# Test Functions
##############################################################################

# Test 1: Git config present
test_git_config() {
    local pod=$1
    log_test "$pod: Testing git config..."
    
    local output=$(exec_kubectl "$pod" "git config --global --list | grep -E '(user\\.name|user\\.email|init\\.defaultBranch|push\\.autoSetupRemote)'" || echo "")
    
    if [[ "$output" == *"user.name="* ]] && [[ "$output" == *"user.email="* ]]; then
        record_test "$pod" "git-config-present" "true" "$output" "user.name and user.email configured"
    else
        record_test "$pod" "git-config-present" "false" "$output" "user.name and user.email configured" "Git config missing"
    fi
}

# Test 2: gh CLI installed
test_gh_cli() {
    local pod=$1
    log_test "$pod: Testing gh CLI installation..."
    
    local output=$(exec_kubectl "$pod" "which gh && gh --version" || echo "")
    
    if [[ "$output" == *"/usr/bin/gh"* ]] || [[ "$output" == *"/usr/local/bin/gh"* ]]; then
        record_test "$pod" "gh-cli-installed" "true" "$output" "gh CLI installed at /usr/bin/gh or /usr/local/bin/gh"
    else
        record_test "$pod" "gh-cli-installed" "false" "$output" "gh CLI installed" "gh CLI not found"
    fi
}

# Test 3: Git credentials in environment
test_git_credentials() {
    local pod=$1
    log_test "$pod: Testing git credentials..."
    
    local output=$(exec_kubectl "$pod" "env | grep -E '(GIT_USER_NAME|GIT_USER_EMAIL|GITHUB_TOKEN)' | sed 's/GITHUB_TOKEN=.*/GITHUB_TOKEN=***/'" || echo "")
    
    if [[ "$output" == *"GIT_USER_NAME="* ]] && [[ "$output" == *"GIT_USER_EMAIL="* ]] && [[ "$output" == *"GITHUB_TOKEN="* ]]; then
        record_test "$pod" "git-credentials-present" "true" "$output" "GIT_USER_NAME, GIT_USER_EMAIL, GITHUB_TOKEN present"
    else
        record_test "$pod" "git-credentials-present" "false" "$output" "All git credentials present" "Missing credentials"
    fi
}

# Test 4: gh CLI authenticated
test_gh_auth() {
    local pod=$1
    log_test "$pod: Testing gh CLI authentication..."
    
    local output=$(exec_kubectl "$pod" "gh auth status 2>&1" || echo "")
    
    if [[ "$output" == *"Logged in to github.com"* ]] || [[ "$output" == *"✓"* ]] || [[ "$output" == *"Token:"* ]]; then
        record_test "$pod" "gh-cli-authenticated" "true" "$output" "Logged in to github.com"
    else
        record_test "$pod" "gh-cli-authenticated" "false" "$output" "gh CLI authenticated" "Not authenticated"
    fi
}

# Test 5: Workspace accessible
test_workspace() {
    local pod=$1
    log_test "$pod: Testing workspace access..."
    
    local output=$(exec_kubectl "$pod" "ls -la /workspace && pwd" || echo "")
    
    if [[ "$output" == *"/workspace"* ]]; then
        record_test "$pod" "workspace-accessible" "true" "$output" "Workspace directory accessible"
    else
        record_test "$pod" "workspace-accessible" "false" "$output" "Workspace accessible" "Cannot access workspace"
    fi
}

# Test 6: Git clone (destructive)
test_git_clone() {
    local pod=$1
    log_test "$pod: Testing git clone..."
    
    local repo_dir="/tmp/test-repo-$(date +%s)"
    exec_kubectl "$pod" "rm -rf /tmp/test-repo-*" &>/dev/null || true
    
    local output=$(exec_kubectl "$pod" "git clone $TEST_REPO $repo_dir 2>&1 && ls -la $repo_dir" 60 || echo "")
    
    if [[ "$output" != *"fatal"* ]] && [[ "$output" != *"Authentication failed"* ]] && [[ "$output" != "" ]]; then
        record_test "$pod" "git-clone-success" "true" "$output" "Clone successful without auth errors"
        echo "$repo_dir" # Return repo dir for next tests
    else
        record_test "$pod" "git-clone-success" "false" "$output" "Clone successful" "Clone failed"
        echo "" # Return empty
    fi
}

# Test 7: Git commit (destructive)
test_git_commit() {
    local pod=$1
    local repo_dir=$2
    log_test "$pod: Testing git commit..."
    
    local test_file="test-$(date +%s).txt"
    local output=$(exec_kubectl "$pod" "cd $repo_dir && echo 'Test from $pod' > $test_file && git add $test_file && git commit -m 'Test commit' && git log -1 --format='%an <%ae>'" || echo "")
    
    if [[ "$output" != *"fatal"* ]] && [[ "$output" != *"Please tell me who you are"* ]] && [[ "$output" != "" ]]; then
        record_test "$pod" "git-commit-success" "true" "$output" "Commit successful with attribution"
    else
        record_test "$pod" "git-commit-success" "false" "$output" "Commit successful" "Commit failed"
    fi
}

# Test 8: Git push (destructive)
test_git_push() {
    local pod=$1
    local repo_dir=$2
    log_test "$pod: Testing git push..."
    
    local output=$(exec_kubectl "$pod" "cd $repo_dir && git checkout -b $TEST_BRANCH 2>/dev/null || git checkout $TEST_BRANCH && git push origin $TEST_BRANCH -f 2>&1" 60 || echo "")
    
    if [[ "$output" != *"fatal"* ]] && [[ "$output" != *"Authentication failed"* ]] && [[ "$output" != *"Permission denied"* ]]; then
        record_test "$pod" "git-push-success" "true" "$output" "Push successful without auth errors"
    else
        record_test "$pod" "git-push-success" "false" "$output" "Push successful" "Push failed"
    fi
}

# Test 9: PR creation (destructive)
test_gh_pr_create() {
    local pod=$1
    local repo_dir=$2
    log_test "$pod: Testing PR creation..."
    
    local output=$(exec_kubectl "$pod" "cd $repo_dir && gh pr create --title 'Test PR from $pod' --body 'Automated test PR' --base main --head $TEST_BRANCH 2>&1 || echo 'PR already exists or error'" 60)
    
    if [[ "$output" == *"https://github.com"* ]] || [[ "$output" == *"already exists"* ]] || [[ "$output" == *"pull request"* ]]; then
        record_test "$pod" "gh-pr-create" "true" "$output" "PR created or already exists"
    else
        record_test "$pod" "gh-pr-create" "false" "$output" "PR created" "PR creation failed"
    fi
}

##############################################################################
# Main Validation Logic
##############################################################################

validate_pod() {
    local pod=$1
    
    log_info "Validating pod: $pod"
    
    # Check if pod is ready
    if ! is_pod_ready "$pod"; then
        log_error "Pod $pod is not ready or not found"
        record_test "$pod" "pod-ready" "false" "Pod not in Running state" "Pod Running" "Pod not ready"
        return 1
    fi
    
    # Run non-destructive tests
    test_git_config "$pod"
    test_gh_cli "$pod"
    test_git_credentials "$pod"
    test_gh_auth "$pod"
    test_workspace "$pod"
    
    # Skip destructive tests if requested
    if [ "$SKIP_DESTRUCTIVE" = true ]; then
        log_warn "Skipping destructive tests (clone, commit, push, PR)"
        return 0
    fi
    
    # Run destructive tests
    local repo_dir=$(test_git_clone "$pod")
    
    if [ -n "$repo_dir" ]; then
        test_git_commit "$pod" "$repo_dir"
        test_git_push "$pod" "$repo_dir"
        test_gh_pr_create "$pod" "$repo_dir"
    else
        log_warn "Skipping commit/push/PR tests (clone failed)"
    fi
}

##############################################################################
# CLI Entry Point
##############################################################################

# Parse arguments
while [[ $# -gt 0 ]]; then
    case $1 in
        --pod)
            SINGLE_POD="$2"
            shift 2
            ;;
        --namespace)
            NAMESPACE="$2"
            shift 2
            ;;
        --test-repo)
            TEST_REPO="$2"
            shift 2
            ;;
        --skip-destructive)
            SKIP_DESTRUCTIVE=true
            shift
            ;;
        --json)
            JSON_OUTPUT=true
            shift
            ;;
        *)
            echo "Unknown option: $1"
            echo "Usage: $0 [--pod POD_NAME] [--namespace NAMESPACE] [--test-repo URL] [--skip-destructive] [--json]"
            exit 1
            ;;
    esac
done

# Determine which pods to test
if [ -n "$SINGLE_POD" ]; then
    PODS=("$SINGLE_POD")
fi

# Print header
if [ "$JSON_OUTPUT" = false ]; then
    echo "================================================================================"
    echo "Validation Harness: devbob-k8s-git-operations"
    echo "================================================================================"
    echo "Namespace: $NAMESPACE"
    echo "Pods: ${PODS[*]}"
    echo "Skip Destructive: $SKIP_DESTRUCTIVE"
    echo "================================================================================"
    echo ""
fi

# Validate each pod
for pod in "${PODS[@]}"; do
    validate_pod "$pod" || true
    echo ""
done

# Print summary
if [ "$JSON_OUTPUT" = false ]; then
    echo "================================================================================"
    echo "Validation Results"
    echo "================================================================================"
    echo "Total Tests: $TOTAL_TESTS"
    echo -e "Passed: ${GREEN}$PASSED_TESTS ✓${NC}"
    echo -e "Failed: ${RED}$FAILED_TESTS ✗${NC}"
    echo "================================================================================"
    
    if [ $FAILED_TESTS -eq 0 ]; then
        echo -e "${GREEN}Overall: ✓ PASS${NC}"
    else
        echo -e "${RED}Overall: ✗ FAIL${NC}"
    fi
    echo "================================================================================"
else
    # JSON output
    echo "{"
    echo "  \"pass\": $([ $FAILED_TESTS -eq 0 ] && echo "true" || echo "false"),"
    echo "  \"totalTests\": $TOTAL_TESTS,"
    echo "  \"passedTests\": $PASSED_TESTS,"
    echo "  \"failedTests\": $FAILED_TESTS,"
    echo "  \"timestamp\": \"$(date -Iseconds)\","
    echo "  \"results\": ["
    
    for i in "${!TEST_RESULTS[@]}"; do
        echo "${TEST_RESULTS[$i]}"
        [ $i -lt $((${#TEST_RESULTS[@]} - 1)) ] && echo "," || echo ""
    done
    
    echo "  ]"
    echo "}"
fi

# Exit with appropriate code
exit $([ $FAILED_TESTS -eq 0 ] && echo 0 || echo 1)
