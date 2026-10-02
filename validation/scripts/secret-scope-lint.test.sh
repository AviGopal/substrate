#!/usr/bin/env bash
# secret-scope-lint.test.sh — no unit may hold a trust-root secret it does not consume.
#
#   bash validation/scripts/secret-scope-lint.test.sh [repo-root]
#
# Renders the scoped secret files with scripts/substrate/render-secret-scope.sh into a
# mktemp tree from FAKE values (never a real secret), resolves every unit's environment
# from the EnvironmentFile= lines it carries (baked units, their drop-ins, and the
# render-unit.sh output for every manifest vessel), and asserts, against
# scripts/substrate/secrets-manifest.json:
#   1. no unit loads the persisted store /workspace/.substrate-secrets
#   2. gen-env's shared /etc/substrate/env writer emits none of the scoped names
#   3. no unit's resolved env holds a scoped name it is not declared to consume
#   4. every declared consumer loads its scoped file, without '-', after the shared env
#   5. no unit loads admin.env
#   6. identity-vessel's resolved env carries API_KEY_SECRET with the rendered value
#   7. rendered files are 0600 in a 0700 private dir
#   8. recover mode on a node booted before the split: values carried from the old
#      shared env byte-for-byte, then stripped from it once the consumers load env.d
# Prints names only. Exit 0 = all pass.
set -uo pipefail
ROOT="${1:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
S="$ROOT/scripts/substrate"
MAN="$S/secrets-manifest.json"
RSS="$S/render-secret-scope.sh"
T="$(mktemp -d)"; trap 'rm -rf "$T"' EXIT
fails=0
ok()  { echo "  ok   $*"; }
bad() { echo "  FAIL $*"; fails=$((fails + 1)); }

echo "== secret-scope-lint ($ROOT)"
[ -f "$MAN" ] || { bad "no secrets manifest at scripts/substrate/secrets-manifest.json"; echo "FAILED ($fails)"; exit 1; }
[ -f "$RSS" ] || bad "no renderer at scripts/substrate/render-secret-scope.sh"

SCOPED="$(jq -r '.secrets | keys[]' "$MAN")"
UT="$(jq -r '.unit_file' "$MAN")"; AF="$(jq -r '.admin_file' "$MAN")"; PD="$(jq -r '.private_dir' "$MAN")"
ufile() { printf '%s' "${UT//\{unit\}/$1}"; }   # manifest-relative scoped file of a unit
PEER_NAME="LINT_PEER_API_KEY"   # a pattern-matched name, as PEER_CREDENTIALS would carry
consumers_of() { # <NAME> -> units, one per line
  if [ "$1" = "$PEER_NAME" ]; then jq -r '.patterns[0].units[]?' "$MAN"; else jq -r --arg n "$1" '.secrets[$n].units[]?' "$MAN"; fi
}
fake() { printf 'lintfake-%s' "$(printf '%s' "$1" | tr 'A-Z_' 'a-z-')"; }

# ── render (values mode, as gen-env calls it) ────────────────────────────────
E="$T/etc"; mkdir -p "$E"
_envargs=(); for n in $SCOPED; do _envargs+=("$n=$(fake "$n")"); done
_envargs+=("PEER_CREDENTIALS=http://peer.example:18100=$PEER_NAME" "$PEER_NAME=$(fake "$PEER_NAME")")
if [ -f "$RSS" ] && env "${_envargs[@]}" bash "$RSS" --mode values --manifest "$MAN" --env-dir "$E" > "$T/render.log" 2>&1; then
  ok "renderer ran (values mode)"
else
  bad "renderer failed: $(tail -n1 "$T/render.log" 2>/dev/null)"
fi
grep -q 'lintfake' "$T/render.log" && bad "renderer printed a value" || ok "renderer printed names only"

# ── 2. the shared env writer ─────────────────────────────────────────────────
# The heredoc (cat > /etc/substrate/env <<EOF … EOF) and the appended block
# ({ … } >> /etc/substrate/env) are the only writers of the shared file in gen-env.
awk '/^cat > \/etc\/substrate\/env <<EOF/{f=1;next} f&&/^EOF$/{f=0} f' "$S/gen-env.sh" > "$T/heredoc"
awk '/^\{$/{buf="";f=1} f{buf=buf $0 "\n"} f&&/^\} >> \/etc\/substrate\/env/{print buf; f=0}' "$S/gen-env.sh" > "$T/append"
SHARED_NAMES="$( { grep -v '^ *#' "$T/heredoc" | grep -oE '^[A-Z_][A-Z0-9_]*='; grep -v '^ *#' "$T/append" | grep -oE 'echo "[A-Z_][A-Z0-9_]*=' | sed 's/^echo "//'; } | tr -d '=' | sort -u)"
[ -n "$SHARED_NAMES" ] || bad "could not parse gen-env's shared env writer (heredoc + append block)"
_leak=""; for n in $SCOPED; do printf '%s\n' "$SHARED_NAMES" | grep -qx "$n" && _leak="$_leak $n"; done
grep -q '_peer_key_lines)' "$T/heredoc" && _leak="$_leak <peer keys>"
[ -z "$_leak" ] && ok "gen-env's shared env writer emits no scoped name" || bad "gen-env writes scoped name(s) into the shared env:$_leak"

# ── collect every unit's EnvironmentFile= list ───────────────────────────────
U="$T/units"; mkdir -p "$U"
for f in "$S"/units/*.service; do
  u="$(basename "$f" .service)"
  { grep -E '^EnvironmentFile=' "$f"; cat "$S/units/$u.service.d/"*.conf 2>/dev/null | grep -E '^EnvironmentFile='; } > "$U/$u" || true
done
for v in $(jq -r '.vessels[].name' "$S/vessels.manifest.json"); do
  SECRETS_MANIFEST="$MAN" bash "$S/render-unit.sh" "$v" "$S/vessels.manifest.json" 2>/dev/null | grep -E '^EnvironmentFile=' > "$U/rendered:$v" || true
done
echo "  ..   $(ls "$U" | wc -l) units parsed ($(ls "$U" | grep -c '^rendered:') rendered by render-unit)"

# Resolve a unit's env: source its files in order, mapped into the render tree.
# The shared env is modelled from gen-env's writer (names only, placeholder values).
: > "$E/env.model"; for n in $SHARED_NAMES; do echo "$n=\"shared\"" >> "$E/env.model"; done
map_path() {
  case "$1" in
    /etc/substrate/env) echo "$E/env.model" ;;
    /etc/substrate/*)   echo "$E/${1#/etc/substrate/}" ;;
    /workspace/.substrate-secrets) echo "$T/store" ;;
    *) echo "$T/absent" ;;
  esac
}
for n in $SCOPED $PEER_NAME; do echo "$n=$(fake "$n")"; done > "$T/store"
resolve() { # <unit> -> NAME=value lines (scoped names only)
  local files=() p
  while IFS= read -r l; do p="${l#EnvironmentFile=}"; p="${p#-}"; files+=("$(map_path "$p")"); done < "$U/$1"
  env -i sh -c 'set -a; for f in "$@"; do [ -f "$f" ] && . "$f"; done; env' _ "${files[@]}" 2>/dev/null
}

# ── 1, 3, 4, 5 ───────────────────────────────────────────────────────────────
for uf in "$U"/*; do
  u="$(basename "$uf")"; un="${u#rendered:}"
  grep -q '^EnvironmentFile=-\?/workspace/.substrate-secrets$' "$uf" && bad "$u loads the persisted store /workspace/.substrate-secrets"
  grep -qx "EnvironmentFile=-\?/etc/substrate/$AF" "$uf" && bad "$u loads $AF (operator/bootstrap scripts only)"
  env_now="$(resolve "$u")"
  for n in $SCOPED $PEER_NAME; do
    printf '%s\n' "$env_now" | grep -q "^$n=." || continue
    consumers_of "$n" | grep -qx "$un" || bad "$u's resolved env holds $n, and the manifest does not name it a consumer"
  done
done
for un in $(jq -r '[.secrets[].units[]?, .patterns[]?.units[]?] | unique | .[]' "$MAN"); do
  for uf in "$U/$un" "$U/rendered:$un"; do
    [ -f "$uf" ] || continue
    want="EnvironmentFile=/etc/substrate/$(ufile "$un")"
    if ! grep -qx "$want" "$uf"; then bad "$(basename "$uf") is a declared consumer but does not load $want (without '-')"; continue; fi
    [ "$(grep -nx "$want" "$uf" | cut -d: -f1)" -gt "$(grep -nE '^EnvironmentFile=-?/etc/substrate/env$' "$uf" | cut -d: -f1 | head -1)" ] \
      && ok "$(basename "$uf") loads its scoped file after the shared env" || bad "$(basename "$uf") loads its scoped file BEFORE the shared env"
  done
done
[ "$fails" -eq 0 ] && ok "no unit loads the store or admin.env; no unit holds a scoped name it does not consume"

# ── 6 ────────────────────────────────────────────────────────────────────────
if [ -f "$U/identity-vessel" ]; then
  v="$(resolve identity-vessel | sed -n 's/^API_KEY_SECRET=//p')"
  [ "$v" = "$(fake API_KEY_SECRET)" ] && ok "identity-vessel's resolved env carries API_KEY_SECRET (rendered value)" \
    || bad "identity-vessel's resolved env does not carry the rendered API_KEY_SECRET"
fi
for u in development-vessel local-tools-vessel; do
  [ -f "$U/$u" ] || continue
  h="$(resolve "$u" | grep -oE "^($(echo $SCOPED $PEER_NAME | tr ' ' '|'))=." | cut -d= -f1 | tr '\n' ' ')"
  [ -z "$h" ] && ok "$u's resolved env holds none of the scoped names" || bad "$u's resolved env holds: $h"
done

# ── 7 ────────────────────────────────────────────────────────────────────────
if [ -d "$E/$PD" ]; then
  _d=""; while IFS= read -r f; do [ "$(stat -c %a "$f")" = 700 ] || _d="$_d ${f#"$E"/}"; done < <(find "$E/$PD" -type d)
  [ -z "$_d" ] && ok "$PD/ and its subdirectories are 0700" || bad "not 0700:$_d"
  _m=""; while IFS= read -r f; do [ "$(stat -c %a "$f")" = 600 ] || _m="$_m $(basename "$f")"; done < <(find "$E/$PD" -type f)
  [ -z "$_m" ] && ok "every rendered file is 0600" || bad "not 0600:$_m"
fi

# ── 8. recover mode (pull-sync on a node booted before the split) ─────────────
R="$T/recover"; mkdir -p "$R/etc" "$R/units"
{ echo 'METABOB_API_KEY="shared-ok"'; for n in $SCOPED; do echo "$n=\"legacy-$(fake "$n")\""; done
  echo "PEER_CREDENTIALS=\"http://peer.example:18100=$PEER_NAME\""; echo "$PEER_NAME=\"legacy-peer\""; } > "$R/etc/env"
: > "$R/store"
for f in "$S"/units/*.service; do cp "$f" "$R/units/"; done
if [ -f "$RSS" ] && bash "$RSS" --mode recover --strip-shared --manifest "$MAN" --env-dir "$R/etc" --store "$R/store" \
     --peer-file "$R/none" --unit-dirs "$R/units" > "$T/recover.log" 2>&1; then
  v="$(env -i sh -c '. "$1"; printf %s "$API_KEY_SECRET"' _ "$R/etc/$(ufile identity-vessel)")"
  [ "$v" = "legacy-$(fake API_KEY_SECRET)" ] && ok "recover: identity's API_KEY_SECRET carried from the old shared env unchanged" || bad "recover: identity's API_KEY_SECRET changed"
  v="$(env -i sh -c '. "$1"; printf %s "$LINT_PEER_API_KEY"' _ "$R/etc/$(ufile discovery-vessel)")"
  [ "$v" = "legacy-peer" ] && ok "recover: the peer key reached discovery-vessel's file" || bad "recover: the peer key did not reach discovery-vessel's file"
  _left="$(grep -oE "^($(echo $SCOPED $PEER_NAME | tr ' ' '|'))=" "$R/etc/env" | tr -d '=' | tr '\n' ' ')"
  [ -z "$_left" ] && ok "recover: scoped names stripped from the shared env" || bad "recover: still in the shared env: $_left"
  grep -q '^METABOB_API_KEY="shared-ok"$' "$R/etc/env" && ok "recover: unscoped names left untouched" || bad "recover: an unscoped name was disturbed"
else
  bad "recover mode failed: $(tail -n1 "$T/recover.log" 2>/dev/null)"
fi

echo
[ "$fails" -eq 0 ] && { echo "PASSED"; exit 0; } || { echo "FAILED ($fails)"; exit 1; }
