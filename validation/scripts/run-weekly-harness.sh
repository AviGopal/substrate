#!/usr/bin/env bash
# run-weekly-harness.sh — weekly recommendation quality gate.
#
# Runs the v2 benchmark harness and compares against the most recent prior
# report. Exits non-zero if recommend_mrr regressed >10% or search_mrr
# regressed >5 absolute points.
#
# Required environment:
#   METABOB_API_KEY   — activity-api key
#
# Optional:
#   METABOB_ENDPOINT  — defaults to https://activity.metabob.com
#   LABEL             — embedded in report filename (default: "weekly")
#
# Exit codes:
#   0  — pass (no regression)
#   1  — regression detected or harness error
#   2  — no prior report to compare against (first run, saves baseline)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
VALIDATION_DIR="$(dirname "$SCRIPT_DIR")"
BENCHMARK_V2="${VALIDATION_DIR}/activity-reuse-benchmark-v2.json"
RESULTS_DIR="${VALIDATION_DIR}/results"
LABEL="${LABEL:-weekly}"

if [[ -z "${METABOB_API_KEY:-}" ]]; then
  echo "FATAL: METABOB_API_KEY is not set." >&2
  exit 1
fi

if [[ ! -f "$BENCHMARK_V2" ]]; then
  echo "FATAL: Benchmark file not found: $BENCHMARK_V2" >&2
  exit 1
fi

# ── Run harness ───────────────────────────────────────────────────────────────

echo "=== Weekly Recommendation Validation ==="
echo "Benchmark : $BENCHMARK_V2"
echo "Label     : $LABEL"
echo ""

METABOB_API_KEY="$METABOB_API_KEY" bun run "${SCRIPT_DIR}/reuse-harness.ts" \
  --benchmark "$BENCHMARK_V2" \
  --label "$LABEL"

# ── Find reports ─────────────────────────────────────────────────────────────

# Most recent report = the one we just wrote (today's date prefix)
TODAY=$(date -u +%Y-%m-%d)
CURRENT_REPORT=$(ls -t "${RESULTS_DIR}/${TODAY}-"*"-reuse-report.json" 2>/dev/null | head -1)

if [[ -z "$CURRENT_REPORT" ]]; then
  echo "ERROR: Could not locate today's report in $RESULTS_DIR" >&2
  exit 1
fi

echo ""
echo "Current report: $CURRENT_REPORT"

# Prior report = most recent report NOT from today
PRIOR_REPORT=$(ls -t "${RESULTS_DIR}/"*"-reuse-report.json" 2>/dev/null \
  | grep -v "^${RESULTS_DIR}/${TODAY}-" \
  | head -1)

if [[ -z "$PRIOR_REPORT" ]]; then
  echo "No prior report found — saving baseline. (exit 2)"
  exit 2
fi

echo "Prior report  : $PRIOR_REPORT"
echo ""

# ── Compare and gate ──────────────────────────────────────────────────────────

COMPARE_OUTPUT=$(bun run "${SCRIPT_DIR}/compare-reports.ts" \
  "$PRIOR_REPORT" "$CURRENT_REPORT" 2>&1) || true

echo "$COMPARE_OUTPUT"

# Extract MRR values from compare output for regression gate.
# compare-reports.ts prints lines like:
#   recommend_mrr  0.1542  0.1958  +0.0416
#   search_mrr     0.0036  0.0036  +0.0000
RECOMMEND_DELTA=$(echo "$COMPARE_OUTPUT" \
  | grep -E '^recommend_mrr' | awk '{print $4}' | head -1)
SEARCH_DELTA=$(echo "$COMPARE_OUTPUT" \
  | grep -E '^search_mrr' | awk '{print $4}' | head -1)

PRIOR_RECOMMEND=$(echo "$COMPARE_OUTPUT" \
  | grep -E '^recommend_mrr' | awk '{print $2}' | head -1)

echo ""
echo "── Regression gate ──────────────────────────────────────────────────────"

REGRESSION=0

# recommend_mrr: fail if delta < -(prior * 0.10)
if [[ -n "$RECOMMEND_DELTA" && -n "$PRIOR_RECOMMEND" ]]; then
  # Use awk for float comparison
  RECOMMEND_OK=$(awk -v delta="$RECOMMEND_DELTA" -v prior="$PRIOR_RECOMMEND" \
    'BEGIN { threshold = -(prior * 0.10); print (delta >= threshold) ? "1" : "0" }')
  if [[ "$RECOMMEND_OK" == "0" ]]; then
    echo "FAIL: recommend_mrr regressed >10% (Δ=${RECOMMEND_DELTA}, prior=${PRIOR_RECOMMEND})" >&2
    REGRESSION=1
  else
    echo "PASS: recommend_mrr regression check (Δ=${RECOMMEND_DELTA})"
  fi
else
  echo "WARN: Could not parse recommend_mrr delta from compare output"
fi

# search_mrr: fail if delta < -0.05 absolute
if [[ -n "$SEARCH_DELTA" ]]; then
  SEARCH_OK=$(awk -v delta="$SEARCH_DELTA" \
    'BEGIN { print (delta >= -0.05) ? "1" : "0" }')
  if [[ "$SEARCH_OK" == "0" ]]; then
    echo "FAIL: search_mrr regressed >0.05 absolute (Δ=${SEARCH_DELTA})" >&2
    REGRESSION=1
  else
    echo "PASS: search_mrr regression check (Δ=${SEARCH_DELTA})"
  fi
else
  echo "WARN: Could not parse search_mrr delta from compare output"
fi

echo "─────────────────────────────────────────────────────────────────────────"

if [[ "$REGRESSION" -eq 1 ]]; then
  echo ""
  echo "RESULT: FAIL — regression detected. Review compare output above."
  exit 1
fi

echo ""
echo "RESULT: PASS — no regression."

# ── forge-goal-completion test (2026-05-18-forge-goal-completion-test §T6) ────
#
# Rotates target shape weekly by `week_number % 3`. Logs go to
# validation/results/{date}-forge-goal.log; the test_report impulse id (if the
# audit-loop write resolver is live) is captured to {date}-forge-goal-report.json.
# This block does NOT gate the exit code of the harness — it produces its own
# test_report which the audit-loop consumes per the sibling spec.

echo ""
echo "=== forge-goal-completion (per 2026-05-18-forge-goal-completion-test) ==="

FORGE_SHAPES=("webhook_signature_verifier" "pdf_text_extractor" "csv_dialect_detector")
WEEK_NUMBER=$(date +%V | sed 's/^0*//')
FORGE_INDEX=$(( WEEK_NUMBER % 3 ))
TARGET_SHAPE="${FORGE_SHAPES[$FORGE_INDEX]}"

FORGE_LOG="${RESULTS_DIR}/${TODAY}-forge-goal.log"
FORGE_REPORT_JSON="${RESULTS_DIR}/${TODAY}-forge-goal-report.json"

echo "Week=${WEEK_NUMBER}  target_shape=${TARGET_SHAPE}"
echo "Log : ${FORGE_LOG}"

FORGE_EXIT=0
TARGET_SHAPE="$TARGET_SHAPE" \
METABOB_API_KEY="$METABOB_API_KEY" \
ACTIVITY_API_URL="${METABOB_ENDPOINT:-https://activity.metabob.com}" \
DISCOVERY_URL="${DISCOVERY_URL:-https://discovery.metabob.com}" \
bun run "${SCRIPT_DIR}/test-forge-goal-completion.ts" \
  > "$FORGE_LOG" 2>&1 || FORGE_EXIT=$?

# Extract the TEST_REPORT block from the log into the report json file.
if grep -q '========== TEST_REPORT ==========' "$FORGE_LOG"; then
  awk '/^========== TEST_REPORT ==========$/{flag=1;next} /^========== END TEST_REPORT ==========$/{flag=0} flag' \
    "$FORGE_LOG" > "$FORGE_REPORT_JSON" || true
  echo "Report: ${FORGE_REPORT_JSON}"
else
  echo "Report: (no TEST_REPORT block emitted)"
fi

if [[ "$FORGE_EXIT" -eq 0 ]]; then
  echo "forge-goal-completion: PASS"
else
  echo "forge-goal-completion: FAIL (exit=${FORGE_EXIT}) — see ${FORGE_LOG}"
  # Do not propagate — the audit-loop consumes the test_report impulse and
  # decides what to do with it. Harness exit reflects only the recommendation
  # regression gate.
fi

# ── Sensitivity-probe sweep (OpenSpec 2026-05-18-test-audit-loop Phase G.2) ────
#
# For every registered test, dispatch the run-sensitivity-probe meta-activity
# so the audit loop has fresh sensitivity_evidence rows for its trailing-7-day
# query. The dispatch posts an `executeAsActivity` request per registration;
# missing dispatch endpoints OR an empty registration list collapses to a
# zero-iteration loop (the sweep is best-effort and never fails the harness).
#
# Sensitivity-probe results land as `sensitivity_evidence` impulses and are
# aggregated alongside the main reuse report's audit_summary block; a per-run
# summary log goes to ${TODAY}-sensitivity-report.json.

echo ""
echo "=== Sensitivity-probe sweep (test-audit-loop §C/§G.2) ==="

SENSITIVITY_REPORT_JSON="${RESULTS_DIR}/${TODAY}-sensitivity-report.json"
ENDPOINT="${METABOB_ENDPOINT:-https://activity.metabob.com}"

# Pull all registered tests, ignoring transport failures.
REG_RESPONSE=$(curl -s -X POST "${ENDPOINT}/v2/impulses/resolve" \
  -H "Content-Type: application/json" \
  -H "Authorization: ApiKey ${METABOB_API_KEY}" \
  -d '{"pointer":{"type":"test_registration","limit":200}}' 2>/dev/null || echo "")

REG_IDS=()
if [[ -n "$REG_RESPONSE" ]]; then
  # The content field is a JSON string of {entries: [{test_id, ...}, ...]}.
  REG_IDS=( $(echo "$REG_RESPONSE" \
    | grep -oE '"test_id"[ ]*:[ ]*"[^"]*"' \
    | sed -E 's/.*"test_id"[ ]*:[ ]*"([^"]+)"/\1/' \
    | sort -u) )
fi

echo "Registered tests : ${#REG_IDS[@]}"

SWEEP_COUNT=0
SWEEP_DISPATCHED=()
for TEST_ID in "${REG_IDS[@]}"; do
  # Dispatch via /v2/activities/recommend → execution: the simplest portable
  # surface, which the canary's run-sensitivity-probe template subscribes to.
  # If the dispatch endpoint isn't live (older canaries) the curl exits non-
  # zero and we just record the test_id as deferred. The audit loop reads
  # sensitivity_evidence rows that DO land; missing rows manifest as
  # `missing_sensitivity_history` caveats, which is the expected
  # grandfathering signal.
  DISP_EXIT=0
  curl -s -X POST "${ENDPOINT}/v2/activities/recommend" \
    -H "Content-Type: application/json" \
    -H "Authorization: ApiKey ${METABOB_API_KEY}" \
    -d "$(printf '{"goal_text":"run sensitivity probe","filters":{"template_id":"run-sensitivity-probe"},"variables":{"test_registration_id":"%s"}}' "$TEST_ID")" \
    > /dev/null 2>&1 || DISP_EXIT=$?
  SWEEP_DISPATCHED+=("$TEST_ID:$DISP_EXIT")
  if [[ "$DISP_EXIT" -eq 0 ]]; then
    SWEEP_COUNT=$((SWEEP_COUNT + 1))
  fi
done

# Emit the sensitivity-report sidecar JSON. The audit_summary in the primary
# reuse-report aggregates over the test_audit_report query path; this sidecar
# captures the per-test dispatch outcomes for forensic review.
{
  echo "{"
  echo "  \"generated_at\": \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\","
  echo "  \"label\": \"${LABEL}\","
  echo "  \"registered_tests\": ${#REG_IDS[@]},"
  echo "  \"dispatched_successfully\": ${SWEEP_COUNT},"
  echo "  \"per_test\": ["
  for i in "${!SWEEP_DISPATCHED[@]}"; do
    entry="${SWEEP_DISPATCHED[$i]}"
    tid="${entry%%:*}"
    rc="${entry##*:}"
    sep=","; [[ $i -eq $((${#SWEEP_DISPATCHED[@]} - 1)) ]] && sep=""
    echo "    {\"test_id\": \"${tid}\", \"dispatch_exit\": ${rc}}${sep}"
  done
  echo "  ]"
  echo "}"
} > "$SENSITIVITY_REPORT_JSON"

echo "Sensitivity report: ${SENSITIVITY_REPORT_JSON} (${SWEEP_COUNT}/${#REG_IDS[@]} dispatched)"

# ── Stratified harness — Phase 25 (G8.1.1) ───────────────────────────────────
#
# Runs the stratified goal-generator harness as a second job after the Phase 19
# reuse harness.  Two suites are executed:
#
#   1. Held-out suite  — weekly seed (YYYY_WW_held_out_v1), 8 goals, always
#      runs first so the rolling-pool cannot contaminate it.  Report emitted to
#      <date>-held-out-report.json.
#
#   2. Rolling-pool suite — fixed seed 12345, 24 goals (enough for 24-cell
#      coverage).  Report emitted to <date>-stratified-report.json.
#
# A non-zero exit from either suite is flagged as a warning but does NOT gate
# the overall harness exit code — the stratified harness has its own floor
# criteria (per CellMetrics.floor_pass) which are consumed by the audit loop.
# Floor failures manifest as json payload in the report; CI uploads them as
# artefacts for human review.
#
# Held-out suite precedes rolling-pool so that held-out contamination_delta can
# be computed inside stratified-harness.ts once both reports are available.

STRATIFIED_SCRIPT="${SCRIPT_DIR}/stratified-harness.ts"
GOAL_GEN_SCRIPT="${SCRIPT_DIR}/goal-generator.ts"
if [[ ! -f "$STRATIFIED_SCRIPT" || ! -f "$GOAL_GEN_SCRIPT" ]]; then
  echo ""
  echo "WARN: stratified-harness.ts or goal-generator.ts not found — skipping Phase 25 suites"
else
  echo ""
  echo "=== Stratified harness — held-out suite (Phase 25 G8.1) ==="
  # G1.4.1: generate with weekly seed so the same run on any day this week is
  # identical; different ISO weeks produce a different but reproducible set.
  HELD_OUT_GOALS="${VALIDATION_DIR}/generated/${TODAY}-held-out-goals.json"
  HELD_OUT_LOG="${RESULTS_DIR}/${TODAY}-held-out.log"

  HELD_OUT_EXIT=0
  METABOB_API_KEY="$METABOB_API_KEY" \
  METABOB_ENDPOINT="${METABOB_ENDPOINT:-https://activity.metabob.com}" \
  bun run "$GOAL_GEN_SCRIPT" \
    --held-out \
    --count 8 \
    --output "$HELD_OUT_GOALS" \
    > "${HELD_OUT_LOG}.gen" 2>&1 || HELD_OUT_EXIT=$?

  if [[ "$HELD_OUT_EXIT" -ne 0 ]]; then
    echo "held-out goal-gen: WARN (exit=${HELD_OUT_EXIT}) — see ${HELD_OUT_LOG}.gen"
  elif [[ -f "$HELD_OUT_GOALS" ]]; then
    METABOB_API_KEY="$METABOB_API_KEY" \
    METABOB_ENDPOINT="${METABOB_ENDPOINT:-https://activity.metabob.com}" \
    bun run "$STRATIFIED_SCRIPT" \
      --goals "$HELD_OUT_GOALS" \
      --label "held-out" \
      > "$HELD_OUT_LOG" 2>&1 || HELD_OUT_EXIT=$?

    if [[ "$HELD_OUT_EXIT" -eq 0 ]]; then
      echo "held-out suite: PASS"
    else
      echo "held-out suite: WARN (exit=${HELD_OUT_EXIT}) — see ${HELD_OUT_LOG}"
    fi
    echo "Log: ${HELD_OUT_LOG}"
  fi

  echo ""
  echo "=== Stratified harness — rolling-pool suite (Phase 25 G8.1) ==="
  # Fixed seed 12345 for the rolling-pool suite; 24 goals covers the full
  # 24-cell matrix (novelty × depth × scenario × adversarial axes).
  ROLLING_GOALS="${VALIDATION_DIR}/generated/12345-${TODAY}.json"
  STRATIFIED_LOG="${RESULTS_DIR}/${TODAY}-stratified.log"

  STRATIFIED_EXIT=0
  METABOB_API_KEY="$METABOB_API_KEY" \
  METABOB_ENDPOINT="${METABOB_ENDPOINT:-https://activity.metabob.com}" \
  bun run "$GOAL_GEN_SCRIPT" \
    --seed 12345 \
    --count 24 \
    --output "$ROLLING_GOALS" \
    > "${STRATIFIED_LOG}.gen" 2>&1 || STRATIFIED_EXIT=$?

  if [[ "$STRATIFIED_EXIT" -ne 0 ]]; then
    echo "rolling-pool goal-gen: WARN (exit=${STRATIFIED_EXIT}) — see ${STRATIFIED_LOG}.gen"
  elif [[ -f "$ROLLING_GOALS" ]]; then
    METABOB_API_KEY="$METABOB_API_KEY" \
    METABOB_ENDPOINT="${METABOB_ENDPOINT:-https://activity.metabob.com}" \
    bun run "$STRATIFIED_SCRIPT" \
      --goals "$ROLLING_GOALS" \
      --label "weekly" \
      > "$STRATIFIED_LOG" 2>&1 || STRATIFIED_EXIT=$?

    if [[ "$STRATIFIED_EXIT" -eq 0 ]]; then
      echo "rolling-pool suite: PASS"
    else
      echo "rolling-pool suite: WARN (exit=${STRATIFIED_EXIT}) — see ${STRATIFIED_LOG}"
    fi
    echo "Log: ${STRATIFIED_LOG}"
  fi
fi

exit 0
