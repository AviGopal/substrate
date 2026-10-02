#!/usr/bin/env bash
# Pinned judge, break-glass (gate-runner.sh rollback-gate). Scratch layout only; never a live
# node (ROLLOUT.md).
#   must fail   accepted/ AND every history/ version corrupted -> the runner refuses: exit 3,
#               no body runs, a GAP line names the break-glass. It never falls back to the
#               image on its own (the image is built unjudged from every dev push).
#   control     rollback-gate --image restores accepted/ from the image's copy; the next
#               tick runs; a `rollback` record names the operator and the command
#   also        --to <sha> from history, --to <sha> from the mirror when history lacks it,
#               --previous, an image revision that is not a commit (accepted.sha image:<rev>),
#               usage errors exit 64
# usage: validation/scripts/gate-break-glass.test.sh   (bash, git, jq, flock; no root)
source "$(dirname "$0")/lib/gate-test-lib.sh"

gt_repo; A0="$(git -C "$T/super" rev-parse HEAD)"; gt_runner tick
gt_stub_body "# v1" > "$T/seed/scripts/substrate/substrate-pull-sync.sh"; A1="$(gt_push v1)"
printf '{"sha":"%s"}' "$A1" > "$G/promote.request"; gt_runner tick
# the image: scripts/substrate only (no validation/), as Dockerfile.substrate bakes it
mkdir -p "$T/image"; git -C "$T/super" archive "$A0" -- scripts/substrate | tar -x -C "$T/image"
echo "$A0" > "$T/image-revision"

for d in "$G/accepted" "$G"/history/*/; do sed -i "1a : > \"$T/CORRUPT-RAN\"" "$d/scripts/substrate/substrate-pull-sync.sh"; done
: > "$GT_RUNS"; gt_runner tick
[ "$RC" = 3 ] && ok "all versions corrupt: exit 3" || bad "all corrupt: exit $RC"
[ "$(gt_runs)" = 0 ] && [ ! -e "$T/CORRUPT-RAN" ] && ok "all corrupt: no body ran" || bad "all corrupt: a body RAN"
grep -q 'GAP gate-no-valid-accepted-version.*rollback-gate --image' "$T/out.txt" && ok "all corrupt: GAP line names the break-glass" || { bad "all corrupt: no GAP line"; show; }
[ "$(gt_records rollback)" = 0 ] && ok "all corrupt: no automatic image fallback" || bad "the runner fell back to the image on its own"

gt_runner rollback-gate --image
[ "$RC" = 0 ] && ok "--image: exit 0" || { bad "--image: exit $RC"; show; }
[ "$(cat "$G/accepted.sha")" = "$A0" ] && ok "--image: accepted.sha = the image revision (a commit in the mirror)" || bad "--image: accepted.sha $(cat "$G/accepted.sha")"
jq -e 'select(.kind=="rollback") | (.by|startswith("operator:")) and (.evidence|test("--image"))' "$G/ledger.jsonl" >/dev/null \
  && ok "--image: rollback record (operator, command)" || bad "--image: rollback record: $(tail -n1 "$G/ledger.jsonl")"
gt_runner tick
[ "$RC" = 0 ] && [ "$(gt_runs)" = 1 ] && [ ! -e "$T/CORRUPT-RAN" ] && ok "--image: the next tick runs the restored gate" || { bad "--image: next tick rc $RC runs $(gt_runs)"; show; }

gt_runner rollback-gate --to "$A1"
[ "$RC" = 0 ] && [ "$(cat "$G/accepted.sha")" = "$A1" ] && ok "--to <sha> not in valid history: staged from the mirror" || { bad "--to from mirror: rc $RC"; show; }
gt_runner rollback-gate --previous
[ "$RC" = 0 ] && [ "$(cat "$G/accepted.sha")" = "$A0" ] && ok "--previous: back to the version before" || { bad "--previous: rc $RC sha $(cat "$G/accepted.sha")"; show; }
gt_runner rollback-gate --to "$A1"
[ "$RC" = 0 ] && [ "$(cat "$G/accepted.sha")" = "$A1" ] && [ "$(gt_records rollback)" = 4 ] && ok "--to <sha> from history; one record per rollback" || bad "--to from history: rc $RC, $(gt_records rollback) records"
gt_runner rollback-gate --to "$(printf 'e%.0s' $(seq 40))"
[ "$RC" = 3 ] && [ "$(cat "$G/accepted.sha")" = "$A1" ] && ok "--to an unknown sha: refused, accepted unchanged" || bad "--to unknown: rc $RC"
echo "not-a-commit" > "$T/image-revision"; gt_runner rollback-gate --image
[ "$(cat "$G/accepted.sha")" = "image:not-a-commit" ] && ok "--image with a non-commit revision: accepted.sha image:<rev>" || bad "--image non-commit: $(cat "$G/accepted.sha")"
gt_runner rollback-gate --bogus; [ "$RC" = 64 ] && ok "usage error: exit 64" || bad "usage: exit $RC"
gt_runner; [ "$RC" = 64 ] && ok "no verb: exit 64" || bad "no verb: exit $RC"
done_tests
