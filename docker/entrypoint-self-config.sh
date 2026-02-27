#!/bin/bash
set -e

# =============================================================================
# DevBob Self-Configuration Entrypoint
# =============================================================================
# This script runs on container startup to:
# 1. Validate environment and connectivity
# 2. Configure vessel for detected environment
# 3. Start OpenCode ACP server or run requested command
# =============================================================================

echo "==================================="
echo "DevBob Container Self-Configuration"
echo "==================================="
echo ""

# Configuration
CONFIG_FILE="${CONFIG_FILE:-/workspace/opencode.json}"
SKIP_CONFIG="${SKIP_CONFIG:-false}"
WAIT_FOR_BACKEND="${WAIT_FOR_BACKEND:-true}"
METABOB_API_URL="${METABOB_API_URL:-}"
ANTHROPIC_API_KEY="${ANTHROPIC_API_KEY:-}"

# Color output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# =============================================================================
# Step 1: Environment Detection
# =============================================================================
log_info "Step 1: Detecting environment..."

HOSTNAME=$(hostname)
CONTAINER_ENV="unknown"

if [[ "$HOSTNAME" =~ dev|development ]]; then
    CONTAINER_ENV="development"
elif [[ "$HOSTNAME" =~ staging|stage ]]; then
    CONTAINER_ENV="staging"
elif [[ "$HOSTNAME" =~ prod|production ]]; then
    CONTAINER_ENV="production"
else
    CONTAINER_ENV="development"  # Default to dev
fi

log_info "  Hostname: $HOSTNAME"
log_info "  Detected Environment: $CONTAINER_ENV"
log_info "  Config File: $CONFIG_FILE"

# =============================================================================
# Step 2: Connectivity Validation
# =============================================================================
if [ "$WAIT_FOR_BACKEND" = "true" ] && [ -n "$METABOB_API_URL" ]; then
    log_info "Step 2: Validating backend connectivity..."
    
    MAX_RETRIES=30
    RETRY_COUNT=0
    BACKEND_READY=false
    
    while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
        # Use Python to check backend health (curl not available in container)
        if python3 <<EOF > /dev/null 2>&1
import urllib.request
try:
    urllib.request.urlopen('$METABOB_API_URL/', timeout=5)
    exit(0)
except:
    exit(1)
EOF
        then
            BACKEND_READY=true
            log_info "  ✓ Backend is reachable at $METABOB_API_URL"
            break
        fi
        
        RETRY_COUNT=$((RETRY_COUNT + 1))
        if [ $RETRY_COUNT -lt $MAX_RETRIES ]; then
            log_warn "  Backend not ready, retrying ($RETRY_COUNT/$MAX_RETRIES)..."
            sleep 2
        fi
    done
    
    if [ "$BACKEND_READY" = "false" ]; then
        log_error "  ✗ Backend not reachable after $MAX_RETRIES attempts"
        log_warn "  Continuing without backend connectivity..."
    fi
else
    log_info "Step 2: Skipping backend connectivity check (WAIT_FOR_BACKEND=$WAIT_FOR_BACKEND)"
fi

# =============================================================================
# Step 3: Validate Required Environment Variables
# =============================================================================
log_info "Step 3: Validating environment variables..."

if [ -z "$ANTHROPIC_API_KEY" ]; then
    log_error "  ✗ ANTHROPIC_API_KEY not set"
    log_error "  Container cannot function without LLM provider credentials"
    exit 1
else
    log_info "  ✓ ANTHROPIC_API_KEY is set"
fi

if [ -n "$METABOB_API_URL" ]; then
    log_info "  ✓ METABOB_API_URL: $METABOB_API_URL"
else
    log_warn "  ⚠ METABOB_API_URL not set (Metabob features disabled)"
fi

# =============================================================================
# Step 4: Self-Configuration (if enabled)
# =============================================================================
if [ "$SKIP_CONFIG" = "false" ]; then
    log_info "Step 4: Running self-configuration..."
    
    # Check if opencode.json exists
    if [ ! -f "$CONFIG_FILE" ]; then
        log_info "  Creating initial config file at $CONFIG_FILE"
        opencode auth setup --non-interactive || true
    fi
    
    # Run configure-vessel-for-environment activity
    log_info "  Executing configure-vessel-for-environment activity..."
    
    # Run unconditionally - pass backend availability as a variable for the activity to handle
    # This ensures self-sufficiency: container can configure itself even without backend
    opencode activity execute configure-vessel-for-environment \
        --variable force_environment="$CONTAINER_ENV" \
        --variable config_path="$CONFIG_FILE" \
        --variable backend_available="${BACKEND_READY:-false}" \
        --reason "Self-configuration on container startup" \
        --non-interactive 2>&1 | tee /tmp/config-activity.log || {
            log_warn "  ⚠ Configuration activity failed, using defaults"
            cat /tmp/config-activity.log
        }
else
    log_info "Step 4: Skipping self-configuration (SKIP_CONFIG=$SKIP_CONFIG)"
fi

# =============================================================================
# Step 5: Display Configuration Summary
# =============================================================================
log_info "Step 5: Configuration Summary"
log_info "  Environment: $CONTAINER_ENV"
log_info "  Backend URL: ${METABOB_API_URL:-not configured}"
log_info "  Config File: $CONFIG_FILE"
log_info "  Working Directory: $(pwd)"

# =============================================================================
# Step 6: Start Requested Service
# =============================================================================
log_info "Step 6: Starting service..."
echo ""
echo "==================================="
echo "DevBob Ready!"
echo "==================================="
echo ""

cd /workspace

# Execute the requested command (defaults to OpenCode serve)
exec opencode "$@"
