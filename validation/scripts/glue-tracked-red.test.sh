#!/usr/bin/env bash
# The glue runner lets a check-first glue test through when, and only when, an OPEN gap a person
# filed or marked tracks it (validation/scripts/run-glue-tests.sh --gap-store; the predicate is
# scripts/substrate/lib/gap-tracked-red.sh, read from records' rows as pull-sync's gate reads them:
# USER ruling 11-23, check-first reds exempt only by a person-marked gap, the glue runner by the same rule). Each case builds its own --root under $T holding a
# copy of the runner, the predicate, one or two synthetic *.test.sh files and a fixture store,
# so the real validation/scripts is never re-run from in here. No network, no container.
#
#   (a) a red glue test whose every "FAIL - <label>" an open gap a person filed names -> exit 0, TRACKED-RED
#   (b) control: a red glue test no gap names -> refused (exit 1)
#   (b2) control: a tracked file with one more, untracked, red case -> refused
#   (c) the tracked test turning GREEN while its gap is open -> PASS with a can-close note;
#       red -> green -> red is exit 0 on every run (no flapping, no refusal)
#   (d) control: a CLOSED gap naming the case -> refused; a "reopened" one too (only "open" counts)
#   (e) an unreadable source (missing file, not the two lists, a dead URL) -> refused, said so (fail closed)
#   (f) control: no --gap-store -> refused
#   (g) control: a red test with no "FAIL - " line -> refused (an unnamed failure is never tracked)
#   (h) control: the same label tracked for ANOTHER file or vessel does not exempt this one
#   (i) --gap-store client-config, no pinned default:
#       must fail  no client config -> refused, naming the missing config
#       must fail  a config without .metabob.discoveryEndpoint -> refused, naming the field; a config
#                  naming only the retired .substrate.gapStoreEndpoint is refused the same way
#       control    a config naming a fixture discovery -> allowed (and the source is named)
#       control    METABOB_CONFIG_PATH and ./.metabob/config.json take precedence over ~/.metabob
#   (j) a detector's open gap naming the case exempts nothing alone [the ruling]; with a person's
#       r 1 on its row it exempts [MUST-FAIL]
#   (k) rows read with no gap a person filed or marked: the source is read (not "unreadable"), a
#       red is "not tracked", a green run passes [MUST-FAIL]
#   (l) pull-sync's tracked_fail_names and the runner's loader, given the same rows, name the same
#       tests for every file: the two checks agree
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

# The fixture: records' rows as {"gap": [...], "outcome": [...]}, the form gtr_load_marked reads from
# a file: gaps a person filed (statuses other than "open" among them, and one whose meta is free text),
# a detector's gap with no verdict, and a detector's gap a person marked right.
prow() { # gap_id status vessel test_file label [role] [row id] [seq]
  jq -n -c --arg g "$1" --arg s "$2" --arg v "$3" --arg f "$4" --arg l "$5" --arg r "${6:-person}" --arg id "${7:-r-$1}" --argjson q "${8:-1}" \
    '{shape:"gap", role:$r, gap_id:$g, id:$id, seq:$q, status:$s,
      meta:{evidence_resolve:{shape:"test_suite", input:{vessel:$v, test_file:$f, only_tests:[$l]}}}}'
}
{
  prow g-open open super-repo validation/scripts/check-first.test.sh "$LABEL"
  prow g-closed closed super-repo validation/scripts/closed-named.test.sh "closed case"
  prow g-reopened reopened super-repo validation/scripts/reopened-named.test.sh "reopened case"
  prow g-other-file open super-repo validation/scripts/elsewhere.test.sh "shared label"
  prow g-other-vessel open activity-api validation/scripts/scoped.test.sh "shared label"
  echo '{"shape":"gap","role":"person","gap_id":"g-string-meta","id":"r-sm","seq":1,"status":"open","meta":"free text"}'
  prow g-detector open super-repo validation/scripts/detector-only.test.sh "detector case" detector
  prow g-marked open super-repo validation/scripts/marked.test.sh "marked case" detector r-m 2
} | jq -s -c '{gap: ., outcome: [{shape:"outcome", role:"person", r:1, id:"o-m", seq:3, input_refs:["r-m"]}]}' > "$T/store.json"
jq -e '(.gap | length) == 8' "$T/store.json" >/dev/null || { echo "FAIL - fixture store does not parse"; exit 1; }
jq -c '{gap: [.gap[] | select(.role == "detector")], outcome: []}' "$T/store.json" > "$T/unmarked.json"

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
[ "$RC" = 1 ] && grep -q '^FAIL .*untracked.test.sh.*not tracked by an open gap a person filed or marked: untracked.test.sh::nobody files this' "$T/out.txt" \
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
echo '[{"id":"g-open","status":"open"}]' > "$T/not-a-store.json"
for src in "$T/missing.json" "$T/not-a-store.json" "http://127.0.0.1:9/nothing-listens"; do
  GTR_MAX_TIME=3 run --gap-store "$src"
  [ "$RC" = 1 ] && grep -q '^FAIL .*check-first.test.sh.*gap store unreadable' "$T/out.txt" \
    && ok "(e) unreadable source ($src): refused, and said so" || { bad "(e) $src: exit $RC"; show; }
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

# ── (i) client-config resolution ───────────────────────────────────────────────
# The fixture discovery: a curl on PATH that answers <fixture.invalid>/resolve only, with the gap rows
# or the person outcomes by the shape its -d pointer reads (wrapped, as discovery passes a producer's).
mkdir -p "$T/fx" "$T/home" "$T/cwd"
jq -c '{content: .gap}' "$T/store.json" > "$T/resp-gap.json"; jq -c '{content: .outcome}' "$T/store.json" > "$T/resp-outcome.json"
cat > "$T/fx/curl" <<STUB
#!/usr/bin/env bash
url=""; sh=outcome; prev=""; w=""
for a in "\$@"; do
  case "\$a" in http://fixture.invalid/resolve) url=1 ;; esac
  [ "\$prev" = "-d" ] && case "\$a" in *'"shape":"gap"'*) sh=gap ;; esac
  [ "\$prev" = "-w" ] && w="\$a"
  [ "\$prev" = "-K" ] && [ "\$a" = "-" ] && cat >/dev/null
  prev="\$a"
done
[ -n "\$url" ] || exit 7
cat "$T/resp-\$sh.json"; [ -n "\$w" ] && printf '%b' "\${w//%\{http_code\}/200}"
exit 0
STUB
chmod +x "$T/fx/curl"
crun() { # [VAR=value ...] -> RC, output in $T/out.txt; runs from $T/cwd with HOME=$T/home
  ( cd "$T/cwd" && env -u METABOB_CONFIG_PATH HOME="$T/home" PATH="$T/fx:$PATH" "$@" \
      bash "$R/validation/scripts/run-glue-tests.sh" --root "$R" --log-dir "$R/logs" --gap-store client-config ) > "$T/out.txt" 2>&1; RC=$?
}
cfg() { jq -n --arg g "$2" '{metabob:({endpoint:"http://trace.invalid",apiKey:"not-a-key"} + (if $g == "" then {} else {discoveryEndpoint:$g} end))}' > "$1"; }
root i; synth check-first "$LABEL"; touch "$T/check-first.red"
crun
[ "$RC" = 1 ] && grep -q "not exempt: no client config: $T/home/.metabob/config.json is absent" "$T/out.txt" \
  && ok "(i) no client config: refused, naming the missing config" || { bad "(i) no config: exit $RC"; show; }
mkdir -p "$T/home/.metabob"; cfg "$T/home/.metabob/config.json" ""
crun
[ "$RC" = 1 ] && grep -q "names no .metabob.discoveryEndpoint" "$T/out.txt" && ok "(i) a config without the field: refused, naming the field" || { bad "(i) no field: exit $RC"; show; }
jq -n '{metabob:{endpoint:"http://trace.invalid",apiKey:"not-a-key"}, substrate:{gapStoreEndpoint:"http://fixture.invalid"}}' > "$T/home/.metabob/config.json"
crun
[ "$RC" = 1 ] && grep -q "names no .metabob.discoveryEndpoint" "$T/out.txt" \
  && ok "(i) [MUST-FAIL] a config naming only the retired gap store: refused, naming the field" || { bad "(i) retired field: exit $RC"; show; }
cfg "$T/home/.metabob/config.json" http://fixture.invalid
crun
[ "$RC" = 0 ] && grep -q '^TRACKED-RED .*check-first.test.sh' "$T/out.txt" \
  && grep -qF "open gaps a person filed or marked, read from http://fixture.invalid (from client config $T/home/.metabob/config.json)" "$T/out.txt" \
  && ok "(i) [MUST-FAIL] a config naming a fixture discovery: allowed, source named" || { bad "(i) config with field: exit $RC"; show; }
cfg "$T/home/.metabob/config.json" ""; cfg "$T/alt.json" http://fixture.invalid
crun METABOB_CONFIG_PATH="$T/alt.json"
[ "$RC" = 0 ] && grep -qF "(from client config $T/alt.json)" "$T/out.txt" && ok "(i) METABOB_CONFIG_PATH takes precedence" || { bad "(i) METABOB_CONFIG_PATH: exit $RC"; show; }
mkdir -p "$T/cwd/.metabob"; cfg "$T/cwd/.metabob/config.json" http://fixture.invalid
crun
[ "$RC" = 0 ] && grep -qF "(from client config $T/cwd/.metabob/config.json)" "$T/out.txt" && ok "(i) ./.metabob/config.json shadows ~/.metabob" || { bad "(i) ./.metabob: exit $RC"; show; }
rm -rf "$T/cwd/.metabob" "$T/home/.metabob"

# ── (j) a detector's gap needs a person ────────────────────────────────────────
root j; synth detector-only "detector case"; touch "$T/detector-only.red"
run --gap-store "$T/store.json"
[ "$RC" = 1 ] && grep -q '^FAIL .*detector-only.test.sh.*not tracked by an open gap a person filed or marked' "$T/out.txt" \
  && ok "(j) a detector's open gap with no person's verdict does not exempt" || { bad "(j) unmarked detector gap: exit $RC"; show; }
root j2; synth marked "marked case"; touch "$T/marked.red"
run --gap-store "$T/store.json"
[ "$RC" = 0 ] && grep -q '^TRACKED-RED .*marked.test.sh' "$T/out.txt" \
  && ok "(j) [MUST-FAIL] a detector's open gap a person marked right exempts" || { bad "(j) marked detector gap: exit $RC"; show; }

# ── (k) nothing marked is a read, not an unreadable source ─────────────────────
root k; synth check-first "$LABEL"; touch "$T/check-first.red"
run --gap-store "$T/unmarked.json"
[ "$RC" = 1 ] && grep -q '^FAIL .*check-first.test.sh.*not tracked by an open gap a person filed or marked' "$T/out.txt" \
  && ! grep -q 'gap store unreadable' "$T/out.txt" \
  && ok "(k) [MUST-FAIL] rows with nothing marked: the red is not tracked, the source is not unreadable" || { bad "(k) nothing marked: exit $RC"; show; }
rm -f "$T/check-first.red"
run --gap-store "$T/unmarked.json"
[ "$RC" = 0 ] && grep -q 'tracked-red exemptions: open gaps a person filed or marked, read from' "$T/out.txt" \
  && ok "(k) [MUST-FAIL] rows with nothing marked, every test green: exit 0, the source named as read" || { bad "(k) green: exit $RC"; show; }

# ── (l) the two checks agree ───────────────────────────────────────────────────
PS="$SRC/scripts/substrate/substrate-pull-sync.sh"
sed -n '/^# >>> gap-tracked-red loader$/,/^# <<< gap-tracked-red loader$/p' "$PS" > "$T/loader.sh"
grep -q '^tracked_fail_names()' "$T/loader.sh" || bad "(l) could not extract pull-sync's gap-tracked-red loader"
for f in check-first closed-named reopened-named elsewhere scoped detector-only marked; do
  files="$(printf 'src/x.ts\nvalidation/scripts/%s.test.sh' "$f")"
  ps="$( ( PULLSYNC_SELF_DIR="$SRC/scripts/substrate"; PULLSYNC_SHARE_DIR="$T/no-share"; DEV_VESSEL=""
          . "$T/loader.sh" >/dev/null 2>&1
          dev_resolve() { case "$1" in *'"shape":"gap"'*) jq -c '.gap' "$T/store.json" ;; *) jq -c '.outcome' "$T/store.json" ;; esac; printf '\n200'; }
          tracked_fail_names super-repo "$files" ) 2>/dev/null)"
  gl="$( ( . "$SRC/scripts/substrate/lib/gap-tracked-red.sh"; gtr_load_marked "$T/store.json" "$T/agree.json" && gtr_tracked_names "$T/agree.json" super-repo "$files" ) 2>/dev/null)"
  [ "$ps" = "$gl" ] && ok "(l) $f: pull-sync and the runner name the same tests ('$gl')" || bad "(l) $f: pull-sync '$ps', runner '$gl'"
done
gl="$( ( . "$SRC/scripts/substrate/lib/gap-tracked-red.sh"; gtr_load_marked "$T/store.json" "$T/agree.json" && gtr_tracked_names "$T/agree.json" super-repo validation/scripts/marked.test.sh ) 2>/dev/null)"
[ "$gl" = "marked case" ] && ok "(l) the comparison is not of two empty answers: a marked gap names its test" || bad "(l) the marked gap named '$gl'"

echo; [ "$FAILS" = 0 ] && { echo "PASS"; exit 0; } || { echo "$FAILS FAILED"; exit 1; }
