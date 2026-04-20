#!/bin/bash
# Operational Dashboard - System-Wide Visibility
# Shows all vessels, recent executions, and system health in real-time

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "═══════════════════════════════════════════════════════════════════"
echo "  Operational Dashboard - Complete System Visibility"
echo "═══════════════════════════════════════════════════════════════════"
echo ""
echo "Real-time view of:"
echo "  • All connected vessels in your org"
echo "  • Recent activity executions (last 24h)"
echo "  • System health metrics"
echo "  • Thompson Sampling performance"
echo ""
echo "═══════════════════════════════════════════════════════════════════"
echo ""

# Check dependencies
if ! command -v bun &> /dev/null; then
    echo "Error: Bun is not installed"
    echo "Install from: https://bun.sh"
    exit 1
fi

# Install npm dependencies if needed
if [ ! -d "$SCRIPT_DIR/node_modules" ]; then
    echo "📦 Installing dependencies..."
    cd "$SCRIPT_DIR"
    bun install
    echo ""
fi

# Load API key from config
if [ -f ~/.metabob/config.json ]; then
    METABOB_API_KEY_FROM_CONFIG=$(cat ~/.metabob/config.json | jq -r '.instance.apiKey // .metabob.apiKey // empty')
    if [ -n "$METABOB_API_KEY_FROM_CONFIG" ]; then
        export METABOB_API_KEY="$METABOB_API_KEY_FROM_CONFIG"
    fi
fi

# Configuration
export ACTIVITY_API_URL="${ACTIVITY_API_URL:-http://activity.metabob.local}"
export DISCOVERY_VESSEL_ENDPOINT="${DISCOVERY_VESSEL_ENDPOINT:-http://discovery-vessel.activity-system.svc.cluster.local:8080}"

echo "Configuration:"
echo "  Activity API:       $ACTIVITY_API_URL"
echo "  Discovery:          $DISCOVERY_VESSEL_ENDPOINT"
echo "  API key:            ${METABOB_API_KEY:+***configured***}"
echo ""

# Check connectivity
echo "Checking system connectivity..."
if curl -s --max-time 2 "$ACTIVITY_API_URL/health" > /dev/null 2>&1; then
    echo "✓ Activity API reachable"
else
    echo "⚠ Activity API not reachable"
fi

if [ -z "$METABOB_API_KEY" ]; then
    echo ""
    echo "⚠ WARNING: METABOB_API_KEY not set"
    echo "  Set in ~/.metabob/config.json or export METABOB_API_KEY"
fi

echo ""
echo "Starting operational dashboard..."
echo "Press Ctrl+C to exit"
echo ""
sleep 2

# Run the dashboard
cd "$SCRIPT_DIR"
exec bun run operational-dashboard.tsx
