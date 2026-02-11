#!/bin/bash
# =============================================================================
# Devbob Container Entrypoint
# =============================================================================
# Starts metabob-opencode agent IDE which automatically starts metabob-cli
# as an MCP server for code analysis and activity sync.
#
# OpenCode's built-in metabob integration handles:
#   - Starting metabob-cli MCP server (via stdio transport)
#   - Code analysis and problem detection
#   - Activity tracking and sync with backend
#   - Context injection for AI agents
#
# Environment Variables:
#   CODEBASE_NAME       - Name of the codebase being managed
#   ACP_PORT            - Port for OpenCode ACP server
#   METABOB_API_URL     - Backend API URL for activity sync
#   METABOB_PROJECT_ID  - Project ID for multi-agent collaboration
#   METABOB_API_KEY     - API key for backend authentication
# =============================================================================

set -e

# =============================================================================
# Critical: Disable default auth plugins EARLY (before any opencode calls)
# This prevents loading opencode-anthropic-auth which requires missing deps
# =============================================================================
export OPENCODE_DISABLE_DEFAULT_PLUGINS=1

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# Default values
WORKSPACE_DIR="${WORKSPACE_DIR:-/workspace}"
CODEBASE_NAME="${CODEBASE_NAME:-default}"
ACP_PORT="${ACP_PORT:-3000}"
ACP_HOSTNAME="${ACP_HOSTNAME:-0.0.0.0}"
METABOB_API_URL="${METABOB_API_URL:-http://api-server-dev:8080}"
METABOB_PROJECT_ID="${METABOB_PROJECT_ID:-devbob-default}"

# Git repository configuration
REPO_URL="${REPO_URL:-}"
REPO_BRANCH="${REPO_BRANCH:-main}"
REPO_DEPTH="${REPO_DEPTH:-1}"
REPO_CHECKOUT_MODE="${REPO_CHECKOUT_MODE:-shallow}"  # shallow, full, or skip
GIT_AUTO_PUSH="${GIT_AUTO_PUSH:-false}"  # Auto-push commits to remote
GIT_PUSH_ON_EXIT="${GIT_PUSH_ON_EXIT:-false}"  # Push on container exit

# =============================================================================
# Print banner
# =============================================================================
print_banner() {
    echo ""
    echo "=============================================="
    echo "  Devbob Agent Container"
    echo "  Codebase: ${CODEBASE_NAME}"
    echo "  Project:  ${METABOB_PROJECT_ID}"
    if [ -n "${REPO_URL}" ]; then
        echo "  Repository: ${REPO_URL}"
        echo "  Branch: ${REPO_BRANCH}"
        echo "  Mode: ${REPO_CHECKOUT_MODE}"
    fi
    echo "=============================================="
    echo ""
}

# =============================================================================
# Validate environment
# =============================================================================
validate_environment() {
    log_info "Validating environment..."
    
    local has_error=0
    
    # Check for API keys
    if [ -z "${ANTHROPIC_API_KEY}" ] && [ -z "${OPENAI_API_KEY}" ]; then
        log_error "No LLM API keys configured"
        log_error "Set ANTHROPIC_API_KEY or OPENAI_API_KEY in .env.devbob"
        has_error=1
    elif [ -n "${ANTHROPIC_API_KEY}" ]; then
        log_success "Anthropic API key configured"
    elif [ -n "${OPENAI_API_KEY}" ]; then
        log_success "OpenAI API key configured"
    fi
    
    # Check workspace directory
    if [ ! -d "${WORKSPACE_DIR}" ]; then
        log_error "Workspace directory does not exist: ${WORKSPACE_DIR}"
        has_error=1
    else
        log_success "Workspace directory exists: ${WORKSPACE_DIR}"
    fi
    
    # Check for repository configuration consistency
    if [ -n "${REPO_URL}" ] && [ "${REPO_CHECKOUT_MODE}" != "skip" ]; then
        if [ -z "${REPO_BRANCH}" ]; then
            log_warn "REPO_URL set but REPO_BRANCH not specified, using default: main"
            REPO_BRANCH="main"
        fi
        log_success "Repository configuration valid"
    fi
    
    # Handle metabob backend URL
    if [ -z "${METABOB_API_URL}" ] || [ "${METABOB_API_URL}" = "disabled" ]; then
        log_info "METABOB_API_URL not set or disabled, Metabob integration will be disabled"
        METABOB_API_URL="disabled"
    fi
    
    if [ $has_error -eq 1 ]; then
        log_error "Environment validation failed"
        return 1
    fi
    
    log_success "Environment validation complete"
    return 0
}

# =============================================================================
# Verify tools
# =============================================================================
verify_tools() {
    log_info "Verifying installed tools..."
    
    # Check metabob-cli
    if metabob-cli --help > /dev/null 2>&1; then
        log_success "metabob-cli: available"
    else
        log_error "metabob-cli: not found in PATH"
        log_info "Trying direct Python execution..."
        if /opt/metabob-cli/.venv/bin/python -m metabob_cli --help > /dev/null 2>&1; then
            log_success "metabob-cli: available via direct Python"
        else
            log_error "metabob-cli: not working"
            return 1
        fi
    fi
    
    # Check opencode
    if opencode --version > /dev/null 2>&1; then
        OPENCODE_VERSION=$(opencode --version 2>&1 | head -1)
        log_success "opencode: ${OPENCODE_VERSION}"
    else
        log_error "opencode: not available"
        return 1
    fi
    
    log_success "Tool verification complete"
}

# =============================================================================
# Clone or update repository
# =============================================================================
setup_repository() {
    log_info "Setting up repository..."
    
    # If REPO_URL is not set, skip git operations (use existing workspace)
    if [ -z "${REPO_URL}" ]; then
        log_info "REPO_URL not set, using existing workspace content"
        return 0
    fi
    
    # If REPO_CHECKOUT_MODE is skip, don't do any git operations
    if [ "${REPO_CHECKOUT_MODE}" = "skip" ]; then
        log_info "REPO_CHECKOUT_MODE=skip, skipping git operations"
        return 0
    fi
    
    # Validate REPO_URL format
    if [[ ! "${REPO_URL}" =~ ^(https?://|git@) ]]; then
        log_error "Invalid REPO_URL format: ${REPO_URL}"
        log_error "Expected format: https://github.com/org/repo.git or git@github.com:org/repo.git"
        return 1
    fi
    
    cd /tmp
    
    # Check if workspace already has a git repo
    if [ -d "${WORKSPACE_DIR}/.git" ]; then
        log_info "Git repository exists, checking remote..."
        cd "${WORKSPACE_DIR}"
        
        # Check if it's the correct remote
        local current_remote=$(git remote get-url origin 2>/dev/null || echo "")
        if [ "${current_remote}" != "${REPO_URL}" ]; then
            log_warn "Remote URL mismatch."
            log_warn "  Expected: ${REPO_URL}"
            log_warn "  Current:  ${current_remote}"
            log_info "Removing existing repo and cloning fresh..."
            cd /tmp
            
            # Safety check: ensure we're not deleting critical directories
            if [ "${WORKSPACE_DIR}" = "/" ] || [ "${WORKSPACE_DIR}" = "/root" ]; then
                log_error "Refusing to delete critical directory: ${WORKSPACE_DIR}"
                return 1
            fi
            
            rm -rf "${WORKSPACE_DIR}"
            mkdir -p "${WORKSPACE_DIR}"
        else
            # Pull latest changes
            log_info "Pulling latest changes from ${REPO_BRANCH}..."
            
            # Check network connectivity first
            if ! git ls-remote --exit-code "${REPO_URL}" HEAD > /dev/null 2>&1; then
                log_warn "Cannot reach remote repository, continuing with existing code"
                return 0
            fi
            
            # Fetch with timeout
            if timeout 60 git fetch origin "${REPO_BRANCH}" 2>&1; then
                log_success "Fetched latest changes"
            else
                log_warn "Failed to fetch (timeout or error), continuing with existing code"
                return 0
            fi
            
            # Checkout branch
            if git checkout "${REPO_BRANCH}" 2>/dev/null; then
                log_success "Checked out ${REPO_BRANCH}"
            else
                log_warn "Failed to checkout ${REPO_BRANCH}, staying on current branch"
            fi
            
            # Pull with merge strategy
            if git pull origin "${REPO_BRANCH}" --ff-only 2>/dev/null; then
                log_success "Repository updated successfully"
            else
                log_warn "Failed to fast-forward, continuing with existing code"
                log_info "Run 'git status' to see local changes"
            fi
            
            return 0
        fi
    fi
    
    # Clone the repository
    log_info "Cloning repository: ${REPO_URL}"
    log_info "  Branch: ${REPO_BRANCH}"
    log_info "  Mode: ${REPO_CHECKOUT_MODE}"
    log_info "  Depth: ${REPO_DEPTH}"
    
    # Test network connectivity before cloning
    log_info "Testing connectivity to repository..."
    if ! timeout 30 git ls-remote --exit-code "${REPO_URL}" HEAD > /dev/null 2>&1; then
        log_error "Cannot reach repository: ${REPO_URL}"
        log_error "Check network connectivity and repository URL"
        return 1
    fi
    log_success "Repository is reachable"
    
    mkdir -p "${WORKSPACE_DIR}"
    
    case "${REPO_CHECKOUT_MODE}" in
        shallow)
            log_info "Performing shallow clone (depth=${REPO_DEPTH})..."
            if ! timeout 300 git clone --depth "${REPO_DEPTH}" --branch "${REPO_BRANCH}" --single-branch \
                "${REPO_URL}" "${WORKSPACE_DIR}" 2>&1; then
                log_error "Failed to clone repository (shallow mode)"
                log_info "Try setting REPO_CHECKOUT_MODE=full or check repository access"
                return 1
            fi
            ;;
        full)
            log_info "Performing full clone..."
            if ! timeout 600 git clone --branch "${REPO_BRANCH}" "${REPO_URL}" "${WORKSPACE_DIR}" 2>&1; then
                log_error "Failed to clone repository (full mode)"
                return 1
            fi
            ;;
        *)
            log_error "Unknown REPO_CHECKOUT_MODE: ${REPO_CHECKOUT_MODE}"
            log_error "Valid options: shallow, full, skip"
            return 1
            ;;
    esac
    
    cd "${WORKSPACE_DIR}"
    
    # Verify clone succeeded
    if [ ! -d ".git" ]; then
        log_error "Repository clone completed but .git directory not found"
        return 1
    fi
    
    # Show clone info
    local commit_hash=$(git rev-parse --short HEAD 2>/dev/null || echo "unknown")
    local commit_date=$(git log -1 --format=%cd --date=short 2>/dev/null || echo "unknown")
    log_success "Repository cloned successfully"
    log_info "  Commit: ${commit_hash}"
    log_info "  Date:   ${commit_date}"
}

# =============================================================================
# Initialize workspace
# =============================================================================
init_workspace() {
    log_info "Initializing workspace at ${WORKSPACE_DIR}"
    
    # Ensure workspace directory exists
    mkdir -p "${WORKSPACE_DIR}"
    cd "${WORKSPACE_DIR}"
    
    # Setup SSH for git operations
    log_info "Configuring SSH for git..."
    
    # Ensure SSH directory exists with correct permissions
    mkdir -p /root/.ssh
    chmod 700 /root/.ssh
    
    # If SSH keys were mounted, set correct permissions
    if [ -f "/root/.ssh/id_rsa" ]; then
        chmod 600 /root/.ssh/id_rsa
        log_success "SSH private key found and permissions set"
    fi
    
    if [ -f "/root/.ssh/id_ed25519" ]; then
        chmod 600 /root/.ssh/id_ed25519
        log_success "SSH Ed25519 key found and permissions set"
    fi
    
    # Setup git config globally (for any commits the agent makes)
    log_info "Configuring git..."
    local GIT_USER_NAME="${GIT_USER_NAME:-Devbob Agent (${CODEBASE_NAME})}"
    local GIT_USER_EMAIL="${GIT_USER_EMAIL:-devbob@metabob.local}"
    
    # Set global git config (can be overridden by env vars)
    git config --global user.name "${GIT_USER_NAME}" 2>/dev/null || true
    git config --global user.email "${GIT_USER_EMAIL}" 2>/dev/null || true
    git config --global init.defaultBranch main 2>/dev/null || true
    git config --global push.autoSetupRemote true 2>/dev/null || true
    
    # Configure git to trust this directory (for Docker volume mounts)
    git config --global --add safe.directory "${WORKSPACE_DIR}" 2>/dev/null || true
    
    if [ -d "${WORKSPACE_DIR}/.git" ]; then
        # Also set local config in the workspace
        git config user.email "${GIT_USER_EMAIL}" 2>/dev/null || true
        git config user.name "${GIT_USER_NAME}" 2>/dev/null || true
        
        # Setup push behavior
        if [ "${GIT_AUTO_PUSH}" = "true" ]; then
            log_info "Auto-push enabled for commits"
            # Setup post-commit hook for auto-push
            mkdir -p "${WORKSPACE_DIR}/.git/hooks"
            cat > "${WORKSPACE_DIR}/.git/hooks/post-commit" << 'HOOK_EOF'
#!/bin/bash
# Auto-push hook created by devbob
BRANCH=$(git branch --show-current)
if [ -n "$BRANCH" ]; then
    echo "Auto-pushing to origin/$BRANCH..."
    git push origin "$BRANCH" 2>&1 || echo "Push failed, will retry later"
fi
HOOK_EOF
            chmod +x "${WORKSPACE_DIR}/.git/hooks/post-commit"
        fi
        
        # Show current branch and commit
        local current_branch=$(git branch --show-current 2>/dev/null || echo "unknown")
        local current_commit=$(git rev-parse --short HEAD 2>/dev/null || echo "unknown")
        local repo_url=$(git remote get-url origin 2>/dev/null || echo "none")
        log_info "Repository info:"
        log_info "  Branch: ${current_branch}"
        log_info "  Commit: ${current_commit}"
        log_info "  Remote: ${repo_url}"
        
        # Check for uncommitted changes
        if ! git diff-index --quiet HEAD -- 2>/dev/null; then
            log_warn "Working directory has uncommitted changes"
            log_info "Run 'git status' to see details"
        fi
    else
        # No git repo, initialize one
        log_info "No git repository found, initializing empty repo..."
        git init > /dev/null 2>&1 || true
        git config user.email "devbob@metabob.local" 2>/dev/null || true
        git config user.name "Devbob Agent (${CODEBASE_NAME})" 2>/dev/null || true
        git config --global --add safe.directory "${WORKSPACE_DIR}" 2>/dev/null || true
    fi
    
    # Create .opencode directory for agent state
    mkdir -p "${WORKSPACE_DIR}/.opencode"
    log_info ".opencode directory created for agent state"
    
    # Create .metabob directory and ensure valid config
    mkdir -p "${WORKSPACE_DIR}/.metabob"
    
    # Create/overwrite metabob-cli config with valid format
    # Note: metabob-cli uses 'base_url' not 'api_url', and doesn't have 'sync' or 'analysis' sections
    log_info "Creating metabob-cli config..."
    cat > "${WORKSPACE_DIR}/.metabob/config.json" << EOF
{
    "base_url": "${METABOB_API_URL}",
    "api_key": "${METABOB_API_KEY:-}",
    "state_directory": ".metabob",
    "watch_files": true,
    "batch_size": 5
}
EOF
    
    log_success "Workspace initialized"
    
    # Show workspace summary
    local file_count=$(find . -maxdepth 2 -type f 2>/dev/null | wc -l)
    local dir_count=$(find . -maxdepth 1 -type d 2>/dev/null | wc -l)
    log_info "Workspace summary:"
    log_info "  Files (depth 2): ${file_count}"
    log_info "  Directories: ${dir_count}"
}

# =============================================================================
# Initialize opencode configuration
# =============================================================================
init_opencode_config() {
    log_info "Initializing opencode configuration..."
    
    # Create .opencode directory for overrides
    local override_dir="${WORKSPACE_DIR}/.opencode"
    local override_config="${override_dir}/opencode.json"
    
    mkdir -p "${override_dir}"
    
    # Create override config that uses environment variables
    # OpenCode supports {env:VAR_NAME} syntax for environment variable substitution
    log_info "Creating metabob override config..."
    log_info "  METABOB_API_URL: ${METABOB_API_URL}"
    log_info "  METABOB_API_KEY: ${METABOB_API_KEY:+[set]}"
    
    # Check for API keys (OpenCode reads from env vars automatically)
    if [ -n "${ANTHROPIC_API_KEY}" ] && [ "${ANTHROPIC_API_KEY}" != "your-anthropic-api-key-here" ]; then
        log_info "  Anthropic API key found in environment"
    fi
    
    if [ -n "${OPENAI_API_KEY}" ] && [ "${OPENAI_API_KEY}" != "your-openai-api-key-here" ]; then
        log_info "  OpenAI API key found in environment"
    fi
    
    # Build provider config with API keys from environment
    # Use envsubst to safely substitute API keys into JSON
    local ANTHROPIC_PROVIDER='{}'
    local OPENAI_PROVIDER='{}'
    
    if [ -n "${ANTHROPIC_API_KEY}" ] && [ "${ANTHROPIC_API_KEY}" != "your-anthropic-api-key-here" ]; then
        ANTHROPIC_PROVIDER="{\"options\":{\"apiKey\":\"${ANTHROPIC_API_KEY}\"}}"
        log_info "  Anthropic provider configured with API key"
    fi
    
    if [ -n "${OPENAI_API_KEY}" ] && [ "${OPENAI_API_KEY}" != "your-openai-api-key-here" ]; then
        OPENAI_PROVIDER="{\"options\":{\"apiKey\":\"${OPENAI_API_KEY}\"}}"
        log_info "  OpenAI provider configured with API key"
    fi
    
    # Determine Metabob settings based on environment
    local METABOB_ENABLED="false"
    local METABOB_AUTO_INJECT="false"
    local METABOB_MCP_ENABLED="false"
    
    # Only enable Metabob if we have a valid API URL and it's not disabled
    # METABOB_DISABLE_AUTO_INJECT=true disables auto-injection but keeps MCP tools available
    # METABOB_DISABLE_MCP=true completely disables the MCP server (no tools)
    log_info "  DEBUG: METABOB_API_URL='${METABOB_API_URL}'"
    log_info "  DEBUG: METABOB_DISABLE_MCP='${METABOB_DISABLE_MCP:-false}'"
    log_info "  DEBUG: METABOB_DISABLE_AUTO_INJECT='${METABOB_DISABLE_AUTO_INJECT:-false}'"
    if [ -n "${METABOB_API_URL}" ] && [ "${METABOB_API_URL}" != "disabled" ] && [ "${METABOB_API_URL}" != "" ]; then
        METABOB_ENABLED="true"
        log_info "  DEBUG: METABOB_ENABLED=true"
        if [ "${METABOB_DISABLE_MCP:-false}" = "true" ]; then
            # Completely disable MCP - no tools available
            METABOB_AUTO_INJECT="false"
            METABOB_MCP_ENABLED="false"
            log_info "  Metabob backend enabled (MCP completely disabled)"
        elif [ "${METABOB_DISABLE_AUTO_INJECT:-false}" = "true" ]; then
            # MCP tools available but auto-injection disabled (avoids hang during prompts)
            METABOB_AUTO_INJECT="false"
            METABOB_MCP_ENABLED="true"
            log_info "  Metabob MCP tools enabled (auto-inject disabled)"
        else
            # Full integration - auto-inject context into system prompts
            METABOB_AUTO_INJECT="true"
            METABOB_MCP_ENABLED="true"
            log_info "  Metabob full integration enabled (auto-inject + MCP tools)"
            log_info "  DEBUG: METABOB_MCP_ENABLED=true"
        fi
    else
        METABOB_ENABLED="false"
        METABOB_AUTO_INJECT="false"
        METABOB_MCP_ENABLED="false"
        log_info "  Metabob integration disabled (standalone mode)"
    fi

    # Determine which model to use
    # Priority: OPENCODE_MODEL env var > Anthropic if available > OpenAI if available
    local DEFAULT_MODEL=""
    if [ -n "${OPENCODE_MODEL:-}" ]; then
        DEFAULT_MODEL="${OPENCODE_MODEL}"
        log_info "  Using model from OPENCODE_MODEL: ${DEFAULT_MODEL}"
    elif [ -n "${ANTHROPIC_API_KEY}" ] && [ "${ANTHROPIC_API_KEY}" != "your-anthropic-api-key-here" ]; then
        DEFAULT_MODEL="anthropic/claude-sonnet-4-5"
        log_info "  Using default Anthropic model: ${DEFAULT_MODEL}"
    elif [ -n "${OPENAI_API_KEY}" ] && [ "${OPENAI_API_KEY}" != "your-openai-api-key-here" ]; then
        DEFAULT_MODEL="openai/gpt-4o"
        log_info "  Using default OpenAI model: ${DEFAULT_MODEL}"
    else
        log_warn "  No model configured (no API keys found)"
    fi

    # Create simplified config without problematic metabob template sections
    # This avoids OpenCode schema validation errors with template_auto_registration
    if [ "${METABOB_ENABLED}" = "true" ]; then
        # Build MCP section if MCP is enabled
        local MCP_CONFIG=""
        log_info "  DEBUG: Checking METABOB_MCP_ENABLED='${METABOB_MCP_ENABLED}'"
        if [ "${METABOB_MCP_ENABLED}" = "true" ]; then
            MCP_CONFIG=',
  "mcp": {
    "metabob": {
      "type": "local",
      "command": ["metabob-cli", "mcp", "--transport", "stdio"],
      "environment": {},
      "enabled": true
    }
  }'
            log_info "  DEBUG: MCP_CONFIG set (length: ${#MCP_CONFIG})"
        else
            log_warn "  DEBUG: MCP_CONFIG not set (METABOB_MCP_ENABLED != true)"
        fi
        
        # Create config with minimal metabob settings
        # Note: template_auto_registration and activity_learning are required objects in the schema
        printf '%s\n' "{
  \"\$schema\": \"https://opencode.ai/config.json\",
  \"share\": \"disabled\",
  \"model\": \"${DEFAULT_MODEL}\",
  \"metabob\": {
    \"cli_path\": \"metabob-cli\",
    \"base_url\": \"${METABOB_API_URL:-}\",
    \"api_key\": \"${METABOB_API_KEY:-}\",
    \"auto_inject\": ${METABOB_AUTO_INJECT},
    \"max_issues\": 5,
    \"min_severity\": \"MEDIUM\",
    \"template_auto_registration\": {
      \"enabled\": true,
      \"behavior\": \"best-effort\",
      \"strategy\": \"on-create\"
    },
    \"activity_learning\": {
      \"enabled\": true,
      \"record_outcomes\": true,
      \"track_decisions\": true,
      \"track_impulses\": true,
      \"auto_recommend\": true,
      \"recommendation_threshold\": 0.7,
      \"min_executions_for_learning\": 1
    }
  },
  \"provider\": {
    \"anthropic\": ${ANTHROPIC_PROVIDER},
    \"openai\": ${OPENAI_PROVIDER}
  },
  \"sessionMemory\": {
    \"enabled\": true,
    \"budgets\": {
      \"perImpulse\": 2000,
      \"total\": 10000
    },
    \"maxImpulsesPerTurn\": 5,
    \"memoryManagement\": {
      \"maxCacheTokens\": 10000,
      \"maxHistoryMessages\": 100,
      \"autoCompact\": true,
      \"compactThreshold\": 2048,
      \"activityStateCleanup\": true
    }
  }${MCP_CONFIG}
}" > "${override_config}"
    else
        # Create minimal config without metabob
        printf '%s\n' "{
  \"\$schema\": \"https://opencode.ai/config.json\",
  \"share\": \"disabled\",
  \"model\": \"${DEFAULT_MODEL}\",
  \"provider\": {
    \"anthropic\": ${ANTHROPIC_PROVIDER},
    \"openai\": ${OPENAI_PROVIDER}
  },
  \"sessionMemory\": {
    \"enabled\": true,
    \"budgets\": {
      \"perImpulse\": 2000,
      \"total\": 10000
    },
    \"maxImpulsesPerTurn\": 5,
    \"memoryManagement\": {
      \"maxCacheTokens\": 10000,
      \"maxHistoryMessages\": 100,
      \"autoCompact\": true,
      \"compactThreshold\": 2048,
      \"activityStateCleanup\": true
    }
  }
}" > "${override_config}"
    fi
    
    log_success "OpenCode override configuration created at ${override_config}"
}

# =============================================================================
# Wait for backend
# =============================================================================
wait_for_backend() {
    if [ "${WAIT_FOR_BACKEND:-false}" != "true" ]; then
        return 0
    fi
    
    log_info "Waiting for metabob backend at ${METABOB_API_URL}..."
    
    local max_attempts=30
    local attempt=1
    
    while [ $attempt -le $max_attempts ]; do
        # Try both /health and / endpoints
        if curl -sf "${METABOB_API_URL}/health" > /dev/null 2>&1 || \
           curl -sf "${METABOB_API_URL}/" > /dev/null 2>&1; then
            log_success "Backend is available"
            return 0
        fi
        
        log_info "Attempt ${attempt}/${max_attempts} - Backend not ready, waiting..."
        sleep 2
        attempt=$((attempt + 1))
    done
    
    log_warn "Backend not available after ${max_attempts} attempts, continuing anyway..."
    return 0
}

# =============================================================================
# Start OpenCode
# =============================================================================
start_opencode() {
    local mode="${1:-acp}"
    
    cd "${WORKSPACE_DIR}"
    
    case "$mode" in
        acp)
            log_info "Starting OpenCode in serve mode on port ${ACP_PORT}..."
            log_info "OpenCode will auto-start metabob-cli MCP server"
            
            # Start MCP bridge services if available
            if [ -f "/scripts/mcp-bridge-entrypoint.sh" ]; then
                log_info "Starting MCP bridge services..."
                chmod +x /scripts/mcp-bridge-entrypoint.sh
                /scripts/mcp-bridge-entrypoint.sh &
                BRIDGE_PID=$!
                log_info "MCP bridge services started (PID: ${BRIDGE_PID})"
                
                # Give bridge services time to start
                sleep 5
            fi
            
            # Use serve mode instead of acp mode to avoid stdin hang
            # Provides same HTTP API without ACP protocol stdin waiting
            exec opencode serve \
                --port "${ACP_PORT}" \
                --hostname "${ACP_HOSTNAME}" \
                --log-level DEBUG \
                --print-logs
            ;;
        serve)
            log_info "Starting OpenCode in headless server mode..."
            exec opencode serve \
                --port "${ACP_PORT}" \
                --hostname "${ACP_HOSTNAME}"
            ;;
        tui)
            log_info "Starting OpenCode TUI..."
            exec opencode "${WORKSPACE_DIR}"
            ;;
        *)
            log_error "Unknown mode: $mode"
            return 1
            ;;
    esac
}

# =============================================================================
# Push changes on exit
# =============================================================================
push_on_exit() {
    if [ "${GIT_PUSH_ON_EXIT}" != "true" ]; then
        return 0
    fi
    
    cd "${WORKSPACE_DIR}" 2>/dev/null || return 0
    
    if [ ! -d ".git" ]; then
        return 0
    fi
    
    log_info "Checking for unpushed commits..."
    
    local current_branch=$(git branch --show-current 2>/dev/null || echo "")
    if [ -z "$current_branch" ]; then
        log_info "Not on a branch, skipping push"
        return 0
    fi
    
    # Check if there are commits to push
    local unpushed=$(git log origin/${current_branch}..HEAD --oneline 2>/dev/null | wc -l)
    
    if [ "$unpushed" -gt 0 ]; then
        log_info "Pushing $unpushed commits to origin/${current_branch}..."
        if git push origin "${current_branch}" 2>&1; then
            log_success "Successfully pushed commits"
        else
            log_error "Failed to push commits"
            log_info "Changes remain in local git repository"
        fi
    else
        log_info "No commits to push"
    fi
}

# =============================================================================
# Main
# =============================================================================
main() {
    print_banner
    
    # Setup exit trap to push changes
    trap push_on_exit EXIT
    
    # Validate environment first
    validate_environment || {
        log_error "Environment validation failed, cannot continue"
        exit 1
    }
    
    # Verify installed tools
    verify_tools || {
        log_error "Tool verification failed, cannot continue"
        exit 1
    }
    
    # Setup repository (clone or update)
    setup_repository || {
        log_error "Repository setup failed, cannot continue"
        exit 1
    }
    
    # Initialize workspace
    init_workspace || {
        log_error "Workspace initialization failed, cannot continue"
        exit 1
    }
    
    # Initialize opencode configuration
    init_opencode_config || {
        log_error "OpenCode configuration failed, cannot continue"
        exit 1
    }
    
    # Wait for backend (optional)
    wait_for_backend
    
    log_success "All initialization complete, starting service..."
    
    # Handle different commands
    case "${1:-acp}" in
        acp|serve|tui)
            start_opencode "$1"
            ;;
        shell|bash)
            log_info "Starting interactive shell..."
            exec /bin/bash
            ;;
        metabob|metabob-cli)
            shift
            log_info "Running metabob-cli: $@"
            exec metabob-cli "$@"
            ;;
        opencode)
            shift
            log_info "Running opencode: $@"
            exec opencode "$@"
            ;;
        test)
            log_info "Running connectivity tests..."
            log_info "Testing metabob-cli MCP..."
            metabob-cli mcp --transport stdio --help || true
            log_info "Testing opencode metabob integration..."
            opencode metabob status || true
            log_success "Tests complete"
            ;;
        *)
            log_info "Executing: $@"
            exec "$@"
            ;;
    esac
}

main "$@"
