#!/usr/bin/env bash
# Bootstrap constitutional concepts into concept-db from CLAUDE.md sections
# and the impulse/activity foundation doc.
#
# Idempotency note: re-running creates duplicates. Run once on first
# substrate setup; if you need to re-seed, clean the existing
# vessel_construction_pattern / impulse_activity_pattern concepts first.
set -euo pipefail

CONTAINER="${SUBSTRATE_CONTAINER:-substrate-live}"
REPO_ROOT="${REPO_ROOT:-/home/avi/documents/work/exp-repo/metabob-devbob}"
SCRIPT_PATH="$REPO_ROOT/scripts/concept-seed/seed-claudemd.ts"

# Repo is bind-mounted into the container read-only at the same absolute path
# (see scripts/substrate/Makefile run-live target). The seed script reads
# CLAUDE.md files via REPO_ROOT.
if ! docker exec "$CONTAINER" test -f "$SCRIPT_PATH"; then
  echo "Seed script not present at $SCRIPT_PATH inside $CONTAINER."
  echo "Ensure the repo bind-mount is active (-v REPO_ROOT:REPO_ROOT:ro)."
  exit 1
fi

docker exec -e REPO_ROOT="$REPO_ROOT" "$CONTAINER" \
  bash -c "set -a; source /etc/substrate/env; set +a; bun '$SCRIPT_PATH'"
