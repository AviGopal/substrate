#!/usr/bin/env bash
# goal-host-behavior-tick — one pass of modeling how the goal executor operates.
# Observes recent goal-host traces, builds the per-direction expectation model,
# persists goal_host_behavior priors. Bounded window to respect the volume-
# sensitive trace endpoint; a timeout is a graceful no-op (idle), never fatal.
set -uo pipefail
DEV_VESSEL="${DEV_VESSEL_ENDPOINT:-http://127.0.0.1:8090}"
W="${GOAL_HOST_BEHAVIOR_WINDOW_HOURS:-6}"
L="${GOAL_HOST_BEHAVIOR_LIMIT:-600}"
read -r -d '' BODY <<JSON
{"impulse":{"pointer":{"type":"goal_host_behavior_scan","windowHours":${W},"limit":${L},"minSamples":3}}}
JSON
curl -s -m 100 -X POST "${DEV_VESSEL}/v2/impulses/resolve" \
  -H "Content-Type: application/json" -H "Authorization: ApiKey ${METABOB_API_KEY}" \
  -d "${BODY}" | head -c 1000
echo
