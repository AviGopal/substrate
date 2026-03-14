#!/bin/bash
# Validation Harness: SurrealDB v3.0.0 Schema Initialization on K8s Deployment
# Purpose: Verify SurrealDB deployment meets all specification requirements
# Usage: ./surrealdb-v3-schema-init-harness.sh [--json]

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# JSON output flag
JSON_OUTPUT=false
if [[ "${1:-}" == "--json" ]]; then
    JSON_OUTPUT=true
fi

# Results tracking
TOTAL_CHECKS=0
PASSED_CHECKS=0
FAILED_CHECKS=()

# Helper functions
check_start() {
    TOTAL_CHECKS=$((TOTAL_CHECKS + 1))
    if [[ "$JSON_OUTPUT" == "false" ]]; then
        echo -n "[$TOTAL_CHECKS] $1... "
    fi
}

check_pass() {
    PASSED_CHECKS=$((PASSED_CHECKS + 1))
    if [[ "$JSON_OUTPUT" == "false" ]]; then
        echo -e "${GREEN}PASS${NC}"
        if [[ -n "${1:-}" ]]; then
            echo "    ✓ $1"
        fi
    fi
}

check_fail() {
    FAILED_CHECKS+=("Check $TOTAL_CHECKS: $1")
    if [[ "$JSON_OUTPUT" == "false" ]]; then
        echo -e "${RED}FAIL${NC}"
        echo "    ✗ $2"
        if [[ -n "${3:-}" ]]; then
            echo "    Expected: $3"
            echo "    Actual: $4"
        fi
    fi
}

# Validation Check 1: SurrealDB Pod Status
check_start "SurrealDB pod is Running"
POD_STATUS=$(kubectl get pods -n metabob -l app=surrealdb -o jsonpath='{.items[0].status.phase}' 2>/dev/null || echo "NotFound")
if [[ "$POD_STATUS" == "Running" ]]; then
    check_pass "Pod status: $POD_STATUS"
else
    check_fail "SurrealDB pod status" "Pod not running" "Running" "$POD_STATUS"
fi

# Validation Check 2: SurrealDB v3.0.0 Image
check_start "SurrealDB uses v3.0.0 image"
IMAGE_TAG=$(kubectl get pods -n metabob -l app=surrealdb -o jsonpath='{.items[0].spec.containers[0].image}' 2>/dev/null || echo "")
if [[ "$IMAGE_TAG" == *"v3.0.0"* ]]; then
    check_pass "Image: $IMAGE_TAG"
else
    check_fail "SurrealDB image version" "Wrong image version" "surrealdb/surrealdb:v3.0.0" "$IMAGE_TAG"
fi

# Validation Check 3: SurrealDB v3.0.0 Flags
check_start "SurrealDB uses --default-namespace and --default-database flags"
POD_ARGS=$(kubectl get pods -n metabob -l app=surrealdb -o jsonpath='{.items[0].spec.containers[0].args}' 2>/dev/null || echo "")
if [[ "$POD_ARGS" == *"--default-namespace"* ]] && [[ "$POD_ARGS" == *"--default-database"* ]]; then
    check_pass "Found v3.0.0 flags (not deprecated --ns/--db)"
else
    check_fail "SurrealDB v3.0.0 flags" "Missing --default-namespace or --default-database flags" "--default-namespace and --default-database" "$POD_ARGS"
fi

# Validation Check 4: Database Name Configuration
check_start "SurrealDB database name is 'production'"
DB_NAME=$(kubectl get pods -n metabob -l app=surrealdb -o jsonpath='{.items[0].spec.containers[0].args}' 2>/dev/null | grep -oP '(?<=--default-database )\w+' || echo "")
if [[ "$DB_NAME" == "production" ]]; then
    check_pass "Database: $DB_NAME"
else
    check_fail "SurrealDB database name" "Wrong database name" "production" "$DB_NAME"
fi

# Validation Check 5: Init-Schema ConfigMap Exists
check_start "Init-schema ConfigMap exists"
CONFIGMAP_EXISTS=$(kubectl get configmap -n metabob surrealdb-init-schema -o name 2>/dev/null || echo "")
if [[ -n "$CONFIGMAP_EXISTS" ]]; then
    check_pass "ConfigMap: surrealdb-init-schema"
else
    check_fail "Init-schema ConfigMap" "ConfigMap not found" "configmap/surrealdb-init-schema" "not found"
fi

# Validation Check 6: StatefulSet vs Deployment (Persistence Check)
check_start "SurrealDB uses StatefulSet (not Deployment)"
RESOURCE_TYPE=$(kubectl get statefulset,deployment -n metabob -l app=surrealdb -o jsonpath='{.items[0].kind}' 2>/dev/null || echo "NotFound")
if [[ "$RESOURCE_TYPE" == "StatefulSet" ]]; then
    check_pass "Using StatefulSet for persistence"
else
    check_fail "SurrealDB resource type" "Should use StatefulSet for persistent storage" "StatefulSet" "$RESOURCE_TYPE"
fi

# Validation Check 7: RocksDB Storage Backend
check_start "SurrealDB uses RocksDB storage (not memory)"
STORAGE_BACKEND=$(kubectl get pods -n metabob -l app=surrealdb -o jsonpath='{.items[0].spec.containers[0].args[-1]}' 2>/dev/null || echo "")
if [[ "$STORAGE_BACKEND" == rocksdb:* ]]; then
    check_pass "Storage: $STORAGE_BACKEND"
else
    check_fail "SurrealDB storage backend" "Should use rocksdb for persistence" "rocksdb:/data/database.db" "$STORAGE_BACKEND"
fi

# Validation Check 8: RPC API Database Name Alignment
check_start "RPC API SURREALDB_DATABASE env matches SurrealDB"
RPC_DB_NAME=$(kubectl get deployment -n metabob metabob-rpc-api -o jsonpath='{.spec.template.spec.containers[0].env[?(@.name=="SURREALDB_DATABASE")].value}' 2>/dev/null || echo "")
if [[ "$RPC_DB_NAME" == "production" ]]; then
    check_pass "RPC API database: $RPC_DB_NAME"
else
    check_fail "RPC API database name" "Database name mismatch with SurrealDB" "production" "$RPC_DB_NAME"
fi

# Validation Check 9: RPC API Pod Status
check_start "RPC API pod is Running"
RPC_POD_STATUS=$(kubectl get pods -n metabob -l app=metabob-rpc-api -o jsonpath='{.items[0].status.phase}' 2>/dev/null || echo "NotFound")
if [[ "$RPC_POD_STATUS" == "Running" ]]; then
    check_pass "RPC API status: $RPC_POD_STATUS"
else
    check_fail "RPC API pod status" "Pod not running" "Running" "$RPC_POD_STATUS"
fi

# Validation Check 10: Schema Tables Verification (via RPC API)
check_start "Schema tables have PERMISSIONS FULL"
TABLES_CHECK=$(kubectl exec -n metabob deployment/metabob-rpc-api -- python3 -c "
import os
import requests
import sys

try:
    url = 'http://surrealdb:8000/rpc'
    auth_resp = requests.post(url, json={'method': 'signin', 'params': [{'user': os.environ['SURREAL_USER'], 'pass': os.environ['SURREAL_PASS']}]}, timeout=5)
    token = auth_resp.json()['result']
    
    info_resp = requests.post(
        url,
        headers={'Authorization': f'Bearer {token}', 'Surreal-NS': 'metabob', 'Surreal-DB': 'production'},
        json={'method': 'query', 'params': ['INFO FOR DB;']},
        timeout=5
    )
    
    tables_info = info_resp.json()['result'][0]['result']['tables']
    total_tables = len(tables_info)
    tables_with_perms = sum(1 for defn in tables_info.values() if 'PERMISSIONS FULL' in str(defn))
    
    print(f'{tables_with_perms}/{total_tables}')
except Exception as e:
    print(f'ERROR: {str(e)}', file=sys.stderr)
    sys.exit(1)
" 2>/dev/null || echo "0/0")

TABLES_WITH_PERMS=$(echo "$TABLES_CHECK" | cut -d'/' -f1)
TOTAL_TABLES=$(echo "$TABLES_CHECK" | cut -d'/' -f2)

if [[ "$TABLES_WITH_PERMS" -ge 13 ]] && [[ "$TOTAL_TABLES" -ge 13 ]]; then
    check_pass "Tables with PERMISSIONS FULL: $TABLES_CHECK"
else
    check_fail "Schema table permissions" "Insufficient tables with PERMISSIONS FULL" "≥13/13" "$TABLES_CHECK"
fi

# Validation Check 11: GAP-9 End-to-End Test
check_start "GAP-9 test: Store and retrieve activities"
if [[ -f "gap9_demo_test.sh" ]]; then
    GAP9_OUTPUT=$(bash gap9_demo_test.sh 2>&1 || echo "FAILED")
    if echo "$GAP9_OUTPUT" | grep -q "Dashboard returns: 5 activities"; then
        check_pass "Successfully posted and retrieved 5 activities"
    else
        check_fail "GAP-9 end-to-end test" "Failed to store/retrieve activities" "5 activities" "test failed or returned incorrect count"
    fi
else
    check_fail "GAP-9 test script" "Script not found" "gap9_demo_test.sh exists" "file not found"
fi

# Output Results
if [[ "$JSON_OUTPUT" == "true" ]]; then
    # JSON output for programmatic consumption
    cat << JSONEOF
{
  "specificationName": "SurrealDB v3.0.0 Schema Initialization on K8s Deployment",
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "totalChecks": $TOTAL_CHECKS,
  "passedChecks": $PASSED_CHECKS,
  "failedChecks": $((TOTAL_CHECKS - PASSED_CHECKS)),
  "pass": $([ $PASSED_CHECKS -eq $TOTAL_CHECKS ] && echo "true" || echo "false"),
  "failures": [
$(IFS=,; printf '    "%s"\n' "${FAILED_CHECKS[@]}" | sed '$!s/$/,/')
  ],
  "checks": {
    "surrealdbPodRunning": $([ "$POD_STATUS" == "Running" ] && echo "true" || echo "false"),
    "surrealdbV3Image": $([ "$IMAGE_TAG" == *"v3.0.0"* ] && echo "true" || echo "false"),
    "v3FlagsUsed": $([ "$POD_ARGS" == *"--default-namespace"* ] && echo "true" || echo "false"),
    "databaseNameProduction": $([ "$DB_NAME" == "production" ] && echo "true" || echo "false"),
    "initSchemaConfigMapExists": $([ -n "$CONFIGMAP_EXISTS" ] && echo "true" || echo "false"),
    "usesStatefulSet": $([ "$RESOURCE_TYPE" == "StatefulSet" ] && echo "true" || echo "false"),
    "usesRocksDB": $([ "$STORAGE_BACKEND" == rocksdb:* ] && echo "true" || echo "false"),
    "rpcApiDatabaseAligned": $([ "$RPC_DB_NAME" == "production" ] && echo "true" || echo "false"),
    "rpcApiRunning": $([ "$RPC_POD_STATUS" == "Running" ] && echo "true" || echo "false"),
    "tablesHavePermissionsFull": $([ "$TABLES_WITH_PERMS" -ge 13 ] && echo "true" || echo "false"),
    "gap9TestPassed": $([ -f "gap9_demo_test.sh" ] && echo "true" || echo "false")
  }
}
JSONEOF
else
    # Human-readable output
    echo ""
    echo "========================================"
    echo "Validation Results"
    echo "========================================"
    echo "Total Checks: $TOTAL_CHECKS"
    echo -e "Passed: ${GREEN}$PASSED_CHECKS${NC}"
    echo -e "Failed: ${RED}$((TOTAL_CHECKS - PASSED_CHECKS))${NC}"
    echo ""
    
    if [[ $PASSED_CHECKS -eq $TOTAL_CHECKS ]]; then
        echo -e "${GREEN}✅ ALL CHECKS PASSED${NC}"
        echo "Specification: SurrealDB v3.0.0 Schema Initialization is VALID"
        exit 0
    else
        echo -e "${RED}❌ VALIDATION FAILED${NC}"
        echo "Failed checks:"
        for failure in "${FAILED_CHECKS[@]}"; do
            echo -e "  ${RED}✗${NC} $failure"
        done
        exit 1
    fi
fi
