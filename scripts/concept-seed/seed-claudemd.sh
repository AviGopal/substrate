#!/usr/bin/env bash
# Bootstrap constitutional concepts into concept-db from CLAUDE.md sections
# and the impulse/activity foundation doc.
#
# Idempotency note: re-running creates duplicates. Run once on first
# substrate setup; if you need to re-seed, clean the existing
# vessel_construction_pattern / impulse_activity_pattern concepts first.
set -euo pipefail

CONTAINER="${SUBSTRATE_CONTAINER:-substrate-live}"
REPO_ROOT="${REPO_ROOT:-$(git -C "$(dirname "$0")" rev-parse --show-toplevel)}"
SCRIPT_PATH="$REPO_ROOT/scripts/concept-seed/seed-claudemd.ts"

# The seed script must exist at REPO_ROOT inside the container, and it reads
# CLAUDE.md files via REPO_ROOT. The launch manifest mounts no host checkout, so
# point REPO_ROOT at the substrate's own super-repo clone
# (REPO_ROOT=/workspace/git/super-repo) unless a checkout is mounted at the same
# absolute path.
if ! docker exec "$CONTAINER" test -f "$SCRIPT_PATH"; then
  echo "Seed script not present at $SCRIPT_PATH inside $CONTAINER."
  echo "Set REPO_ROOT=/workspace/git/super-repo (the in-container clone), or mount a checkout at REPO_ROOT."
  exit 1
fi

docker exec -e REPO_ROOT="$REPO_ROOT" "$CONTAINER" \
  bash -c "set -a; source /etc/substrate/env; set +a; bun '$SCRIPT_PATH'"
