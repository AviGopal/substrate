#!/usr/bin/env bash
# J9 (= J4, the 847025e2 replay, end to end): after bootstrap, a lane-pushed
# substrate-pull-sync.sh is NOT executed. The node runs gate-runner -> the ACCEPTED pull-sync
# (the real script, fixed paths moved into a temp tree; systemctl/curl stubbed). origin gains
# a pull-sync that drops a marker in BIN_DIR when run. The tick fetches and fast-forwards the
# clone, does not install or exec the pushed copy, keeps accepted.sha, and judges it with the
# accepted classifier: shadow pass (soak 1) -> promote.request.
#   positive control  the next tick: the runner promotes that sha and it runs (marker present),
#                     a `promote` record in the ledger
#   unit guard        substrate-pull-sync.service runs gate-runner; it falls back to the
#                     pre-gate pull-sync only while the gate was never bootstrapped
# usage: validation/scripts/gate-j9-no-self-exec.test.sh   (bash, git, jq, flock; no root)
source "$(dirname "$0")/lib/gate-test-lib.sh"
gt_live
mkdir -p "$T/seed/scripts/substrate/units/vessel.d"; printf '[Service]\n# accepted\n' > "$T/seed/scripts/substrate/units/vessel.d/10-x.conf"
A0="$(gt_push "the accepted pull-sync")"
gt_live_converged
tick() { gt_live_tick; }
tick
[ "$RC" = 0 ] && [ "$(cat "$G/accepted.sha" 2>/dev/null)" = "$A0" ] && ok "bootstrap: the real pull-sync is accepted and runs gated" || { bad "bootstrap: rc $RC"; show; }

PUSHED="$T/pushed.sh"
{ head -n1 "$T/seed/scripts/substrate/substrate-pull-sync.sh"; echo ": > \"$T/bin/j9-ran\""; tail -n +2 "$T/seed/scripts/substrate/substrate-pull-sync.sh"; } > "$PUSHED"
cp "$PUSHED" "$T/seed/scripts/substrate/substrate-pull-sync.sh"
printf '[Service]\n# candidate loosening\n' > "$T/seed/scripts/substrate/units/vessel.d/10-x.conf"
printf '[Service]\nExecStart=/bin/true\n' > "$T/seed/scripts/substrate/units/plain.service"
g "$T/seed" add -A; g "$T/seed" commit -am "lane-pushed pull-sync"; g "$T/seed" push origin dev; C="$(git -C "$T/seed" rev-parse HEAD)"
tick
[ "$RC" = 0 ] && ok "tick with a pushed pull-sync exits 0" || { bad "exit $RC"; show; }
[ "$(git -C "$T/super" rev-parse HEAD)" = "$C" ] && ok "the clone fetched and fast-forwarded to the pushed commit" || bad "the clone did not advance (fixture does not replay)"
[ ! -e "$T/bin/j9-ran" ] && ok "the pushed pull-sync was NOT executed" || bad "the pushed pull-sync RAN (run-on-arrival)"
grep -q 're-executing this tick' "$T/out.txt" && bad "the tick re-executed" || ok "no re-exec"
cmp -s "$T/bin/substrate-pull-sync" "$PUSHED" && bad "the pushed copy was installed to BIN_DIR" || ok "BIN_DIR does not hold the pushed copy"
[ "$(cat "$G/accepted.sha")" = "$A0" ] && ok "accepted.sha unchanged" || bad "accepted.sha moved"
grep -q 'gate: gate paths changed' "$T/out.txt" && grep -q 'gate: verdict promote' "$T/out.txt" && [ "$(jq -r .sha "$G/promote.request" 2>/dev/null)" = "$C" ] \
  && ok "judged by the accepted classifier: shadow pass, promote.request for $C" || { bad "no candidate verdict"; show; }

grep -q '# accepted' "$T/unit/vessel.d/10-x.conf" 2>/dev/null && ok "a gate-path unit drop-in installs the ACCEPTED copy, not the candidate's" || bad "vessel.d drop-in: $(cat "$T/unit/vessel.d/10-x.conf" 2>&1)"
[ ! -e "$T/unit/plain.service" ] && ok "a NEW unit in the candidate (scripts/substrate/* is gated) is not installed before promotion" || bad "a candidate unit was installed before promotion"

tick
[ "$(cat "$G/accepted.sha")" = "$C" ] && [ "$(gt_records promote)" = 1 ] && ok "control: promoted by the runner, promote record" || { bad "control: not promoted"; show; }
[ -e "$T/bin/j9-ran" ] && ok "control: the promoted pull-sync runs (marker reachable)" || bad "control: promoted copy did not run"
grep -q '# candidate' "$T/unit/vessel.d/10-x.conf" && ok "control: after promotion the drop-in converges to the promoted copy" || bad "control: drop-in still the old copy"
[ -f "$T/unit/plain.service" ] && ok "control: after promotion the new unit converges" || bad "control: the new unit did not converge after promotion"

# The unit: ExecStart is gate-runner, and the ungated fallback is gated on never-bootstrapped.
U="$GT_ROOT/scripts/substrate/units/substrate-pull-sync.service"
X="$(sed -n 's/^ExecStart=//p' "$U")"
case "$X" in *'/usr/local/libexec/substrate/gate-runner'*'tick'*) ok "unit: ExecStart runs gate-runner tick" ;; *) bad "unit: ExecStart is $X" ;; esac
unit_run() { # runner-present gate-state-entry|- -> output of the unit's command with paths moved to $T/u
  rm -rf "$T/u"; mkdir -p "$T/u/libexec" "$T/u/bin" "$T/u/ws/.gate"   # entrypoint pre-creates the dir
  printf '#!/bin/sh\necho RUNNER "$@"\n' > "$T/u/libexec/gate-runner"; printf '#!/bin/sh\necho UNGATED\n' > "$T/u/bin/substrate-pull-sync"
  chmod +x "$T/u/libexec/gate-runner" "$T/u/bin/substrate-pull-sync"
  [ "$1" = 1 ] || rm -f "$T/u/libexec/gate-runner"
  case "$2" in -) ;; accepted|history) mkdir -p "$T/u/ws/.gate/$2" ;; *) : > "$T/u/ws/.gate/$2" ;; esac
  c="$(printf '%s' "$X" | sed -e 's/\$\$/$/g' -e "s#/usr/local/libexec/substrate#$T/u/libexec#g" -e "s#/usr/local/bin#$T/u/bin#g" -e "s#/workspace#$T/u/ws#g")"
  ( eval "$c" ) 2>&1
}
[ "$(unit_run 1 accepted.sha)" = "RUNNER tick" ] && ok "unit: runner present -> gate-runner tick" || bad "unit: runner present -> $(unit_run 1 accepted.sha)"
unit_run 0 - | grep -q '^UNGATED$' && ok "unit: no runner, empty pre-created gate dir -> the pre-gate pull-sync (arrival tick)" || bad "unit: arrival fallback missing"
for st in accepted.sha accepted history ledger.jsonl bootstrapped; do
  o="$(unit_run 0 "$st")"
  case "$o" in *UNGATED*) bad "unit: gate state '$st' without runner ran UNGATED" ;; *'GAP gate-runner-missing'*) ok "unit: gate state '$st' alone, no runner -> refuses (GAP line)" ;; *) bad "unit: $st -> $o" ;; esac
done
done_tests
