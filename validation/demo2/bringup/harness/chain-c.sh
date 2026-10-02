#!/usr/bin/env bash
# Chain the last path and the compose so neither waits on a turn boundary.
set -uo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$HERE"
docker stop -t 30 substrate-film-spoke >/dev/null 2>&1
rm -f ../logs/c.jsonl ../logs/c.console ../logs/c.ui-errors; rm -rf ../frames/ui/c ../status/c
NAME=substrate-film-net OFFSET=12000 TAIL_SECS=180 \
  bash record.sh c "$HERE/path-c.sh" substrate-film-net 30310 "30310,30100,30101,30080,30210" \
  > ../logs/c.console 2>&1
cd ..
UI_PORTS="a=28310,b=29310,c=30310" SPEED=10 FPS=12 \
  python3 harness/vidkit.py compose a,b,c \
  "substrate bring-up — three paths from a fresh container" film-3paths.mp4 \
  > logs/compose-film.log 2>&1
echo "CHAIN DONE $(date +%H:%M:%S)"
