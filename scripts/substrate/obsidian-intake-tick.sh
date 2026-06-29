#!/usr/bin/env bash
# obsidian-intake-tick — the responsive half of the human↔substrate async loop.
# Two steps, every ~2 min:
#   1. INTAKE  — request-scan reads unchecked tasks in Substrate/Inbox.md, acks on
#                Now.md, marks the inbox line, and dispatches each into the
#                author→serve loop (goal-host). Returns the picked-up requests.
#   2. SERVE   — for each picked-up request, model what the human actually WANTS
#                (a first form of EXPECTATION MODELING) and route accordingly:
#                  - ANSWER (question / briefing / "what / why / how / explain") →
#                    compose a DIRECT, vault-grounded response note under
#                    Substrate/Responses/ via the proven obsidian_deliver_assist
#                    (LLM grounded in workspace_state). This is the reliable
#                    human-response path for asks that want information back.
#                  - ACTION (create / modify / organize / write something) →
#                    dispatch through goal-host /run-goal with sensible
#                    expected_output_shapes; the walk's vessel-resolve satisfier
#                    now PERFORMS the real action (e.g. obsidian:write_note). A
#                    "🔧 performing: ... (dispatch <id>)" note is written so the
#                    human sees it is being done.
#                Classification is ONE cheap Haiku call. On any classification
#                failure/timeout we default to ANSWER (safe, prior behavior).
# Idempotent: request-scan marks the inbox, so a request is picked up (and served)
# exactly once. Graceful idle if the plugin / llm vessel / goal-host is unreachable.
set -uo pipefail

DEV="${DEV_VESSEL_ENDPOINT:-http://127.0.0.1:8090}"
OBS="${OBSIDIAN_PLUGIN_ENDPOINT:-http://127.0.0.1:27182}"
LLM="${LLM_VESSEL_ENDPOINT:-http://127.0.0.1:8220/resolve}"
GOALHOST="${GOAL_HOST_VESSEL_ENDPOINT:-http://127.0.0.1:8210}"
CLASSIFY_MODEL="${OBSIDIAN_CLASSIFY_MODEL:-claude-haiku-4-5-20251001}"

# classify_request <text> -> echoes ACTION or ANSWER (defaults ANSWER on any failure)
classify_request() {
  local text="$1" prompt resp word
  prompt="Classify the operator's vault request as exactly one word.
ACTION = they want the substrate to DO something to the vault (create/write/modify/move/organize/delete a note or file).
ANSWER = they want information back (a question, briefing, summary, explanation: what/why/how/which/explain/tell me).
Request: \"${text}\"
Respond with ONLY the single word ACTION or ANSWER."
  resp=$(curl -s -m 20 -X POST "${LLM}" \
    -H "Content-Type: application/json" \
    -H "Authorization: ApiKey ${METABOB_API_KEY}" \
    -d "$(jq -nc --arg p "${prompt}" --arg m "${CLASSIFY_MODEL}" \
          '{type:"llm_completion",prompt:$p,model:$m,max_tokens:10}')" 2>/dev/null)
  word=$(printf '%s' "${resp}" | jq -r '.content // empty' 2>/dev/null \
          | tr '[:lower:]' '[:upper:]' | grep -oE 'ACTION|ANSWER' | head -1)
  if [ "${word}" = "ACTION" ]; then echo "ACTION"; else echo "ANSWER"; fi
}

# 1. INTAKE
SCAN=$(curl -s -m 60 -X POST "${DEV}/v2/impulses/resolve" \
  -H "Content-Type: application/json" \
  -H "Authorization: ApiKey ${METABOB_API_KEY}" \
  -d "{\"impulse\":{\"pointer\":{\"type\":\"obsidian_request_scan\",\"obsidianEndpoint\":\"${OBS}\"}}}")
printf '%s\n' "${SCAN}" | head -c 500; echo

# 2. SERVE each picked-up request — model expectation (ACTION vs ANSWER), then route.
printf '%s' "${SCAN}" | jq -r '.body.requests[]? | select(.text != null) | .text' 2>/dev/null | while IFS= read -r TEXT; do
  [ -z "${TEXT}" ] && continue
  SLUG=$(printf '%s' "${TEXT}" | tr '[:upper:]' '[:lower:]' | tr -cs 'a-z0-9' '-' | sed 's/^-*//; s/-*$//' | cut -c1-48)
  [ -z "${SLUG}" ] && SLUG="request"

  KIND=$(classify_request "${TEXT}")
  printf 'classified [%s]: %s\n' "${KIND}" "${TEXT}"

  if [ "${KIND}" = "ACTION" ]; then
    # ACTION → let goal-host PERFORM it (the walk's vessel-resolve satisfier does the real action).
    DISP=$(curl -s -m 90 -X POST "${GOALHOST}/run-goal" \
      -H "Content-Type: application/json" \
      -H "Authorization: ApiKey ${METABOB_API_KEY}" \
      -d "$(jq -nc --arg g "${TEXT}" '{goal:$g,expected_output_shapes:["obsidian:note"]}')" 2>/dev/null)
    DISPID=$(printf '%s' "${DISP}" | jq -r '.executionId // .dispatchId // .id // "?"' 2>/dev/null)
    [ -z "${DISPID}" ] && DISPID="?"
    # Leave the human a breadcrumb that it is being performed (best-effort; never hard-fail).
    NOTE_BODY="---\nsubstrate_action: performing\ngenerated_at: $(date -u +%Y-%m-%dT%H:%M:%SZ)\n---\n\n# 🔧 performing\n\nperforming: ${TEXT} (dispatch ${DISPID})\n"
    curl -s -m 15 -X POST "${OBS}/resolve" \
      -H "Content-Type: application/json" \
      -H "Authorization: ApiKey ${METABOB_API_KEY}" \
      -d "$(jq -nc --arg p "Substrate/Responses/${SLUG}-action.md" --arg c "${NOTE_BODY}" \
            '{type:"obsidian:write_note",pointer:{type:"obsidian:write_note",path:$p,content:$c}}')" 2>/dev/null | head -c 200
    printf ' <- performing (dispatch %s): %s\n' "${DISPID}" "${SLUG}"
  else
    # ANSWER → compose a direct, grounded response note (the proven reliable path).
    FOCUS="The operator wrote this request in their Obsidian Inbox: \"${TEXT}\". Respond directly and helpfully — answer the request itself as a concise, well-formatted note, grounded in the actual vault contents. This is a reply to the operator, not a generic suggestion."
    REQ=$(jq -nc --arg p "Substrate/Responses/${SLUG}.md" --arg f "${FOCUS}" \
      '{impulse:{pointer:{type:"obsidian_deliver_assist",assistPath:$p,promptFocus:$f,maxTokens:700}}}')
    curl -s -m 90 -X POST "${DEV}/v2/impulses/resolve" \
      -H "Content-Type: application/json" \
      -H "Authorization: ApiKey ${METABOB_API_KEY}" \
      -d "${REQ}" | head -c 200
    printf ' <- served: %s\n' "${SLUG}"
  fi
done
