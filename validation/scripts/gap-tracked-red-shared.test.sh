#!/usr/bin/env bash
# pull-sync's test gate and the glue runner reach ONE tracked-red predicate
# (scripts/substrate/lib/gap-tracked-red.sh), not two copies that can drift. Proven by effect:
# copies of pull-sync, the runner and the predicate go under $T; pull-sync's own loader block is
# extracted from its copy (as the other pull-sync tests extract their slices) and the runner runs
# on a root holding one synthetic check-first test. Editing ONLY the copied predicate then flips
# BOTH verdicts. No network, no container.
#
#   (a) both callers exempt their tracked red against the same fixture store
#   (b) the predicate's open-status filters edited (the store's, read by the runner; the person-marked one, read
#       by pull-sync) -> both stop exempting
#   (c) the predicate's name matcher edited -> both stop exempting
#   (d) the predicate absent -> both fail closed (pull-sync tracks nothing; the runner refuses)
#   (e) pull-sync finds the image's copy under PULLSYNC_SHARE_DIR/lib when none is beside it
#   (f) neither caller carries its own copy: the jq selector and the awk matcher live only in the lib
#   (g) pull-sync reads the gaps from records by shape and exempts only a person-marked one (USER ruling 11-23,
#       check-first reds exempt only by a person-marked gap): the same open gap with no person verdict, or with a
#       person's r 0, exempts nothing there [MUST-FAIL: the parent exempted it]. The runner still reads --gap-store
#       and exempts any open gap named; whether the ruling covers it is not settled, so this test states the split.
#
# usage: validation/scripts/gap-tracked-red-shared.test.sh
# Needs bash, jq, awk, sed.
set -uo pipefail
SRC="$(cd "$(dirname "$0")/../.." && pwd)"
T="$(mktemp -d "${TMPDIR:-/tmp}/gtr-shared.XXXXXX")"; trap 'rm -rf "$T"' EXIT
FAILS=0
ok()  { echo "ok   - $*"; }
bad() { echo "FAIL - $*"; FAILS=$((FAILS+1)); }
LIB_REL=scripts/substrate/lib/gap-tracked-red.sh
LABEL='check-first: shared'

jq -n -c --arg l "$LABEL" '[
  {id:"g-bun", status:"open", classification_metadata:{evidence_resolve:{shape:"test_suite",
     input:{vessel:"repos/demo-vessel", test_file:"test/x.test.ts", only_tests:["broke"]}}}},
  {id:"g-glue", status:"open", classification_metadata:{evidence_resolve:{shape:"test_suite",
     input:{vessel:"super-repo", test_file:"validation/scripts/check-first.test.sh", only_tests:[$l]}}}}
]' > "$T/store.json"
# the same gaps as records holds them (rows of shape gap, role detector), and a person's verdict citing each
jq -c '[to_entries[] | {shape: "gap", role: "detector", gap_id: .value.id, id: ("row-" + (.key | tostring)), seq: (.key + 1),
  status: .value.status, meta: .value.classification_metadata}]' "$T/store.json" > "$T/gaps.rows.json"
jq -c '[.[] | {shape: "outcome", role: "person", r: 1, id: ("pm-" + .id), seq: (.seq + 10), input_refs: [.id]}]' "$T/gaps.rows.json" > "$T/marks.json"

fresh() { # -> $R: copies of pull-sync, the runner, the predicate, and one red check-first test
  R="$T/root"; rm -rf "$R"; mkdir -p "$R/scripts/substrate/lib" "$R/validation/scripts"
  cp "$SRC/scripts/substrate/substrate-pull-sync.sh" "$R/scripts/substrate/"
  cp "$SRC/$LIB_REL" "$R/$LIB_REL"
  cp "$SRC/validation/scripts/run-glue-tests.sh" "$R/validation/scripts/"
  printf '#!/usr/bin/env bash\necho %q\nexit 1\n' "FAIL - $LABEL" > "$R/validation/scripts/check-first.test.sh"
}
# pull-sync's verdict: run its own loader block (from the copy) and its gate's two calls.
pullsync_verdict() { # [share dir] [person outcomes file] -> "tracked:<lines>" from the copied pull-sync's loader
  local outs="${2:-$T/marks.json}"
  sed -n '/^# >>> gap-tracked-red loader$/,/^# <<< gap-tracked-red loader$/p' "$R/scripts/substrate/substrate-pull-sync.sh" > "$T/loader.sh"
  grep -q '^tracked_fail_names()\|tracked_fail_names() {' "$T/loader.sh" || { echo "NO-LOADER"; return; }
  ( PULLSYNC_SELF_DIR="$R/scripts/substrate" PULLSYNC_SHARE_DIR="${1:-$T/no-share}" DEV_VESSEL="$T/store.json"
    # shellcheck disable=SC1090
    . "$T/loader.sh" 2>/dev/null
    # records, as discovery would route it: the rows of the asked shape
    dev_resolve() { case "$(printf '%s' "$1" | jq -r '.impulse.pointer.shape')" in gap) cat "$T/gaps.rows.json" ;; outcome) cat "$outs" ;; *) echo '[]' ;; esac; }
    TRACKED="$(tracked_fail_names demo-vessel "$(printf 'src/a.ts\ntest/x.test.ts')" 2>/dev/null)"
    CONF_SET="$(printf '(fail) new > broke\n(fail) other > untouched')"
    if [ -n "$TRACKED" ]; then echo "tracked:$(gtr_select tracked "$TRACKED" "$CONF_SET" | tr '\n' ';')"; else echo "tracked:"; fi )
}
runner_verdict() { # -> the runner's exit code on the copied root
  bash "$R/validation/scripts/run-glue-tests.sh" --root "$R" --log-dir "$T/logs" --gap-store "$T/store.json" > "$T/out.txt" 2>&1
  echo $?
}

# ── (a) the unmodified predicate: both exempt ──────────────────────────────────
fresh
P="$(pullsync_verdict)"; G="$(runner_verdict)"
[ "$P" = "tracked:(fail) new > broke;" ] && ok "(a) pull-sync subtracts its tracked name" || bad "(a) pull-sync verdict: '$P'"
[ "$G" = 0 ] && ok "(a) the runner lets its tracked red through" || { bad "(a) runner exit $G"; sed 's/^/    /' "$T/out.txt" | tail -5; }

# ── (b) edit ONLY the copied predicate's status filter ────────────────────────
fresh; sed -i 's/\.status? == "open"/.status? == "never-open"/; s/\$g\.status == "open"/$g.status == "never-open"/' "$R/$LIB_REL"
[ "$(grep -c 'never-open' "$R/$LIB_REL")" = 2 ] || bad "(b) the mutations did not both apply"
P="$(pullsync_verdict)"; G="$(runner_verdict)"
[ "$P" = "tracked:" ] && ok "(b) status filter edited in the lib: pull-sync stops exempting" || bad "(b) pull-sync verdict: '$P'"
[ "$G" = 1 ] && ok "(b) ... and the runner refuses" || bad "(b) runner exit $G"

# ── (c) edit ONLY the copied predicate's name matcher ─────────────────────────
fresh; sed -i 's/if(hit==want) print/if(want==0) print/' "$R/$LIB_REL"
grep -q 'if(want==0) print' "$R/$LIB_REL" || bad "(c) the mutation did not apply"
P="$(pullsync_verdict)"; G="$(runner_verdict)"
[ "$P" = "tracked:" ] && ok "(c) matcher edited in the lib: pull-sync matches nothing" || bad "(c) pull-sync verdict: '$P'"
[ "$G" = 1 ] && ok "(c) ... and the runner refuses" || bad "(c) runner exit $G"

# ── (d) the predicate absent: both fail closed ────────────────────────────────
fresh; rm -f "$R/$LIB_REL"
P="$(pullsync_verdict)"; G="$(runner_verdict)"
[ "$P" = "tracked:" ] && ok "(d) no predicate: pull-sync tracks nothing (stricter gate)" || bad "(d) pull-sync verdict: '$P'"
[ "$G" = 1 ] && grep -q 'gap store unreadable\|not exempt' "$T/out.txt" && ok "(d) no predicate: the runner refuses" || bad "(d) runner exit $G"

# ── (e) the image layout: the lib under PULLSYNC_SHARE_DIR/lib ─────────────────
fresh; mkdir -p "$T/share/lib"; mv "$R/$LIB_REL" "$T/share/lib/gap-tracked-red.sh"
P="$(pullsync_verdict "$T/share")"
[ "$P" = "tracked:(fail) new > broke;" ] && ok "(e) pull-sync loads the share-dir copy when none is beside it" || bad "(e) pull-sync verdict: '$P'"

# ── (f) no second copy in either caller ───────────────────────────────────────
PS="$SRC/scripts/substrate/substrate-pull-sync.sh"; RG="$SRC/validation/scripts/run-glue-tests.sh"
for f in "$PS" "$RG"; do
  grep -q 'substr($0,length($0)-length(T\[i\])-2)' "$f" && bad "(f) $(basename "$f") carries its own name matcher" || ok "(f) $(basename "$f") has no matcher of its own"
  grep -q 'select(type == "string" and test(' "$f" && bad "(f) $(basename "$f") carries its own only_tests selector" || ok "(f) $(basename "$f") has no only_tests selector of its own"
done
grep -q 'gtr_select tracked "\$TRACKED"' "$PS" && grep -q 'gtr_select untracked "\$TRACKED"' "$PS" \
  && ok "(f) pull-sync's test gate calls gtr_select" || bad "(f) pull-sync's test gate does not call gtr_select"
grep -q '\. "\$ROOT/scripts/substrate/lib/gap-tracked-red.sh"' "$RG" && ok "(f) the runner sources the lib under --root" || bad "(f) the runner does not source the lib"

# ── (g) pull-sync: only a person-marked gap exempts ────────────────────────────
fresh; echo '[]' > "$T/none.json"
jq -c 'map(.r = 0)' "$T/marks.json" > "$T/wrong.json"
P="$(pullsync_verdict "" "$T/none.json")"
[ "$P" = "tracked:" ] && ok "(g) [MUST-FAIL] an open gap no person marked: pull-sync exempts nothing" || bad "(g) unmarked: pull-sync verdict: '$P'"
P="$(pullsync_verdict "" "$T/wrong.json")"
[ "$P" = "tracked:" ] && ok "(g) [MUST-FAIL] a person's r 0 (the test is wrong): pull-sync exempts nothing" || bad "(g) r 0: pull-sync verdict: '$P'"
G="$(runner_verdict)"
[ "$G" = 0 ] && ok "(g) the runner, reading --gap-store, still lets the open gap's red through (the split stated above)" || bad "(g) runner exit $G"

echo; [ "$FAILS" = 0 ] && { echo "PASS"; exit 0; } || { echo "$FAILS FAILED"; exit 1; }
