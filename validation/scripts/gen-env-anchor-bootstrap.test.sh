#!/usr/bin/env bash
# gen-env-anchor-bootstrap.test.sh: a joiner takes its identity and trace-store endpoints from the anchor's own
# GET /bootstrap (identity_endpoint, activity_endpoint) before falling back to port arithmetic. The arithmetic cannot
# follow a TLS front (https://hub:8443 has no trace-store sibling), so before this a token join only worked on the
# plain-HTTP 18xxx block and TLS-fronted nodes were wired by hand.
#   (a) MUST-FAIL: an anchor advertising reachable https endpoints → both are used as given
#   (b) an explicit IDENTITY_VESSEL_URL / ACTIVITY_API_ENDPOINT always wins over the advertisement
#   (c) a loopback advertisement is never used (it names the hub's own container, not the hub)
#   (d) an advertised endpoint that does not answer /health from here is not used (fallback to arithmetic)
#   (e) an older anchor with no activity_endpoint: identity from /bootstrap, the trace store left to arithmetic
#   (f) an anchor whose /bootstrap does not answer: nothing set, arithmetic as before
#   (g) an https anchor never follows an http:// advertisement (it would send the key and traces in cleartext)
# The block is extracted from gen-env and run with curl stubbed; nothing touches the network.
set -uo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"; G="${1:-$HERE/../../scripts/substrate/gen-env.sh}"
T="$(mktemp -d "${TMPDIR:-/tmp}/anchorbs.XXXXXX")"; trap 'rm -rf "$T"' EXIT
FAILS=0; ok() { echo "ok   - $*"; }; bad() { echo "FAIL - $*"; FAILS=$((FAILS+1)); }
awk '/# ★ ASK THE ANCHOR FIRST/{on=1} on && /_off_relative=\$\(\( _disc_port - 18100 \)\)/{exit} on{print}' "$G" > "$T/blk.sh"
grep -q '_bs_usable' "$T/blk.sh" && grep -q 'activity_endpoint' "$T/blk.sh" \
  || { echo "FAIL - gen-env does not ask the anchor's /bootstrap for its endpoints (red)"; exit 1; }
command -v jq >/dev/null || { echo "SKIP - jq not installed"; exit 0; }
# run <bootstrap json or ''> <reachable URLs, space separated> [explicit IDENTITY] [explicit ACTIVITY] -> "<identity>|<activity>"
run() {
  printf '%s' "$1" > "$T/bs.json"; printf '%s\n' $2 > "$T/up"
  ( curl() {
      local url=""; for a in "$@"; do case "$a" in [hH][tT][tT][pP]*://*) url="$a" ;; esac; done
      case "$url" in
        */bootstrap) [ -s "$T/bs.json" ] && cat "$T/bs.json" && return 0; return 22 ;;
        */health) grep -qx "${url%/health}" "$T/up" && return 0; return 7 ;;
      esac; return 7
    }
    DISCOVERY_ENDPOINT="https://hub.example:8443"
    IDENTITY_VESSEL_URL="${3:-}"; ACTIVITY_API_ENDPOINT="${4:-}"
    . "$T/blk.sh" 2>/dev/null
    printf '%s|%s' "${IDENTITY_VESSEL_URL:-}" "${ACTIVITY_API_ENDPOINT:-}" )
}
BS='{"identity_endpoint":"https://hub.example","activity_endpoint":"https://hub.example:9443","discovery_endpoint":"https://hub.example:8443"}'
r="$(run "$BS" "https://hub.example https://hub.example:9443")"
[ "$r" = "https://hub.example|https://hub.example:9443" ] && ok "(a) reachable advertised https endpoints are used as given" || bad "(a) got '$r'"
r="$(run "$BS" "https://hub.example https://hub.example:9443" "https://id.explicit" "https://act.explicit")"
[ "$r" = "https://id.explicit|https://act.explicit" ] && ok "(b) explicit values win over the advertisement" || bad "(b) got '$r'"
r="$(run '{"identity_endpoint":"http://127.0.0.1:8101","activity_endpoint":"http://localhost:8080"}' "http://127.0.0.1:8101 http://localhost:8080")"
[ "$r" = "|" ] && ok "(c) loopback advertisements are never used" || bad "(c) got '$r'"
r="$(run "$BS" "")"
[ "$r" = "|" ] && ok "(d) advertised endpoints that do not answer from here are not used" || bad "(d) got '$r'"
r="$(run '{"identity_endpoint":"https://hub.example","discovery_endpoint":"https://hub.example:8443"}' "https://hub.example")"
[ "$r" = "https://hub.example|" ] && ok "(e) an older anchor: identity from /bootstrap, the trace store left to arithmetic" || bad "(e) got '$r'"
r="$(run '' "https://hub.example")"
[ "$r" = "|" ] && ok "(f) an anchor whose /bootstrap does not answer: nothing set" || bad "(f) got '$r'"
# (g) TLS DOWNGRADE: the anchor is https, the advertisement is plain http (and answers /health) -> refused
r="$(run '{"identity_endpoint":"http://other.example:18101","activity_endpoint":"http://other.example:18080"}' "http://other.example:18101 http://other.example:18080")"
[ "$r" = "|" ] && ok "(g) an https anchor never follows an http advertisement (no TLS downgrade)" || bad "(g) TLS downgrade accepted: '$r'"
r="$(run '{"identity_endpoint":"HTTP://other.example:18101","activity_endpoint":"Http://other.example:18080"}' "HTTP://other.example:18101 Http://other.example:18080")"
[ "$r" = "|" ] && ok "(g) the downgrade check is case-insensitive (HTTP:// is refused too)" || bad "(g) uppercase HTTP:// slipped past: '$r'"
err="$( ( curl() { local url=""; for a in "$@"; do case "$a" in http*://*|HTTP*://*) url="$a" ;; esac; done; case "$url" in */bootstrap) echo '{"identity_endpoint":"http://other.example:18101"}'; return 0 ;; esac; return 0; }
         DISCOVERY_ENDPOINT="https://hub.example:8443"; IDENTITY_VESSEL_URL=""; ACTIVITY_API_ENDPOINT=""; . "$T/blk.sh" ) 2>&1 >/dev/null )"
case "$err" in *"downgrade the anchor's TLS"*) ok "(g) the log names the TLS downgrade as the reason" ;; *) bad "(g) the log does not name the downgrade: $err" ;; esac
case "$err" in *"loopback or does not answer"*) bad "(g) the log still gives the generic reason" ;; *) ok "(g) no misleading generic reason in the log" ;; esac
r="$(run '{"identity_endpoint":"http://0.0.0.0:8101"}' "http://0.0.0.0:8101")"
[ "$r" = "|" ] && ok "(c) 0.0.0.0 is treated as loopback" || bad "(c) 0.0.0.0 used: '$r'"
echo; [ "$FAILS" = 0 ] && { echo PASS; exit 0; } || { echo "$FAILS FAILED"; exit 1; }
