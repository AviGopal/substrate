#!/usr/bin/env bash
# J1 (runner level): a candidate gate body is NOT executed before acceptance. After bootstrap,
# a pushed commit whose body drops a marker reaches the node's clone; the tick runs the
# ACCEPTED body only, and accepted.sha does not move.
#   positive control  a promote.request naming that sha (what the accepted body writes after
#                     shadow pass + soak) -> the runner stages it by git archive, writes a
#                     `promote` record, keeps the old version in history/, and the candidate
#                     now runs: the marker is reachable through the same address.
#   ignored requests  malformed sha, or a sha absent from the mirror -> no promotion
# The DEPLOYED J1 row (an open() from inside development-vessel's namespace on
# /workspace/.gate -> ENOENT/EACCES) is a live check on node 2, per ROLLOUT.md.
# usage: validation/scripts/gate-j1-candidate-not-run.test.sh   (bash, git, jq, flock; no root)
source "$(dirname "$0")/lib/gate-test-lib.sh"

gt_repo; A0="$(git -C "$T/super" rev-parse HEAD)"
gt_runner tick; [ "$RC" = 0 ] || { bad "bootstrap tick exit $RC"; show; }
gt_stub_body ": > \"$T/CAND-RAN\"" > "$T/seed/scripts/substrate/substrate-pull-sync.sh"
C1="$(gt_push candidate)"
: > "$GT_RUNS"; gt_runner tick
[ "$RC" = 0 ] && ok "tick with a candidate in the clone exits 0" || { bad "exit $RC"; show; }
[ ! -e "$T/CAND-RAN" ] && ok "the candidate body was NOT executed" || bad "the candidate body RAN before acceptance"
[ "$(cat "$G/accepted.sha")" = "$A0" ] && ok "accepted.sha unchanged" || bad "accepted.sha moved to $(cat "$G/accepted.sha")"
grep -q "body $G/accepted/" "$GT_RUNS" && ok "the accepted body ran" || bad "the accepted body did not run"

printf 'not json' > "$G/promote.request"; gt_runner tick
[ "$(cat "$G/accepted.sha")" = "$A0" ] && [ ! -e "$T/CAND-RAN" ] && [ ! -e "$G/promote.request" ] && ok "a malformed request is ignored and removed" || bad "a malformed request changed something"
printf '{"sha":"%s"}' "$(printf 'f%.0s' $(seq 40))" > "$G/promote.request"; gt_runner tick
[ "$(cat "$G/accepted.sha")" = "$A0" ] && [ ! -e "$T/CAND-RAN" ] && ok "a sha absent from the mirror is ignored" || bad "an unknown sha was promoted"

printf '{"sha":"%s","verdict_trace_id":"shadow:test"}' "$C1" > "$G/promote.request"; gt_runner tick
[ "$(cat "$G/accepted.sha")" = "$C1" ] && ok "control: the requested candidate is promoted" || { bad "control: not promoted"; show; }
[ -e "$T/CAND-RAN" ] && ok "control: the promoted body runs (the marker is reachable)" || bad "control: promoted body did not run"
jq -e --arg s "$C1" --arg f "$A0" 'select(.kind=="promote") | .sha==$s and .from_sha==$f and (.evidence|test("shadow:test"))' "$G/ledger.jsonl" >/dev/null \
  && ok "control: promote record with from_sha and the request as evidence" || bad "control: promote record: $(cat "$G/ledger.jsonl")"
[ -d "$G/history/$A0" ] && [ "$(tail -n1 "$G/history.order")" = "$A0" ] && ok "control: the previous version is kept in history/" || bad "control: no history/$A0"
[ ! -e "$G/promote.request" ] && ok "control: the request is consumed" || bad "control: request left behind"
done_tests
