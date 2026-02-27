#!/usr/bin/env bash
set -euo pipefail

NAMESPACE="metabob"
PODS=("devbob-0" "devbob-1" "devbob-2")

echo "=== DevBob K8s Git Operations Validation ==="
echo ""

TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0

for pod in "${PODS[@]}"; do
    echo "Testing pod: $pod"
    echo "---"
    
    # Test 1: Git config
    echo -n "  1. Git config: "
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    if kubectl exec -n "$NAMESPACE" "$pod" -- bash -c "git config --global user.name" &>/dev/null; then
        git_user=$(kubectl exec -n "$NAMESPACE" "$pod" -- bash -c "git config --global user.name" 2>/dev/null)
        echo "✓ PASS (user.name=$git_user)"
        PASSED_TESTS=$((PASSED_TESTS + 1))
    else
        echo "✗ FAIL"
        FAILED_TESTS=$((FAILED_TESTS + 1))
    fi
    
    # Test 2: gh CLI installed
    echo -n "  2. gh CLI installed: "
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    if kubectl exec -n "$NAMESPACE" "$pod" -- which gh &>/dev/null; then
        gh_version=$(kubectl exec -n "$NAMESPACE" "$pod" -- gh --version 2>/dev/null | head -1)
        echo "✓ PASS ($gh_version)"
        PASSED_TESTS=$((PASSED_TESTS + 1))
    else
        echo "✗ FAIL"
        FAILED_TESTS=$((FAILED_TESTS + 1))
    fi
    
    # Test 3: GITHUB_TOKEN present
    echo -n "  3. GITHUB_TOKEN present: "
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    if kubectl exec -n "$NAMESPACE" "$pod" -- bash -c 'test -n "$GITHUB_TOKEN"' &>/dev/null; then
        echo "✓ PASS"
        PASSED_TESTS=$((PASSED_TESTS + 1))
    else
        echo "✗ FAIL"
        FAILED_TESTS=$((FAILED_TESTS + 1))
    fi
    
    # Test 4: gh auth status
    echo -n "  4. gh authenticated: "
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    if kubectl exec -n "$NAMESPACE" "$pod" -- gh auth status &>/dev/null; then
        echo "✓ PASS"
        PASSED_TESTS=$((PASSED_TESTS + 1))
    else
        echo "✗ FAIL (expected without valid token)"
        FAILED_TESTS=$((FAILED_TESTS + 1))
    fi
    
    # Test 5: Git version
    echo -n "  5. Git installed: "
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    if kubectl exec -n "$NAMESPACE" "$pod" -- git --version &>/dev/null; then
        git_version=$(kubectl exec -n "$NAMESPACE" "$pod" -- git --version 2>/dev/null)
        echo "✓ PASS ($git_version)"
        PASSED_TESTS=$((PASSED_TESTS + 1))
    else
        echo "✗ FAIL"
        FAILED_TESTS=$((FAILED_TESTS + 1))
    fi
    
    echo ""
done

echo "=== Validation Summary ==="
echo "Total tests: $TOTAL_TESTS"
echo "Passed: $PASSED_TESTS"
echo "Failed: $FAILED_TESTS"
echo ""

if [ $FAILED_TESTS -eq 0 ]; then
    echo "Overall: PASS"
    exit 0
else
    echo "Overall: FAIL"
    exit 1
fi
