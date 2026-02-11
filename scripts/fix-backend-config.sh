#!/bin/bash
# =============================================================================
# Backend Configuration Fix Script
# =============================================================================
# Applies all necessary fixes to ensure backend is properly shared between
# host machine and DevBob containers
#
# Fixes applied:
#   1. Add project_id to configs/opencode.devbob.json
#   2. Populate MCP environment variables in configs/opencode.devbob.json
#   3. Update docker-compose.yaml METABOB_PROJECT_ID
#   4. Restart containers to pick up changes
#
# Usage:
#   ./scripts/fix-backend-config.sh [--dry-run]
#
# Options:
#   --dry-run    Show what would be changed without applying
# =============================================================================

set -euo pipefail

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# Configuration
PROJECT_ID="${PROJECT_ID:-exp-repo-dev}"
DRY_RUN=false

# Parse arguments
if [ "${1:-}" == "--dry-run" ]; then
    DRY_RUN=true
    echo -e "${YELLOW}Running in DRY-RUN mode - no changes will be applied${NC}"
    echo ""
fi

echo -e "${CYAN}================================================================================================${NC}"
echo -e "${CYAN}Backend Configuration Fix Script${NC}"
echo -e "${CYAN}================================================================================================${NC}"
echo ""
echo -e "${BLUE}Target project_id: $PROJECT_ID${NC}"
echo ""

# Backup function
backup_file() {
    local file=$1
    if [ -f "$file" ] && [ "$DRY_RUN" == "false" ]; then
        cp "$file" "${file}.backup.$(date +%Y%m%d-%H%M%S)"
        echo -e "${GREEN}  ✓ Backed up: ${file}.backup.$(date +%Y%m%d-%H%M%S)${NC}"
    fi
}

# =============================================================================
# Fix 1: Add project_id to configs/opencode.devbob.json
# =============================================================================
echo -e "${BLUE}[Fix 1] Adding project_id to container OpenCode config${NC}"

if [ ! -f configs/opencode.devbob.json ]; then
    echo -e "${RED}  ✗ File not found: configs/opencode.devbob.json${NC}"
    exit 1
fi

CURRENT_PROJECT_ID=$(jq -r '.metabob.project_id // null' configs/opencode.devbob.json)

if [ "$CURRENT_PROJECT_ID" == "$PROJECT_ID" ]; then
    echo -e "${GREEN}  ✓ project_id already set correctly: $PROJECT_ID${NC}"
elif [ "$CURRENT_PROJECT_ID" == "null" ]; then
    echo -e "${YELLOW}  → Adding project_id: $PROJECT_ID${NC}"
    if [ "$DRY_RUN" == "false" ]; then
        backup_file configs/opencode.devbob.json
        jq ".metabob.project_id = \"$PROJECT_ID\"" configs/opencode.devbob.json > configs/opencode.devbob.json.tmp
        mv configs/opencode.devbob.json.tmp configs/opencode.devbob.json
        echo -e "${GREEN}  ✓ Added project_id to configs/opencode.devbob.json${NC}"
    fi
else
    echo -e "${YELLOW}  → Updating project_id: $CURRENT_PROJECT_ID → $PROJECT_ID${NC}"
    if [ "$DRY_RUN" == "false" ]; then
        backup_file configs/opencode.devbob.json
        jq ".metabob.project_id = \"$PROJECT_ID\"" configs/opencode.devbob.json > configs/opencode.devbob.json.tmp
        mv configs/opencode.devbob.json.tmp configs/opencode.devbob.json
        echo -e "${GREEN}  ✓ Updated project_id in configs/opencode.devbob.json${NC}"
    fi
fi
echo ""

# =============================================================================
# Fix 2: Populate MCP environment in configs/opencode.devbob.json
# =============================================================================
echo -e "${BLUE}[Fix 2] Adding MCP environment variables${NC}"

CURRENT_MCP_ENV=$(jq -r '.mcp.metabob.environment // {}' configs/opencode.devbob.json)
CURRENT_API_KEY=$(jq -r '.metabob.api_key // ""' configs/opencode.devbob.json)

if [ "$CURRENT_MCP_ENV" == "{}" ]; then
    echo -e "${YELLOW}  → MCP environment is empty, adding variables${NC}"
    if [ "$DRY_RUN" == "false" ]; then
        jq ".mcp.metabob.environment = {
          \"METABOB_API_URL\": \"http://host.docker.internal:8080\",
          \"METABOB_API_KEY\": \"$CURRENT_API_KEY\"
        }" configs/opencode.devbob.json > configs/opencode.devbob.json.tmp
        mv configs/opencode.devbob.json.tmp configs/opencode.devbob.json
        echo -e "${GREEN}  ✓ Added MCP environment variables${NC}"
        echo "    - METABOB_API_URL: http://host.docker.internal:8080"
        echo "    - METABOB_API_KEY: [set from metabob.api_key]"
    fi
else
    MCP_URL=$(jq -r '.mcp.metabob.environment.METABOB_API_URL // null' configs/opencode.devbob.json)
    MCP_KEY=$(jq -r '.mcp.metabob.environment.METABOB_API_KEY // null' configs/opencode.devbob.json)
    
    if [ "$MCP_URL" == "http://host.docker.internal:8080" ] && [ "$MCP_KEY" != "null" ]; then
        echo -e "${GREEN}  ✓ MCP environment already configured correctly${NC}"
    else
        echo -e "${YELLOW}  → Updating MCP environment variables${NC}"
        if [ "$DRY_RUN" == "false" ]; then
            jq ".mcp.metabob.environment.METABOB_API_URL = \"http://host.docker.internal:8080\" | 
                .mcp.metabob.environment.METABOB_API_KEY = \"$CURRENT_API_KEY\"" \
                configs/opencode.devbob.json > configs/opencode.devbob.json.tmp
            mv configs/opencode.devbob.json.tmp configs/opencode.devbob.json
            echo -e "${GREEN}  ✓ Updated MCP environment variables${NC}"
        fi
    fi
fi
echo ""

# =============================================================================
# Fix 3: Update docker-compose.yaml METABOB_PROJECT_ID
# =============================================================================
echo -e "${BLUE}[Fix 3] Updating docker-compose.yaml METABOB_PROJECT_ID${NC}"

if [ ! -f docker-compose.yaml ]; then
    echo -e "${RED}  ✗ File not found: docker-compose.yaml${NC}"
    echo -e "${YELLOW}  → This is OK if you're using a different compose file${NC}"
else
    CURRENT_COMPOSE_ID=$(grep "METABOB_PROJECT_ID:" docker-compose.yaml | head -1 | sed 's/.*METABOB_PROJECT_ID: *//; s/ *$//' || echo "")
    
    if echo "$CURRENT_COMPOSE_ID" | grep -q "$PROJECT_ID"; then
        echo -e "${GREEN}  ✓ docker-compose.yaml already has correct project_id${NC}"
    else
        echo -e "${YELLOW}  → Updating METABOB_PROJECT_ID: $CURRENT_COMPOSE_ID → $PROJECT_ID${NC}"
        if [ "$DRY_RUN" == "false" ]; then
            backup_file docker-compose.yaml
            # Replace all occurrences
            sed -i "s/METABOB_PROJECT_ID: devbob-multi-agent/METABOB_PROJECT_ID: $PROJECT_ID/g" docker-compose.yaml
            sed -i "s/METABOB_PROJECT_ID:-devbob-multi-agent/METABOB_PROJECT_ID:-$PROJECT_ID/g" docker-compose.yaml
            echo -e "${GREEN}  ✓ Updated docker-compose.yaml${NC}"
        fi
    fi
fi
echo ""

# =============================================================================
# Fix 4: Restart containers (if running)
# =============================================================================
echo -e "${BLUE}[Fix 4] Restarting containers to apply changes${NC}"

if [ "$DRY_RUN" == "true" ]; then
    echo -e "${YELLOW}  → Would restart DevBob containers (skipped in dry-run)${NC}"
else
    # Check which containers are running
    RUNNING_CONTAINERS=$(docker ps --format '{{.Names}}' | grep -E '^devbob' || true)
    
    if [ -z "$RUNNING_CONTAINERS" ]; then
        echo -e "${YELLOW}  → No DevBob containers running - changes will apply on next start${NC}"
    else
        echo -e "${YELLOW}  → Restarting running containers...${NC}"
        for container in $RUNNING_CONTAINERS; do
            echo "    - Restarting $container"
            docker restart "$container" > /dev/null 2>&1 || echo "      (failed to restart $container)"
        done
        echo -e "${GREEN}  ✓ Containers restarted${NC}"
        echo ""
        echo -e "${YELLOW}  → Waiting 10 seconds for containers to stabilize...${NC}"
        sleep 10
    fi
fi
echo ""

# =============================================================================
# Summary
# =============================================================================
echo -e "${CYAN}================================================================================================${NC}"
echo -e "${CYAN}Summary${NC}"
echo -e "${CYAN}================================================================================================${NC}"
echo ""

if [ "$DRY_RUN" == "true" ]; then
    echo -e "${YELLOW}DRY-RUN complete - no changes were applied${NC}"
    echo ""
    echo "To apply these changes, run:"
    echo "  bash scripts/fix-backend-config.sh"
else
    echo -e "${GREEN}✅ Configuration fixes applied successfully!${NC}"
    echo ""
    echo "Changes made:"
    echo "  1. Added/updated project_id in configs/opencode.devbob.json"
    echo "  2. Populated MCP environment variables"
    echo "  3. Updated docker-compose.yaml METABOB_PROJECT_ID"
    echo "  4. Restarted running containers"
    echo ""
    echo "Backup files created with .backup.[timestamp] extension"
fi

echo ""
echo "Next steps:"
echo "  1. Verify configuration:"
echo "     bash scripts/verify-backend-config.sh"
echo ""
echo "  2. Test backend connectivity:"
echo "     bash scripts/trace-backend-connectivity.sh 30"
echo ""
echo "  3. Test metabob-cli:"
echo "     metabob-cli --version"
echo "     docker exec devbob-opencode metabob-cli --version"
echo ""
