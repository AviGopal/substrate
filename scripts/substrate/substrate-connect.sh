#!/usr/bin/env bash
# substrate-connect.sh — hand a client its connection to this substrate.
#
#   f=~/.metabob/config.json; mkdir -p "${f%/*}"
#   { cat "$f" 2>/dev/null || echo '{}'; } | docker exec -i <container> substrate-connect --merge > "$f.new" \
#     && mv "$f.new" "$f" || { rm -f "$f.new"; false; }
#
# --merge READS THE EXISTING CONFIG ON STDIN AND PRINTS IT MERGED, never a replacement: a client
# config also holds keys this command does not own (the cockpit's providers, defaults, ...), and a
# plain `> config.json` redirect deleted them. Only the keys this command owns are set:
# metabob.endpoint, metabob.apiKey and, where this fleet runs development-vessel,
# substrate.gapStoreEndpoint (a fleet without one leaves any existing value alone). Every other key
# is kept; a merge that changes nothing prints the input byte-for-byte. Input that is not a JSON
# object (or an object under metabob/substrate) is refused with a non-zero exit and nothing on
# stdout, so the `> new && mv` above never replaces the file with a truncated one. Without
# --merge, stdout is the fresh config alone (the installer's first write).
#
# STDOUT CARRIES ONLY THE CLIENT CONFIG, {"metabob":{"endpoint","apiKey"}} plus, where this fleet
# runs development-vessel, {"substrate":{"gapStoreEndpoint"}}, so the redirects above are safe.
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
# directory the cockpit starts in shadows `~/.metabob/config.json`. This command runs
# inside the container and cannot see that directory, so it prints the check as a
# conditional warning; detecting an actual shadowing file is the host-side
# launcher's to do, where that directory is visible.
set -uo pipefail
MERGE=0
case "${1:-}" in
  --merge) MERGE=1 ;;
  "") ;;
  *) echo "usage: substrate-connect [--merge  (existing config on stdin)]" >&2; exit 64 ;;
esac
# Read the existing config FIRST, so a refusal below never leaves stdin half-consumed.
EXISTING_F=""
if [ "$MERGE" = 1 ]; then
  EXISTING_F="$(mktemp "${TMPDIR:-/tmp}/connect-existing.XXXXXX")" || { echo "[connect] mktemp failed; nothing printed" >&2; exit 2; }
  trap 'rm -f "$EXISTING_F"' EXIT
  cat > "$EXISTING_F"
  [ -n "$(tr -d '[:space:]' < "$EXISTING_F")" ] || echo '{}' > "$EXISTING_F"
fi

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
NEW="$(jq -n -c --arg e "$ENDPOINT" --arg k "$KEY" --arg g "$GAP_STORE_EP" \
  '{metabob:{endpoint:$e, apiKey:$k}} + (if $g == "" then {} else {substrate:{gapStoreEndpoint:$g}} end)')" \
  || { echo "[connect] jq could not build the config; nothing printed" >&2; exit 2; }
if [ "$MERGE" = 0 ]; then
  printf '%s' "$NEW" | jq .
else
  # jq before 1.7 parses every number as a double: a merge would silently rewrite an integer
  # beyond 2^53 in a key this command does not own. Probe the jq in use; when it is lossy, refuse
  # such a file instead of rewriting it.
  LOSSY=false; [ "$(echo 100000000000000000001 | jq . 2>/dev/null)" = 100000000000000000001 ] || LOSSY=true
  MERGED="$(jq -s --argjson new "$NEW" --argjson lossy "$LOSSY" --arg jqv "$(jq --version 2>/dev/null)" '
      if length != 1 then error("the existing config is not one JSON value") else .[0] end
      | if type != "object" then error("the existing config is not a JSON object") else . end
      | if has("metabob") and (.metabob | type) != "object" then error("metabob is not an object") else . end
      | if has("substrate") and (.substrate | type) != "object" then error("substrate is not an object") else . end
      | if $lossy and ([.. | numbers | select(. > 9007199254740991 or . < -9007199254740991)] | length) > 0
        then error("the existing config holds a number beyond 2^53 and this jq (\($jqv)) would rewrite it") else . end
      | .metabob = ((.metabob // {}) + $new.metabob)
      | if $new.substrate then .substrate = ((.substrate // {}) + $new.substrate) else . end' "$EXISTING_F" 2>&1)" || {
    echo "[connect] refusing to merge: $(printf '%s' "$MERGED" | tail -1) — nothing printed, so the file is left as it is" >&2
    exit 1
  }
  if [ "$(jq -S -c . "$EXISTING_F" 2>/dev/null)" = "$(printf '%s' "$MERGED" | jq -S -c .)" ]; then
    cat "$EXISTING_F"   # nothing changed: the input, byte-for-byte
  else
    printf '%s\n' "$MERGED"
  fi
fi

{
  if [ "$MERGE" = 1 ]; then
    echo "[connect] stdout above is your client config with this fleet's keys merged in; write it through a temp file and mv (see the header), never straight over the file."
  else
    echo "[connect] stdout above is a FRESH client config. To update an existing ~/.metabob/config.json without losing its other keys, pipe it through --merge:"
    echo "  f=~/.metabob/config.json; { cat \"\$f\" 2>/dev/null || echo '{}'; } | docker exec -i <container> substrate-connect --merge > \"\$f.new\" && mv \"\$f.new\" \"\$f\" || { rm -f \"\$f.new\"; false; }"
  fi
  echo "[connect] WARNING if either applies where the cockpit runs: METABOB_CONFIG_PATH, when set, overrides ~/.metabob/config.json; and if ./.metabob/config.json exists in the directory the cockpit starts in, it takes precedence over the file written here."
  echo "[connect] Register the cockpit (needs node/npx and Bun: https://bun.sh), then make one call such as registry_query:"
  echo "  claude mcp add metabob -- npx -y @metabob/mcp"
} >&2
