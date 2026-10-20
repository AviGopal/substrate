#!/usr/bin/env bash
# gate-soak-ticks-row.test.sh: the gate's soak length is a shaped row that can only RAISE the accepted floor, and no
# row value can skip or delay a refusal (scripts/substrate/gate/candidate.sh, SOAK LENGTH; pull-sync gate_candidate).
# User ruling 2026-10-20 (via qa): soak_ticks becomes a shaped row, starting at 1.
#
# On the gate-test harness (gt_live: the REAL pull-sync, gate-runner, candidate.sh and shadow-eval), with the row
# served through pull-sync's own tuning_param read (a curl stub answers /v2/tuning-params/gate.soak_ticks):
#   (a) CONTROL: no row (null), floor 1 -> a passing candidate promotes on its first pass, and the verdict names the
#       floor it used
#   (b) a row of 3 raises it: soaking 1/3, 2/3, then promote at 3/3, the verdict naming the row
#   (c) MUST-FAIL (qa): a planted must-fail candidate with row 0 is REFUSED at tick 1 (never soaked or promoted)
#   (d) the same with rows -1, 99999, "abc" and an unreachable store: refused at tick 1 every time
#   (e) row 0 with floor 2 -> the floor applies (soaking 1/2, not an immediate promote): 0 never skips the soak
#   (f) an unreadable store and a non-integer row with floor 2 -> the floor applies, and the reason is named
#   (g) a row below the floor (1, floor 2) does not lower it
#   (h) a row above soak_ticks.max (99, max 12) is ignored, not clamped into a long stall
#   (i) MUST-FAIL (qa): a candidate whose policy LOWERS soak_ticks.default (1 -> 0) or RAISES soak_ticks.max
#       (12 -> 99) is a WIDENING, held and never promoted; the verdict names which; a candidate that only RAISES the
#       floor (1 -> 2) is not
# usage: validation/scripts/gate-soak-ticks-row.test.sh   (bash, git, jq, flock; no root)
source "$(dirname "$0")/lib/gate-test-lib.sh"

setup() { # <floor> -> a live gate whose accepted policy floor is <floor>, bootstrapped; ROW file controls the answer
  gt_live
  jq --argjson n "$1" '.soak_ticks.default=$n | .soak_ticks.max=12 | .soak_ticks.row="gate.soak_ticks"' \
    "$T/seed/scripts/substrate/gate/gate-policy.json" > "$T/p.json" && mv "$T/p.json" "$T/seed/scripts/substrate/gate/gate-policy.json"
  ROW="$T/row"; : > "$ROW"
  cat > "$T/stub/curl" <<EOF
#!/bin/sh
for a in "\$@"; do case "\$a" in */v2/tuning-params/gate.soak_ticks)
  if [ "\$(cat "$ROW")" = UNREACHABLE ]; then exit 7; fi
  if [ -s "$ROW" ]; then printf '{"name":"gate.soak_ticks","value":%s}\n200' "\$(cat "$ROW")"; else printf '{"name":"gate.soak_ticks","value":null}\n200'; fi
  exit 0 ;; esac; done
exit 7
EOF
  chmod +x "$T/stub/curl"
  A0="$(gt_push base)"; gt_live_converged; gt_live_tick
  [ "$(cat "$G/accepted.sha" 2>/dev/null)" = "$A0" ] || { bad "setup: bootstrap did not accept (rc $RC)"; show; done_tests; }
}
candidate() { # good|bad -> push a gate-path candidate that passes (good) or fails parses.sh (bad)
  if [ "$1" = good ]; then echo "true # $RANDOM" > "$T/seed/scripts/substrate/soak-probe.sh"
  else printf '\nif then fi ((\n' >> "$T/seed/scripts/substrate/substrate-pull-sync.sh"; fi
  C="$(gt_push "$1 candidate")"
}
vline() { grep -E 'gate: verdict [a-z]+' "$T/out.txt" | tail -1 | sed -E 's/.*gate: verdict //'; }
row() { printf '%s' "$1" > "$ROW"; }

# (a)
setup 1; row ""; candidate good; gt_live_tick; v="$(vline)"
[[ "$v" == promote*"shadow pass 1/1"*"soak 1: floor 1 (row gate.soak_ticks ignored: null)"* ]] && ok "(a) control: no row, floor 1 -> promote on the first pass, naming the floor" || bad "(a) got: $v"
# (b)
setup 1; row 3; candidate good; seen=""
for i in 1 2 3; do gt_live_tick; seen="$seen|$(vline | cut -c1-90)"; done
[[ "$seen" == *"soaking"*"1/3"*"soaking"*"2/3"*"promote"*"3/3"* ]] && [[ "$seen" == *"row gate.soak_ticks=3 raises floor 1"* ]] \
  && ok "(b) a row of 3 raises the floor: soaking 1/3, 2/3, promote 3/3" || bad "(b) got: $seen"
# (c)(d)
for r in 0 -1 99999 abc UNREACHABLE; do
  setup 1; row "$r"; candidate bad; vs=""
  for i in 1 2; do gt_live_tick; vs="$vs|$(vline | cut -c1-40)"; done
  if [[ "$vs" == "|refused"*"|refused"* ]] && [ "$(cat "$G/accepted.sha")" = "$A0" ] && [ "$(gt_records promote)" = 0 ]; then
    ok "$( [ "$r" = 0 ] && echo "(c)" || echo "(d)") a planted must-fail candidate with row '$r' is refused at tick 1 (and stays refused)"
  else bad "$( [ "$r" = 0 ] && echo "(c)" || echo "(d)") row '$r': $vs"; fi
done
# (e)
setup 2; row 0; candidate good; gt_live_tick; v="$(vline)"
[[ "$v" == soaking*"1/2"*"row gate.soak_ticks ignored: 0 is outside 1..12"* ]] && ok "(e) row 0 never skips the soak: floor 2 applies (soaking 1/2)" || bad "(e) got: $v"
# (f)
setup 2; row UNREACHABLE; candidate good; gt_live_tick; v1="$(vline)"
setup 2; row abc; candidate good; gt_live_tick; v2="$(vline)"
[[ "$v1" == soaking*"1/2"*"ignored: unreachable"* ]] && [[ "$v2" == soaking*"1/2"*"ignored:"* ]] \
  && ok "(f) an unreadable store and a non-integer row fall back to the floor, naming why" || bad "(f) got: $v1 // $v2"
# (g)
setup 2; row 1; candidate good; gt_live_tick; v="$(vline)"
[[ "$v" == soaking*"1/2"*"row gate.soak_ticks=1 does not raise it"* ]] && ok "(g) a row below the floor does not lower it" || bad "(g) got: $v"
# (h)
setup 2; row 99; candidate good; gt_live_tick; v="$(vline)"
[[ "$v" == soaking*"1/2"*"99 is outside 1..12"* ]] && ok "(h) a row above max is ignored (floor 2), not clamped to a long stall" || bad "(h) got: $v"
# (i)
polcand() { # <jq filter> -> push a candidate that only edits the policy
  jq "$1" "$T/seed/scripts/substrate/gate/gate-policy.json" > "$T/p.json" && mv "$T/p.json" "$T/seed/scripts/substrate/gate/gate-policy.json"
  C="$(gt_push "policy candidate")"; }
held() { # <jq filter> -> the first-tick verdict, and HELD when a second tick still leaves accepted.sha on A0
  setup 1; row ""; polcand "$1"; gt_live_tick; local v; v="$(vline)"; gt_live_tick
  [ "$(cat "$G/accepted.sha")" = "$A0" ] && [ "$(gt_records promote)" = 0 ] && echo "HELD $v" || echo "PROMOTED $v"; }
v1="$(held '.soak_ticks.default=0')"; v2="$(held '.soak_ticks.max=99')"; v3="$(held '.soak_ticks.default=2')"
[[ "$v1" == "HELD widening"*"lowers soak_ticks.default 1 -> 0"* ]] && [[ "$v2" == "HELD widening"*"raises soak_ticks.max 12 -> 99"* ]] \
  && [[ "$v3" == *promote* ]] \
  && ok "(i) lowering the floor or raising the cap is a named widening, still held after a second tick; raising the floor promotes" \
  || bad "(i) got: [$v1] [$v2] [$v3]"
done_tests
