#!/usr/bin/env bash
# connect-merge.sh — merge one fleet's connection values into a client config, ON THE HOST.
#
#   connect-merge.sh <config-file> <command that prints the values...>
#   e.g. connect-merge.sh ~/.metabob/config.json docker exec substrate-live substrate-connect --values
#
# Without a checkout, the image prints this script (`substrate-connect --merge-script`):
#   docker exec substrate-live substrate-connect --merge-script \
#     | bash -s -- ~/.metabob/config.json docker exec substrate-live substrate-connect --values
#
# WHY HOST-SIDE. A client config holds keys this fleet does not own (the cockpit's providers,
# defaults and their API keys). Nothing of it may enter the container: the container is asked
# ONLY for the values it owns, `substrate-connect --values` ({endpoint, apiKey, gapStoreEndpoint?}),
# and the merge runs here, with this host's jq. This is the ONE implementation: README
# § Installation, ui-only-up's plan and substrate-install all run it.
#
# WHAT IT WRITES. Exactly the keys the fleet owns: metabob.endpoint, metabob.apiKey and, when the
# values carry one, substrate.gapStoreEndpoint (values without it leave an existing one alone).
# Every other key is kept. A merge that changes nothing leaves the file untouched (byte-identical).
#
# SAFETY. The values (they hold the API key) go from the command's stdout straight into a mode-600
# temp file next to the config and are never echoed; error messages never quote them. The merge is
# written to a second mode-600 temp file next to the config and moved over it only on success. Any
# error (the command fails or prints something that is not the values; the existing file is not
# one JSON object, or its metabob/substrate is not an object; jq missing) exits non-zero, removes
# both temp files and leaves the config byte-identical. A jq before 1.7 parses every number as a
# double, so a config holding an integer beyond 2^53 is REFUSED rather than silently rewritten
# (probed on the jq that runs the merge).
#
# env: CONNECT_MERGE_JQ  the jq binary (default: jq on PATH)
# exit: 0 written or unchanged · 1 refused (file untouched) · 64 usage
set -uo pipefail
umask 077
JQ="${CONNECT_MERGE_JQ:-jq}"
say() { echo "[connect-merge] $*" >&2; }
[ $# -ge 2 ] || { say "usage: connect-merge.sh <config-file> <command that prints the values...>"; exit 64; }
CFG="$1"; shift
command -v "$JQ" >/dev/null 2>&1 || { say "refusing: jq not found on this host; $CFG left as it is"; exit 1; }
DIR="$(dirname "$CFG")"
mkdir -p "$DIR" || { say "refusing: cannot create $DIR"; exit 1; }
VALS="$(mktemp "$DIR/.connect-values.XXXXXX")" || { say "refusing: cannot create a temp file in $DIR"; exit 1; }
NEW="$(mktemp "$DIR/.connect-merge.XXXXXX")" || { rm -f "$VALS"; say "refusing: cannot create a temp file in $DIR"; exit 1; }
trap 'rm -f "$VALS" "$NEW" "$NEW.err"' EXIT

# The values: the command's stdout straight into the 600 file, never through a variable or echo.
if ! "$@" > "$VALS"; then say "refusing: the values command failed ($1 … exited non-zero); $CFG left as it is"; exit 1; fi
"$JQ" -e 'type == "object" and (.endpoint | type) == "string" and (.endpoint | length) > 0
          and (.apiKey | type) == "string" and (.apiKey | length) > 0
          and ((.gapStoreEndpoint // "") | type) == "string"' "$VALS" >/dev/null 2>&1 \
  || { say "refusing: the values command did not print {endpoint, apiKey[, gapStoreEndpoint]} (content not shown: it holds a key); $CFG left as it is"; exit 1; }

# The existing config (absent or blank = {}), read in place.
EXISTING="$CFG"
if [ ! -e "$CFG" ] || [ -z "$(tr -d '[:space:]' < "$CFG" 2>/dev/null)" ]; then EXISTING=/dev/null; fi
LOSSY=false; [ "$(echo 100000000000000000001 | "$JQ" . 2>/dev/null)" = 100000000000000000001 ] || LOSSY=true
if ! "$JQ" -s --slurpfile v "$VALS" --argjson lossy "$LOSSY" --arg jqv "$("$JQ" --version 2>/dev/null)" '
    (if length == 0 then {} elif length == 1 then .[0] else error("the existing config is not one JSON value") end)
    | if type != "object" then error("the existing config is not a JSON object") else . end
    | if has("metabob") and (.metabob | type) != "object" then error("metabob is not an object") else . end
    | if has("substrate") and (.substrate | type) != "object" then error("substrate is not an object") else . end
    | if $lossy and ([.. | numbers | select(. > 9007199254740991 or . < -9007199254740991)] | length) > 0
      then error("the existing config holds a number beyond 2^53 and this jq (\($jqv)) would rewrite it") else . end
    | $v[0] as $v
    | .metabob = ((.metabob // {}) + {endpoint: $v.endpoint, apiKey: $v.apiKey})
    | if ($v.gapStoreEndpoint // "") != "" then .substrate = ((.substrate // {}) + {gapStoreEndpoint: $v.gapStoreEndpoint}) else . end' \
    "$EXISTING" > "$NEW" 2> "$NEW.err"; then
  why="$(sed -n -e 's/^jq: error (at [^)]*): //p' "$NEW.err" | head -1 | cut -c1-200)"
  say "refusing to merge: ${why:-the existing config does not parse as JSON} — $CFG left as it is"
  rm -f "$NEW.err"; exit 1
fi
rm -f "$NEW.err"
if [ "$EXISTING" != /dev/null ] && [ "$("$JQ" -S -c . "$CFG" 2>/dev/null)" = "$("$JQ" -S -c . "$NEW")" ]; then
  say "$CFG already carries this fleet's values; left as it is"
  exit 0
fi
chmod 600 "$NEW" && mv -f "$NEW" "$CFG" || { say "refusing: could not move the merged config over $CFG; it is left as it is"; exit 1; }
say "merged this fleet's endpoint, apiKey$("$JQ" -e '(.gapStoreEndpoint // "") != ""' "$VALS" >/dev/null 2>&1 && echo ' and gapStoreEndpoint') into $CFG (its other keys kept)"
exit 0
