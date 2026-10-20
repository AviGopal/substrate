#!/usr/bin/env bash
# discovery-deregister.sh — remove a vessel's registration(s) from discovery.
#
#   discovery-deregister.sh <vessel-name-or-id-substring>
#   discovery-deregister.sh --unit <unit name without .service>
#
# --unit is the form every service's stop hook uses (units/service.d/20-deregister-on-stop.conf, ExecStopPost with
# %N): it matches EXACTLY the rows that unit registers, never a substring of another vessel's id. A row matches when
# its vesselId equals the name or is the name plus an instance suffix ("<name>-local", "<name>-<host>",
# "<name>-<n>"), or its vesselName equals the name. Every service runs the hook, and most register nothing, so in
# --unit mode no match exits 0 quietly (only the substring form reports exit 2 for a typo).
#
# The graceful-detach primitive: called by rendered units' ExecStopPost on any
# clean stop, and by vessel-ctl uninstall, so a planned detach leaves the
# registry immediately instead of rotting for the 5-min TTL (crash death still
# falls back to TTL expiry). Matches registrations whose vesselId/name contains
# the argument (vessels self-assign ids, often instance-suffixed). Best-effort:
# never fails the caller.
# apikey_cfg KEY: the curl config line that carries an ApiKey, for `curl -K <(apikey_cfg "$K")` or
# `apikey_cfg "$K" | curl -K -`. The key never reaches argv (printf is a builtin), so no process listing shows it.
apikey_cfg() { [ -n "${1:-}" ] && printf 'header = "Authorization: ApiKey %s"\n' "$1"; return 0; }

set -uo pipefail

MODE=substring
if [ "${1:-}" = --unit ]; then MODE=unit; shift; fi
NEEDLE="${1:?usage: discovery-deregister.sh [--unit] <vessel-name-or-id-substring>}"
DISCOVERY="${DISCOVERY_ENDPOINT:-http://127.0.0.1:8100}"
# --unit runs on EVERY service stop, oneshot ticks included, so it touches the network only for a unit the fleet
# inventory lists as a long-running vessel (a health_port) that registers (registers is not false). Anything else,
# or no readable inventory, is a quiet no-op: TTL expiry stays the backstop. Manifest vessels are rendered with
# their own ExecStopPost (render-unit), so they need no entry here.
if [ "$MODE" = unit ]; then
  INV="${DEREGISTER_INVENTORY:-/workspace/substrate/fleet/vessels.inventory.json}"
  [ -f "$INV" ] || INV=/usr/local/share/substrate/vessels.inventory.json
  jq -e --arg u "$NEEDLE.service" '[.vessels[]? | select(.unit == $u and (.health_port // null) != null and (.registers // true) != false)] | length > 0' \
    "$INV" >/dev/null 2>&1 || exit 0
fi
KEY="${METABOB_API_KEY:-$(grep -m1 '^METABOB_API_KEY=' /etc/substrate/env 2>/dev/null | cut -d= -f2- | tr -d '"')}"
[ -n "$KEY" ] || exit 0

# Scope to THIS substrate's rows. A bare substring match also deletes PEER
# substrates' mirror rows that share the vessel name (observed: stopping the
# hub's federation-transport-vessel removed federation-transport-vessel@<spoke>
# too, blanking the spoke's federated presence until its next re-register).
# A row is ours iff it has no '@<substrate>' qualifier, or its qualifier equals
# our FED_SUBSTRATE_ID; with no id configured, '@'-qualified rows are treated
# as not-ours (TTL expiry remains their backstop).
SUB="${FED_SUBSTRATE_ID:-$(grep -m1 '^FED_SUBSTRATE_ID=' /etc/substrate/env 2>/dev/null | cut -d= -f2- | tr -d '"')}"
IDS="$(curl -s -m 5 -X POST -K <(apikey_cfg "$KEY") -H 'Content-Type: application/json' \
  -d '{"pointer":{"type":"vesselRegistry"}}' "$DISCOVERY/resolve" 2>/dev/null \
  | jq -r --arg n "$NEEDLE" --arg sub "$SUB" --arg mode "$MODE" '.content.vessels[]?
      | (.vesselId // .id // "") as $vid | ($vid | sub("@.*$"; "")) as $base
      | select((if $mode == "unit" then ($base == $n or ($base | startswith($n + "-")) or ((.vesselName // "") == $n))
                else (($vid + " " + (.name // "")) | contains($n)) end)
          and (($vid | contains("@") | not) or (($sub != "") and ($vid | endswith("@" + $sub)))))
      | $vid' 2>/dev/null || true)"

# REPORT WHETHER ANYTHING WAS ACTUALLY REMOVED.
#
# This ended in an unconditional `exit 0`, and the only difference between "I
# removed the registry row" and "there was nothing here to remove" was whether a
# log line happened to appear. `vessel-ctl deregister` reads the exit status, so
# it answered `{"ok":true,"action":"deregistered"}` either way. Measured 2x2: a
# registered vessel printed `removed <id>` and its row disappeared; an
# unregistered one printed nothing, changed nothing, and reported the same
# success.
#
# Exit 2 for "found nothing" rather than 1: the caller must be able to tell an
# idempotent no-op apart from a transport or auth error, and treating a
# no-op as a hard failure would make repeat deregistration look broken.
_removed=0
for id in $IDS; do
  if curl -s -m 5 -X DELETE -K <(apikey_cfg "$KEY") "$DISCOVERY/vessels/$id" >/dev/null 2>&1; then
    echo "[discovery-deregister] removed $id"
    _removed=$((_removed+1))
  else
    echo "[discovery-deregister] DELETE failed for $id" >&2
    exit 1
  fi
done
if [ "$_removed" -eq 0 ]; then
  [ "$MODE" = unit ] && exit 0
  echo "[discovery-deregister] no registry entry matched '$NEEDLE' — nothing to remove" >&2
  exit 2
fi
exit 0
