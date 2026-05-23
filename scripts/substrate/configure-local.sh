#!/bin/bash
# configure-local.sh — write ~/.metabob/config.json pointing at the local substrate.
#
# Usage:
#   ./scripts/substrate/configure-local.sh
#   ./scripts/substrate/configure-local.sh --restore   (restore canary config from backup)
#
# What it does:
#   1. Verifies the substrate-live container is running on localhost:18080.
#   2. Reads the seeded API key from the container.
#   3. Writes ~/.metabob/config.json with endpoint=http://localhost:18080.
#   4. Backs up the existing config to ~/.metabob/config.json.canary so you
#      can restore it with --restore.
set -euo pipefail

ENDPOINT="http://localhost:18080"
CONFIG_FILE="$HOME/.metabob/config.json"
BACKUP_FILE="$HOME/.metabob/config.json.canary"
CONTAINER_NAME="${SUBSTRATE_CONTAINER:-substrate-live}"

if [[ "${1:-}" == "--restore" ]]; then
  if [[ ! -f "$BACKUP_FILE" ]]; then
    echo "No backup found at $BACKUP_FILE — nothing to restore." >&2
    exit 1
  fi
  cp "$BACKUP_FILE" "$CONFIG_FILE"
  echo "[configure-local] Restored canary config from $BACKUP_FILE"
  echo "[configure-local] Active endpoint: $(jq -r '.metabob.endpoint' "$CONFIG_FILE")"
  exit 0
fi

# Verify container is running
if ! docker inspect "$CONTAINER_NAME" --format '{{.State.Running}}' 2>/dev/null | grep -q true; then
  echo "[configure-local] ERROR: Container '$CONTAINER_NAME' is not running." >&2
  echo "  Start it with: make -C scripts/substrate substrate-run" >&2
  exit 1
fi

# Wait for activity-api to be reachable
echo "[configure-local] Waiting for activity-api at $ENDPOINT..."
for i in $(seq 1 10); do
  if curl -sf "$ENDPOINT/health" >/dev/null 2>&1; then
    break
  fi
  if [[ $i -eq 10 ]]; then
    echo "[configure-local] ERROR: activity-api not reachable after 10s." >&2
    exit 1
  fi
  sleep 1
done

# Read API key from container env file
API_KEY=$(docker exec "$CONTAINER_NAME" bash -c 'grep "^METABOB_API_KEY=" /etc/substrate/env' | cut -d= -f2-)
if [[ -z "$API_KEY" ]]; then
  echo "[configure-local] ERROR: Could not read METABOB_API_KEY from container." >&2
  echo "  Run: docker exec $CONTAINER_NAME bun /vessels/seed-identity.ts" >&2
  exit 1
fi

# Backup existing config if present
mkdir -p "$(dirname "$CONFIG_FILE")"
if [[ -f "$CONFIG_FILE" ]]; then
  cp "$CONFIG_FILE" "$BACKUP_FILE"
  echo "[configure-local] Backed up existing config to $BACKUP_FILE"
fi

# Get current Anthropic key from existing config or env
ANTHROPIC_KEY="${ANTHROPIC_API_KEY:-$(jq -r '.providers.anthropic.apiKey // empty' "$BACKUP_FILE" 2>/dev/null || true)}"

# Write new config
cat > "$CONFIG_FILE" <<EOF
{
  "metabob": {
    "apiKey": "$API_KEY",
    "endpoint": "$ENDPOINT"
  },
  "providers": {
    "anthropic": { "apiKey": "${ANTHROPIC_KEY:-}" }
  },
  "defaults": {
    "provider": "anthropic",
    "model": "claude-sonnet-4-20250514"
  }
}
EOF

echo "[configure-local] Wrote $CONFIG_FILE"
echo "[configure-local] endpoint : $ENDPOINT"
echo "[configure-local] api_key  : ${API_KEY:0:30}..."

# Quick smoke test
echo "[configure-local] Smoke-testing harness connectivity..."
HARNESS="$(dirname "$0")/../../validation/scripts/failure-mode-harness.ts"
if [[ -f "$HARNESS" ]]; then
  bun run "$HARNESS" --endpoint "$ENDPOINT" --limit 1 --no-backend 2>&1 | \
    grep -E "scenario|gap|HTTP error" | head -5 || true
  echo "[configure-local] Smoke test done. Run the full harness with:"
  echo "  bun run validation/scripts/failure-mode-harness.ts"
else
  echo "[configure-local] Harness not found at $HARNESS — skipping smoke test."
fi
