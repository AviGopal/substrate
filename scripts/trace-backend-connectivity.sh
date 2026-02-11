#!/bin/bash
# =============================================================================
# Backend Configuration & Connectivity Tracer
# =============================================================================
# Traces logs from all relevant components to verify backend connectivity:
# - Backend API server (api-server-dev)
# - DevBob containers (devbob-opencode, devbob-rpc-api, etc.)
# - metabob-cli operations
# - OpenCode MCP server interactions
#
# Usage:
#   ./scripts/trace-backend-connectivity.sh [duration_seconds]
#
# Example:
#   ./scripts/trace-backend-connectivity.sh 60   # Trace for 60 seconds
#   ./scripts/trace-backend-connectivity.sh      # Trace indefinitely (Ctrl+C to stop)
# =============================================================================

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
MAGENTA='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Configuration
TRACE_DURATION="${1:-0}"  # 0 = indefinite
LOG_DIR="/tmp/devbob-trace-$(date +%Y%m%d-%H%M%S)"
PROJECT_ID="${PROJECT_ID:-exp-repo-dev}"

# Create log directory
mkdir -p "$LOG_DIR"

echo -e "${CYAN}================================================================================================${NC}"
echo -e "${CYAN}Backend Configuration & Connectivity Tracer${NC}"
echo -e "${CYAN}================================================================================================${NC}"
echo -e "${GREEN}Log directory: $LOG_DIR${NC}"
echo -e "${GREEN}Project ID: $PROJECT_ID${NC}"
echo -e "${GREEN}Trace duration: ${TRACE_DURATION}s (0 = indefinite)${NC}"
echo ""

# Function to check if container is running
container_running() {
    docker ps --format '{{.Names}}' | grep -q "^${1}$"
}

# Function to get container status
container_status() {
    if container_running "$1"; then
        echo -e "${GREEN}✓ Running${NC}"
    else
        echo -e "${RED}✗ Not running${NC}"
    fi
}

# =============================================================================
# Pre-flight checks
# =============================================================================
echo -e "${BLUE}Pre-flight Checks${NC}"
echo -e "${BLUE}================================================================================================${NC}"

# Backend API
echo -n "Backend API (api-server-dev): "
container_status "api-server-dev"
if container_running "api-server-dev"; then
    BACKEND_HEALTH=$(curl -s http://localhost:8080/ 2>/dev/null || echo "failed")
    if echo "$BACKEND_HEALTH" | grep -q "ok"; then
        echo -e "  ${GREEN}✓ Health check passed${NC}"
        echo "$BACKEND_HEALTH" | jq '.' 2>/dev/null || echo "$BACKEND_HEALTH"
    else
        echo -e "  ${RED}✗ Health check failed${NC}"
    fi
fi

# DevBob containers
echo ""
echo -n "devbob-opencode: "
container_status "devbob-opencode"

echo -n "devbob-rpc-api: "
container_status "devbob-rpc-api"

echo -n "devbob-cli: "
container_status "devbob-cli"

echo -n "devbob-dashboard: "
container_status "devbob-dashboard"

echo -n "devbob: "
container_status "devbob"

# Configuration files
echo ""
echo -e "${BLUE}Configuration Files${NC}"
echo -e "${BLUE}------------------------------------------------------------------------------------------------${NC}"

# Host OpenCode config
if [ -f ~/.opencode/opencode.json ]; then
    HOST_PROJECT_ID=$(jq -r '.metabob.project_id // "NOT SET"' ~/.opencode/opencode.json)
    HOST_BASE_URL=$(jq -r '.metabob.base_url // "NOT SET"' ~/.opencode/opencode.json)
    echo -e "Host OpenCode config: ${GREEN}✓ Found${NC}"
    echo "  project_id: $HOST_PROJECT_ID"
    echo "  base_url: $HOST_BASE_URL"
else
    echo -e "Host OpenCode config: ${RED}✗ Not found${NC}"
fi

# Container OpenCode config
if [ -f configs/opencode.devbob.json ]; then
    CONTAINER_PROJECT_ID=$(jq -r '.metabob.project_id // "NOT SET"' configs/opencode.devbob.json)
    CONTAINER_BASE_URL=$(jq -r '.metabob.base_url // "NOT SET"' configs/opencode.devbob.json)
    CONTAINER_MCP_ENV=$(jq -r '.mcp.metabob.environment // {}' configs/opencode.devbob.json)
    echo -e "Container OpenCode config: ${GREEN}✓ Found${NC}"
    echo "  project_id: $CONTAINER_PROJECT_ID"
    echo "  base_url: $CONTAINER_BASE_URL"
    echo "  mcp.environment: $CONTAINER_MCP_ENV"
    
    # Check for issues
    if [ "$CONTAINER_PROJECT_ID" == "NOT SET" ]; then
        echo -e "  ${RED}⚠️  WARNING: project_id not set in container config!${NC}"
    fi
    if [ "$CONTAINER_MCP_ENV" == "{}" ]; then
        echo -e "  ${YELLOW}⚠️  WARNING: MCP environment is empty${NC}"
    fi
else
    echo -e "Container OpenCode config: ${RED}✗ Not found${NC}"
fi

# Project ID consistency check
echo ""
if [ "$HOST_PROJECT_ID" != "NOT SET" ] && [ "$CONTAINER_PROJECT_ID" != "NOT SET" ]; then
    if [ "$HOST_PROJECT_ID" == "$CONTAINER_PROJECT_ID" ]; then
        echo -e "${GREEN}✓ Project IDs match: $HOST_PROJECT_ID${NC}"
    else
        echo -e "${RED}✗ Project ID mismatch!${NC}"
        echo "  Host: $HOST_PROJECT_ID"
        echo "  Container: $CONTAINER_PROJECT_ID"
    fi
fi

echo ""
echo -e "${CYAN}================================================================================================${NC}"
echo -e "${CYAN}Starting Log Trace...${NC}"
echo -e "${CYAN}================================================================================================${NC}"
echo ""
echo "Logs will be saved to: $LOG_DIR"
echo ""
echo "Filters applied:"
echo "  - Backend API: project_id, authentication, errors, warnings"
echo "  - DevBob containers: metabob-cli, MCP, OpenCode, backend connectivity"
echo "  - Focus: $PROJECT_ID"
echo ""
echo -e "${YELLOW}Press Ctrl+C to stop tracing${NC}"
echo ""

# =============================================================================
# Start log tracing
# =============================================================================

# Function to trace container logs
trace_container() {
    local container=$1
    local label=$2
    local color=$3
    local output_file="$LOG_DIR/${container}.log"
    
    if ! container_running "$container"; then
        echo -e "${RED}Skipping $label - container not running${NC}"
        return
    fi
    
    echo -e "${color}Starting trace: $label${NC}"
    
    # Tail logs with filters
    docker logs -f --tail=100 "$container" 2>&1 | while IFS= read -r line; do
        # Apply filters
        if echo "$line" | grep -iE "metabob|project.*id|authentication|error|warning|failed|mcp|opencode|backend|api.*url|$PROJECT_ID"; then
            echo "$(date '+%Y-%m-%d %H:%M:%S') [$label] $line" | tee -a "$output_file"
        fi
    done &
    
    echo $! >> "$LOG_DIR/pids.txt"
}

# Start tracing all containers
trace_container "api-server-dev" "BACKEND-API" "$GREEN"
trace_container "devbob-opencode" "DEVBOB-OPENCODE" "$BLUE"
trace_container "devbob-rpc-api" "DEVBOB-RPC-API" "$MAGENTA"
trace_container "devbob-cli" "DEVBOB-CLI" "$CYAN"
trace_container "devbob-dashboard" "DEVBOB-DASHBOARD" "$YELLOW"
trace_container "devbob" "DEVBOB-MAIN" "$GREEN"

# If duration specified, wait and then stop
if [ "$TRACE_DURATION" -gt 0 ]; then
    echo ""
    echo -e "${YELLOW}Tracing for ${TRACE_DURATION} seconds...${NC}"
    sleep "$TRACE_DURATION"
    
    echo ""
    echo -e "${CYAN}Stopping trace...${NC}"
    
    # Kill all background processes
    if [ -f "$LOG_DIR/pids.txt" ]; then
        while read -r pid; do
            kill "$pid" 2>/dev/null || true
        done < "$LOG_DIR/pids.txt"
    fi
    
    echo -e "${GREEN}Trace complete!${NC}"
    echo ""
else
    # Wait for Ctrl+C
    wait
fi

# =============================================================================
# Generate summary report
# =============================================================================
echo ""
echo -e "${CYAN}================================================================================================${NC}"
echo -e "${CYAN}Trace Summary${NC}"
echo -e "${CYAN}================================================================================================${NC}"

# Count relevant log entries
for logfile in "$LOG_DIR"/*.log; do
    if [ -f "$logfile" ]; then
        container_name=$(basename "$logfile" .log)
        error_count=$(grep -ic "error" "$logfile" 2>/dev/null || echo 0)
        warning_count=$(grep -ic "warning" "$logfile" 2>/dev/null || echo 0)
        metabob_count=$(grep -ic "metabob" "$logfile" 2>/dev/null || echo 0)
        project_count=$(grep -ic "$PROJECT_ID" "$logfile" 2>/dev/null || echo 0)
        
        echo ""
        echo -e "${BLUE}$container_name${NC}"
        echo "  Errors: $error_count"
        echo "  Warnings: $warning_count"
        echo "  Metabob mentions: $metabob_count"
        echo "  Project ID mentions: $project_count"
    fi
done

echo ""
echo -e "${GREEN}Full logs saved to: $LOG_DIR${NC}"
echo ""
echo "To review specific logs:"
echo "  cat $LOG_DIR/api-server-dev.log"
echo "  cat $LOG_DIR/devbob-opencode.log"
echo ""
echo "To search for specific patterns:"
echo "  grep -i 'project.*id' $LOG_DIR/*.log"
echo "  grep -i 'authentication' $LOG_DIR/*.log"
echo "  grep -i 'error' $LOG_DIR/*.log"
echo ""
