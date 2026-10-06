#!/usr/bin/env bash
# pull-sync-revive-failed-timers.test.sh: a timer failed by a since-fixed dependency runs again with no operator.
#
# On 2026-10-06 compose2's rhythm-cadence and gap-store-census timers failed ("Failed to queue unit startup job:
# Unit substrate-active-scripts-seed.service is masked") and stayed failed for 11 h after the fix promoted. A
# failed timer never fires until reset-failed + start. substrate-pull-sync.sh's revive_failed_timers runs after
# the units converge. This drives it with a stub systemctl over these cases:
#   1. failed + enabled, service and its requirements load  -> reset + started, logged "revived";
#   2. failed + enabled, service Requires a MASKED unit       -> left failed, logged with the cause (no start);
#   3. failed but DISABLED (the inventory's decision)        -> untouched;
#   4. revived on 3 consecutive ticks                         -> a gap is filed for that timer;
#   5. a timer no longer failed                               -> its revive count is cleared.
# Must-fail: with the function body removed, case 1 fails.
set -uo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SCRIPT="$HERE/../../scripts/substrate/substrate-pull-sync.sh"
T="$(mktemp -d "${TMPDIR:-/tmp}/revive-timers.XXXXXX")"; trap 'rm -rf "$T"' EXIT
FAILS=0
ok()  { echo "ok   - $*"; }
bad() { echo "FAIL - $*"; FAILS=$((FAILS+1)); }

sed -n '/^revive_failed_timers() {/,/^}/p' "$SCRIPT" > "$T/fn.sh"
grep -q 'reset-failed' "$T/fn.sh" || { echo "FAIL - could not extract revive_failed_timers"; exit 1; }

# Stub systemctl over a state dir: $T/st/<unit>.{active,enabled,load,requires,unit}; calls logged to $T/calls.
cat > "$T/systemctl" <<'STUB'
#!/usr/bin/env bash
st="$STUB_ST"; echo "$*" >> "$STUB_CALLS"
get() { cat "$st/$1.$2" 2>/dev/null; }
case "$1" in
  list-units) for f in "$st"/*.timer.active; do u="${f##*/}"; u="${u%.active}"; [ "$(cat "$f")" = failed ] && echo "$u loaded failed failed x"; done ;;
  is-enabled) get "$2" enabled ;;
  is-failed) [ "$(get "$2" active)" = failed ] && echo failed || echo active ;;
  show) u="$2"; shift 2; out=()
        while [ $# -gt 0 ]; do case "$1" in
          -p) case "$2" in Unit) out+=("$(get "$u" unit)");; LoadState) out+=("$(get "$u" load)");;
                           Requires) out+=("$(get "$u" requires)");; Requisite) out+=("");; ActiveState) out+=("$(get "$u" active)");; esac; shift 2;;
          --value) shift;; *) shift;; esac; done
        printf '%s\n' "${out[@]}" | grep . | tr '\n' ' ' | sed 's/ $//'; echo ;;
  reset-failed) echo inactive > "$st/$2.active" ;;
  start) echo active > "$st/$2.active" ;;   # start only ARMS a timer; a failure shows when it next fires
esac
exit 0
STUB
chmod +x "$T/systemctl"
export STUB_ST="$T/st" STUB_CALLS="$T/calls" PULLSYNC_SYSTEMCTL="$T/systemctl"
MARKER_DIR="$T/markers"; mkdir -p "$MARKER_DIR" "$STUB_ST"
log() { echo "$*" >> "$T/log"; }
emit_gap() { echo "$1" >> "$T/gaps"; }
. "$T/fn.sh"

unit() { # name active enabled load requires [fail_again]
  echo "$2" > "$STUB_ST/$1.timer.active"; echo "$3" > "$STUB_ST/$1.timer.enabled"; echo "$1.service" > "$STUB_ST/$1.timer.unit"
  echo "$4" > "$STUB_ST/$1.service.load"; echo "$5" > "$STUB_ST/$1.service.requires"; echo "${6:-no}" > "$STUB_ST/$1.service.fail_again"
}
reset_run() { : > "$T/log"; : > "$T/calls"; : > "$T/gaps"; }
echo loaded > "$STUB_ST/seed.service.load"; echo masked > "$STUB_ST/masked-seed.service.load"

# 1-3 in one tick.
unit rc failed enabled loaded "seed.service"
unit gsc failed enabled loaded "masked-seed.service"
unit off failed disabled loaded ""
reset_run; revive_failed_timers
grep -q '^start rc.timer$' "$T/calls" && [ "$(cat "$STUB_ST/rc.timer.active")" = active ] && grep -q 'revived rc.timer' "$T/log" \
  && ok "case 1: a failed timer whose service and requirements now load is reset, started and logged" \
  || bad "case 1: rc.timer was not revived ($(tr '\n' ' ' < "$T/calls"))"
! grep -q 'start gsc.timer' "$T/calls" && grep -q 'gsc.timer stays failed .*masked-seed.service' "$T/log" \
  && ok "case 2: a timer whose service still Requires a masked unit stays failed, and the cause is logged" \
  || bad "case 2: gsc.timer was started or its cause not logged"
! grep -qE '(reset-failed|start) off.timer' "$T/calls" && ok "case 3: a disabled failed timer is left alone" || bad "case 3: a disabled timer was touched"

# 4. A timer that fails again after every revive escalates on the third consecutive tick.
unit flap failed enabled loaded ""
for i in 1 2 3; do reset_run; revive_failed_timers; echo failed > "$STUB_ST/flap.timer.active"; done   # it fails again when it fires
grep -q 'pull-sync-timer-keeps-failing-flap.timer' "$T/gaps" && ok "case 4: three consecutive revives of the same timer file a gap" \
  || bad "case 4: no gap after three revives (count $(cat "$MARKER_DIR/timer-revive.flap.timer" 2>/dev/null))"

# 5. Once healthy, the count clears, so only consecutive revives escalate.
reset_run; revive_failed_timers   # revived a 4th time; this time it keeps running
[ -e "$MARKER_DIR/timer-revive.flap.timer" ] && ok "case 5a: the tick that revives a timer does not clear its count (start only arms it)" || bad "case 5a: the count was cleared in the reviving tick"
reset_run; revive_failed_timers
[ ! -e "$MARKER_DIR/timer-revive.flap.timer" ] && ok "case 5: a timer that stays up clears its revive count" || bad "case 5: the revive count was not cleared"

# Must-fail: the same case-1 setup with the body emptied does not revive.
printf 'revive_failed_timers() { :; }\n' > "$T/empty.sh"; . "$T/empty.sh"
unit rc failed enabled loaded "seed.service"; reset_run; revive_failed_timers
[ "$(cat "$STUB_ST/rc.timer.active")" = failed ] && ok "must-fail: without the function body the timer stays failed" || bad "must-fail control did not hold"

echo; [ "$FAILS" = 0 ] && { echo "PASS"; exit 0; } || { echo "$FAILS FAILED"; exit 1; }
