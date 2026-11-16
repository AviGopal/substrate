#!/usr/bin/env bash
# scrub-result-dir.sh <dir> <NAME>...: before a result directory is uploaded from this public repo, every value of the
# secrets named (read from this step's environment, never from an argument) is replaced by "<redacted>" in every file
# under <dir>, whatever wrote it: a container log, an inspect, a command a fence ran. The count of files that held one
# is written to <dir>/scrub.txt. Exit 3 when any did (whatever wrote it leaked, and the job says so), 0 when clean.
# A value is never printed.
set -uo pipefail
dir="${1:-}"; shift || true
[ -n "$dir" ] && [ -d "$dir" ] || { echo "scrub: no result directory"; exit 0; }
found=0
for name in "$@"; do
  v="${!name:-}"
  [ -n "$v" ] || continue
  while IFS= read -r -d '' f; do
    grep -qF -- "$v" "$f" 2>/dev/null || continue
    found=$((found + 1))
    V="$v" perl -0pi -e 's/\Q$ENV{V}\E/<redacted>/g' "$f"
  done < <(find "$dir" -type f ! -name scrub.txt -print0)
done
echo "scrub: $found file(s) held a secret value; replaced with <redacted>" >"$dir/scrub.txt"
echo "scrub: $found file(s) held a secret value"
[ "$found" -eq 0 ] || exit 3
