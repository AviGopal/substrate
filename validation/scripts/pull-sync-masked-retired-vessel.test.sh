#!/usr/bin/env bash
# pull-sync-masked-retired-vessel.test.sh: a vessel no inventory names any more, whose unit is masked, is skipped like
# any masked vessel: not fetched, not tested.
#
# The vessel loop's masked check reads the unit from the inventory (vessel_unit, by repo). A retired vessel is not in
# the inventory, so its unit read as empty, the way a shared package's does, and the check never fired: on a hub, the
# retired development-vessel's leftover clone had its suite run every tick (956 s plus the overlay), holding the gate
# lock. The loop's slice, from the unit lookup through the masked check, is taken from substrate-pull-sync.sh and run
# over stubs:
#   1. no inventory entry, its unit by name masked          -> skipped, logged as MASKED, nothing past the skip;
#   2. no inventory entry and no unit of its name (a package) -> not skipped (the package path is unchanged), whether
#      is-enabled answers nothing or "not-found";
#   3. an inventory unit that is masked                      -> skipped, as before;
#   4. an inventory unit that is enabled                     -> not skipped.
# Must-fail: without the by-name fallback, case 1 runs past the skip.
set -uo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SCRIPT="$HERE/../../scripts/substrate/substrate-pull-sync.sh"
T="$(mktemp -d "${TMPDIR:-/tmp}/masked-retired.XXXXXX")"; trap 'rm -rf "$T"' EXIT
FAILS=0
ok()  { echo "ok   - $*"; }
bad() { echo "FAIL - $*"; FAILS=$((FAILS+1)); }

{
  echo 'run_slice() {'
  echo 'for v in "$VESSEL"; do'
  awk 'index($0, "  SELF_UNIT=\"$(vessel_unit \"$v\")\"") == 1 && !seen {on=1; seen=1} on{print} on && /is MASKED on this deployment/ {m=1} on && m && /^  fi$/{exit}' "$SCRIPT"
  echo 'echo PAST-SKIP >> "$CALLS"'
  echo 'done'
  echo '}'
} > "$T/slice.sh"
grep -q 'is MASKED on this deployment' "$T/slice.sh" && grep -q 'vessel_unit "$v"' "$T/slice.sh" \
  || { echo "FAIL - could not extract the vessel loop's unit lookup and masked check"; exit 1; }

CALLS="$T/calls"; LOG="$T/log"
log() { echo "$*" >> "$LOG"; }
release_carried_hold() { :; }
vessel_unit() { printf '%s' "${INV_UNIT:-}"; }
systemctl() { case "$1" in is-enabled) printf '%s\n' "${UNITS[$2]:-}" ;; esac; }
declare -A UNITS
# shellcheck disable=SC1090
source "$T/slice.sh"
run() { : > "$CALLS"; : > "$LOG"; skipped=0; run_slice; }

VESSEL=development-vessel; INV_UNIT=""; UNITS=([development-vessel.service]=masked); run
! grep -q PAST-SKIP "$CALLS" && grep -q "development-vessel.service is MASKED" "$LOG" && [ "$skipped" = 1 ] \
  && ok "[MUST-FAIL] a vessel no inventory names, its unit masked: skipped, not tested" || bad "retired + masked ran on: $(cat "$LOG")"
VESSEL=ias-executor-ts; INV_UNIT=""; UNITS=(); run
grep -q PAST-SKIP "$CALLS" && [ "$skipped" = 0 ] && ok "a shared package (no unit of its name): not skipped" || bad "package skipped: $(cat "$LOG")"
VESSEL=retired-no-unit; INV_UNIT=""; UNITS=([retired-no-unit.service]=not-found); run
grep -q PAST-SKIP "$CALLS" && [ "$skipped" = 0 ] && ok "no inventory entry and no unit file (is-enabled: not-found): goes on, as a package does" || bad "not-found skipped: $(cat "$LOG")"
VESSEL=boredom-vessel; INV_UNIT=boredom-vessel.service; UNITS=([boredom-vessel.service]=masked); run
! grep -q PAST-SKIP "$CALLS" && ok "an inventory unit that is masked: skipped, as before" || bad "inventory masked ran on"
VESSEL=walk-vessel; INV_UNIT=walk-vessel.service; UNITS=([walk-vessel.service]=enabled); run
grep -q PAST-SKIP "$CALLS" && ok "an inventory unit that is enabled: not skipped" || bad "enabled skipped: $(cat "$LOG")"

echo; [ "$FAILS" = 0 ] && { echo PASS; exit 0; } || { echo "$FAILS FAILED"; exit 1; }
