#!/usr/bin/env bash
# An EXPIRING admin-scoped key is never persisted as the operator credential (substrate-key.sh, `issue`).
#
# WHY. persist_admin_key() writes SUBSTRATE_ADMIN_KEY, the operator's recovery credential the SEC-5 role
# gate reads. `issue` persisted ANY admin-scoped mint, including one with an expiry, so a short-lived
# admin test key silently replaced the operator credential, and when it expired issue/list/revoke all
# locked out. Only a non-expiring admin mint may become the persisted credential.
#
#   must-fail  `issue t read,write,admin 1`: every persisted SUBSTRATE_ADMIN_KEY file is byte-identical,
#              and a warning naming the key name and its days is on stderr
#   control 1  `issue op read,write,admin` (no expiry): every file carries the issued key (env files
#              quoted, the secrets file unquoted), as before
#   control 2  `issue p read,write` (not admin): every file byte-identical
#   leak       in every leg stdout is exactly the issued key, once; neither the issued nor the
#              original key appears on stderr
#
# Runs the WHOLE script with its fixed paths rewritten to a temp tree and curl stubbed (the identity
# endpoint is a .invalid host, so a bypassed stub fails instead of reaching anything). Every key is a
# fake fixture value. No root, no live state.
#
# usage: validation/scripts/substrate-key-expiring-admin-not-persisted.test.sh [path/to/substrate-key.sh]
# Needs bash, jq, sed, grep, cmp.
set -uo pipefail
SRC="$(cd "$(dirname "$0")/../.." && pwd)"
SCRIPT="${1:-$SRC/scripts/substrate/substrate-key.sh}"
T="$(mktemp -d "${TMPDIR:-/tmp}/substrate-key-expiry.XXXXXX")"; trap 'rm -rf "$T"' EXIT
FAILS=0
ok()  { echo "ok   - $*"; }
bad() { echo "FAIL - $*"; FAILS=$((FAILS+1)); }
ORIG=FAKEKEY-ORIGINAL-operator
ISSUED=FAKEKEY-ISSUED-mint

# The script under test, fixed paths moved into the temp tree. The manifest sits beside the copy
# (its dirname "$0" candidate); the share candidate does not exist.
mkdir -p "$T/sk"
sed -e "s#/usr/local/share/substrate#$T/share#g" -e "s#/etc/substrate#$T/etc#g" \
    -e "s#/workspace#$T/ws#g" "$SCRIPT" > "$T/sk/substrate-key.sh"
cp "$SRC/scripts/substrate/secrets-manifest.json" "$T/sk/"

# curl: answers each identity endpoint with a fixture; /v1/keys/issue returns the issued fake key.
mkdir -p "$T/stub"
cat > "$T/stub/curl" <<EOF
#!/usr/bin/env bash
url=""; for a in "\$@"; do case "\$a" in http*) url="\$a" ;; esac; done
case "\$url" in
  */health)          exit 0 ;;
  */v1/keys/validate) printf '{"data":{"org_id":"org-fx","user_id":"user-fx"}}' ;;
  */v1/jwt/generate)  printf '{"data":{"token":"jwt-fx"}}' ;;
  */v1/keys/issue)    printf '{"data":{"key":"%s","key_id":"kid-fx","expires_at":null}}' "$ISSUED" ;;
  *)                  exit 7 ;;
esac
EOF
chmod +x "$T/stub/curl"

ENVF=("$T/etc/private/admin.env" "$T/etc/private/env.d/identity-seeder.env")
SEC="$T/ws/.substrate-private/substrate-secrets"
setup() {
  rm -rf "$T/etc" "$T/ws" "$T/snap"; mkdir -p "$T/etc/private/env.d" "$T/ws/.substrate-private" "$T/snap"
  printf 'METABOB_API_KEY="FAKEKEY-node-readwrite"\nIDENTITY_VESSEL_URL="http://identity.invalid"\n' > "$T/etc/env"
  local f; for f in "${ENVF[@]}"; do printf 'OTHER=1\nSUBSTRATE_ADMIN_KEY="%s"\n' "$ORIG" > "$f"; done
  printf 'OTHER=1\nSUBSTRATE_ADMIN_KEY=%s\n' "$ORIG" > "$SEC"
  cp "${ENVF[0]}" "$T/snap/admin.env"; cp "${ENVF[1]}" "$T/snap/identity-seeder.env"; cp "$SEC" "$T/snap/secrets"
}
run() { # args... -> RC, $T/out, $T/err
  env -i PATH="$T/stub:/usr/bin:/bin" HOME="$T" bash "$T/sk/substrate-key.sh" "$@" >"$T/out" 2>"$T/err"; RC=$?
}
unchanged() {
  cmp -s "${ENVF[0]}" "$T/snap/admin.env" && cmp -s "${ENVF[1]}" "$T/snap/identity-seeder.env" && cmp -s "$SEC" "$T/snap/secrets"
}
no_leak() { # leg
  if [ "$RC" = 0 ] && [ "$(cat "$T/out")" = "$ISSUED" ] && [ "$(wc -l < "$T/out")" = 1 ]; then
    ok "$1: stdout is exactly the issued key, once"
  else bad "$1: stdout is not exactly one issued-key line (rc $RC, $(wc -l < "$T/out") lines)"; fi
  if grep -qF -e "$ISSUED" -e "$ORIG" "$T/err" || grep -qF "$ORIG" "$T/out"; then
    bad "$1: a key value reached stderr (or the original key reached stdout)"
  else ok "$1: no key value on stderr"; fi
}

# ── must-fail: an expiring admin key leaves the operator credential alone ─────────
setup; run issue t read,write,admin 1
unchanged && ok "must-fail: an expiring admin key leaves every persisted SUBSTRATE_ADMIN_KEY byte-identical" \
          || bad "must-fail: an expiring admin key overwrote the persisted operator credential"
grep -q "NOT persisting SUBSTRATE_ADMIN_KEY: 't' is admin-scoped but expires in 1 day(s)" "$T/err" \
  && ok "must-fail: the warning names the key and its expiry" || bad "must-fail: no not-persisting warning on stderr"
grep -q 'persisted SUBSTRATE_ADMIN_KEY to its scoped files' "$T/err" \
  && bad "must-fail: stderr reports a persist" || ok "must-fail: no persist reported"
no_leak "must-fail"

# ── control 1: a non-expiring admin key becomes the operator credential ───────────
setup; run issue op read,write,admin
if grep -qxF "SUBSTRATE_ADMIN_KEY=\"$ISSUED\"" "${ENVF[0]}" && grep -qxF "SUBSTRATE_ADMIN_KEY=\"$ISSUED\"" "${ENVF[1]}" \
   && grep -qxF "SUBSTRATE_ADMIN_KEY=$ISSUED" "$SEC" && ! grep -qF "$ORIG" "${ENVF[@]}" "$SEC" \
   && grep -qxF 'OTHER=1' "$SEC"; then
  ok "control 1: a non-expiring admin key is persisted to every scoped file (env quoted, secrets unquoted)"
else bad "control 1: a non-expiring admin key was not persisted as the operator credential"; fi
grep -q 'NOT persisting' "$T/err" && bad "control 1: a non-expiring mint printed the not-persisting warning" \
                                  || ok "control 1: no not-persisting warning"
no_leak "control 1"

# ── control 2: a non-admin key is never persisted ────────────────────────────────
setup; run issue p read,write
unchanged && ok "control 2: a non-admin key leaves every persisted file byte-identical" \
          || bad "control 2: a non-admin key changed a persisted file"
no_leak "control 2"

if [ "$FAILS" -eq 0 ]; then echo "PASS"; exit 0; fi
echo "FAILED ($FAILS)"; exit 1
