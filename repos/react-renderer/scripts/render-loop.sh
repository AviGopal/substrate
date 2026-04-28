#!/usr/bin/env bash
# render-loop.sh — Iterates through UI scenarios to test react-renderer coverage.
# Clears the viewport between scenarios, renders via minibob, screenshots.
# Usage: ./scripts/render-loop.sh [iterations] [theme]
#   iterations: number of random generate passes (default: 5)
#   theme: optional theme name passed to --var theme=

set -euo pipefail

ENDPOINT="${REACT_RENDERER_ENDPOINT:-http://localhost:3001}"
MINIBOB="${MINIBOB_BIN:-bun run ../../repos/minibob/index.ts}"
WORKDIR="$(cd "$(dirname "$0")/.." && pwd)"
ITERATIONS="${1:-5}"
THEME="${2:-}"
SCREENSHOT_DIR="$WORKDIR/.playwright-mcp"

mkdir -p "$SCREENSHOT_DIR"

info() { echo -e "\033[1;34m[loop]\033[0m $*"; }
ok()   { echo -e "\033[1;32m[ok]\033[0m $*"; }
err()  { echo -e "\033[1;31m[err]\033[0m $*"; }

# Scenarios to cycle through (theme hints)
SCENARIOS=(
  "deployment metrics dashboard with 4 KPIs"
  "code review summary with diff stats and reviewer badges"
  "user onboarding wizard step 1 of 3"
  "system health monitor with CPU memory disk"
  "data exploration table with filter controls"
  "API performance metrics with charts"
  "error log viewer with severity badges"
  "team activity feed with timestamps"
  "feature flag dashboard with toggle states"
  "cost analysis breakdown by service"
)

# ──────────────────────────────────────────────────────────────────────────────
# 1. Verify server is reachable
# ──────────────────────────────────────────────────────────────────────────────
if ! curl -sf "$ENDPOINT/health" > /dev/null; then
  err "react-renderer not reachable at $ENDPOINT — start server first:"
  err "  PORT=3001 bun run dist/index.js"
  exit 1
fi
info "Server OK: $ENDPOINT"

# ──────────────────────────────────────────────────────────────────────────────
# 2. Apply theme (optional)
# ──────────────────────────────────────────────────────────────────────────────
if [ -n "$THEME" ]; then
  info "Applying theme: $THEME"
  cd "$WORKDIR"
  $MINIBOB --template .minibob/templates/theme-setup.json \
           --workdir "$WORKDIR" \
           --var "theme=$THEME" \
           -q 2>&1 | tail -3
  ok "Theme applied"
fi

# ──────────────────────────────────────────────────────────────────────────────
# 3. Loop through scenarios
# ──────────────────────────────────────────────────────────────────────────────
PASS=0
FAIL=0
TOTAL="${ITERATIONS}"

for i in $(seq 1 "$TOTAL"); do
  # Pick scenario round-robin
  IDX=$(( (i - 1) % ${#SCENARIOS[@]} ))
  SCENARIO="${SCENARIOS[$IDX]}"
  THEME_HINT="${THEME:-$SCENARIO}"

  info "Run $i/$TOTAL: $SCENARIO"

  # Clear viewport between runs
  curl -sf -X DELETE "$ENDPOINT/impulses" \
       -H "Content-Type: application/json" \
       -d '{}' > /dev/null

  SHOT="$SCREENSHOT_DIR/loop-run-$i.png"

  # Run ui-render-validate with the scenario as theme hint
  cd "$WORKDIR"
  OUTPUT=$($MINIBOB --template .minibob/templates/ui-render-validate.json \
                    --workdir "$WORKDIR" \
                    --var "theme=$THEME_HINT" \
                    -q 2>&1 || true)

  # Take screenshot regardless of minibob exit code
  bun -e "
    const { execute } = await import('./.minibob/tools/playwright-tool.ts');
    const r = await execute({ action: 'screenshot', url: 'http://localhost:3001/app', outputPath: '$SHOT', waitMs: 1500 });
    if (r.success) console.log('screenshot: $SHOT');
    else console.error('screenshot failed:', r.error);
  " 2>&1

  # Check if impulses were pushed (success indicator)
  COUNT=$(curl -sf "$ENDPOINT/impulses" 2>/dev/null | python3 -c "import sys,json; d=json.load(sys.stdin); print(len(d.get('impulses',[])))" 2>/dev/null || echo 0)

  if [ "$COUNT" -gt 0 ]; then
    ok "Run $i PASS — $COUNT impulse(s) rendered → $SHOT"
    PASS=$((PASS + 1))
  else
    err "Run $i FAIL — 0 impulses (render_ui not called or error)"
    FAIL=$((FAIL + 1))
  fi
done

# ──────────────────────────────────────────────────────────────────────────────
# 4. Summary
# ──────────────────────────────────────────────────────────────────────────────
echo ""
info "═══════════════════════════════════════════"
info "  Render Loop Complete: $PASS/$TOTAL passed"
[ "$FAIL" -gt 0 ] && err "  $FAIL runs failed (0 impulses rendered)"
info "  Screenshots: $SCREENSHOT_DIR/loop-run-*.png"
info "═══════════════════════════════════════════"
