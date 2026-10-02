#!/usr/bin/env bash
# record.sh <tag> <path-script> <container> <surface-port> <extra-health-ports>
#
# Runs one bring-up path with all three capture streams alive around it. Strictly
# one path at a time: the demo containers are ~2.4GiB each and the OOM killer picks
# by RSS, so a memory squeeze here would take the operator's PRODUCTION substrate
# (14.9GiB) long before it took the demo.
set -uo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TAG="$1"; SCRIPT="$2"; CONTAINER="$3"; SURFACE_PORT="$4"; HEALTH_PORTS="${5:-}"
V="python3 $HERE/vidkit.py"

export UI_EVERY="${UI_EVERY:-5}" STATS_EVERY="${STATS_EVERY:-10}" RUN_TIMEOUT="${RUN_TIMEOUT:-1200}"

avail=$(free -g | awk 'NR==2{print $7}')
if [ "${avail:-0}" -lt 5 ]; then
  echo "[record] MemAvailable ${avail}G < 5G — refusing to start $TAG" >&2
  exit 1
fi
echo "[record] $TAG: MemAvailable ${avail}G, starting capture streams"

nohup $V ui "$TAG" "http://127.0.0.1:${SURFACE_PORT}/" >/dev/null 2>&1 &
UIPID=$!
nohup $V stats "$TAG" "$CONTAINER" "$HEALTH_PORTS" >/dev/null 2>&1 &
STPID=$!
trap 'kill $UIPID $STPID 2>/dev/null' EXIT

bash "$SCRIPT"
RC=$?

# THE COMPOSE WINDOW IS THE LOG'S SPAN, so a screenshot taken after the last command
# falls OUTSIDE it and is never drawn. Segment B's surface answered 200 exactly two
# seconds after its log ended, so every B frame read "not serving yet" while the
# surface was demonstrably up — 5 real screenshots existed and none could be placed.
# Two things are needed, not one: wait for the poller to actually catch the surface,
# AND keep writing log records while it does, so those shots land inside the window.
FRAMEDIR="$HERE/../frames/ui/$TAG"
for i in $(seq 1 "${TAIL_HOLDS:-24}"); do
  n=$(ls "$FRAMEDIR" 2>/dev/null | wc -l)
  :
  [ "${n:-0}" -ge "${TAIL_MIN_FRAMES:-6}" ] && break
  sleep 5
done
python3 "$HERE/vidkit.py" say "$TAG" "surface photographed on :$SURFACE_PORT — $(ls "$FRAMEDIR" 2>/dev/null | wc -l) screenshot(s) captured"
kill $UIPID $STPID 2>/dev/null

echo "[record] $TAG done rc=$RC — ui frames: $(ls "$HERE/../frames/ui/$TAG" 2>/dev/null | wc -l), status samples: $(ls "$HERE/../status/$TAG" 2>/dev/null | wc -l)"
exit $RC
