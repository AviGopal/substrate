#!/usr/bin/env bash
# Get Production API Key via Admin CLI
# 
# This script:
# 1. Sets up kubectl port-forward to production SurrealDB
# 2. Configures admin CLI to connect to production database
# 3. Lists existing API keys or provisions new ones
#
# Usage:
#   ./get_production_api_key_via_admin_cli.sh list
#   ./get_production_api_key_via_admin_cli.sh provision <org_id>

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RPC_API_DIR="$SCRIPT_DIR/repos/metabob-rpc-api"

# Production database credentials (from k8s secret)
export SURREAL_URL="ws://localhost:8888"
export SURREAL_USER="metabob-admin"
export SURREAL_PASS="production-password-change-me"
export SURREAL_NAMESPACE="metabob"
export SURREAL_DATABASE="production"

# Redis (not needed for API key operations, but required by config)
export REDIS_URI="redis://localhost:6379"

# Placeholder values for other required env vars
export STRIPE_API_KEY="${STRIPE_API_KEY:-sk_test_placeholder}"
export STRIPE_WEBHOOK_SECRET="${STRIPE_WEBHOOK_SECRET:-whsec_placeholder}"

COMMAND="${1:-list}"
ORG_ID="${2:-}"

echo "=================================="
echo "Production API Key Management"
echo "=================================="
echo ""
echo "📡 Setting up connection to production database..."
echo ""

# Check if port-forward is already running
if lsof -i :8888 >/dev/null 2>&1; then
    echo "✓ Port 8888 already in use (assuming port-forward is active)"
else
    echo "⚠️  Port 8888 not forwarded. Starting kubectl port-forward..."
    echo ""
    echo "Run this in another terminal:"
    echo "  kubectl port-forward -n metabob surrealdb-0 8888:8000"
    echo ""
    echo "Press ENTER when port-forward is ready..."
    read
fi

# Navigate to rpc-api directory
cd "$RPC_API_DIR"

echo ""
echo "🔍 Executing admin CLI command..."
echo ""

case "$COMMAND" in
    list)
        echo "Listing all API keys in production:"
        echo ""
        python -m admin.cli apikeys list
        ;;
    
    get)
        if [ -z "$ORG_ID" ]; then
            echo "Error: org_id required for 'get' command"
            echo "Usage: $0 get <org_id>"
            exit 1
        fi
        echo "Getting API keys for organization: $ORG_ID"
        echo ""
        python -m admin.cli apikeys list --org-id "$ORG_ID"
        ;;
    
    provision)
        if [ -z "$ORG_ID" ]; then
            echo "Error: org_id required for 'provision' command"
            echo "Usage: $0 provision <org_id>"
            exit 1
        fi
        echo "Provisioning API keys for organization: $ORG_ID"
        echo ""
        python -m admin.cli apikeys provision-for-users --org-id "$ORG_ID"
        ;;
    
    orgs)
        echo "Listing all organizations:"
        echo ""
        python -m admin.cli orgs list
        ;;
    
    users)
        if [ -z "$ORG_ID" ]; then
            echo "Listing all users:"
            echo ""
            python -m admin.cli users list
        else
            echo "Listing users for organization: $ORG_ID"
            echo ""
            python -m admin.cli users list --org-id "$ORG_ID"
        fi
        ;;
    
    org-create)
        ORG_NAME="${2:-}"
        ORG_ID_ARG="${3:-}"
        SEAT_LIMIT="${4:-50}"
        
        if [ -z "$ORG_NAME" ]; then
            echo "Error: organization name required"
            echo "Usage: $0 org-create <org_name> [org_id] [seat_limit]"
            exit 1
        fi
        
        echo "Creating organization: $ORG_NAME"
        echo ""
        
        if [ -n "$ORG_ID_ARG" ]; then
            python -m admin.cli orgs create "$ORG_NAME" --org-id "$ORG_ID_ARG" --seat-limit "$SEAT_LIMIT"
        else
            python -m admin.cli orgs create "$ORG_NAME" --seat-limit "$SEAT_LIMIT"
        fi
        ;;
    
    user-create)
        USER_EMAIL="${2:-}"
        USER_ORG_ID="${3:-}"
        USER_ROLE="${4:-member}"
        USER_PASSWORD="${5:-}"
        
        if [ -z "$USER_EMAIL" ] || [ -z "$USER_ORG_ID" ]; then
            echo "Error: email and org_id required"
            echo "Usage: $0 user-create <email> <org_id> [role] [password]"
            echo "Note: If password not provided, will prompt interactively"
            exit 1
        fi
        
        echo "Creating user: $USER_EMAIL in organization: $USER_ORG_ID"
        echo ""
        
        if [ -n "$USER_PASSWORD" ]; then
            # Non-interactive mode with password provided
            echo "$USER_PASSWORD" | python -m admin.cli users create "$USER_EMAIL" --org-id "$USER_ORG_ID" --role "$USER_ROLE" --password
        else
            # Interactive mode - will prompt for password
            python -m admin.cli users create "$USER_EMAIL" --org-id "$USER_ORG_ID" --role "$USER_ROLE"
        fi
        ;;
    
    *)
        echo "Unknown command: $COMMAND"
        echo ""
        echo "Available commands:"
        echo "  list                              - List all API keys"
        echo "  get <org_id>                     - List API keys for specific organization"
        echo "  provision <org_id>               - Provision API keys for users in organization"
        echo "  orgs                              - List all organizations"
        echo "  org-create <name> [id] [seats]   - Create new organization"
        echo "  users [org_id]                   - List all users (optionally filtered by org)"
        echo "  user-create <email> <org_id> [role] [password] - Create new user (auto-provisions API key)"
        exit 1
        ;;
esac

echo ""
echo "✓ Done!"
echo ""
