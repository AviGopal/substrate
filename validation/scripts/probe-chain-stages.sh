#!/usr/bin/env bash
# Phase 2 probe harness — exercise each chain stage end-to-end.
# Outputs structured results to /tmp/probe-results.json (operator host).
# Honest measurement: pass = HTTP 200 + body.shape present (no semantic validation).

set -u
RESULTS=/tmp/probe-results.json
LOG=/tmp/probe-results.log
: >"$LOG"
echo '{"stages":{}}' > "$RESULTS"

API_KEY=$(docker exec substrate-live bash -c 'source /etc/substrate/env && echo $METABOB_API_KEY')
[ -z "$API_KEY" ] && { echo "no API key"; exit 1; }
RESOLVE_URL="http://localhost:8090/v2/impulses/resolve"

# Helper: POST a resolve, echo "<http_status>|<body_shape>|<raw_body_first_400>"
resolve() {
  local body="$1"
  local out
  out=$(docker exec substrate-live curl -s -w '\nHTTP:%{http_code}' -X POST "$RESOLVE_URL" \
    -H "Authorization: ApiKey $API_KEY" -H "Content-Type: application/json" \
    -d "$body" --max-time 90 2>&1)
  local code=$(echo "$out" | sed -n 's/^HTTP://p' | tail -1)
  local payload=$(echo "$out" | sed '/^HTTP:/d')
  local shape=$(echo "$payload" | jq -r '.body.shape // .shape // "none"' 2>/dev/null)
  echo "$code|$shape|$payload"
}

# Compact jq write into results file
set_stage() {
  local stage="$1"; local key="$2"; local val="$3"
  jq --arg s "$stage" --arg k "$key" --argjson v "$val" \
    '.stages[$s][$k] = $v' "$RESULTS" > "$RESULTS.tmp" && mv "$RESULTS.tmp" "$RESULTS"
}

############### STAGE 1: detection (orthogonality audit) ###############
echo "=== STAGE 1: vector_space_orthogonality_audit (5x) ===" | tee -a "$LOG"
S1_PASS=0; GAPS_ARR='[]'; CLUSTERS_ARR='[]'
for i in 1 2 3 4 5; do
  R=$(resolve '{"impulse":{"shape":"vector_space_orthogonality_audit","pointer":{"type":"vector_space_orthogonality_audit","window_hours":4,"min_failure_traces":2}}}')
  code=$(echo "$R" | cut -d'|' -f1)
  shape=$(echo "$R" | cut -d'|' -f2)
  body=$(echo "$R" | cut -d'|' -f3-)
  gaps=$(echo "$body" | jq -r '.body.gaps_emitted // 0' 2>/dev/null)
  clusters=$(echo "$body" | jq -r '.body.cluster_summaries | length // 0' 2>/dev/null)
  echo "  run $i: code=$code shape=$shape gaps=$gaps clusters=$clusters" | tee -a "$LOG"
  [ "$code" = "200" ] && [ "$shape" != "none" ] && [ "$shape" != "null" ] && S1_PASS=$((S1_PASS+1))
  GAPS_ARR=$(echo "$GAPS_ARR" | jq ". + [${gaps:-0}]")
  CLUSTERS_ARR=$(echo "$CLUSTERS_ARR" | jq ". + [${clusters:-0}]")
done
set_stage stage1_detection pass "$S1_PASS"
set_stage stage1_detection total 5
set_stage stage1_detection gaps_per_run "$GAPS_ARR"
set_stage stage1_detection clusters_per_run "$CLUSTERS_ARR"

############### STAGE 2: bridge (gap_to_scenario_bridge) ###############
echo "=== STAGE 2: gap_to_scenario_bridge (5x) ===" | tee -a "$LOG"
S2_PASS=0; SCENARIO_DELTAS='[]'
SCEN_BEFORE=$(docker exec substrate-live bash -c 'ls /workspace/validation/failure-modes/scenarios/ 2>/dev/null | wc -l')
for i in 1 2 3 4 5; do
  before=$(docker exec substrate-live bash -c 'ls /workspace/validation/failure-modes/scenarios/ 2>/dev/null | wc -l')
  R=$(resolve '{"impulse":{"shape":"gap_to_scenario_bridge","pointer":{"type":"gap_to_scenario_bridge","scenarios_dir":"/workspace/validation/failure-modes/scenarios","window_hours":4}}}')
  code=$(echo "$R" | cut -d'|' -f1)
  shape=$(echo "$R" | cut -d'|' -f2)
  after=$(docker exec substrate-live bash -c 'ls /workspace/validation/failure-modes/scenarios/ 2>/dev/null | wc -l')
  delta=$((after - before))
  echo "  run $i: code=$code shape=$shape scenarios_delta=$delta" | tee -a "$LOG"
  [ "$code" = "200" ] && [ "$shape" != "none" ] && [ "$shape" != "null" ] && S2_PASS=$((S2_PASS+1))
  SCENARIO_DELTAS=$(echo "$SCENARIO_DELTAS" | jq ". + [$delta]")
done
SCEN_AFTER=$(docker exec substrate-live bash -c 'ls /workspace/validation/failure-modes/scenarios/ 2>/dev/null | wc -l')
set_stage stage2_bridge pass "$S2_PASS"
set_stage stage2_bridge total 5
set_stage stage2_bridge scenarios_before "$SCEN_BEFORE"
set_stage stage2_bridge scenarios_after "$SCEN_AFTER"
set_stage stage2_bridge per_run_deltas "$SCENARIO_DELTAS"

############### STAGE 3: drafter (1x via goal-host) ###############
echo "=== STAGE 3: draft-gap-closing-activity (1x) ===" | tee -a "$LOG"
SCENARIO_ID=$(docker exec substrate-live bash -c 'ls /workspace/validation/failure-modes/scenarios/ | head -1 | sed "s/.json$//"')
PROP_BEFORE=$(docker exec substrate-live bash -c 'ls /workspace/proposals/ 2>/dev/null | grep -v "^.applied" | wc -l')
echo "  scenario_id=$SCENARIO_ID" | tee -a "$LOG"
GOAL_BODY=$(jq -n --arg sid "$SCENARIO_ID" '{goal:"draft a gap-closing activity for scenario \($sid). Scenario file at /workspace/validation/failure-modes/scenarios/\($sid).json. Use the draft-gap-closing-activity template.", variables:{scenario_id:$sid}}')
GOAL_OUT=$(docker exec substrate-live curl -s -X POST http://localhost:8210/run-goal \
  -H "Authorization: ApiKey $API_KEY" -H "Content-Type: application/json" \
  -d "$GOAL_BODY" --max-time 300 2>&1)
GOAL_STATUS=$(echo "$GOAL_OUT" | jq -r '.status // "error"' 2>/dev/null)
GOAL_TEMPLATE=$(echo "$GOAL_OUT" | jq -r '.selectedTemplateId // "?"' 2>/dev/null)
sleep 3
PROP_AFTER=$(docker exec substrate-live bash -c 'ls /workspace/proposals/ 2>/dev/null | grep -v "^.applied" | wc -l')
PROP_DELTA=$((PROP_AFTER - PROP_BEFORE))
echo "  goal_status=$GOAL_STATUS template=$GOAL_TEMPLATE proposals_delta=$PROP_DELTA" | tee -a "$LOG"
set_stage stage3_draft goal_status "\"$GOAL_STATUS\""
set_stage stage3_draft selected_template "\"$GOAL_TEMPLATE\""
set_stage stage3_draft proposals_before "$PROP_BEFORE"
set_stage stage3_draft proposals_after "$PROP_AFTER"
set_stage stage3_draft proposals_delta "$PROP_DELTA"

############### STAGE 4: apply (apply_proposal_as_patch) 5x ###############
echo "=== STAGE 4: apply_proposal_as_patch (5x) ===" | tee -a "$LOG"
S4_PASS=0; S4_SHAPES='[]'; S4_MITOSIS_STAGED=0
for i in 1 2 3 4 5; do
  R=$(resolve '{"impulse":{"shape":"apply_proposal_as_patch","pointer":{"type":"apply_proposal_as_patch"}}}')
  code=$(echo "$R" | cut -d'|' -f1)
  shape=$(echo "$R" | cut -d'|' -f2)
  body=$(echo "$R" | cut -d'|' -f3-)
  reason=$(echo "$body" | jq -r '.body.reason // .body.error // ""' 2>/dev/null | head -c 80)
  echo "  run $i: code=$code shape=$shape reason=$reason" | tee -a "$LOG"
  [ "$code" = "200" ] && [ "$shape" != "none" ] && [ "$shape" != "null" ] && S4_PASS=$((S4_PASS+1))
  [ "$shape" = "mitosisStaged" ] && S4_MITOSIS_STAGED=$((S4_MITOSIS_STAGED+1))
  S4_SHAPES=$(echo "$S4_SHAPES" | jq --arg s "$shape" '. + [$s]')
done
set_stage stage4_apply pass "$S4_PASS"
set_stage stage4_apply total 5
set_stage stage4_apply mitosis_staged_count "$S4_MITOSIS_STAGED"
set_stage stage4_apply shapes_per_run "$S4_SHAPES"

############### STAGE 5: evaluate (vessel_mitosis_evaluate) 5x ###############
echo "=== STAGE 5: vessel_mitosis_evaluate (5x) ===" | tee -a "$LOG"
PENDING=$(docker exec substrate-live cat /workspace/mitosis-pending.json 2>/dev/null)
MITOSIS_ROOT=$(echo "$PENDING" | jq -r '.mitosis_root // ""')
BASE_VER=$(echo "$PENDING" | jq -r '.base_version_id // "v1"')
MIT_VER=$(echo "$PENDING" | jq -r '.mitosis_version_id // ""')
echo "  pending: root=$MITOSIS_ROOT base=$BASE_VER mit=$MIT_VER" | tee -a "$LOG"
S5_PASS=0; S5_VERDICTS='[]'
if [ -n "$MITOSIS_ROOT" ]; then
  REQ=$(jq -n --arg r "$MITOSIS_ROOT" --arg b "$BASE_VER" --arg m "$MIT_VER" \
    '{impulse:{shape:"vessel_mitosis_evaluate",pointer:{type:"vessel_mitosis_evaluate",mitosis_root:$r,base_version_id:$b,mitosis_version_id:$m,min_traces_per_version:0}}}')
  for i in 1 2 3 4 5; do
    R=$(resolve "$REQ")
    code=$(echo "$R" | cut -d'|' -f1)
    shape=$(echo "$R" | cut -d'|' -f2)
    body=$(echo "$R" | cut -d'|' -f3-)
    verdict=$(echo "$body" | jq -r '.body.verdict // .body.recommendation // "?"' 2>/dev/null)
    echo "  run $i: code=$code shape=$shape verdict=$verdict" | tee -a "$LOG"
    [ "$code" = "200" ] && [ "$shape" != "none" ] && [ "$shape" != "null" ] && S5_PASS=$((S5_PASS+1))
    S5_VERDICTS=$(echo "$S5_VERDICTS" | jq --arg v "$verdict" '. + [$v]')
  done
else
  echo "  (no mitosis_pending — skipping)" | tee -a "$LOG"
fi
set_stage stage5_evaluate pass "$S5_PASS"
set_stage stage5_evaluate total 5
set_stage stage5_evaluate verdicts "$S5_VERDICTS"
set_stage stage5_evaluate mitosis_root "\"$MITOSIS_ROOT\""

############### STAGE 6: cutover (1x synthetic FAVORABLE) ###############
echo "=== STAGE 6: vessel_mitosis_cutover (1x) ===" | tee -a "$LOG"
S6_RESULT='{}'
if [ -n "$MITOSIS_ROOT" ]; then
  REQ=$(jq -n --arg r "$MITOSIS_ROOT" --arg b "$BASE_VER" --arg m "$MIT_VER" \
    '{impulse:{shape:"vessel_mitosis_cutover",pointer:{type:"vessel_mitosis_cutover",mitosis_root:$r,base_version_id:$b,mitosis_version_id:$m,evaluation_verdict:"FAVORABLE",force:false}}}')
  R=$(resolve "$REQ")
  code=$(echo "$R" | cut -d'|' -f1)
  shape=$(echo "$R" | cut -d'|' -f2)
  body=$(echo "$R" | cut -d'|' -f3-)
  reason=$(echo "$body" | jq -r '.body.reason // .body.intent_id // ""' 2>/dev/null | head -c 100)
  echo "  code=$code shape=$shape reason=$reason" | tee -a "$LOG"
  S6_RESULT=$(jq -n --arg c "$code" --arg s "$shape" --arg r "$reason" '{code:$c,shape:$s,reason:$r}')
else
  echo "  (skip — no mitosis_pending)" | tee -a "$LOG"
fi
set_stage stage6_cutover result "$S6_RESULT"

############### STAGE 7: host-sync poller ###############
echo "=== STAGE 7: host-sync-poller --once ===" | tee -a "$LOG"
HSYNC_BEFORE=$(wc -l < /home/avi/documents/work/exp-repo/metabob-devbob/repos/development-vessel 2>/dev/null || echo 0)
HSYNC_RESULTS_BEFORE=$(docker exec substrate-live bash -c 'wc -l < /workspace/mitosis-applied-host-sync-results.jsonl 2>/dev/null || echo 0' | tr -d '[:space:]')
/home/avi/documents/work/exp-repo/metabob-devbob/scripts/substrate/host-sync-poller.sh --once 2>&1 | tee -a "$LOG" | tail -20
HSYNC_RESULTS_AFTER=$(docker exec substrate-live bash -c 'wc -l < /workspace/mitosis-applied-host-sync-results.jsonl 2>/dev/null || echo 0' | tr -d '[:space:]')
HSYNC_DELTA=$((HSYNC_RESULTS_AFTER - HSYNC_RESULTS_BEFORE))
echo "  host-sync results_delta=$HSYNC_DELTA" | tee -a "$LOG"
set_stage stage7_host_sync results_before "$HSYNC_RESULTS_BEFORE"
set_stage stage7_host_sync results_after "$HSYNC_RESULTS_AFTER"
set_stage stage7_host_sync delta "$HSYNC_DELTA"

echo "=== DONE ===" | tee -a "$LOG"
echo "Results: $RESULTS"
jq . "$RESULTS"
