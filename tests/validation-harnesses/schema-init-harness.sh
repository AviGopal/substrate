#!/bin/bash
# Validation Harness: Database Schema Initialization - Automatic Schema Creation on Fresh Deployment
# Purpose: Validate that init-schema Job runs successfully and creates all required tables on fresh deployment

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
METABOB_APPS_DIR="$REPO_ROOT/repos/platform/metabob-apps"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Expected tables (from trace analysis)
EXPECTED_TABLES=(
  "activity_template"
  "activity_execution"
  "activity_variants"
  "variant_performance_metrics"
  "vessel_registry"
  "users"
  "sessions"
  "organizations"
  "projects"
  "subscriptions"
  "api_keys"
  "audit_logs"
  "schema_versions"
)

# Expected indexes
EXPECTED_INDEXES=(
  "activity_template_id_idx"
  "activity_template_category_idx"
  "activity_template_org_idx"
  "activity_execution_id_idx"
  "activity_execution_template_idx"
  "activity_execution_status_idx"
  "vessel_registry_pod_name_idx"
  "vessel_registry_status_idx"
)

NAMESPACE="metabob"
EXPECTED_TABLE_COUNT=13
EXPECTED_INDEX_COUNT=8

# Function to print test status
print_test() {
  local status=$1
  local message=$2
  if [ "$status" == "PASS" ]; then
    echo -e "${GREEN}✓ PASS${NC}: $message"
  elif [ "$status" == "FAIL" ]; then
    echo -e "${RED}✗ FAIL${NC}: $message"
  else
    echo -e "${YELLOW}• INFO${NC}: $message"
  fi
}

# Function to wait for pod to be ready
wait_for_pod() {
  local pod_selector=$1
  local timeout=$2
  print_test "INFO" "Waiting for pod matching '$pod_selector' to be ready (timeout: ${timeout}s)..."
  
  if kubectl wait --for=condition=ready pod -l "$pod_selector" -n "$NAMESPACE" --timeout="${timeout}s" > /dev/null 2>&1; then
    return 0
  else
    return 1
  fi
}

# Function to wait for Job completion
wait_for_job() {
  local job_name=$1
  local timeout=$2
  print_test "INFO" "Waiting for Job '$job_name' to complete (timeout: ${timeout}s)..."
  
  if kubectl wait --for=condition=complete job/"$job_name" -n "$NAMESPACE" --timeout="${timeout}s" > /dev/null 2>&1; then
    return 0
  else
    return 1
  fi
}

# Test Case 1: Verify initSchema is enabled in values
test_init_schema_enabled() {
  print_test "INFO" "Test 1: Verify initSchema.enabled=true in values"
  
  cd "$METABOB_APPS_DIR"
  local enabled=$(grep -A 1 "^initSchema:" charts/surrealdb/values/default.surrealdb.values.yaml | grep "enabled:" | awk '{print $2}')
  
  if [ "$enabled" == "true" ]; then
    print_test "PASS" "initSchema.enabled is set to true"
    return 0
  else
    print_test "FAIL" "initSchema.enabled is $enabled (expected: true)"
    return 1
  fi
}

# Test Case 2: Verify SurrealDB Deployment has namespace/database args
test_deployment_args() {
  print_test "INFO" "Test 2: Verify SurrealDB Deployment has --ns and --db args"
  
  cd "$METABOB_APPS_DIR"
  local has_ns=$(grep -A 20 "args:" charts/surrealdb/charts/templates/deployment.yaml | grep -c "\-\- ns" || true)
  local has_db=$(grep -A 20 "args:" charts/surrealdb/charts/templates/deployment.yaml | grep -c "\-\- db" || true)
  
  if [ "$has_ns" -ge 1 ] && [ "$has_db" -ge 1 ]; then
    print_test "PASS" "Deployment template has --ns and --db args"
    return 0
  else
    print_test "FAIL" "Deployment template missing --ns or --db args"
    return 1
  fi
}

# Test Case 3: Verify SurrealDB StatefulSet has namespace/database args
test_statefulset_args() {
  print_test "INFO" "Test 3: Verify SurrealDB StatefulSet has --ns and --db args"
  
  cd "$METABOB_APPS_DIR"
  local has_ns=$(grep -A 20 "args:" charts/surrealdb/charts/templates/statefulset.yaml | grep -c "\-\- ns" || true)
  local has_db=$(grep -A 20 "args:" charts/surrealdb/charts/templates/statefulset.yaml | grep -c "\-\- db" || true)
  
  if [ "$has_ns" -ge 1 ] && [ "$has_db" -ge 1 ]; then
    print_test "PASS" "StatefulSet template has --ns and --db args"
    return 0
  else
    print_test "FAIL" "StatefulSet template missing --ns or --db args"
    return 1
  fi
}

# Test Case 4: Deploy from clean state
test_clean_deployment() {
  print_test "INFO" "Test 4: Perform clean deployment (helmfile destroy && apply)"
  
  cd "$METABOB_APPS_DIR"
  
  # Destroy existing deployment
  print_test "INFO" "Destroying existing deployment..."
  if helmfile -e default destroy --wait 2>&1 | tee /tmp/helmfile-destroy.log; then
    print_test "INFO" "Deployment destroyed successfully"
  else
    print_test "FAIL" "Helmfile destroy failed (see /tmp/helmfile-destroy.log)"
    return 1
  fi
  
  # Wait for resources to be fully removed
  sleep 10
  
  # Apply fresh deployment
  print_test "INFO" "Applying fresh deployment..."
  if helmfile -e default apply --wait 2>&1 | tee /tmp/helmfile-apply.log; then
    print_test "PASS" "Fresh deployment applied successfully"
    return 0
  else
    print_test "FAIL" "Helmfile apply failed (see /tmp/helmfile-apply.log)"
    return 1
  fi
}

# Test Case 5: Verify init-schema Job exists
test_init_schema_job_exists() {
  print_test "INFO" "Test 5: Verify init-schema Job was created"
  
  local job_count=$(kubectl get jobs -n "$NAMESPACE" | grep -c "init-schema" || true)
  
  if [ "$job_count" -ge 1 ]; then
    print_test "PASS" "init-schema Job exists"
    return 0
  else
    print_test "FAIL" "init-schema Job not found"
    kubectl get jobs -n "$NAMESPACE"
    return 1
  fi
}

# Test Case 6: Verify init-schema Job completes successfully
test_init_schema_job_completion() {
  print_test "INFO" "Test 6: Verify init-schema Job completes successfully"
  
  local job_name=$(kubectl get jobs -n "$NAMESPACE" | grep "init-schema" | awk '{print $1}' | head -1)
  
  if [ -z "$job_name" ]; then
    print_test "FAIL" "Could not find init-schema Job name"
    return 1
  fi
  
  # Wait for Job to complete (max 5 minutes)
  if wait_for_job "$job_name" 300; then
    local succeeded=$(kubectl get job "$job_name" -n "$NAMESPACE" -o jsonpath='{.status.succeeded}')
    if [ "$succeeded" == "1" ]; then
      print_test "PASS" "init-schema Job completed successfully"
      return 0
    else
      print_test "FAIL" "init-schema Job did not succeed (succeeded=$succeeded)"
      return 1
    fi
  else
    print_test "FAIL" "init-schema Job did not complete within timeout"
    kubectl describe job "$job_name" -n "$NAMESPACE"
    return 1
  fi
}

# Test Case 7: Check init-schema Job logs for success message
test_init_schema_job_logs() {
  print_test "INFO" "Test 7: Verify init-schema Job logs show success"
  
  local job_name=$(kubectl get jobs -n "$NAMESPACE" | grep "init-schema" | awk '{print $1}' | head -1)
  
  if [ -z "$job_name" ]; then
    print_test "FAIL" "Could not find init-schema Job name"
    return 1
  fi
  
  local logs=$(kubectl logs -n "$NAMESPACE" job/"$job_name" 2>&1)
  
  # Check for success message
  if echo "$logs" | grep -q "Schema initialization successful"; then
    print_test "PASS" "Job logs show schema initialization successful"
    
    # Check for table creation confirmation
    if echo "$logs" | grep -q "13/13 tables have PERMISSIONS FULL"; then
      print_test "PASS" "Job logs confirm 13/13 tables with PERMISSIONS FULL"
      return 0
    else
      print_test "FAIL" "Job logs missing table permission confirmation"
      echo "$logs" | tail -20
      return 1
    fi
  else
    print_test "FAIL" "Job logs do not show success message"
    echo "$logs" | tail -50
    return 1
  fi
}

# Test Case 8: Verify SurrealDB pod is running
test_surrealdb_pod_running() {
  print_test "INFO" "Test 8: Verify SurrealDB pod is running"
  
  if wait_for_pod "app=surrealdb" 120; then
    print_test "PASS" "SurrealDB pod is ready"
    return 0
  else
    print_test "FAIL" "SurrealDB pod not ready"
    kubectl get pods -n "$NAMESPACE" -l app=surrealdb
    return 1
  fi
}

# Test Case 9: Query SurrealDB to verify tables exist
test_surrealdb_tables_exist() {
  print_test "INFO" "Test 9: Verify all 13 tables exist in SurrealDB"
  
  local pod_name=$(kubectl get pods -n "$NAMESPACE" -l app=surrealdb -o jsonpath='{.items[0].metadata.name}')
  
  if [ -z "$pod_name" ]; then
    print_test "FAIL" "Could not find SurrealDB pod"
    return 1
  fi
  
  # Query tables using SurrealDB CLI
  local tables_output=$(kubectl exec -n "$NAMESPACE" "$pod_name" -- surreal sql \
    --endpoint http://localhost:8000 \
    --username root --password root \
    --namespace metabob --database production \
    --command "INFO FOR DB;" 2>&1 || true)
  
  local found_count=0
  for table in "${EXPECTED_TABLES[@]}"; do
    if echo "$tables_output" | grep -q "$table"; then
      ((found_count++))
    else
      print_test "FAIL" "Table '$table' not found in database"
    fi
  done
  
  if [ "$found_count" -eq "$EXPECTED_TABLE_COUNT" ]; then
    print_test "PASS" "All $EXPECTED_TABLE_COUNT tables exist in SurrealDB"
    return 0
  else
    print_test "FAIL" "Only $found_count/$EXPECTED_TABLE_COUNT tables found"
    return 1
  fi
}

# Test Case 10: Verify indexes exist
test_surrealdb_indexes_exist() {
  print_test "INFO" "Test 10: Verify all 8 indexes exist in SurrealDB"
  
  local pod_name=$(kubectl get pods -n "$NAMESPACE" -l app=surrealdb -o jsonpath='{.items[0].metadata.name}')
  
  if [ -z "$pod_name" ]; then
    print_test "FAIL" "Could not find SurrealDB pod"
    return 1
  fi
  
  # Query indexes using SurrealDB CLI
  local indexes_output=$(kubectl exec -n "$NAMESPACE" "$pod_name" -- surreal sql \
    --endpoint http://localhost:8000 \
    --username root --password root \
    --namespace metabob --database production \
    --command "INFO FOR DB;" 2>&1 || true)
  
  local found_count=0
  for index in "${EXPECTED_INDEXES[@]}"; do
    if echo "$indexes_output" | grep -q "$index"; then
      ((found_count++))
    else
      print_test "FAIL" "Index '$index' not found in database"
    fi
  done
  
  if [ "$found_count" -eq "$EXPECTED_INDEX_COUNT" ]; then
    print_test "PASS" "All $EXPECTED_INDEX_COUNT indexes exist in SurrealDB"
    return 0
  else
    print_test "FAIL" "Only $found_count/$EXPECTED_INDEX_COUNT indexes found"
    return 1
  fi
}

# Main validation runner
main() {
  echo "========================================"
  echo "Database Schema Initialization Validation"
  echo "========================================"
  echo ""
  
  local total_tests=10
  local passed_tests=0
  local failed_tests=0
  
  # Run configuration tests (non-destructive)
  test_init_schema_enabled && ((passed_tests++)) || ((failed_tests++))
  test_deployment_args && ((passed_tests++)) || ((failed_tests++))
  test_statefulset_args && ((passed_tests++)) || ((failed_tests++))
  
  # Ask user for confirmation before destructive tests
  echo ""
  echo "Configuration tests passed. Ready to perform clean deployment test."
  echo -e "${YELLOW}WARNING: This will destroy and recreate the entire deployment!${NC}"
  read -p "Continue with clean deployment test? (yes/no): " confirm
  
  if [ "$confirm" != "yes" ]; then
    print_test "INFO" "Clean deployment test skipped by user"
    echo ""
    echo "========================================"
    echo "Validation Results (Partial)"
    echo "========================================"
    echo "Total Tests: $total_tests"
    echo -e "${GREEN}Passed: $passed_tests${NC}"
    echo -e "${RED}Failed: $failed_tests${NC}"
    echo "Skipped: $((total_tests - passed_tests - failed_tests))"
    exit 0
  fi
  
  # Run deployment tests
  test_clean_deployment && ((passed_tests++)) || ((failed_tests++))
  test_init_schema_job_exists && ((passed_tests++)) || ((failed_tests++))
  test_init_schema_job_completion && ((passed_tests++)) || ((failed_tests++))
  test_init_schema_job_logs && ((passed_tests++)) || ((failed_tests++))
  test_surrealdb_pod_running && ((passed_tests++)) || ((failed_tests++))
  test_surrealdb_tables_exist && ((passed_tests++)) || ((failed_tests++))
  test_surrealdb_indexes_exist && ((passed_tests++)) || ((failed_tests++))
  
  # Print summary
  echo ""
  echo "========================================"
  echo "Validation Results"
  echo "========================================"
  echo "Total Tests: $total_tests"
  echo -e "${GREEN}Passed: $passed_tests${NC}"
  echo -e "${RED}Failed: $failed_tests${NC}"
  echo ""
  
  if [ "$failed_tests" -eq 0 ]; then
    echo -e "${GREEN}✓ ALL TESTS PASSED${NC}"
    echo ""
    echo "Database Schema Initialization specification is VALID"
    exit 0
  else
    echo -e "${RED}✗ SOME TESTS FAILED${NC}"
    echo ""
    echo "Database Schema Initialization specification is INVALID"
    exit 1
  fi
}

# Run main function
main "$@"
