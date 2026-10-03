#!/usr/bin/env bash
# goal-host-behavior-tick — one pass of modeling how the goal executor operates.
# Observes recent goal-host traces, builds the per-direction expectation model,
# persists goal_host_behavior priors. Bounded window to respect the volume-
# sensitive trace endpoint; a timeout is a graceful no-op (idle), never fatal.
# apikey_cfg KEY: the curl config line that carries an ApiKey, for `curl -K <(apikey_cfg "$K")` or
# `apikey_cfg "$K" | curl -K -`. The key never reaches argv (printf is a builtin), so no process listing shows it.
apikey_cfg() { [ -n "${1:-}" ] && printf 'header = "Authorization: ApiKey %s"\n' "$1"; return 0; }

set -uo pipefail
DEV_VESSEL="${DEV_VESSEL_ENDPOINT:-http://127.0.0.1:8090}"
W="${GOAL_HOST_BEHAVIOR_WINDOW_HOURS:-6}"
L="${GOAL_HOST_BEHAVIOR_LIMIT:-600}"
read -r -d '' BODY <<JSON
{"impulse":{"pointer":{"type":"goal_host_behavior_scan","windowHours":${W},"limit":${L},"minSamples":3}}}
JSON
curl -s -m 100 -X POST "${DEV_VESSEL}/v2/impulses/resolve" \
  -H "Content-Type: application/json" -K <(apikey_cfg "${METABOB_API_KEY}") \
  -d "${BODY}" | head -c 1000
echo
