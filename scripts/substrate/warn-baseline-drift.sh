#!/usr/bin/env bash
# warn-baseline-drift.sh — say so when a hand-sync poisons the compose baseline.
#
# `make sync-<vessel>` docker-cp's the operator's working tree into the LIVE
# runtime (/vessels/<vessel>). It does not touch the vessel's git clone
# (/workspace/git/vessels/<vessel>), which is a different tree with a different
# job: patch_with_tools diffs live against clone to decide what a rollback should
# restore, and refuses to run when they disagree before any edit:
#
#   [patch-with-tools] POISONED BASELINE: /vessels/<v>/src/index.ts (828577B)
#   differs from its clone (875133B) BEFORE any edit — rollback would restore
#   the live state, not the git state.
#
# That guard is CORRECT and must not be weakened: rolling back to a hand-synced
# live tree would silently discard whatever the operator had just deployed.
# Measured 2026-08-09: three consecutive self-development runs were blocked by a
# baseline this Makefile had poisoned minutes earlier, and the cause was
# invisible from the deploy side — the sync printed success either way.
#
# So this only reports. It cannot fix the drift, because the honest repair is
# "push your commit and let the substrate refresh its own mirror" — the clone
# tracks origin/dev, and writing into it from here would forge a git state that
# no commit backs.
#
# Exits 0 always: a warning must never fail a deploy.
set -uo pipefail

VESSEL="${1:?usage: warn-baseline-drift.sh <vessel> [container]}"
CONTAINER="${2:-substrate-live}"

command -v docker >/dev/null 2>&1 || exit 0
docker inspect "$CONTAINER" >/dev/null 2>&1 || exit 0

# Compare the whole src tree, not one file: a drifted module the deploy touched
# poisons the baseline just as thoroughly as a drifted index.ts, and checking a
# single hardcoded path is the same mistake the sync targets themselves made.
DRIFT="$(docker exec "$CONTAINER" sh -c "
  live=/vessels/$VESSEL/src
  clone=/workspace/git/vessels/$VESSEL/src
  [ -d \"\$live\" ] && [ -d \"\$clone\" ] || exit 0
  diff -rq \"\$live\" \"\$clone\" 2>/dev/null | head -5
" 2>/dev/null || true)"

[ -z "$DRIFT" ] && exit 0

printf '\033[33m[sync] WARNING: %s live tree now differs from its git clone\033[0m\n' "$VESSEL"
printf '%s\n' "$DRIFT" | sed 's/^/       /'
printf '       The substrate reads BOTH trees. Until the clone catches up,\n'
printf '       patch_with_tools will refuse to edit this vessel (POISONED BASELINE)\n'
printf '       and self-development on it is blocked.\n'
printf '       Fix: commit + push, then the compose path refreshes its own mirror.\n'
exit 0
