#!/usr/bin/env bash
# Pinned judge, integrity fallback (gate-runner.sh): accepted/ is checked against its MANIFEST
# sha256s (exact file set) before anything runs.
#   must fail   one accepted file edited -> its content is NEVER executed
#   must fail   a file planted in accepted/ -> treated as a mismatch
#   control     history/<previous> is restored automatically, an integrity_fallback record
#               is written, the corrupted copy is kept in rejected/ for forensics
#   body rule   the accepted body exiting >=2 on body_fail_limit (3) consecutive ticks ->
#               the same fallback; an exit <2 resets the count
# usage: validation/scripts/gate-integrity.test.sh   (bash, git, jq, flock; no root)
source "$(dirname "$0")/lib/gate-test-lib.sh"

setup() { # bootstrap A0, then promote A1 so history holds A0
  gt_repo; A0="$(git -C "$T/super" rev-parse HEAD)"; gt_runner tick
  gt_stub_body "# v1" > "$T/seed/scripts/substrate/substrate-pull-sync.sh"; A1="$(gt_push v1)"
  printf '{"sha":"%s"}' "$A1" > "$G/promote.request"; gt_runner tick
  [ "$(cat "$G/accepted.sha")" = "$A1" ] || { bad "setup: A1 not promoted"; show; }
  : > "$GT_RUNS"
}

setup
sed -i "1a : > \"$T/TAMPER-RAN\"" "$G/accepted/scripts/substrate/substrate-pull-sync.sh"   # runs first if run
gt_runner tick
[ ! -e "$T/TAMPER-RAN" ] && ok "edited accepted file: its content never ran" || bad "edited accepted content was EXECUTED"
[ "$(cat "$G/accepted.sha")" = "$A0" ] && ok "edited: history/$A0 restored as accepted" || { bad "edited: accepted.sha $(cat "$G/accepted.sha")"; show; }
jq -e --arg s "$A0" --arg f "$A1" 'select(.kind=="integrity_fallback") | .sha==$s and .from_sha==$f' "$G/ledger.jsonl" >/dev/null \
  && ok "edited: integrity_fallback record (sha, from_sha)" || bad "edited: no integrity_fallback record"
[ -d "$G/rejected/$A1" ] && ok "edited: the corrupted copy is kept in rejected/" || bad "edited: no rejected/$A1"
grep -q "body $G/accepted/" "$GT_RUNS" && [ "$RC" = 0 ] && ok "edited: the restored version ran this tick" || bad "edited: restored version did not run (rc $RC)"

setup
echo 'planted' > "$G/accepted/scripts/substrate/planted.sh"
gt_runner tick
[ "$(cat "$G/accepted.sha")" = "$A0" ] && [ "$(gt_records integrity_fallback)" = 1 ] && ok "planted file: mismatch, fallback" || bad "planted file not detected"

setup
GT_BODY_RC=2 gt_runner tick; GT_BODY_RC=2 gt_runner tick
[ "$(cat "$G/accepted.sha")" = "$A1" ] && ok "body exit 2 twice: no fallback yet" || bad "fell back before the limit"
GT_BODY_RC=0 gt_runner tick; GT_BODY_RC=2 gt_runner tick; GT_BODY_RC=2 gt_runner tick
[ "$(cat "$G/accepted.sha")" = "$A1" ] && ok "an exit 0 resets the count" || bad "count not reset by a clean exit"
GT_BODY_RC=137 gt_runner tick
[ "$RC" = 137 ] && ok "the body's exit code propagates" || bad "rc $RC, want 137"
[ "$(cat "$G/accepted.sha")" = "$A0" ] && jq -e 'select(.kind=="integrity_fallback") | .evidence|test("consecutive")' "$G/ledger.jsonl" >/dev/null \
  && ok "three consecutive >=2 exits: fallback with the reason recorded" || { bad "no body-failure fallback"; show; }
done_tests
