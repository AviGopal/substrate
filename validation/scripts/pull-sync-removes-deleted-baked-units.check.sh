#!/usr/bin/env bash
# pull-sync-removes-deleted-baked-units.check.sh: a commit that DELETES a baked tier-A path converges in place, as a
# change to one does. Today pull-sync's glue install sites copy what the stage holds and never remove an installed
# copy whose source is gone, so a deleted unit keeps running until a recreate from an image without it.
# Gap: baked-tier-a-deletion-never-converges-in-place.
#
# Not a *.test.sh: it is committed red (check first), before the fix, and an intended-red check stays out of the
# glue corpus. Once the fix lands green, a glue test runs it.
#
# On the gate-test harness (validation/scripts/lib/gate-test-lib.sh, gt_live: the REAL pull-sync, systemctl stubbed,
# every fixed path moved under a temp tree), with a coverage map that proves every seed file (so the coverage gate of
# in-place-image-convergence 1.3 is satisfied and only deletion is under test):
#   MUST-FAIL  a unit file committed, ticked (it is installed into the unit dir), then deleted in the next commit and
#              ticked: its installed copy must be GONE. Red today: the copy stays.
#   CONTROL    in the same run, a non-baked file (under validation/, not in the image manifest) deleted in that commit
#              is gone from the node's clone (the keyless case; green today), and the unit was installed by the first
#              tick, so "gone" later is attributable to the delete, not to an install that never happened.
# usage: validation/scripts/pull-sync-removes-deleted-baked-units.check.sh   (bash, git, jq, flock; no root)
source "$(dirname "$0")/lib/gate-test-lib.sh"
source "$(dirname "$0")/lib/coverage-all-behaviour.sh"
gt_live
U=retire-probe.service
mkdir -p "$T/seed/scripts/substrate/units" "$T/seed/validation/human-participation"
printf '[Unit]\nDescription=retire probe\n[Service]\nExecStart=/usr/local/bin/substrate-ready\n' > "$T/seed/scripts/substrate/units/$U"
echo "# a non-baked validation script" > "$T/seed/validation/human-participation/retire-probe.ts"
cov_all "$T/seed"; A0="$(gt_push "a unit and a non-baked file")"; gt_live_converged; gt_live_tick
UD="$T/unit"   # gt_live moves UNIT_DIR here
[ "$RC" = 0 ] && [ -f "$UD/$U" ] && ok "control: the first tick installs $U into the unit dir" \
  || { bad "control: $U was not installed by the first tick (rc $RC; unit dir $UD)"; show; done_tests; }
git -C "$T/seed" rm -q "scripts/substrate/units/$U" "validation/human-participation/retire-probe.ts"
cov_all "$T/seed"; D="$(gt_push "delete them")"; gt_live_tick
[ "$(git -C "$T/super" rev-parse HEAD)" = "$D" ] && [ ! -e "$T/super/validation/human-participation/retire-probe.ts" ] \
  && ok "control: the non-baked delete converges (gone from the node's clone)" || bad "control: the non-baked delete did not converge"
# The deleting commit is a gate candidate (scripts/substrate/* changed); let a second tick promote it if it soaks.
gt_live_tick
[ ! -e "$UD/$U" ] && ok "a deleted baked unit is removed from the unit dir" \
  || bad "a deleted baked unit is removed from the unit dir (still installed: $UD/$U)"
done_tests
