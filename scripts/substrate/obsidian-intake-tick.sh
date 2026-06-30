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

# classify_request <text> -> echoes ACTION | ANSWER | DEVELOP (defaults ANSWER on any failure)
classify_request() {
  local text="$1" prompt resp word
  prompt="Classify the operator's request as exactly one word.
DEVELOP = they want the substrate to CHANGE or IMPROVE ITS OWN CODE — a vessel/resolver (fix a bug, optimize, refactor/extract, replace a hardcoded value, add/adjust logic in repos/<vessel>/src). Mentions of a vessel name, a resolver, a code file, 'fix/optimize/refactor/extract/hardcoded'.
ACTION = they want the substrate to DO something to the VAULT (create/write/modify/move/organize/delete a note or file).
ANSWER = they want information back (a question, briefing, summary, explanation: what/why/how/which/explain/tell me).
Request: \"${text}\"
Respond with ONLY the single word DEVELOP, ACTION, or ANSWER."
  resp=$(curl -s -m 20 -X POST "${LLM}" \
    -H "Content-Type: application/json" \
    -H "Authorization: ApiKey ${METABOB_API_KEY}" \
    -d "$(jq -nc --arg p "${prompt}" --arg m "${CLASSIFY_MODEL}" \
          '{type:"llm_completion",prompt:$p,model:$m,max_tokens:10}')" 2>/dev/null)
  word=$(printf '%s' "${resp}" | jq -r '.content // empty' 2>/dev/null \
          | tr '[:lower:]' '[:upper:]' | grep -oE 'DEVELOP|ACTION|ANSWER' | head -1)
  case "${word}" in
    DEVELOP) echo "DEVELOP" ;;
    ACTION)  echo "ACTION" ;;
    *)       echo "ANSWER" ;;
  esac
}

# 1. INTAKE
SCAN=$(curl -s -m 60 -X POST "${DEV}/v2/impulses/resolve" \
  -H "Content-Type: application/json" \
  -H "Authorization: ApiKey ${METABOB_API_KEY}" \
  -d "{\"impulse\":{\"pointer\":{\"type\":\"obsidian_request_scan\",\"obsidianEndpoint\":\"${OBS}\"}}}")
printf '%s\n' "${SCAN}" | head -c 500; echo

# Mark genuine human activity (a NEW inbox request) so the proactive collaborate pass can tell
# an engaged human from an idle one and back off rather than pile up un-engaged notes.
RF=$(printf '%s' "${SCAN}" | jq -r '.body.requests_found // 0' 2>/dev/null)
[ "${RF:-0}" -gt 0 ] 2>/dev/null && date -u +%s > /workspace/last-human-activity 2>/dev/null

# OPERATOR INTERACTION GUIDANCE (human->substrate feedback channel): read the human's standing
# preferences from Substrate/Feedback.md and inject them into every response, so the substrate
# FOLLOWS the human's feedback on HOW to interact (e.g. "answer directly, don't give Obsidian
# tips", "go deeper") instead of defaulting to generic workspace suggestions.
FB_FILE="/vaults/substrate-vault/Substrate/Feedback.md"
GUIDANCE=""
if [ -f "${FB_FILE}" ]; then
  GUIDANCE=$(sed -n '/## My current guidance/,/^---/p' "${FB_FILE}" 2>/dev/null | grep -E '^- .' | sed 's/^- *//' | paste -sd '; ' -)
fi
ANS_TOKENS=700; [ -n "${GUIDANCE}" ] && ANS_TOKENS=1300
[ -n "${GUIDANCE}" ] && printf 'operator interaction guidance in effect: %s\n' "${GUIDANCE}"

# 2. SERVE each picked-up request — model expectation (ACTION vs ANSWER), then route.
printf '%s' "${SCAN}" | jq -r '.body.requests[]? | select(.text != null) | .text' 2>/dev/null | while IFS= read -r TEXT; do
  [ -z "${TEXT}" ] && continue
  SLUG=$(printf '%s' "${TEXT}" | tr '[:upper:]' '[:lower:]' | tr -cs 'a-z0-9' '-' | sed 's/^-*//; s/-*$//' | cut -c1-48)
  [ -z "${SLUG}" ] && SLUG="request"

  KIND=$(classify_request "${TEXT}")
  printf 'classified [%s]: %s\n' "${KIND}" "${TEXT}"

  if [ "${KIND}" = "DEVELOP" ]; then
    # DEVELOP → route into the AUTONOMOUS self-development pipeline as a substrateGap.
    # The human DIRECTS the improvement; the gap-compose → feature_compose → quality-gate
    # → cutover loop authors it, gates it (typecheck + stub + semantic), and lands it on
    # origin/dev (or rejects via the gates). We only CREATE the gap + ack; landing stays gated.
    GAPID="human-request-${SLUG}"
    VHINT=$(printf '%s' "${TEXT}" | grep -oiE 'goal-host-vessel|activity-api|development-vessel|discovery-vessel|identity-vessel|llm-resolver-vessel|local-tools-vessel|analysis-vessel|concept-db|boredom-vessel|ribosome-vessel|stateful-ui-vessel|relevance-sink-vessel' | head -1 | tr '[:upper:]' '[:lower:]')
    META=$(jq -nc --arg v "${VHINT}" --arg pf "${TEXT}" \
      '{proposed_fix:$pf} + (if $v != "" then {vessel:$v} else {} end)')
    GAPBODY=$(jq -nc --arg id "${GAPID}" --arg s "${TEXT}" --argjson m "${META}" \
      '{impulse:{pointer:{type:"substrateGap_write",gap:{id:$id,category:"systematic_failure",status:"open",summary:$s,classification_metadata:$m}}}}')
    curl -s -m 20 -X POST "${DEV}/v2/impulses/resolve" \
      -H "Content-Type: application/json" -H "Authorization: ApiKey ${METABOB_API_KEY}" \
      -d "${GAPBODY}" 2>/dev/null | head -c 200
    NOTE_BODY="---\nsubstrate_develop: queued\ngenerated_at: $(date -u +%Y-%m-%dT%H:%M:%SZ)\n---\n\n# 🔧 queued for the development loop\n\nRouted into autonomous self-development (gap \`${GAPID}\`). I'll author a quality-gated change and land it on dev if it passes typecheck + the stub/semantic gates; otherwise it's rejected and stays open.\n\nRequest: ${TEXT}\n"
    curl -s -m 15 -X POST "${OBS}/resolve" \
      -H "Content-Type: application/json" -H "Authorization: ApiKey ${METABOB_API_KEY}" \
      -d "$(jq -nc --arg p "Substrate/Responses/${SLUG}-develop.md" --arg c "${NOTE_BODY}" \
            '{type:"obsidian:write_note",pointer:{type:"obsidian:write_note",path:$p,content:$c}}')" 2>/dev/null | head -c 200
    printf ' <- queued for dev loop (gap %s): %s\n' "${GAPID}" "${SLUG}"
  elif [ "${KIND}" = "ACTION" ]; then
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
    # ANSWER → compose a response that FOLLOWS the operator's interaction guidance and answers
    # at the depth warranted (NOT a fixed-short Obsidian-usage tip — the inversion we are fixing).
    FOCUS="OPERATOR INTERACTION GUIDANCE (follow strictly; overrides any default): ${GUIDANCE:-Answer directly and substantively; do NOT give generic Obsidian-usage tips; match the depth the question warrants.} --- The operator wrote this request: \"${TEXT}\". Answer the request itself, directly, at the depth it warrants. This is a reply to the operator, not a workspace suggestion."
    REQ=$(jq -nc --arg p "Substrate/Responses/${SLUG}.md" --arg f "${FOCUS}" --argjson mt "${ANS_TOKENS}" \
      '{impulse:{pointer:{type:"obsidian_deliver_assist",assistPath:$p,promptFocus:$f,maxTokens:$mt}}}')
    curl -s -m 90 -X POST "${DEV}/v2/impulses/resolve" \
      -H "Content-Type: application/json" \
      -H "Authorization: ApiKey ${METABOB_API_KEY}" \
      -d "${REQ}" | head -c 200
    printf ' <- served: %s\n' "${SLUG}"
  fi
done
