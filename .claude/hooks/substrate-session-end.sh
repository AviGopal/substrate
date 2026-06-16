#!/usr/bin/env bash
# substrate-session-end.sh — SessionEnd hook.
# Dispatches a memory-consolidation goal to the substrate (goal-host-vessel) so
# the session's learnings are absorbed by the loop. Detached + non-blocking so
# session teardown is not delayed. Fail-open: substrate down => skip.
set -uo pipefail

GH="${GOAL_HOST_ENDPOINT:-http://localhost:18210}"
LOG="$HOME/.claude/substrate-session-end.log"
KEY="${METABOB_API_KEY:-$(jq -r '.metabob.apiKey // empty' "$HOME/.metabob/config.json" 2>/dev/null)}"

# Fail open if goal-host is unreachable — can't dispatch through a dead substrate.
if ! curl -s --max-time 2 "$GH/health" >/dev/null 2>&1; then
  echo "$(date -u) skip: goal-host unreachable at $GH" >>"$LOG"
  exit 0
fi

GOAL='Consolidate the most recent operator memoryNotes into durable substrate knowledge: review recent memoryNote impulses and link load-bearing findings/conventions into the concept graph, superseding any that are now stale.'

# Detach so the session can end immediately; the dispatch runs to completion.
setsid bash -c "
  resp=\$(curl -s --max-time 90 -X POST '$GH/run-goal' \
    -H 'Content-Type: application/json' \
    -H 'Authorization: ApiKey ${KEY}' \
    -d '$(jq -nc --arg g "$GOAL" '{goal:$g,variables:{}}')' 2>&1)
  echo \"\$(date -u) dispatched: \$resp\" >>'$LOG'
" >/dev/null 2>&1 &

echo "$(date -u) dispatch queued to $GH" >>"$LOG"
exit 0
