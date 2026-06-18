#!/usr/bin/env bash
# obsidian-learn-tick — one autonomous Obsidian learning pass (side loop,
# dispatched by obsidian-learn.timer). DEFAULT is CATALOG mode: non-intrusive
# surface learning from command_catalog on the LIVE vault (27183) — reads only,
# no UI shuffling, idempotent (only new commands persisted). Set
# OBSIDIAN_LEARN_MODE=probe + a probe endpoint for execution-based effect
# learning. Unreachable instance is a graceful idle, never a hard failure.
set -uo pipefail

MODE="${OBSIDIAN_LEARN_MODE:-catalog}"
ENDPOINT="${OBSIDIAN_LEARN_ENDPOINT:-http://host.docker.internal:27183}"
GRANT="${OBSIDIAN_LEARN_GRANT:-navigate}"
MAX="${OBSIDIAN_LEARN_MAX:-10}"
DEV_VESSEL="${DEV_VESSEL_ENDPOINT:-http://127.0.0.1:8090}"

# FIRST pass: INTAKE — pick up EXPLICIT operator requests written as unchecked
# tasks in Substrate/Inbox.md, ack them on the Substrate/Now.md status board, and
# dispatch each into the author→serve loop. This is the "ambient" interaction
# model: the operator works in their own notes — no sidebar, no CLI — writes a
# request, and sees "🔄 I'm working on it" appear in their own vault on the next
# tick, with results landing under Substrate/. Done first so the operator's
# explicit asks are served before the substrate's own self-directed learning.
read -r -d '' REQUEST_BODY <<JSON
{"impulse":{"pointer":{"type":"obsidian_request_scan","obsidianEndpoint":"${ENDPOINT}"}}}
JSON
curl -s -m 60 -X POST "${DEV_VESSEL}/v2/impulses/resolve" \
  -H "Content-Type: application/json" \
  -H "Authorization: ApiKey ${METABOB_API_KEY}" \
  -d "${REQUEST_BODY}" | head -c 400
echo

read -r -d '' BODY <<JSON
{"impulse":{"pointer":{"type":"obsidian_learn_commands","learnMode":"${MODE}","obsidianEndpoint":"${ENDPOINT}","grantedClasses":["${GRANT}"],"maxCommands":${MAX}}}}
JSON

curl -s -m 200 -X POST "${DEV_VESSEL}/v2/impulses/resolve" \
  -H "Content-Type: application/json" \
  -H "Authorization: ApiKey ${METABOB_API_KEY}" \
  -d "${BODY}" | head -c 1000
echo

# Second pass: learn the OPERATOR — build the forward model P(next-action|current)
# from obsidian:event_observed. Reads only, graceful idle, persists obsidian_behavior
# priors + emits substrateGap on unpredictable transitions (autonomous-improvement driver).
read -r -d '' BEHAVIOR_BODY <<JSON
{"impulse":{"pointer":{"type":"obsidian_behavior_scan","obsidianEndpoint":"${ENDPOINT}"}}}
JSON
curl -s -m 60 -X POST "${DEV_VESSEL}/v2/impulses/resolve" \
  -H "Content-Type: application/json" \
  -H "Authorization: ApiKey ${METABOB_API_KEY}" \
  -d "${BEHAVIOR_BODY}" | head -c 1000
echo

# Third pass: RESPOND — render what was learned onto the substrate vault-render
# board so the operator sees it (closes observe→respond). Non-intrusive (board,
# not operator notes). Graceful idle if concept-db unreachable.
read -r -d '' REFLECT_BODY <<JSON
{"impulse":{"pointer":{"type":"obsidian_reflect"}}}
JSON
curl -s -m 30 -X POST "${DEV_VESSEL}/v2/impulses/resolve" \
  -H "Content-Type: application/json" \
  -H "Authorization: ApiKey ${METABOB_API_KEY}" \
  -d "${REFLECT_BODY}" | head -c 600
echo

# UI SELF-PERCEPTION pass: the substrate reads its OWN UI artifacts (Now/Workflow/
# Assists) back through obsidian to check they RENDERED as expected (the UI responded
# to its writes), and counts operator engagement (how its presence is perceived).
# Emits a gap on render-failure (UI didn't respond as expected) or chronic ignore.
read -r -d '' UIPERC_BODY <<JSON
{"impulse":{"pointer":{"type":"obsidian_ui_perception_scan"}}}
JSON
curl -s -m 40 -X POST "${DEV_VESSEL}/v2/impulses/resolve" \
  -H "Content-Type: application/json" \
  -H "Authorization: ApiKey ${METABOB_API_KEY}" \
  -d "${UIPERC_BODY}" | head -c 500
echo

# Fourth pass: develop + deliver + GRADE obsidian functionality (autonomous, non-intrusive).
# Two assist CLASSES so reaction-grading can learn which kind of help the operator uses.
call() { curl -s -m 60 -X POST "${DEV_VESSEL}/v2/impulses/resolve" -H "Content-Type: application/json" -H "Authorization: ApiKey ${METABOB_API_KEY}" -d "$1" | head -c 300; echo; }
call '{"impulse":{"pointer":{"type":"obsidian_assist_bridge"}}}'
# active-note: run the SUBSTRATE-AUTHORED activity so it accrues trace evidence + auto-promotes
curl -s -m 60 -X POST "${GOAL_HOST:-http://127.0.0.1:8210}/run-goal" -H "Content-Type: application/json" -H "Authorization: ApiKey ${METABOB_API_KEY}" -d '{"goal":"deliver obsidian active-note assist","targetTemplateId":"proposed_pattern_authored_obsidian_assist_active_note","variables":{}}' | head -c 200; echo
call '{"impulse":{"pointer":{"type":"obsidian_deliver_assist","assistPath":"Substrate/Assists/next-actions.md","promptFocus":"the operator next concrete actions given their open notes and goal-dispatch state"}}}'
call '{"impulse":{"pointer":{"type":"obsidian_assist_feedback_scan"}}}'
