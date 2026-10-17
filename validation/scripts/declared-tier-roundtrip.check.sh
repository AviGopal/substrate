#!/usr/bin/env bash
# declared-tier-roundtrip.check.sh: the round trip a declared resolver tier must survive, through the consumers' own calls.
#
#   declared-tier-roundtrip.check.sh <discovery-endpoint>
#
# Endpoints are never hardcoded: activity-api is the client config's .metabob.endpoint (the config substrate-connect
# emits; SUBSTRATE_CLIENT_CONFIG overrides its path), and discovery is the required argument (no default).
#
# A vessel declares each resolver's tier in its discovery registration (resolvers[]), discovery echoes it on the shape's
# capability row (resolver_tier), the dispatcher stamps it on the trace task, and activity-api's M4 tier-restricted skip
# reads that stamp. Before the declared-tier fix the dispatcher stamped every task "deterministic", so an LLM task's
# trace never moved a posterior (llm_completion_dispatch: 213 of 12,527 light-dispatched tasks in 24 h, all skipped).
#
# Steps (each through the call its real consumer makes):
#   1. discovery vesselCapability(llm_completion_dispatch) -> the row's resolver_tier.       [must be llm]
#   2. the stamp a dispatcher writes: that tier, else "deterministic" (light-dispatch's fallback for an undeclared resolver).
#   3. thompson_posterior of a DEDICATED marker arm, before.
#   4. the dispatcher's own two calls: POST /v2/activities/execution-traces (one completed marker trace whose single task
#      is llm_completion_dispatch with that stamp; org from the caller's key, so the leaf write is not defaulted away),
#      then POST /v2/activities/execution-traces/reach {reached:true}. A trace is stored UNGRADED and graded by the late
#      verdict, which is where the M4 tier-restricted skip applies (light-dispatch posts exactly this pair).
#   5. thompson_posterior of the marker, after (polled: the posterior update is fire-and-forget). [must have moved]
#
# Must-fail (red before the fix): step 1 has no resolver_tier, the stamp falls back to deterministic, activity-api skips
# the variant update, and the marker's posterior does not move.
# Intervention record (law 12): each run writes ONE trace for the marker arm `probe:declared-tier-roundtrip`, which no
# selection path picks (it has no template). Its posterior exists only to be read by this check.
#
# Not a *.test.sh: it runs against a live node and was committed red (check first).
set -uo pipefail
DISC="${1:-}"; [ -n "$DISC" ] || { echo "usage: declared-tier-roundtrip.check.sh <discovery-endpoint> (no default: an endpoint is never assumed)"; exit 2; }; DISC="${DISC%/}"
CFG="${SUBSTRATE_CLIENT_CONFIG:-$HOME/.substrate/config.json}"
[ -r "$CFG" ] || { echo "REFUSED: no readable client config $CFG (run substrate-connect, or set SUBSTRATE_CLIENT_CONFIG)"; exit 2; }
AA=$(jq -r '.metabob.endpoint // empty' "$CFG"); [ -n "$AA" ] || { echo "REFUSED: client config $CFG names no activity-api endpoint (.metabob.endpoint)"; exit 2; }
AA="${AA%/}"
KEYFILE="${SUBSTRATE_OPERATOR_KEY_FILE:-$HOME/.config/substrate/operator-admin-key.json}"
MARKER="probe:declared-tier-roundtrip"
FAILS=0; ok() { echo "ok   - $*"; }; bad() { echo "FAIL - $*"; FAILS=$((FAILS+1)); }
[ -r "$KEYFILE" ] || { echo "REFUSED: no readable operator key file (set SUBSTRATE_OPERATOR_KEY_FILE)"; exit 2; }
K=$(jq -r '.body.data.key // .key // empty' "$KEYFILE"); [ -n "$K" ] || { echo "REFUSED: key file has no key"; exit 2; }

# call <base-url> <path> <json-body>: POST with the key on curl's stdin config (never in argv or output).
call() {
  printf 'header = "Authorization: ApiKey %s"\nheader = "content-type: application/json"\n' "$K" |
    curl -s -m60 -K - -X POST "$1$2" --data-binary "$3" 2>/dev/null
}
posterior() {
  call "$AA" /v2/impulses/resolve "{\"pointer\":{\"type\":\"thompson_posterior\",\"activity_variant_id\":\"$MARKER\"}}" |
    jq -r '(.content | fromjson? // .content) as $c | "\($c.content.alpha // "?") \($c.content.beta // "?")"' 2>/dev/null
}

# 1. the declared tier, as a dispatcher reads it
row=$(call "$DISC" /resolve '{"pointer":{"type":"vesselCapability","shape":"llm_completion_dispatch"}}')
tier=$(printf '%s' "$row" | jq -r '[.content.vessels[]? | .resolver_tier // empty][0] // empty' 2>/dev/null)
[ "$tier" = "llm" ] && ok "discovery's llm_completion_dispatch row declares resolver_tier llm" || bad "discovery's llm_completion_dispatch row declares resolver_tier llm (got '${tier:-<absent>}')"

# 2. the stamp
stamp="${tier:-deterministic}"
# POSITIVE CONTROL ONLY (same address): RT_CONTROL_STAMP=llm forces the stamp, proving the posterior read moves when the
# update is NOT skipped, so a red step 5 is the skip and not the instrument. Step 1 still reports the real row.
[ -n "${RT_CONTROL_STAMP:-}" ] && { stamp="$RT_CONTROL_STAMP"; echo "info - CONTROL RUN: stamp forced to $stamp"; }
echo "info - stamp for the marker task: $stamp"

# 3-5. the posterior moves for a trace carrying that stamp
before=$(posterior); read -r a0 b0 <<<"${before:-? ?}"
eid="tier-rt-$(date -u +%Y%m%dT%H%M%SZ)-$RANDOM"
body=$(jq -cn --arg e "$eid" --arg m "$MARKER" --arg s "$stamp" '{execution_id:$e, template_id:$m, activity_id:$m, status:"completed", success:true,
  tasks:[{task_id:"t1", resolver_id:"development-vessel:llm_completion_dispatch", resolver_tier:$s, success:true, status:"success"}],
  tags:["probe:declared-tier-roundtrip","operator:ac8b0aad"], metadata:{probe:"declared-tier-roundtrip"}}')
stored=$(call "$AA" /v2/activities/execution-traces "$body" | jq -r '.stored // .success // empty' 2>/dev/null)
[ "$stored" = "true" ] && ok "the marker trace $eid was stored" || bad "the marker trace was stored (got '${stored:-<no answer>}')"
sleep 2
graded=$(call "$AA" /v2/activities/execution-traces/reach "$(jq -cn --arg e "$eid" '{execution_id:$e, reached:true}')" | jq -c '{success, graded: (.graded // .applied // null), reason: (.reason // .error // null)}' 2>/dev/null)
echo "info - late reach verdict: ${graded:-<no answer>}"
moved=""
for _ in $(seq 1 12); do
  sleep 5; read -r a1 b1 <<<"$(posterior)"
  if [ "$a0" != "?" ] && [ "$a1" != "?" ] && awk -v a0="$a0" -v b0="$b0" -v a1="$a1" -v b1="$b1" 'BEGIN{exit !((a1+b1) > (a0+b0) + 0.5)}'; then moved=1; break; fi
done
[ -n "$moved" ] && ok "the marker's posterior moved ($a0/$b0 -> $a1/$b1): the update was not skipped" || bad "the marker's posterior moved (before ${a0}/${b0}, after ${a1:-?}/${b1:-?}): a skipped or lost update"
unset K
echo "--- $([ "$FAILS" -eq 0 ] && echo GREEN || echo "RED ($FAILS)")"
[ "$FAILS" -eq 0 ]
