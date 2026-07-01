#!/usr/bin/env bash
# obsidian-plugin-reload.sh — Deploy cutover for substrate-authored Obsidian features.
#
# WHY: feature_compose authors new commands/views into repos/obsidian-vessel/src,
# but the running Obsidian plugin loads a BUILT `main.js` from the vault's plugin
# dir — the TS source is never read at runtime. This script is the cutover step
# that turns a landed source change into a live UI feature: build the bundle,
# install the artifacts into the host vault, and trigger a plugin-scoped reload so
# the new command/view is registered without an Obsidian restart.
#
# It is intentionally NON-FATAL on a missing reload endpoint: on a fresh substrate
# the in-plugin HTTP action may not be live yet, so it prints the one-time manual
# toggle instructions and exits 0 (the artifacts are already installed).
#
# Direct: bash scripts/substrate/obsidian-plugin-reload.sh
#   env overrides: REPO_DIR, OBSIDIAN_PLUGIN_DIR, OBSIDIAN_ENDPOINT
set -euo pipefail

REPO_DIR="${REPO_DIR:-/home/avi/documents/work/exp-repo/metabob-devbob/repos/obsidian-vessel}"
PLUGIN_DIR="${OBSIDIAN_PLUGIN_DIR:-/home/projects/vaults/syzygy/.obsidian/plugins/obsidian-vessel}"
OBSIDIAN_ENDPOINT="${OBSIDIAN_ENDPOINT:-http://127.0.0.1:27182}"

log() { echo "[obsidian-plugin-reload $(date -Iseconds)] $*" >&2; }

# 1. Build the plugin bundle (produces main.js in the repo dir).
log "building obsidian-vessel plugin in $REPO_DIR"
cd "$REPO_DIR"
bun run build

# 2. Install artifacts into the host vault plugin dir.
mkdir -p "$PLUGIN_DIR"
copied=0
for artifact in main.js manifest.json; do
  if [[ ! -f "$REPO_DIR/$artifact" ]]; then
    log "ERROR required artifact '$artifact' missing after build — aborting"; exit 1
  fi
  cp "$REPO_DIR/$artifact" "$PLUGIN_DIR/$artifact"
  copied=$((copied + $(wc -c < "$REPO_DIR/$artifact")))
done
# styles.css is optional — only copy it if the plugin ships one.
if [[ -f "$REPO_DIR/styles.css" ]]; then
  cp "$REPO_DIR/styles.css" "$PLUGIN_DIR/styles.css"
  copied=$((copied + $(wc -c < "$REPO_DIR/styles.css")))
  log "copied styles.css"
fi
log "installed artifacts into $PLUGIN_DIR ($copied bytes total)"

# 3. Trigger a plugin-scoped reload so the new command/view registers live.
reload_status="not-attempted"
http_code="$(curl -s -m 8 -o /tmp/obsidian-reload-resp.$$ -w '%{http_code}' \
  -X POST "$OBSIDIAN_ENDPOINT/actions/reload-plugin" 2>/dev/null || echo "000")"
resp="$(cat /tmp/obsidian-reload-resp.$$ 2>/dev/null || true)"; rm -f /tmp/obsidian-reload-resp.$$
log "reload-plugin HTTP $http_code; response: ${resp:-<empty>}"

if [[ "$http_code" =~ ^2[0-9][0-9]$ ]]; then
  reload_status="reloaded (HTTP $http_code)"
else
  reload_status="reload endpoint not live (HTTP $http_code)"
  log "NOTE: the reload endpoint isn't live yet. Activate the new feature once by hand:"
  log "      Settings -> Community plugins -> toggle 'obsidian-vessel' OFF then ON."
  log "      (This is a one-time step; subsequent deploys reload automatically.)"
fi

# 4. Success summary.
log "SUCCESS: $copied bytes deployed to $PLUGIN_DIR; reload: $reload_status"
exit 0
