#!/bin/bash
# Test Agent Execution CLI Intelligence Integration
# Verifies that code_context enrichment is working end-to-end

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

echo "======================================================================"
echo "Agent Execution CLI Intelligence - Integration Test"
echo "======================================================================"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test counters
TESTS_RUN=0
TESTS_PASSED=0
TESTS_FAILED=0

test_step() {
    echo -e "${BLUE}[TEST]${NC} $1"
    TESTS_RUN=$((TESTS_RUN + 1))
}

test_pass() {
    echo -e "${GREEN}[PASS]${NC} $1"
    TESTS_PASSED=$((TESTS_PASSED + 1))
}

test_fail() {
    echo -e "${RED}[FAIL]${NC} $1"
    TESTS_FAILED=$((TESTS_FAILED + 1))
}

test_info() {
    echo -e "${YELLOW}[INFO]${NC} $1"
}

# =============================================================================
# Test 1: Check Backend Services
# =============================================================================

test_step "Checking backend services availability"

# Check Redis
if docker exec metabob-redis redis-cli ping > /dev/null 2>&1; then
    test_pass "Redis is healthy"
else
    test_fail "Redis is not responding"
    exit 1
fi

# Check API Server
if curl -sf http://localhost:8080/health > /dev/null 2>&1; then
    test_pass "API Server is healthy"
else
    test_fail "API Server is not responding"
    exit 1
fi

echo ""

# =============================================================================
# Test 2: Verify CLI MCP Tools
# =============================================================================

test_step "Checking CLI MCP tools registration"

# Check if CLI MCP tools file exists
CLI_TOOLS_FILE="$PROJECT_ROOT/repos/metabob-cli/src/metabob_cli/mcp/agent_execution_tools.py"
if [ -f "$CLI_TOOLS_FILE" ]; then
    test_pass "CLI agent execution tools file exists"
    
    # Check for key methods
    if grep -q "enrich_with_code_context" "$CLI_TOOLS_FILE"; then
        test_pass "enrich_with_code_context method found"
    else
        test_fail "enrich_with_code_context method not found"
    fi
else
    test_fail "CLI agent execution tools file not found"
fi

echo ""

# =============================================================================
# Test 3: Create Test File for Enrichment
# =============================================================================

test_step "Creating test Python file for enrichment"

TEST_FILE="$PROJECT_ROOT/test_enrichment_sample.py"
cat > "$TEST_FILE" << 'EOF'
"""Test file for agent execution enrichment"""

import os
import sys

def authenticate_user(username: str, password: str) -> bool:
    """Authenticate a user with credentials"""
    # Dummy implementation
    return username == "admin" and password == "secret"

def verify_password(password: str) -> bool:
    """Verify password strength"""
    return len(password) >= 8

class UserSession:
    """Manages user session state"""
    
    def __init__(self, user_id: str):
        self.user_id = user_id
        self.active = True
    
    def terminate(self):
        """End the user session"""
        self.active = False

def main():
    """Main entry point"""
    user = "admin"
    if authenticate_user(user, "secret"):
        session = UserSession(user)
        print(f"Session created for {user}")
EOF

if [ -f "$TEST_FILE" ]; then
    test_pass "Test file created: $TEST_FILE"
else
    test_fail "Failed to create test file"
fi

echo ""

# =============================================================================
# Test 4: Test Direct CLI Enrichment (Bypass OpenCode)
# =============================================================================

test_step "Testing CLI enrichment directly"

test_info "This test bypasses OpenCode and calls CLI enrichment directly"
test_info "It verifies the AgentExecutionTools class works correctly"

# Create a minimal Python test script
DIRECT_TEST_SCRIPT="$PROJECT_ROOT/test_cli_enrichment_direct.py"
cat > "$DIRECT_TEST_SCRIPT" << EOF
#!/usr/bin/env python3
"""Direct test of CLI enrichment (bypass OpenCode)"""

import sys
import os

# Add CLI source to path
sys.path.insert(0, '${PROJECT_ROOT}/repos/metabob-cli/src')

from metabob_cli.mcp.agent_execution_tools import AgentExecutionTools

def main():
    # Initialize tools
    tools = AgentExecutionTools()
    
    # Test enrichment on our sample file
    test_file = '${TEST_FILE}'
    
    if not os.path.exists(test_file):
        print(f"ERROR: Test file not found: {test_file}")
        sys.exit(1)
    
    print(f"Testing enrichment on: {test_file}")
    print("-" * 60)
    
    # Call enrichment
    try:
        code_context = tools.enrich_with_code_context(
            file_path=test_file,
            project_root='${PROJECT_ROOT}'
        )
        
        if code_context:
            print("SUCCESS: Code context enriched!")
            print(f"Components found: {len(code_context.get('components', []))}")
            print(f"Components: {code_context.get('components', [])}")
            print(f"Impact score: {code_context.get('impact_score', 'N/A')}")
            print(f"Dependents: {code_context.get('dependents_count', 0)}")
            print(f"Similar files: {len(code_context.get('similar_files', []))}")
            sys.exit(0)
        else:
            print("WARNING: No code context returned")
            sys.exit(1)
    except Exception as e:
        print(f"ERROR: Enrichment failed: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

if __name__ == '__main__':
    main()
EOF

chmod +x "$DIRECT_TEST_SCRIPT"

# Run the direct test
if python3 "$DIRECT_TEST_SCRIPT" 2>&1; then
    test_pass "CLI enrichment works correctly (direct test)"
else
    test_fail "CLI enrichment failed (direct test)"
fi

echo ""

# =============================================================================
# Test 5: Check OpenCode Integration
# =============================================================================

test_step "Verifying OpenCode integration code"

OPENCODE_TRACKER="$PROJECT_ROOT/repos/metabob-opencode/packages/opencode/src/session/agent-execution-tracker.ts"

if [ -f "$OPENCODE_TRACKER" ]; then
    test_pass "OpenCode tracker file exists"
    
    # Check for MCP integration
    if grep -q "metabob_record_tool_invocation" "$OPENCODE_TRACKER"; then
        test_pass "OpenCode uses MCP tool for recording"
    else
        test_fail "OpenCode MCP integration not found"
    fi
    
    # Check for file path extraction
    if grep -q "filePath.*file_path.*path.*file" "$OPENCODE_TRACKER"; then
        test_pass "File path extraction logic present"
    else
        test_fail "File path extraction logic not found"
    fi
else
    test_fail "OpenCode tracker file not found"
fi

echo ""

# =============================================================================
# Test 6: Redis Data Structure Inspection
# =============================================================================

test_step "Inspecting Redis for existing agent execution data"

# Check for agent execution keys
REDIS_KEYS=$(docker exec metabob-redis redis-cli --scan --pattern "agent_execution:*" 2>/dev/null | head -10)

if [ -n "$REDIS_KEYS" ]; then
    test_info "Found existing agent execution keys in Redis:"
    echo "$REDIS_KEYS" | while read -r key; do
        if [ -n "$key" ]; then
            echo "  - $key"
        fi
    done
    
    # Try to fetch one and check for code_context
    FIRST_KEY=$(echo "$REDIS_KEYS" | head -1)
    if [ -n "$FIRST_KEY" ]; then
        DATA=$(docker exec metabob-redis redis-cli GET "$FIRST_KEY" 2>/dev/null)
        if echo "$DATA" | grep -q "code_context"; then
            test_pass "code_context field found in Redis data!"
        else
            test_info "No code_context field in existing data (may be old data)"
        fi
    fi
else
    test_info "No agent execution data found in Redis yet (expected for fresh install)"
fi

echo ""

# =============================================================================
# Test Summary
# =============================================================================

echo "======================================================================"
echo "Test Summary"
echo "======================================================================"
echo "Tests Run:    $TESTS_RUN"
echo "Tests Passed: $TESTS_PASSED"
echo "Tests Failed: $TESTS_FAILED"
echo ""

if [ $TESTS_FAILED -eq 0 ]; then
    echo -e "${GREEN}✓ All tests passed!${NC}"
    echo ""
    echo "Next Steps:"
    echo "1. Start a real OpenCode session and use tools (read, edit, etc.)"
    echo "2. Check Redis for enriched data with: docker exec metabob-redis redis-cli --scan --pattern 'agent_execution:*'"
    echo "3. Inspect the data with: docker exec metabob-redis redis-cli GET <key>"
    exit 0
else
    echo -e "${RED}✗ Some tests failed${NC}"
    exit 1
fi
