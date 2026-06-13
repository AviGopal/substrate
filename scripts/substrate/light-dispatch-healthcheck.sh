#!/usr/bin/env bash
# light-dispatch-healthcheck.sh — liveness watchdog for the alive-but-hung case.
#
# Restart=always in light-dispatch-vessel.service only catches process *death*
# (crash / clean exit / OOM). It cannot catch a process that is still alive and
# holding port 8280 but no longer answering — a wedged event loop, a stuck
# in-flight dispatch, a deadlock. That failure mode silently livelocks the whole
# boredom shape-pool (every shape dispatches through :8280); observed 2026-06-13.
#
# This probe runs on a timer. It curls /health with a hard timeout: a hung
# process accepts the TCP connect but never responds, so --max-time is what
# distinguishes "hung" from healthy. Two consecutive failures (with a short gap)
# are required before restarting, so a single transient blip (GC pause, momentary
# load) does not cause a needless bounce.
set -u

UNIT="${LD_UNIT:-light-dispatch-vessel.service}"
URL="${LD_HEALTH_URL:-http://127.0.0.1:8280/health}"
MAX_TIME="${LD_PROBE_TIMEOUT:-5}"

# Only probe when systemd considers the unit up and running. During (re)start or
# RestartSec backoff the SubState is "start"/"auto-restart" — leave those to
# Restart=always and do not interfere.
state="$(systemctl show "$UNIT" -p SubState --value 2>/dev/null)"
if [ "$state" != "running" ]; then
  echo "[ld-healthcheck] SubState=$state (not running) — skipping probe, deferring to Restart=always"
  exit 0
fi

probe() {
  # Echo the HTTP status; 000 means connect refused or timed out (hung).
  # curl -w always prints a code (000 on no-response) even when it exits
  # non-zero, so capture it directly and only default if output is empty.
  local out
  out="$(curl -s -o /dev/null -w '%{http_code}' --max-time "$MAX_TIME" "$URL" 2>/dev/null)"
  echo "${out:-000}"
}

code1="$(probe)"
if [ "$code1" = "200" ]; then
  echo "[ld-healthcheck] ok ($code1)"
  exit 0
fi

# First probe failed — re-check once after a short gap to filter transient blips.
sleep 2
code2="$(probe)"
if [ "$code2" = "200" ]; then
  echo "[ld-healthcheck] recovered on recheck (first=$code1 second=$code2)"
  exit 0
fi

echo "[ld-healthcheck] /health unresponsive twice (first=$code1 second=$code2) while SubState=running — alive-but-hung; restarting $UNIT"
systemctl restart "$UNIT"
