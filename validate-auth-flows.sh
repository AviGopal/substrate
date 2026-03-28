#!/bin/bash
#
# Validate Authentication Flows
#
# This script runs end-to-end validation of both client authentication flows:
# 1. metabob-mcp → activity-api → SurrealDB (API key auth)
# 2. minibob → activity-api → SurrealDB (instance auth)
# 3. metabob-mcp → analysis-api → SurrealDB (user auth)
#
# Prerequisites:
# - SurrealDB running on localhost:8000
# - activity-api running on localhost:8080
# - analysis-api running on localhost:8081
#
# Usage: ./validate-auth-flows.sh

set -e

echo "╔══════════════════════════════════════════════════════════════════╗"
echo "║           Multi-Tenant Auth Flow Validation Suite                ║"
echo "╠══════════════════════════════════════════════════════════════════╣"
echo "║  Validates scoped authentication from clients to SurrealDB       ║"
echo "╚══════════════════════════════════════════════════════════════════╝"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check prerequisites
echo "Checking prerequisites..."

check_service() {
  local name=$1
  local url=$2
  if curl -sf "$url/health" > /dev/null 2>&1; then
    echo -e "  ${GREEN}✓${NC} $name is running at $url"
    return 0
  else
    echo -e "  ${RED}✗${NC} $name is NOT running at $url"
    return 1
  fi
}

check_surreal() {
  local url=${SURREALDB_URL:-http://localhost:8000}
  if curl -sf "$url/health" > /dev/null 2>&1; then
    echo -e "  ${GREEN}✓${NC} SurrealDB is running at $url"
    return 0
  else
    echo -e "  ${RED}✗${NC} SurrealDB is NOT running at $url"
    return 1
  fi
}

PREREQ_OK=true
check_surreal || PREREQ_OK=false
check_service "activity-api" "${ACTIVITY_API_URL:-http://localhost:8080}" || PREREQ_OK=false
check_service "analysis-api" "${ANALYSIS_API_URL:-http://localhost:8081}" || PREREQ_OK=false

if [ "$PREREQ_OK" = false ]; then
  echo ""
  echo -e "${YELLOW}Warning: Some services are not running.${NC}"
  echo "Please start the required services before running validation."
  echo ""
  echo "To start services locally:"
  echo "  cd repos/metabob-activity-api && bun run start &"
  echo "  cd repos/metabob-analysis-api && bun run start &"
  echo ""
  read -p "Continue anyway? (y/N) " -n 1 -r
  echo
  if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    exit 1
  fi
fi

echo ""
echo "════════════════════════════════════════════════════════════════════"
echo ""

# Run the validation scripts
run_test() {
  local name=$1
  local dir=$2
  local script=$3

  echo "┌────────────────────────────────────────────────────────────────────┐"
  echo "│ Running: $name"
  echo "└────────────────────────────────────────────────────────────────────┘"
  echo ""

  cd "$dir"
  if bun run "$script" 2>&1; then
    echo -e "\n${GREEN}✓ $name PASSED${NC}\n"
    return 0
  else
    echo -e "\n${RED}✗ $name FAILED${NC}\n"
    return 1
  fi
}

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RESULTS=()

# Test 1: MCP → Activity API flow (API key auth)
if [ -f "$SCRIPT_DIR/repos/metabob-activity-api/test-mcp-auth-flow.ts" ]; then
  if run_test "MCP API Key Auth Flow" "$SCRIPT_DIR/repos/metabob-activity-api" "test-mcp-auth-flow.ts"; then
    RESULTS+=("MCP API Key Auth: PASSED")
  else
    RESULTS+=("MCP API Key Auth: FAILED")
  fi
else
  echo "Skipping MCP API Key Auth Flow (script not found)"
  RESULTS+=("MCP API Key Auth: SKIPPED")
fi

echo ""

# Test 2: MiniBob → Activity API flow (instance auth)
if [ -f "$SCRIPT_DIR/repos/metabob-activity-api/test-minibob-auth-flow.ts" ]; then
  if run_test "MiniBob Instance Auth Flow" "$SCRIPT_DIR/repos/metabob-activity-api" "test-minibob-auth-flow.ts"; then
    RESULTS+=("MiniBob Instance Auth: PASSED")
  else
    RESULTS+=("MiniBob Instance Auth: FAILED")
  fi
else
  echo "Skipping MiniBob Instance Auth Flow (script not found)"
  RESULTS+=("MiniBob Instance Auth: SKIPPED")
fi

echo ""

# Test 3: MCP → Analysis API flow (user auth)
if [ -f "$SCRIPT_DIR/repos/metabob-analysis-api/test-analysis-auth-flow.ts" ]; then
  if run_test "Analysis API User Auth Flow" "$SCRIPT_DIR/repos/metabob-analysis-api" "test-analysis-auth-flow.ts"; then
    RESULTS+=("Analysis API User Auth: PASSED")
  else
    RESULTS+=("Analysis API User Auth: FAILED")
  fi
else
  echo "Skipping Analysis API User Auth Flow (script not found)"
  RESULTS+=("Analysis API User Auth: SKIPPED")
fi

# Summary
echo ""
echo "╔══════════════════════════════════════════════════════════════════╗"
echo "║                     VALIDATION SUMMARY                           ║"
echo "╚══════════════════════════════════════════════════════════════════╝"
echo ""

for result in "${RESULTS[@]}"; do
  if [[ $result == *"PASSED"* ]]; then
    echo -e "  ${GREEN}✓${NC} $result"
  elif [[ $result == *"FAILED"* ]]; then
    echo -e "  ${RED}✗${NC} $result"
  else
    echo -e "  ${YELLOW}⊘${NC} $result"
  fi
done

echo ""
echo "────────────────────────────────────────────────────────────────────"
echo ""
echo "Data Flows Validated:"
echo ""
echo "  1. metabob-mcp → activity-api → SurrealDB"
echo "     └─ API key exchange → JWT → scoped template queries"
echo ""
echo "  2. minibob → activity-api → SurrealDB"
echo "     └─ Instance signin → JWT → project-scoped execution"
echo ""
echo "  3. metabob-mcp → analysis-api → SurrealDB"
echo "     └─ User login → JWT → org-scoped analysis"
echo ""

# Exit with error if any test failed
for result in "${RESULTS[@]}"; do
  if [[ $result == *"FAILED"* ]]; then
    exit 1
  fi
done

echo "All validations passed! ✓"
