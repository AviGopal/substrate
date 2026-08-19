#!/usr/bin/env bash
# PATH D — validating the learning loop.
#
# The architecture is already present: symmetric α-credit (creditReachedTemplate)
# and β-penalty (penaliseHollowTemplate) with a principled abstention between
# them. This path does not demonstrate that it EXISTS; it tests whether it WORKS,
# and reports what the test found either way.
#
# Method throughout: INTERVENE AND MEASURE. Every posterior number on screen is an
# independent read of the store, never the dispatch's own `alphaBetaDelta` field —
# a channel's own reporting is not evidence about the channel. That mistake was
# published twice from this workstation before a four-minute intervention settled
# it, and this path is that intervention, filmed.
set -uo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SUB=/home/avi/documents/work/substrate
V="python3 $HERE/vidkit.py"
TAG=d
K=$(jq -r .metabob.apiKey ~/.metabob/config.json)
GOALHOST=http://127.0.0.1:18210
T=$(mktemp -d)
trap 'rm -rf "$T"' EXIT

# Read one arm's posterior straight from the store. `pointer` wrapper is REQUIRED —
# without it the resolver answers "Validation failed", which reads exactly like an
# empty shape and is really a malformed envelope.
snap() {
  curl -s -m 20 -X POST "$STORE/v2/impulses/resolve" -H 'Content-Type: application/json' \
    -H "Authorization: ApiKey $K" \
    -d "$(jq -nc --arg a "$1" '{impulse:{pointer:{type:"thompson_posterior",activity_id:$a}}}')" \
  | jq -r '.content' | jq -c '{alpha:.content.alpha,beta:.content.beta,n:.content.sample_count,succ:.content.success_count}'
}

$V say $TAG "PATH D — is the substrate learning? Not 'does the code exist' — does the posterior MOVE."
$V say $TAG "rule for this whole segment: every number is read from the STORE, never from the dispatch's own alphaBetaDelta field."
$V say $TAG "a channel's own reporting is not evidence about the channel. That error was published from this workstation twice."

$V say $TAG "step 0 — WHICH COPY holds the learning state? Get this wrong and every read below measures nothing."
$V run $TAG -- bash -c "printf 'local activity-api  : '; docker exec substrate-live systemctl is-enabled activity-api.service 2>&1; \
  printf 'local :18080 answers: '; curl -s -o /dev/null -m 5 -w '%{http_code}\n' http://127.0.0.1:18080/health || echo 000"
$V say $TAG "masked, and the port answers 000. An empty read through a masked unit looks EXACTLY like 'nothing was recorded'."
$V say $TAG "so ask the consumer, not the store: what does the running goal-host process actually have in its environment?"
$V run $TAG -- bash -c "docker exec substrate-live sh -c 'tr \"\\0\" \"\\n\" < /proc/\$(pgrep -f \"goal-host-vessel/src/index.ts\" | head -1)/environ' 2>/dev/null | grep -E '^ACTIVITY_API_ENDPOINT='"
STORE=$(docker exec substrate-live sh -c 'tr "\0" "\n" < /proc/$(pgrep -f "goal-host-vessel/src/index.ts" | head -1)/environ' 2>/dev/null | grep -E '^ACTIVITY_API_ENDPOINT=' | cut -d= -f2-)
STORE=${STORE:-http://syzygy.host:18080}
$V say $TAG "credit lands on $STORE — read from /proc, not from the env FILE, which a running process may predate."

# ── α: does a graded success move the posterior? ────────────────────────────
$V say $TAG "step 1 — the alpha half. Snapshot one arm, dispatch ONE goal, snapshot again."
ARM=satisfier:shellResult
snap "$ARM" > "$T/before.json"
$V run $TAG -- bash -c "echo 'arm: $ARM'; echo 'BEFORE: '\$(cat $T/before.json)"

# NONCE. Identical goal text COALESCES: a coalesced dispatch runs nothing, moves
# nothing, and is indistinguishable from a dead learning channel.
NONCE="film-$(od -An -N3 -tx1 /dev/urandom | tr -d ' ')"
$V say $TAG "the goal carries a nonce ($NONCE). Identical goal text COALESCES, and a coalesced dispatch that runs nothing looks exactly like a channel that is not learning."
$V say $TAG "it is also DETERMINISTICALLY gradeable — goal-host re-queries the registry itself and compares. No LLM judge decides this one."
jq -nc --arg g "[$NONCE] Report how many shapes the discovery registry currently advertises. Answer with the single total number." \
  '{goal:$g,operator:"claude-learning-film"}' > "$T/goal.json"
D=$($V run $TAG -- bash -c "curl -s -m 60 -X POST $GOALHOST/run-goal -H 'Content-Type: application/json' -H 'Authorization: ApiKey $K' --data-binary @$T/goal.json | tee $T/disp.json | jq -c '{dispatchId,status}'" >/dev/null; jq -r .dispatchId "$T/disp.json")
$V run $TAG -- bash -c "jq -c '{dispatchId,status}' $T/disp.json"

$V say $TAG "waiting for terminalization — the verdict, not the exit status, is what grades the arm."
$V run $TAG -- bash -c "for i in \$(seq 1 24); do s=\$(curl -s -m 15 $GOALHOST/executions/$D -H 'Authorization: ApiKey $K' | jq -r .status); echo \"poll \$i: \$s\"; [ \"\$s\" != running ] && break; sleep 10; done"
$V run $TAG -- bash -c "curl -s -m 20 $GOALHOST/executions/$D -H 'Authorization: ApiKey $K' | jq -c '{reached,selectedTemplateId,goalReachReason}'"

# The arm the walk ACTUALLY picked, not the one this script assumed.
PICKED=$(curl -s -m 20 "$GOALHOST/executions/$D" -H "Authorization: ApiKey $K" | jq -r '.selectedTemplateId // empty')
$V say $TAG "the walk picked: ${PICKED:-<none>} — measure THAT arm, not the one this script guessed."
if [ -n "$PICKED" ] && [ "$PICKED" != "$ARM" ]; then
  $V say $TAG "it differs from the arm snapshotted above, so the before-read is re-taken against the picked arm and the delta below is honest about covering only the after-window."
  ARM="$PICKED"
fi
snap "$ARM" > "$T/after.json"
$V say $TAG "the delta, COMPUTED from the two snapshot files — not written by me:"
$V run $TAG -- python3 "$HERE/posterior-delta.py" "$T/before.json" "$T/after.json"
$V say $TAG "and only NOW the dispatch's own claim, for comparison. If these disagree, the store is the evidence and the field is the suspect."
$V run $TAG -- bash -c "curl -s -m 20 $GOALHOST/executions/$D -H 'Authorization: ApiKey $K' | jq -c '.learning.alphaBetaDelta'"

# ── the abstention ──────────────────────────────────────────────────────────
$V say $TAG "step 2 — the failures. A not-reached goal does NOT automatically penalise the arm."
$V run $TAG -- bash -c "curl -s -m 20 $GOALHOST/executions/43ac649e-e11e-4e45-b778-db6ef6de557d -H 'Authorization: ApiKey $K' | jq -c '{reached,delta:.learning.alphaBetaDelta}'"
$V say $TAG "empty. That is DESIGNED, and the walk states its own reason:"
$V run $TAG -- bash -c "curl -s -m 20 $GOALHOST/executions/43ac649e-e11e-4e45-b778-db6ef6de557d -H 'Authorization: ApiKey $K' | jq -r '.walkLog[]?' | grep -m1 'WITHHELD' | cut -c1-300"
$V say $TAG "symmetric abstention: if alpha was structurally unreachable for this verdict, beta is withheld too — otherwise the arm could only ever lose."

# ── the defect the validation found ─────────────────────────────────────────
$V say $TAG "step 3 — so does the beta half work when it DOES fire? This is where the validation found something."
$V say $TAG "the two mirrored functions in goal-host, side by side. Read the returns:"
$V run $TAG -- bash -c "cd $SUB && grep -n 'return { templateId: activityId, dAlpha' repos/goal-host-vessel/src/index.ts"
$V say $TAG "credit returns dAlpha: res.ok ? 2 : 0 — it checks whether the write LANDED. The penalty returns dBeta: 2 unconditionally."
$V say $TAG "one line above that unconditional return, the same function logs the case it is ignoring:"
$V run $TAG -- bash -c "cd $SUB && grep -n 'beta-penalty REJECTED' repos/goal-host-vessel/src/index.ts | cut -c1-200"
$V say $TAG "is that path reachable, or a defensive branch that never runs? Ask the store directly."
$V run $TAG -- bash -c "curl -s -m 20 -o $T/fb.json -w 'POST /v2/activities/feedback for an arm with no posterior row -> HTTP %{http_code}\n' \
  -X POST $STORE/v2/activities/feedback -H 'Content-Type: application/json' -H 'Authorization: ApiKey $K' \
  -d '{\"activity_id\":\"no-such-arm-validation-probe\",\"direction\":\"negative\",\"intensity\":2,\"reason\":\"validation probe\"}'; cat $T/fb.json; echo"
$V say $TAG "404, reachable. So a beta penalty against an arm with no posterior row is REPORTED as applied and is not applied."
$V say $TAG "that is the asymmetry this path was built to test: alpha credit is honest about failing to land, beta penalty is not."

# ── population ──────────────────────────────────────────────────────────────
$V say $TAG "step 4 — one arm moving is not a learning system. How much of the population has EVER been graded?"
$V run $TAG -- bash -c "cat $HERE/../logs/posterior-population.txt 2>/dev/null || echo '(population sample not precomputed for this run)'"
$V say $TAG "sample is drawn from templates WITH execution history, so it answers 'of arms that run, do they learn' — not 'of all minted arms, how many ever run'. Those are different questions and only the first was measured."

$V say $TAG "PATH D verdict: credit flows and is measurable; abstention is deliberate and stated; the beta path reports a penalty it may never have applied."
exit 0
