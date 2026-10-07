#!/usr/bin/env bash
# secret-leak-scan-fleet-key.test.sh: the leak scan collects the fleet key and recognises it under EITHER name
# (openspec retire-metabob-names, task 1.3a). A node whose key sits only under SUBSTRATE_API_KEY (the alias, or the
# store after phase 3) must still have the value scanned and must not read as scan_blind. Runs the scanner's own
# add_file and fleet_key_named in a sandbox; no value is printed.
set -uo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
F="$HERE/../../scripts/substrate/acceptance/secret-leak-scan.sh"
T="$(mktemp -d "${TMPDIR:-/tmp}/leak-scan.XXXXXX")"; trap 'rm -rf "$T"' EXIT
FAILS=0; ok() { echo "ok   - $*"; }; bad() { echo "FAIL - $*"; FAILS=$((FAILS+1)); }
{ sed -n '/^add_file() {/,/^}/p' "$F"; sed -n '/^fleet_key_named() {/p' "$F"; } > "$T/fns.sh"
grep -q 'fleet_key_named' "$T/fns.sh" && grep -q 'add_file' "$T/fns.sh" || { bad "could not extract add_file / fleet_key_named"; }
. "$T/fns.sh"
V=mb-0123456789abcdefFLEETKEYVALUE
collect() { # env-file-content -> pairs file, as the scan builds it for /etc/substrate/env
  pairs="$T/pairs.$RANDOM"; : > "$pairs"; printf '%s\n' "$1" > "$T/env"
  add_file "$T/env" '(KEY|SECRET|TOKEN|PASS|PASSWORD|PAT|CREDENTIAL|CREDENTIALS)$'
  sort -t $'\t' -k2,2 -u "$pairs" -o "$pairs"; echo "$pairs"; }
p=$(collect "SUBSTRATE_API_KEY=$V")
grep -qF "$V" "$p" && ok "a key only under SUBSTRATE_API_KEY is collected (its value is scanned)" || bad "alias-only value not collected"
fleet_key_named "$p" && ok "and it counts as the fleet key (no scan_blind)" || bad "alias-only key reads as no fleet key"
p=$(collect "METABOB_API_KEY=$V")
fleet_key_named "$p" && ok "the retiring name alone still counts" || bad "retiring name alone not recognised"
p=$(collect "$(printf 'METABOB_API_KEY=%s\nSUBSTRATE_API_KEY=%s' "$V" "$V")")
[ "$(grep -cF "$V" "$p")" = 1 ] && fleet_key_named "$p" && ok "both names with one value: scanned once, recognised" || bad "both names: $(grep -cF "$V" "$p") rows"
p=$(collect "OTHER_API_KEY=$V")
fleet_key_named "$p" && bad "an unrelated *_API_KEY counted as the fleet key" || ok "an unrelated *_API_KEY is not the fleet key (must-fail control)"
echo; [ "$FAILS" = 0 ] && { echo PASS; exit 0; } || { echo "$FAILS FAILED"; exit 1; }
