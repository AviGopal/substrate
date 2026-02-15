#!/bin/bash
# Live Trace Execution - Deterministic Activity Test
#
# This script:
# 1. Generates a unique trace_id (deterministic identifier)
# 2. Registers the trace-test activity template (if not already registered)
# 3. Executes the activity via metabob-cli MCP
# 4. Captures execution logs (MCP calls + backend API calls)
# 5. Validates the trace against expected flow
#
# Usage:
#   ./run_live_trace.sh [--cleanup] [--verbose]

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
TRACE_DIR="$PROJECT_ROOT/.validation-results"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

# Generate unique trace_id
TRACE_ID="trace-${TIMESTAMP}-$$"
TRACE_FILE="$TRACE_DIR/${TRACE_ID}.jsonl"

# Options
CLEANUP=false
VERBOSE=false

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --cleanup)
            CLEANUP=true
            shift
            ;;
        --verbose)
            VERBOSE=true
            shift
            ;;
        *)
            echo "Unknown option: $1"
            echo "Usage: $0 [--cleanup] [--verbose]"
            exit 1
            ;;
    esac
done

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log_info() {
    echo -e "${BLUE}ℹ${NC} $1"
}

log_success() {
    echo -e "${GREEN}✅${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}⚠️${NC} $1"
}

log_error() {
    echo -e "${RED}❌${NC} $1"
}

# Create trace directory
mkdir -p "$TRACE_DIR"

echo "========================================="
echo "Live Trace Execution"
echo "========================================="
log_info "Trace ID: $TRACE_ID"
log_info "Trace File: $TRACE_FILE"
log_info "Timestamp: $TIMESTAMP"
echo

# Step 1: Check backend connectivity
log_info "Step 1: Checking backend connectivity..."
if curl -s -f http://localhost:8080/health > /dev/null 2>&1; then
    log_success "Backend healthy"
else
    log_error "Backend not responding. Start it with: docker-compose up -d"
    exit 1
fi

# Step 2: Register activity template
log_info "Step 2: Registering trace-test activity template..."
if python3 "$SCRIPT_DIR/register-trace-test-activity.py" > "$TRACE_DIR/registration-${TIMESTAMP}.log" 2>&1; then
    log_success "Template registered (or already exists)"
else
    log_warning "Registration output logged to: $TRACE_DIR/registration-${TIMESTAMP}.log"
    if $VERBOSE; then
        cat "$TRACE_DIR/registration-${TIMESTAMP}.log"
    fi
fi

# Step 3: Check metabob-cli MCP server
log_info "Step 3: Checking metabob-cli MCP server..."
if pgrep -f "metabob-cli.*mcp" > /dev/null; then
    log_success "metabob-cli MCP server running"
else
    log_warning "metabob-cli MCP server may not be running"
    log_info "To start: cd repos/metabob-cli && poetry run metabob-cli mcp"
fi

# Step 4: Initialize trace log
log_info "Step 4: Initializing trace log..."
cat > "$TRACE_FILE" <<EOF
{"timestamp":"$(date -Iseconds)","type":"trace_start","data":{"trace_id":"$TRACE_ID","test_type":"deterministic_activity"}}
EOF
log_success "Trace log initialized"

# Step 5: Execute activity via Python script (since we need MCP interaction)
log_info "Step 5: Executing trace-test activity..."
log_info "   Activity: trace-test-deterministic"
log_info "   Variable: trace_id=$TRACE_ID"

# Create execution script
EXEC_SCRIPT="$TRACE_DIR/exec-${TIMESTAMP}.py"
cat > "$EXEC_SCRIPT" <<EOFPYTHON
#!/usr/bin/env python3
"""Execute trace-test activity via metabob-cli MCP."""

import json
import os
import sys
from datetime import datetime
from pathlib import Path

# Add metabob-cli to path
sys.path.insert(0, str(Path(__file__).parent.parent / "repos/metabob-cli/src"))

try:
    from metabob_cli.mcp.activity_manager import ActivityManager
    from metabob_cli.backend import MetabobBackendClient
except ImportError as e:
    print(f"❌ Import failed: {e}", file=sys.stderr)
    print(f"   Make sure metabob-cli is installed", file=sys.stderr)
    sys.exit(1)

# Configuration
TRACE_ID = "$TRACE_ID"
TRACE_FILE = "$TRACE_FILE"
API_URL = os.environ.get("METABOB_API_URL", "http://localhost:8080")
API_KEY = os.environ.get("METABOB_API_KEY", "mb_nH7j21NRXWRaqWyHq4ntSuwiRxARrhFnsR2J7i7vb-E")
PROJECT_ID = os.environ.get("METABOB_PROJECT_ID", "exp-repo-dev")

def log_event(event_type: str, data: dict):
    """Log event to trace file."""
    event = {
        "timestamp": datetime.now().isoformat(),
        "type": event_type,
        "data": data
    }
    with open(TRACE_FILE, "a") as f:
        f.write(json.dumps(event) + "\\n")

def main():
    print(f"Initializing ActivityManager...")
    
    # Create backend client
    backend = MetabobBackendClient(
        api_url=API_URL,
        api_key=API_KEY,
        project_id=PROJECT_ID
    )
    
    # Create activity manager
    manager = ActivityManager(backend)
    
    # Start activity execution
    print(f"Starting activity execution...")
    log_event("mcp_call", {
        "tool": "start_activity_execution",
        "args": {
            "activity_id": "trace-test-deterministic",
            "variables": {"trace_id": TRACE_ID}
        }
    })
    
    try:
        execution_id = manager.start_activity_execution(
            activity_id="trace-test-deterministic",
            variables={"trace_id": TRACE_ID},
            reason="Live trace test execution"
        )
        
        log_event("state_change", {
            "field": "execution_started",
            "execution_id": execution_id,
            "trace_id": TRACE_ID
        })
        
        print(f"✅ Execution started: {execution_id}")
        
        # Note: Full execution loop would require opencode agent context
        # For now, we're testing the start flow
        
        return 0
        
    except Exception as e:
        log_event("error", {
            "phase": "execution",
            "error": str(e)
        })
        print(f"❌ Execution failed: {e}", file=sys.stderr)
        return 1

if __name__ == "__main__":
    sys.exit(main())
EOFPYTHON

chmod +x "$EXEC_SCRIPT"

# Execute
if $VERBOSE; then
    python3 "$EXEC_SCRIPT"
else
    python3 "$EXEC_SCRIPT" > "$TRACE_DIR/execution-${TIMESTAMP}.log" 2>&1
fi

EXEC_STATUS=$?

if [ $EXEC_STATUS -eq 0 ]; then
    log_success "Activity execution completed"
else
    log_error "Activity execution failed (see logs)"
    if ! $VERBOSE; then
        log_info "Execution log: $TRACE_DIR/execution-${TIMESTAMP}.log"
    fi
fi

# Step 6: Finalize trace
cat >> "$TRACE_FILE" <<EOF
{"timestamp":"$(date -Iseconds)","type":"trace_end","data":{"trace_id":"$TRACE_ID","status":"$EXEC_STATUS"}}
EOF

# Step 7: Validate trace
echo
log_info "Step 6: Validating trace..."
if python3 "$SCRIPT_DIR/validate_trace.py" "$TRACE_FILE" --trace-id "$TRACE_ID" $( [ "$CLEANUP" = true ] && echo "--cleanup" ); then
    log_success "Trace validation PASSED"
    VALIDATION_STATUS=0
else
    log_error "Trace validation FAILED"
    VALIDATION_STATUS=1
fi

# Summary
echo
echo "========================================="
echo "Summary"
echo "========================================="
echo "Trace ID: $TRACE_ID"
echo "Trace File: $TRACE_FILE"
echo "Execution Status: $([ $EXEC_STATUS -eq 0 ] && echo "✅ PASS" || echo "❌ FAIL")"
echo "Validation Status: $([ $VALIDATION_STATUS -eq 0 ] && echo "✅ PASS" || echo "❌ FAIL")"
echo

if [ $EXEC_STATUS -eq 0 ] && [ $VALIDATION_STATUS -eq 0 ]; then
    log_success "Live trace test PASSED"
    exit 0
else
    log_error "Live trace test FAILED"
    exit 1
fi
