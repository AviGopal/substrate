#!/bin/bash
# Multi-Vessel Network Monitor - Live Data Mode
# Queries real Activity API for Thompson Sampling data

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "═══════════════════════════════════════════════════════════════════"
echo "  Multi-Vessel Network Monitor - LIVE DATA MODE"
echo "═══════════════════════════════════════════════════════════════════"
echo ""
echo "Querying real learning state from production Activity API"
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

# Load API key from MiniBob config if available
if [ -f ~/.metabob/config.json ]; then
    # Try both locations (instance.apiKey is the current standard)
    METABOB_API_KEY_FROM_CONFIG=$(cat ~/.metabob/config.json | jq -r '.instance.apiKey // .metabob.apiKey // empty')
    if [ -n "$METABOB_API_KEY_FROM_CONFIG" ]; then
        export METABOB_API_KEY="$METABOB_API_KEY_FROM_CONFIG"
        echo "✓ Loaded API key from ~/.metabob/config.json"
    fi
fi

# Configuration
export ACTIVITY_API_URL="${ACTIVITY_API_URL:-http://activity.metabob.local}"
export DISCOVERY_VESSEL_ENDPOINT="${DISCOVERY_VESSEL_ENDPOINT:-http://discovery-vessel.activity-system.svc.cluster.local:8080}"

echo "Configuration:"
echo "  Activity API:       $ACTIVITY_API_URL"
echo "  Discovery endpoint: ${DISCOVERY_VESSEL_ENDPOINT:-<disabled - using direct mode>}"
echo "  API key:            ${METABOB_API_KEY:+***configured***}"

# Check if we can reach the Activity API
echo ""
echo "Checking Activity API connectivity..."
if curl -s --max-time 3 "$ACTIVITY_API_URL/health" > /dev/null 2>&1; then
    echo "✓ Activity API reachable at $ACTIVITY_API_URL"
else
    echo "⚠ Activity API not reachable (will show offline)"
fi

if [ -z "$METABOB_API_KEY" ]; then
    echo ""
    echo "⚠ WARNING: METABOB_API_KEY not set"
    echo "  Some endpoints may require authentication."
    echo "  Set API key in ~/.metabob/config.json or export METABOB_API_KEY"
    echo ""
fi

echo ""
echo "Starting multi-vessel monitor with LIVE DATA..."
echo "Press Ctrl+C to exit"
echo ""
sleep 2

# Run the dashboard
cd "$SCRIPT_DIR"
exec bun run multi-vessel-dashboard.tsx
