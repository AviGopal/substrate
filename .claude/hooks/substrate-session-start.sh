#!/usr/bin/env bash
# substrate-session-start.sh — SessionStart hook.
# Pulls memoryNotes from the substrate (development-vessel memoryNote resolver)
# and injects them into session context. The substrate is the source of truth
# for memory; this replaces reading a (truncated) MEMORY.md at load.
#
# Fail-open: if the substrate is unreachable, emit nothing and exit 0 so the
# session still starts (cache fallback applies, per CLAUDE.md §Memory).
set -uo pipefail

EP="${DEV_VESSEL_ENDPOINT:-http://localhost:18090}"

resp="$(curl -s --max-time 4 -X POST "$EP/v2/impulses/resolve" \
  -H 'Content-Type: application/json' \
  -d '{"impulse":{"type":"memoryNote","limit":500}}' 2>/dev/null)" || exit 0
[ -z "$resp" ] && exit 0
echo "$resp" | jq -e '.success and ((.body.notes | length) > 0)' >/dev/null 2>&1 || exit 0

ctx="$(echo "$resp" | jq -r --arg ep "$EP" '
  .body.total as $total
  | .body.notes as $n
  | ([$n[] | select(.type=="feedback")] | sort_by(.updated_at) | reverse) as $fb
  | ([$n[] | select(.type!="feedback")] | sort_by(.updated_at) | reverse) as $rest
  | "# Substrate memory (authoritative — \($total) notes, queried from development-vessel at session start)\n"
    + "\nThis is the source of truth for what is known about this system. To recall full detail, query the memoryNote resolver:\n"
    + "`curl -s -X POST \($ep)/v2/impulses/resolve -d '"'"'{\"impulse\":{\"type\":\"memoryNote\",\"title_prefix\":\"...\"}}'"'"'` (filters: id | note_type | title_prefix | provenance_tag | limit).\n"
    + "\n## Feedback / conventions (\($fb | length)) — behavioral guidance, read these\n"
    + (if ($fb | length) > 0 then ([$fb[] | "- **\(.title)** — \((.body // "") | gsub("[\n\r]+";" ") | .[0:420])"] | join("\n")) else "_(none)_" end)
    + "\n\n## Recent findings & project state (top 35 of \($rest | length); query memoryNote for full body)\n"
    + (if ($rest | length) > 0 then ([$rest[0:35][] | "- [\(.type)] \(.title)"] | join("\n")) else "_(none)_" end)
')" || exit 0

[ -z "$ctx" ] && exit 0

# Concept priors: the substrate's relevance-ranked constitutional knowledge
# (concept_select_for_prompt → conceptPromptPriors), resolved through the
# discovery gateway. Same fail-open contract as the memory block above.
GW="${DISCOVERY_ENDPOINT:-http://localhost:18100}"
APIKEY="$(jq -r '.metabob.apiKey // .apiKey // empty' "$HOME/.metabob/config.json" 2>/dev/null)"
if [ -n "$APIKEY" ]; then
  priors="$(curl -s --max-time 8 -X POST "$GW/resolve" \
    -H "Authorization: ApiKey $APIKEY" -H 'Content-Type: application/json' \
    -d '{"pointer":{"type":"concept_select_for_prompt"}}' 2>/dev/null)"
  if [ -n "$priors" ] && echo "$priors" | jq -e '.success and ((.body.selected | length) > 0)' >/dev/null 2>&1; then
    cctx="$(echo "$priors" | jq -r '
      .body as $b
      | "\n\n## Concept priors (conceptPromptPriors — \($b.selected_count) of \($b.candidates_considered) candidates, relevance-selected by the substrate)\n"
        + "Full bodies: resolve shape `concept` with pointer.concept_id via the discovery gateway.\n"
        + ([.body.selected[0:15][]
            | "- **\(.name // (.id | sub("^concept:";"")))** [\(.source_type)] — \((.content // "") | gsub("[\n\r]+";" ") | .[0:400])"
          ] | join("\n"))
    ' 2>/dev/null)"
    [ -n "$cctx" ] && ctx="$ctx$cctx"
  fi
fi

jq -nc --arg c "$ctx" '{hookSpecificOutput:{hookEventName:"SessionStart",additionalContext:$c}}'
exit 0
