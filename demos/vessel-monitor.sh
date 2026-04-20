#!/bin/bash
# Self-Contained Vessel Monitor
# Discovers and displays state of all vessels on the network

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "═══════════════════════════════════════════════════════════════════"
echo "  Multi-Vessel Network Monitor"
echo "═══════════════════════════════════════════════════════════════════"
echo ""
echo "Self-contained vessel that:"
echo "  • Discovers other vessels via discovery-vessel"
echo "  • Queries each vessel's learning state"
echo "  • Displays network-wide metrics"
echo "  • Shows cross-vessel activity execution"
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

# Configuration
export DISCOVERY_VESSEL_ENDPOINT="${DISCOVERY_VESSEL_ENDPOINT:-http://discovery-vessel.activity-system.svc.cluster.local:8080}"
export ACTIVITY_API_URL="${ACTIVITY_API_URL:-https://activity.metabob.com}"
export METABOB_API_KEY="${METABOB_API_KEY:-}"

echo "Configuration:"
echo "  Discovery endpoint: $DISCOVERY_VESSEL_ENDPOINT"
echo "  Activity API:       $ACTIVITY_API_URL"
echo "  API key:            ${METABOB_API_KEY:+***configured***}"
echo ""

# Check if we can reach discovery
if curl -s --max-time 2 "$DISCOVERY_VESSEL_ENDPOINT/health" > /dev/null 2>&1; then
    echo "✓ Discovery vessel reachable"
else
    echo "⚠ Discovery vessel not reachable (will use mock data)"
fi

echo ""
echo "Starting multi-vessel monitor..."
echo "Press Ctrl+C to exit"
echo ""
sleep 2

# Run the dashboard
cd "$SCRIPT_DIR"
exec bun run multi-vessel-dashboard.tsx
