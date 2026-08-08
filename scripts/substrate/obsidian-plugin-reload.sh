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

# REPO_DIR defaults to THIS super-repo's obsidian-vessel, derived from the script's own
# location rather than hardcoded. The previous default named a different checkout
# (/home/avi/documents/work/exp-repo/metabob-devbob/...) which is 228 commits behind
# origin/dev — so a run here would have built month-old source and installed it over the
# vault, silently reverting every landed UI change. Deriving the path also satisfies law
# 11: the script works wherever the super-repo is cloned, with no host-specific literal.
SUPER_REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
REPO_DIR="${REPO_DIR:-$SUPER_REPO/repos/obsidian-vessel}"
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
  # The vault artifacts are SYMLINKS into this repo in the standard setup — which
  # this script's own header documents. `cp a b` where b resolves to a fails with
  # "are the same file", and under `set -e` that aborted the script HERE, before the
  # reload below. Net effect: the bundle was rebuilt and the plugin was never told,
  # so Obsidian kept serving the previously-loaded bundle until it was restarted by
  # hand. Measured 2026-08-07: Obsidian had been up 4h with a bundle built 4h after
  # it started. Skip the copy when source and destination are the same file; a real
  # (non-symlinked) install still copies exactly as before.
  if [[ "$REPO_DIR/$artifact" -ef "$PLUGIN_DIR/$artifact" ]]; then
    log "$artifact is a symlink to the repo — no copy needed"
  else
    cp "$REPO_DIR/$artifact" "$PLUGIN_DIR/$artifact"
  fi
  copied=$((copied + $(wc -c < "$REPO_DIR/$artifact")))
done
# styles.css is optional — only copy it if the plugin ships one.
if [[ -f "$REPO_DIR/styles.css" ]]; then
  if [[ ! "$REPO_DIR/styles.css" -ef "$PLUGIN_DIR/styles.css" ]]; then
    cp "$REPO_DIR/styles.css" "$PLUGIN_DIR/styles.css"
  fi
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
