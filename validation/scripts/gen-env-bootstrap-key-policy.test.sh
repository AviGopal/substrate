#!/usr/bin/env bash
# gen-env-bootstrap-key-policy.test.sh: the fleet's bootstrap key is the seed account's password, so gen-env must only
# ever generate one that identity-vessel's password policy accepts (8+ chars, an upper-case letter, a lower-case letter,
# a digit), and must replace a PERSISTED bootstrap value that fails it. Measured 2026-10-12 (podman install acceptance):
# a draw with no digit made every seeder retry re-send the same refused password, the fleet never seeded, and because
# the value was persisted, re-running the installer could not repair it.
#   (a) the policy predicate: fixtures that lack each class are refused; a conforming value is accepted
#   (b) MUST-FAIL: a persisted bootstrap value with no digit is replaced by a conforming 32-char key (provenance: generated)
#   (c) control: a conforming persisted bootstrap value is kept untouched
#   (d) an issued (mb-) key is never replaced, whatever its composition
#   (e) an explicitly supplied non-conforming value is kept and reported, not replaced
#   (f) 300 fresh draws are all 32 chars and all conform
# The blocks are extracted from gen-env and run with persisted_secret and prov; no value is ever printed.
set -uo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"; G="${1:-$HERE/../../scripts/substrate/gen-env.sh}"
T="$(mktemp -d "${TMPDIR:-/tmp}/bkpolicy.XXXXXX")"; trap 'rm -rf "$T"' EXIT
FAILS=0; ok() { echo "ok   - $*"; }; bad() { echo "FAIL - $*"; FAILS=$((FAILS+1)); }
sed -n '/^persisted_secret() {/,/^}/p' "$G" > "$T/ps.sh"
awk '/^# THE BOOTSTRAP KEY IS ALSO THE SEED ACCOUNT/{on=1} on{print} on && /^  prov METABOB_API_KEY generated$/{getline; print; exit}' "$G" > "$T/blk.sh"
grep -q 'draw_bootstrap_key' "$T/blk.sh" && tail -1 "$T/blk.sh" | grep -qx 'fi' && grep -q 'persisted_secret() {' "$T/ps.sh" \
  || { echo "FAIL - could not extract the bootstrap-key block or persisted_secret"; exit 1; }
grep -q '^_MB_KEY_FROM_ENV="${METABOB_API_KEY:-}"$' "$G" && ok "gen-env records whether the key was supplied before reading the store" \
  || bad "gen-env does not record _MB_KEY_FROM_ENV before the store read"

pol() { ( prov() { :; }; METABOB_API_KEY=Aa1aaaaa; _MB_KEY_FROM_ENV=x; . "$T/blk.sh" 2>/dev/null; bootstrap_key_ok "$1" && echo yes || echo no ); }
[ "$(pol 'abcdefgh1234')" = no ] && ok "(a) no upper-case: refused" || bad "(a) no upper-case accepted"
[ "$(pol 'ABCDEFGH1234')" = no ] && ok "(a) no lower-case: refused" || bad "(a) no lower-case accepted"
[ "$(pol 'ABCDefghIJKL')" = no ] && ok "(a) no digit: refused" || bad "(a) no digit accepted"
[ "$(pol 'Ab1')" = no ] && ok "(a) under 8 chars: refused" || bad "(a) short accepted"
[ "$(pol 'Abcdefgh1234')" = yes ] && ok "(a) all classes: accepted" || bad "(a) conforming value refused"

NODIGIT=ABCDefghIJKLmnopQRSTuvwxYZabcdEF; GOOD=ABCDefgh1234mnopQRSTuvwxYZabcdEF; ISSUED=mb-abcdefghijklmnopqrstuvwxyzABCD
run() { # $1 persisted value ('' = none), $2 explicit env value ('' = none) -> "<which>|<prov>|<len>|<conforms>"
  ( SECRETS_FILE="$T/store"; : > "$SECRETS_FILE"; [ -n "$1" ] && printf 'METABOB_API_KEY=%s\n' "$1" >> "$SECRETS_FILE"
    PROV_TMP="$T/prov"; : > "$PROV_TMP"; prov() { printf '%s=%s\n' "$1" "$2" >> "$PROV_TMP"; }
    . "$T/ps.sh"
    METABOB_API_KEY="$2"; _MB_KEY_FROM_ENV="${METABOB_API_KEY:-}"
    METABOB_API_KEY="${METABOB_API_KEY:-$(persisted_secret METABOB_API_KEY)}"
    . "$T/blk.sh" 2>"$T/err"
    case "$METABOB_API_KEY" in "$NODIGIT") w=nodigit ;; "$GOOD") w=good ;; "$ISSUED") w=issued ;; *) w=new ;; esac
    c=no; bootstrap_key_ok "$METABOB_API_KEY" && c=yes
    printf '%s|%s|%s|%s' "$w" "$(grep '^METABOB_API_KEY=' "$PROV_TMP" | tail -1)" "${#METABOB_API_KEY}" "$c" )
}
r="$(run "$NODIGIT" "")"; IFS='|' read -r w p l c <<<"$r"
[ "$w" = new ] && [ "$c" = yes ] && [ "$l" = 32 ] && ok "(b) a persisted no-digit bootstrap key is replaced by a conforming 32-char key" || bad "(b) got which=$w conforms=$c len=$l"
[ "$p" = "METABOB_API_KEY=generated" ] && ok "(b) provenance: generated" || bad "(b) provenance '$p'"
grep -q 'replacing the persisted bootstrap key' "$T/err" && ok "(b) the replacement is logged" || bad "(b) the replacement is silent"
r="$(run "$GOOD" "")"; IFS='|' read -r w p l c <<<"$r"
[ "$w" = good ] && [ "$p" = "METABOB_API_KEY=persisted" ] && ok "(c) a conforming persisted bootstrap key is kept" || bad "(c) got which=$w prov='$p'"
r="$(run "$ISSUED" "")"; IFS='|' read -r w p l c <<<"$r"
[ "$w" = issued ] && [ "$p" = "METABOB_API_KEY=persisted" ] && ok "(d) an issued mb- key is never replaced" || bad "(d) got which=$w prov='$p'"
r="$(run "" "$NODIGIT")"; IFS='|' read -r w p l c <<<"$r"
[ "$w" = nodigit ] && ok "(e) an explicit non-conforming value is kept" || bad "(e) got which=$w"
grep -q 'fails identity.s password policy' "$T/err" && ok "(e) and reported" || bad "(e) not reported"
r="$(run "" "")"; IFS='|' read -r w p l c <<<"$r"
[ "$w" = new ] && [ "$c" = yes ] && [ "$p" = "METABOB_API_KEY=generated" ] && ok "(f) nothing supplied or stored: a conforming key is generated" || bad "(f) got which=$w conforms=$c prov='$p'"
n=0; for i in $(seq 1 300); do
  k="$( prov() { :; }; METABOB_API_KEY=""; _MB_KEY_FROM_ENV=""; . "$T/blk.sh" 2>/dev/null; printf '%s' "$METABOB_API_KEY" )"
  [[ ${#k} -eq 32 && "$k" =~ [A-Z] && "$k" =~ [a-z] && "$k" =~ [0-9] ]] || n=$((n+1))
done
[ "$n" = 0 ] && ok "(f) 300 fresh draws: all 32 chars and conforming" || bad "(f) $n of 300 draws did not conform"
echo; [ "$FAILS" = 0 ] && { echo PASS; exit 0; } || { echo "$FAILS FAILED"; exit 1; }
