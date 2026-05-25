#!/bin/bash
# watch-substrate.sh — emit substrate health and activity signals for loop monitoring.
#
# Streams from substrate-live journalctl, filtering for:
#   - Service starts/stops/failures
#   - HTTP errors from vessels
#   - Boredom timer fires
#   - Coverage/health tick results
#   - Any systemd unit failures
#
# Each matching line is emitted to stdout (one event per line) for Monitor tool.
# Usage: bash scripts/substrate/watch-substrate.sh
#        CONTAINER=substrate-live bash scripts/substrate/watch-substrate.sh

CONTAINER="${CONTAINER:-substrate-live}"

# Wait for container to be running
until docker inspect "$CONTAINER" --format '{{.State.Running}}' 2>/dev/null | grep -q true; do
  echo "[watch] waiting for container $CONTAINER..."
  sleep 3
done

echo "[watch] container $CONTAINER is running — attaching to journalctl"

docker exec "$CONTAINER" journalctl -f --no-pager -o short-iso 2>/dev/null | \
  grep --line-buffered -E \
    "Started|Stopped|Failed|failed|activated|deactivated|\
systemd.*error|\
HTTP [45][0-9][0-9]|\
coverage.tick|substrate.health.tick|boredom|\
goal.host|llm.resolver|\
seed.identity|gen.env|\
ERROR|WARN|panic|OOM|killed|Killed|\
\[substrate\]|\[gen-env\]|\[seed-identity\]|\[boredom\]|\[coverage\]|\[health\]"
