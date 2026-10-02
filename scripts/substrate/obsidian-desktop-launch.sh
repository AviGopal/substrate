#!/usr/bin/env bash
# obsidian-desktop-launch.sh — launch Obsidian itself onto the persistent
# display brought up by obsidian-xorg.service.
#
# Runs ONLY in the `substrate-obsidian` image flavour. In that flavour Obsidian
# is no longer a host peer reached via host.docker.internal:27183 — it lives
# inside the substrate, so the obsidian-vessel plugin talks to activity-api /
# concept-db over plain localhost (the substrate's invariant: "all inter-vessel
# calls are localhost — no trust boundary to cross").
#
# This unit restarts on every plugin reload (restart-obsidian-vessel); the X
# server + VNC export persist, so the operator's noVNC session survives.
#
# Obsidian is the foreground/main process: if it exits, systemd restarts it.
set -uo pipefail

VAULT="${OBSIDIAN_VAULT:-/vaults/substrate-vault}"
DISPLAY_NUM="${OBSIDIAN_DISPLAY:-:0}"
DATA_JSON="${VAULT}/.obsidian/plugins/obsidian-vessel/data.json"

# /etc/substrate/env carries the runtime-generated METABOB_API_KEY (every
# in-container vessel authenticates with it; localhost is rate-limit-allowlisted).
# shellcheck disable=SC1091
[ -f /etc/substrate/env ] && set -a && . /etc/substrate/env && set +a

# --- Point the vault config at the in-container fleet (create OR patch) -------
# The plugin must talk to activity-api / concept-db / discovery / goal-host over
# plain localhost on the REAL in-container ports (8080/8260/8100/8210), with the
# live api key. data.json is a real file (not a symlink), so writing it does not
# touch the source tree.
#
# CRITICAL: on a fresh boot the plugin has not created data.json yet, so a
# patch-if-exists block silently skips and Obsidian loads the plugin with EMPTY
# defaults (activityApiUrl="") — leaving the vessel unconfigured and unable to
# register or resolve. We therefore CREATE the file when missing so the plugin
# loads correct config on first start; jq merges onto an existing file otherwise.
PLUGIN_DIR="${VAULT}/.obsidian/plugins/obsidian-vessel"
mkdir -p "${PLUGIN_DIR}"
[ -f "${DATA_JSON}" ] || printf '%s\n' '{}' > "${DATA_JSON}"
tmp="$(mktemp)"
jq --arg key "${METABOB_API_KEY:-}" '
      .activityApiUrl   = "http://127.0.0.1:8080"
    | .websocketUrl     = "ws://127.0.0.1:8080/ws"
    | .conceptDbEndpoint = "http://127.0.0.1:8260"
    | .goalHostEndpoint = "http://127.0.0.1:8210"
    | .discoveryVesselEndpoint = "http://127.0.0.1:8100"
    | .advertisedHost   = "127.0.0.1"
    | .vesselId         = (if (.vesselId // "") == "" then "obsidian-vessel" else .vesselId end)
    | .vesselName       = (if (.vesselName // "") == "" then "Obsidian Knowledge Vessel" else .vesselName end)
    | (if $key != "" then .apiKey = $key else . end)
  ' "${DATA_JSON}" > "${tmp}" && mv "${tmp}" "${DATA_JSON}" \
  && echo "[obsidian-desktop] wrote in-container config to ${DATA_JSON}" >&2 \
  || echo "[obsidian-desktop] WARN: could not write ${DATA_JSON}" >&2

# --- Register the vault with Obsidian so it opens without the vault picker ---
mkdir -p /root/.config/obsidian
if [ ! -f /root/.config/obsidian/obsidian.json ]; then
  cat > /root/.config/obsidian/obsidian.json <<JSON
{"vaults":{"substratevault0000":{"path":"${VAULT}","ts":1700000000000,"open":true}}}
JSON
fi

# --- Pre-dismiss the "Do you trust the author of this vault?" modal -----------
# Obsidian gates community plugins behind Restricted Mode. The vault-trust prompt
# (modal Z0 in the asar) opens IFF
#     localStorage.getItem("enable-plugin-" + app.appId) === null
# (verified against obsidian-1.12.7.asar). appId is the vault key from
# obsidian.json — here the deterministic "substratevault0000" — so the gating key
# is  enable-plugin-substratevault0000. Listing the plugin in
# community-plugins.json is NOT sufficient: with that key null, Obsidian still
# opens the trust modal and stays in Restricted Mode until a human clicks
# "Trust author and enable plugins".
#
# That flag lives in Chromium's global Local Storage leveldb (origin
# app://obsidian.md), NOT in any vault JSON, so we seed a known-good, CRC-valid
# leveldb that already carries  enable-plugin-substratevault0000 = "true". The
# blobs below are the exact bytes Obsidian itself wrote after a human trusted the
# vault once (captured 2026-06-16); replaying them is idempotent and takes effect
# on the next launch only — we never touch a running Obsidian's open files.
OBSIDIAN_LS_DIR="/root/.config/obsidian/Local Storage/leveldb"
TRUST_KEY="enable-plugin-substratevault0000"
if ! grep -rq "${TRUST_KEY}" "${OBSIDIAN_LS_DIR}" 2>/dev/null; then
  mkdir -p "${OBSIDIAN_LS_DIR}"
  # CURRENT -> "MANIFEST-000001\n"
  printf '%s' 'TUFOSUZFU1QtMDAwMDAxCg==' | base64 -d > "${OBSIDIAN_LS_DIR}/CURRENT"
  # MANIFEST-000001 (ByteWiseComparator + version edit referencing log #3)
  printf '%s' 'lXy5xSIAAQEabGV2ZWxkYi5CeXRld2lzZUNvbXBhcmF0b3ICAAMCBAA=' \
    | base64 -d > "${OBSIDIAN_LS_DIR}/MANIFEST-000001"
  # 000003.log — full write batch incl. enable-plugin-substratevault0000=true
  printf '%s' 'PhPZP5QAAQEAAAAAAAAAAwAAAAEHVkVSU0lPTgExARZNRVRBOmFwcDovL29ic2lkaWFuLm1kCwiv5dbC593sFxBDATZfYXBwOi8vb2JzaWRpYW4ubWQAAXN1YnN0cmF0ZXZhdWx0MDAwMC1yZWNlbnQtc2VhcmNoZXMgAVsicGF0aDpjb25jZXB0LWRiL2V4dHJhY3RlZCAgIl3LEAdnfAABBAAAAAAAAAACAAAAARZNRVRBOmFwcDovL29ic2lkaWFuLm1kCwiGr6a36N3sFxB5ATtfYXBwOi8vb2JzaWRpYW4ubWQAAXN1YnN0cmF0ZXZhdWx0MDAwMC1maWxlLWV4cGxvcmVyLXVuZm9sZA4BWyJTdWJzdHJhdGUiXQ4Q2jthAAEGAAAAAAAAAAIAAAABFk1FVEE6YXBwOi8vb2JzaWRpYW4ubWQMCKSvpfTo3ewXEJMBAShfYXBwOi8vb2JzaWRpYW4ubWQAAXNwZWxsY2hlY2stbGFuZ3VhZ2VzBQFudWxszIIpzm0AAQgAAAAAAAAAAgAAAAEWTUVUQTphcHA6Ly9vYnNpZGlhbi5tZAwI+r256Ond7BcQuQEBNF9hcHA6Ly9vYnNpZGlhbi5tZAABZW5hYmxlLXBsdWdpbi1zdWJzdHJhdGV2YXVsdDAwMDAFAXRydWXBASFDfQABCgAAAAAAAAACAAAAARZNRVRBOmFwcDovL29ic2lkaWFuLm1kDAi5v+/y6d3sFxC5AQE7X2FwcDovL29ic2lkaWFuLm1kAAFzdWJzdHJhdGV2YXVsdDAwMDAtZmlsZS1leHBsb3Jlci11bmZvbGQOAVsiU3Vic3RyYXRlIl0=' \
    | base64 -d > "${OBSIDIAN_LS_DIR}/000003.log"
  echo "[obsidian-desktop] seeded vault-trust flag (${TRUST_KEY}=true) into Local Storage" >&2
fi

# --- Ensure the plugin is on the enabled-community-plugins list --------------
# Belt-and-suspenders alongside the trust flag: with the plugin absent here,
# Obsidian would not auto-load it even out of Restricted Mode.
CP_JSON="${VAULT}/.obsidian/community-plugins.json"
mkdir -p "${VAULT}/.obsidian"
if [ ! -f "${CP_JSON}" ]; then
  printf '%s\n' '["obsidian-vessel"]' > "${CP_JSON}"
elif ! jq -e 'index("obsidian-vessel")' "${CP_JSON}" >/dev/null 2>&1; then
  tmp="$(mktemp)"
  jq '. + ["obsidian-vessel"] | unique' "${CP_JSON}" > "${tmp}" && mv "${tmp}" "${CP_JSON}" \
    || echo "[obsidian-desktop] WARN: could not patch ${CP_JSON}" >&2
fi

export DISPLAY="${DISPLAY_NUM}"
# Electron-as-root inside a container: sandbox must be disabled.
export ELECTRON_DISABLE_SANDBOX=1

# Obsidian in the foreground — its exit drives the unit's Restart=on-failure.
#
# Flag rationale (performance — this is a headless, never-"focused" window doing
# real substrate work, not just a screen the operator watches):
#   --no-sandbox / --disable-gpu        : required for Electron-as-root with no GPU
#                                         in the container (software raster via Xvfb).
#   --disable-dev-shm-usage             : Chromium maps shared memory into /dev/shm,
#                                         which is the Docker default 64 MB here; on
#                                         a real vault that exhausts and the renderer
#                                         stalls/crashes. Fall back to a regular tmp.
#   --disable-background-timer-throttling
#   --disable-renderer-backgrounding
#   --disable-backgrounding-occluded-windows
#                                       : a headless window is always "occluded" to
#                                         Chromium's heuristics, so it throttles JS
#                                         timers to ~1 Hz and deprioritizes the
#                                         renderer. That throttles every interval-
#                                         driven plugin loop (poll / sync / learn).
#                                         These keep the obsidian-vessel loops at
#                                         full speed even with no visible focus.
exec /opt/obsidian/obsidian \
  --no-sandbox \
  --disable-gpu \
  --disable-dev-shm-usage \
  --disable-background-timer-throttling \
  --disable-renderer-backgrounding \
  --disable-backgrounding-occluded-windows
