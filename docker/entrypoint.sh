#!/bin/bash
# =============================================================================
# DevBob Container Entrypoint
# =============================================================================
# Starts three services:
#   1. metabob-cli dashboard (SSE mode) - web dashboard + MCP over HTTP
#   2. opencode ACP server - agent protocol server
#   3. metabob-cli MCP (stdio) - sidecar for opencode (started by opencode)
#
# The stdio MCP sidecar is NOT started here - opencode starts it automatically
# via its mcp.metabob config when it boots.
#
# Environment:
#   ACP_PORT          - opencode ACP port (default: 3000)
#   ACP_HOSTNAME      - ACP bind address (default: 0.0.0.0)
#   DASHBOARD_PORT    - metabob-cli dashboard port (default: 8001)
#   DASHBOARD_HOST    - dashboard bind address (default: 0.0.0.0)
#   METABOB_API_URL   - backend API URL
#   METABOB_PROJECT_ID - project identifier
#   ANTHROPIC_API_KEY  - Anthropic API key (required for LLM)
#   OPENAI_API_KEY     - OpenAI API key (alternative LLM)
# =============================================================================

set -e

# Colors
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; NC='\033[0m'
log_info()  { echo -e "${BLUE}[INFO]${NC}  $1"; }
log_ok()    { echo -e "${GREEN}[OK]${NC}    $1"; }
log_warn()  { echo -e "${YELLOW}[WARN]${NC}  $1"; }
log_err()   { echo -e "${RED}[ERROR]${NC} $1"; }

# Track child PIDs for cleanup
DASHBOARD_PID=""
ACP_PID=""

cleanup() {
    log_info "Shutting down..."
    [ -n "$ACP_PID" ]       && kill "$ACP_PID"       2>/dev/null
    [ -n "$DASHBOARD_PID" ] && kill "$DASHBOARD_PID" 2>/dev/null
    wait 2>/dev/null
    log_info "All services stopped."
}
trap cleanup SIGTERM SIGINT EXIT

# -----------------------------------------------------------------------
# 1. Validate environment
# -----------------------------------------------------------------------
log_info "DevBob container starting"

if [ -z "$ANTHROPIC_API_KEY" ] && [ -z "$OPENAI_API_KEY" ]; then
    log_warn "No LLM API key set (ANTHROPIC_API_KEY or OPENAI_API_KEY)"
    log_warn "Agent sessions will fail without an LLM provider"
fi

# Verify binaries
for bin in opencode metabob-cli git; do
    if ! command -v "$bin" &>/dev/null; then
        log_err "$bin not found in PATH"
        exit 1
    fi
done
log_ok "Binaries verified: opencode, metabob-cli, git"

# -----------------------------------------------------------------------
# 2. Process opencode config with environment variable substitution
# -----------------------------------------------------------------------
# If OPENCODE_CONFIG is set (from docker-compose), use it and substitute env vars
# Otherwise, generate a default config
if [ -n "$OPENCODE_CONFIG" ] && [ -f "$OPENCODE_CONFIG" ]; then
    log_info "Using provided Docker config: $OPENCODE_CONFIG"
    
    # Remove workspace configs that would override Docker config
    # (workspace is mounted and may have host-specific configs)
    if [ -f "/workspace/.opencode/opencode.json" ]; then
        log_info "Backing up workspace config (would override Docker config)"
        mv /workspace/.opencode/opencode.json /workspace/.opencode/opencode.json.host-backup 2>/dev/null || true
    fi
    
    # Check if config has environment variable placeholders
    if grep -q '\${' "$OPENCODE_CONFIG"; then
        log_info "Substituting environment variables in config"
        
        # Create substituted config in /tmp
        SUBSTITUTED_CONFIG="/tmp/opencode-config-$(date +%s).json"
        envsubst < "$OPENCODE_CONFIG" > "$SUBSTITUTED_CONFIG"
        
        # Validate JSON syntax
        if jq empty "$SUBSTITUTED_CONFIG" >/dev/null 2>&1; then
            export OPENCODE_CONFIG="$SUBSTITUTED_CONFIG"
            log_ok "Config processed (env vars substituted)"
        else
            log_warn "Config substitution produced invalid JSON, using original"
            cat "$SUBSTITUTED_CONFIG" | head -20
        fi
    else
        log_ok "Config ready (no substitution needed)"
    fi
else
    # No OPENCODE_CONFIG provided, generate default
    log_info "Generating default opencode config"
    
    OPENCODE_CONFIG_DIR="${OPENCODE_HOME:-/workspace/.opencode}"
    mkdir -p "$OPENCODE_CONFIG_DIR"
    OPENCODE_CONFIG="$OPENCODE_CONFIG_DIR/opencode.json"
    
    cat > "$OPENCODE_CONFIG" <<EOCFG
{
  "share": "disabled",
  "model": "anthropic/claude-sonnet-4-5",
  "metabob": {
    "base_url": "${METABOB_API_URL}",
    "api_key": "",
    "cli_path": "metabob-cli",
    "enable_cli_mcp": true,
    "max_issues": 5,
    "min_severity": "MEDIUM",
    "template_registration": {
      "behavior": "best-effort"
    },
    "template_auto_registration": {
      "behavior": "best-effort",
      "strategy": "on-create"
    },
    "activity_learning": {
      "recommendation_threshold": 0.7
    }
  },
  "provider": {
    "anthropic": {
      "options": {
        "apiKey": "${ANTHROPIC_API_KEY}"
      }
    },
    "openai": {
      "options": {
        "apiKey": "${OPENAI_API_KEY:-}"
      }
    }
  },
  "sessionMemory": {
    "enabled": true,
    "budgets": { "perImpulse": 2000, "total": 10000 },
    "maxImpulsesPerTurn": 5,
    "memoryManagement": {
      "maxCacheTokens": 10000,
      "maxHistoryMessages": 100,
      "autoCompact": true,
      "compactThreshold": 2048,
      "activityStateCleanup": true
    }
  }
}
EOCFG

    export OPENCODE_CONFIG
    log_ok "Default config generated"
fi

# -----------------------------------------------------------------------
# 3. Wait for backend (optional)
# -----------------------------------------------------------------------
if [ "$METABOB_API_URL" != "disabled" ] && [ -n "$METABOB_API_URL" ]; then
    log_info "Checking backend at $METABOB_API_URL ..."
    for i in $(seq 1 10); do
        if curl -sf "$METABOB_API_URL/health" >/dev/null 2>&1; then
            log_ok "Backend reachable"
            break
        fi
        if [ "$i" -eq 10 ]; then
            log_warn "Backend not reachable after 10 attempts, continuing anyway"
        else
            sleep 2
        fi
    done
fi

# -----------------------------------------------------------------------
# 4. Start metabob-cli dashboard (SSE mode)
# -----------------------------------------------------------------------
log_info "Starting metabob-cli dashboard on ${DASHBOARD_HOST}:${DASHBOARD_PORT}"

metabob-cli mcp \
    --transport sse \
    --port "${DASHBOARD_PORT}" \
    --host "${DASHBOARD_HOST}" \
    &
DASHBOARD_PID=$!

# Brief pause for server to bind
sleep 2

if kill -0 "$DASHBOARD_PID" 2>/dev/null; then
    log_ok "Dashboard running (PID $DASHBOARD_PID) at http://${DASHBOARD_HOST}:${DASHBOARD_PORT}"
else
    log_warn "Dashboard process exited early, continuing without dashboard"
    DASHBOARD_PID=""
fi

# -----------------------------------------------------------------------
# 5. Start opencode
# -----------------------------------------------------------------------
CMD="${1:-acp}"
shift 2>/dev/null || true

case "$CMD" in
    acp)
        log_info "Starting opencode ACP on ${ACP_HOSTNAME}:${ACP_PORT}"
        opencode acp --port "$ACP_PORT" --hostname "$ACP_HOSTNAME" "$@" &
        ACP_PID=$!
        log_ok "opencode ACP started (PID $ACP_PID)"
        ;;
    serve)
        log_info "Starting opencode headless server"
        opencode serve --port "$ACP_PORT" "$@" &
        ACP_PID=$!
        ;;
    shell|bash)
        log_info "Starting interactive shell"
        exec bash "$@"
        ;;
    metabob-cli)
        log_info "Running metabob-cli"
        exec metabob-cli "$@"
        ;;
    opencode)
        log_info "Running opencode"
        exec opencode "$@"
        ;;
    *)
        log_info "Running: $CMD $*"
        exec "$CMD" "$@"
        ;;
esac

# -----------------------------------------------------------------------
# 6. Wait for services
# -----------------------------------------------------------------------
log_info "Services running. Waiting..."
log_info "  ACP:       http://${ACP_HOSTNAME}:${ACP_PORT}"
log_info "  Dashboard: http://${DASHBOARD_HOST}:${DASHBOARD_PORT}"

# Wait for either service to exit
wait -n "$ACP_PID" "$DASHBOARD_PID" 2>/dev/null
EXIT_CODE=$?

log_warn "A service exited with code $EXIT_CODE"
exit $EXIT_CODE
