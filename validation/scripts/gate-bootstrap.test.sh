#!/usr/bin/env bash
# Pinned judge, bootstrap (scripts/substrate/gate/gate-runner.sh): the first gated tick stages
# the clone's COMMITTED HEAD by git archive as accepted/, writes accepted.sha and ONE L12
# `bootstrap` record, and runs the body from accepted/ — never the clone's working tree or a
# local commit origin lacks. Idempotent: later ticks add no bootstrap record and keep the sha.
#   must fail   HEAD without gate-policy.json -> exit 3, a GAP line, nothing staged, no body run
# usage: validation/scripts/gate-bootstrap.test.sh   (bash, git, jq, flock; no root)
source "$(dirname "$0")/lib/gate-test-lib.sh"

gt_repo
HEAD0="$(git -C "$T/super" rev-parse HEAD)"
# The clone's working tree and a local, unpushed commit both carry a body that drops a marker.
gt_stub_body ": > \"$T/WT-RAN\"" > "$T/super/scripts/substrate/substrate-pull-sync.sh"
g "$T/super" commit -am "local, not on origin"
gt_stub_body ": > \"$T/WT-RAN\"; echo dirty" > "$T/super/scripts/substrate/substrate-pull-sync.sh"

gt_runner tick
[ "$RC" = 0 ] && ok "first tick exits 0" || { bad "first tick exit $RC"; show; }
[ "$(cat "$G/accepted.sha" 2>/dev/null)" = "$HEAD0" ] && ok "accepted.sha = origin/dev's commit (the local commit is not a landing)" || bad "accepted.sha is '$(cat "$G/accepted.sha" 2>/dev/null)', want $HEAD0"
[ "$(gt_records bootstrap)" = 1 ] && ok "one bootstrap record" || bad "$(gt_records bootstrap) bootstrap records"
jq -e --arg s "$HEAD0" 'select(.kind=="bootstrap") | .sha==$s and .by=="bootstrap" and (.at|length>0) and (.node|length>0)' "$G/ledger.jsonl" >/dev/null \
  && ok "the bootstrap record carries sha, by, node, time" || bad "bootstrap record incomplete: $(cat "$G/ledger.jsonl")"
[ ! -e "$T/WT-RAN" ] && ok "nothing from the clone's working tree or local commit ran" || bad "clone content was EXECUTED"
grep -q "body $G/accepted/scripts/substrate/substrate-pull-sync.sh acc=$G/accepted\$" "$GT_RUNS" && ok "the body ran from accepted/ with PULLSYNC_ACCEPTED_DIR set" || bad "body runs: $(cat "$GT_RUNS")"
jq -e '.files["scripts/substrate/substrate-pull-sync.sh"] and .files["scripts/substrate/gate/gate-policy.json"] and .files["validation/scripts/gate/fixtures/parses.sh"] and (.files["scripts/substrate/other.sh"]|not) and (.gate_paths|length>0)' \
  "$G/accepted/MANIFEST.json" >/dev/null && ok "MANIFEST holds the gate paths only, with their globs" || bad "MANIFEST: $(cat "$G/accepted/MANIFEST.json")"
[ "$(stat -c %a "$G")" = 700 ] && ok "gate dir is 0700" || bad "gate dir mode $(stat -c %a "$G")"

gt_runner tick; gt_runner tick
[ "$RC" = 0 ] && [ "$(gt_records bootstrap)" = 1 ] && [ "$(cat "$G/accepted.sha")" = "$HEAD0" ] \
  && ok "idempotent: two more ticks, still one bootstrap record and the same sha" || { bad "not idempotent (rc $RC, $(gt_records bootstrap) records)"; show; }
[ "$(gt_runs)" = 3 ] && ok "the accepted body ran once per tick" || bad "$(gt_runs) body runs for 3 ticks"

# must fail: no policy at HEAD -> nothing staged, nothing run
gt_repo; git -C "$T/seed" rm -q scripts/substrate/gate/gate-policy.json; gt_push "drop policy" >/dev/null
gt_runner tick
[ "$RC" = 3 ] && ok "no policy: exit 3" || bad "no policy: exit $RC"
grep -q 'GAP gate-bootstrap-failed' "$T/out.txt" && ok "no policy: a GAP line in the journal" || { bad "no policy: no GAP line"; show; }
[ ! -e "$G/accepted.sha" ] && [ "$(gt_runs)" = 0 ] && ok "no policy: nothing accepted, no body run" || bad "no policy: accepted or ran anyway"
done_tests
