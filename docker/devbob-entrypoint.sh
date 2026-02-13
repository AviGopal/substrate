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
# Configure metabob-cli
# =============================================================================

echo "Configuring metabob-cli..."

# Create config if not exists
if [ ! -f "/workspace/.metabob/config.json" ]; then
    cat > /workspace/.metabob/config.json <<EOF
{
  "base_url": "${METABOB_API_URL:-http://api-server-stable:8080}",
  "api_key": "${METABOB_API_KEY:-}",
  "project_id": "${METABOB_PROJECT_ID:-devbob-test}"
}
EOF
    echo "Created .metabob/config.json"
fi

# =============================================================================
# Configure OpenCode
# =============================================================================

echo "Configuring OpenCode..."

# Create OpenCode config
if [ ! -f "/workspace/.opencode/opencode.json" ]; then
    cat > /workspace/.opencode/opencode.json <<EOF
{
  "model": "anthropic/claude-sonnet-4-20250514",
  "mcp": {
    "metabob": {
      "command": "/opt/metabob-cli/bin/python",
      "args": ["-m", "metabob_cli.mcp.server"],
      "env": {
        "METABOB_CONFIG": "/workspace/.metabob/config.json"
      }
    }
  }
}
EOF
    echo "Created .opencode/opencode.json"
fi

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

echo "========================================"
echo "Starting OpenCode in ACP mode"
echo "Port: ${ACP_PORT:-3000}"
echo "========================================"

# Execute OpenCode with provided arguments
exec "$@"
