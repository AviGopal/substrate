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

reason="Direct edit to vessel source ($fp) is gated by the substrate-vessel-edit-gate. The default path for code changes is to dispatch through the substrate so the change produces a trace and feeds the learning loop: use the metabob-mcp tool \`mcp__metabob__run_goal\` with \"<goal describing this change>\" (reaches goal-host-vessel on :8210). The deprecated \`minibob --single\` CLI still works as a fallback. For a deliberate one-off direct edit, set SUBSTRATE_ALLOW_DIRECT_EDIT=1 in the environment and retry. See CLAUDE.md §'Development Philosophy'."

jq -nc --arg r "$reason" '{hookSpecificOutput:{hookEventName:"PreToolUse",permissionDecision:"deny",permissionDecisionReason:$r}}'
exit 0
