#!/usr/bin/env bash
# gen-env-walk-keys.test.sh: on a spoke, the walk vessels' keys come from the join token (SUBSTRATE_WALK_KEYS), and
# gen-env must store each in its own masked file and name the key ids before any walk unit starts. Without it records
# exits at start on a spoke (no RECORDS_OWNER_KEY_ID; identity-seeder is skipped there and no admin key exists).
#   (a) MUST-FAIL: four carried keys are stored 0600, key-ids.json names four ids, RECORDS_OWNER_KEY_ID = the owner's
#   (b) an unknown name is ignored and never written
#   (c) a key identity rejects leaves key-ids.json as it was and is named in the log ("only 3 of 4")
#   (d) control: nothing carried and nothing stored -> no files, RECORDS_OWNER_KEY_ID empty
#   (e) no key value reaches the log
# The block is extracted from gen-env and run with a stub curl standing in for identity's /v1/keys/validate.
set -uo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"; G="${1:-$HERE/../../scripts/substrate/gen-env.sh}"
T="$(mktemp -d "${TMPDIR:-/tmp}/walkkeys.XXXXXX")"; trap 'rm -rf "$T"' EXIT
FAILS=0; ok() { echo "ok   - $*"; }; bad() { echo "FAIL - $*"; FAILS=$((FAILS+1)); }
awk '/^# Walk vessel keys on a node whose identity is remote/{on=1} on{print} on && /^RECORDS_OWNER_KEY_ID=/{exit}' "$G" \
  | sed -e "s|/workspace/.substrate-private/walk-vessels|$T/store/walk-vessels|" -e "s|/workspace/substrate/walk-vessels|$T/ws/walk-vessels|" > "$T/blk.sh"
grep -q 'SUBSTRATE_WALK_KEYS' "$T/blk.sh" && grep -q '^RECORDS_OWNER_KEY_ID=' "$T/blk.sh" || { echo "FAIL - could not extract the walk-keys block"; exit 1; }
# Stub identity: a key "mb-<name>VALUE" is valid with key_id "kid-<name>"; "mb-rejected…" is invalid.
cat > "$T/curl" <<'EOF'
#!/usr/bin/env bash
k="$(jq -r .api_key)"
case "$k" in mb-rejected*) echo '{"success":true,"data":{"valid":false}}' ;; mb-*VALUE) n="${k#mb-}"; echo "{\"success\":true,\"data\":{\"valid\":true,\"key_id\":\"kid-${n%VALUE}\"}}" ;; *) exit 7 ;; esac
EOF
chmod +x "$T/curl"
ALL="records-vessel=mb-records-vesselVALUE described-shape-vessel=mb-described-shape-vesselVALUE walk-vessel=mb-walk-vesselVALUE walk-owner=mb-walk-ownerVALUE"
run() { # $1 SUBSTRATE_WALK_KEYS ('' = unset) -> prints RECORDS_OWNER_KEY_ID; log in $T/log
  ( set -euo pipefail; PATH="$T:$PATH"; IDENTITY_VESSEL_URL="http://identity.test"
    if [ -n "$1" ]; then SUBSTRATE_WALK_KEYS="$1"; else unset SUBSTRATE_WALK_KEYS; fi
    . "$T/blk.sh"; printf '%s' "$RECORDS_OWNER_KEY_ID" ) 2>"$T/log"
}
ids() { jq -c . "$T/ws/walk-vessels/key-ids.json" 2>/dev/null; }

o="$(run "$ALL")"
[ "$o" = "kid-walk-owner" ] && ok "(a) RECORDS_OWNER_KEY_ID names the owner key's id" || bad "(a) RECORDS_OWNER_KEY_ID='$o'"
[ "$(ids)" = '{"records-vessel":"kid-records-vessel","described-shape-vessel":"kid-described-shape-vessel","walk-vessel":"kid-walk-vessel","walk-owner":"kid-walk-owner"}' ] \
  && ok "(a) key-ids.json names the four key ids" || bad "(a) key-ids.json: $(ids)"
m="$(stat -c %a "$T/store/walk-vessels/walk-owner.key" 2>/dev/null)"; v="$(cat "$T/store/walk-vessels/walk-owner.key" 2>/dev/null)"
[ "$m" = 600 ] && [ "$v" = mb-walk-ownerVALUE ] && ok "(a) each key is stored in its own 0600 file" || bad "(a) walk-owner.key mode '$m', value matches: $([ "$v" = mb-walk-ownerVALUE ] && echo yes || echo no)"
grep -q 'VALUE' "$T/log" && bad "(e) a key value reached the log" || ok "(e) no key value in the log"

run "$ALL bogus-vessel=mb-bogusVALUE" >/dev/null
[ ! -e "$T/store/walk-vessels/bogus-vessel.key" ] && grep -q "ignoring unknown name 'bogus-vessel'" "$T/log" \
  && ok "(b) an unknown name is ignored and named" || bad "(b) unknown name handling"

before="$(ids)"
run "records-vessel=mb-rejectedX described-shape-vessel=mb-described-shape-vesselVALUE walk-vessel=mb-walk-vesselVALUE walk-owner=mb-walk-ownerVALUE" >/dev/null
[ "$(ids)" = "$before" ] && grep -q "only 3 of 4 authenticate" "$T/log" \
  && ok "(c) a rejected key leaves key-ids.json as it was, and the log says so" || bad "(c) ids now $(ids); log: $(tail -1 "$T/log")"
grep -q 'rejectedX' "$T/log" && bad "(e) a rejected key value reached the log" || ok "(e) no rejected key value in the log"

rm -rf "$T/store" "$T/ws"
o="$(run "")"
[ -z "$o" ] && [ ! -e "$T/store/walk-vessels" ] && [ ! -e "$T/ws/walk-vessels/key-ids.json" ] \
  && ok "(d) control: nothing carried, nothing stored, RECORDS_OWNER_KEY_ID empty" || bad "(d) control: owner='$o'"

[ "$FAILS" = 0 ] && echo "PASS" || { echo "$FAILS FAILED"; exit 1; }
