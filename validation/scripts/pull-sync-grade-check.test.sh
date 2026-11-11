#!/usr/bin/env bash
# pull-sync's grade check (scripts/substrate/substrate-pull-sync.sh grade_check): one detector gap while the walk writes
# grades of answers that records counts none of, read from the tally records answers on its posterior read; closed the
# first check an answer grade counts. Runs the script's own functions with curl stubbed as discovery in front of an
# in-memory records store whose posterior answers a tally the test sets.
#   (a) a first check only keeps the tally: nothing written;
#   (b) answer grades written since the last check, none counted: one open detector gap (written once);
#   (c) lapses counted but no answer grade: it stays open (the fold still refuses every answer grade);
#   (d) an answer grade counted: a closed row, the gap no longer open;
#   (e) nothing written since the last check: nothing written;
#   (f) a tally that cannot be read writes nothing and keeps the last one.
# usage: validation/scripts/pull-sync-grade-check.test.sh [path/to/substrate-pull-sync.sh]
set -uo pipefail
SCRIPT="${1:-$(cd "$(dirname "$0")/../.." && pwd)/scripts/substrate/substrate-pull-sync.sh}"
T="$(mktemp -d)"; trap 'rm -rf "$T"' EXIT
FAILS=0
ok()  { echo "ok   - $*"; }
bad() { echo "FAIL - $*"; FAILS=$((FAILS+1)); }
{
  for f in shape_route gap_resolve dev_resolve emit_gap grade_check; do sed -n "/^$f() {/,/^}/p" "$SCRIPT"; done
} > "$T/fns.sh"
grep -q '^grade_check()' "$T/fns.sh" || { echo "FAIL - could not extract grade_check"; exit 1; }
LOG="$T/log.txt"; log() { echo "$*" >> "$LOG"; }
ROWS="$T/rows.json"; TALLY="$T/tally.json"; DOWN=0
DISCOVERY=http://discovery.test; SHAPE_ROUTES=" "; SR_ROUTE=""; DEV_VESSEL=""
export METABOB_API_KEY="" TEST_BASELINE_DIR="$T/baseline"
mkdir -p "$TEST_BASELINE_DIR"
curl() {
  cat > /dev/null
  local d="" a prev=""; for a in "$@"; do case "$prev" in -d) d="$a" ;; esac; prev="$a"; done
  local t; t="$(printf '%s' "$d" | jq -r '.pointer.type // empty')"
  case "$t" in
    vesselCapability) printf '{"content":{"vessels":[{"vesselId":"v"}]}}' ;;
    posterior) [ "$DOWN" = 1 ] && { printf '{"error":"down"}'; return; }
      jq -c '{at_seq: 1, posts: [], grades: .}' "$TALLY" ;;
    record_read) jq -c --arg s "$(printf '%s' "$d" | jq -r .pointer.shape)" 'map(select(.shape == $s))' "$ROWS" ;;
    record_write)
      local n row; n="$(jq length "$ROWS")"
      row="$(printf '%s' "$d" | jq -c --argjson n "$n" '.pointer as $p | $p.row + {id: ("row-" + ($n | tostring)), seq: ($n + 1), writer: $p.writer, role: $p.role}')"
      jq -c --argjson r "$row" '. + [$r]' "$ROWS" > "$ROWS.new" && mv "$ROWS.new" "$ROWS"; printf '%s' "$row" ;;
    *) printf '{}' ;;
  esac
}
# shellcheck disable=SC1090
source "$T/fns.sh"
tally() { jq -cn --argjson wa "$1" --argjson ca "$2" --argjson wl "$3" --argjson cl "$4" '{written: {answer: $wa, lapse: $wl}, counted: {answer: $ca, lapse: $cl}, refused: {unclean: ($wa - $ca)}}' > "$TALLY"; }
rows() { jq -c '[.[] | select(.shape == "gap")]' "$ROWS"; }
open_now() { dev_resolve '{"impulse":{"pointer":{"type":"substrateGap","status":"open","limit":50}}}' --max-time 5 | jq -r '[.body.gaps[].id] | join(",")'; }
echo '[]' > "$ROWS"

tally 100 90 5 0; grade_check
if [ "$(rows)" = "[]" ] && [ -s "$TEST_BASELINE_DIR/walk-grades.tally" ]; then ok "(a) a first check only keeps the tally"; else bad "(a) rows=$(rows)"; fi

tally 120 90 5 0; grade_check; tally 130 90 5 0; grade_check
if [ "$(rows | jq length)" = 1 ] && [ "$(open_now)" = "pull-sync-walk-grades-uncounted" ] && [ "$(rows | jq -r '.[0].role')" = detector ]; then
  ok "(b) answer grades written, none counted: one open detector gap, written once"
else bad "(b) rows=$(rows)"; fi

tally 140 90 9 4; grade_check
if [ "$(open_now)" = "pull-sync-walk-grades-uncounted" ] && [ "$(rows | jq length)" = 1 ]; then ok "(c) lapses counting does not close it: answer grades still count none"
else bad "(c) open=$(open_now) rows=$(rows)"; fi

tally 150 91 9 4; grade_check
if [ "$(rows | jq -r '.[-1].status')" = closed ] && [ -z "$(open_now)" ]; then ok "(d) an answer grade counted: closed"; else bad "(d) rows=$(rows) open=$(open_now)"; fi

n="$(rows | jq length)"; grade_check
if [ "$(rows | jq length)" = "$n" ]; then ok "(e) nothing written since the last check: nothing written"; else bad "(e) rows=$(rows)"; fi

before="$(cat "$TEST_BASELINE_DIR/walk-grades.tally")"; tally 999 0 0 0; DOWN=1; grade_check; DOWN=0
if [ "$(rows | jq length)" = "$n" ] && [ "$(cat "$TEST_BASELINE_DIR/walk-grades.tally")" = "$before" ]; then ok "(f) a tally that cannot be read writes nothing and keeps the last one"
else bad "(f) rows=$(rows)"; fi

echo; [ "$FAILS" = 0 ] && { echo "PASS - pull-sync files one gap while the walk's answer grades count for nothing, and closes it once one counts"; exit 0; }
echo "$FAILS FAILED"; exit 1
