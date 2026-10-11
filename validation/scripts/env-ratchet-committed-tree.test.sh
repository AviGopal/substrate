#!/usr/bin/env bash
# env-ratchet-committed-tree.test.sh: the env ratchet judged on a COMMITTED TREE, not a staged diff. The pre-commit block
# (scripts/git-hooks/pre-commit, "env ratchet") is skippable: `git commit --no-verify`, or a clone with no hook installed.
# This check reads only files, so it judges whatever tree it is run on (run-glue-tests.sh --root <git-archive export>):
#   1. every Environment= name and every EnvironmentFile= path set under scripts/substrate/units/** is in
#      scripts/git-hooks/env-ratchet/bootstrap-allowlist.txt ∪ grandfathered-behaviour.txt;
#   2. grandfathered-behaviour.txt ⊆ FROZEN_GRANDFATHERED below, so the list cannot be widened in the same commit
#      that adds the line (this copy shrinks with the list; adding a name here is the same widening, in review);
#   3. every allowlist entry carries a reason (two words or more); no name is in both lists; no grandfathered name is
#      dead (set by no unit), so the list shrinks with the lines.
# Cases: a positive control on THIS tree, then must-fails on git-archive exports of scratch commits made with --no-verify.
#
# WHERE THIS RUNS, AND WHAT IT DOES NOT BLOCK. run-glue-tests.sh is called by the pre-commit hook and by the acceptance
# run, never by pull-sync: a super-repo head converges (ff-only pull) without the glue corpus running, so a red here does
# NOT stop a bypassed commit from converging. What pull-sync does judge, in gated mode, is a commit touching a gate path
# (scripts/substrate/*, which includes units/): gate/candidate.sh runs the ACCEPTED fixture corpus
# (validation/scripts/gate/fixtures/*.sh, via gate/shadow-eval.sh) against the candidate's scripts/substrate, and the
# candidate's units are not installed until promotion. A blocking form of this check belongs in that corpus.
set -uo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"; ROOT="$(cd "$HERE/../.." && pwd)"
T="$(mktemp -d "${TMPDIR:-/tmp}/ertree.XXXXXX")"; trap 'rm -rf "$T"' EXIT
FAILS=0; ok() { echo "ok   - $*"; }; bad() { echo "FAIL - $*"; FAILS=$((FAILS+1)); }

# The frozen copy. Shrink-only, like the list it bounds.
FROZEN_GRANDFATHERED="AUTO_DESCRIBE_RESOLVERS BOREDOM_AUTOPROMOTE_INTERVAL_MS BOREDOM_DAEMON_MODE BOREDOM_EXERCISE_INTERVAL_MS
BOREDOM_IDLE_WINDOW_SECONDS BOREDOM_IN_FLIGHT_TIMEOUT_MS BOREDOM_MAX_CONCURRENT BOREDOM_MIN_DISPATCH_INTERVAL_MS
BOREDOM_POOL_LOOP_INTERVAL_MS BOREDOM_STATE_REFRESH_MS DB_MAINTENANCE EMIT_GAPS EXTRA_WORKSPACE_ROOTS GOAL_HOST_BEHAVIOR_LIMIT
GOAL_HOST_BEHAVIOR_WINDOW_HOURS GOAL_HOST_DRAIN_MS GOAL_HOST_WS_SUBSCRIBER MAX_PEER_DEPTH MITOSIS_DIRECT_PUSH OBSIDIAN_LEARN_GRANT
OBSIDIAN_LEARN_MAX OBSIDIAN_LEARN_MODE OPERATOR_GOAL_GEN PEER_FANOUT_MODE PREFER_LIBP2P_ROUTE RECOVER_CAP REPAIR SELF_DEV_TREND
SURGICAL_SCAN_CAP SURREAL_ROCKSDB_BLOCK_CACHE_SIZE TASK_GENERATION_ENABLED VESSEL_DRAIN_MS WATCHDOG_RELEVANT_SHAPE
WATCHDOG_RESTART_IMPULSE WATCHDOG_ROUTE_FILTER WATCHDOG_STALL_MIN"

# check_tree <root>: prints one "violation: …" line per breach; exit 0 when none.
check_tree() {
  local r="$1" u="$1/scripts/substrate/units" l="$1/scripts/git-hooks/env-ratchet" v=0 n p names paths b g
  [ -d "$u" ] || { echo "violation: no scripts/substrate/units under $r"; return 1; }
  [ -f "$l/bootstrap-allowlist.txt" ] || { echo "violation: no bootstrap-allowlist.txt (fail closed)"; return 1; }
  [ -f "$l/grandfathered-behaviour.txt" ] || { echo "violation: no grandfathered-behaviour.txt (fail closed)"; return 1; }
  ents() { sed -e 's/^[[:space:]]*//' -e '/^#/d' -e '/^$/d' "$1"; }
  b="$(ents "$l/bootstrap-allowlist.txt" | awk '{print $1}')"; g="$(ents "$l/grandfathered-behaviour.txt" | awk '{print $1}')"
  local files; files="$(find "$u" -type f \( -regex '.*/units/[^/]*\.\(service\|timer\|socket\|path\|target\|mount\)' -o -regex '.*/units/[^/]*\.d/[^/]*\.conf' \))"
  names="$(printf '%s\n' "$files" | xargs -r cat | sed -nE 's/^[[:space:]]*Environment[[:space:]]*=(.*)$/\1/p' \
    | /usr/bin/grep -oE '(^|[[:space:]])"?[A-Za-z_][A-Za-z0-9_]*=' | sed -E 's/^[[:space:]]*"?//; s/=$//' | sort -u)"
  paths="$(printf '%s\n' "$files" | xargs -r cat | sed -nE 's/^[[:space:]]*EnvironmentFile[[:space:]]*=[[:space:]]*-?(.*)$/\1/p' \
    | sed -E 's/^"//; s/"?[[:space:]]*$//' | sort -u)"
  for n in $names; do
    /usr/bin/grep -qxF -- "$n" <<<"$b" || /usr/bin/grep -qxF -- "$n" <<<"$g" || { echo "violation: a unit sets $n, in neither list"; v=1; }
  done
  for p in $paths; do /usr/bin/grep -qxF -- "$p" <<<"$b" || { echo "violation: a unit loads EnvironmentFile=$p, not pinned"; v=1; }; done
  for n in $g; do
    /usr/bin/grep -qxF -- "$n" <<<"$(tr ' ' '\n' <<<"$FROZEN_GRANDFATHERED")" || { echo "violation: grandfathered list names $n, outside the frozen copy (a widening)"; v=1; }
    /usr/bin/grep -qxF -- "$n" <<<"$b" && { echo "violation: $n is in both lists"; v=1; }
    /usr/bin/grep -qxF -- "$n" <<<"$names" || { echo "violation: grandfathered $n is set by no unit (remove it; the list shrinks)"; v=1; }
  done
  while IFS= read -r n; do [ -n "$n" ] && { echo "violation: allowlist entry $n has no reason"; v=1; }; done \
    < <(ents "$l/bootstrap-allowlist.txt" | awk 'NF<3{print $1}')
  return "$v"
}

# Positive control: this tree (a git-archive export of the commit, under the runner) passes.
if out="$(check_tree "$ROOT")"; then ok "the tree under test passes the env ratchet invariants"; else bad "the tree under test breaks the env ratchet: $(head -5 <<<"$out" | tr '\n' ';')"; fi

# Scratch repo seeded with this tree's units and lists; each case is a --no-verify commit, judged on its git-archive export.
G() { git -c user.name=t -c user.email=t@t -c init.defaultBranch=dev -c core.hooksPath=/dev/null "$@"; }
R="$T/r"; G init -q "$R"; mkdir -p "$R/scripts/substrate" "$R/scripts/git-hooks"
cp -r "$ROOT/scripts/substrate/units" "$R/scripts/substrate/units"; cp -r "$ROOT/scripts/git-hooks/env-ratchet" "$R/scripts/git-hooks/env-ratchet"
G -C "$R" add -A; G -C "$R" commit -qm base --no-verify; G -C "$R" tag base
judge() { rm -rf "$T/x"; mkdir -p "$T/x"; G -C "$R" archive HEAD | tar -x -C "$T/x"; check_tree "$T/x" > "$T/out" 2>&1; }
commit_nv() { G -C "$R" add -A; G -C "$R" commit -qm "$1" --no-verify; }
fails() { # <label> <must-name>
  if judge; then bad "$1: the committed tree PASSED"; elif /usr/bin/grep -qF -- "$2" "$T/out"; then ok "$1"; else bad "$1: failed without naming '$2': $(head -3 "$T/out" | tr '\n' ' ')"; fi
  G -C "$R" reset -q --hard base; }
judge && ok "positive control: the seeded scratch commit passes" || bad "positive control: the seeded scratch commit fails: $(head -3 "$T/out" | tr '\n' ' ')"

printf 'Environment=GOAL_HOST_FAST_MODE=1\n' >> "$R/scripts/substrate/units/goal-host-vessel.service"; commit_nv "behaviour line, hook skipped"
fails "a --no-verify commit adding a behaviour Environment= line fails the tree check" "GOAL_HOST_FAST_MODE"

mkdir -p "$R/scripts/substrate/units/goal-host-vessel.service.d"
printf '[Service]\nEnvironment=SATISFIER_PROVEN_BAD_ARMED=1\n' > "$R/scripts/substrate/units/goal-host-vessel.service.d/50-satisfier-suppression.conf"; commit_nv "drop-in, hook skipped"
fails "a --no-verify commit adding the satisfier drop-in fails the tree check" "SATISFIER_PROVEN_BAD_ARMED"

printf 'Environment=GOAL_HOST_FAST_MODE=1\n' >> "$R/scripts/substrate/units/goal-host-vessel.service"
echo "GOAL_HOST_FAST_MODE  switch" >> "$R/scripts/git-hooks/env-ratchet/grandfathered-behaviour.txt"; commit_nv "line + widened grandfathered list"
fails "a --no-verify commit that also widens the grandfathered list fails (frozen copy)" "outside the frozen copy"

printf 'EnvironmentFile=-/etc/substrate/retention-hold.env\n' >> "$R/scripts/substrate/units/activity-api.service"; commit_nv "unpinned env file"
fails "a --no-verify commit loading an unpinned EnvironmentFile= fails" "retention-hold.env"

echo "RELAY_URL" >> "$R/scripts/git-hooks/env-ratchet/bootstrap-allowlist.txt"; commit_nv "reasonless entry"
fails "an allowlist entry without a reason fails" "RELAY_URL has no reason"

G -C "$R" rm -q scripts/git-hooks/env-ratchet/bootstrap-allowlist.txt; G -C "$R" commit -qm "no allowlist" --no-verify
fails "a tree without the allowlist fails closed" "fail closed"

sed -i '/^Environment=GOAL_HOST_WS_SUBSCRIBER=/d' "$R/scripts/substrate/units/goal-host-vessel.service"; commit_nv "remove a grandfathered line, keep the name"
fails "removing the last line of a grandfathered switch without shrinking the list fails" "GOAL_HOST_WS_SUBSCRIBER is set by no unit"
sed -i '/^Environment=GOAL_HOST_WS_SUBSCRIBER=/d' "$R/scripts/substrate/units/goal-host-vessel.service"
sed -i '/^GOAL_HOST_WS_SUBSCRIBER /d' "$R/scripts/git-hooks/env-ratchet/grandfathered-behaviour.txt"; commit_nv "shrink"
judge && ok "removing a grandfathered line together with its list entry passes (the list shrinks)" || bad "a shrink failed: $(head -3 "$T/out" | tr '\n' ' ')"

echo; [ "$FAILS" = 0 ] && { echo PASS; exit 0; } || { echo "$FAILS FAILED"; exit 1; }
