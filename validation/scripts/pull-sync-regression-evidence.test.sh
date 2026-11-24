#!/usr/bin/env bash
# A test regression's gap says what checks it (scripts/substrate/substrate-pull-sync.sh regression_evidence): the
# vessel's whole suite, naming the tests the gate confirmed newly red, with no test file. Without it the walk's land
# check refuses every change for the gap ("names no test file"), so the gate's own regressions could never be landed.
# Runs the script's own lines: the helper, the two lines that choose the names, and every regression gap it emits,
# with emit_gap stubbed to keep the payload.
#   (a) [MUST-FAIL] the helper turns the gate's "(fail) <name>" lines (and bun's ✗ form, with timings) into bare names,
#       each once; no lines give no names
#   (b) [MUST-FAIL] the names are the confirmed set only when the gate confirmed named reds; otherwise none
#   (c) [MUST-FAIL] every regression gap the gate writes (test-only range, within the bound, escalated) carries the
#       same evidence_resolve, and still parses
#   (d) [GUARD] such a gap exempts nothing at the gate: the exemption needs a test file, and it names none
# usage: validation/scripts/pull-sync-regression-evidence.test.sh [path/to/substrate-pull-sync.sh]
set -uo pipefail
SRC="$(cd "$(dirname "$0")/../.." && pwd)"
SCRIPT="${1:-$SRC/scripts/substrate/substrate-pull-sync.sh}"
T="$(mktemp -d "${TMPDIR:-/tmp}/regev.XXXXXX")"; trap 'rm -rf "${T:?}"' EXIT
FAILS=0
ok()  { echo "ok   - $*"; }
bad() { echo "FAIL - $*"; FAILS=$((FAILS+1)); }
is() { [ "$2" = "$3" ] && ok "$1" || bad "$1: got '$2', want '$3'"; }

sed -n '/^regression_evidence() {/,/^}/p' "$SCRIPT" > "$T/fn.sh"
# shellcheck disable=SC1091
. "$T/fn.sh"
declare -F regression_evidence >/dev/null || bad "the script has no regression_evidence"

# (a)
is "(a) [MUST-FAIL] fail lines become bare names, each once" \
  "$(regression_evidence v $'(fail) add > adds [1.20ms]\n✗ life > keeps zero\n(fail) add > adds\n\n' 2>/dev/null)" \
  '{"shape":"test_suite","input":{"vessel":"v","only_tests":["add > adds","life > keeps zero"]}}'
is "(a) no lines: no names" "$(regression_evidence v "" 2>/dev/null)" '{"shape":"test_suite","input":{"vessel":"v","only_tests":[]}}'

# (b) the script's own lines that choose the names
grep -E '^ *(REG_EVIDENCE=|\[ -n "\$REG_EVIDENCE" \])' "$SCRIPT" > "$T/pick.sh"
[ "$(grep -c . "$T/pick.sh")" = 2 ] || bad "(b) the two lines choosing the names were not found"
pick() { (v=v; CONFIRMED="$1"; CONF_SET="$2"; REG_EVIDENCE=""; . "$T/pick.sh"; printf '%s' "$REG_EVIDENCE" | jq -c '.input.only_tests'); }
is "(b) [MUST-FAIL] confirmed named reds: their names" "$(pick 1 '(fail) add > adds')" '["add > adds"]'
is "(b) none confirmed: no names, whatever the set holds" "$(pick 0 '(fail) add > adds')" '[]'

# (c) every regression gap the script writes, as it writes it
awk '/emit_gap .*pull-sync-test-regression-\$v/ { print; next }
     /emit_gap "\$\(jq -n/ { grab = 1 }
     grab { buf = buf $0 "\n"; if ($0 ~ /2>\/dev\/null\)"$/) { if (buf ~ /pull-sync-test-regression-/) printf "%s", buf; grab = 0; buf = "" } }' "$SCRIPT" > "$T/emits.sh"
EMITS="$(grep -c '^ *emit_gap' "$T/emits.sh")"
is "(c) the script writes the regression gap in three places" "$EMITS" 3
: > "$T/out"
(
  set +u
  emit_gap() { printf '%s\n' "$1" >> "$T/out"; }
  v=demo; HEAD=0123456789abcdef; REG='1 test(s) newly failing, e.g. (fail) add > adds'; RC=2
  REG_EVIDENCE="$(regression_evidence demo $'(fail) add > "adds"')"
  # shellcheck disable=SC1091
  . "$T/emits.sh"
)
is "(c) [MUST-FAIL] each of the three carries the evidence, and parses" \
  "$(jq -c '.impulse.pointer.gap.classification_metadata.evidence_resolve' "$T/out" 2>/dev/null | sort | uniq -c | sed 's/^ *//')" \
  '3 {"shape":"test_suite","input":{"vessel":"demo","only_tests":["add > \"adds\""]}}'

# (d)
. "$SRC/scripts/substrate/lib/gap-tracked-red.sh"
jq -s '[.[] | .impulse.pointer.gap | {id, status: "open", classification_metadata}]' "$T/out" > "$T/gaps.json" 2>/dev/null
is "(d) [GUARD] a regression gap exempts no red at the gate" \
  "$(gtr_tracked_names "$T/gaps.json" demo $'calc.test.ts\nsrc/calc.test.ts' | grep -c .)" 0

echo; [ "$FAILS" = 0 ] && { echo "PASS"; exit 0; } || { echo "$FAILS FAILED"; exit 1; }
