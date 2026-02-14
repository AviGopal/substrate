#!/bin/bash
# =============================================================================
# Devbob Container Entrypoint
# =============================================================================
#
# Initializes the devbob container environment:
#   1. Sets up metabob-cli MCP server
#   2. Configures OpenCode to use metabob-cli
#   3. Waits for backend health
#   4. Starts OpenCode in ACP mode
#
# Environment Variables:
#   CODEBASE_NAME: Identifier for this codebase (rpc-api, cli, opencode, etc)
#   REPO_URL: Git repository to clone (empty for mounted repos)
#   REPO_CHECKOUT_MODE: How to handle repo (skip, shallow, full)
#   METABOB_API_URL: Backend API endpoint
#   METABOB_API_KEY: Authentication key
#   ANTHROPIC_API_KEY: LLM provider key
#   WAIT_FOR_BACKEND: Wait for backend health before starting
#   ACP_PORT: Port for OpenCode ACP server
#
# =============================================================================

set -e

echo "========================================"
echo "Devbob Container Starting"
echo "========================================"
echo "Codebase: ${CODEBASE_NAME:-unknown}"
echo "Workspace: /workspace"
echo "ACP Port: ${ACP_PORT:-3000}"
echo "========================================"

# Create necessary directories
mkdir -p /workspace/.metabob
mkdir -p /workspace/.opencode
mkdir -p /config

# =============================================================================
# Setup metabob-cli
# =============================================================================

echo "Setting up metabob-cli..."

# Check if metabob-cli is mounted (devbob-dev profile)
if [ -d "/workspace/src/metabob_cli" ]; then
    echo "Found mounted metabob-cli repo, installing in development mode"
    cd /workspace
    /opt/metabob-cli/bin/pip install -e . --quiet
elif [ -f "/workspace/pyproject.toml" ] && grep -q "metabob-cli" /workspace/pyproject.toml; then
    echo "Found metabob-cli in mounted workspace, installing"
    cd /workspace
    /opt/metabob-cli/bin/pip install -e . --quiet
else
    echo "Using stable metabob-cli from pip"
    /opt/metabob-cli/bin/pip install metabob-cli --quiet || echo "metabob-cli not available from pip"
fi

# =============================================================================
# Configure metabob-cli (ALWAYS - container-isolated)
# =============================================================================

echo "Configuring metabob-cli..."

# Always create config to ensure container isolation
# This prevents conflicts with host machine configuration
cat > /workspace/.metabob/config.json <<EOF
{
  "base_url": "${METABOB_API_URL:-http://api-server-dev:8080}",
  "api_key": "${METABOB_API_KEY:-}",
  "project_id": "${METABOB_PROJECT_ID:-devbob-test}"
}
EOF
echo "Created container-isolated metabob config"

# Create empty state file (will be populated by metabob-cli on first use)
# This ensures each container has its own session state
cat > /workspace/.metabob/state <<EOF
{
  "session_metadata": {
    "session_id": "",
    "session_token": "",
    "created_at": "",
    "expires_at": "",
    "last_refreshed": ""
  }
}
EOF
echo "Created empty state file for container"

# =============================================================================
# Configure OpenCode (ALWAYS - container-isolated with MCP)
# =============================================================================

echo "Configuring OpenCode..."

# Always create/overwrite config to ensure:
# 1. Container isolation (separate from host config)
# 2. MCP server configured correctly
# 3. Shared backend URL
cat > /workspace/.opencode/opencode.json <<EOF
{
  "share": "disabled",
  "model": "anthropic/claude-sonnet-4-5",
  "mcp": {
    "metabob": {
      "type": "local",
      "command": [
        "/opt/metabob-cli/.venv/bin/python",
        "-m",
        "metabob_cli.mcp.server"
      ],
      "enabled": true,
      "environment": {
        "METABOB_CONFIG": "/workspace/.metabob/config.json"
      }
    }
  },
  "metabob": {
    "cli_path": "metabob-cli",
    "api_key": "${METABOB_API_KEY:-}",
    "base_url": "${METABOB_API_URL:-http://api-server-dev:8080}",
    "state_directory": ".metabob",
    "max_issues": 5,
    "min_severity": "MEDIUM",
    "cache_timeout": 300,
    "context_budget_tokens": 10000,
    "subagent_token_budget": 5000
  },
  "sessionMemory": {
    "enabled": true,
    "budgets": {
      "perImpulse": 2000,
      "total": 10000
    },
    "maxImpulsesPerTurn": 5
  }
}
EOF
echo "Created container-isolated OpenCode config with MCP"

# Ensure .opencode directory is owned by the user running OpenCode
chown -R root:root /workspace/.opencode 2>/dev/null || true

# =============================================================================
# Wait for backend health
# =============================================================================

if [ "${WAIT_FOR_BACKEND:-true}" = "true" ]; then
    echo "Waiting for backend at ${METABOB_API_URL:-http://api-server-stable:8080}..."
    
    MAX_RETRIES=30
    RETRY_COUNT=0
    BACKEND_URL="${METABOB_API_URL:-http://api-server-stable:8080}/health"
    
    while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
        if curl -sf "$BACKEND_URL" > /dev/null 2>&1; then
            echo "Backend is healthy!"
            break
        fi
        
        RETRY_COUNT=$((RETRY_COUNT + 1))
        echo "Waiting for backend... ($RETRY_COUNT/$MAX_RETRIES)"
        sleep 2
    done
    
    if [ $RETRY_COUNT -eq $MAX_RETRIES ]; then
        echo "WARNING: Backend not available after ${MAX_RETRIES} attempts"
        echo "Continuing anyway..."
    fi
fi

# =============================================================================
# Setup workspace
# =============================================================================

cd /workspace

# If REPO_URL is set and REPO_CHECKOUT_MODE is not skip, clone repo
if [ -n "${REPO_URL}" ] && [ "${REPO_CHECKOUT_MODE:-skip}" != "skip" ]; then
    echo "Cloning repository: ${REPO_URL}"
    
    if [ "${REPO_CHECKOUT_MODE}" = "shallow" ]; then
        git clone --depth ${REPO_DEPTH:-1} --branch ${REPO_BRANCH:-main} "${REPO_URL}" /workspace/repo
    else
        git clone --branch ${REPO_BRANCH:-main} "${REPO_URL}" /workspace/repo
    fi
    
    cd /workspace/repo
fi

# =============================================================================
# Start OpenCode
# =============================================================================

# OpenCode looks for config in $HOME/.config/opencode by default
# Copy workspace config to that location so OpenCode finds it
mkdir -p /root/.config/opencode
cp /workspace/.opencode/opencode.json /root/.config/opencode/opencode.json
echo "Config copied to /root/.config/opencode/"

echo "========================================"
echo "Starting OpenCode in ACP mode"
echo "Port: ${ACP_PORT:-3000}"
echo "========================================"

# Execute OpenCode with provided arguments
exec "$@"
