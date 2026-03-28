#!/bin/bash
# MiniBob Development Helper
# Quick setup for development with authentication and data management

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

usage() {
    echo "MiniBob Development Helper"
    echo ""
    echo "Usage: $0 <command>"
    echo ""
    echo "Commands:"
    echo "  setup         Login and verify connection (run this first)"
    echo "  status        Check auth status and show data summary"
    echo "  backup        Export all learning data"
    echo "  restore FILE  Import learning data from backup"
    echo "  env           Print environment setup for shell"
    echo ""
    echo "Quick Start:"
    echo "  1. Deploy the system: cd helm && helmfile sync"
    echo "  2. Run setup:         $0 setup"
    echo "  3. Use minibob:       source <($0 env) && minibob goal \"...\""
    echo ""
    echo "For more options, see:"
    echo "  $SCRIPT_DIR/minibob-auth.sh --help"
    echo "  $SCRIPT_DIR/minibob-data.sh --help"
}

do_setup() {
    echo -e "${BLUE}Setting up MiniBob development environment...${NC}"
    echo ""

    # Check if API is reachable (try multiple endpoints)
    API_HOST=""
    for host in "http://activity.metabob.local" "http://api.minibob.local" "http://localhost:8080"; do
        echo -e "${YELLOW}Trying $host...${NC}"
        if curl -s --connect-timeout 3 "$host/health" > /dev/null 2>&1; then
            API_HOST="$host"
            break
        fi
    done

    if [ -z "$API_HOST" ]; then
        echo -e "${RED}API not reachable${NC}"
        echo ""
        echo "Make sure the system is deployed:"
        echo "  cd helm && helmfile -f activity-system-minimal.yaml.gotmpl sync"
        echo ""
        echo "And check /etc/hosts has:"
        echo "  127.0.0.1  activity.metabob.local dashboard.minibob.local api.minibob.local"
        echo ""
        echo "Or start port-forward:"
        echo "  kubectl port-forward -n activity-system svc/metabob-activity-api 8080:8080"
        exit 1
    fi

    export MINIBOB_API_HOST="$API_HOST"

    echo -e "${GREEN}API is up!${NC}"
    echo ""

    # Login
    "$SCRIPT_DIR/minibob-auth.sh" login
    echo ""

    # Show summary
    echo -e "${BLUE}Current learning data:${NC}"
    "$SCRIPT_DIR/minibob-data.sh" summary
}

do_status() {
    echo -e "${BLUE}MiniBob Development Status${NC}"
    echo ""

    # Check auth
    echo -e "${YELLOW}Authentication:${NC}"
    "$SCRIPT_DIR/minibob-auth.sh" verify 2>/dev/null || echo -e "  ${RED}Not authenticated. Run '$0 setup'${NC}"
    echo ""

    # Show data summary
    echo -e "${YELLOW}Learning Data:${NC}"
    "$SCRIPT_DIR/minibob-data.sh" summary 2>/dev/null || echo -e "  ${RED}Could not fetch data${NC}"
}

do_env() {
    # Print environment setup commands
    TOKEN=$("$SCRIPT_DIR/minibob-auth.sh" token 2>/dev/null || echo "")

    if [ -z "$TOKEN" ]; then
        echo "# No token found. Run: $0 setup"
        exit 1
    fi

    cat << EOF
# MiniBob Environment Setup
# Source this: source <($0 env)

export MINIBOB_JWT='$TOKEN'
export MINIBOB_API_HOST='${MINIBOB_API_HOST:-http://api.minibob.local}'
export MINIBOB_INSTANCE_ID='${MINIBOB_INSTANCE_ID:-minibob-local-001}'

# Aliases for convenience
alias mb-auth='$SCRIPT_DIR/minibob-auth.sh'
alias mb-data='$SCRIPT_DIR/minibob-data.sh'
alias mb-backup='$SCRIPT_DIR/minibob-data.sh export'
alias mb-status='$0 status'

echo "MiniBob environment configured!"
echo "  Token valid for: 24 hours"
echo "  API: \$MINIBOB_API_HOST"
EOF
}

# Main
case "${1:-}" in
    setup)
        do_setup
        ;;
    status)
        do_status
        ;;
    backup)
        "$SCRIPT_DIR/minibob-data.sh" export "${2:-}"
        ;;
    restore)
        if [ -z "${2:-}" ]; then
            echo -e "${RED}Usage: $0 restore <file>${NC}"
            exit 1
        fi
        "$SCRIPT_DIR/minibob-data.sh" import "$2"
        ;;
    env)
        do_env
        ;;
    -h|--help|help)
        usage
        ;;
    *)
        usage
        exit 1
        ;;
esac
