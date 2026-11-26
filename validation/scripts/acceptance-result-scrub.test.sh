#!/usr/bin/env bash
# acceptance-result-scrub.test.sh: an acceptance result is uploaded from this public repo, so no value of a secret the
# run was given may be in it (agf_sil8xtnsmaz4: a raw container inspect went into every result).
#   (a) scrub-result-dir.sh: a key value planted in a JSON file, a log, a nested file and mid-line is in none of them
#       afterwards, the count is written, and the step fails (3);
#   (b) a clean directory, and a secret this step was not given, leave everything as it was and pass (0);
#   (c) run-acceptance.sh writes the container's inspect only through named fields (-f), never the raw inspect;
#   (d) every upload of a run's result directory in install-acceptance.yml comes after a scrub of that same directory.
# usage: validation/scripts/acceptance-result-scrub.test.sh
set -uo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
SCRUB="$ROOT/scripts/substrate/acceptance/scrub-result-dir.sh"
T="$(mktemp -d "${TMPDIR:-/tmp}/acc-scrub.XXXXXX")"; trap 'rm -rf "$T"' EXIT
FAILS=0; ok() { echo "ok   - $*"; }; bad() { echo "FAIL - $*"; FAILS=$((FAILS+1)); }
KEY="sk-ant-api03-""Q2W8E4R6T1Y3U5I7O9P0aSdFgHjKl"

D="$T/result"; mkdir -p "$D/diag/glue-tests"
printf '[{"Config":{"Env":["ANTHROPIC_API_KEY=%s"],"CreateCommand":["podman","run","-e","ANTHROPIC_API_KEY=%s"]}}]\n' "$KEY" "$KEY" >"$D/diag/container-inspect.json"
printf 'boot\nprovider key %s accepted\n' "$KEY" >"$D/diag/container.log"
printf 'x=%sy\n' "$KEY" >"$D/diag/glue-tests/one.log"
printf '{"ok":true}\n' >"$D/result.json"
ACCEPTANCE_PROVIDER_KEY="$KEY" bash "$SCRUB" "$D" ACCEPTANCE_PROVIDER_KEY >/dev/null 2>&1; rc=$?
if [ "$rc" = 3 ] && ! grep -rqF -- "$KEY" "$D" && grep -q "3 file(s) held a secret value" "$D/scrub.txt" 2>/dev/null \
  && grep -qF '<redacted>' "$D/diag/container.log" && [ "$(cat "$D/result.json")" = '{"ok":true}' ]; then
  ok "(a) a key planted in an inspect, a log, a nested file and mid-line is in none of them; 3 files counted; the step fails (3)"
else bad "(a) rc=$rc left=$(grep -rlF -- "$KEY" "$D" 2>/dev/null | tr '\n' ' ') scrub=$(cat "$D/scrub.txt" 2>/dev/null)"; fi

C="$T/clean"; mkdir -p "$C"; printf 'nothing secret\n' >"$C/a.log"
ACCEPTANCE_PROVIDER_KEY="$KEY" bash "$SCRUB" "$C" ACCEPTANCE_PROVIDER_KEY >/dev/null 2>&1; rc1=$?
U="$T/unset"; mkdir -p "$U"; printf '%s\n' "$KEY" >"$U/a.log"
env -u ACCEPTANCE_PROVIDER_KEY bash "$SCRUB" "$U" ACCEPTANCE_PROVIDER_KEY >/dev/null 2>&1; rc2=$?
if [ "$rc1" = 0 ] && [ "$(cat "$C/a.log")" = "nothing secret" ] && [ "$rc2" = 0 ] && grep -qF -- "$KEY" "$U/a.log"; then
  ok "(b) a clean directory passes untouched, and a secret the step was not given is not read from anywhere else"
else bad "(b) clean rc=$rc1 unset rc=$rc2"; fi

line="$(grep -n 'container-inspect.json' "$ROOT/scripts/substrate/acceptance/run-acceptance.sh" | head -1)"
block="$(grep -B2 'container-inspect.json' "$ROOT/scripts/substrate/acceptance/run-acceptance.sh")"
if grep -qE 'container inspect -f ' <<<"$block" && ! grep -qE 'container inspect "\$ACCEPTANCE_CONTAINER" 2>/dev/null \\$' <<<"$block"; then
  ok "(c) the container's inspect is written through named fields only"
else bad "(c) ${line:-no container-inspect.json line}"; fi

Y="$ROOT/.github/workflows/install-acceptance.yml"
missing="$(awk '
  /scrub-result-dir\.sh/ { match($0, /runner\.temp }}\/[a-z]+\//); if (RSTART) scrubbed[substr($0, RSTART, RLENGTH)] = 1 }
  /path: \$\{\{ runner\.temp \}\}\// { match($0, /runner\.temp }}\/[a-z]+\//); d = substr($0, RSTART, RLENGTH); if (!(d in scrubbed)) print d }
' "$Y")"
uploads="$(grep -cE 'path: \$\{\{ runner\.temp \}\}/' "$Y")"
if [ "$uploads" -ge 3 ] && [ -z "$missing" ]; then
  ok "(d) all $uploads uploads of a run's result directory come after a scrub of that directory"
else bad "(d) uploads=$uploads not scrubbed first: $(tr '\n' ' ' <<<"$missing")"; fi

echo; [ "$FAILS" = 0 ] && { echo "PASS - no secret value leaves a run in its uploaded result"; exit 0; }
echo "$FAILS FAILED"; exit 1
