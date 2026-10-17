#!/usr/bin/env bash
# goal-direction-roundtrip.check.sh: a satisfier outcome keyed by GOAL DIRECTION must read back through the exact call the
# (c1) reader makes ((c1), user ruling 2026-10-17T08:34:28Z: "Build the key now, read post-run").
#
#   goal-direction-roundtrip.check.sh
#
# Endpoints are never hardcoded: activity-api is the client config's .metabob.endpoint (the config substrate-connect
# emits; SUBSTRATE_CLIENT_CONFIG overrides its path).
#
# goal-host's satisfier traces carry the walk's target set (metadata.goal_target_shapes); activity-api derives the
# goal-direction bucket with goalDirectionSignature at signature_version 3 and grades the outcome into it; goal-host's
# reader asks thompson_posterior {activity_id, goal_target_shapes} and refuses any answer not keyed by that bucket and
# version (no global fallback). Before the fix every satisfier had ONE constant pool bucket, so two goal classes shared a
# verdict.
#
# Steps (each through the consumer's own call, no shared helper):
#   1. two marker outcomes, graded at insert (reached:true, an llm-tier task so the tier skip does not apply), one per
#      target set: F1-class {probeRegistryCount} and H3-class {probeCurrentEventsDigest, probeWebSearchResult};
#   2. read each back with the reader's exact pointer {type: thompson_posterior, activity_id, goal_target_shapes}.
# Must-fail (red on the parent): the answer is keyed by the bucket (metadata.context_bucket) at signature_version 3,
# the two buckets DIFFER, and each reads back with n > 0. On an activity-api without the partition the reader's pointer
# is answered from the aggregate row (signature_version 1, no bucket): red.
# Intervention record (law 12): each run writes TWO traces for the marker arm probe:goal-direction-roundtrip, which has
# no template, so no selection path picks it; exclude it from every reading (as qa M-5g does for the tier marker).
#
# Not a *.test.sh: it runs against a live node and is committed red (check first).
set -uo pipefail
CFG="${SUBSTRATE_CLIENT_CONFIG:-$HOME/.substrate/config.json}"
[ -r "$CFG" ] || { echo "REFUSED: no readable client config $CFG (run substrate-connect, or set SUBSTRATE_CLIENT_CONFIG)"; exit 2; }
AA=$(jq -r '.metabob.endpoint // empty' "$CFG"); [ -n "$AA" ] || { echo "REFUSED: client config $CFG names no activity-api endpoint (.metabob.endpoint)"; exit 2; }
AA="${AA%/}"
KEYFILE="${SUBSTRATE_OPERATOR_KEY_FILE:-$HOME/.config/substrate/operator-admin-key.json}"
MARKER="probe:goal-direction-roundtrip"
FAILS=0; ok() { echo "ok   - $*"; }; bad() { echo "FAIL - $*"; FAILS=$((FAILS+1)); }
[ -r "$KEYFILE" ] || { echo "REFUSED: no readable operator key file (set SUBSTRATE_OPERATOR_KEY_FILE)"; exit 2; }
K=$(jq -r '.body.data.key // .key // empty' "$KEYFILE"); [ -n "$K" ] || { echo "REFUSED: key file has no key"; exit 2; }

# call <base-url> <path> <json-body>: POST with the key on curl's stdin config (never in argv or output).
call() {
  printf 'header = "Authorization: ApiKey %s"\nheader = "content-type: application/json"\n' "$K" |
    curl -s -m60 -K - -X POST "$1$2" --data-binary "$3" 2>/dev/null
}
# read <targets-json>: the (c1) reader's exact pointer -> "bucket version n"
readback() {
  call "$AA" /v2/impulses/resolve "$(jq -cn --arg a "$MARKER" --argjson t "$1" '{impulse:{pointer:{type:"thompson_posterior", activity_id:$a, goal_target_shapes:$t}}}')" |
    jq -r '(.content | fromjson? // .content) as $c | "\($c.metadata.context_bucket // "-") \($c.content.signature_version // "-") \($c.content.sample_count // 0)"' 2>/dev/null
}
outcome() { # outcome <targets-json>
  local eid="gd-rt-$(date -u +%Y%m%dT%H%M%SZ)-$RANDOM"
  local body; body=$(jq -cn --arg e "$eid" --arg m "$MARKER" --argjson t "$1" '{execution_id:$e, template_id:$m, activity_id:$m, status:"completed", success:true,
    tasks:[{task_id:"t1", resolver_id:"llm_completion_dispatch", resolver_tier:"llm", success:true, status:"success"}],
    tags:["reached:true","probe:goal-direction-roundtrip","operator:ac8b0aad"], metadata:{probe:"goal-direction-roundtrip", goal_target_shapes:$t}}')
  local stored; stored=$(call "$AA" /v2/activities/execution-traces "$body" | jq -r '.stored // .success // empty' 2>/dev/null)
  [ "$stored" = "true" ] && ok "marker outcome $eid stored for targets $1" || bad "marker outcome stored for targets $1 (got '${stored:-<no answer>}')"
}
F1='["probeRegistryCount"]'; H3='["probeCurrentEventsDigest","probeWebSearchResult"]'
outcome "$F1"; outcome "$H3"
for _ in $(seq 1 12); do sleep 5; read -r b1 v1 n1 <<<"$(readback "$F1")"; read -r b2 v2 n2 <<<"$(readback "$H3")"
  [ "$v1" = 3 ] && [ "$v2" = 3 ] && awk -v a="$n1" -v b="$n2" 'BEGIN{exit !(a>0 && b>0)}' && break; done
[ "$v1" = 3 ] && [ "$b1" != "-" ] && ok "F1-class reads back keyed by its bucket $b1 at signature_version 3" || bad "F1-class reads back keyed by a goal-direction bucket at signature_version 3 (got bucket '$b1', version '$v1')"
[ "$v2" = 3 ] && [ "$b2" != "-" ] && ok "H3-class reads back keyed by its bucket $b2 at signature_version 3" || bad "H3-class reads back keyed by a goal-direction bucket at signature_version 3 (got bucket '$b2', version '$v2')"
[ "$b1" != "-" ] && [ "$b1" != "$b2" ] && ok "the two goal classes have DIFFERENT buckets" || bad "the two goal classes have different buckets ('$b1' vs '$b2')"
awk -v a="${n1:-0}" -v b="${n2:-0}" 'BEGIN{exit !(a>0 && b>0)}' && ok "each bucket reads back with n>0 ($n1, $n2)" || bad "each bucket reads back with n>0 (got ${n1:-0}, ${n2:-0})"
unset K
echo "--- $([ "$FAILS" -eq 0 ] && echo GREEN || echo "RED ($FAILS)")"
[ "$FAILS" -eq 0 ]
