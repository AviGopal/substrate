#!/usr/bin/env bash
# kind: known-valid
# The candidate substrate-key persists only a NON-EXPIRING admin-scoped key as the operator credential. Run by
# shadow-eval.sh with CANDIDATE_DIR (see its header).
#
# WHY. persist_admin_key() writes SUBSTRATE_ADMIN_KEY, the operator's recovery credential the SEC-5 role gate reads
# to mint admin JWTs for issue/list/revoke. A candidate that persists an expiring admin key (a short-lived test key)
# replaces that credential with one that dies, and key management locks out at its expiry. substrate-key converges
# in place only when this fixture judges a candidate by what `issue` does, not by whether it parses.
#
# HOW. The candidate's substrate-key.sh runs whole, its fixed paths (/etc/substrate, /usr/local/share/substrate,
# /workspace) rewritten into scratch and curl stubbed; the identity endpoint is a .invalid host, so a bypassed stub
# fails instead of reaching anything. Every key is a fixture value. Three issues:
#   - `issue t read,write,admin 1` (expiring admin): every persisted SUBSTRATE_ADMIN_KEY file byte-identical;
#   - `issue op read,write,admin` (no expiry, the control): every file carries the issued key (env files quoted,
#     the secrets file unquoted), so a candidate that persists nothing fails too;
#   - `issue p read,write` (not admin): every file byte-identical.
# In each, stdout is exactly the issued key and no key value reaches stderr.
set -u
SK="$CANDIDATE_DIR/scripts/substrate/substrate-key.sh"; MF="$CANDIDATE_DIR/scripts/substrate/secrets-manifest.json"
[ -f "$SK" ] || { echo "FAIL - the candidate carries no scripts/substrate/substrate-key.sh"; exit 1; }
[ -f "$MF" ] || { echo "FAIL - the candidate carries no scripts/substrate/secrets-manifest.json (substrate-key reads it)"; exit 1; }
T="$(mktemp -d "${TMPDIR:-/tmp}/substrate-key-admin.XXXXXX")" || { echo "FAIL - mktemp"; exit 1; }
trap 'rm -rf "$T"' EXIT
ORIG=FAKEKEY-ORIGINAL-operator; ISSUED=FAKEKEY-ISSUED-mint
mkdir -p "$T/sk" "$T/stub"
sed -e "s#/usr/local/share/substrate#$T/share#g" -e "s#/etc/substrate#$T/etc#g" -e "s#/workspace#$T/ws#g" "$SK" > "$T/sk/substrate-key.sh"
cp "$MF" "$T/sk/"
cat > "$T/stub/curl" <<EOF
#!/usr/bin/env bash
url=""; for a in "\$@"; do case "\$a" in http*) url="\$a" ;; esac; done
case "\$url" in
  */health)           exit 0 ;;
  */v1/keys/validate) printf '{"data":{"org_id":"org-fx","user_id":"user-fx"}}' ;;
  */v1/jwt/generate)  printf '{"data":{"token":"jwt-fx"}}' ;;
  */v1/keys/issue)    printf '{"data":{"key":"%s","key_id":"kid-fx","expires_at":null}}' "$ISSUED" ;;
  *)                  exit 7 ;;
esac
EOF
chmod +x "$T/stub/curl"
ENVF=("$T/etc/private/admin.env" "$T/etc/private/env.d/identity-seeder.env"); SEC="$T/ws/.substrate-private/substrate-secrets"
rc=0
setup() {
  rm -rf "$T/etc" "$T/ws" "$T/snap"; mkdir -p "$T/etc/private/env.d" "$T/ws/.substrate-private" "$T/snap"
  printf 'METABOB_API_KEY="FAKEKEY-node-readwrite"\nIDENTITY_VESSEL_URL="http://identity.invalid"\n' > "$T/etc/env"
  local f; for f in "${ENVF[@]}"; do printf 'OTHER=1\nSUBSTRATE_ADMIN_KEY="%s"\n' "$ORIG" > "$f"; done
  printf 'OTHER=1\nSUBSTRATE_ADMIN_KEY=%s\n' "$ORIG" > "$SEC"
  cp "${ENVF[0]}" "$T/snap/a"; cp "${ENVF[1]}" "$T/snap/b"; cp "$SEC" "$T/snap/s"
}
run() { # <leg> args...: runs the candidate, then judges stdout and stderr
  local leg="$1"; shift
  PATH="$T/stub:/usr/bin:/bin" HOME="$T" bash "$T/sk/substrate-key.sh" "$@" > "$T/out" 2> "$T/err"; local r=$?
  { [ "$r" = 0 ] && [ "$(cat "$T/out")" = "$ISSUED" ] && [ "$(wc -l < "$T/out")" = 1 ]; } \
    || { echo "FAIL - $leg: \`$*\` exit $r, stdout is not exactly the issued key"; rc=1; }
  ! grep -qF -e "$ISSUED" -e "$ORIG" "$T/err" || { echo "FAIL - $leg: a key value reached stderr"; rc=1; }
}
unchanged() { cmp -s "${ENVF[0]}" "$T/snap/a" && cmp -s "${ENVF[1]}" "$T/snap/b" && cmp -s "$SEC" "$T/snap/s"; }

setup; run expiring-admin issue t read,write,admin 1
unchanged || { echo "FAIL - an expiring admin-scoped key replaced the persisted operator credential (SEC-5)"; rc=1; }
setup; run admin issue op read,write,admin
{ grep -qxF "SUBSTRATE_ADMIN_KEY=\"$ISSUED\"" "${ENVF[0]}" && grep -qxF "SUBSTRATE_ADMIN_KEY=\"$ISSUED\"" "${ENVF[1]}" \
  && grep -qxF "SUBSTRATE_ADMIN_KEY=$ISSUED" "$SEC" && ! grep -qF "$ORIG" "${ENVF[@]}" "$SEC"; } \
  || { echo "FAIL - a non-expiring admin key was not persisted to every scoped file"; rc=1; }
setup; run non-admin issue p read,write
unchanged || { echo "FAIL - a non-admin key changed a persisted file"; rc=1; }
[ "$rc" = 0 ] && echo "ok - only a non-expiring admin key becomes the persisted operator credential"
exit $rc
