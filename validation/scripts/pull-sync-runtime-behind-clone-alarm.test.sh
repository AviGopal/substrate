#!/usr/bin/env bash
# pull-sync's runtime-behind-clone alarm (scripts/substrate/substrate-pull-sync.sh, runtime_behind_alarm, called from the
# "2. Mirror" section). Every hold cause has its own bounded alarm, but none sees the sum: one node kept a vessel's
# runtime on old code for 3+ days while a fix waited. The effect is now measured per vessel: since when the runtime's
# content has differed from the clone's ($v.runtime-behind-since "<t0> <runtime hash>"), restarting the clock only when
# the RUNTIME changes; past pull_sync.runtime_behind_clone_alarm_seconds (shaped, default 21600) one upserted row,
# pull-sync-runtime-behind-clone-<v>, names both hashes, the age, the gate's last verdict and its wall's why.
#   (a) MUST-FAIL: behind longer than the bound -> the gap is emitted with both hashes, the age, the last gate verdict
#       and the wall's why; the marker is flagged alarmed
#   (b) MUST-FAIL: a runtime that matches the clone again deletes the marker and closes the row
#   (c) CONTROL: behind within the bound -> nothing emitted; converged with no marker -> nothing emitted
#   (d) CONTROL: a moving clone (new hash, new HEAD) with an unchanged runtime does NOT restart t0; a changed runtime does
#   (e) CONTROL: with no tuning row the default bound (21600 s) applies: 100 s behind files nothing
#   (f) the call sits in the mirror section after the runtime hash and before every hold (the owed restart, the gate)
#   (g) MUST-FAIL: the gate records its verdict in <v>.last-gate-verdict (blind, then passed)
# Needs bash, git, jq, timeout.
set -uo pipefail
SCRIPT="${1:-$(cd "$(dirname "$0")/../.." && pwd)/scripts/substrate/substrate-pull-sync.sh}"
T="$(mktemp -d)"; trap 'rm -rf "$T"' EXIT
FAILS=0; ok() { echo "ok   - $*"; }; bad() { echo "FAIL - $*"; FAILS=$((FAILS+1)); }
sed -n '/^runtime_behind_alarm() {/,/^}/p' "$SCRIPT" > "$T/alarm.sh"
# shellcheck disable=SC1090
source "$T/alarm.sh"
CALLS="$T/calls.txt"; LOG="$T/log.txt"; MARKER_DIR="$T/marker"
log() { echo "$*" >> "$LOG"; }
emit_gap() { echo "GAP $1" >> "$CALLS"; }
tuning_param() { case "$1" in pull_sync.runtime_behind_clone_alarm_seconds) TP_VALUE="${BOUND:-$2}" ;; *) TP_VALUE="$2" ;; esac; }
V=development-vessel; F="$MARKER_DIR/$V.runtime-behind-since"
RT=aaaaaaaaaaaaaaaa1111; CH=bbbbbbbbbbbbbbbb2222; CH2=cccccccccccccccc3333; HD=dddddddddddddddd4444; HD2=eeeeeeeeeeeeeeee5555
reset() { rm -rf "$MARKER_DIR"; mkdir -p "$MARKER_DIR"; : > "$CALLS"; : > "$LOG"; unset BOUND; }
call() { : > "$CALLS"; runtime_behind_alarm "$V" "$1" "$2" "$3" 2>>"$LOG"; }
gap() { grep -q "pull-sync-runtime-behind-clone-$V" "$CALLS"; }
t0() { awk '{print $1}' "$F" 2>/dev/null; }
now() { date +%s; }

# (a) behind past the bound -> one open row with everything it names
reset; BOUND=50; echo "$(( $(now) - 100 )) $RT" > "$F"
echo "2026-01-01T00:00:00Z ${HD:0:10} blind: no countable result" > "$MARKER_DIR/$V.last-gate-verdict"
echo '{"why":"last completed full run 230s x1.5, floor 240s, cap 840s"}' > "$MARKER_DIR/$V.suite-wall"
call "$CH" "$RT" "$HD"
if gap && grep -q '"status":"open"' "$CALLS"; then ok "(a) behind 100 s past a 50 s bound files pull-sync-runtime-behind-clone-$V"; else bad "(a) no open row (calls: $(cut -c1-300 "$CALLS"); log: $(tr '\n' '|' < "$LOG" | cut -c1-300))"; fi
J="$(sed -n 's/^GAP //p' "$CALLS" | head -1)"
m() { jq -r ".impulse.pointer.gap.classification_metadata.$1 // empty" <<<"$J" 2>/dev/null; }
[ "$(m runtime_hash)" = "${RT:0:10}" ] && [ "$(m clone_hash)" = "${CH:0:10}" ] && [ "$(m head)" = "${HD:0:10}" ] && ok "(a) it names the runtime hash, the clone hash and the clone HEAD (short)" || bad "(a) hashes: $(m runtime_hash) $(m clone_hash) $(m head)"
[ "$(m behind_seconds)" -ge 100 ] 2>/dev/null && [ "$(m bound_seconds)" = 50 ] && ok "(a) it carries the age ($(m behind_seconds) s) and the bound" || bad "(a) age/bound: $(m behind_seconds) $(m bound_seconds)"
m last_gate_verdict | grep -q 'blind: no countable result' && m wall_why | grep -q 'x1.5' && ok "(a) it carries the last gate verdict and the wall's why" || bad "(a) verdict/why: $(m last_gate_verdict) / $(m wall_why)"
[ "$(awk '{print $3}' "$F")" = alarmed ] && ok "(a) the marker is flagged alarmed" || bad "(a) marker: $(cat "$F")"
call "$CH" "$RT" "$HD"; gap && [ "$(grep -c "pull-sync-runtime-behind-clone-$V" "$CALLS")" = 1 ] && ok "(a) the next tick upserts the same row id" || bad "(a) next tick: $(cut -c1-200 "$CALLS")"
# (b) converged again -> the marker goes and the row closes
call "$CH" "$CH" "$HD"
gap && grep -q '"status":"closed"' "$CALLS" && [ ! -f "$F" ] && ok "(b) a runtime matching the clone deletes the marker and closes the row" || bad "(b) (calls: $(cut -c1-200 "$CALLS"); marker: $(cat "$F" 2>/dev/null))"
call "$CH" "$CH" "$HD"; [ ! -s "$CALLS" ] && ok "(b) a converged vessel with no marker files nothing" || bad "(b) converged filed: $(cut -c1-200 "$CALLS")"

# (c) behind within the bound -> nothing
reset; BOUND=50; echo "$(( $(now) - 10 )) $RT" > "$F"; call "$CH" "$RT" "$HD"
! gap && ok "(c) behind 10 s within a 50 s bound files nothing" || bad "(c) filed within the bound: $(cut -c1-200 "$CALLS")"
reset; call "$CH" "$CH" "$HD"; [ ! -s "$CALLS" ] && [ ! -f "$F" ] && ok "(c) converged: nothing filed, no marker" || bad "(c) converged: $(cut -c1-200 "$CALLS")"
reset; BOUND=50; call "$CH" "$RT" "$HD"; [ -n "$(t0)" ] && [ "$(awk '{print $2}' "$F")" = "$RT" ] && ! gap && ok "(c) the first behind tick starts the clock (<t0> <runtime hash>) and files nothing" || bad "(c) marker: $(cat "$F" 2>/dev/null)"

# (d) the clock follows the runtime, not the clone
reset; BOUND=100000; _t=$(( $(now) - 500 )); echo "$_t $RT" > "$F"
call "$CH2" "$RT" "$HD2"; [ "$(t0)" = "$_t" ] && ok "(d) a moving clone with an unchanged runtime keeps t0" || bad "(d) t0 restarted: $(cat "$F")"
call "$CH2" "$CH" "$HD2"; [ "$(t0)" != "$_t" ] && [ "$(awk '{print $2}' "$F")" = "$CH" ] && ok "(d) a changed runtime restarts t0" || bad "(d) t0 kept: $(cat "$F")"

# (e) the default bound
reset; echo "$(( $(now) - 100 )) $RT" > "$F"; call "$CH" "$RT" "$HD"
! gap && ok "(e) with no tuning row, 100 s behind is within the default 21600 s" || bad "(e) filed under the default bound"

# (f) placement in the mirror section
awk '/^  # 2\. Mirror when the live runtime/{on=1} on{print NR": "$0} /^  # 3-pre\. TEST GATE/{exit}' "$SCRIPT" > "$T/mirror"
_rh=$(grep -m1 'RUNTIME_HASH="$(content_hash' "$T/mirror" | cut -d: -f1)
_call=$(grep -m1 'runtime_behind_alarm "$v" "$CLONE_HASH" "$RUNTIME_HASH" "$HEAD"' "$T/mirror" | cut -d: -f1)
_owed=$(grep -m1 'AN OWED RESTART OUTRANKS' "$T/mirror" | cut -d: -f1)
_eq=$(grep -m1 'if \[ "$CLONE_HASH" = "$RUNTIME_HASH" \]' "$T/mirror" | cut -d: -f1)
[ -n "$_call" ] && [ -n "$_rh" ] && [ -n "$_owed" ] && [ -n "$_eq" ] && [ "$_rh" -lt "$_call" ] && [ "$_call" -lt "$_owed" ] && [ "$_call" -lt "$_eq" ] \
  && ok "(f) the mirror section calls it after the runtime hash and before the owed restart, the converged branch and the gate" || bad "(f) placement (hash $_rh, call ${_call:-none}, owed $_owed, converged $_eq)"

# (g) the gate writes its verdict: the test-gate slice, sourced as the derived-wall test does
{
  sed -n '/^scrubbed_env() {/,/^}/p' "$SCRIPT"
  sed -n '/^unresolved_modules() {/,/^}/p' "$SCRIPT"
  sed -n '/^test_only_range() {/,/^}/p' "$SCRIPT"
  echo 'run_gate() {'; echo 'for v in "$VESSEL"; do'
  awk '/^  # 3-pre\. TEST GATE/{on=1} on{print} on && /^  rm -f "\$MARKER_DIR\/\$v\.testgate-refusals"/{exit}' "$SCRIPT"
  echo '  echo "CONVERGED $v" >> "$CALLS"'; echo 'done'; echo '}'
} > "$T/fns.sh"
grep -q 'testgate-refusals' "$T/fns.sh" || { echo "FAIL - could not extract the test-gate slice"; exit 1; }
# shellcheck disable=SC1090
source "$T/fns.sh"
tracked_fail_names() { :; }; ensure_clone_deps() { return 0; }; ensure_clone_nested_deps() { CD_NESTED=""; return 0; }
mkdir -p "$T/bin" "$T/stub"
cat > "$T/bin/bun" <<BUN
#!/usr/bin/env bash
[ "\$1" = test ] || exit 0
[ -s "$T/stub/sleep" ] && sleep "\$(cat "$T/stub/sleep")"
cat "$T/stub/full"; exit 1
BUN
chmod +x "$T/bin/bun"; BUN_BIN="$T/bin/bun"
GTR_NODE=node-a; CLONE_DIR="$T/clones"; TEST_BASELINE_DIR="$T/baseline"; LAST_GOOD_DIR="$T/lastgood"; TMPDIR="$T/tmp"
TEST_GATE_MAX_REFUSALS=3; PROTECTED_SCOPE_FILE="$T/scope.json"; echo '{"autonomyScope":{"excluded_paths":["repos/development-vessel/test/none.test.ts"]}}' > "$PROTECTED_SCOPE_FILE"
OLD='(fail) old > one'
g() { git -C "$d" -c user.name=t -c user.email=t@t "$@" >/dev/null 2>&1; }
setup() { # $1 suite seconds
  VESSEL=activity-api; d="$CLONE_DIR/$VESSEL"
  rm -rf "$T/clones" "$MARKER_DIR" "$T/baseline" "$T/lastgood" "$T/tmp"; mkdir -p "$d/src" "$MARKER_DIR" "$TEST_BASELINE_DIR" "$LAST_GOOD_DIR" "$TMPDIR"
  echo 'export const x = 1;' > "$d/src/x.ts"
  git -C "$d" init -q -b dev; g add -A; g commit -m base; git -C "$d" rev-parse HEAD > "$LAST_GOOD_DIR/$VESSEL"
  echo 'export const x = 2;' > "$d/src/x.ts"; g add -A; g commit -m change
  printf '(pass) a > works\n%s\n 5 pass\n 1 fail\n' "$OLD" > "$T/stub/full"
  printf '%s\n' "$OLD" > "$TEST_BASELINE_DIR/$VESSEL.failnames"; echo "1 5 0" > "$TEST_BASELINE_DIR/$VESSEL"
  echo "$1" > "$T/stub/sleep"; synced=0; failed=0; skipped=0; GEN_QUEUE=""
}
tick() { : > "$CALLS"; : > "$LOG"; HEAD="$(git -C "$d" rev-parse HEAD)"; unset GATE_T0; PULLSYNC_T0=$(date +%s); run_gate 2>>"$LOG"; }
GV() { cat "$MARKER_DIR/$VESSEL.last-gate-verdict" 2>/dev/null; }
unset GATE_BUDGET_SECONDS QUIESCE_MARGIN_S PROTECTED_TEST_TIMEOUT_SECONDS; SUITE_WALL_FLOOR_S=3; UNIT_TIMEOUT_S=100; GATE_UNIT_MARGIN_S=2; TEST_KILL_GRACE_SECONDS=1
TEST_TIMEOUT_SECONDS=2; setup 4; tick
GV | grep -q " ${HEAD:0:10} blind: no countable result" && ok "(g) a blind gate records 'blind: no countable result' at its HEAD" || bad "(g) blind verdict: '$(GV)' (log: $(tr '\n' '|' < "$LOG" | cut -c1-300))"
unset TEST_TIMEOUT_SECONDS; setup 0; tick
grep -q "^CONVERGED $VESSEL" "$CALLS" && GV | grep -q " ${HEAD:0:10} passed$" && ok "(g) a passing gate records 'passed'" || bad "(g) passed verdict: '$(GV)'"
echo; [ "$FAILS" -eq 0 ] && { echo PASS; exit 0; } || { echo "$FAILS FAIL"; exit 1; }
