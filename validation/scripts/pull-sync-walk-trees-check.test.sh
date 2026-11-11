#!/usr/bin/env bash
# pull-sync's walk-trees detector (scripts/substrate/substrate-pull-sync.sh walk_trees_check): one gap while more than
# the threshold of change clones sit under the clones directory, closed once under; one notice to the person when the
# count keeps rising with the gap open. Runs the script's own functions with curl stubbed as discovery in front of an
# in-memory records store and a notice sink.
#   (a) at or under the threshold, nothing is written;
#   (b) over it, one detector gap row, open; the same count again writes nothing more;
#   (c) rising over <ticks> checks with the gap open: one notice of kind notice; a later check sends no second one;
#       a count that does not rise sends none;
#   (d) back under the threshold: a closed row, and the gap is no longer open;
#   (e) only whole clones count: not a symlink, a plain directory or a gitfile;
#   (f) a gap store that cannot be read writes nothing.
# usage: validation/scripts/pull-sync-walk-trees-check.test.sh [path/to/substrate-pull-sync.sh]
set -uo pipefail
SCRIPT="${1:-$(cd "$(dirname "$0")/../.." && pwd)/scripts/substrate/substrate-pull-sync.sh}"
T="$(mktemp -d)"; trap 'rm -rf "$T"' EXIT
FAILS=0
ok()  { echo "ok   - $*"; }
bad() { echo "FAIL - $*"; FAILS=$((FAILS+1)); }
{
  for f in shape_route gap_resolve dev_resolve emit_gap walk_trees_check; do sed -n "/^$f() {/,/^}/p" "$SCRIPT"; done
} > "$T/fns.sh"
grep -q '^walk_trees_check()' "$T/fns.sh" || { echo "FAIL - could not extract walk_trees_check"; exit 1; }
LOG="$T/log.txt"; log() { echo "$*" >> "$LOG"; }
ROWS="$T/rows.json"; NOTICES="$T/notices.txt"
DISCOVERY=http://discovery.test; SHAPE_ROUTES=" "; SR_ROUTE=""; DEV_VESSEL=""; READ_FAILS=0
export METABOB_API_KEY="" TEST_BASELINE_DIR="$T/baseline" WALK_TREES_DIR="$T/trees"
mkdir -p "$TEST_BASELINE_DIR" "$WALK_TREES_DIR"
curl() {
  cat > /dev/null
  local d="" a prev=""; for a in "$@"; do case "$prev" in -d) d="$a" ;; esac; prev="$a"; done
  local t; t="$(printf '%s' "$d" | jq -r '.pointer.type // empty')"
  case "$t" in
    vesselCapability) printf '{"content":{"vessels":[{"vesselId":"v"}]}}' ;;
    record_read) [ "$READ_FAILS" = 1 ] && { printf '{"error":"down"}'; return; }
      jq -c --arg s "$(printf '%s' "$d" | jq -r .pointer.shape)" 'map(select(.shape == $s))' "$ROWS" ;;
    record_write)
      local n row; n="$(jq length "$ROWS")"
      row="$(printf '%s' "$d" | jq -c --argjson n "$n" '.pointer as $p | $p.row + {id: ("row-" + ($n | tostring)), seq: ($n + 1), writer: $p.writer, role: $p.role}')"
      jq -c --argjson r "$row" '. + [$r]' "$ROWS" > "$ROWS.new" && mv "$ROWS.new" "$ROWS"; printf '%s' "$row" ;;
    uiQuestion_write) printf '%s\n' "$d" >> "$NOTICES"; printf '{"ok":true}' ;;
    *) printf '{}' ;;
  esac
}
# shellcheck disable=SC1090
source "$T/fns.sh"
clones() { local i; for i in $(seq 1 "$1"); do [ -d "$WALK_TREES_DIR/c$i/.git" ] || mkdir -p "$WALK_TREES_DIR/c$i/.git"; done; }
reset() { rm -rf "$WALK_TREES_DIR" "$TEST_BASELINE_DIR"; mkdir -p "$WALK_TREES_DIR" "$TEST_BASELINE_DIR"; echo '[]' > "$ROWS"; : > "$NOTICES"; : > "$LOG"; }
rows() { jq -c '[.[] | select(.shape == "gap")]' "$ROWS"; }
open_now() { dev_resolve '{"impulse":{"pointer":{"type":"substrateGap","status":"open","limit":50}}}' --max-time 5 | jq -r '[.body.gaps[].id] | join(",")'; }

reset; clones 3; walk_trees_check 3 3
if [ "$(rows)" = "[]" ] && [ ! -s "$NOTICES" ]; then ok "(a) at the threshold, nothing is written"; else bad "(a) rows=$(rows)"; fi

reset; clones 4; walk_trees_check 3 3; walk_trees_check 3 3
if [ "$(rows | jq length)" = 1 ] && [ "$(rows | jq -r '.[0].role + "/" + .[0].status')" = "detector/open" ] && [ "$(open_now)" = "pull-sync-walk-trees-unreclaimed" ]; then
  ok "(b) over the threshold: one detector gap row, open; the same count again writes nothing more"
else bad "(b) rows=$(rows)"; fi
if [ ! -s "$NOTICES" ]; then ok "(c) a count that does not rise sends no notice"; else bad "(c) flat count sent: $(cat "$NOTICES")"; fi

reset; clones 4; walk_trees_check 3 3; clones 5; walk_trees_check 3 3; clones 6; walk_trees_check 3 3; clones 7; walk_trees_check 3 3
if [ "$(wc -l < "$NOTICES")" = 1 ] && [ "$(jq -r '.pointer.kind' "$NOTICES")" = notice ] && jq -e '.pointer.body | contains("6 clones")' "$NOTICES" >/dev/null; then
  ok "(c) rising over 3 checks with the gap open: one notice, of kind notice; the next check sends no second one"
else bad "(c) notices=$(cat "$NOTICES")"; fi

rm -rf "$WALK_TREES_DIR"/c4 "$WALK_TREES_DIR"/c5 "$WALK_TREES_DIR"/c6 "$WALK_TREES_DIR"/c7; walk_trees_check 3 3
if [ "$(rows | jq -r '.[-1].status')" = closed ] && [ -z "$(open_now)" ] && [ ! -e "$TEST_BASELINE_DIR/walk-trees.counts" ]; then
  ok "(d) back at the threshold: a closed row, the gap no longer open, the count history cleared"
else bad "(d) rows=$(rows) open=$(open_now)"; fi

reset; clones 3; mkdir -p "$T/elsewhere/.git" "$WALK_TREES_DIR/plain" "$WALK_TREES_DIR/gitfile"; ln -s "$T/elsewhere" "$WALK_TREES_DIR/link"
echo "gitdir: $T/elsewhere/.git" > "$WALK_TREES_DIR/gitfile/.git"; walk_trees_check 3 3
if [ "$(rows)" = "[]" ]; then ok "(e) a symlink, a plain directory and a gitfile are not counted as clones"; else bad "(e) rows=$(rows)"; fi

reset; clones 9; READ_FAILS=1; walk_trees_check 3 3; READ_FAILS=0
if [ "$(rows)" = "[]" ] && [ ! -s "$NOTICES" ]; then ok "(f) a gap store that cannot be read writes nothing"; else bad "(f) rows=$(rows)"; fi

echo; [ "$FAILS" = 0 ] && { echo "PASS - pull-sync files one gap while the walk's clones pile up, tells the person once if they keep rising, and closes it once under"; exit 0; }
echo "$FAILS FAILED"; exit 1
