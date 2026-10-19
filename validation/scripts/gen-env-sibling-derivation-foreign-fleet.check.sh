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
# and probe_url `exit 1`s. The stub records "host:port path KEYED|KEYLESS" for every request and answers from
# PROBE_ANSWERS ("host:port=up ..."; anything unlisted is down); an answer has an empty body, so /bootstrap
# advertises nothing. KEYED means the request would carry a credential: an -H/--header Authorization, ApiKey or
# X-...-Key header, -u/--user or --oauth2-bearer, or a -K/--config file (or stdin, for -) holding such a line.
# A curl shim first on PATH records ESCAPED and fails, so a request that bypasses the function is caught, and every
# host is hub.example, which does not resolve. Each case runs under env -i (a variable exported by the caller, such
# as IDENTITY_VESSEL_URL or HUB_DISCOVERY_URL, would skip the derivation) and set -euo pipefail, as gen-env runs;
# an EXIT trap writes the rendered endpoints and the exit code, because the block exits before its last lines.
#
# Must-fail: a spoke of a 25xxx hub (discovery 25100) whose 25101 and 25100 do not answer, while a foreign identity
# answers on 18101, renders no 18xxx endpoint; it sends no KEYED request to the 18xxx block, and every request it
# sends there is a keyless identity probe (port 18101, path /health or /info; gen-env's probes use /health only).
# So a fix that probes 18101 keylessly, sees a foreign authority and refuses passes; today's code fails the first.
# Must-hold: the reverse, a conventional spoke (discovery 18100) whose 18101 is down while a stub answers on 25101,
# renders no 25xxx endpoint and sends the 25xxx block nothing beyond a keyless identity probe.
# Controls: a single conventional fleet (discovery 18100, identity up on 18101) derives offset 0 and renders
# :18101/:18080; a 25xxx spoke whose own 25101 answers derives offset 7000 and renders :25101/:25080. The recorder
# itself is controlled: the conventional cases must log their 18101 probe, so a zero count elsewhere is attributed,
# and the stub called directly with each credential form must log KEYED (and with other headers, KEYLESS).
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

cat > "$T/stub.sh" <<'STUB'
# curl, as a table. Logs "host:port path KEYED|KEYLESS" per request; KEYED when it would carry a credential.
_cred_hdr() { printf '%s' "$1" | /usr/bin/grep -qiE '^[[:space:]]*(authorization|apikey|x-[a-z0-9-]*key)[[:space:]]*:'; }
curl() {
  local a u="" keyed=KEYLESS hp path cfg next=""
  for a in "$@"; do
    case "$next" in
      hdr) next=""; _cred_hdr "$a" && keyed=KEYED; continue ;;
      cfg) next=""
           if [ "$a" = - ]; then cfg="$(cat)"; else cfg="$(cat "$a" 2>/dev/null || true)"; fi
           printf '%s\n' "$cfg" | /usr/bin/grep -qiE \
             '^[[:space:]]*(-H|--header|header)[[:space:]=]+"?[[:space:]]*(authorization|apikey|x-[a-z0-9-]*key)[[:space:]]*:|^[[:space:]]*(-u|--user|user|--oauth2-bearer|oauth2-bearer)[[:space:]=]' \
             && keyed=KEYED
           [ -n "$u" ] || u="$(printf '%s\n' "$cfg" | sed -nE 's#^[[:space:]]*(--)?url[[:space:]=]+"?([^" ]*)"?.*#\2#p' | head -1)"
           continue ;;
      skip) next=""; continue ;;
    esac
    case "$a" in
      -H|--header) next=hdr ;;
      --header=*) _cred_hdr "${a#--header=}" && keyed=KEYED ;;
      -H?*) _cred_hdr "${a#-H}" && keyed=KEYED ;;
      -K|--config) next=cfg ;;
      -u|--user|--oauth2-bearer) next=skip; keyed=KEYED ;;
      -o|--max-time|-X|--request|-d|--data) next=skip ;;
      *://*) u="$a" ;;
    esac
  done
  [ -n "$u" ] || { echo "NOURL $*" >> "$CONTACT_LOG"; return 2; }
  hp="$(printf '%s' "$u" | sed -E 's#^[a-z]+://##; s#/.*##')"
  path="/$(printf '%s' "$u" | sed -E 's#^[a-z]+://[^/]*/?##')"
  echo "$hp $path $keyed" >> "$CONTACT_LOG"
  case " $PROBE_ANSWERS " in *" $hp=up "*) return 0 ;; esac
  return 7
}
STUB

cat > "$T/run.sh" <<'RUN'
. "$EXTRACT_DIR/stub.sh"
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
keyed()    { /usr/bin/grep -cE "^hub\.example:$2[0-9]{3} .* KEYED$" "$T/$1.log"; }
# Requests to a block that are not a keyless-able identity probe (port <block>101, path /health or /info).
nonident() { /usr/bin/grep -E "^hub\.example:$2[0-9]{3} " "$T/$1.log" | /usr/bin/grep -vE "^hub\.example:${2}101 /(health|info)([/?][^ ]*)? " | tr '\n' ',' | sed 's/,$//'; }
escaped() { if /usr/bin/grep -q '^\(ESCAPED\|NOURL\) ' "$T/$1.log"; then bad "$1: every request went through the recorder (none reached a real curl)"; else ok "$1: every request went through the recorder (none reached a real curl)"; fi; }
show() { echo "     $1: rc=$(get "$1" RC) identity=$(get "$1" IDENTITY_VESSEL_URL) activity=$(get "$1" ACTIVITY_API_ENDPOINT) contacts=[$(tr '\n' ',' < "$T/$1.log" | sed 's/,$//')]"; }

# Recorder control for the KEYED mark: the stub itself, called the ways a keyed request can be made.
(
  CONTACT_LOG="$T/unit.log"; PROBE_ANSWERS=""; : > "$CONTACT_LOG"; . "$T/stub.sh"
  U=http://hub.example:18101/health
  printf 'header = "Authorization: Bearer placeholder"\n' > "$T/unit.cfg"
  curl -sf -H "Authorization: Bearer placeholder" "$U"
  curl -sf --header "X-Api-Key: placeholder" "$U"
  printf 'header = "ApiKey: placeholder"\nurl = "%s"\n' "$U" | curl -sf -K -
  curl -sf --config "$T/unit.cfg" "$U"
  curl -sf -u user:placeholder "$U"
  curl -sf -H "Accept: application/json" "$U"
  printf 'header = "Accept: application/json"\n' | curl -sf -K - "$U"
  curl -sf --max-time 2 -o /dev/null "$U"
) || true
unit_got="$(awk '{print $NF}' "$T/unit.log" | tr '\n' ' ' | sed 's/ $//')"
[ "$unit_got" = "KEYED KEYED KEYED KEYED KEYED KEYLESS KEYLESS KEYLESS" ] \
  && ok "recorder control: -H/--header/-K -/--config/-u credentials log KEYED, other headers and bare probes KEYLESS" \
  || bad "recorder control: -H/--header/-K -/--config/-u credentials log KEYED, other headers and bare probes KEYLESS (got: $unit_got)"
/usr/bin/grep -q '^hub\.example:18101 /health KEYED$' "$T/unit.log" && ok "recorder control: a -K - config's url is recorded" \
  || bad "recorder control: a -K - config's url is recorded"

run_case foreign25 "http://hub.example:25100" "hub.example:18101=up"
run_case foreign18 "http://hub.example:18100" "hub.example:25101=up"
run_case single18 "http://hub.example:18100" "hub.example:18101=up"
run_case own25    "http://hub.example:25100" "hub.example:25101=up"

# ── must-fail ────────────────────────────────────────────────────────────────
c="$(contacts foreign25 18)"; r="$(rendered foreign25)"; show foreign25; escaped foreign25
if printf '%s' "$r" | /usr/bin/grep -qE ':18[0-9]{3}\b'; then bad "a 25xxx spoke with its anchor down renders no 18xxx endpoint (got: $r)"
else ok "a 25xxx spoke with its anchor down renders no 18xxx endpoint ($r)"; fi
k="$(keyed foreign25 18)"; [ "$k" -eq 0 ] && ok "a 25xxx spoke with its anchor down sends no KEYED request to the 18xxx block ($c sent, none keyed)" \
  || bad "a 25xxx spoke with its anchor down sends no KEYED request to the 18xxx block ($k sent)"
n="$(nonident foreign25 18)"; [ -z "$n" ] && ok "every request it sends to the 18xxx block is an identity probe (18101 /health or /info)" \
  || bad "every request it sends to the 18xxx block is an identity probe (18101 /health or /info; got: $n)"

# ── must-hold ────────────────────────────────────────────────────────────────
c="$(contacts foreign18 25)"; r="$(rendered foreign18)"; show foreign18; escaped foreign18
if printf '%s' "$r" | /usr/bin/grep -qE ':25[0-9]{3}\b'; then bad "an 18xxx spoke with its anchor down renders no 25xxx endpoint (got: $r)"
else ok "an 18xxx spoke with its anchor down renders no 25xxx endpoint ($r)"; fi
k="$(keyed foreign18 25)"; [ "$k" -eq 0 ] && ok "an 18xxx spoke with its anchor down sends no KEYED request to the 25xxx block ($c sent, none keyed)" \
  || bad "an 18xxx spoke with its anchor down sends no KEYED request to the 25xxx block ($k sent)"
n="$(nonident foreign18 25)"; [ -z "$n" ] && ok "every request it sends to the 25xxx block is an identity probe (25101 /health or /info)" \
  || bad "every request it sends to the 25xxx block is an identity probe (25101 /health or /info; got: $n)"
[ "$(contacts foreign18 18)" -gt 0 ] && ok "recorder control: the 18xxx spoke's own 18101 probe is logged" \
  || bad "recorder control: the 18xxx spoke's own 18101 probe is logged"

# ── controls ─────────────────────────────────────────────────────────────────
show single18; escaped single18
[ "$(get single18 RC)" = 0 ] && ok "a single conventional fleet derives without refusing" || bad "a single conventional fleet derives without refusing (rc=$(get single18 RC))"
[ "$(get single18 IDENTITY_VESSEL_URL)" = "http://hub.example:18101" ] && ok "it renders identity :18101" || bad "it renders identity :18101 (got '$(get single18 IDENTITY_VESSEL_URL)')"
[ "$(get single18 ACTIVITY_API_ENDPOINT)" = "http://hub.example:18080" ] && ok "it renders activity :18080" || bad "it renders activity :18080 (got '$(get single18 ACTIVITY_API_ENDPOINT)')"
/usr/bin/grep -q '^hub\.example:18101 /health KEYLESS$' "$T/single18.log" && ok "recorder control: its 18101 /health probe is logged" \
  || bad "recorder control: its 18101 /health probe is logged"
show own25; escaped own25
[ "$(get own25 RC)" = 0 ] && ok "a 25xxx spoke whose own identity answers derives without refusing" || bad "a 25xxx spoke whose own identity answers derives without refusing (rc=$(get own25 RC))"
[ "$(get own25 IDENTITY_VESSEL_URL)" = "http://hub.example:25101" ] && ok "it renders identity :25101 (offset 7000)" || bad "it renders identity :25101 (got '$(get own25 IDENTITY_VESSEL_URL)')"
[ "$(get own25 ACTIVITY_API_ENDPOINT)" = "http://hub.example:25080" ] && ok "it renders activity :25080 (offset 7000)" || bad "it renders activity :25080 (got '$(get own25 ACTIVITY_API_ENDPOINT)')"
[ "$(get own25 HUB_DISCOVERY_URL)" = "http://hub.example:25100" ] && ok "it keeps the hub discovery it was given" || bad "it keeps the hub discovery it was given (got '$(get own25 HUB_DISCOVERY_URL)')"
[ "$(contacts own25 18)" -eq 0 ] && ok "it sends no request to the 18xxx block" || bad "it sends no request to the 18xxx block ($(contacts own25 18) sent)"

echo "---"; [ "$FAILS" -eq 0 ] && { echo "PASS"; exit 0; } || { echo "$FAILS failing"; exit 1; }
