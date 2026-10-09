#!/usr/bin/env bash
# A 401 from the gap store is an ENVIRONMENT fault (a stale or wrong node key), not a test verdict.
#
# WHY. The tracked-red predicate (scripts/substrate/lib/gap-tracked-red.sh) reads the open gaps with
# the node key (resolve-writers-send-credentials P7). Before this, any unreadable store meant "no
# name is tracked", so a stale key turned every tracked check-first red into a regression: the glue
# runner failed it, and pull-sync refused the vessel and filed a pull-sync-test-regression gap that
# blamed the commit. A refused credential says nothing about the tests. It is reported as its own
# fault with one greppable line, `credential refused (401) — key stale?`, and the verdict it blocks
# is UNKNOWN, never red.
#
#   (a) lib     gtr_load against a store that answers 401: the distinct line on stderr, exit 2
#               (1 stays "unreadable"); a 200 store loads (control); a 500 page is 1 with no
#               401 line (control)
#   (b) runner  a red glue test under a 401 store is UNKNOWN, not FAIL and not TRACKED-RED; the
#               run exits 3 (environment) with the distinct line; with the store readable the
#               same test is TRACKED-RED and the run exits 0 (control)
#   (c) pull-sync  tracked_fail_names (its loader block, verbatim from the script) returns 2 with
#               the distinct line; the test gate given that answer HOLDS the vessel: no refusal
#               counted, no regression gap, no convergence, baseline untouched, the distinct line
#               logged; given "nothing tracked" (rc 0) it refuses as before (control)
#
# usage: validation/scripts/credential-refused-401.test.sh
# Needs bash, git, jq, awk, sed.
set -uo pipefail
SRC="$(cd "$(dirname "$0")/../.." && pwd)"
LIB="$SRC/scripts/substrate/lib/gap-tracked-red.sh"
PS="$SRC/scripts/substrate/substrate-pull-sync.sh"
T="$(mktemp -d "${TMPDIR:-/tmp}/credential-refused.XXXXXX")"; trap 'rm -rf "$T"' EXIT
FAILS=0
ok()  { echo "ok   - $*"; }
bad() { echo "FAIL - $*"; FAILS=$((FAILS+1)); }
LINE='credential refused (401) — key stale?'

# A curl on PATH that answers like the real one: the body, then any -w format with %{http_code}
# replaced by the status in $T/status. -K - reads (and discards) stdin.
mkdir -p "$T/fx"
cat > "$T/fx/curl" <<EOF
#!/usr/bin/env bash
w=""; prev=""
for a in "\$@"; do
  [ "\$prev" = "-w" ] && w="\$a"
  [ "\$prev" = "-K" ] && [ "\$a" = "-" ] && cat >/dev/null
  prev="\$a"
done
st="\$(cat "$T/status")"
case "\$st" in
  200) cat "$T/resp.json" ;;
  401) printf '{"error":"unauthorized"}' ;;
  500) printf '<html><body>500 Internal Server Error</body></html>' ;;
esac
[ -n "\$w" ] && printf '%b' "\${w//%\{http_code\}/\$st}"
exit 0
EOF
chmod +x "$T/fx/curl"
LABEL='check-first: fixture red'
jq -n -c --arg l "$LABEL" '{shape:"substrateGap", body:{gaps:[{id:"g-fx", status:"open",
  classification_metadata:{evidence_resolve:{shape:"test_suite", input:{vessel:"super-repo",
  test_file:"validation/scripts/fx-red.test.sh", only_tests:[$l]}}}}]}}' > "$T/resp.json"
STORE=http://fixture.invalid

# ── (a) the lib ─────────────────────────────────────────────────────────────────
lib_load() { # status -> RC, stderr in $T/err
  echo "$1" > "$T/status"
  ( PATH="$T/fx:$PATH"; . "$LIB"; gtr_load "$STORE" "$T/loaded.json" ) 2>"$T/err" >"$T/out"; RC=$?
}
lib_load 401
[ "$RC" = 2 ] && ok "(a) lib: a 401 store is exit 2 (environment), not 1 (unreadable)" || bad "(a) lib: 401 gave exit $RC"
grep -qF "$LINE" "$T/err" && ok "(a) lib: the 401 prints the distinct line on stderr" || bad "(a) lib: no '$LINE' on stderr (got: $(head -c 200 "$T/err"))"
grep -qF "$LINE" "$T/out" && bad "(a) lib: the 401 line went to stdout (callers capture stdout)" || ok "(a) lib: nothing on stdout"
lib_load 200
[ "$RC" = 0 ] && [ "$(jq length "$T/loaded.json" 2>/dev/null)" = 1 ] && ok "(a) control: a 200 store loads its open gap" || bad "(a) control: 200 gave exit $RC"
lib_load 500
[ "$RC" = 1 ] && ! grep -qF "$LINE" "$T/err" && ok "(a) control: a 500 page is unreadable (1) with no 401 line" || bad "(a) control: 500 gave exit $RC / $(head -c 200 "$T/err")"

# ── (b) the glue runner ─────────────────────────────────────────────────────────
R="$T/root"; mkdir -p "$R/validation/scripts" "$R/scripts/substrate/lib"
cp "$SRC/validation/scripts/run-glue-tests.sh" "$R/validation/scripts/"
cp "$LIB" "$R/scripts/substrate/lib/"
printf '#!/usr/bin/env bash\necho %q\nexit 1\n' "FAIL - $LABEL" > "$R/validation/scripts/fx-red.test.sh"
runner() { # status -> RC, output in $T/run.txt
  echo "$1" > "$T/status"
  PATH="$T/fx:$PATH" bash "$R/validation/scripts/run-glue-tests.sh" --root "$R" --log-dir "$T/logs-$1" --gap-store "$STORE" > "$T/run.txt" 2>&1; RC=$?
}
runner 401
grep -qE '^UNKNOWN .*fx-red\.test\.sh' "$T/run.txt" && ok "(b) runner: under a 401 store the red test is UNKNOWN" || bad "(b) runner: no UNKNOWN line for fx-red.test.sh"
grep -qE '^(FAIL|TRACKED-RED) .*fx-red\.test\.sh' "$T/run.txt" && bad "(b) runner: the red test was judged FAIL/TRACKED-RED under a 401 store" || ok "(b) runner: not judged FAIL or TRACKED-RED"
[ "$RC" = 3 ] && ok "(b) runner: the run exits 3 (environment), not 1 (a test failed)" || bad "(b) runner: exit $RC"
grep -qF "$LINE" "$T/run.txt" && ok "(b) runner: the distinct line is in the output" || bad "(b) runner: no '$LINE' in the output"
runner 200
grep -qE '^TRACKED-RED .*fx-red\.test\.sh' "$T/run.txt" && [ "$RC" = 0 ] && ok "(b) control: with the store readable the same red is TRACKED-RED, exit 0" || bad "(b) control: readable store gave exit $RC"
[ "$FAILS" -gt 0 ] && sed 's/^/    /' "$T/run.txt" | tail -6

# ── (c) pull-sync ───────────────────────────────────────────────────────────────
sed -n '/^# >>> gap-tracked-red loader$/,/^# <<< gap-tracked-red loader$/p' "$PS" > "$T/loader.sh"
grep -q '^tracked_fail_names()' "$T/loader.sh" || bad "(c) could not extract pull-sync's gap-tracked-red loader"
echo 401 > "$T/status"
( PATH="$T/fx:$PATH"; PULLSYNC_SELF_DIR="$SRC/scripts/substrate"; PULLSYNC_SHARE_DIR="$T/no-share"; DEV_VESSEL="$STORE"
  . "$T/loader.sh" >/dev/null 2>&1; tracked_fail_names demo "test/x.test.ts" ) >"$T/out" 2>"$T/err"; RC=$?
[ "$RC" = 2 ] && ok "(c) pull-sync: tracked_fail_names returns 2 on a 401 store" || bad "(c) pull-sync: tracked_fail_names returned $RC on a 401 store"
grep -qF "$LINE" "$T/err" && ok "(c) pull-sync: tracked_fail_names passes the distinct line through" || bad "(c) pull-sync: no '$LINE' from tracked_fail_names"

# The gate slice, as pull-sync-testgate-outstanding.test.sh extracts it.
{
  sed -n '/^scrubbed_env() {/,/^}/p' "$PS"
  sed -n '/^unresolved_modules() {/,/^}/p' "$PS"
  sed -n '/^test_only_range() {/,/^}/p' "$PS"
  echo 'run_gate() {'; echo 'for v in "$VESSEL"; do'
  awk '/^  # 3-pre\. TEST GATE/{on=1} on{print} on && /^  rm -f "\$MARKER_DIR\/\$v\.testgate-refusals"/{exit}' "$PS"
  echo '  echo "CONVERGED $v" >> "$CALLS"'; echo 'done'; echo '}'
} > "$T/fns.sh"
grep -q 'STARVATION BREAK' "$T/fns.sh" || { bad "(c) could not extract the test-gate slice"; echo "FAILED ($FAILS)"; exit 1; }
# shellcheck disable=SC1090
source "$T/fns.sh"
CALLS="$T/calls.txt"; LOG="$T/log.txt"
log() { echo "$*" >> "$LOG"; }
emit_gap() { echo "GAP $1" >> "$CALLS"; }
ensure_clone_deps() { return 0; }
ensure_clone_nested_deps() { CD_NESTED=""; return 0; }
TFN_RC=0
tracked_fail_names() { [ "$TFN_RC" = 2 ] && echo "$LINE" >&2; return "$TFN_RC"; }
mkdir -p "$T/bin" "$T/stub"
cat > "$T/bin/bun" <<EOF
#!/usr/bin/env bash
case "\$1" in
  test) f="$T/stub/out-\$(git rev-parse HEAD 2>/dev/null)"; if [ -f "\$f" ]; then cat "\$f"; else cat "$T/stub/clone-out"; fi; exit 1 ;;
esac
EOF
chmod +x "$T/bin/bun"; BUN_BIN="$T/bin/bun"
VESSEL=demo-vessel
CLONE_DIR="$T/clones"; MARKER_DIR="$T/marker"; TEST_BASELINE_DIR="$T/baseline"; LAST_GOOD_DIR="$T/lastgood"; TMPDIR="$T/tmp"
TEST_GATE_MAX_REFUSALS=3
d="$CLONE_DIR/$VESSEL/"
g() { git -C "$d" -c user.name=t -c user.email=t@t "$@" >/dev/null 2>&1; }
OLD_OUT='(pass) a > works
(fail) old > one
 5 pass
 1 fail'
NEW_OUT='(pass) a > works
(fail) old > one
(fail) new > broke
 5 pass
 2 fail'
setup() {
  rm -rf "$T/clones" "$T/marker" "$T/baseline" "$T/lastgood" "$T/tmp" "$T/stub"/*
  mkdir -p "$d/src" "$d/test" "$MARKER_DIR" "$TEST_BASELINE_DIR" "$LAST_GOOD_DIR" "$TMPDIR"
  echo 'export const x = 1;' > "$d/src/x.ts"; echo 'test("a", () => {});' > "$d/test/x.test.ts"
  git -C "$d" init -q -b dev; g add -A; g commit -m base
  git -C "$d" rev-parse HEAD > "$LAST_GOOD_DIR/$VESSEL"
  printf '%s\n' "$OLD_OUT" > "$T/stub/out-$(git -C "$d" rev-parse HEAD)"
  printf '%s\n' '(fail) old > one' > "$TEST_BASELINE_DIR/$VESSEL.failnames"; echo "1 5 0" > "$TEST_BASELINE_DIR/$VESSEL"
  synced=0; failed=0; skipped=0; GEN_QUEUE=""; unset GATE_T0
  echo 'export const x = 2;' > "$d/src/x.ts"; g commit -am runtime
  printf '%s\n' "$NEW_OUT" > "$T/stub/clone-out"
}
tick() { : > "$CALLS"; : > "$LOG"; HEAD="$(git -C "$d" rev-parse HEAD)"; run_gate 2>>"$LOG"; }

setup; TFN_RC=2
BEFORE="$(cat "$TEST_BASELINE_DIR/$VESSEL.failnames" "$TEST_BASELINE_DIR/$VESSEL")"
tick
grep -q "^CONVERGED $VESSEL" "$CALLS" && bad "(c) gate: converged on an unknown verdict" || ok "(c) gate: a 401 store does not converge the vessel"
grep -q 'GAP .*pull-sync-test-regression-' "$CALLS" && bad "(c) gate: filed a regression gap on a 401 store" || ok "(c) gate: no regression gap on a 401 store"
[ -s "$MARKER_DIR/$VESSEL.testgate-refusals" ] && bad "(c) gate: counted a refusal ($(cat "$MARKER_DIR/$VESSEL.testgate-refusals")) on a 401 store" || ok "(c) gate: no refusal counted"
[ "$(cat "$TEST_BASELINE_DIR/$VESSEL.failnames" "$TEST_BASELINE_DIR/$VESSEL")" = "$BEFORE" ] && ok "(c) gate: baseline untouched" || bad "(c) gate: baseline rewritten"
grep -qF "$LINE" "$LOG" && grep -qi 'unknown' "$LOG" && ok "(c) gate: the distinct line is logged and the verdict named unknown" || bad "(c) gate: log lacks '$LINE' / 'unknown': $(tr '\n' '|' < "$LOG" | cut -c1-300)"
setup; TFN_RC=0; tick
grep -q 'GAP .*pull-sync-test-regression-' "$CALLS" && ok "(c) control: with nothing tracked (rc 0) the gate refuses and files the regression gap" || bad "(c) control: rc 0 did not refuse"

if [ "$FAILS" -eq 0 ]; then echo "PASS"; exit 0; fi
echo "FAILED ($FAILS)"; exit 1
