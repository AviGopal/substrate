#!/usr/bin/env bash
# retiring-names-gen-env.test.sh: openspec retire-metabob-names, phase 1 (task 1.2). gen-env accepts the new names
# (SUBSTRATE_API_KEY, SUBSTRATE_ENDPOINT) beside the retiring ones, the new name wins a conflict, the conflict is
# logged by NAME and never by value, every rendered env carries both names, the persisted store keeps ONE copy, and
# the alias is excluded from discovery-vessel's peer credentials exactly as the retiring name is.
set -uo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
S="$HERE/../../scripts/substrate"; G="$S/gen-env.sh"
T="$(mktemp -d "${TMPDIR:-/tmp}/retiring-names.XXXXXX")"; trap 'rm -rf "$T"' EXIT
FAILS=0; ok() { echo "ok   - $*"; }; bad() { echo "FAIL - $*"; FAILS=$((FAILS+1)); }

# 1. resolve_retiring_alias, run in a sandbox.
sed -n '/^resolve_retiring_alias() {/,/^}/p' "$G" > "$T/fn.sh"
grep -q 'printf -v' "$T/fn.sh" || { bad "could not extract resolve_retiring_alias from gen-env"; }
run() { # new old -> "resolved|stderr"
  ( unset SUBSTRATE_API_KEY METABOB_API_KEY; [ -n "$1" ] && export SUBSTRATE_API_KEY="$1"; [ -n "$2" ] && export METABOB_API_KEY="$2"
    . "$T/fn.sh"; resolve_retiring_alias SUBSTRATE_API_KEY METABOB_API_KEY 2>"$T/err"; printf '%s|%s' "${METABOB_API_KEY:-}" "$(cat "$T/err")" ); }
NEWV=mb-newVALUEnever-logged; OLDV=mb-oldVALUEnever-logged
[ "$(run "$NEWV" "")" = "$NEWV|" ] && ok "new name only: used" || bad "new only: $(run "$NEWV" "")"
[ "$(run "" "$OLDV")" = "$OLDV|" ] && ok "retiring name only: used" || bad "old only: $(run "" "$OLDV")"
[ "$(run "$NEWV" "$NEWV")" = "$NEWV|" ] && ok "both set and equal: no warning" || bad "equal: $(run "$NEWV" "$NEWV")"
r="$(run "$NEWV" "$OLDV")"
[ "${r%%|*}" = "$NEWV" ] && ok "both set and different: the NEW name wins" || bad "conflict resolved to the wrong value"
case "${r#*|}" in *SUBSTRATE_API_KEY*METABOB_API_KEY*) ok "the conflict is logged by name" ;; *) bad "conflict not logged: ${r#*|}" ;; esac
printf '%s' "$r" | cut -d'|' -f2- | grep -qE "$NEWV|$OLDV" && bad "a key VALUE was logged" || ok "no value is ever logged"
[ "$(run "" "")" = "|" ] && ok "neither set: left empty (the store or the generator decides next)" || bad "neither: $(run "" "")"

# 2. Order and rendering, read from gen-env's text.
nl() { grep -n -m1 -F "$1" "$G" | cut -d: -f1; }
a=$(nl 'resolve_retiring_alias SUBSTRATE_API_KEY METABOB_API_KEY'); b=$(nl 'METABOB_API_KEY="${METABOB_API_KEY:-$(persisted_secret METABOB_API_KEY)}"'); c=$(nl 'SUBSTRATE_API_KEY="$METABOB_API_KEY"')
[ -n "$a" ] && [ -n "$b" ] && [ -n "$c" ] && [ "$a" -lt "$b" ] && [ "$b" -lt "$c" ] && ok "key: inputs resolved, then the store, then the alias set from the result" || bad "key resolution order ($a,$b,$c)"
e=$(nl 'resolve_retiring_alias SUBSTRATE_ENDPOINT METABOB_ENDPOINT'); f=$(nl 'SUBSTRATE_ENDPOINT="$METABOB_ENDPOINT"')
[ -n "$e" ] && [ -n "$f" ] && [ "$e" -lt "$f" ] && ok "endpoint: inputs resolved, then the alias set" || bad "endpoint resolution order ($e,$f)"
awk '/^cat > \/etc\/substrate\/env <<EOF/{f=1;next} f&&/^EOF$/{f=0} f' "$G" > "$T/rendered"
for n in METABOB_API_KEY SUBSTRATE_API_KEY METABOB_ENDPOINT SUBSTRATE_ENDPOINT; do
  grep -q "^$n=" "$T/rendered" && ok "the rendered /etc/substrate/env carries $n" || bad "rendered env lacks $n"
done

# 3. The persisted store keeps ONE copy (the alias is rendered, never stored).
awk '/Substrate internal secrets/{f=1} f{print} f&&/^SUBSTRATE_GIT_PAT=/{exit}' "$G" > "$T/store"
grep -q '^METABOB_API_KEY=' "$T/store" && ! grep -q '^SUBSTRATE_API_KEY=' "$T/store" && ok "the store writer keeps the key under ONE name" || bad "store writer: $(grep -c API_KEY "$T/store") key line(s)"
grep -qE "\^\(JWT_SECRET\|SURREAL_PASS\|METABOB_API_KEY\|SUBSTRATE_API_KEY\|" "$S/secrets.env.sh" && ok "secrets.env.sh never carries the alias forward as an extra persisted key" || bad "secrets.env.sh core-key exclusion lacks SUBSTRATE_API_KEY"
grep -q 'SUBSTRATE_ENDPOINT|RELAY_MULTIADDR' "$S/secrets.env.sh" && grep -q 'METABOB_ENDPOINT|SUBSTRATE_ENDPOINT|RELAY_MULTIADDR)' "$G" && ok "SUBSTRATE_ENDPOINT is a routing anchor in BOTH writers' drop lists (never persisted)" || bad "SUBSTRATE_ENDPOINT missing from an anchor drop list"

# 4. The alias is excluded from peer credentials exactly as the retiring name is.
grep -q '"$_pn" == METABOB_API_KEY || "$_pn" == SUBSTRATE_API_KEY || "$_pn" == HUB_API_KEY' "$G" && ok "gen-env's PEER_CREDENTIALS filter refuses SUBSTRATE_API_KEY" || bad "gen-env peer filter lets SUBSTRATE_API_KEY through"
[ "$(jq -c '[.. | objects | select(.names_from? == "PEER_CREDENTIALS") | .exclude] | first' "$S/secrets-manifest.json")" = '["METABOB_API_KEY","SUBSTRATE_API_KEY","HUB_API_KEY"]' ] \
  && ok "secrets-manifest's peer-credential rule excludes SUBSTRATE_API_KEY" || bad "secrets-manifest exclude: $(jq -c '[.. | objects | select(.names_from? == "PEER_CREDENTIALS") | .exclude] | first' "$S/secrets-manifest.json")"
echo; [ "$FAILS" = 0 ] && { echo PASS; exit 0; } || { echo "$FAILS FAILED"; exit 1; }
