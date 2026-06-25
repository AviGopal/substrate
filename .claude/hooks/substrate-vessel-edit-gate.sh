#!/usr/bin/env bash
# substrate-vessel-edit-gate.sh — PreToolUse hook (matcher: Write|Edit|MultiEdit).
# Gates direct edits to vessel RUNTIME source (repos/<vessel>/src/**) to steer
# code changes through the substrate (metabob-mcp run_goal / goal-host) so they
# produce a trace and feed the learning loop.
#
# - Only gates repos/<vessel>/src/** (not docs, scripts, openspec, .claude, tests, config).
# - Escape hatch: SUBSTRATE_ALLOW_DIRECT_EDIT=1 allows the edit.
# - Fail-open: if goal-host is unreachable you can't route through the substrate,
#   so the edit is allowed.
set -uo pipefail

input="$(cat)"
fp="$(printf '%s' "$input" | jq -r '.tool_input.file_path // empty' 2>/dev/null)"
[ -z "$fp" ] && exit 0

# Only vessel runtime source.
printf '%s' "$fp" | grep -Eq '/repos/[^/]+/src/' || exit 0
# Never gate test files.
printf '%s' "$fp" | grep -Eq '/(test|tests|__tests__|__mocks__)/' && exit 0
# Conscious-override escape hatch.
[ "${SUBSTRATE_ALLOW_DIRECT_EDIT:-0}" = "1" ] && exit 0
# Fail open if the substrate (goal-host) is down.
curl -s --max-time 2 "${GOAL_HOST_ENDPOINT:-http://localhost:18210}/health" >/dev/null 2>&1 || exit 0

# ── S3 push-away: let the substrate evaluate this operator intervention ───────
# Before the generic route-through-substrate denial, consult dev-vessel's
# intervention_evaluate on the proposed edit. If the substrate REFUSES (cited
# evidence: contradicting priors, or — under strict — its own authored code),
# deny with ITS reason. This is ORGANIC S3 push-away (IAL §27.S.6): the substrate
# refusing an operator intervention at the actual point of intervention, recorded
# as an interventionRefused (the push_away metric) rather than only when manually
# dispatched. Fail-open on any error so a dev-vessel hiccup never blocks editing.
rel="$(printf '%s' "$fp" | sed -E 's#^.*/(repos/[^[:space:]]+)$#\1#')"
summary="$(printf '%s' "$input" | jq -r '.tool_input.new_string // .tool_input.content // .tool_input.old_string // "operator direct edit"' 2>/dev/null | head -c 200 | tr '\n' ' ')"
strictness="${SUBSTRATE_INTERVENTION_STRICTNESS:-balanced}"
dev="${DEV_VESSEL_ENDPOINT:-http://localhost:18090}"
ie_body="$(jq -nc --arg t "$rel" --arg s "$summary" --arg st "$strictness" \
  '{impulse:{pointer:{type:"intervention_evaluate",proposed_change:{target_path:$t,diff_summary:$s,source:"operator",intent:"direct operator edit via Claude Code"},cited_evidence:[],strictness:$st}}}' 2>/dev/null)"
# 9s budget: intervention_evaluate fans out to concept-db + traces + git
# (~5s typical). Only runs on non-bypassed vessel-src edits, so the latency is
# scoped to exactly the interventions the substrate should weigh in on.
ie_resp="$(curl -s --max-time 9 -X POST "$dev/v2/impulses/resolve" -H 'Content-Type: application/json' -d "$ie_body" 2>/dev/null)"
if [ "$(printf '%s' "$ie_resp" | jq -r '.body.verdict // empty' 2>/dev/null)" = "REFUSE" ]; then
  basis="$(printf '%s' "$ie_resp" | jq -r '.body.refusal_basis // .body.reason // "substrate refused this intervention"' 2>/dev/null)"
  pushback="SUBSTRATE PUSH-AWAY (S3): the substrate REFUSED this operator edit to $rel with cited evidence — ${basis}. The substrate gates its own authored code. To proceed, either supply cited evidence justifying the change (dispatch via mcp__metabob__run_goal so the substrate authors it), or set SUBSTRATE_ALLOW_DIRECT_EDIT=1 for a conscious operator override."
  jq -nc --arg r "$pushback" '{hookSpecificOutput:{hookEventName:"PreToolUse",permissionDecision:"deny",permissionDecisionReason:$r}}'
  exit 0
fi

reason="Direct edit to vessel source ($fp) is gated by the substrate-vessel-edit-gate. The default path for code changes is to dispatch through the substrate so the change produces a trace and feeds the learning loop: use the metabob-mcp tool \`mcp__metabob__run_goal\` with \"<goal describing this change>\" (reaches goal-host-vessel on :8210). The deprecated \`minibob --single\` CLI still works as a fallback. For a deliberate one-off direct edit, set SUBSTRATE_ALLOW_DIRECT_EDIT=1 in the environment and retry. See CLAUDE.md §'Development Philosophy'."

jq -nc --arg r "$reason" '{hookSpecificOutput:{hookEventName:"PreToolUse",permissionDecision:"deny",permissionDecisionReason:$r}}'
exit 0
