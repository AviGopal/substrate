#!/usr/bin/env bash
# obsidian-learning-probe.sh — follow along as the substrate learns to operate
# Obsidian via the obsidian-vessel.
#
# Obsidian operation lives OUTSIDE the substrate's core self-optimization loop:
# it is an external app that may be disconnected, so we do NOT bake it into the
# boredom rotation. Instead THIS script is the external test driver — it operates
# Obsidian (only when the plugin is reachable) and surfaces the learning signals.
# Re-run it to follow progress; your external monitor can watch the same signals.
#
# Usage:
#   ./obsidian-learning-probe.sh            # observe only (no dispatch)
#   ./obsidian-learning-probe.sh --operate  # drive one operate-obsidian cycle, then observe
#   ./obsidian-learning-probe.sh --operate N # drive N cycles (default 1)
#
# Reads endpoint + key from ~/.metabob/config.json.
set -euo pipefail

CFG="${HOME}/.metabob/config.json"
API="$(jq -r '.metabob.endpoint // "http://localhost:18080"' "$CFG")"
KEY="$(jq -r '.metabob.apiKey' "$CFG")"
GOAL_HOST="${GOAL_HOST_ENDPOINT:-http://localhost:18210}"
PLUGIN="${OBSIDIAN_PLUGIN_ENDPOINT:-http://localhost:27183}"
OP_TEMPLATE="development-vessel:validate-obsidian-vessel-interaction"
# Action-effect learner runs against a dedicated PROBE instance (see
# setup-obsidian-probe-vault.sh) — never the real vault.
PROBE_ENDPOINT="${OBSIDIAN_PROBE_ENDPOINT:-http://localhost:27184}"
PROBE_VAULT_PATH="${OBSIDIAN_PROBE_VAULT:-${HOME}/obsidian-probe-vault}"
MAX_CMDS="${PROBE_MAX_COMMANDS:-5}"
CONCEPT_DB="${CONCEPT_DB_ENDPOINT:-http://localhost:18260}"
DEV_VESSEL="${DEV_VESSEL_ENDPOINT:-http://localhost:18090}"

auth=(-H "Authorization: ApiKey ${KEY}")
j() { jq -r "$@" 2>/dev/null || true; }
rule() { printf '\n\033[1m== %s ==\033[0m\n' "$1"; }

OPERATE=0; CYCLES=1; ACTION_EFFECTS=0; GATE=0; EXECUTE=0
case "${1:-}" in
  --operate) OPERATE=1; [[ -n "${2:-}" ]] && CYCLES="$2" ;;
  --action-effects) ACTION_EFFECTS=1 ;;
  --gate) GATE=1; shift ;;
  --execute) EXECUTE=1; shift ;;
esac

# ---------------------------------------------------------------------------
# Gated execute: dispatch ONE Obsidian command through obsidian_execute_gated.
# The substrate consults the learned gate first; only allow-verdict commands
# reach the plugin. Targets the PROBE instance by default (safe); set
# OBSIDIAN_EXEC_ENDPOINT to the real vault (host.docker.internal:27183) to
# operate it for real.
if [[ "$EXECUTE" == "1" ]]; then
  cmd="${1:-}"
  EXEC_ENDPOINT="${OBSIDIAN_EXEC_ENDPOINT:-http://host.docker.internal:27184}"
  rule "Gated execute: ${cmd:-<none>} (endpoint ${EXEC_ENDPOINT})"
  if [[ -z "$cmd" ]]; then echo "  usage: --execute <command_id>"; exit 1; fi
  body="{\"impulse\":{\"pointer\":{\"type\":\"obsidian_execute_gated\",\"command_id\":\"${cmd}\",\"obsidianEndpoint\":\"${EXEC_ENDPOINT}\"}}}"
  curl -fsS -m40 -X POST "${DEV_VESSEL}/v2/impulses/resolve" "${auth[@]}" -H 'content-type: application/json' -d "$body" 2>/dev/null \
    | j '.body | "  gate_verdict : \(.gate_verdict)\n  executed     : \(.executed)\n  reason       : \(.gate_reason // .gate_reason)\n  effect       : \(.effect // .plugin_error // .error // "—")"'
  exit 0
fi

# ---------------------------------------------------------------------------
# Gate mode: consult the learned action-effect priors to decide which Obsidian
# commands the substrate is cleared to dispatch. With no args, prints the
# learned allow-set; with command ids, classifies each (allow/escalate/deny)
# and shows the deny-set that plugs into a dispatch's extra_deny_globs.
if [[ "$GATE" == "1" ]]; then
  rule "Command-dispatch gate (learned action-effect priors)"
  if [[ -n "${1:-}" ]]; then
    cids="$(printf '%s\n' "$@" | jq -R . | jq -cs .)"
    body="{\"impulse\":{\"pointer\":{\"type\":\"obsidian_command_gate\",\"command_ids\":${cids}}}}"
    echo "$(curl -fsS -m12 -X POST "${DEV_VESSEL}/v2/impulses/resolve" "${auth[@]}" -H 'content-type: application/json' -d "$body" 2>/dev/null || echo '{}')" \
      | j '.body | "  allowed : \(.allowed)\n  escalate: \(.escalate)\n  denied  : \(.denied)\n  extra_deny_globs (→ dispatch): \(.extra_deny_globs)"'
  else
    echo "$(curl -fsS -m12 -X POST "${DEV_VESSEL}/v2/impulses/resolve" "${auth[@]}" -H 'content-type: application/json' -d '{"impulse":{"pointer":{"type":"obsidian_command_gate"}}}' 2>/dev/null || echo '{}')" \
      | j '.body | "  learned priors: \(.learned_count)\n  cleared for autonomous dispatch (\(.allowed|length)):\n" + (.allowed|map("    "+.)|join("\n"))'
    echo "  (any command NOT in this set is denied by default in operate mode)"
  fi
  exit 0
fi

# ---------------------------------------------------------------------------
# Action-effect learning mode: drive the safety-gated probe against the probe
# vault and show the learned per-command effect models. Requires Obsidian open
# on the probe vault (the resolver refuses otherwise — it can never touch the
# real vault).
if [[ "$ACTION_EFFECTS" == "1" ]]; then
  rule "Action-effect learning (probe instance ${PROBE_ENDPOINT}, vault ${PROBE_VAULT_PATH})"
  PROBE_ABS="$(cd "${PROBE_VAULT_PATH}" 2>/dev/null && pwd || echo "${PROBE_VAULT_PATH}")"
  if ! curl -fsS -m4 "${PROBE_ENDPOINT}/health" >/dev/null 2>&1; then
    echo "  probe instance UNREACHABLE at ${PROBE_ENDPOINT}."
    echo "  → run scripts/substrate/setup-obsidian-probe-vault.sh, then open ${PROBE_ABS} in Obsidian."
    exit 1
  fi
  echo "  probe instance up. dispatching obsidian:action_effect_model (max_commands=${MAX_CMDS}) ..."
  resp="$(curl -fsS -m180 -X POST "${PROBE_ENDPOINT}/resolve" "${auth[@]}" \
    -H 'content-type: application/json' \
    -d "{\"impulse\":{\"pointer\":{\"type\":\"obsidian:action_effect_model\",\"probe_vault_path\":\"${PROBE_ABS}\",\"max_commands\":${MAX_CMDS}}}}" 2>&1 || true)"
  # Gate refusal surfaces as an error mentioning the vault mismatch.
  if echo "$resp" | grep -qiE 'refus|safety_breach|active vault|mismatch'; then
    echo "  REFUSED by safety gate — Obsidian's active vault is not the probe vault."
    echo "  Open ${PROBE_ABS} as the active vault and retry. (raw: $(echo "$resp" | head -c 200))"
    exit 1
  fi
  echo "  learned models:"
  models="$(echo "$resp" | j '.content')"
  echo "$models" | j '.models[]? | "    \(.command_id)  reversibility=\(.reversibility_class)  observations=\(.observation_count)  post-states=\(.post_signature_distribution|length)"' | head -20
  nmod="$(echo "$models" | j '.models|length')"
  echo "  → ${nmod:-0} command effect-models learned (each: P(post-state | command) + reversibility class)."

  # Persist into concept-db as durable action→effect priors (bridge_eligibility=allow).
  # This is what turns "the probe ran" into "the substrate learned".
  rule "Persisting action→effect models into concept-db (durable learning)"
  persisted=0; perr=0
  while IFS= read -r m; do
    [ -z "$m" ] && continue
    cmd="$(echo "$m" | j '.command_id')"
    rev="$(echo "$m" | j '.reversibility_class')"
    body="$(jq -n --arg cmd "$cmd" --arg rev "$rev" --argjson model "$m" \
      '{impulse:{pointer:{type:"concept_create_write",conceptData:{
        shape:"obsidian_action_effect",
        source_type:"extracted",
        summary:("obsidian command \($cmd) → \($rev) (\($model.observation_count) obs, \($model.post_signature_distribution|length) post-state(s))"),
        content:($model|tostring),
        priority:0.5, budget:2000}}}}')"
    if curl -fsS -m8 -X POST "${CONCEPT_DB}/v2/impulses/resolve" "${auth[@]}" \
         -H 'content-type: application/json' -d "$body" >/dev/null 2>&1; then
      persisted=$((persisted+1))
    else perr=$((perr+1)); fi
  done < <(echo "$models" | jq -c '.models[]?' 2>/dev/null)
  echo "  persisted ${persisted} action→effect concept(s) to concept-db (${perr} error(s))."
  echo "  re-run to accumulate more observations; broaden with PROBE_MAX_COMMANDS=10."
  exit 0
fi

# ---------------------------------------------------------------------------
rule "1. Is Obsidian connected? (external availability gate)"
PLUGIN_OK=0
if curl -fsS -m4 "${PLUGIN}/health" >/dev/null 2>&1; then
  PLUGIN_OK=1
  curl -fsS -m4 "${PLUGIN}/manifest" 2>/dev/null | j '"plugin: \(.vesselName) v\(.version) — \(.shapes|length) shapes"'
else
  echo "plugin UNREACHABLE at ${PLUGIN} — obsidian is disconnected; skipping operate, observing learning state only"
fi

# ---------------------------------------------------------------------------
if [[ "$OPERATE" == "1" && "$PLUGIN_OK" == "1" ]]; then
  rule "2. Operate Obsidian (${CYCLES} cycle(s) — external driver)"
  for i in $(seq 1 "$CYCLES"); do
    resp="$(curl -fsS -m90 -X POST "${GOAL_HOST}/run-goal" "${auth[@]}" \
      -H 'content-type: application/json' \
      -d "{\"goal\":\"operate obsidian via validate-obsidian-vessel-interaction\",\"targetTemplateId\":\"${OP_TEMPLATE}\",\"variables\":{\"source\":\"obsidian-learning-probe\"}}" 2>/dev/null || echo '{}')"
    echo "  cycle $i → $(echo "$resp" | j '"status=\(.status) dispatchId=\(.dispatchId // .executionId)"')"
    sleep 3
  done
  echo "  (dispatches are async; learning signals below update as they complete)"
elif [[ "$OPERATE" == "1" ]]; then
  rule "2. Operate Obsidian — SKIPPED (plugin unreachable)"
fi

# ---------------------------------------------------------------------------
rule "3. Operate-obsidian execution outcomes (recent)"
curl -fsS -m12 "${API}/v2/activities/execution-traces?limit=120" "${auth[@]}" 2>/dev/null \
  | j '[(.executions//.traces//[])[] | select(.activity_template_id//.template_id//""|test("obsidian"))]
       | group_by(.activity_template_id//.template_id)[]
       | "\(length)x  \([.[]|.status]|group_by(.)|map("\(length) \(.[0])")|join(", "))  \((.[0].activity_template_id//.[0].template_id)|sub("activity:.";"")|.[0:60])"' \
  | head -15
echo "  (empty = nothing has operated obsidian yet; run with --operate)"

# ---------------------------------------------------------------------------
rule "4. Thompson posteriors on obsidian-touching templates (is it learning which actions land?)"
curl -fsS -m12 "${API}/v2/activities/templates?q=obsidian&limit=60" "${auth[@]}" 2>/dev/null \
  | j '[(.templates//.results//[])[]
        | select((.name//.id//"")|test("obsidian"))
        | {id:(.id//.name),
           a:(.thompson_alpha // .metrics.thompson_alpha),
           b:(.thompson_beta // .metrics.thompson_beta),
           n:(((.successful_executions//0)+(.failed_executions//0)))}
        | select(.a!=null and (.n>0))]
       | sort_by(-.n)[]
       | "n=\(.n)  α=\(.a) β=\(.b)  mean=\((.a/(.a+.b))|.*100|round/100)  \(.id|sub("activity:.";"")|.[0:52])"' \
  | head -15
echo "  (mean = P(success); rising n with stable/high mean = the substrate is learning to operate it)"

# ---------------------------------------------------------------------------
rule "5. Reward edge: relevance accumulating on obsidian shapes"
curl -fsS -m12 -X POST "${API}/v2/impulses/resolve" "${auth[@]}" -H 'content-type: application/json' \
  -d '{"impulse":{"pointer":{"type":"impulseRelevance","shape_prefix":"obsidian"}}}' 2>/dev/null \
  | j '.content' | grep -iE 'obsidian|pairs|loads|relevance' | head -8
echo "  (more pairs/loads over time = the binding layer is learning obsidian shapes are useful)"

# ---------------------------------------------------------------------------
rule "6. Autonomous authoring: obsidian gap scenarios + templates the substrate wrote"
SCEN_DIR="$(dirname "$0")/workspace/validation/failure-modes/scenarios"
echo "  open gap scenarios mentioning obsidian:"
scen="$(ls "$SCEN_DIR" 2>/dev/null | grep -i obsidian | head -8 || true)"
if [[ -n "$scen" ]]; then echo "$scen" | sed 's/^/    /'; else echo "    (none)"; fi
echo "  registered obsidian-integrating gap-closing templates:"
curl -fsS -m12 "${API}/v2/activities/templates?q=obsidian&limit=80" "${auth[@]}" 2>/dev/null \
  | j '[(.templates//.results//[])[] | (.id//.name) | select(test("gap-closing")) | select(test("obsidian"))] | length' \
  | sed 's/^/    count: /'

rule "done — re-run to follow progress (add --operate to drive a cycle when Obsidian is up)"
