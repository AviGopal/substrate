#!/usr/bin/env bash
# A TRACKED RED STAYS TRACKED ACROSS THE WHOLE CONVERGENCE BATCH.
#
# pull-sync's test gate subtracts a newly-failing test when an OPEN gap's evidence_resolve names its test_file
# and title, and the test_file is among the files the candidate changed (scripts/substrate/lib/gap-tracked-red.sh).
# The candidate converges every commit since the last healthy mirror (/workspace/.last-good/<v>), but the gate
# passed only HEAD^..HEAD. Measured 2026-10-07: development-vessel 1fac31bc added B2's four tracked reds, cf99e54b
# (an unrelated test) stacked on it before convergence, and the reds then read as new regressions every tick.
#
# Runs the REAL tracked-red predicate (gtr_tracked_names / gtr_select from the shared lib) on a fixture gap list,
# and the REAL file-set lines extracted from substrate-pull-sync.sh (from the batch-base lines, when present, to the
# TRACKED= line), in a temp repo:  base (the last-good pin) -> c1 adds test/check.test.ts -> c2 touches other.txt.
#   (a) MUST-FAIL: pin = base, the gap names test/check.test.ts  => the red is TRACKED (not a regression)
#   (b) CONTROL:   pin = base, no open gap names it              => still a regression
#   (c) CONTROL:   no pin                                        => HEAD^..HEAD: only other.txt, so a regression
#   (d) CONTROL:   pin not an ancestor of HEAD                   => HEAD^..HEAD, a regression
#   (e) CONTROL:   no pin, the check file changed in HEAD itself  => tracked, as before
#
# usage: validation/scripts/pull-sync-testgate-batch-tracked.test.sh [repo-root]
# Needs bash, git, jq, awk. No root: every path is a temp dir.
set -uo pipefail
ROOT="${1:-$(cd "$(dirname "$0")/../.." && pwd)}"
SCRIPT="$ROOT/scripts/substrate/substrate-pull-sync.sh"
LIB="$ROOT/scripts/substrate/lib/gap-tracked-red.sh"
T="$(mktemp -d)"; trap 'rm -rf "$T"' EXIT
FAILS=0
ok()  { echo "ok   - $*"; }
bad() { echo "FAIL - $*"; FAILS=$((FAILS+1)); }

# shellcheck disable=SC1090
. "$LIB" || { echo "FAIL - cannot source $LIB"; exit 1; }
declare -F gtr_tracked_names gtr_select >/dev/null || { echo "FAIL - the lib does not define gtr_tracked_names/gtr_select"; exit 1; }

# The file-set lines under test: from the batch-base computation (if this revision has it) to the TRACKED= line.
awk '/_tf_base="\$\(cat "\$LAST_GOOD_DIR\/\$v"/ {on=1} /TRACKED="\$\(tracked_fail_names "\$v"/ {print; exit} on {print}' "$SCRIPT" > "$T/slice.sh"
grep -q 'TRACKED="$(tracked_fail_names "$v"' "$T/slice.sh" || { echo "FAIL - could not extract the TRACKED= line from $SCRIPT"; exit 1; }
{ echo 'files_slice() {'; cat "$T/slice.sh"; echo '}'; } > "$T/fns.sh"
# shellcheck disable=SC1090
. "$T/fns.sh"

# tracked_fail_names, minus its network load: the real predicate over a fixture store file.
STORE="$T/store.json"
tracked_fail_names() { gtr_tracked_names "$STORE" "$1" "$2"; }

v=dv; d="$T/clone"; LAST_GOOD_DIR="$T/last-good"; mkdir -p "$d" "$LAST_GOOD_DIR"
g() { git -C "$d" -c user.name=t -c user.email=t@t -c commit.gpgsign=false "$@"; }
g init -q; echo base > "$d/README"; g add -A; g commit -q -m base; BASE=$(g rev-parse HEAD)
mkdir -p "$d/test"; echo 'test("the check", () => { throw new Error("red") })' > "$d/test/check.test.ts"; g add -A; g commit -q -m c1
echo other > "$d/other.txt"; g add -A; g commit -q -m c2; HEAD=$(g rev-parse HEAD)
g checkout -q --orphan side; echo side > "$d/side"; g add -A; g commit -q -m side; SIDE=$(g rev-parse HEAD); g checkout -q "$HEAD" 2>/dev/null

RED='(fail) the suite > the check'
TRACKING='[{"id":"g1","status":"open","classification_metadata":{"evidence_resolve":{"shape":"test_suite","input":{"vessel":"repos/dv","test_file":"test/check.test.ts","only_tests":["the check"]}}}}]'
verdict() { # -> "tracked" or "regression"
  TRACKED=""; files_slice
  [ -n "$(gtr_select tracked "$TRACKED" "$RED")" ] && echo tracked || echo regression
}

echo "$TRACKING" > "$STORE"; echo "$BASE" > "$LAST_GOOD_DIR/$v"
[ "$(verdict)" = tracked ] && ok "(a) pin=base, the check file changed in c1 (not HEAD): the red is tracked" || bad "(a) pin=base, the check file changed in c1 (not HEAD): the red is tracked"

echo '[]' > "$STORE"
[ "$(verdict)" = regression ] && ok "(b) no open gap names the test: still a regression" || bad "(b) no open gap names the test: still a regression"

echo "$TRACKING" > "$STORE"; rm -f "$LAST_GOOD_DIR/$v"
[ "$(verdict)" = regression ] && ok "(c) no pin: HEAD^..HEAD (other.txt only), so a regression" || bad "(c) no pin: HEAD^..HEAD (other.txt only), so a regression"

echo "$SIDE" > "$LAST_GOOD_DIR/$v"
[ "$(verdict)" = regression ] && ok "(d) pin not an ancestor of HEAD: HEAD^..HEAD, a regression" || bad "(d) pin not an ancestor of HEAD: HEAD^..HEAD, a regression"

rm -f "$LAST_GOOD_DIR/$v"; HEAD_SAVE=$HEAD; HEAD=$(g rev-parse HEAD~1)
[ "$(verdict)" = tracked ] && ok "(e) no pin, the check file changed in HEAD itself: tracked, as before" || bad "(e) no pin, the check file changed in HEAD itself: tracked, as before"
HEAD=$HEAD_SAVE

[ "$FAILS" -eq 0 ] && { echo "all ok"; exit 0; } || { echo "$FAILS failed"; exit 1; }
