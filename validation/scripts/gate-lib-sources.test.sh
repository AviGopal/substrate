#!/usr/bin/env bash
# Gate P refuses to promote a pull-sync that cannot source its tracked-red predicate from its
# own archive (validation/scripts/gate/fixtures/lib-sources.sh, in the ACCEPTED corpus). The
# classifier (scripts/substrate/gate/candidate.sh, run from accepted/) judges each candidate:
#   control    this tree's pull-sync + lib, edited (live layout: the real body runs gated) -> shadow pass,
#              lib-sources PASS, promote.request (soak 1)
#   must fail  a candidate removing lib/ -> lib-sources FAIL, verdict refused,
#              NO promote.request, accepted unchanged, the node keeps converging
#   control    a body without the loader (the stub) -> lib-sources passes (nothing to satisfy)
# Also: promoted by the runner, accepted/ carries the lib in its MANIFEST, and the loader run
# FROM accepted/ (its real BASH_SOURCE default, share dir empty) returns a tracked name.
# usage: validation/scripts/gate-lib-sources.test.sh   (bash, git, jq, flock; no root)
source "$(dirname "$0")/lib/gate-test-lib.sh"
FX=validation/scripts/gate/fixtures
PS=scripts/substrate/substrate-pull-sync.sh
LIBREL=scripts/substrate/lib/gap-tracked-red.sh

judge() { # -> verdict output in $T/cand.txt
  bash "$G/accepted/scripts/substrate/gate/candidate.sh" --gate-dir "$G" --super "$T/super" \
    --candidate "$(git -C "$T/super" rev-parse HEAD)" > "$T/cand.txt" 2>&1
}
fresh() { # accepted = the stub body + the accepted corpus WITH lib-sources.sh
  gt_repo 1
  cp "$GT_ROOT/$FX/lib-sources.sh" "$T/seed/$FX/"; gt_push "corpus" >/dev/null
  gt_runner tick; [ "$RC" = 0 ] || { bad "bootstrap exit $RC"; show; }
  jq -e --arg f "$FX/lib-sources.sh" '.files[$f]' "$G/accepted/MANIFEST.json" >/dev/null || bad "lib-sources.sh is not in the accepted corpus"
}
no_request() { [ ! -e "$G/promote.request" ]; }
shows() { sed 's/^/    /' "$T/cand.txt" | tail -8; }

# ── end to end on the live layout: the REAL pull-sync is the gated body ────────
gt_live
cp "$GT_ROOT/$FX/lib-sources.sh" "$T/seed/$FX/"
A0="$(gt_push "accepted: pull-sync + lib + corpus")"; gt_live_converged
gt_live_tick
[ "$RC" = 0 ] && [ "$(cat "$G/accepted.sha" 2>/dev/null)" = "$A0" ] && ok "bootstrap: the real pull-sync with its lib is accepted" || { bad "bootstrap: rc $RC"; show; }
grep -q 'TRACKED-RED LIB MISSING' "$T/out.txt" && bad "bootstrap: the accepted body could not load its lib" || ok "bootstrap: the accepted body loads its lib (no missing line)"

# control: a candidate that changes the lib and the body -> shadow pass -> promote.request -> promoted
echo "# candidate edit" >> "$T/seed/$LIBREL"; echo "# candidate edit" >> "$T/seed/$PS"
C="$(gt_push "candidate: lib + body edited")"
gt_live_tick
grep -q 'shadow: PASS - lib-sources.sh' "$T/out.txt" && ok "control: lib-sources passes for the candidate (this tree's pull-sync + lib)" || { bad "control: lib-sources did not pass"; show; }
[ "$(jq -r .sha "$G/promote.request" 2>/dev/null)" = "$C" ] && ok "control: promote.request for the candidate" || { bad "control: no promote.request"; show; }
gt_live_tick
[ "$(cat "$G/accepted.sha")" = "$C" ] && [ "$(gt_records promote)" = 1 ] && ok "promoted: by the runner's promote path, promote record in the ledger" || { bad "promoted: accepted.sha $(cat "$G/accepted.sha")"; show; }
jq -e --arg f "$LIBREL" '.files[$f]' "$G/accepted/MANIFEST.json" >/dev/null && grep -q '# candidate edit' "$G/accepted/$LIBREL" \
  && ok "promoted: accepted/ carries the candidate's lib in its MANIFEST" || bad "promoted: the lib is not in accepted/"
grep -q 'TRACKED-RED LIB MISSING' "$T/out.txt" && bad "promoted: the promoted body could not load its lib" || ok "promoted: the promoted body ran gated and loaded its lib"
# tracked_fail_names FROM accepted/: the loader's own BASH_SOURCE default, the share dir EMPTY
cp -a "$G/accepted" "$T/acc"; mkdir -p "$T/empty-share"
sed -n '/^# >>> gap-tracked-red loader$/,/^# <<< gap-tracked-red loader$/p' "$T/acc/$PS" > "$T/acc/scripts/substrate/_loader.sh"
printf '[{"id":"g","status":"open","classification_metadata":{"evidence_resolve":{"shape":"test_suite","input":{"vessel":"v","test_file":"t.test.ts","only_tests":["armed red"]}}}}]\n' > "$T/store.json"
N="$( unset PULLSYNC_SELF_DIR; PULLSYNC_SHARE_DIR="$T/empty-share" DEV_VESSEL="$T/store.json"
  . "$T/acc/scripts/substrate/_loader.sh" >/dev/null 2>&1; echo "$GTR_LIB|$(tracked_fail_names v t.test.ts)" )"
[ "$N" = "$T/acc/$LIBREL|armed red" ] && ok "promoted: tracked_fail_names run from accepted/ (share dir empty) returns the tracked name" \
  || bad "promoted: loader from accepted/ gave '$N'"

# must fail: a candidate that removes lib/ -> lib-sources FAIL -> refused, never promoted
git -C "$T/seed" rm -q -r scripts/substrate/lib; echo "# without its lib" >> "$T/seed/$PS"
D="$(gt_push "candidate: lib removed")"
gt_live_tick
grep -q 'shadow: FAIL - lib-sources.sh.*cannot source' "$T/out.txt" && ok "must fail: lib-sources fails without lib/" || { bad "must fail: lib-sources did not fail"; show; }
grep -q 'verdict refused.*shadow' "$T/out.txt" && no_request && ok "must fail: verdict refused, no promote.request" || { bad "must fail: not refused"; show; }
gt_live_tick
[ "$(cat "$G/accepted.sha")" = "$C" ] && ok "must fail: accepted stays at the promoted sha" || bad "must fail: accepted moved to $(cat "$G/accepted.sha")"
grep -q 'TRACKED-RED LIB MISSING' "$T/out.txt" && bad "must fail: the node froze" || ok "must fail: the node keeps converging on the accepted body"

# ── control: a body with no loader has nothing to satisfy (judged directly) ────
fresh
gt_stub_body "# a different stub" > "$T/seed/$PS"; gt_push "stub body" >/dev/null; judge
grep -q '^shadow: PASS - lib-sources.sh' "$T/cand.txt" && ok "control: a body without the loader passes lib-sources" || { bad "control: stub body failed lib-sources"; shows; }

done_tests
