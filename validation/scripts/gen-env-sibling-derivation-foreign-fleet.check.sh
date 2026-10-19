#!/usr/bin/env bash
# gen-env-sibling-derivation-foreign-fleet.check.sh: a spoke whose sibling endpoints are not known derives them in
# scripts/substrate/gen-env.sh by probing identity /health. It tries the port-relative identity (18101 + offset,
# offset = discovery port - 18100) and, when that does not answer, falls back to the conventional 18101 on the same
# host, whichever fleet answers there. On a host running two fleets, a spoke of a 25xxx hub whose hub is down then
# binds to the OTHER fleet's 18xxx identity and trace store and presents its key to them. A spoke must derive only
# from an answer whose authority is its own fleet; otherwise the anchor is unreachable and no foreign block renders.
#
#   gen-env-sibling-derivation-foreign-fleet.check.sh [path/to/gen-env.sh]
#
# Not a *.test.sh: it was committed red (check first), before the fix, and a red glue test blocks the commit.
# Once green, a gen-env glue test runs it, so the cases stay under the pre-commit glue gate.
#
# Nothing here opens a connection. Two ranges are extracted from gen-env.sh and sourced: probe_url() (from
# `probe_url() {` to the first `}` at column 0) and the whole remote-anchor case (from the `_disc_host="$(printf`
# line to the next `esac`), so _disc_host, _disc_port and _disc_scheme come from the real lines. Only curl is
# stubbed, as a shell function: it is the block's one egress (the /bootstrap fetch, _bs_usable, _probe_port and
# probe_url all call it). _probe_port and the /bootstrap helpers are defined inside the block, so a stub of them
# would be overwritten by the source; stubbing curl beneath them keeps the real control flow, including the FATAL
# and probe_url `exit 1`s. The stub records "host:port path" for every request and answers from PROBE_ANSWERS
# ("host:port=up ..."; anything unlisted is down); an answer has an empty body, so /bootstrap advertises nothing.
# A curl shim first on PATH records ESCAPED and fails, so a request that bypasses the function is caught, and every
# host is hub.example, which does not resolve. Each case runs under env -i (a variable exported by the caller, such
# as IDENTITY_VESSEL_URL or HUB_DISCOVERY_URL, would skip the derivation) and set -euo pipefail, as gen-env runs;
# an EXIT trap writes the rendered endpoints and the exit code, because the block exits before its last lines.
#
# Must-fail: a spoke of a 25xxx hub (discovery 25100) whose 25101 and 25100 do not answer, while a foreign identity
# answers on 18101, renders no 18xxx endpoint and sends no request to the 18xxx block.
# Must-hold: the reverse, a conventional spoke (discovery 18100) whose 18101 is down while a stub answers on 25101,
# renders no 25xxx endpoint and sends no request to the 25xxx block.
# Controls: a single conventional fleet (discovery 18100, identity up on 18101) derives offset 0 and renders
# :18101/:18080; a 25xxx spoke whose own 25101 answers derives offset 7000 and renders :25101/:25080. The recorder
# itself is controlled: the conventional cases must log their 18101 probe, so a zero count elsewhere is attributed.
set -uo pipefail
SCRIPT="${1:-$(cd "$(dirname "$0")/../.." && pwd)/scripts/substrate/gen-env.sh}"
T="$(mktemp -d "${TMPDIR:-/tmp}/genenv-foreign.XXXXXX")"; trap 'rm -rf "$T"' EXIT
FAILS=0; ok() { echo "ok   - $*"; }; bad() { echo "FAIL - $*"; FAILS=$((FAILS+1)); }

sed -n '/^probe_url() {/,/^}/p' "$SCRIPT" > "$T/probe_url.sh"
sed -n '/^_disc_host="\$(printf/,/^esac$/p' "$SCRIPT" > "$T/derive.sh"
for f in probe_url derive; do
  if [ -s "$T/$f.sh" ] && bash -n "$T/$f.sh" 2>/dev/null; then ok "$f extracts and parses"; else bad "$f extracts and parses"; fi
done
/usr/bin/grep -q '_probe_port' "$T/derive.sh" && ok "the extract holds the sibling derivation" || bad "the extract holds the sibling derivation"

mkdir -p "$T/bin"
cat > "$T/bin/curl" <<'SHIM'
#!/usr/bin/env bash
echo "ESCAPED $*" >> "$CONTACT_LOG"; exit 7
SHIM
chmod +x "$T/bin/curl"

cat > "$T/run.sh" <<'RUN'
curl() {
  local a u hp path
  for a in "$@"; do case "$a" in *://*) u="$a" ;; esac; done
  [ -n "${u:-}" ] || { echo "NOURL $*" >> "$CONTACT_LOG"; return 2; }
  hp="$(printf '%s' "$u" | sed -E 's#^[a-z]+://##; s#/.*##')"
  path="/$(printf '%s' "$u" | sed -E 's#^[a-z]+://[^/]*/?##')"
  echo "$hp $path" >> "$CONTACT_LOG"
  case " $PROBE_ANSWERS " in *" $hp=up "*) return 0 ;; esac
  return 7
}
trap 'rc=$?; printf "RC=%s\nIDENTITY_VESSEL_URL=%s\nACTIVITY_API_ENDPOINT=%s\nHUB_DISCOVERY_URL=%s\n" "$rc" "${IDENTITY_VESSEL_URL:-}" "${ACTIVITY_API_ENDPOINT:-}" "${HUB_DISCOVERY_URL:-}" > "$RESULT"' EXIT
set -euo pipefail
. "$EXTRACT_DIR/probe_url.sh"
. "$EXTRACT_DIR/derive.sh"
RUN

# run_case <name> <discovery endpoint> <probe answers>
run_case() {
  : > "$T/$1.log"
  env -i PATH="$T/bin:$PATH" HOME="$T" DISCOVERY_ENDPOINT="$2" PROBE_ANSWERS="$3" \
    CONTACT_LOG="$T/$1.log" RESULT="$T/$1.out" EXTRACT_DIR="$T" bash "$T/run.sh" > "$T/$1.err" 2>&1
}
get() { sed -n "s/^$2=//p" "$T/$1.out" 2>/dev/null | head -1; }
rendered() { printf '%s %s' "$(get "$1" IDENTITY_VESSEL_URL)" "$(get "$1" ACTIVITY_API_ENDPOINT)"; }
contacts() { /usr/bin/grep -cE "^hub\.example:$2[0-9]{3} " "$T/$1.log"; }
escaped() { if /usr/bin/grep -q '^\(ESCAPED\|NOURL\) ' "$T/$1.log"; then bad "$1: every request went through the recorder (none reached a real curl)"; else ok "$1: every request went through the recorder (none reached a real curl)"; fi; }
show() { echo "     $1: rc=$(get "$1" RC) identity=$(get "$1" IDENTITY_VESSEL_URL) activity=$(get "$1" ACTIVITY_API_ENDPOINT) contacts=[$(tr '\n' ',' < "$T/$1.log" | sed 's/,$//')]"; }

run_case foreign25 "http://hub.example:25100" "hub.example:18101=up"
run_case foreign18 "http://hub.example:18100" "hub.example:25101=up"
run_case single18 "http://hub.example:18100" "hub.example:18101=up"
run_case own25    "http://hub.example:25100" "hub.example:25101=up"

# ── must-fail ────────────────────────────────────────────────────────────────
c="$(contacts foreign25 18)"; r="$(rendered foreign25)"; show foreign25; escaped foreign25
if printf '%s' "$r" | /usr/bin/grep -qE ':18[0-9]{3}\b'; then bad "a 25xxx spoke with its anchor down renders no 18xxx endpoint (got: $r)"
else ok "a 25xxx spoke with its anchor down renders no 18xxx endpoint ($r)"; fi
[ "$c" -eq 0 ] && ok "a 25xxx spoke with its anchor down sends no request to the 18xxx block" \
  || bad "a 25xxx spoke with its anchor down sends no request to the 18xxx block ($c sent)"

# ── must-hold ────────────────────────────────────────────────────────────────
c="$(contacts foreign18 25)"; r="$(rendered foreign18)"; show foreign18; escaped foreign18
if printf '%s' "$r" | /usr/bin/grep -qE ':25[0-9]{3}\b'; then bad "an 18xxx spoke with its anchor down renders no 25xxx endpoint (got: $r)"
else ok "an 18xxx spoke with its anchor down renders no 25xxx endpoint ($r)"; fi
[ "$c" -eq 0 ] && ok "an 18xxx spoke with its anchor down sends no request to the 25xxx block" \
  || bad "an 18xxx spoke with its anchor down sends no request to the 25xxx block ($c sent)"
[ "$(contacts foreign18 18)" -gt 0 ] && ok "recorder control: the 18xxx spoke's own 18101 probe is logged" \
  || bad "recorder control: the 18xxx spoke's own 18101 probe is logged"

# ── controls ─────────────────────────────────────────────────────────────────
show single18; escaped single18
[ "$(get single18 RC)" = 0 ] && ok "a single conventional fleet derives without refusing" || bad "a single conventional fleet derives without refusing (rc=$(get single18 RC))"
[ "$(get single18 IDENTITY_VESSEL_URL)" = "http://hub.example:18101" ] && ok "it renders identity :18101" || bad "it renders identity :18101 (got '$(get single18 IDENTITY_VESSEL_URL)')"
[ "$(get single18 ACTIVITY_API_ENDPOINT)" = "http://hub.example:18080" ] && ok "it renders activity :18080" || bad "it renders activity :18080 (got '$(get single18 ACTIVITY_API_ENDPOINT)')"
/usr/bin/grep -q '^hub\.example:18101 /health$' "$T/single18.log" && ok "recorder control: its 18101 /health probe is logged" \
  || bad "recorder control: its 18101 /health probe is logged"
show own25; escaped own25
[ "$(get own25 RC)" = 0 ] && ok "a 25xxx spoke whose own identity answers derives without refusing" || bad "a 25xxx spoke whose own identity answers derives without refusing (rc=$(get own25 RC))"
[ "$(get own25 IDENTITY_VESSEL_URL)" = "http://hub.example:25101" ] && ok "it renders identity :25101 (offset 7000)" || bad "it renders identity :25101 (got '$(get own25 IDENTITY_VESSEL_URL)')"
[ "$(get own25 ACTIVITY_API_ENDPOINT)" = "http://hub.example:25080" ] && ok "it renders activity :25080 (offset 7000)" || bad "it renders activity :25080 (got '$(get own25 ACTIVITY_API_ENDPOINT)')"
[ "$(get own25 HUB_DISCOVERY_URL)" = "http://hub.example:25100" ] && ok "it keeps the hub discovery it was given" || bad "it keeps the hub discovery it was given (got '$(get own25 HUB_DISCOVERY_URL)')"
[ "$(contacts own25 18)" -eq 0 ] && ok "it sends no request to the 18xxx block" || bad "it sends no request to the 18xxx block ($(contacts own25 18) sent)"

echo "---"; [ "$FAILS" -eq 0 ] && { echo "PASS"; exit 0; } || { echo "$FAILS failing"; exit 1; }
