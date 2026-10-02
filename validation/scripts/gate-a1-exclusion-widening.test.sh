#!/usr/bin/env bash
# a1, the self-exclusion case: a candidate cannot un-gate the file it edits. One commit BOTH
# adds scripts/substrate/render-secret-scope.sh to non_root_paths (a "!" exclusion) AND edits
# that file (marker side effect). The real pull-sync runs as the gate body, soak N=1.
#   must fail   (1) the classifier does not call it a widening (authority_widening gap,
#                   candidate_widening notice, no promote.request)
#               (2) the edited file escapes the ACCEPTED gate set (the overlay reads the accepted
#                   MANIFEST, never the candidate's policy): its marker runs as root
#               (3) after N+2 ticks accepted.sha has moved
#   control     the same edit WITHOUT the exclusion: an ordinary candidate (shadow pass ->
#               promote.request, not a widening) that is still never run on arrival
# usage: validation/scripts/gate-a1-exclusion-widening.test.sh   (bash, git, jq, flock; no root)
source "$(dirname "$0")/lib/gate-test-lib.sh"
POL=scripts/substrate/gate/gate-policy.json
setup() {
  gt_live
  echo 'SHARED=1' > "$T/etc/env"
  mkdir -p "$T/seed/scripts/substrate/units"; printf '[Service]\nExecStart=/bin/true\n' > "$T/seed/scripts/substrate/units/x.service"
  printf '#!/usr/bin/env bash\n: > "%s/ACC-RENDER"\n' "$T" > "$T/seed/scripts/substrate/render-secret-scope.sh"
  A0="$(gt_push "accepted glue")"; gt_live_converged
  rm -f "$T/CAND-RENDER" "$T/ACC-RENDER"
  gt_live_tick; [ "$RC" = 0 ] && [ -e "$T/ACC-RENDER" ] || { bad "setup: bootstrap rc $RC or the accepted renderer never ran"; show; }
  printf '#!/usr/bin/env bash\n: > "%s/CAND-RENDER"\n' "$T" > "$T/seed/scripts/substrate/render-secret-scope.sh"
}
judge() { bash "$G/accepted/scripts/substrate/gate/candidate.sh" --gate-dir "$G" --super "$T/super" \
  --candidate "$(git -C "$T/super" rev-parse HEAD)" > "$T/cand.txt" 2>&1; }

# ── the case: exclusion + edit in one commit ───────────────────────────────────
setup
jq '.non_root_paths += ["scripts/substrate/render-secret-scope.sh"]' "$T/seed/$POL" > "$T/p" && mv "$T/p" "$T/seed/$POL"
gt_push "un-gate and edit the renderer" >/dev/null
for i in 1 2 3; do gt_live_tick; [ "$RC" = 0 ] || { bad "tick $i rc $RC"; show; }; done
grep -q "gate: verdict widening.*adds non_root_paths entry 'scripts/substrate/render-secret-scope.sh'" "$T/out.txt" \
  && ok "(1) the body's classifier says widening" || { bad "(1) not classified widening"; show; }
jq -e 'select(.kind=="candidate_widening") | .reason|test("adds non_root_paths")' "$G/notices.jsonl" >/dev/null 2>&1 \
  && ok "(1) candidate_widening notice in the gate's store" || bad "(1) no widening notice"
judge; grep -q '^GAP .*"category":"authority_widening"' "$T/cand.txt" && ok "(1) authority_widening gap" || { bad "(1) no authority_widening gap"; cat "$T/cand.txt"; }
[ ! -e "$G/promote.request" ] && ok "(1) no promote.request" || bad "(1) promote.request written"
grep -q 'gate paths changed.*render-secret-scope.sh' "$T/cand.txt" && ok "(2) the edited file is a gate path per the ACCEPTED set" || bad "(2) render-secret-scope.sh not seen as gate"
[ ! -e "$T/CAND-RENDER" ] && ok "(2) the candidate renderer never ran as root (3 ticks)" || bad "(2) the CANDIDATE renderer RAN"
[ -e "$T/ACC-RENDER" ] && ok "(2) control: the accepted renderer ran through the same call" || bad "(2) no renderer ran"
[ "$(cat "$G/accepted.sha")" = "$A0" ] && [ "$(gt_records promote)" = 0 ] && ok "(3) after N+2 ticks accepted.sha is unchanged" || bad "(3) accepted.sha moved to $(cat "$G/accepted.sha")"

# ── control: the same edit, no exclusion ───────────────────────────────────────
setup
gt_push "edit the renderer" >/dev/null
gt_live_tick
grep -q 'gate: verdict promote' "$T/out.txt" && ! grep -q 'verdict widening' "$T/out.txt" \
  && ok "control: an ordinary candidate (shadow pass, promote.request), not a widening" || { bad "control: verdict"; show; }
[ ! -e "$T/CAND-RENDER" ] && ok "control: still never run on arrival" || bad "control: the candidate renderer ran before promotion"
done_tests
