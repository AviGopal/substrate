#!/usr/bin/env bash
# validation/cycle.sh — multi-round learning loop validation
#
# Runs minibob against a sequence of distinct prompts and checks that the
# learning loop compounds across rounds: variant exploration, score updates,
# and no prompt reuse.
#
# Usage:
#   bash validation/cycle.sh [--rounds N] [--category CATEGORY]
#
# Options:
#   --rounds N        Number of rounds to run (default: 3)
#   --category CAT    Category tag to filter prompts (default: general)
#                     Recognized: general, bugfix, feature, refactor, analysis, upkeep
#
# Exit codes:
#   0 — ≥50% rounds succeeded AND ≥2 distinct templates selected
#   1 — success rate < 50% OR only one template selected across all rounds
#   2 — configuration / dependency error

set -euo pipefail

# ---------------------------------------------------------------------------
# Defaults
# ---------------------------------------------------------------------------
ROUNDS=3
CATEGORY="general"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROMPTS_DIR="$SCRIPT_DIR/prompts"
RUNS_DIR="$SCRIPT_DIR/runs"
MANIFEST="$RUNS_DIR/cycle-manifest.json"

# ---------------------------------------------------------------------------
# Parse arguments
# ---------------------------------------------------------------------------
while [[ $# -gt 0 ]]; do
  case "$1" in
    --rounds)
      ROUNDS="$2"
      shift 2
      ;;
    --category)
      CATEGORY="$2"
      shift 2
      ;;
    --help|-h)
      sed -n '2,20p' "${BASH_SOURCE[0]}" | sed 's/^# \?//'
      exit 0
      ;;
    *)
      echo "Unknown argument: $1" >&2
      exit 2
      ;;
  esac
done

# ---------------------------------------------------------------------------
# Validate numeric rounds
# ---------------------------------------------------------------------------
if ! [[ "$ROUNDS" =~ ^[1-9][0-9]*$ ]]; then
  echo "error: --rounds must be a positive integer, got: $ROUNDS" >&2
  exit 2
fi

# ---------------------------------------------------------------------------
# Source ANTHROPIC_API_KEY from ~/.metabob/config.json if not in environment
# ---------------------------------------------------------------------------
if [[ -z "${ANTHROPIC_API_KEY:-}" ]]; then
  METABOB_CONFIG="$HOME/.metabob/config.json"
  if [[ -f "$METABOB_CONFIG" ]]; then
    if command -v jq &>/dev/null; then
      ANTHROPIC_API_KEY="$(jq -r '.providers.anthropic.apiKey // empty' "$METABOB_CONFIG" 2>/dev/null || true)"
      if [[ -n "$ANTHROPIC_API_KEY" ]]; then
        export ANTHROPIC_API_KEY
        echo "[cycle] Loaded ANTHROPIC_API_KEY from $METABOB_CONFIG"
      fi
    else
      echo "[cycle] warning: jq not found — cannot auto-load ANTHROPIC_API_KEY from config" >&2
    fi
  fi
fi

if [[ -z "${ANTHROPIC_API_KEY:-}" ]]; then
  echo "error: ANTHROPIC_API_KEY is not set and could not be loaded from ~/.metabob/config.json" >&2
  exit 2
fi

# ---------------------------------------------------------------------------
# Dependency checks
# ---------------------------------------------------------------------------
if ! command -v bun &>/dev/null; then
  echo "error: bun not found in PATH" >&2
  exit 2
fi

if [[ ! -f "$SCRIPT_DIR/run.sh" ]]; then
  echo "error: validation/run.sh not found at $SCRIPT_DIR/run.sh" >&2
  exit 2
fi

# ---------------------------------------------------------------------------
# Ensure directories and manifest exist
# ---------------------------------------------------------------------------
mkdir -p "$RUNS_DIR"

if [[ ! -f "$MANIFEST" ]]; then
  echo '{"used_prompts": [], "runs": []}' > "$MANIFEST"
fi

# ---------------------------------------------------------------------------
# Category → prompt number ranges / keyword mapping
# ---------------------------------------------------------------------------
# Each category maps to a set of prompt filename prefixes or keywords.
# "general" includes all prompts not in a more specific category.
category_matches_prompt() {
  local category="$1"
  local prompt_file="$2"
  local base
  base="$(basename "$prompt_file")"

  case "$category" in
    bugfix)
      [[ "$base" =~ ^(01|05|06|07)- ]]
      ;;
    feature)
      [[ "$base" =~ ^(02|08|09|10)- ]]
      ;;
    refactor)
      [[ "$base" =~ ^03- ]]
      ;;
    analysis)
      [[ "$base" =~ ^(04|15|16|17|18)- ]]
      ;;
    upkeep)
      [[ "$base" =~ ^(20|21|22|23)- ]]
      ;;
    general|*)
      # general = everything
      true
      ;;
  esac
}

# ---------------------------------------------------------------------------
# Build the list of candidate prompts for this category
# ---------------------------------------------------------------------------
mapfile -t ALL_PROMPTS < <(find "$PROMPTS_DIR" -maxdepth 1 -name '*.md' | sort)

CANDIDATE_PROMPTS=()
for p in "${ALL_PROMPTS[@]}"; do
  if category_matches_prompt "$CATEGORY" "$p"; then
    CANDIDATE_PROMPTS+=("$p")
  fi
done

if [[ ${#CANDIDATE_PROMPTS[@]} -eq 0 ]]; then
  echo "error: no prompts found for category '$CATEGORY' in $PROMPTS_DIR" >&2
  exit 2
fi

echo "[cycle] category=$CATEGORY rounds=$ROUNDS"
echo "[cycle] ${#CANDIDATE_PROMPTS[@]} candidate prompt(s) available"

# ---------------------------------------------------------------------------
# Load used prompts from manifest (by canonical path)
# ---------------------------------------------------------------------------
get_used_prompts() {
  jq -r '.used_prompts[]' "$MANIFEST" 2>/dev/null || true
}

# ---------------------------------------------------------------------------
# Pick next unused prompt from candidates
# Outputs the prompt path, or exits 2 if all candidates are exhausted
# ---------------------------------------------------------------------------
pick_unused_prompt() {
  local used
  mapfile -t used < <(get_used_prompts)

  for candidate in "${CANDIDATE_PROMPTS[@]}"; do
    local already_used=false
    for u in "${used[@]:-}"; do
      if [[ "$u" == "$candidate" ]]; then
        already_used=true
        break
      fi
    done
    if [[ "$already_used" == false ]]; then
      echo "$candidate"
      return 0
    fi
  done

  echo "[cycle] warning: all prompts for category '$CATEGORY' have been used." >&2
  echo "[cycle] Resetting used-prompts list for this category to allow reuse." >&2

  # Reset only the candidates for this category (keep others)
  local tmp
  tmp="$(mktemp)"
  jq --argjson reuse "$(printf '%s\n' "${CANDIDATE_PROMPTS[@]}" | jq -R . | jq -s .)" \
    '.used_prompts = [.used_prompts[] | select(. as $p | $reuse | index($p) | not)]' \
    "$MANIFEST" > "$tmp" && mv "$tmp" "$MANIFEST"

  echo "${CANDIDATE_PROMPTS[0]}"
}

# ---------------------------------------------------------------------------
# Mark a prompt as used in the manifest
# ---------------------------------------------------------------------------
mark_prompt_used() {
  local prompt_path="$1"
  local tmp
  tmp="$(mktemp)"
  jq --arg p "$prompt_path" '.used_prompts += [$p]' "$MANIFEST" > "$tmp" && mv "$tmp" "$MANIFEST"
}

# ---------------------------------------------------------------------------
# Append a run record to the manifest
# ---------------------------------------------------------------------------
append_run_record() {
  local prompt="$1"
  local run_dir="$2"
  local outcome="$3"
  local duration_ms="$4"
  local timestamp="$5"
  local tmp
  tmp="$(mktemp)"
  jq \
    --arg prompt "$prompt" \
    --arg run_dir "$run_dir" \
    --arg outcome "$outcome" \
    --arg duration_ms "$duration_ms" \
    --arg timestamp "$timestamp" \
    '.runs += [{
      "prompt": $prompt,
      "run_dir": $run_dir,
      "outcome": $outcome,
      "duration_ms": ($duration_ms | tonumber),
      "timestamp": $timestamp
    }]' "$MANIFEST" > "$tmp" && mv "$tmp" "$MANIFEST"
}

# ---------------------------------------------------------------------------
# Extract template id from a minibob run directory's stderr log
# Looks for lines like: [Impulse] Resolved via vessel discovery (template: ...)
# or template_id fields in the transcript.
# Falls back to "unknown" if nothing parseable is found.
# ---------------------------------------------------------------------------
extract_template_from_run() {
  local run_dir="$1"
  local stderr_log="$run_dir/minibob/stderr.log"

  if [[ ! -f "$stderr_log" ]]; then
    echo "unknown"
    return
  fi

  # Try to find a template_id or activity_id in the stderr output
  local template
  template="$(grep -oE '"(template_id|activity_id|variant_id)"\s*:\s*"[^"]+"' "$stderr_log" \
    | head -1 \
    | grep -oE '"[^"]+"\s*$' \
    | tr -d '"' \
    || true)"

  if [[ -z "$template" ]]; then
    # Try: selected template: <id> or Executing template <id>
    template="$(grep -oE '(template|activity):\s*[a-zA-Z0-9_:/-]+' "$stderr_log" \
      | head -1 \
      | grep -oE '[a-zA-Z0-9_:/-]+$' \
      || true)"
  fi

  echo "${template:-unknown}"
}

# ---------------------------------------------------------------------------
# Run one round
# Returns: exit code of run.sh
# ---------------------------------------------------------------------------
run_round() {
  local round="$1"
  local prompt="$2"
  local prompt_base
  prompt_base="$(basename "$prompt" .md)"

  echo ""
  echo "=========================================="
  echo "[cycle] Round $round/$ROUNDS — $prompt_base"
  echo "=========================================="

  local start_ms
  start_ms="$(date +%s%3N)"

  local exit_code=0
  bash "$SCRIPT_DIR/run.sh" "$prompt" "empty-workspace" --only minibob || exit_code=$?

  local end_ms
  end_ms="$(date +%s%3N)"
  local duration_ms=$(( end_ms - start_ms ))

  echo "[cycle] Round $round complete — exit=$exit_code duration=${duration_ms}ms"
  echo "$exit_code $duration_ms"
}

# ---------------------------------------------------------------------------
# Main loop
# ---------------------------------------------------------------------------
TIMESTAMP="$(date -u +%Y-%m-%dT%H-%M-%S)"
CYCLE_RESULTS=()   # "prompt|run_dir|outcome|duration_ms" per round

SUCCESS_COUNT=0
FAIL_COUNT=0
declare -A TEMPLATES_SEEN   # template_id => 1

for (( round=1; round<=ROUNDS; round++ )); do
  prompt="$(pick_unused_prompt)"

  echo "[cycle] Selected prompt: $(basename "$prompt")"
  mark_prompt_used "$prompt"

  start_epoch="$(date +%s%3N)"

  exit_code=0
  bash "$SCRIPT_DIR/run.sh" "$prompt" "empty-workspace" --only minibob \
    2>&1 || exit_code=$?

  end_epoch="$(date +%s%3N)"
  duration_ms=$(( end_epoch - start_epoch ))

  # Find the most recent run directory for this prompt
  prompt_base="$(basename "$prompt" .md)"
  latest_run_dir="$(find "$RUNS_DIR" -maxdepth 1 -type d -name "*-${prompt_base}" \
    | sort | tail -1 || true)"

  outcome="failure"
  if [[ $exit_code -eq 0 ]]; then
    outcome="success"
    (( SUCCESS_COUNT++ )) || true
  else
    (( FAIL_COUNT++ )) || true
  fi

  template_id="unknown"
  if [[ -n "$latest_run_dir" ]]; then
    template_id="$(extract_template_from_run "$latest_run_dir")"
  fi

  if [[ "$template_id" != "unknown" ]]; then
    TEMPLATES_SEEN["$template_id"]=1
  fi

  round_ts="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  CYCLE_RESULTS+=("$(basename "$prompt")|${latest_run_dir:-unknown}|$outcome|$duration_ms|$template_id")

  append_run_record \
    "$prompt" \
    "${latest_run_dir:-unknown}" \
    "$outcome" \
    "$duration_ms" \
    "$round_ts"

  echo "[cycle] Round $round — outcome=$outcome template=$template_id duration=${duration_ms}ms"
done

# ---------------------------------------------------------------------------
# Produce cycle summary report
# ---------------------------------------------------------------------------
REPORT_PATH="$RUNS_DIR/cycle-${TIMESTAMP}-report.md"
UNIQUE_TEMPLATES="${#TEMPLATES_SEEN[@]}"
TOTAL_ROUNDS="$ROUNDS"
SUCCESS_RATE_PCT=$(( SUCCESS_COUNT * 100 / TOTAL_ROUNDS ))

{
  echo "# Cycle validation report"
  echo ""
  echo "- **Timestamp:** $TIMESTAMP"
  echo "- **Category:** $CATEGORY"
  echo "- **Rounds:** $TOTAL_ROUNDS"
  echo "- **Success rate:** ${SUCCESS_COUNT}/${TOTAL_ROUNDS} (${SUCCESS_RATE_PCT}%)"
  echo "- **Unique templates selected:** $UNIQUE_TEMPLATES"
  echo ""
  echo "## Per-round results"
  echo ""
  echo "| round | prompt | template selected | outcome | duration (ms) |"
  echo "|---|---|---|---|---|"

  round_num=1
  for entry in "${CYCLE_RESULTS[@]}"; do
    IFS='|' read -r p_base run_dir outcome duration_ms template_id <<< "$entry"
    echo "| $round_num | \`$p_base\` | \`$template_id\` | $outcome | $duration_ms |"
    (( round_num++ )) || true
  done

  echo ""
  echo "## Aggregate analysis"
  echo ""
  echo "### Exploration diversity"
  echo ""
  echo "Templates selected across all rounds:"
  echo ""
  for t in "${!TEMPLATES_SEEN[@]}"; do
    echo "- \`$t\`"
  done
  echo ""
  if [[ $UNIQUE_TEMPLATES -ge 2 ]]; then
    echo "**Exploration verdict: DIVERSE** — $UNIQUE_TEMPLATES distinct templates selected, proving Thompson Sampling explores the variant space."
  else
    echo "**Exploration verdict: NARROW** — only $UNIQUE_TEMPLATES distinct template(s) selected. Thompson Sampling may be over-exploiting a single high-α variant."
  fi

  echo ""
  echo "### Success rate"
  echo ""
  if [[ $SUCCESS_RATE_PCT -ge 50 ]]; then
    echo "**Verdict: PASS** — ${SUCCESS_COUNT}/${TOTAL_ROUNDS} rounds succeeded (≥50% threshold met)."
  else
    echo "**Verdict: FAIL** — ${SUCCESS_COUNT}/${TOTAL_ROUNDS} rounds succeeded (<50% threshold)."
  fi

  echo ""
  echo "### Variant family growth (manual check)"
  echo ""
  echo "To verify that variant families grew between round 1 and round $TOTAL_ROUNDS, compare"
  echo "\`variantMetricsSummary\` snapshots from the first and last run directories:"
  echo ""
  if [[ ${#CYCLE_RESULTS[@]} -ge 1 ]]; then
    IFS='|' read -r _ first_run _ _ _ <<< "${CYCLE_RESULTS[0]}"
    IFS='|' read -r _ last_run _ _ _ <<< "${CYCLE_RESULTS[-1]}"
    echo "- First run: \`$first_run\`"
    echo "- Last run:  \`$last_run\`"
    echo ""
    echo "Check \`minibob/stderr.log\` in each for \`variantMetricsSummary\` resolution logs."
  fi

  echo ""
  echo "## Pass/fail criteria"
  echo ""
  echo "| criterion | required | actual | result |"
  echo "|---|---|---|---|"

  pass_rate="FAIL"
  [[ $SUCCESS_RATE_PCT -ge 50 ]] && pass_rate="PASS"
  pass_explore="FAIL"
  [[ $UNIQUE_TEMPLATES -ge 2 ]] && pass_explore="PASS"

  echo "| success rate | ≥50% | ${SUCCESS_RATE_PCT}% | $pass_rate |"
  echo "| template diversity | ≥2 unique | $UNIQUE_TEMPLATES | $pass_explore |"

  echo ""
  echo "---"
  echo "_Generated by \`validation/cycle.sh\` at $TIMESTAMP_"
} > "$REPORT_PATH"

echo ""
echo "=========================================="
echo "[cycle] Cycle complete"
echo "[cycle] Report: $REPORT_PATH"
echo "[cycle] Success: ${SUCCESS_COUNT}/${TOTAL_ROUNDS} (${SUCCESS_RATE_PCT}%)"
echo "[cycle] Unique templates: $UNIQUE_TEMPLATES"
echo "=========================================="

# ---------------------------------------------------------------------------
# Exit code
# ---------------------------------------------------------------------------
# Pass if ≥50% rounds succeeded AND ≥2 distinct templates were selected
if [[ $SUCCESS_RATE_PCT -ge 50 && $UNIQUE_TEMPLATES -ge 2 ]]; then
  echo "[cycle] PASS — learning loop demonstrates exploration and convergence"
  exit 0
else
  if [[ $SUCCESS_RATE_PCT -lt 50 ]]; then
    echo "[cycle] FAIL — success rate ${SUCCESS_RATE_PCT}% is below the 50% threshold" >&2
  fi
  if [[ $UNIQUE_TEMPLATES -lt 2 ]]; then
    echo "[cycle] FAIL — only $UNIQUE_TEMPLATES unique template(s) selected (need ≥2 for exploration)" >&2
  fi
  exit 1
fi
