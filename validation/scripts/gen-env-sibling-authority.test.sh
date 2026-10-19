#!/usr/bin/env bash
# gen-env-sibling-authority.test.sh: a spoke derives its sibling endpoints only from a block whose authority is its
# own anchor (scripts/substrate/gen-env.sh, "THE CONVENTIONAL BLOCK ONLY WHEN IT IS THIS ANCHOR'S OWN FLEET"), and an
# anchor that is down does not refuse the boot.
#   (0) gen-env-sibling-derivation-foreign-fleet.check.sh passes (the offset-block cases: a 25xxx spoke never
#       binds to or keys the 18xxx block, the reverse, and the single-fleet and own-offset controls)
# Outside the offset block (a TLS front on 8443, a container-internal 8100), with bodies the check's stub cannot give:
#   (a) POSITIVE CONTROL: the anchor answers /bootstrap advertising nothing usable for identity, and the 18xxx block's
#       own /bootstrap names this anchor -> the conventional block is used (:18101 / :18080)
#   (b) MUST-FAIL: the 18xxx block's discovery advertises ITSELF (a foreign fleet) -> its identity is never contacted
#       and nothing 18xxx renders; the anchor is up, so the boot is refused by name (FATAL), not bound elsewhere
#   (c) the anchor is down -> no 18xxx request at all, the boot is not refused (rc 0), the endpoints are not verified
#   (d) the 18xxx block names the anchor's OWN advertised discovery_endpoint (not the raw one in the token) -> used
#   (e) a container-internal anchor (:8100) whose port-relative identity (:8101) answers -> used, no 18xxx request
# The range is extracted from gen-env and run with curl stubbed as a function; nothing touches the network.
set -uo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"; G="${1:-$HERE/../../scripts/substrate/gen-env.sh}"
T="$(mktemp -d "${TMPDIR:-/tmp}/sibauth.XXXXXX")"; trap 'rm -rf "$T"' EXIT
FAILS=0; ok() { echo "ok   - $*"; }; bad() { echo "FAIL - $*"; FAILS=$((FAILS+1)); }
command -v jq >/dev/null || { echo "FAIL - jq not installed (a skip would read as a pass)"; exit 1; }

if bash "$HERE/gen-env-sibling-derivation-foreign-fleet.check.sh" "$G" > "$T/check.txt" 2>&1; then
  ok "(0) the foreign-fleet check passes"
else bad "(0) the foreign-fleet check fails: $(grep '^FAIL' "$T/check.txt" | head -3 | tr '\n' '|')"; fi

sed -n '/^probe_url() {/,/^}/p' "$G" > "$T/probe_url.sh"
sed -n '/^_disc_host="\$(printf/,/^esac$/p' "$G" > "$T/derive.sh"
/usr/bin/grep -q '_conv_is_ours' "$T/derive.sh" || { echo "FAIL - the derivation does not check the conventional block's authority (red)"; exit 1; }

# run <name> <discovery endpoint> <answers file>: answers are "URL<TAB>body" lines; a listed URL answers (exit 0,
# printing body), anything else is down. Logs every requested URL to $T/<name>.log; result vars to $T/<name>.out.
run() {
  : > "$T/$1.log"
  env -i PATH="$PATH" HOME="$T" DISCOVERY_ENDPOINT="$2" ANS="$3" LOG="$T/$1.log" OUT="$T/$1.out" D="$T" bash -c '
    curl() { local u="" a; for a in "$@"; do case "$a" in *://*) u="$a" ;; esac; done
      echo "$u" >> "$LOG"
      local line; line="$(awk -F"\t" -v u="$u" "\$1 == u { print; exit }" "$ANS")"
      [ -n "$line" ] || return 7; printf "%s" "${line#*	}"; return 0; }
    trap '"'"'rc=$?; printf "RC=%s\nID=%s\nACT=%s\n" "$rc" "${IDENTITY_VESSEL_URL:-}" "${ACTIVITY_API_ENDPOINT:-}" > "$OUT"'"'"' EXIT
    set -euo pipefail; . "$D/probe_url.sh"; . "$D/derive.sh"' > "$T/$1.err" 2>&1
}
get() { sed -n "s/^$2=//p" "$T/$1.out" | head -1; }
n18() { /usr/bin/grep -cE '^https?://hub\.example:18[0-9]{3}' "$T/$1.log"; }
ans() { printf '%s\t%s\n' "$@"; }

A=https://hub.example:8443
# (a) positive control
{ ans "$A/bootstrap" '{"discovery_endpoint":"https://hub.example:8443"}'; ans "$A/health" ''
  ans "https://hub.example:18100/bootstrap" '{"discovery_endpoint":"https://hub.example:8443/"}'
  ans "https://hub.example:18101/health" ''; } > "$T/a.ans"
run a "$A" "$T/a.ans"
[ "$(get a RC)" = 0 ] && [ "$(get a ID)" = "https://hub.example:18101" ] && [ "$(get a ACT)" = "https://hub.example:18080" ] \
  && ok "(a) control: the 18xxx block that names this anchor is used (:18101/:18080)" \
  || bad "(a) control: rc=$(get a RC) id=$(get a ID) act=$(get a ACT); $(grep gen-env "$T/a.err" | tail -2 | tr '\n' '|')"
# (b) must-fail: a foreign fleet on 18xxx advertises itself
{ ans "$A/bootstrap" '{"discovery_endpoint":"https://hub.example:8443"}'; ans "$A/health" ''
  ans "https://hub.example:18100/bootstrap" '{"discovery_endpoint":"http://hub.example:18100"}'
  ans "https://hub.example:18101/health" ''; } > "$T/b.ans"
run b "$A" "$T/b.ans"
/usr/bin/grep -q 'hub.example:18101' "$T/b.log" && bad "(b) the foreign block's identity was contacted" || ok "(b) the foreign block's identity is never contacted"
case "$(get b ID) $(get b ACT)" in *:18*) bad "(b) an 18xxx endpoint rendered: $(get b ID) $(get b ACT)" ;; *) ok "(b) no 18xxx endpoint renders" ;; esac
[ "$(get b RC)" = 1 ] && grep -q 'FATAL' "$T/b.err" && grep -q 'advertises http://hub.example:18100, not this anchor' "$T/b.err" \
  && ok "(b) the anchor is up, so the boot is refused by name, saying whose block it was" || bad "(b) rc=$(get b RC): $(grep gen-env "$T/b.err" | tail -3 | tr '\n' '|')"
# (c) anchor down; a fleet answers on 18xxx
{ ans "https://hub.example:18100/bootstrap" '{"discovery_endpoint":"https://hub.example:8443"}'; ans "https://hub.example:18101/health" ''; } > "$T/c.ans"
run c "$A" "$T/c.ans"
[ "$(n18 c)" = 0 ] && ok "(c) the anchor is down: no request reaches the 18xxx block" || bad "(c) $(n18 c) request(s) to the 18xxx block"
[ "$(get c RC)" = 0 ] && grep -q 'not verified: the anchor is down' "$T/c.err" \
  && ok "(c) the boot is not refused, and the endpoints are named unverified" || bad "(c) rc=$(get c RC): $(grep gen-env "$T/c.err" | tail -2 | tr '\n' '|')"
# (d) the block names the anchor's own advertised endpoint (a public URL), not the raw endpoint in the token
{ ans "$A/bootstrap" '{"discovery_endpoint":"https://substrate.example"}'; ans "$A/health" ''
  ans "https://hub.example:18100/bootstrap" '{"discovery_endpoint":"HTTPS://substrate.example/"}'
  ans "https://hub.example:18101/health" ''; } > "$T/d.ans"
run d "$A" "$T/d.ans"
[ "$(get d ID)" = "https://hub.example:18101" ] && ok "(d) a block naming the anchor's own advertisement is used" || bad "(d) id=$(get d ID) rc=$(get d RC)"
# (e) container-internal anchor
{ ans "http://hub.example:8100/bootstrap" '{}'; ans "http://hub.example:8101/health" ''
  ans "http://hub.example:18100/bootstrap" '{"discovery_endpoint":"http://hub.example:8100"}'; ans "http://hub.example:18101/health" ''; } > "$T/e.ans"
run e "http://hub.example:8100" "$T/e.ans"
[ "$(get e ID)" = "http://hub.example:8101" ] && [ "$(n18 e)" = 0 ] && ok "(e) a container-internal anchor uses its port-relative identity, no 18xxx request" \
  || bad "(e) id=$(get e ID), $(n18 e) 18xxx request(s)"

echo; [ "$FAILS" = 0 ] && { echo PASS; exit 0; } || { echo "$FAILS FAILED"; exit 1; }
