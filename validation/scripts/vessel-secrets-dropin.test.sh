#!/usr/bin/env bash
# Every vessel unit resolves the shared secrets drop-in, or is a DECLARED
# exception (scripts/substrate/units/vessel.d/).
#
# The user locality ruling is "secrets never in agent reach". Units run as root,
# so file modes protect nothing; only the mount namespace does. One canonical
# drop-in (vessel.d/10-secrets-out-of-reach.conf) carries the InaccessiblePaths
# lines, and each vessel unit attaches it through a symlink in its own
# <unit>.service.d/. Those directories ride every unit install path unchanged:
# the image COPY of units/ into /usr/lib/systemd/system, and pull-sync's
# converge_units. A /usr/lib drop-in directory also applies to a unit rendered
# into /etc by vessel-ctl, so manifest vessels are covered by the same files.
#
# The vessel-unit universe is derived from committed data, not a hand list:
#   inventory .vessels[] with a `repo` whose unit is a .service
#   ∪ manifest .vessels[].name + ".service"
#   ∪ units/*-vessel.service
# A unit that legitimately reads the secret paths at runtime must be named in
# vessel.d/EXCEPTIONS; it must then NOT carry the drop-in.
#
#   (a) the canonical drop-in blocks both secret paths
#   (b) every vessel unit attaches it (symlink to the canonical file), or is excepted
#   (c) no other drop-in of that unit resets InaccessiblePaths= afterwards
#   (d) every EXCEPTIONS entry names a real unit and carries no drop-in
#   (e) a scratch vessel unit without the drop-in FAILS the check (negative control)
#   (f) systemd-analyze verify parses the drop-in through the symlink cleanly,
#       and does read it (a bogus key in a scratch copy is reported) — skipped,
#       and said so, where systemd-analyze is absent
#
# usage: validation/scripts/vessel-secrets-dropin.test.sh [path/to/scripts/substrate]
# Needs bash, jq, coreutils. No root, no live state: the check runs on a mktemp copy.
set -uo pipefail
SUB="${1:-$(cd "$(dirname "$0")/../.." && pwd)/scripts/substrate}"
T="$(mktemp -d)"; trap 'rm -rf "$T"' EXIT
FAILS=0
ok()  { echo "ok   - $*"; }
bad() { echo "FAIL - $*"; FAILS=$((FAILS+1)); }

DROPIN=10-secrets-out-of-reach.conf
PATHS=(/workspace/.substrate-secrets /workspace/.substrate-secrets.d)

# Mirror the image layout: units/ -> <root>/usr/lib/systemd/system (cp -a keeps symlinks).
U="$T/usr/lib/systemd/system"; mkdir -p "$U"
cp -a "$SUB/units/." "$U/"

vessel_units() { # <units-dir> -> sorted unique vessel unit names
  {
    jq -r '.vessels[] | select(.repo) | .unit | select(endswith(".service"))' "$SUB/vessels.inventory.json"
    jq -r '.vessels[].name + ".service"' "$SUB/vessels.manifest.json"
    (cd "$1" && ls -1 -- *-vessel.service 2>/dev/null)
  } | sort -u
}
exceptions() { # unit names from EXCEPTIONS (first field; '#' comments and blanks ignored)
  [ -f "$1/vessel.d/EXCEPTIONS" ] || return 0
  sed -e 's/#.*//' "$1/vessel.d/EXCEPTIONS" | awk 'NF{print $1}'
}

# check_tree <units-dir> -> prints FAIL lines, returns count of failures
check_tree() {
  local u="$1" n=0 unit canon link conf later exc
  canon="$u/vessel.d/$DROPIN"
  if [ ! -f "$canon" ]; then echo "FAIL - canonical drop-in vessel.d/$DROPIN missing"; return 1; fi
  for p in "${PATHS[@]}"; do
    grep -qxF "InaccessiblePaths=-$p" "$canon" || { echo "FAIL - canonical drop-in does not block $p"; n=$((n+1)); }
  done
  exc=" $(exceptions "$u" | tr '\n' ' ') "
  for unit in $(vessel_units "$u"); do
    case "$exc" in *" $unit "*) continue ;; esac
    link="$u/$unit.d/$DROPIN"
    if [ ! -e "$link" ]; then
      echo "FAIL - $unit: no $unit.d/$DROPIN and not in vessel.d/EXCEPTIONS"; n=$((n+1)); continue
    fi
    if [ "$(realpath -- "$link")" != "$(realpath -- "$canon")" ]; then
      echo "FAIL - $unit: $DROPIN is not the shared vessel.d copy (a fork drifts)"; n=$((n+1)); continue
    fi
    # Drop-ins merge in filename order; an empty InaccessiblePaths= later on resets the list.
    for conf in "$u/$unit.d"/*.conf; do
      [ "$(basename "$conf")" \> "$DROPIN" ] || continue
      if grep -qE '^[[:space:]]*InaccessiblePaths=[[:space:]]*$' "$conf"; then
        echo "FAIL - $unit: $(basename "$conf") resets InaccessiblePaths= after $DROPIN"; n=$((n+1))
      fi
    done
  done
  for unit in $(exceptions "$u"); do
    [ -e "$u/$unit" ] || { echo "FAIL - EXCEPTIONS names $unit, which is not a unit in units/"; n=$((n+1)); }
    [ -e "$u/$unit.d/$DROPIN" ] && { echo "FAIL - $unit is declared an exception but carries $DROPIN"; n=$((n+1)); }
  done
  return "$n"
}

# (a)-(d) on the committed tree
check_tree "$U" > "$T/out.txt"; rc=$?
if [ "$rc" -eq 0 ]; then
  ok "every vessel unit resolves vessel.d/$DROPIN or is a declared exception"
else
  cat "$T/out.txt"; FAILS=$((FAILS+rc))
fi
echo "     vessel units: $(vessel_units "$U" | tr '\n' ' ')"
echo "     exceptions:   $(exceptions "$U" | tr '\n' ' ')"

# (e) negative control: a new vessel unit with no drop-in must be caught.
cp -a "$U" "$T/neg"
printf '[Service]\nExecStart=/usr/bin/true\n' > "$T/neg/scratch-vessel.service"
check_tree "$T/neg" > "$T/neg.txt"; rc=$?
if [ "$rc" -gt 0 ] && grep -q 'scratch-vessel.service' "$T/neg.txt"; then
  ok "negative control: a scratch vessel unit without the drop-in fails the check"
else
  bad "negative control: scratch-vessel.service without the drop-in was NOT caught (rc=$rc)"
fi
# ... and a later drop-in that resets the list must be caught too.
cp -a "$U" "$T/reset"
first="$(vessel_units "$T/reset" | head -n1)"
if [ -n "$first" ] && [ -d "$T/reset/$first.d" ]; then
  printf '[Service]\nInaccessiblePaths=\n' > "$T/reset/$first.d/99-reset.conf"
  check_tree "$T/reset" > "$T/reset.txt"; rc=$?
  if [ "$rc" -gt 0 ] && grep -q 'resets InaccessiblePaths' "$T/reset.txt"; then
    ok "negative control: a later InaccessiblePaths= reset on $first fails the check"
  else
    bad "negative control: a reset drop-in on $first was NOT caught (rc=$rc)"
  fi
fi

# (f) systemd's own parser, through the same symlink shape.
if [ ! -f "$U/vessel.d/$DROPIN" ]; then
  bad "systemd-analyze check: no canonical drop-in to verify"
elif command -v systemd-analyze >/dev/null 2>&1; then
  V="$T/verify"; mkdir -p "$V/vessel.d" "$V/probe-vessel.service.d"
  cp "$U/vessel.d/$DROPIN" "$V/vessel.d/$DROPIN"
  printf '[Service]\nExecStart=/usr/bin/true\n' > "$V/probe-vessel.service"
  ln -s "../vessel.d/$DROPIN" "$V/probe-vessel.service.d/$DROPIN"
  SYSTEMD_UNIT_PATH="$V:" systemd-analyze verify --man=no probe-vessel.service > "$T/v.txt" 2>&1
  if grep -q "$DROPIN" "$T/v.txt"; then
    bad "systemd-analyze verify complains about $DROPIN:"; sed 's/^/     /' "$T/v.txt"
  else
    ok "systemd-analyze verify parses $DROPIN through the symlink without complaint"
  fi
  # positive control: verify must actually READ the symlinked drop-in, or its silence means nothing
  echo 'BogusKeyForControl=1' >> "$V/vessel.d/$DROPIN"
  SYSTEMD_UNIT_PATH="$V:" systemd-analyze verify --man=no probe-vessel.service > "$T/v2.txt" 2>&1
  if grep -q 'BogusKeyForControl' "$T/v2.txt"; then
    ok "positive control: systemd-analyze reads the drop-in through the symlink (bogus key reported)"
  else
    bad "positive control: systemd-analyze did not report a bogus key — the clean verify above proves nothing"
  fi
  # the real vessel units, through their real drop-in dirs: other verify noise (a missing
  # /root/.bun on this host, absent dependency units) is irrelevant; only drop-in complaints count.
  : > "$T/vreal.txt"
  for unit in $(vessel_units "$U"); do
    [ -e "$U/$unit" ] || continue   # manifest-only vessels have no committed unit body
    SYSTEMD_UNIT_PATH="$U:" systemd-analyze verify --man=no "$unit" 2>&1 | grep -F "$DROPIN" >> "$T/vreal.txt"
  done
  if [ -s "$T/vreal.txt" ]; then
    bad "systemd-analyze verify complains about $DROPIN on a real vessel unit:"; sed 's/^/     /' "$T/vreal.txt"
  else
    ok "systemd-analyze verify: no vessel unit reports a problem with $DROPIN"
  fi
else
  echo "skip - systemd-analyze not installed; the parser check did not run"
fi

[ "$FAILS" -eq 0 ] && { echo "PASS"; exit 0; }
echo "$FAILS failure(s)"; exit 1
