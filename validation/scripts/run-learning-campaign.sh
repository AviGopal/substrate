#!/usr/bin/env bash
# run-learning-campaign.sh — 4-run learning sequence demonstrating Thompson Sampling convergence.
#
# Runs prompts 24-27 sequentially with minibob --with-backend.
# Captures Thompson α/β posteriors before each run via thompson-compare.ts.
# Run 24 is also benchmarked against Claude Code for a cold-start baseline.
#
# Usage:
#   ./validation/scripts/run-learning-campaign.sh [--skip-cc-baseline] [--start-from <24|25|26|27>]
#
# Prerequisites:
#   - ANTHROPIC_API_KEY set
#   - ~/.metabob/config.json with apiKey + endpoint (or METABOB_API_KEY + METABOB_ENDPOINT set)
#   - Docker running with metabobapp/minibob image available
#
set -euo pipefail

DIR="$(cd "$(dirname "$0")/.." && pwd)"  # validation/
SCRIPTS_DIR="$(cd "$(dirname "$0")" && pwd)"
THOMPSON="$SCRIPTS_DIR/thompson-compare.ts"

SKIP_CC_BASELINE=false
START_FROM=24

while [[ $# -gt 0 ]]; do
  case "$1" in
    --skip-cc-baseline) SKIP_CC_BASELINE=true; shift ;;
    --start-from) START_FROM="$2"; shift 2 ;;
    *) echo "unknown flag: $1" >&2; exit 1 ;;
  esac
done

CAMPAIGN_ID="campaign-$(date +%Y%m%d-%H%M%S)"
CAMPAIGN_DIR="$DIR/runs/$CAMPAIGN_ID"
mkdir -p "$CAMPAIGN_DIR"

REPORT="$CAMPAIGN_DIR/learning-campaign-report.md"

log() { echo "[campaign] $*"; }
snapshot() {
  local label="$1"
  local query="${2:-fix bug in TypeScript utility function}"
  log "Thompson snapshot: $label"
  bun run "$THOMPSON" \
    --query "$query" \
    --label "$label" \
    --limit 8 \
    2>/dev/null | tee -a "$CAMPAIGN_DIR/thompson-snapshots.txt" || true
}

section() {
  local title="$1"
  echo "" >> "$REPORT"
  echo "## $title" >> "$REPORT"
  echo "" >> "$REPORT"
}

cat > "$REPORT" <<EOF
# Learning Campaign Report — $CAMPAIGN_ID

**Date**: $(date -u +"%Y-%m-%d %H:%M:%S UTC")
**Goal**: Demonstrate Thompson Sampling convergence over 4 sequential runs on related TypeScript bug-fix tasks.
**Hypothesis**: After run 24 (cold start), runs 25-26 should select the same template family faster, with rising α on the winning template. Run 27 (feature addition) tests cross-family transfer.

---

EOF

log "Campaign: $CAMPAIGN_ID"
log "Output dir: $CAMPAIGN_DIR"
log "Report: $REPORT"

# ─── Run 24: cold start, bug-fix #1 (multiply) ──────────────────────────────
if [[ $START_FROM -le 24 ]]; then
  section "Run 24 — Cold start: fix multiply bug"

  echo "### Pre-run Thompson snapshot" >> "$REPORT"
  echo "" >> "$REPORT"
  echo "\`\`\`" >> "$REPORT"
  snapshot "pre-run-24 (cold)" "fix bug in TypeScript utility function" >> "$REPORT"
  echo "\`\`\`" >> "$REPORT"

  if [[ "$SKIP_CC_BASELINE" == "false" ]]; then
    log "Run 24a: Claude Code baseline (cold)"
    echo "### Claude Code baseline (cold)" >> "$REPORT"
    echo "" >> "$REPORT"
    if bun run "$DIR/lib/orchestrator.ts" \
        --prompt "$DIR/prompts/24-ts-learning-run-1-multiply-bug.md" \
        --workspace pristine-typescript-project \
        --only claude-code \
        2>&1 | tee "$CAMPAIGN_DIR/run24-cc.log"; then
      echo "**Result**: Claude Code completed." >> "$REPORT"
    else
      echo "**Result**: Claude Code failed or timed out." >> "$REPORT"
    fi
    echo "" >> "$REPORT"
  fi

  log "Run 24b: minibob --with-backend (cold start)"
  echo "### minibob --with-backend (cold start)" >> "$REPORT"
  echo "" >> "$REPORT"
  if bun run "$DIR/lib/orchestrator.ts" \
      --prompt "$DIR/prompts/24-ts-learning-run-1-multiply-bug.md" \
      --workspace pristine-typescript-project \
      --only minibob \
      --with-backend \
      2>&1 | tee "$CAMPAIGN_DIR/run24-mb.log"; then
    echo "**Result**: minibob completed." >> "$REPORT"
  else
    echo "**Result**: minibob failed or timed out." >> "$REPORT"
  fi

  echo "" >> "$REPORT"
  echo "### Post-run-24 Thompson snapshot" >> "$REPORT"
  echo "" >> "$REPORT"
  echo "\`\`\`" >> "$REPORT"
  snapshot "post-run-24 (after 1st fix-bug run)" "fix bug in TypeScript utility function" >> "$REPORT"
  echo "\`\`\`" >> "$REPORT"
fi

# ─── Run 25: warm #1, bug-fix #2 (divide) ────────────────────────────────────
if [[ $START_FROM -le 25 ]]; then
  section "Run 25 — Warm run #1: fix divide bug"

  echo "### Pre-run Thompson snapshot" >> "$REPORT"
  echo "" >> "$REPORT"
  echo "\`\`\`" >> "$REPORT"
  snapshot "pre-run-25 (warm #1)" "fix truncation bug in division function" >> "$REPORT"
  echo "\`\`\`" >> "$REPORT"

  log "Run 25: minibob --with-backend (warm #1)"
  if bun run "$DIR/lib/orchestrator.ts" \
      --prompt "$DIR/prompts/25-ts-learning-run-2-divide-bug.md" \
      --workspace pristine-typescript-project \
      --only minibob \
      --with-backend \
      2>&1 | tee "$CAMPAIGN_DIR/run25-mb.log"; then
    echo "**Result**: minibob completed." >> "$REPORT"
  else
    echo "**Result**: minibob failed or timed out." >> "$REPORT"
  fi

  echo "" >> "$REPORT"
  echo "### Post-run-25 Thompson snapshot" >> "$REPORT"
  echo "" >> "$REPORT"
  echo "\`\`\`" >> "$REPORT"
  snapshot "post-run-25 (after 2nd fix-bug run)" "fix bug in TypeScript function" >> "$REPORT"
  echo "\`\`\`" >> "$REPORT"
fi

# ─── Run 26: warm #2, bug-fix #3 (power) ─────────────────────────────────────
if [[ $START_FROM -le 26 ]]; then
  section "Run 26 — Warm run #2: fix power bug"

  echo "### Pre-run Thompson snapshot" >> "$REPORT"
  echo "" >> "$REPORT"
  echo "\`\`\`" >> "$REPORT"
  snapshot "pre-run-26 (warm #2)" "fix initialisation bug in power function TypeScript" >> "$REPORT"
  echo "\`\`\`" >> "$REPORT"

  log "Run 26: minibob --with-backend (warm #2)"
  if bun run "$DIR/lib/orchestrator.ts" \
      --prompt "$DIR/prompts/26-ts-learning-run-3-power-bug.md" \
      --workspace pristine-typescript-project \
      --only minibob \
      --with-backend \
      2>&1 | tee "$CAMPAIGN_DIR/run26-mb.log"; then
    echo "**Result**: minibob completed." >> "$REPORT"
  else
    echo "**Result**: minibob failed or timed out." >> "$REPORT"
  fi

  echo "" >> "$REPORT"
  echo "### Post-run-26 Thompson snapshot" >> "$REPORT"
  echo "" >> "$REPORT"
  echo "\`\`\`" >> "$REPORT"
  snapshot "post-run-26 (after 3rd fix-bug run)" "fix bug TypeScript utility" >> "$REPORT"
  echo "\`\`\`" >> "$REPORT"
fi

# ─── Run 27: warm #3, feature addition (clamp) ───────────────────────────────
if [[ $START_FROM -le 27 ]]; then
  section "Run 27 — Warm run #3: add clamp function"

  echo "### Pre-run Thompson snapshot" >> "$REPORT"
  echo "" >> "$REPORT"
  echo "\`\`\`" >> "$REPORT"
  snapshot "pre-run-27 (warm #3 — feature add)" "add new utility function with tests TypeScript" >> "$REPORT"
  echo "\`\`\`" >> "$REPORT"

  log "Run 27: minibob --with-backend (warm #3)"
  if bun run "$DIR/lib/orchestrator.ts" \
      --prompt "$DIR/prompts/27-ts-learning-run-4-add-clamp.md" \
      --workspace pristine-typescript-project \
      --only minibob \
      --with-backend \
      2>&1 | tee "$CAMPAIGN_DIR/run27-mb.log"; then
    echo "**Result**: minibob completed." >> "$REPORT"
  else
    echo "**Result**: minibob failed or timed out." >> "$REPORT"
  fi

  echo "" >> "$REPORT"
  echo "### Post-run-27 Thompson snapshot" >> "$REPORT"
  echo "" >> "$REPORT"
  echo "\`\`\`" >> "$REPORT"
  snapshot "post-run-27 (after feature-add run)" "add function with tests TypeScript" >> "$REPORT"
  echo "\`\`\`" >> "$REPORT"
fi

# ─── Final summary ─────────────────────────────────────────────────────────
cat >> "$REPORT" <<'EOF'

---

## Summary

### What to look for

| signal | location | expected progression |
|---|---|---|
| α rising on top template | Thompson snapshots | +1 per successful execution of the template |
| β flat or absent | Thompson snapshots | β only rises on failure; correct fixes keep β=1 |
| same template selected run-over-run | snapshot table | top-1 should stabilise by run 26 |
| lifecycle hooks fired | report.md §6 | slot-binding + validator-dispatch per task |
| discovery-routed impulses | report.md §6 | at least `executionTraceList` or `activityTemplate` routed via discovery |
| new relevance records | report.md §6 | >0 per run |

### Convergence criterion

Thompson convergence is demonstrated when:
1. The same template ID appears as top-1 in run 25 and run 26 snapshots.
2. Its α has grown by at least 1 between run 24 and run 26 (one successful execution = +1 α).
3. Its μ (mean) is higher than the next-best template's μ by a statistically meaningful margin (μ_top > μ_2nd + 2σ_top).

EOF

log "Campaign complete. Report: $REPORT"
log "Thompson snapshots: $CAMPAIGN_DIR/thompson-snapshots.txt"
echo ""
echo "======================================================================"
echo "  Campaign $CAMPAIGN_ID complete"
echo "  Report: $REPORT"
echo "======================================================================"
