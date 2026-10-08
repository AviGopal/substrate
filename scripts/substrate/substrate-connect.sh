#!/usr/bin/env bash
# substrate-connect.sh — hand a client its connection to this substrate.
#
#   docker exec <container> substrate-connect --merge-script \
#     | bash -s -- ~/.substrate/config.json docker exec <container> substrate-connect --values
#
# The client config is merged ON THE HOST, never in here: it can hold keys and secrets this fleet
# does not own (the cockpit's providers and their API keys), and nothing of it may enter the
# container. This command only ever hands OUT what it owns:
#   --values        {"endpoint","apiKey"[,"gapStoreEndpoint"]} — compact, one line, for
#                   scripts/substrate/connect-merge.sh to merge with the host's jq (the one
#                   implementation; README, ui-only-up and substrate-install all run it)
#   --merge-script  that merge script, for a host with no checkout to run as above
#   (no argument)   a FRESH client config, {"metabob":{...}} plus {"substrate":{...}} (the
#                   installer's first write of a file that does not exist yet)
#   --merge         REFUSED: it took the existing config on stdin, into the container
#
# STDOUT CARRIES ONLY THE REQUESTED JSON (or the script), so a pipe or redirect is safe; a
# gapStoreEndpoint is named only where this fleet runs development-vessel.
# Everything meant for a person — the cockpit registration line, the location rule, warnings —
# goes to stderr and shows in the terminal.
#
# The key is the one `substrate-status` checks at level `seeded`, and this command
# refuses (non-zero exit, no key printed, the verdict on stderr) until that level
# passes. A placeholder or a key identity has not accepted yet is never printed.
#
# The endpoint is this fleet's published trace-store port, computed by the verdict
# with the launch manifest's own precedence: the deprecated ACTIVITY_API_PORT when
# the launcher set it, else `<prefix>080` from SUBSTRATE_PORT_PREFIX. A fleet that
# runs no trace store of its own (a spoke) points the client at the one it resolves
# against, its hub's.
#
# The client reads its config by one rule (the cockpit's, not ours to change):
# METABOB_CONFIG_PATH overrides everything; otherwise a `.metabob/config.json` in the
# directory the cockpit starts in shadows `~/.metabob/config.json`. That path is a symlink to the
# config's home, `~/.substrate/config.json`, which connect-merge creates and keeps. This command runs
# inside the container and cannot see that directory, so it prints the check as a
# conditional warning; detecting an actual shadowing file is the host-side
# launcher's to do, where that directory is visible.
set -uo pipefail
MODE=config
case "${1:-}" in
  "") ;;
  --values) MODE=values ;;
  --merge-script)
    for c in "$(cd "$(dirname "${BASH_SOURCE[0]:-$0}")" && pwd)/connect-merge.sh" /usr/local/share/substrate/connect-merge.sh; do
      [ -r "$c" ] && { cat "$c"; exit 0; }
    done
    echo "[connect] connect-merge.sh is missing from this image" >&2; exit 2 ;;
  --merge)
    echo "[connect] refusing --merge: it piped the client config (and any provider keys in it) into the container. Merge on the host instead:" >&2
    echo "  docker exec <container> substrate-connect --merge-script | bash -s -- ~/.metabob/config.json docker exec <container> substrate-connect --values" >&2
    exit 64 ;;
  *) echo "usage: substrate-connect [--values | --merge-script]" >&2; exit 64 ;;
esac

STATUS_BIN=""
for c in ${SUBSTRATE_STATUS_BIN:+"$SUBSTRATE_STATUS_BIN"} /usr/local/bin/substrate-status "$(cd "$(dirname "${BASH_SOURCE[0]:-$0}")" && pwd)/substrate-status.sh"; do
  [ -x "$c" ] && { STATUS_BIN="$c"; break; }
done
[ -n "$STATUS_BIN" ] || { echo "[connect] substrate-status is missing from this image" >&2; exit 2; }
command -v jq >/dev/null 2>&1 || { echo "[connect] jq required" >&2; exit 2; }

VERDICT="$("$STATUS_BIN" --quick --level seeded --json 2>/dev/null)"; RC=$?
if [ "$RC" != 0 ]; then
  echo "[connect] refusing: level 'seeded' is not pass, so there is no key a client can use yet." >&2
  printf '%s' "$VERDICT" | jq -r '.levels[] | select(.level=="live" or .level=="seeded") | "  \(.level)  \(.value)  \(.evidence)"' >&2 2>/dev/null \
    || echo "  (no verdict: substrate-status exited $RC)" >&2
  echo "[connect] wait for it: substrate-status --wait seeded" >&2
  exit 1
fi

ENV_FILE="${SUBSTRATE_ENV_FILE:-/etc/substrate/env}"
envval() {
  local v=""
  [ -r "$ENV_FILE" ] && v="$(grep -m1 "^$1=" "$ENV_FILE" 2>/dev/null | cut -d= -f2- | sed -e 's/^"\(.*\)"$/\1/' -e "s/^'\(.*\)'$/\1/")"
  [ -n "$v" ] || v="$(printenv "$1" 2>/dev/null || true)"
  printf '%s' "$v"
}
KEY="$(envval METABOB_API_KEY)"
[ -n "$KEY" ] || { echo "[connect] refusing: METABOB_API_KEY is empty after seeding" >&2; exit 1; }
PREFIX="$(printf '%s' "$VERDICT" | jq -r '.port_prefix // empty' 2>/dev/null)"
PREFIX="${PREFIX:-18}"
HOST_PORT="$(printf '%s' "$VERDICT" | jq -r '.trace_host_port // empty' 2>/dev/null)"
HOST_PORT="${HOST_PORT:-${PREFIX}080}"
if printf '%s' "$VERDICT" | jq -e '(.deprecated_port_aliases // []) | index("ACTIVITY_API_PORT")' >/dev/null 2>&1; then
  echo "[connect] WARNING: ACTIVITY_API_PORT is deprecated in favour of SUBSTRATE_PORT_PREFIX; honouring it (host port $HOST_PORT) as the launch manifest does" >&2
fi
if printf '%s' "$VERDICT" | jq -e '.launched_by_manifest == false' >/dev/null 2>&1; then
  echo "[connect] WARNING: this container was not launched by the launch manifest, so its host port mapping cannot be seen from here; the endpoint below assumes the default mapping" >&2
fi

if [ "$(systemctl is-active activity-api.service 2>/dev/null || true)" = "active" ]; then
  ENDPOINT="http://127.0.0.1:${HOST_PORT}"
else
  ENDPOINT="$(envval ACTIVITY_API_ENDPOINT)"
  case "$ENDPOINT" in
    ""|*://127.0.0.1*|*://localhost*)
      ENDPOINT="http://127.0.0.1:${HOST_PORT}"
      echo "[connect] WARNING: this fleet runs no trace store and resolves against none a client can reach; the endpoint below will not answer until one is published" >&2 ;;
    *)
      echo "[connect] this fleet runs no trace store of its own; the client is pointed at the one it resolves against: $ENDPOINT" >&2 ;;
  esac
fi

# The gap store a client's pre-commit glue gate reads (run-glue-tests.sh --gap-store client-config):
# development-vessel's substrateGap resolver, published at <prefix>090. Top-level "substrate", not
# inside "metabob": that object is the cockpit's, and the file already carries other top-level keys.
# A fleet with no development-vessel of its own names none, and that client's check-first glue
# commits fail closed (said here, not discovered at commit time).
if [ "$(systemctl is-active development-vessel.service 2>/dev/null || true)" = "active" ]; then
  GAP_STORE_EP="http://127.0.0.1:${PREFIX}090"
else
  GAP_STORE_EP=""
  echo "[connect] this fleet runs no development-vessel, so the config names no gap store: a check-first glue test cannot be committed from this client (its tracked red is refused)" >&2
fi
if [ "$MODE" = values ]; then
  # The values only, straight to stdout (the merge script writes them to a mode-600 file).
  jq -n -c --arg e "$ENDPOINT" --arg k "$KEY" --arg g "$GAP_STORE_EP" \
    '{endpoint:$e, apiKey:$k} + (if $g == "" then {} else {gapStoreEndpoint:$g} end)' \
    || { echo "[connect] jq could not build the values; nothing printed" >&2; exit 2; }
  exit 0
fi
jq -n --arg e "$ENDPOINT" --arg k "$KEY" --arg g "$GAP_STORE_EP" \
  '{metabob:{endpoint:$e, apiKey:$k}} + (if $g == "" then {} else {substrate:{gapStoreEndpoint:$g}} end)' \
  || { echo "[connect] jq could not build the config; nothing printed" >&2; exit 2; }

{
  echo "[connect] stdout above is a FRESH client config. To update an existing ~/.substrate/config.json without losing its other keys, merge on the host (the file never enters the container; ~/.metabob/config.json is kept as a link to it for the cockpit):"
  echo "  docker exec <container> substrate-connect --merge-script | bash -s -- ~/.substrate/config.json docker exec <container> substrate-connect --values"
  echo "[connect] WARNING if either applies where the cockpit runs: METABOB_CONFIG_PATH, when set, overrides ~/.metabob/config.json; and if ./.metabob/config.json exists in the directory the cockpit starts in, it takes precedence over the file written here."
  echo "[connect] Register the cockpit (needs node/npx and Bun: https://bun.sh), then make one call such as registry_query:"
  echo "  claude mcp add metabob -- npx -y @metabob/mcp"
} >&2
