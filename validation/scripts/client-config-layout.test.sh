#!/usr/bin/env bash
# client-config-layout.test.sh: connect-merge.sh moves the client config to ~/.substrate/config.json and keeps
# ~/.metabob/config.json as a symlink to it (openspec retire-metabob-names 1.4; the cockpit reads only the old path).
#   fresh     no file anywhere: the file lands at the new path (mode 600), the old path links to it
#   old       an old-path regular file with other keys: moved, linked, other keys kept, values merged
#   new path  the merge is pointed at the NEW path on an old-path host: same result
#   both=     both paths regular and identical: the old one becomes the link
#   both!=    both regular and different: REFUSED, both byte-identical
#   foreign   the old path links somewhere else: REFUSED, nothing touched
#   refused   an old-path file that is not JSON: the merge refuses, and the old path still reads the same bytes
#   rerun     a second run changes nothing and keeps the link
#   relink    the file is current but the old-path link was removed: the link comes back
#   through   any other path that is a symlink: written through, the link survives
set -uo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
M="$ROOT/scripts/substrate/connect-merge.sh"
T="$(mktemp -d "${TMPDIR:-/tmp}/client-layout.XXXXXX")"; trap 'rm -rf "$T"' EXIT
FAILS=0; ok() { echo "ok   - $*"; }; bad() { echo "FAIL - $*"; FAILS=$((FAILS+1)); }
printf '#!/usr/bin/env bash\necho %s\n' "'{\"endpoint\":\"http://127.0.0.1:18080\",\"apiKey\":\"fixture-not-a-real-key\"}'" > "$T/values"; chmod +x "$T/values"
H=""; home() { H="$T/h$1"; rm -rf "$H"; mkdir -p "$H"; }
run() { HOME="$H" bash "$M" "$1" "$T/values" > "$T/out" 2>&1; RC=$?; }
OLD() { echo "$H/.metabob/config.json"; }; NEW() { echo "$H/.substrate/config.json"; }
linked() { [ -L "$(OLD)" ] && [ "$(readlink "$(OLD)")" = "$(NEW)" ] && [ -f "$(NEW)" ] && [ ! -L "$(NEW)" ]; }
merged() { jq -e '.metabob.endpoint == "http://127.0.0.1:18080" and .metabob.apiKey == "fixture-not-a-real-key"' "$1" >/dev/null 2>&1; }

home 1; run "$H/.metabob/config.json"
[ "$RC" = 0 ] && linked && merged "$(NEW)" && [ "$(stat -c %a "$(NEW)")" = 600 ] && ok "fresh: file at the new path (600), old path links to it" || bad "fresh: rc=$RC $(cat "$T/out")"

home 2; mkdir -p "$H/.metabob"; echo '{"providers":{"anthropic":{"apiKey":"p"}},"metabob":{"endpoint":"x","extra":1}}' > "$(OLD)"; chmod 600 "$(OLD)"
run "$(OLD)"
[ "$RC" = 0 ] && linked && merged "$(OLD)" && jq -e '.providers.anthropic.apiKey == "p" and .metabob.extra == 1' "$(NEW)" >/dev/null && ok "old: moved, linked, other keys kept, values merged" || bad "old: rc=$RC $(cat "$T/out")"

home 3; mkdir -p "$H/.metabob"; echo '{"defaults":{"model":"m"}}' > "$(OLD)"
run "$H/.substrate/config.json"
[ "$RC" = 0 ] && linked && jq -e '.defaults.model == "m"' "$(NEW)" >/dev/null && merged "$(NEW)" && ok "new path on an old-path host: same convergence" || bad "new path: rc=$RC $(cat "$T/out")"

home 4; mkdir -p "$H/.metabob" "$H/.substrate"; echo '{"a":1}' > "$(OLD)"; cp "$(OLD)" "$(NEW)"
run "$(OLD)"
[ "$RC" = 0 ] && linked && merged "$(NEW)" && jq -e '.a == 1' "$(NEW)" >/dev/null && ok "both identical: the old path becomes the link" || bad "both=: rc=$RC $(cat "$T/out")"

home 5; mkdir -p "$H/.metabob" "$H/.substrate"; echo '{"a":1}' > "$(OLD)"; echo '{"a":2}' > "$(NEW)"
o=$(sha256sum < "$(OLD)"); n=$(sha256sum < "$(NEW)"); run "$(OLD)"
[ "$RC" = 1 ] && [ ! -L "$(OLD)" ] && [ "$(sha256sum < "$(OLD)")" = "$o" ] && [ "$(sha256sum < "$(NEW)")" = "$n" ] && grep -q "both regular files and differ" "$T/out" \
  && ok "both different: refused, both byte-identical" || bad "both!=: rc=$RC $(cat "$T/out")"

home 6; mkdir -p "$H/.metabob"; echo '{"z":1}' > "$H/elsewhere.json"; ln -s "$H/elsewhere.json" "$(OLD)"; e=$(sha256sum < "$H/elsewhere.json"); run "$(OLD)"
[ "$RC" = 1 ] && [ "$(readlink "$(OLD)")" = "$H/elsewhere.json" ] && [ "$(sha256sum < "$H/elsewhere.json")" = "$e" ] && [ ! -e "$(NEW)" ] && ok "old path links elsewhere: refused, nothing touched" || bad "foreign: rc=$RC $(cat "$T/out")"

home 7; mkdir -p "$H/.metabob"; printf 'not json\n' > "$(OLD)"; b=$(sha256sum < "$(OLD)"); run "$(OLD)"
[ "$RC" = 1 ] && [ "$(sha256sum < "$(OLD)")" = "$b" ] && ok "a merge that refuses after the move still leaves the old path reading the same bytes" || bad "refused: rc=$RC old=$(ls -l "$(OLD)" 2>&1) $(cat "$T/out")"

home 8; run "$(OLD)"; s1=$(sha256sum < "$(NEW)"); run "$(OLD)"
[ "$RC" = 0 ] && linked && [ "$(sha256sum < "$(NEW)")" = "$s1" ] && grep -q "already carries" "$T/out" && ok "rerun: unchanged, link kept" || bad "rerun: rc=$RC $(cat "$T/out")"

home 10; run "$(OLD)"; rm -f "$(OLD)"; run "$(NEW)"
[ "$RC" = 0 ] && linked && grep -q "already carries" "$T/out" && ok "relink: a current file whose old-path link was removed gets the link back" || bad "relink: rc=$RC $(cat "$T/out")"

home 9; mkdir -p "$H/real"; echo '{"k":"v"}' > "$H/real/c.json"; ln -s "$H/real/c.json" "$H/link.json"; run "$H/link.json"
[ "$RC" = 0 ] && [ -L "$H/link.json" ] && merged "$H/real/c.json" && jq -e '.k == "v"' "$H/real/c.json" >/dev/null && [ ! -e "$(OLD)" ] && ok "any other symlinked path: written through, the link survives" || bad "through: rc=$RC $(cat "$T/out")"

echo; [ "$FAILS" = 0 ] && { echo PASS; exit 0; } || { echo "$FAILS FAILED"; exit 1; }
