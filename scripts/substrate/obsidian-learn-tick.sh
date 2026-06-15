#!/usr/bin/env bash
# obsidian-learn-tick — one autonomous Obsidian command-effect learning pass.
# Dispatched by obsidian-learn.timer (side loop). Targets the probe instance by
# default; unreachable instance is a graceful idle (resolver returns
# {unreachable:true}), never a hard failure. Safe by default: grant=navigate.
set -uo pipefail

ENDPOINT="${OBSIDIAN_LEARN_ENDPOINT:-http://host.docker.internal:27184}"
GRANT="${OBSIDIAN_LEARN_GRANT:-navigate}"
MAX="${OBSIDIAN_LEARN_MAX:-10}"
DEV_VESSEL="${DEV_VESSEL_ENDPOINT:-http://127.0.0.1:8090}"

read -r -d '' BODY <<JSON
{"impulse":{"pointer":{"type":"obsidian_learn_commands","obsidianEndpoint":"${ENDPOINT}","grantedClasses":["${GRANT}"],"maxCommands":${MAX}}}}
JSON

curl -s -m 200 -X POST "${DEV_VESSEL}/v2/impulses/resolve" \
  -H "Content-Type: application/json" \
  -H "Authorization: ApiKey ${METABOB_API_KEY}" \
  -d "${BODY}" | head -c 1000
echo
