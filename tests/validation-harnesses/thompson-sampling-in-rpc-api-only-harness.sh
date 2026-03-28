#!/bin/bash

# Validation Harness: thompson-sampling-in-rpc-api-only
#
# Specification: Thompson Sampling (Beta distribution variant selection) must ONLY exist in metabob-rpc-api.
# metabob-opencode must call rpc-api endpoint for template selection.
#
# Validation Strategy:
# 1. Search for Thompson Sampling ALGORITHM in metabob-opencode (must be 0 matches)
# 2. Verify RPC API has the selection endpoint
# 3. Verify opencode calls RPC API for selection
# 4. Verify no Beta distribution sampling ALGORITHM in opencode
#
# Note: Metadata, types, and comments referencing Thompson Sampling are ALLOWED.
# We're checking for the actual ML algorithm implementation, not just mentions.

set -e

BASE_DIR="${1:-$(pwd)}"
OPENCODE_DIR="$BASE_DIR/repos/metabob-opencode/packages/opencode/src"
RPC_API_DIR="$BASE_DIR/repos/metabob-rpc-api/server"

PASSED=0
FAILED=0
TOTAL=0

echo "Running validation for thompson-sampling-in-rpc-api-only specification..."
echo "Base directory: $BASE_DIR"
echo ""

# Test helper function
run_test() {
  local test_name="$1"
  local test_command="$2"
  local expected_result="$3"
  local should_have_matches="$4"  # "yes" or "no"
  
  TOTAL=$((TOTAL + 1))
  
  echo "Test $TOTAL: $test_name"
  
  if ! test_output=$(eval "$test_command" 2>&1); then
    if [ "$should_have_matches" = "no" ]; then
      echo "   ✅ PASS: $expected_result"
      PASSED=$((PASSED + 1))
    else
      echo "   ❌ FAIL: Command failed"
      echo "   Expected: $expected_result"
      echo "   Error: $test_output"
      FAILED=$((FAILED + 1))
    fi
  else
    if [ -z "$test_output" ]; then
      if [ "$should_have_matches" = "no" ]; then
        echo "   ✅ PASS: $expected_result"
        PASSED=$((PASSED + 1))
      else
        echo "   ❌ FAIL: No matches found"
        echo "   Expected: $expected_result"
        FAILED=$((FAILED + 1))
      fi
    else
      if [ "$should_have_matches" = "yes" ]; then
        echo "   ✅ PASS: $expected_result"
        echo "   Found: $(echo "$test_output" | head -1)"
        PASSED=$((PASSED + 1))
      else
        echo "   ❌ FAIL: Found forbidden patterns"
        echo "   Expected: $expected_result"
        echo "   Found: $test_output"
        FAILED=$((FAILED + 1))
      fi
    fi
  fi
  
  echo ""
}

# Test 1: No betaSample or performThompsonSampling FUNCTIONS in opencode
# (metadata, types, and comments are OK - we're looking for the actual algorithm)
run_test \
  "No Thompson Sampling algorithm functions in opencode" \
  "grep -r 'function betaSample\|const betaSample\|function performThompsonSampling\|const performThompsonSampling' $OPENCODE_DIR --include='*.ts' --include='*.js' | grep -v 'REMOVED'" \
  "No betaSample() or performThompsonSampling() functions" \
  "no"

# Test 2: No betavariate or random Beta sampling IMPLEMENTATION in opencode
# (excluding comments, type annotations, and string literals)
run_test \
  "No Beta distribution sampling implementation in opencode" \
  "grep -rn 'random\.betavariate\|Math\.random().*\*.*alpha.*beta' $OPENCODE_DIR --include='*.ts' --include='*.js' | grep -v '//' | grep -v '\* '" \
  "No betavariate() or Beta sampling code implementation" \
  "no"

# Test 3: Verify removal comments exist
run_test \
  "Removal comments exist for Thompson Sampling functions" \
  "grep -n 'REMOVED.*betaSample\|REMOVED.*performThompsonSampling' $OPENCODE_DIR/session/template-selector.ts" \
  "Comments documenting removal of betaSample() and performThompsonSampling()" \
  "yes"

# Test 4: Verify select_variant endpoint exists in rpc-api
run_test \
  "RPC API has template selection endpoint" \
  "grep -n 'POST.*templates.*select\|select_variant' $RPC_API_DIR/routes/activity.py" \
  "POST endpoint for template selection exists" \
  "yes"

# Test 5: Verify sample_beta function exists in rpc-api
run_test \
  "RPC API has sample_beta() function" \
  "grep -n 'def sample_beta' $RPC_API_DIR/actions/activity.py" \
  "sample_beta() function exists in rpc-api" \
  "yes"

# Test 6: Verify select_variant_thompson_sampling exists in rpc-api
run_test \
  "RPC API has select_variant_thompson_sampling() function" \
  "grep -n 'def select_variant_thompson_sampling' $RPC_API_DIR/actions/activity.py" \
  "select_variant_thompson_sampling() function exists in rpc-api" \
  "yes"

# Test 7: Verify RpcHttpClient.selectTemplateVariant exists in opencode
run_test \
  "opencode has RpcHttpClient.selectTemplateVariant()" \
  "grep -n 'selectTemplateVariant' $OPENCODE_DIR/util/rpc-http-client.ts" \
  "selectTemplateVariant() function exists in RpcHttpClient" \
  "yes"

# Test 8: Verify TemplateSelector calls RpcHttpClient
run_test \
  "TemplateSelector calls RpcHttpClient.selectTemplateVariant()" \
  "grep -n 'RpcHttpClient.*selectTemplateVariant\|rpcHttpClient.*selectTemplateVariant' $OPENCODE_DIR/session/template-selector.ts" \
  "TemplateSelector delegates to RpcHttpClient" \
  "yes"

# Test 9: Verify RPC API URL is read from environment
run_test \
  "RpcHttpClient reads METABOB_RPC_API_URL from environment" \
  "grep -n 'METABOB_RPC_API_URL' $OPENCODE_DIR/util/rpc-http-client.ts" \
  "METABOB_RPC_API_URL environment variable is used" \
  "yes"

# Summary
echo "=== SUMMARY ==="
echo "Total Tests: $TOTAL"
echo "Passed: $PASSED"
echo "Failed: $FAILED"

if [ $FAILED -eq 0 ]; then
  echo "Overall: ✅ PASS"
  exit 0
else
  echo "Overall: ❌ FAIL"
  exit 1
fi
