#!/bin/bash
# MiniBob Authentication Helper
# Creates/retrieves JWT tokens for MiniBob development

set -e

# Configuration (can be overridden via environment)
INSTANCE_ID="${MINIBOB_INSTANCE_ID:-minibob-local-001}"
API_KEY="${MINIBOB_API_KEY:-test-api-key-123}"
TOKEN_FILE="${MINIBOB_TOKEN_FILE:-$HOME/.minibob/token}"

# Auto-detect API endpoint
detect_api_host() {
    # 1. Use environment variable if set
    if [ -n "${MINIBOB_API_HOST:-}" ]; then
        echo "$MINIBOB_API_HOST"
        return
    fi

    # 2. Try activity.metabob.local (primary)
    if curl -s --connect-timeout 2 http://activity.metabob.local/health > /dev/null 2>&1; then
        echo "http://activity.metabob.local"
        return
    fi

    # 3. Try api.minibob.local (legacy istio gateway)
    if curl -s --connect-timeout 2 http://api.minibob.local/health > /dev/null 2>&1; then
        echo "http://api.minibob.local"
        return
    fi

    # 4. Try localhost:8080 (port-forward)
    if curl -s --connect-timeout 2 http://localhost:8080/health > /dev/null 2>&1; then
        echo "http://localhost:8080"
        return
    fi

    # 5. Start port-forward if kubectl is available
    if command -v kubectl &> /dev/null; then
        if kubectl get svc -n activity-system metabob-activity-api &> /dev/null 2>&1; then
            echo -e "${YELLOW}Starting port-forward to metabob-activity-api...${NC}" >&2
            kubectl port-forward -n activity-system svc/metabob-activity-api 8080:8080 &>/dev/null &
            sleep 2
            if curl -s --connect-timeout 2 http://localhost:8080/health > /dev/null 2>&1; then
                echo "http://localhost:8080"
                return
            fi
        fi
    fi

    # 6. Fallback
    echo "http://activity.metabob.local"
}

API_HOST=$(detect_api_host)

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

usage() {
    echo "MiniBob Authentication Helper"
    echo ""
    echo "Usage: $0 <command>"
    echo ""
    echo "Commands:"
    echo "  login       Sign in and cache JWT token"
    echo "  token       Print current cached token"
    echo "  verify      Verify cached token is valid"
    echo "  refresh     Force refresh the token"
    echo "  export      Export token as environment variable command"
    echo "  curl        Print curl command with auth header"
    echo ""
    echo "Environment Variables:"
    echo "  MINIBOB_API_HOST     API endpoint (default: http://api.minibob.local)"
    echo "  MINIBOB_INSTANCE_ID  Instance ID (default: minibob-local-001)"
    echo "  MINIBOB_API_KEY      API key (default: test-api-key-123)"
    echo "  MINIBOB_TOKEN_FILE   Token cache file (default: ~/.minibob/token)"
    echo ""
    echo "Examples:"
    echo "  $0 login                    # Sign in and cache token"
    echo "  $0 token                    # Print cached token"
    echo "  eval \$($0 export)          # Export MINIBOB_JWT to environment"
    echo "  curl -H \"\$($0 curl)\" ...   # Use in curl commands"
}

ensure_dir() {
    mkdir -p "$(dirname "$TOKEN_FILE")"
}

do_login() {
    echo -e "${YELLOW}Signing in as $INSTANCE_ID...${NC}"

    RESPONSE=$(curl -s -X POST "$API_HOST/v2/auth/minibob/signin" \
        -H "Content-Type: application/json" \
        -d "{\"instance_id\": \"$INSTANCE_ID\", \"api_key\": \"$API_KEY\"}")

    # Check for error
    if echo "$RESPONSE" | jq -e '.error' > /dev/null 2>&1; then
        echo -e "${RED}Login failed:${NC}"
        echo "$RESPONSE" | jq .
        exit 1
    fi

    TOKEN=$(echo "$RESPONSE" | jq -r '.token')
    ORG_ID=$(echo "$RESPONSE" | jq -r '.org_id')

    if [ -z "$TOKEN" ] || [ "$TOKEN" = "null" ]; then
        echo -e "${RED}No token in response:${NC}"
        echo "$RESPONSE" | jq .
        exit 1
    fi

    # Cache the token
    ensure_dir
    echo "$TOKEN" > "$TOKEN_FILE"
    chmod 600 "$TOKEN_FILE"

    echo -e "${GREEN}Logged in successfully!${NC}"
    echo "  Org ID: $ORG_ID"
    echo "  Token cached at: $TOKEN_FILE"
    echo "  Token valid for: 24 hours"
}

get_token() {
    if [ ! -f "$TOKEN_FILE" ]; then
        echo -e "${RED}No cached token. Run '$0 login' first.${NC}" >&2
        exit 1
    fi
    cat "$TOKEN_FILE"
}

do_verify() {
    TOKEN=$(get_token)

    echo -e "${YELLOW}Verifying token...${NC}"

    RESPONSE=$(curl -s -X POST "$API_HOST/v2/auth/minibob/verify" \
        -H "Content-Type: application/json" \
        -d "{\"token\": \"$TOKEN\"}")

    VALID=$(echo "$RESPONSE" | jq -r '.valid')

    if [ "$VALID" = "true" ]; then
        echo -e "${GREEN}Token is valid${NC}"
        echo "  Org ID: $(echo "$RESPONSE" | jq -r '.org_id')"
        echo "  Instance: $(echo "$RESPONSE" | jq -r '.instance_id')"
    else
        echo -e "${RED}Token is invalid or expired${NC}"
        echo "Run '$0 refresh' to get a new token"
        exit 1
    fi
}

do_export() {
    TOKEN=$(get_token)
    echo "export MINIBOB_JWT='$TOKEN'"
}

do_curl() {
    TOKEN=$(get_token)
    echo "Authorization: Bearer $TOKEN"
}

# Main
case "${1:-}" in
    login)
        do_login
        ;;
    token)
        get_token
        ;;
    verify)
        do_verify
        ;;
    refresh)
        do_login
        ;;
    export)
        do_export
        ;;
    curl)
        do_curl
        ;;
    -h|--help|help)
        usage
        ;;
    *)
        usage
        exit 1
        ;;
esac
