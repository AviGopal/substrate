#!/usr/bin/env bash
# The glue runner lets a check-first glue test through when, and only when, an OPEN gap tracks
# it (validation/scripts/run-glue-tests.sh --gap-store; the predicate is
# scripts/substrate/lib/gap-tracked-red.sh). Each case builds its own --root under $T holding a
# copy of the runner, the predicate, one or two synthetic *.test.sh files and a fixture store,
# so the real validation/scripts is never re-run from in here. No network, no container.
#
#   (a) a red glue test whose every "FAIL - <label>" an open gap names -> exit 0, TRACKED-RED
#   (b) control: a red glue test no gap names -> refused (exit 1)
#   (b2) control: a tracked file with one more, untracked, red case -> refused
#   (c) the tracked test turning GREEN while its gap is open -> PASS with a can-close note;
#       red -> green -> red is exit 0 on every run (no flapping, no refusal)
#   (d) control: a CLOSED gap naming the case -> refused; a "reopened" one too (only "open" counts)
#   (e) an unreadable store (missing file, not a store, a dead URL) -> refused, said so (fail closed)
#   (f) control: no --gap-store -> refused
#   (g) control: a red test with no "FAIL - " line -> refused (an unnamed failure is never tracked)
#   (h) control: the same label tracked for ANOTHER file or vessel does not exempt this one
#
# usage: validation/scripts/glue-tracked-red.test.sh
# Needs bash, jq, awk, sed, curl.
set -uo pipefail
SRC="$(cd "$(dirname "$0")/../.." && pwd)"
T="$(mktemp -d "${TMPDIR:-/tmp}/glue-tracked-red.XXXXXX")"; trap 'rm -rf "$T"' EXIT
FAILS=0
ok()  { echo "ok   - $*"; }
bad() { echo "FAIL - $*"; FAILS=$((FAILS+1)); }

# A synthetic glue test: red with the given labels while $T/<name>.red exists, green otherwise.
synth() { # name label... -> $R/validation/scripts/<name>.test.sh
  local n="$1"; shift
  { echo '#!/usr/bin/env bash'
    echo "if [ -e '$T/$n.red' ]; then"
    for l in "$@"; do printf '  echo %q\n' "FAIL - $l"; done
    echo '  exit 1'; echo 'fi'; echo 'echo "ok   - green"; exit 0'
  } > "$R/validation/scripts/$n.test.sh"
}
root() { # case -> fresh $R with the runner and the predicate copied from this tree
  R="$T/root-$1"; mkdir -p "$R/validation/scripts" "$R/scripts/substrate/lib"
  cp "$SRC/validation/scripts/run-glue-tests.sh" "$R/validation/scripts/"
  cp "$SRC/scripts/substrate/lib/gap-tracked-red.sh" "$R/scripts/substrate/lib/"
}
run() { # args... -> RC, output in $T/out.txt
  bash "$R/validation/scripts/run-glue-tests.sh" --root "$R" --log-dir "$R/logs" "$@" > "$T/out.txt" 2>&1; RC=$?
}
show() { sed 's/^/    /' "$T/out.txt" | tail -8; }
LABEL='check-first: the predicate is shared'

# The fixture store: a flat array like gaps/gaps.json, with the rows the live store really has
# (a string classification_metadata, a non-object row, statuses other than "open").
gap() { # id status vessel test_file label
  jq -n -c --arg id "$1" --arg s "$2" --arg v "$3" --arg f "$4" --arg l "$5" \
    '{id:$id, status:$s, classification_metadata:{evidence_resolve:{shape:"test_suite", input:{vessel:$v, test_file:$f, only_tests:[$l]}}}}'
}
{
  echo '['
  gap g-open open super-repo validation/scripts/check-first.test.sh "$LABEL"; echo ','
  gap g-closed closed super-repo validation/scripts/closed-named.test.sh "closed case"; echo ','
  gap g-reopened reopened super-repo validation/scripts/reopened-named.test.sh "reopened case"; echo ','
  gap g-other-file open super-repo validation/scripts/elsewhere.test.sh "shared label"; echo ','
  gap g-other-vessel open activity-api validation/scripts/scoped.test.sh "shared label"; echo ','
  echo '{"id":"g-string-meta","status":"open","classification_metadata":"free text"},'
  echo '"not-a-gap-row"'
  echo ']'
} > "$T/store.json"
jq -e 'length == 7' "$T/store.json" >/dev/null || { echo "FAIL - fixture store does not parse"; exit 1; }

# ── (a) tracked red is let through ─────────────────────────────────────────────
root a; synth check-first "$LABEL"; touch "$T/check-first.red"
run --gap-store "$T/store.json"
[ "$RC" = 0 ] && ok "(a) a red glue test tracked by an open gap: exit 0" || { bad "(a) tracked red refused (exit $RC)"; show; }
grep -q "^TRACKED-RED .*check-first.test.sh .*check-first.test.sh::$LABEL" "$T/out.txt" \
  && ok "(a) reported TRACKED-RED as <file>::<label>" || { bad "(a) no TRACKED-RED line naming the case"; show; }
grep -q '1 tracked-red' "$T/out.txt" && ok "(a) counted as tracked-red in the summary" || bad "(a) summary does not count it"
grep -qE '^(FAIL|failed:)' "$T/out.txt" && bad "(a) a line the hook reads as a failure was printed" || ok "(a) nothing the hook greps as a failure"

# ── (b) untracked red is refused ───────────────────────────────────────────────
root b; synth untracked "nobody files this"; touch "$T/untracked.red"
run --gap-store "$T/store.json"
[ "$RC" = 1 ] && grep -q '^FAIL .*untracked.test.sh.*not tracked by an open gap: untracked.test.sh::nobody files this' "$T/out.txt" \
  && ok "(b) an untracked red glue test is refused, named" || { bad "(b) untracked red: exit $RC"; show; }

# ── (b2) a tracked file with an extra untracked case ──────────────────────────
root b2; synth check-first "$LABEL" "a regression in the same file"
run --gap-store "$T/store.json"
[ "$RC" = 1 ] && grep -q 'check-first.test.sh::a regression in the same file' "$T/out.txt" \
  && ok "(b2) one untracked case in a tracked file is refused" || { bad "(b2) exit $RC"; show; }

# ── (c) red -> green -> red while the gap stays open: no flap, no refusal ─────
root c; synth check-first "$LABEL"
C_RCS=""
for state in red green red; do
  if [ "$state" = red ]; then touch "$T/check-first.red"; else rm -f "$T/check-first.red"; fi
  run --gap-store "$T/store.json"; C_RCS="$C_RCS $RC"
  if [ "$state" = green ]; then
    grep -q '^PASS .*check-first.test.sh.*tracked by an open gap and now green' "$T/out.txt" \
      && ok "(c) green while its gap is open: PASS, noted as closable" || { bad "(c) green run did not pass with the note"; show; }
  fi
done
[ "$C_RCS" = " 0 0 0" ] && ok "(c) red, green, red: exit 0 every time" || bad "(c) exits were:$C_RCS"

# ── (d) only OPEN gaps exempt ──────────────────────────────────────────────────
root d; synth closed-named "closed case"; synth reopened-named "reopened case"
touch "$T/closed-named.red" "$T/reopened-named.red"
run --gap-store "$T/store.json"
[ "$RC" = 1 ] && grep -q '^FAIL .*closed-named.test.sh' "$T/out.txt" \
  && ok "(d) a closed gap naming the case does not exempt it" || { bad "(d) closed gap exempted (exit $RC)"; show; }
grep -q '^FAIL .*reopened-named.test.sh' "$T/out.txt" \
  && ok "(d) a 'reopened' status is not 'open' either" || { bad "(d) reopened gap exempted"; show; }

# ── (e) unreadable store: fail closed ─────────────────────────────────────────
root e; synth check-first "$LABEL"; touch "$T/check-first.red"
echo '{"shape":"somethingElse","body":{}}' > "$T/not-a-store.json"
for src in "$T/missing.json" "$T/not-a-store.json" "http://127.0.0.1:9/nothing-listens"; do
  GTR_MAX_TIME=3 run --gap-store "$src"
  [ "$RC" = 1 ] && grep -q '^FAIL .*check-first.test.sh.*gap store unreadable' "$T/out.txt" \
    && ok "(e) unreadable store ($src): refused, and said so" || { bad "(e) $src: exit $RC"; show; }
done

# ── (f) no store given ─────────────────────────────────────────────────────────
root f; synth check-first "$LABEL"; touch "$T/check-first.red"
run
[ "$RC" = 1 ] && grep -q 'not exempt: no --gap-store' "$T/out.txt" && ok "(f) no --gap-store: refused" || { bad "(f) exit $RC"; show; }

# ── (g) a red test that names no case ──────────────────────────────────────────
root g; printf '#!/usr/bin/env bash\necho "something broke"\nexit 1\n' > "$R/validation/scripts/check-first.test.sh"
run --gap-store "$T/store.json"
[ "$RC" = 1 ] && grep -q "no 'FAIL - <label>' line" "$T/out.txt" && ok "(g) an unnamed failure is refused" || { bad "(g) exit $RC"; show; }

# ── (h) the label is scoped by file and vessel ─────────────────────────────────
root h; synth scoped "shared label"; touch "$T/scoped.red"
run --gap-store "$T/store.json"
[ "$RC" = 1 ] && ok "(h) a label tracked for another file / vessel does not exempt this file" || { bad "(h) exit $RC"; show; }

echo; [ "$FAILS" = 0 ] && { echo "PASS"; exit 0; } || { echo "$FAILS FAILED"; exit 1; }
