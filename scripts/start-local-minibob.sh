#!/usr/bin/env bash
# Start a local MiniBob + discovery-vessel stack and configure the workbench.
#
# Usage:
#   ./scripts/start-local-minibob.sh          # start services
#   ./scripts/start-local-minibob.sh --down   # stop services
#   ./scripts/start-local-minibob.sh --logs   # follow logs

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
COMPOSE_FILE="$REPO_ROOT/docker-compose.minibob.yml"
WORKBENCH_ENV="$REPO_ROOT/repos/workbench/.env.local"

# ── Stop mode ────────────────────────────────────────────────────────────────
if [[ "${1:-}" == "--down" ]]; then
  echo "Stopping local MiniBob stack…"
  docker compose -f "$COMPOSE_FILE" down
  exit 0
fi

# ── Log mode ─────────────────────────────────────────────────────────────────
if [[ "${1:-}" == "--logs" ]]; then
  docker compose -f "$COMPOSE_FILE" logs -f
  exit 0
fi

# ── Preflight ────────────────────────────────────────────────────────────────
CONFIG="$HOME/.metabob/config.json"
if [[ ! -f "$CONFIG" ]]; then
  echo "ERROR: $CONFIG not found."
  echo "Create it with your metabob.apiKey and providers.anthropic.apiKey."
  exit 1
fi

if ! command -v docker &>/dev/null; then
  echo "ERROR: docker not found. Install Docker first."
  exit 1
fi

# ── Configure workbench ──────────────────────────────────────────────────────
if [[ -f "$WORKBENCH_ENV" ]]; then
  # Ensure VITE_DISCOVERY_ENDPOINT points to the backend
  if ! grep -q "^VITE_DISCOVERY_ENDPOINT=" "$WORKBENCH_ENV"; then
    echo "VITE_DISCOVERY_ENDPOINT=https://discovery.metabob.com" >> "$WORKBENCH_ENV"
    echo "✓ Workbench VITE_DISCOVERY_ENDPOINT set to https://discovery.metabob.com"
  fi
else
  echo "WARNING: $WORKBENCH_ENV not found; skipping workbench configuration."
fi

# ── Start services ────────────────────────────────────────────────────────────
echo "Building and starting local MiniBob stack…"
docker compose -f "$COMPOSE_FILE" up --build -d

echo ""
echo "Services starting (this takes ~30s on first run for the MiniBob image build):"
echo "  MiniBob:    http://localhost:8083/health"
echo ""
echo "Watch logs:   ./scripts/start-local-minibob.sh --logs"
echo "Stop:         ./scripts/start-local-minibob.sh --down"
echo ""
echo "Once MiniBob is healthy, open the workbench trajectory editor:"
echo "  http://localhost:5173/trajectory-editor"
echo ""
echo "In the 'executor vessel' panel:"
echo "  - If discovery.metabob.com is reachable, MiniBob appears automatically (~10s)"
echo "  - Otherwise, use the 'connect manually' field: http://localhost:8083"
