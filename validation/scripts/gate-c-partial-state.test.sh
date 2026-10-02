#!/usr/bin/env bash
# (c) absence is not a state. "Bootstrapped" is ANY of accepted.sha, accepted/, history/,
# ledger.jsonl or the bootstrapped marker; entrypoint pre-creates /workspace/.gate, so the
# directory is no signal.
#   must fail   a bootstrapped node that lost accepted.sha (alone, or with only the ledger /
#               only history/ left) -> exit 3, GAP gate-state-partial, a notice in the gate's
#               store, no body run, NO silent re-bootstrap (accepted.sha stays absent)
#   control     an empty pre-created dir bootstraps; `rebootstrap --confirm` (host CLI) re-stages
#               over partial state with a `rebootstrap` record, and the next tick runs
#   also        rebootstrap without --confirm -> 64, nothing changes
# The unit's own ungated-fallback guard is covered in gate-j9-no-self-exec.test.sh.
# usage: validation/scripts/gate-c-partial-state.test.sh   (bash, git, jq, flock; no root)
source "$(dirname "$0")/lib/gate-test-lib.sh"
refuses() { # label
  : > "$GT_RUNS"; gt_runner tick
  [ "$RC" = 3 ] && ok "$1: exit 3" || { bad "$1: exit $RC"; show; }
  grep -q 'GAP gate-state-partial' "$T/out.txt" && ok "$1: GAP gate-state-partial" || bad "$1: no GAP line"
  [ "$(gt_runs)" = 0 ] && ok "$1: no body ran" || bad "$1: a body RAN"
  [ ! -e "$G/accepted.sha" ] && [ "$(gt_records bootstrap)" = 1 ] && ok "$1: no silent re-bootstrap" || bad "$1: re-bootstrapped silently"
  jq -e 'select(.kind=="gate_state_partial")' "$G/notices.jsonl" >/dev/null 2>&1 && ok "$1: notice in the gate's store" || bad "$1: no notice"
}
gt_repo; mkdir -p "$G"; gt_runner tick
[ "$RC" = 0 ] && [ -f "$G/accepted.sha" ] && ok "control: an empty pre-created gate dir bootstraps" || { bad "control: bootstrap rc $RC"; show; }
gt_stub_body "# v1" > "$T/seed/scripts/substrate/substrate-pull-sync.sh"; A1="$(gt_push v1)"
printf '{"sha":"%s"}' "$A1" > "$G/promote.request"; gt_runner tick   # history/ now holds the bootstrap version

rm -f "$G/accepted.sha"; refuses "accepted.sha lost"
rm -rf "$G/accepted" "$G/history" "$G/history.order" "$G/bootstrapped"; rm -f "$G/notices.jsonl"; refuses "only ledger.jsonl left"
mv "$G/ledger.jsonl" "$T/ledger.keep"; mkdir -p "$G/history/x"; rm -f "$G/notices.jsonl"; : > "$GT_RUNS"; gt_runner tick
[ "$RC" = 3 ] && [ ! -e "$G/accepted.sha" ] && [ "$(gt_runs)" = 0 ] && ok "only history/ left: refused" || { bad "only history/: rc $RC"; show; }
mv "$T/ledger.keep" "$G/ledger.jsonl"

gt_runner rebootstrap
[ "$RC" = 64 ] && [ ! -e "$G/accepted.sha" ] && ok "rebootstrap without --confirm: 64, nothing changes" || bad "rebootstrap w/o confirm: rc $RC"
gt_runner rebootstrap --confirm
[ "$RC" = 0 ] && [ "$(cat "$G/accepted.sha" 2>/dev/null)" = "$A1" ] && ok "control: rebootstrap --confirm re-stages HEAD" || { bad "control: rebootstrap rc $RC"; show; }
jq -e 'select(.kind=="rebootstrap") | .by|startswith("operator:")' "$G/ledger.jsonl" >/dev/null && [ "$(gt_records bootstrap)" = 2 ] \
  && ok "control: rebootstrap + bootstrap records in the ledger" || bad "control: records $(cat "$G/ledger.jsonl")"
: > "$GT_RUNS"; gt_runner tick
[ "$RC" = 0 ] && [ "$(gt_runs)" = 1 ] && ok "control: the next tick runs the accepted body" || { bad "control: next tick rc $RC"; show; }
done_tests
