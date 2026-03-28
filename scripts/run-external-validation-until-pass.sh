#!/bin/bash
# Iterative runner for external activity system validation
# This script:
# 1. Builds OpenCode distribution
# 2. Runs external validation harness
# 3. Analyzes results
# 4. If tests fail, prompts for fixes and re-runs
# 5. Continues until 100% pass rate or max iterations reached

set -e

# Configuration
MAX_ITERATIONS=5
WORKSPACE_DIR="/home/avi/documents/work/exp-repo/metabob-devbob"
OPENCODE_DIR="$WORKSPACE_DIR/repos/metabob-opencode/packages/opencode"
HARNESS_FILE="$WORKSPACE_DIR/tests/validation-harnesses/external-activity-system-validation-harness.ts"
RESULTS_DIR="$WORKSPACE_DIR/test-results/external-validation-harness"
ITERATION_LOG="$RESULTS_DIR/iteration-history-$(date +%s).log"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Ensure results directory exists
mkdir -p "$RESULTS_DIR"

echo "========================================================================" | tee -a "$ITERATION_LOG"
echo "External Activity System Validation - Iterative Runner" | tee -a "$ITERATION_LOG"
echo "========================================================================" | tee -a "$ITERATION_LOG"
echo "" | tee -a "$ITERATION_LOG"

# Pre-flight checks
echo -e "${BLUE}Pre-flight checks...${NC}" | tee -a "$ITERATION_LOG"
echo "" | tee -a "$ITERATION_LOG"

# Check for Bun runtime
if ! command -v bun &> /dev/null; then
    echo -e "${RED}ERROR: Bun runtime not found!${NC}" | tee -a "$ITERATION_LOG"
    echo "Please install Bun: https://bun.sh" | tee -a "$ITERATION_LOG"
    exit 1
fi
echo "✓ Bun runtime: $(bun --version)" | tee -a "$ITERATION_LOG"

# Check for Node.js and npx
if ! command -v node &> /dev/null; then
    echo -e "${RED}ERROR: Node.js not found!${NC}" | tee -a "$ITERATION_LOG"
    echo "Please install Node.js: https://nodejs.org" | tee -a "$ITERATION_LOG"
    exit 1
fi
echo "✓ Node.js: $(node --version)" | tee -a "$ITERATION_LOG"

if ! command -v npx &> /dev/null; then
    echo -e "${RED}ERROR: npx not found!${NC}" | tee -a "$ITERATION_LOG"
    echo "Please install npm (comes with Node.js)" | tee -a "$ITERATION_LOG"
    exit 1
fi
echo "✓ npx available" | tee -a "$ITERATION_LOG"

# Check for ts-node
if ! npx --yes ts-node --version &> /dev/null; then
    echo -e "${YELLOW}WARNING: ts-node not found, will be installed via npx${NC}" | tee -a "$ITERATION_LOG"
fi

echo "" | tee -a "$ITERATION_LOG"

# Step 1: Build OpenCode Distribution
echo -e "${BLUE}Step 1: Building OpenCode distribution...${NC}" | tee -a "$ITERATION_LOG"
echo "" | tee -a "$ITERATION_LOG"

cd "$OPENCODE_DIR"
if ! bun run build 2>&1 | tee -a "$ITERATION_LOG"; then
    echo -e "${RED}ERROR: Build failed!${NC}" | tee -a "$ITERATION_LOG"
    exit 1
fi

# Detect platform and set expected binary path
PLATFORM=$(uname -s | tr '[:upper:]' '[:lower:]')
ARCH=$(uname -m)

# Map architecture names
case "$ARCH" in
    x86_64)
        ARCH="x64"
        ;;
    aarch64|arm64)
        ARCH="arm64"
        ;;
    *)
        echo -e "${YELLOW}WARNING: Unknown architecture $ARCH, assuming x64${NC}" | tee -a "$ITERATION_LOG"
        ARCH="x64"
        ;;
esac

# Construct binary path
EXPECTED_BINARY="$OPENCODE_DIR/dist/opencode-${PLATFORM}-${ARCH}/bin/opencode"

echo "Detected platform: $PLATFORM-$ARCH" | tee -a "$ITERATION_LOG"
echo "Expected binary: $EXPECTED_BINARY" | tee -a "$ITERATION_LOG"
echo "" | tee -a "$ITERATION_LOG"

# Verify build output
if [ ! -f "$EXPECTED_BINARY" ]; then
    echo -e "${RED}ERROR: Expected binary not found: $EXPECTED_BINARY${NC}" | tee -a "$ITERATION_LOG"
    echo "" | tee -a "$ITERATION_LOG"
    echo "Available builds:" | tee -a "$ITERATION_LOG"
    ls -la "$OPENCODE_DIR/dist/" 2>&1 | tee -a "$ITERATION_LOG"
    exit 1
fi

echo -e "${GREEN}✓ Build successful!${NC}" | tee -a "$ITERATION_LOG"
echo "Binary location: $EXPECTED_BINARY" | tee -a "$ITERATION_LOG"
echo "" | tee -a "$ITERATION_LOG"

# Return to workspace
cd "$WORKSPACE_DIR"

# Iterative loop
ITERATION=0
OVERALL_PASS=false

echo "========================================================================" | tee -a "$ITERATION_LOG"
echo "Starting Iterative Validation" | tee -a "$ITERATION_LOG"
echo "Max Iterations: $MAX_ITERATIONS" | tee -a "$ITERATION_LOG"
echo "========================================================================" | tee -a "$ITERATION_LOG"
echo "" | tee -a "$ITERATION_LOG"

while [ $ITERATION -lt $MAX_ITERATIONS ]; do
    ITERATION=$((ITERATION + 1))
    
    echo "" | tee -a "$ITERATION_LOG"
    echo -e "${BLUE}╔════════════════════════════════════════════════════════════════════╗${NC}" | tee -a "$ITERATION_LOG"
    echo -e "${BLUE}║                       ITERATION $ITERATION of $MAX_ITERATIONS                        ║${NC}" | tee -a "$ITERATION_LOG"
    echo -e "${BLUE}╚════════════════════════════════════════════════════════════════════╝${NC}" | tee -a "$ITERATION_LOG"
    echo "" | tee -a "$ITERATION_LOG"
    
    # Step 2: Execute Validation Harness
    echo -e "${BLUE}Executing validation harness...${NC}" | tee -a "$ITERATION_LOG"
    echo "" | tee -a "$ITERATION_LOG"
    
    # Run harness and capture output
    HARNESS_OUTPUT=$(mktemp)
    if npx ts-node "$HARNESS_FILE" 2>&1 | tee "$HARNESS_OUTPUT"; then
        HARNESS_EXIT_CODE=0
    else
        HARNESS_EXIT_CODE=$?
    fi
    
    cat "$HARNESS_OUTPUT" | tee -a "$ITERATION_LOG"
    
    # Step 3: Analyze Results
    echo "" | tee -a "$ITERATION_LOG"
    echo -e "${BLUE}Analyzing results...${NC}" | tee -a "$ITERATION_LOG"
    echo "" | tee -a "$ITERATION_LOG"
    
    # Find most recent result file
    LATEST_RESULT=$(ls -t "$RESULTS_DIR"/validation-result-*.json 2>/dev/null | head -1)
    
    if [ -z "$LATEST_RESULT" ]; then
        echo -e "${RED}ERROR: No result file found in $RESULTS_DIR${NC}" | tee -a "$ITERATION_LOG"
        echo "Harness may have failed to generate results." | tee -a "$ITERATION_LOG"
        
        # Check if this was the last iteration
        if [ $ITERATION -eq $MAX_ITERATIONS ]; then
            echo "" | tee -a "$ITERATION_LOG"
            echo -e "${RED}Max iterations reached without success.${NC}" | tee -a "$ITERATION_LOG"
            exit 1
        fi
        
        # Prompt for manual fix
        echo "" | tee -a "$ITERATION_LOG"
        echo -e "${YELLOW}Please analyze and fix the issue, then press ENTER to continue...${NC}"
        read -r
        continue
    fi
    
    # Parse results
    OVERALL_PASS_STATUS=$(cat "$LATEST_RESULT" | grep -o '"overallPass":[^,}]*' | cut -d':' -f2 | tr -d ' ')
    PASSED_COUNT=$(cat "$LATEST_RESULT" | grep -o '"passed":[0-9]*' | head -1 | cut -d':' -f2)
    TOTAL_COUNT=$(cat "$LATEST_RESULT" | grep -o '"total":[0-9]*' | head -1 | cut -d':' -f2)
    
    echo "Results from: $LATEST_RESULT" | tee -a "$ITERATION_LOG"
    echo "Overall Pass: $OVERALL_PASS_STATUS" | tee -a "$ITERATION_LOG"
    echo "Test Cases: $PASSED_COUNT/$TOTAL_COUNT passed" | tee -a "$ITERATION_LOG"
    echo "" | tee -a "$ITERATION_LOG"
    
    # Check if all tests passed
    if [ "$OVERALL_PASS_STATUS" = "true" ]; then
        OVERALL_PASS=true
        echo -e "${GREEN}╔════════════════════════════════════════════════════════════════════╗${NC}" | tee -a "$ITERATION_LOG"
        echo -e "${GREEN}║                  ✓ ALL TESTS PASSED! ✓                            ║${NC}" | tee -a "$ITERATION_LOG"
        echo -e "${GREEN}╚════════════════════════════════════════════════════════════════════╝${NC}" | tee -a "$ITERATION_LOG"
        echo "" | tee -a "$ITERATION_LOG"
        echo "Passed on iteration $ITERATION" | tee -a "$ITERATION_LOG"
        break
    fi
    
    # Tests failed
    echo -e "${RED}✗ Tests failed ($PASSED_COUNT/$TOTAL_COUNT passed)${NC}" | tee -a "$ITERATION_LOG"
    echo "" | tee -a "$ITERATION_LOG"
    
    # Extract failing test cases
    echo -e "${YELLOW}Failing test cases:${NC}" | tee -a "$ITERATION_LOG"
    cat "$LATEST_RESULT" | grep -A 5 '"passed":false' | tee -a "$ITERATION_LOG"
    echo "" | tee -a "$ITERATION_LOG"
    
    # Check if this was the last iteration
    if [ $ITERATION -eq $MAX_ITERATIONS ]; then
        echo -e "${RED}Max iterations reached without success.${NC}" | tee -a "$ITERATION_LOG"
        break
    fi
    
    # Step 4: Prompt for fixes
    echo -e "${YELLOW}Iteration $ITERATION complete with failures.${NC}" | tee -a "$ITERATION_LOG"
    echo "" | tee -a "$ITERATION_LOG"
    echo "Please:" | tee -a "$ITERATION_LOG"
    echo "1. Review the failure details above" | tee -a "$ITERATION_LOG"
    echo "2. Review logs in: $RESULTS_DIR" | tee -a "$ITERATION_LOG"
    echo "3. Apply fixes to code or test patterns" | tee -a "$ITERATION_LOG"
    echo "4. Press ENTER to re-run validation" | tee -a "$ITERATION_LOG"
    echo "" | tee -a "$ITERATION_LOG"
    
    read -p "Ready to continue? (Press ENTER or Ctrl+C to abort) " -r
    
    # Clean up temp file
    rm -f "$HARNESS_OUTPUT"
done

# Step 5: Meta-Validation (if passed)
if [ "$OVERALL_PASS" = true ]; then
    echo "" | tee -a "$ITERATION_LOG"
    echo "========================================================================" | tee -a "$ITERATION_LOG"
    echo "Step 5: Meta-Validation" | tee -a "$ITERATION_LOG"
    echo "========================================================================" | tee -a "$ITERATION_LOG"
    echo "" | tee -a "$ITERATION_LOG"
    
    echo -e "${BLUE}Verifying test correctness...${NC}" | tee -a "$ITERATION_LOG"
    
    # Check meta-validation fields
    META_VALID=$(cat "$LATEST_RESULT" | grep -o '"allRequirementsTested":[^,}]*' | cut -d':' -f2 | tr -d ' ')
    
    echo "Meta-Validation Status: $META_VALID" | tee -a "$ITERATION_LOG"
    echo "" | tee -a "$ITERATION_LOG"
    
    if [ "$META_VALID" != "true" ]; then
        echo -e "${YELLOW}WARNING: Meta-validation indicates not all requirements were tested!${NC}" | tee -a "$ITERATION_LOG"
        echo "Please review the test case definitions." | tee -a "$ITERATION_LOG"
        echo "" | tee -a "$ITERATION_LOG"
    fi
    
    # Display test evidence summary
    echo -e "${BLUE}Test Evidence Summary:${NC}" | tee -a "$ITERATION_LOG"
    echo "" | tee -a "$ITERATION_LOG"
    
    cat "$LATEST_RESULT" | grep -A 3 '"testCases"' | head -20 | tee -a "$ITERATION_LOG"
    echo "" | tee -a "$ITERATION_LOG"
fi

# Step 6: Generate Final Report
echo "" | tee -a "$ITERATION_LOG"
echo "========================================================================" | tee -a "$ITERATION_LOG"
echo "Final Report" | tee -a "$ITERATION_LOG"
echo "========================================================================" | tee -a "$ITERATION_LOG"
echo "" | tee -a "$ITERATION_LOG"

echo "Total Iterations: $ITERATION" | tee -a "$ITERATION_LOG"
echo "Final Status: $([ "$OVERALL_PASS" = true ] && echo -e "${GREEN}PASSED${NC}" || echo -e "${RED}FAILED${NC}")" | tee -a "$ITERATION_LOG"
echo "Results Directory: $RESULTS_DIR" | tee -a "$ITERATION_LOG"
echo "Iteration Log: $ITERATION_LOG" | tee -a "$ITERATION_LOG"
echo "" | tee -a "$ITERATION_LOG"

if [ "$OVERALL_PASS" = true ]; then
    echo -e "${GREEN}External validation harness completed successfully!${NC}" | tee -a "$ITERATION_LOG"
    echo "" | tee -a "$ITERATION_LOG"
    echo "This proves:" | tee -a "$ITERATION_LOG"
    echo "  ✓ OpenCode distribution builds correctly" | tee -a "$ITERATION_LOG"
    echo "  ✓ Activity system can find existing activities" | tee -a "$ITERATION_LOG"
    echo "  ✓ Activity system can create new activities via goal-seeking" | tee -a "$ITERATION_LOG"
    echo "  ✓ NO direct tool calls occur in root session" | tee -a "$ITERATION_LOG"
    echo "  ✓ All operations go through activity-first architecture" | tee -a "$ITERATION_LOG"
    echo "" | tee -a "$ITERATION_LOG"
    exit 0
else
    echo -e "${RED}External validation harness failed after $ITERATION iterations.${NC}" | tee -a "$ITERATION_LOG"
    echo "" | tee -a "$ITERATION_LOG"
    echo "Please review:" | tee -a "$ITERATION_LOG"
    echo "  • Test results in: $RESULTS_DIR" | tee -a "$ITERATION_LOG"
    echo "  • Iteration log: $ITERATION_LOG" | tee -a "$ITERATION_LOG"
    echo "  • Harness implementation: $HARNESS_FILE" | tee -a "$ITERATION_LOG"
    echo "" | tee -a "$ITERATION_LOG"
    exit 1
fi
