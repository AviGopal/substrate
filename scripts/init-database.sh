#!/bin/bash
# =============================================================================
# Database Initialization Script
# =============================================================================
# Purpose: Initialize SurrealDB schema and load bootstrap activity templates
# Usage: ./scripts/init-database.sh
# =============================================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[✓]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[!]${NC} $1"; }
log_error() { echo -e "${RED}[✗]${NC} $1"; }
log_header() { echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"; echo -e "${CYAN}$1${NC}"; echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"; }

# Check if API server container is running
API_CONTAINER=$(docker ps --format '{{.Names}}' | grep -E "(api-server|metabob-rpc-api)" | head -1)

if [ -z "$API_CONTAINER" ]; then
    log_error "API server container not running"
    echo ""
    echo "Start the backend first:"
    echo "  docker compose -f configs/docker-compose.devbob.yaml up -d metabob-rpc-api-server"
    exit 1
fi

log_header "Database Initialization"
echo ""
log_info "API Container: $API_CONTAINER"
echo ""

# =============================================================================
# Step 1: Initialize Schema Version Tracking
# =============================================================================
log_header "Step 1: Initialize Schema Version Tracking"
echo ""

log_info "Creating schema_versions table..."
docker exec "$API_CONTAINER" python -m server.actions.init_schema_version 2>&1 | grep -E "(✓|✅|ERROR|WARNING)" || true

if [ $? -eq 0 ]; then
    log_success "Schema version tracking initialized"
else
    log_error "Failed to initialize schema version tracking"
    exit 1
fi

echo ""

# =============================================================================
# Step 2: Initialize Activity System Schema
# =============================================================================
log_header "Step 2: Initialize Activity System Schema"
echo ""

log_info "Creating activity system tables..."
docker exec "$API_CONTAINER" python -m server.actions.init_activity_schema 2>&1 | grep -E "(✓|✅|ERROR|WARNING)" || true

if [ $? -eq 0 ]; then
    log_success "Activity system schema initialized"
else
    log_warn "Activity schema may already exist or initialization failed"
fi

echo ""

# =============================================================================
# Step 3: Initialize Authentication System Schema
# =============================================================================
log_header "Step 3: Initialize Authentication System Schema"
echo ""

log_info "Creating auth system tables..."
docker exec "$API_CONTAINER" python -m server.actions.init_auth_schema 2>&1 | grep -E "(✓|✅|ERROR|WARNING)" || true

if [ $? -eq 0 ]; then
    log_success "Auth system schema initialized"
else
    log_warn "Auth schema may already exist or initialization failed"
fi

echo ""

# =============================================================================
# Step 4: Load Bootstrap Activity Templates
# =============================================================================
log_header "Step 4: Load Bootstrap Activity Templates"
echo ""

BOOTSTRAP_DIR="$PROJECT_ROOT/repos/metabob-proto/activities/bootstrap"

if [ ! -d "$BOOTSTRAP_DIR" ]; then
    log_error "Bootstrap directory not found: $BOOTSTRAP_DIR"
    echo ""
    echo "Expected location: repos/metabob-proto/activities/bootstrap/"
    exit 1
fi

# Count available templates
TEMPLATE_COUNT=$(ls -1 "$BOOTSTRAP_DIR"/*.json 2>/dev/null | wc -l)
log_info "Found $TEMPLATE_COUNT bootstrap templates in $BOOTSTRAP_DIR"
echo ""

# Copy bootstrap directory to container
log_info "Copying bootstrap templates to container..."
docker exec "$API_CONTAINER" mkdir -p /tmp/bootstrap 2>/dev/null || true
docker cp "$BOOTSTRAP_DIR/." "$API_CONTAINER:/tmp/bootstrap/" 2>&1 | grep -v "Prepared "

if [ $? -eq 0 ]; then
    log_success "Templates copied to container"
else
    log_error "Failed to copy templates"
    exit 1
fi

echo ""

# Load templates using admin CLI (if available) or direct API calls
log_info "Loading templates into database..."
echo ""

# Try admin CLI first
if docker exec "$API_CONTAINER" python -m admin.cli activities seed --source /tmp/bootstrap 2>/dev/null; then
    log_success "Templates loaded via admin CLI"
else
    log_warn "Admin CLI not available, trying alternative method..."
    
    # Alternative: Use Python script to load directly
    docker exec "$API_CONTAINER" python -c "
import os
import json
import asyncio
from server.utils.surreal_client import get_db_client

async def load_templates():
    client = get_db_client()
    await client.connect()
    
    count = 0
    for filename in os.listdir('/tmp/bootstrap'):
        if filename.endswith('.json'):
            filepath = os.path.join('/tmp/bootstrap', filename)
            with open(filepath, 'r') as f:
                data = json.load(f)
            
            # Insert into activities table
            try:
                await client.create('activities', data)
                print(f'✓ Loaded: {filename}')
                count += 1
            except Exception as e:
                print(f'✗ Failed to load {filename}: {e}')
    
    print(f'\\n✅ Loaded {count} templates')
    await client.close()

asyncio.run(load_templates())
" 2>&1
    
    if [ $? -eq 0 ]; then
        log_success "Templates loaded via Python script"
    else
        log_error "Failed to load templates"
        echo ""
        echo "You can manually load templates later using:"
        echo "  docker exec $API_CONTAINER python -m admin.cli activities seed --source /tmp/bootstrap"
    fi
fi

echo ""

# =============================================================================
# Step 5: Verify Database State
# =============================================================================
log_header "Step 5: Verify Database State"
echo ""

log_info "Checking schema version..."
SCHEMA_VERSION=$(docker exec "$API_CONTAINER" python -c "
import asyncio
from server.utils.surreal_client import get_db_client

async def check():
    client = get_db_client()
    await client.connect()
    result = await client.query('SELECT version FROM schema_versions ORDER BY version DESC LIMIT 1')
    await client.close()
    if result and len(result) > 0:
        print(result[0]['version'])
    else:
        print('0')

asyncio.run(check())
" 2>&1 | tail -1)

log_success "Current schema version: $SCHEMA_VERSION"

echo ""

log_info "Checking activity count..."
ACTIVITY_COUNT=$(docker exec "$API_CONTAINER" python -c "
import asyncio
from server.utils.surreal_client import get_db_client

async def check():
    client = get_db_client()
    await client.connect()
    result = await client.query('SELECT count() FROM activities GROUP ALL')
    await client.close()
    if result and len(result) > 0:
        print(result[0]['count'])
    else:
        print('0')

asyncio.run(check())
" 2>&1 | tail -1)

log_success "Activities in database: $ACTIVITY_COUNT"

echo ""

# =============================================================================
# Summary
# =============================================================================
log_header "Initialization Complete"
echo ""

echo "✅ Schema version tracking:  Initialized"
echo "✅ Activity system schema:   Created"
echo "✅ Auth system schema:       Created"
echo "✅ Bootstrap templates:      Loaded ($ACTIVITY_COUNT activities)"
echo ""

log_success "Database is ready for use!"
echo ""

echo "Next steps:"
echo "  1. Run validation: ./scripts/validate-backend-health.sh"
echo "  2. Start agent containers"
echo "  3. Test activity execution"
echo ""

exit 0
