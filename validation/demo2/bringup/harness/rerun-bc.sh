#!/usr/bin/env bash
set -uo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"; cd "$HERE"
for spec in "b:path-b.sh:substrate-demo-spoke:26310:26310,26100,26210" \
            "c:path-c.sh:substrate-demo-net:27310:27310,27100,27101,27080"; do
  IFS=: read -r tag script name port health <<<"$spec"
  echo "[rerun] === $tag → $name at $(date +%H:%M:%S) ==="
  docker rm -f "$name" >/dev/null 2>&1
  docker volume rm "$name-workspace" "$name-surreal" >/dev/null 2>&1
  rm -f "../logs/$tag.jsonl" "../logs/$tag.console" "../logs/$tag.ui-errors"
  rm -rf "../frames/ui/$tag" "../status/$tag"
  bash record.sh "$tag" "$HERE/$script" "$name" "$port" "$health" > "../logs/$tag.console" 2>&1
  echo "[rerun] $tag rc=$? frames=$(ls "../frames/ui/$tag" 2>/dev/null | wc -l)"
  docker stop -t 30 "$name" >/dev/null 2>&1
done
echo "[rerun] done $(date +%H:%M:%S)"
