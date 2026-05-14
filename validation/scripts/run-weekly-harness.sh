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
  "$PRIOR_REPORT" "$CURRENT_REPORT" 2>&1)

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
exit 0
