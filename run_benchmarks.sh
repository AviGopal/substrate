#!/bin/bash
# Metabob-CLI Benchmark Runner
# Runs all 5 core benchmark criteria tests

set -e

echo "════════════════════════════════════════════════════════════════════════"
echo "                 METABOB-CLI BENCHMARK SUITE"
echo "════════════════════════════════════════════════════════════════════════"
echo ""
echo "Running 5 core performance benchmarks..."
echo ""

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Track results
PASSED=0
FAILED=0
WARNINGS=0

# Function to run a test and capture result
run_test() {
    local test_num=$1
    local test_name=$2
    local test_cmd=$3
    
    echo ""
    echo "────────────────────────────────────────────────────────────────────────"
    echo "${BLUE}[$test_num/5] $test_name${NC}"
    echo "────────────────────────────────────────────────────────────────────────"
    echo ""
    
    if eval $test_cmd; then
        echo ""
        echo "${GREEN}✅ PASSED${NC}: $test_name"
        ((PASSED++))
    else
        echo ""
        echo "${RED}❌ FAILED${NC}: $test_name"
        ((FAILED++))
    fi
}

# 1. Startup Timing
run_test 1 "Time to Start Up" \
    "node repos/metabob-cli/tests/test_startup_timing.mjs"

# 2. First Tool Response
run_test 2 "Time to First Tool Response" \
    "pytest repos/metabob-cli/tests/performance/test_mcp_performance_specs.py::test_handles_medium_codebase_efficiently -v --tb=short"

# 3. Codebase Traversal (Small + Medium, skip Large for speed)
echo ""
echo "────────────────────────────────────────────────────────────────────────"
echo "${BLUE}[3/5] Time to Full Traverse Codebase${NC}"
echo "────────────────────────────────────────────────────────────────────────"
echo ""
echo "Running small + medium codebase tests (skipping large for speed)..."
echo ""

if pytest repos/cpg-inference/tests/test_benchmarks.py::test_benchmark_cold_start_small -v --tb=short && \
   pytest repos/cpg-inference/tests/test_benchmarks.py::test_benchmark_cold_start_medium -v --tb=short; then
    echo ""
    echo "${GREEN}✅ PASSED${NC}: Time to Full Traverse Codebase"
    ((PASSED++))
else
    echo ""
    echo "${RED}❌ FAILED${NC}: Time to Full Traverse Codebase"
    ((FAILED++))
fi

# 4. Cochange Embeddings
run_test 4 "Time to Compute Cochange Embeddings" \
    "pytest repos/cpg-inference/tests/test_benchmarks.py::test_benchmark_cochange_prediction -v --tb=short && \
     pytest repos/cpg-inference/tests/test_benchmarks.py::test_benchmark_faiss_indexing -v --tb=short"

# 5. State Updates
run_test 5 "Time to Update State" \
    "pytest repos/metabob-cli/tests/performance/test_mcp_performance_specs.py::test_state_reload_completes_quickly -v --tb=short && \
     pytest repos/metabob-cli/tests/performance/test_mcp_performance_specs.py::test_issue_iteration_scales_efficiently -v --tb=short"

# Summary
echo ""
echo "════════════════════════════════════════════════════════════════════════"
echo "                         BENCHMARK SUMMARY"
echo "════════════════════════════════════════════════════════════════════════"
echo ""
echo "Results:"
echo "  ${GREEN}✅ Passed:${NC} $PASSED/5"
if [ $FAILED -gt 0 ]; then
    echo "  ${RED}❌ Failed:${NC} $FAILED/5"
fi
if [ $WARNINGS -gt 0 ]; then
    echo "  ${YELLOW}⚠️  Warnings:${NC} $WARNINGS"
fi
echo ""

if [ $FAILED -eq 0 ]; then
    echo "${GREEN}════════════════════════════════════════════════════════════════════════${NC}"
    echo "${GREEN}                    ✅ ALL BENCHMARKS PASSED                            ${NC}"
    echo "${GREEN}════════════════════════════════════════════════════════════════════════${NC}"
    exit 0
else
    echo "${RED}════════════════════════════════════════════════════════════════════════${NC}"
    echo "${RED}                 ❌ SOME BENCHMARKS FAILED                              ${NC}"
    echo "${RED}════════════════════════════════════════════════════════════════════════${NC}"
    echo ""
    echo "Review the output above for details."
    echo "For more information, see: METABOB_CLI_BENCHMARK_MAPPING.md"
    exit 1
fi
