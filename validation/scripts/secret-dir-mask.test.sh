#!/usr/bin/env bash
# The scoped trust-root secrets live in ONE stable directory, and every unit but the
# declared writers masks that DIRECTORY.
#
# Why a directory: InaccessiblePaths= binds what a path named when the unit started.
# render-secret-scope.sh replaces the files by rename, so a mask on a FILE covered a
# dead inode after the first render and every root vessel could read the live admin
# key (measured 10-02, inode inside == outside). A directory overmount survives any
# rename inside it, provided the directory itself is never replaced.
#
#   (a) no unit, script, Dockerfile line or executable doc names the flat layout
#       (/etc/substrate/admin.env, /etc/substrate/env.d), except lines marked
#       `legacy-path` and the two retained lines of the vessel drop-in
#   (b) the manifest puts unit_file and admin_file under private_dir; the consumer
#       units load exactly the manifest's path, without '-'
#   (c) the default-deny drop-in units/service.d/05-secret-dir-out-of-reach.conf masks
#       the directory (not a file), and the vessel drop-in repeats it
#   (d) exemptions: every same-named override in units/<u>.service.d/ is listed in
#       service.d/EXEMPT with a reason and sets no InaccessiblePaths; every EXEMPT
#       entry has its override; no drop-in anywhere resets InaccessiblePaths= to empty
#   (e) stability: nothing under scripts/substrate removes, renames or recreates the
#       private directory (rm / rmdir / mv / ln targeting it)
#   (f) the renderer, run on a scratch tree: migrates the flat layout INTO the
#       directory by rename (values intact), retires the flat files (removed, or a
#       symlink when an installed unit still names one), keeps the directory's inode
#       across runs, refuses a symlinked directory, and writes 0600 files in 0700 dirs
#   (g) negative controls: the pre-fix drop-in (file-level lines only) fails (c), a
#       unit naming the flat path fails (a), and rm/mv of the directory fails (e)
#   (h) the persisted store: lives in store_dir (a second stable directory), every
#       reference to the flat store path is a legacy-path line or a stale compiled
#       sibling of a .ts that does not use it, both drop-ins mask store_dir, nothing
#       removes or renames it, and the renderer migrates a flat store in (values intact,
#       flat path left as a symlink, a later flat REGULAR file wins as the newest copy,
#       directory inode stable, a symlinked store_dir refused)
# The by-effect proof (a live namespace cannot stat the files after a rename) needs
# systemd as PID1 and runs in install acceptance: secret-mask-probe.sh selftest.
#
# usage: validation/scripts/secret-dir-mask.test.sh [repo-root]
# Prints names and paths only; the scratch values are fakes. Exit 0 = all pass.
set -uo pipefail
ROOT="${1:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
S="$ROOT/scripts/substrate"
MAN="$S/secrets-manifest.json"
RSS="$S/render-secret-scope.sh"
T="$(mktemp -d)"; trap 'rm -rf "$T"' EXIT
fails=0
ok()  { echo "  ok   $*"; }
bad() { echo "  FAIL $*"; fails=$((fails + 1)); }
DEFAULT_DROPIN=05-secret-dir-out-of-reach.conf
echo "== secret-dir-mask ($ROOT)"

PRIV_REL="$(jq -r '.private_dir // empty' "$MAN")"
PRIV="/etc/substrate/$PRIV_REL"
[ -n "$PRIV_REL" ] && ok "manifest names private_dir ($PRIV_REL)" || bad "manifest has no private_dir"

# ── (a) no flat-layout reference ─────────────────────────────────────────────
flat_refs() { # <tree-root> -> offending file:line lines
  local r="$1"
  ( cd "$r" && grep -rnE '/etc/substrate/(admin\.env|env\.d)\b' -- scripts/substrate Dockerfile.substrate docker-compose.yml 2>/dev/null ) \
    | grep -v 'legacy-path' \
    | grep -vE '^scripts/substrate/units/vessel\.d/10-secrets-out-of-reach\.conf:[0-9]+:InaccessiblePaths=-/etc/substrate/(admin\.env|env\.d)$' \
    | grep -vE '^scripts/substrate/(acceptance|federation-relay)/.*\.md:' || true
}
_refs="$(flat_refs "$ROOT")"
[ -z "$_refs" ] && ok "(a) nothing names the flat layout outside legacy-path lines" || { bad "(a) flat-layout references:"; printf '       %s\n' "$_refs" | head -20; }
# template strings of the flat layout in code (a default that would resurrect it)
_tm="$(cd "$ROOT" && grep -rnE "[\"'](env\.d/\{unit\}\.env|admin\.env)[\"']" -- scripts/substrate 2>/dev/null | grep -v 'legacy-path' || true)"
[ -z "$_tm" ] && ok "(a) no code defaults to a flat-layout template" || { bad "(a) flat-layout template default:"; printf '       %s\n' "$_tm"; }

# ── (b) manifest + consumer units ────────────────────────────────────────────
UT="$(jq -r '.unit_file // empty' "$MAN")"; AF="$(jq -r '.admin_file // empty' "$MAN")"
case "$UT" in "$PRIV_REL"/*) ok "(b) unit_file is under private_dir" ;; *) bad "(b) unit_file ($UT) is outside private_dir" ;; esac
case "$AF" in "$PRIV_REL"/*) ok "(b) admin_file is under private_dir" ;; *) bad "(b) admin_file ($AF) is outside private_dir" ;; esac
for u in $(jq -r '[.secrets[].units[]?, .patterns[]?.units[]?] | unique | .[]' "$MAN"); do
  f="$S/units/$u.service"; [ -f "$f" ] || continue
  grep -qx "EnvironmentFile=/etc/substrate/${UT//\{unit\}/$u}" "$f" && ok "(b) $u loads its private file (required)" \
    || bad "(b) $u does not load EnvironmentFile=/etc/substrate/${UT//\{unit\}/$u}"
done

# ── (c) the masks ────────────────────────────────────────────────────────────
masks_dir() { # <conf> -> true when it masks the private DIRECTORY
  grep -qxE "InaccessiblePaths=-?$PRIV/?" "$1" 2>/dev/null
}
D="$S/units/service.d/$DEFAULT_DROPIN"
[ -f "$D" ] && masks_dir "$D" && ok "(c) the default-deny drop-in masks $PRIV" || bad "(c) $D does not mask $PRIV"
grep -qE "^InaccessiblePaths=-?$PRIV/." "$D" 2>/dev/null && bad "(c) the default drop-in masks a FILE under $PRIV (masks go stale on rename)"
masks_dir "$S/units/vessel.d/10-secrets-out-of-reach.conf" && ok "(c) the vessel drop-in repeats the directory mask" || bad "(c) the vessel drop-in does not mask $PRIV"

# ── (d) exemptions ───────────────────────────────────────────────────────────
EX="$S/units/service.d/EXEMPT"
exempt_list() { [ -f "$EX" ] && sed -e 's/#.*//' "$EX" | awk 'NF{print $1}'; }
_ov=""; for o in "$S"/units/*.service.d/"$DEFAULT_DROPIN"; do [ -f "$o" ] && _ov="$_ov $(basename "$(dirname "$o")" .d)"; done
for u in $_ov; do
  exempt_list | grep -qx "$u" || bad "(d) $u overrides the default-deny drop-in but is not in service.d/EXEMPT"
  [ -n "$(sed -e 's/#.*//' "$EX" | awk -v u="$u" '$1==u && NF>1')" ] || bad "(d) $u is in EXEMPT without a reason"
  grep -qE '^[[:space:]]*InaccessiblePaths' "$S/units/$u.d/$DEFAULT_DROPIN" && bad "(d) $u's override sets InaccessiblePaths (an override exempts; it does not edit)"
done
for u in $(exempt_list); do
  [ -f "$S/units/$u.d/$DEFAULT_DROPIN" ] || bad "(d) EXEMPT lists $u but units/$u.d/$DEFAULT_DROPIN does not exist"
  [ -f "$S/units/$u" ] || bad "(d) EXEMPT lists $u, which is not a unit in units/"
done
_resets="$(grep -rlxE '[[:space:]]*InaccessiblePaths[[:space:]]*=[[:space:]]*' "$S/units" 2>/dev/null || true)"
[ -z "$_resets" ] && ok "(d) no drop-in resets InaccessiblePaths=" || bad "(d) InaccessiblePaths= reset in: $_resets"
echo "  ..   exempt:$_ov"

# ── (e) the directory is never replaced ──────────────────────────────────────
destroy_refs() { # <tree-root> -> lines that rm/rmdir/mv/ln the private directory itself
  ( cd "$1" && grep -rnE "(\brm\b|\brmdir\b|\bmv\b|\bln\b)[^|;&]*(/etc/substrate/$PRIV_REL|\\\$PRIVATE|\\\$\{PRIVATE\})(/?[\"' ]|/?\$)" -- scripts/substrate Dockerfile.substrate 2>/dev/null ) || true
}
_destroy="$(destroy_refs "$ROOT")"
[ -z "$_destroy" ] && ok "(e) nothing removes, renames or relinks the private directory itself" || { bad "(e) the private directory is replaced by:"; printf '       %s\n' "$_destroy"; }
_rmrf="$(cd "$ROOT" && grep -rnE "rm -[a-zA-Z]*r[a-zA-Z]* +[\"']?/etc/substrate/?[\"']?( |$)" -- scripts/substrate 2>/dev/null || true)"
[ -z "$_rmrf" ] && ok "(e) nothing removes /etc/substrate recursively" || bad "(e) recursive removal of /etc/substrate: $_rmrf"

# ── (f) the renderer on a scratch tree ───────────────────────────────────────
E="$T/etc"; mkdir -p "$E/env.d" "$T/units"
fake() { printf 'maskfake-%s' "$(printf '%s' "$1" | tr 'A-Z_' 'a-z-')"; }
: > "$E/env"
SC="$(jq -r '.secrets | keys[]' "$MAN")"
{ for n in $SC; do echo "$n=\"$(fake "$n")\""; done; } > "$E/admin.env"
{ for n in $SC; do echo "$n=\"$(fake "$n")\""; done; } > "$E/env.d/identity-vessel.env"
{ for n in $SC; do echo "$n=\"$(fake "$n")\""; done; } > "$E/env.d/discovery-vessel.env"
chmod 600 "$E/admin.env" "$E"/env.d/*.env
# an /etc shadow that still names the flat path for discovery-vessel
printf '[Service]\nEnvironmentFile=/etc/substrate/env.d/discovery-vessel.env\n' > "$T/units/discovery-vessel.service"   # legacy-path (fixture)
if bash "$RSS" --mode recover --retire-legacy --manifest "$MAN" --env-dir "$E" --store "$T/none" --peer-file "$T/none" --unit-dirs "$T/units" > "$T/r1.log" 2>&1; then
  ok "(f) renderer ran (recover, retire)"
else bad "(f) renderer failed: $(tail -n1 "$T/r1.log")"; fi
grep -q maskfake "$T/r1.log" && bad "(f) the renderer printed a value"
P="$E/$PRIV_REL"
[ -d "$P" ] && [ ! -L "$P" ] && [ "$(stat -c %a "$P")" = 700 ] && ok "(f) $PRIV_REL/ is a real 0700 directory" || bad "(f) $PRIV_REL/ missing or not 0700"
v="$(env -i sh -c '. "$1"; printf %s "$API_KEY_SECRET"' _ "$E/${UT//\{unit\}/identity-vessel}" 2>/dev/null)"
[ "$v" = "$(fake API_KEY_SECRET)" ] && ok "(f) identity's value travelled into the private file unchanged" || bad "(f) identity's API_KEY_SECRET was not carried into the private file"
v="$(env -i sh -c '. "$1"; printf %s "$SUBSTRATE_ADMIN_KEY"' _ "$E/$AF" 2>/dev/null)"
[ "$v" = "$(fake SUBSTRATE_ADMIN_KEY)" ] && ok "(f) admin.env's value travelled into the private admin file unchanged" || bad "(f) the admin key was not carried into the private admin file"
[ ! -e "$E/admin.env" ] && [ ! -L "$E/admin.env" ] && ok "(f) flat admin.env removed (no unit names it)" || bad "(f) flat admin.env still present"
[ ! -e "$E/env.d/identity-vessel.env" ] && ok "(f) flat env.d/identity-vessel.env removed" || bad "(f) flat env.d/identity-vessel.env still present"
if [ -L "$E/env.d/discovery-vessel.env" ] && [ "$(realpath "$E/env.d/discovery-vessel.env")" = "$(realpath "$E/${UT//\{unit\}/discovery-vessel}")" ]; then
  ok "(f) a flat file an installed unit still names became a symlink into $PRIV_REL/"
else bad "(f) the still-named flat file was not turned into a symlink into $PRIV_REL/"; fi
_m=""; while IFS= read -r f; do [ "$(stat -c %a "$f")" = 600 ] || _m="$_m ${f#"$E"/}"; done < <(find "$P" -type f)
_d=""; while IFS= read -r f; do [ "$(stat -c %a "$f")" = 700 ] || _d="$_d ${f#"$E"/}"; done < <(find "$P" -type d)
[ -z "$_m$_d" ] && ok "(f) every file under $PRIV_REL/ is 0600 and every directory 0700" || bad "(f) modes wrong:$_m$_d"
_i1="$(stat -c %i "$P")"
bash "$RSS" --mode recover --retire-legacy --manifest "$MAN" --env-dir "$E" --store "$T/none" --peer-file "$T/none" --unit-dirs "$T/units" > "$T/r2.log" 2>&1 \
  && [ "$(stat -c %i "$P")" = "$_i1" ] && ok "(f) a second render keeps the directory's inode (the mask stays valid)" || bad "(f) the second render replaced the directory or failed"
# a symlinked private dir is refused
E2="$T/etc2"; mkdir -p "$E2" "$T/elsewhere"; : > "$E2/env"; ln -s "$T/elsewhere" "$E2/$PRIV_REL"
if bash "$RSS" --mode recover --manifest "$MAN" --env-dir "$E2" --store "$T/none" --peer-file "$T/none" > "$T/r3.log" 2>&1; then
  bad "(f) the renderer wrote through a symlinked $PRIV_REL/"
else ok "(f) a symlinked $PRIV_REL/ is refused"; fi
# a manifest that puts a file outside private_dir is refused
jq '.admin_file = "admin.env"' "$MAN" > "$T/bad-manifest.json"   # legacy-path (negative fixture)
E3="$T/etc3"; mkdir -p "$E3"; : > "$E3/env"
bash "$RSS" --mode recover --manifest "$T/bad-manifest.json" --env-dir "$E3" --store "$T/none" --peer-file "$T/none" > "$T/r4.log" 2>&1 \
  && bad "(f) a manifest with admin_file outside private_dir was accepted" || ok "(f) a manifest with admin_file outside private_dir is refused"

# ── (g) negative controls ────────────────────────────────────────────────────
printf '[Service]\nInaccessiblePaths=-/etc/substrate/env.d\nInaccessiblePaths=-/etc/substrate/admin.env\n' > "$T/old.conf"   # legacy-path (negative fixture)
masks_dir "$T/old.conf" && bad "(g) control: the pre-fix file-level drop-in passed (c)" || ok "(g) control: the pre-fix file-level drop-in fails (c)"
CT="$T/ctree"; mkdir -p "$CT/scripts/substrate/units"
printf '[Service]\nEnvironmentFile=/etc/substrate/env.d/x.env\n' > "$CT/scripts/substrate/units/x.service"   # legacy-path (negative fixture)
[ -n "$(flat_refs "$CT")" ] && ok "(g) control: a unit naming the flat path is caught by (a)" || bad "(g) control: (a) missed a unit naming the flat path"
printf 'rm -rf "$PRIVATE"\n' > "$CT/scripts/substrate/a.sh"; printf 'mv /etc/substrate/%s /tmp/x\n' "$PRIV_REL" > "$CT/scripts/substrate/b.sh"
[ "$(destroy_refs "$CT" | wc -l)" = 2 ] && ok "(g) control: removing or renaming the directory is caught by (e)" || bad "(g) control: (e) missed a removal/rename of the directory"

# ── (h) the persisted store ──────────────────────────────────────────────────
SD="$(jq -r '.store_dir // empty' "$MAN")"; SF="$(jq -r '.store_file // empty' "$MAN")"; LS="$(jq -r '.legacy_store // empty' "$MAN")"
[ -n "$SD" ] && [ -n "$SF" ] && [ -n "$LS" ] && ok "(h) manifest names store_dir, store_file, legacy_store" || bad "(h) manifest lacks store_dir/store_file/legacy_store"
store_refs() { # <tree-root> -> offending references to the flat store path
  ( cd "$1" && grep -rnE '/workspace/\.substrate-secrets([^.d]|$)' -- scripts/substrate Dockerfile.substrate 2>/dev/null ) \
    | grep -v 'legacy-path' | grep -v '"legacy_store"' \
    | grep -vE '^scripts/substrate/units/vessel\.d/10-secrets-out-of-reach\.conf:[0-9]+:InaccessiblePaths=-/workspace/\.substrate-secrets$' \
    | while IFS= read -r l; do f="${l%%:*}"; case "$f" in *.js) [ -f "$1/${f%.js}.ts" ] && ! grep -q '/workspace/\.substrate-secrets\b' "$1/${f%.js}.ts" && continue ;; esac; printf '%s\n' "$l"; done
}
_sr="$(store_refs "$ROOT")"
[ -z "$_sr" ] && ok "(h) nothing names the flat store path outside legacy-path lines" || { bad "(h) flat store path referenced:"; printf '       %s\n' "$_sr" | head -20; }
grep -qxE "InaccessiblePaths=-?$SD/?" "$D" && ok "(h) the default-deny drop-in masks $SD" || bad "(h) the default-deny drop-in does not mask $SD"
grep -qxE "InaccessiblePaths=-?$SD/?" "$S/units/vessel.d/10-secrets-out-of-reach.conf" && ok "(h) the vessel drop-in masks $SD" || bad "(h) the vessel drop-in does not mask $SD"
_sdd="$(cd "$ROOT" && grep -rnE "(\brm\b|\brmdir\b|\bmv\b|\bln\b)[^|;&]*($SD|\\\$_sdir|\\\$\{_sdir\})(/?[\"' ]|/?\$)" -- scripts/substrate 2>/dev/null || true)"
[ -z "$_sdd" ] && ok "(h) nothing removes, renames or relinks $SD itself" || { bad "(h) $SD replaced by:"; printf '       %s\n' "$_sdd"; }
grep -q '_SECRETS_TMP="$(mktemp "$SECRETS_STORE.tmp' "$S/gen-env.sh" && ok "(h) gen-env stages the store inside its directory (the install is a rename there)" || bad "(h) gen-env stages the store outside its directory"
W="$T/ws"; mkdir -p "$W"; E4="$T/etc4"; mkdir -p "$E4"; : > "$E4/env"
{ for n in $SC; do echo "$n=$(fake "$n")"; done; echo 'SUBSTRATE_GIT_PAT=maskfake-pat'; } > "$W/.substrate-secrets"; cp "$W/.substrate-secrets" "$W/.substrate-secrets.prev"; chmod 600 "$W"/.substrate-secrets*
srun() { bash "$RSS" --mode recover --manifest "$MAN" --env-dir "$E4" --store "$W/.substrate-private/substrate-secrets" --legacy-store "$W/.substrate-secrets" --peer-file "$T/none" "$@"; }
if srun > "$T/s1.log" 2>&1; then ok "(h) renderer ran with a flat store present"; else bad "(h) renderer failed: $(tail -n1 "$T/s1.log")"; fi
grep -q maskfake "$T/s1.log" && bad "(h) the renderer printed a store value"
SP="$W/.substrate-private"
[ -d "$SP" ] && [ ! -L "$SP" ] && [ "$(stat -c %a "$SP")" = 700 ] && ok "(h) the store directory is a real 0700 directory" || bad "(h) the store directory is missing or not 0700"
v="$(env -i sh -c '. "$1"; printf %s "$SUBSTRATE_GIT_PAT"' _ "$SP/substrate-secrets" 2>/dev/null)"
[ "$v" = maskfake-pat ] && [ "$(stat -c %a "$SP/substrate-secrets")" = 600 ] && ok "(h) the store moved in with its values, 0600" || bad "(h) the store did not move in intact"
[ -f "$SP/substrate-secrets.prev" ] && ok "(h) the store's .prev moved in too" || bad "(h) the store's .prev was left behind"
[ -L "$W/.substrate-secrets" ] && [ "$(realpath "$W/.substrate-secrets")" = "$(realpath "$SP/substrate-secrets")" ] && ok "(h) the flat store path is now a symlink into the directory" || bad "(h) the flat store path is not a symlink into the directory"
v="$(env -i sh -c '. "$1"; printf %s "$API_KEY_SECRET"' _ "$E4/$(jq -r '.unit_file' "$MAN" | sed 's/{unit}/identity-vessel/')" 2>/dev/null)"
[ "$v" = "$(fake API_KEY_SECRET)" ] && ok "(h) recover mode read the moved store (identity's value rendered from it)" || bad "(h) recover mode did not read the moved store"
_si="$(stat -c %i "$SP")"
# an older writer replaces the flat symlink with a regular file: it is the newest copy and wins
{ echo 'SUBSTRATE_GIT_PAT=maskfake-newer'; } > "$W/.substrate-secrets.tmp"; mv -f "$W/.substrate-secrets.tmp" "$W/.substrate-secrets"
srun > "$T/s2.log" 2>&1
v="$(env -i sh -c '. "$1"; printf %s "$SUBSTRATE_GIT_PAT"' _ "$SP/substrate-secrets" 2>/dev/null)"
[ "$v" = maskfake-newer ] && [ -L "$W/.substrate-secrets" ] && ok "(h) a flat regular file written by an older writer is migrated in and the symlink restored" || bad "(h) a flat regular file from an older writer was not migrated"
[ "$(stat -c %i "$SP")" = "$_si" ] && ok "(h) the store directory keeps its inode across runs" || bad "(h) the store directory was replaced"
W2="$T/ws2"; mkdir -p "$W2" "$T/elsewhere2"; ln -s "$T/elsewhere2" "$W2/.substrate-private"
bash "$RSS" --migrate-store-only --manifest "$MAN" --store "$W2/.substrate-private/substrate-secrets" --legacy-store "$W2/.substrate-secrets" > "$T/s3.log" 2>&1 \
  && bad "(h) a symlinked store directory was accepted" || ok "(h) a symlinked store directory is refused"
CT2="$T/ctree2"; mkdir -p "$CT2/scripts/substrate"; printf '. /workspace/.substrate-secrets\n' > "$CT2/scripts/substrate/x.sh"   # legacy-path (negative fixture)
[ -n "$(store_refs "$CT2")" ] && ok "(g) control: a script sourcing the flat store path is caught by (h)" || bad "(g) control: (h) missed a script sourcing the flat store path"

echo
[ "$fails" -eq 0 ] && { echo "PASSED"; exit 0; } || { echo "FAILED ($fails)"; exit 1; }
