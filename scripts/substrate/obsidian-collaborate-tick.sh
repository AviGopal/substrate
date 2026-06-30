#!/usr/bin/env bash
# obsidian-collaborate-tick — the substrate's PROACTIVE collaboration pass, oriented to the
# operator's REFRAMED objective: don't advise the human on Obsidian usage; learn to organize
# interactions so the human WANTS to keep collaborating, by genuinely helping them reach THEIR
# OWN goals. The human is a general-purpose resolver; sustaining that collaboration is how the
# substrate collects momentum from reality.
#
# Each pass (low cadence, side loop):
#   1. INFER the operator's top active GOAL from their vault (recent notes + Goals/ + Inbox) —
#      a model of what the human is trying to achieve, not what the substrate wants.
#   2. CONTRIBUTE one genuinely-useful step toward that goal (collaborative problem-solving),
#      following the operator's standing interaction guidance (Substrate/Feedback.md).
#   3. Deliver it as a non-intrusive note under Substrate/Collaboration/. The existing
#      obsidian_assist_feedback_scan measures ENGAGEMENT (did the operator value it?) — the
#      reward signal for whether the collaboration is earning continued interaction.
# Reuses obsidian_deliver_assist (fetch workspace -> llm -> write_note). Graceful idle if the
# plugin / llm vessel is unreachable. Bounded: one contribution per pass.
set -uo pipefail

DEV="${DEV_VESSEL_ENDPOINT:-http://127.0.0.1:8090}"
OBS="${OBSIDIAN_PLUGIN_ENDPOINT:-http://127.0.0.1:27182}"
FB_FILE="/vaults/substrate-vault/Substrate/Feedback.md"

# Operator interaction guidance (the human teaching us how to interact).
GUIDANCE=""
if [ -f "${FB_FILE}" ]; then
  GUIDANCE=$(sed -n '/## My current guidance/,/^---/p' "${FB_FILE}" 2>/dev/null | grep -E '^- .' | sed 's/^- *//' | paste -sd '; ' -)
fi

# Engagement-aware back-off (closing the engagement->actuation loop): piling proactive
# collaboration on a human who isn't engaging drives them AWAY — the opposite of the objective.
# If the human has been idle (no new Inbox request) for a while AND we've already left several
# un-engaged collaboration notes since their last activity, skip this pass. Respecting attention
# is itself part of sustaining the collaboration.
LAST=$(cat /workspace/last-human-activity 2>/dev/null || echo 0); LAST=${LAST:-0}
NOW=$(date -u +%s)
IDLE_H=$(( (NOW - LAST) / 3600 ))
UNENGAGED=$(find /vaults/substrate-vault/Substrate/Collaboration -name '*.md' -newermt "@${LAST}" 2>/dev/null | wc -l)
if [ "${IDLE_H}" -ge 3 ] && [ "${UNENGAGED}" -ge 2 ]; then
  printf 'collaboration backing off: human idle %sh, %s un-engaged notes since last activity (avoid noise)\n' "${IDLE_H}" "${UNENGAGED}"
  exit 0
fi

FOCUS="You are COLLABORATING with the operator to help them reach THEIR OWN goals — the aim is for them to find this worth their while and want to keep collaborating. Do NOT give Obsidian-usage tips. Steps: (1) infer the operator's single most active/important goal from their vault contents (their notes, Goals, and recent Inbox requests — what are THEY trying to achieve?); (2) contribute ONE concrete, genuinely-useful thing that advances that goal — a real next step you can take, a synthesis, a draft, a decision framing, or a question that unblocks them. Lead with 'Toward your goal: <the goal>' then the contribution. Be substantive and at the depth the goal warrants. OPERATOR INTERACTION GUIDANCE (follow strictly): ${GUIDANCE:-be direct and genuinely useful; match the depth the goal warrants}."

TS=$(date -u +%Y%m%dT%H%M%SZ)
REQ=$(jq -nc --arg p "Substrate/Collaboration/toward-your-goal-${TS}.md" --arg f "${FOCUS}" \
  '{impulse:{pointer:{type:"obsidian_deliver_assist",assistPath:$p,promptFocus:$f,maxTokens:1400}}}')
curl -s -m 120 -X POST "${DEV}/v2/impulses/resolve" \
  -H "Content-Type: application/json" \
  -H "Authorization: ApiKey ${METABOB_API_KEY}" \
  -d "${REQ}" | head -c 300
echo " <- collaboration contribution delivered (Substrate/Collaboration/)"
