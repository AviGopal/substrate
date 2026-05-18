#!/usr/bin/env bash
# Workspace-level shape-dispatch agreement check (Phase 23 task 4.2).
# Runs bun packages/shape-dispatch-check/check.ts against every vessel that
# has the standard src/config.ts + src/routes/impulses.ts layout.
#
# Usage: scripts/check-shape-dispatch-all.sh [--quiet]
#   --quiet  suppress OK lines, only show violations

set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
CHECK_SCRIPT="$REPO_ROOT/packages/shape-dispatch-check/check.ts"
QUIET="${1:-}"

VESSELS=(
  "repos/metabob-activity-api"
  "repos/concept-db"
)

FAIL=0

for vessel in "${VESSELS[@]}"; do
  vessel_path="$REPO_ROOT/$vessel"
  if [[ ! -f "$vessel_path/src/config.ts" ]] || [[ ! -f "$vessel_path/src/routes/impulses.ts" ]]; then
    if [[ "$QUIET" != "--quiet" ]]; then
      echo "SKIP $vessel (missing src/config.ts or src/routes/impulses.ts)"
    fi
    continue
  fi

  if bun "$CHECK_SCRIPT" "$vessel_path" 2>&1; then
    if [[ "$QUIET" != "--quiet" ]]; then
      echo "OK   $vessel"
    fi
  else
    echo "FAIL $vessel"
    FAIL=1
  fi
done

if [[ $FAIL -eq 0 ]]; then
  echo "All vessels pass shape-dispatch agreement check."
else
  echo "One or more vessels have shape-dispatch violations. See output above."
  exit 1
fi
