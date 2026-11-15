#!/usr/bin/env bash
# identity's key directory (org keys 1a) is masked for EVERY service, identity included, and identity reaches it only
# through a bind; it is made before any unit starts, by a step that refuses a symlink on its path.
#
#   (a) the type-level drop-in units/service.d/07-identity-keys-out-of-reach.conf masks the DIRECTORY with '-'
#   (b) identity-vessel binds that directory at /run/identity-keys with no Environment= line (identity's defaults name
#       both paths): the same directory in the drop-in, the bind and the helper default
#   (c) nothing overrides the default-deny by name, and no drop-in anywhere under units/ resets InaccessiblePaths=
#   (d) the entrypoint runs the helper before systemd starts anything, and the image installs it
#   (e) the helper, on a scratch tree: makes the directory 0700; a second run keeps it (chmod in place); it refuses,
#       creating nothing, a symlinked directory, a symlinked parent, a non-directory, a missing parent, a relative path
#   (f) negative controls: a same-named override and an empty reset in a scratch copy of units/ fail (c)
# The by-effect proof (identity reads and writes through the bind while a plain unit gets ENOENT on the directory,
# and identity keeps its secret-directory masks) needs systemd as PID1 and is deployment's acceptance check on the
# target node, with identity's own audit: complete over every loaded unit.
#
# usage: validation/scripts/identity-keys-mask.test.sh [repo-root]   Exit 0 = all pass.
set -uo pipefail
ROOT="${1:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
S="$ROOT/scripts/substrate"
U="$S/units"
T="$(mktemp -d)"; trap 'rm -rf "$T"' EXIT
fails=0
ok()  { echo "  ok   $*"; }
bad() { echo "  FAIL $*"; fails=$((fails + 1)); }
DROPIN=07-identity-keys-out-of-reach.conf
BIND="$U/identity-vessel.service.d/30-identity-keys-bind.conf"
HELPER="$S/identity-keys-dir.sh"
V=/workspace/.substrate-identity-keys
echo "== identity-keys-mask ($ROOT)"

# (a)
grep -qxF "InaccessiblePaths=-$V" "$U/service.d/$DROPIN" 2>/dev/null && ok "(a) every service masks $V" || bad "(a) service.d/$DROPIN does not mask $V with '-'"

# (b)
grep -qxF "BindPaths=-$V:/run/identity-keys" "$BIND" 2>/dev/null && ok "(b) identity binds $V at /run/identity-keys" || bad "(b) identity's bind is missing or differs"
! grep -qE '^Environment=' "$BIND" && ok "(b) the bind sets no Environment= (identity's own defaults name both paths)" || bad "(b) the bind drop-in sets an Environment= line"
grep -qF "DIR=\"\${1:-$V}\"" "$HELPER" && ok "(b) the helper's default is the same directory" || bad "(b) the helper's default differs from $V"

# (c)
mask_overrides() { # <units-dir> -> offending paths
  local u="$1"
  find "$u" -path "$u/service.d" -prune -o -name "$DROPIN" -print 2>/dev/null
  grep -rlE '^\s*InaccessiblePaths\s*=\s*$' "$u" 2>/dev/null
}
out="$(mask_overrides "$U")"
[ -z "$out" ] && ok "(c) no override by name and no reset under units/" || bad "(c) overrides or resets: $out"

# (d)
EP="$S/entrypoint.sh"
helper_line="$(grep -nF '/usr/local/bin/identity-keys-dir' "$EP" | head -1 | cut -d: -f1)"
first_systemd="$(grep -nE 'exec .*systemd|/lib/systemd/systemd|/sbin/init' "$EP" | head -1 | cut -d: -f1)"
[ -n "$helper_line" ] && { [ -z "$first_systemd" ] || [ "$helper_line" -lt "$first_systemd" ]; } \
  && ok "(d) the entrypoint makes the directory before systemd starts" || bad "(d) the entrypoint does not run the helper before systemd"
grep -qF 'COPY scripts/substrate/identity-keys-dir.sh /usr/local/bin/identity-keys-dir' "$ROOT/Dockerfile.substrate" \
  && ok "(d) the image installs the helper" || bad "(d) the image does not install the helper"

# (e)
mkdir -p "$T/ws"
d="$T/ws/keys"
bash "$HELPER" "$d" >/dev/null 2>&1 && [ -d "$d" ] && [ "$(stat -c %a "$d")" = 700 ] && ok "(e) makes the directory 0700" || bad "(e) did not make a 0700 directory"
chmod 0755 "$d"; ino="$(stat -c %i "$d")"
bash "$HELPER" "$d" >/dev/null 2>&1 && [ "$(stat -c %a "$d")" = 700 ] && [ "$(stat -c %i "$d")" = "$ino" ] && ok "(e) a second run keeps it (same inode, 0700)" || bad "(e) a second run replaced or left it open"
refuses() { # <label> <path>
  if bash "$HELPER" "$2" >/dev/null 2>&1; then bad "(e) $1: not refused"; else ok "(e) refuses $1"; fi
}
mkdir -p "$T/real"; ln -s "$T/real" "$T/ws/linkdir"; refuses "a symlinked directory" "$T/ws/linkdir"
ln -s "$T/real" "$T/linkparent"; refuses "a symlinked parent" "$T/linkparent/keys"
[ ! -e "$T/real/keys" ] && ok "(e) nothing created through a symlinked parent" || bad "(e) created through a symlinked parent"
: > "$T/ws/afile"; refuses "a non-directory" "$T/ws/afile"
refuses "a missing parent" "$T/nope/keys"
refuses "a relative path" "rel/keys"

# (f)
cp -r "$U" "$T/units"
mkdir -p "$T/units/records-vessel.service.d"; printf '[Service]\nInaccessiblePaths=/x\n' > "$T/units/records-vessel.service.d/$DROPIN"
[ -n "$(mask_overrides "$T/units")" ] && ok "(f) a same-named override is caught" || bad "(f) a same-named override passed"
rm -f "$T/units/records-vessel.service.d/$DROPIN"; printf '[Service]\nInaccessiblePaths=\n' > "$T/units/records-vessel.service.d/99-reset.conf"
[ -n "$(mask_overrides "$T/units")" ] && ok "(f) an empty reset is caught" || bad "(f) an empty reset passed"

echo; [ "$fails" = 0 ] && { echo PASS; exit 0; } || { echo "$fails failure(s)"; exit 1; }
