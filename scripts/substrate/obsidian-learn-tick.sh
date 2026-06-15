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
