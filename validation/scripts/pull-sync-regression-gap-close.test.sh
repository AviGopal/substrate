#!/usr/bin/env bash
# pull-sync closes a test-regression gap once its vessel's test gate passes again (scripts/substrate/substrate-pull-sync.sh
# close_passed_regressions). The gate files pull-sync-test-regression-<v> when it refuses a head that regressed <v>'s own
# suite, and nothing wrote it closed: its later pass only cleared the refusal count, so the gap stayed an open root the
# walk could do nothing for, ended by no writer. Runs the script's own functions with curl stubbed as discovery in front of
# an in-memory records store, and the gate's verdict markers in a private directory.
#   (a) an open regression gap whose vessel last passed after the gap's latest row: one closed row (suite_passes_again,
#       the head that passed, the repo); a second tick writes nothing; a close the store does not take is said not
#       written and made on the next tick;
#   (b) the vessel's last verdict is a refusal: nothing written;
#   (c) the vessel's last pass is older than the gap's latest row: nothing written;
#   (d) no verdict recorded for the vessel: nothing written;
#   (e) other gaps (a failing-test generator gap, another systematic_failure gap of that vessel) are not touched;
#   (f) a records that cannot be read: nothing written, and it says so;
#   (g) the tick calls it, after carry_gap_repo.
# usage: validation/scripts/pull-sync-regression-gap-close.test.sh [path/to/substrate-pull-sync.sh]
set -uo pipefail
SCRIPT="${1:-$(cd "$(dirname "$0")/../.." && pwd)/scripts/substrate/substrate-pull-sync.sh}"
T="$(mktemp -d)"; trap 'rm -rf "$T"' EXIT
FAILS=0
ok()  { echo "ok   - $*"; }
bad() { echo "FAIL - $*"; FAILS=$((FAILS+1)); }
{
  for f in shape_route gap_resolve dev_resolve emit_gap emit_gap_checked close_passed_regressions; do sed -n "/^$f() {/,/^}/p" "$SCRIPT"; done
} > "$T/fns.sh"
grep -q '^close_passed_regressions()' "$T/fns.sh" || { echo "FAIL - could not extract close_passed_regressions"; exit 1; }
LOG="$T/log.txt"; log() { echo "$*" >> "$LOG"; }
ROWS="$T/rows.json"; WRITES="$T/writes.txt"; DOWN=""
DISCOVERY=http://discovery.test; SHAPE_ROUTES=" "; SR_ROUTE=""; DEV_VESSEL=""
export METABOB_API_KEY=""
curl() {
  cat > /dev/null
  local d="" a prev=""; for a in "$@"; do case "$prev" in -d) d="$a" ;; esac; prev="$a"; done
  local t; t="$(printf '%s' "$d" | jq -r '.pointer.type // empty')"
  case "$t" in
    vesselCapability) printf '{"content":{"vessels":[{"vesselId":"v"}]}}' ;;
    record_read) [ -n "$DOWN" ] && { printf 'unavailable'; return 0; }; jq -c --arg s "$(printf '%s' "$d" | jq -r .pointer.shape)" 'map(select(.shape == $s))' "$ROWS" ;;
    record_write)
      [ -n "${WFAIL:-}" ] && { printf '{}'; return 0; }
      local n row; n="$(jq length "$ROWS")"
      row="$(printf '%s' "$d" | jq -c --argjson n "$n" '.pointer as $p | $p.row + {id: ("row-" + ($n | tostring)), seq: ($n + 1), writer: $p.writer, role: $p.role}')"
      jq -c --argjson r "$row" '. + [$r]' "$ROWS" > "$ROWS.new" && mv "$ROWS.new" "$ROWS"
      echo "$row" >> "$WRITES"; printf '%s' "$row" ;;
    *) printf '{}' ;;
  esac
}
# shellcheck disable=SC1090
source "$T/fns.sh"
MARKER_DIR="$T/markers"; mkdir -p "$MARKER_DIR"

gap() { # gap_id t [extra-json]
  jq -cn --arg id "$1" --arg t "$2" --argjson x "${3:-{\}}" \
    '{shape: "gap", gap_id: $id, status: "open", category: "systematic_failure", summary: "refused", writer: "pull-sync", role: "detector", t: $t,
      meta: {vessel: ($id | sub("^pull-sync-test-regression-"; ""))}} + $x'
}
reset() { # rows...
  printf '%s\n' "$@" | jq -s -c 'to_entries | map(.value + {id: ("r" + (.key | tostring)), seq: (.key + 1)})' > "$ROWS"
  : > "$WRITES"; : > "$LOG"; rm -f "$MARKER_DIR"/*
}
verdict() { echo "$2 $3 $4" > "$MARKER_DIR/$1.last-gate-verdict"; }
R=pull-sync-test-regression-local-tools-vessel

# (a) passed after the gap: one closed row, then nothing
reset "$(gap "$R" "2026-11-12T23:39:24.512Z")"
verdict local-tools-vessel "2026-11-14T01:58:00Z" 6a05349315 passed
close_passed_regressions
L="$(tail -n 1 "$WRITES")"; n1="$(wc -l < "$WRITES")"
: > "$WRITES"; close_passed_regressions
if [ "$n1" = 1 ] && [ ! -s "$WRITES" ] && printf '%s' "$L" | jq -e --arg id "$R" '.gap_id == $id and .status == "closed" and .closed_reason == "suite_passes_again"
    and .repo == "local-tools-vessel" and .meta.head == "6a05349315" and .role == "detector" and (.summary | contains("passed its own suite again"))' >/dev/null; then
  ok "(a) the vessel passed after the gap: one closed row naming the head; the next tick writes nothing"
else bad "(a) n1=$n1 L=$L again=$(cat "$WRITES") log=$(cat "$LOG")"; fi

# (a) a close the store does not take is said not written, and the next tick closes it
reset "$(gap "$R" "2026-11-12T23:39:24Z")"
verdict local-tools-vessel "2026-11-14T01:58:00Z" 6a05349315 passed
WFAIL=1 close_passed_regressions; W1="$(wc -l < "$WRITES")"
grep -q 'closed row was NOT written' "$LOG"; WL=$?
: > "$LOG"; close_passed_regressions
if [ "$W1" = 0 ] && [ "$WL" = 0 ] && [ "$(jq -r .status "$WRITES")" = closed ] && grep -q 'closed: local-tools-vessel passed' "$LOG"; then
  ok "(a) a close the store did not take is said not written, and the next tick closes it"
else bad "(a) refused: W1=$W1 WL=$WL writes=$(cat "$WRITES") log=$(cat "$LOG")"; fi

# (b) the last verdict is a refusal
reset "$(gap "$R" "2026-11-12T23:39:24Z")"
verdict local-tools-vessel "2026-11-14T01:58:00Z" 6a05349315 "refused: suite red"
close_passed_regressions
if [ ! -s "$WRITES" ]; then ok "(b) the last verdict refused: left open"; else bad "(b) writes=$(cat "$WRITES")"; fi

# (c) a pass older than the gap's latest row
reset "$(gap "$R" "2026-11-12T23:39:24Z")"
verdict local-tools-vessel "2026-11-12T20:00:00Z" 1111111111 passed
close_passed_regressions
if [ ! -s "$WRITES" ]; then ok "(c) a pass older than the gap: left open"; else bad "(c) writes=$(cat "$WRITES")"; fi

# (d) no verdict recorded
reset "$(gap "$R" "2026-11-12T23:39:24Z")"
close_passed_regressions
if [ ! -s "$WRITES" ]; then ok "(d) no verdict for the vessel: left open"; else bad "(d) writes=$(cat "$WRITES")"; fi

# (e) other gaps of a passed vessel are not touched
reset "$(gap g-ft "2026-11-12T23:39:24Z" '{"meta": {"vessel": "local-tools-vessel", "filed_by": "pull-sync failing-test generator"}}')" \
  "$(gap pull-sync-runtime-behind-clone-local-tools-vessel "2026-11-12T23:39:24Z")"
verdict local-tools-vessel "2026-11-14T01:58:00Z" 6a05349315 passed
close_passed_regressions
if [ ! -s "$WRITES" ]; then ok "(e) other gaps are not touched"; else bad "(e) writes=$(cat "$WRITES")"; fi

# (f) records unreadable
reset "$(gap "$R" "2026-11-12T23:39:24Z")"
verdict local-tools-vessel "2026-11-14T01:58:00Z" 6a05349315 passed
DOWN=1; close_passed_regressions; DOWN=""
if [ ! -s "$WRITES" ] && grep -q 'regression close: records unreadable' "$LOG"; then ok "(f) records unreadable: nothing written, said"
else bad "(f) writes=$(cat "$WRITES") log=$(cat "$LOG")"; fi

# (g) the tick calls it, after carry_gap_repo
if [ "$(grep -nE '^(carry_gap_repo|close_passed_regressions) \|\| true$' "$SCRIPT" | cut -d: -f2 | tr '\n' ' ')" = 'carry_gap_repo || true close_passed_regressions || true ' ]; then
  ok "(g) the tick calls close_passed_regressions, after carry_gap_repo"
else bad "(g) the tick does not call close_passed_regressions after carry_gap_repo"; fi

[ "$FAILS" = 0 ] && { echo "PASS - pull-sync closes a test-regression gap once its vessel's gate passes again, and only then"; exit 0; }
echo "$FAILS FAILED"; exit 1
