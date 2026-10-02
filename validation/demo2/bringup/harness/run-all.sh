#!/usr/bin/env bash
# run-all.sh — the three paths, STRICTLY sequential, each from a genuinely fresh
# container. Sequential because the demo containers are ~2.4GiB each and the OOM
# killer picks by RSS: a squeeze here would take the operator's production
# substrate (the largest RSS on the box) long before it took the demo.
#
# Each path is torn down before the next so only one new fleet is resident at a
# time, and so "from a fresh container" is true rather than approximately true.
set -uo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$HERE"

teardown() {
  docker rm -f "$1" >/dev/null 2>&1
  docker volume rm "$1-workspace" "$1-surreal" >/dev/null 2>&1
  echo "[run-all] tore down $1"
}

run_one() {
  local tag="$1" script="$2" name="$3" port="$4" health="$5"
  echo "[run-all] === $tag → $name (surface :$port) at $(date +%H:%M:%S) ==="
  teardown "$name"
  rm -f "../logs/$tag.jsonl" "../logs/$tag.console" "../logs/$tag.ui-errors"
  rm -rf "../frames/ui/$tag" "../status/$tag"
  bash record.sh "$tag" "$HERE/$script" "$name" "$port" "$health" > "../logs/$tag.console" 2>&1
  echo "[run-all] $tag finished rc=$? — $(ls "../frames/ui/$tag" 2>/dev/null | wc -l) ui frames"
}

run_one a path-a.sh substrate-demo-ui    25310 "25310,25100,25101"
docker stop -t 30 substrate-demo-ui >/dev/null 2>&1

run_one b path-b.sh substrate-demo-spoke 26310 "26310,26100,26210"
docker stop -t 30 substrate-demo-spoke >/dev/null 2>&1

run_one c path-c.sh substrate-demo-net   27310 "27310,27100,27101,27080"

echo "[run-all] all three complete at $(date +%H:%M:%S)"
