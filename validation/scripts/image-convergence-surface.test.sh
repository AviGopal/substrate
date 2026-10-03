#!/usr/bin/env bash
# image-convergence-surface.test.sh: the image-files manifest equals the Dockerfile COPY set (pre-commit glue test).
# The companion image-convergence-surface.check.sh judges the installer side: every baked file has an in-place installer.
#
# The boot image only needs to be good enough to boot and run the update gate. Everything it copies
# from scripts/ (and the manifest) should then converge in place from the node's committed glue tree,
# the way vessel code already does, so a landed fix goes live without anyone recreating the container.
# The Dockerfile's COPY set and pull-sync's install lists are both hand-kept, and nothing compares them.
# This test does:
#   - expand every Dockerfile.substrate COPY whose source is in the super-repo into destination files;
#   - collect every destination substrate-pull-sync.sh installs to (its "src:dst[:mode]" tuples, its
#     self-converge pairs, the unit dir, the gap-tracked-red lib, the gate runner, itself, the
#     active-scripts seed);
#   - FAIL once (one static label) when any baked destination has no installer, listing each one.
# The baked super-repo tree that the federation transport and relay run from
# (/usr/local/share/substrate/super-repo/scripts/substrate) is listed as one counted entry: whether it
# should converge in place is a separate decision (it needs a behavioural gate first).
set -uo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$HERE/../.." && pwd)"
. "$HERE/lib/gate-test-lib.sh"
DF="$ROOT/Dockerfile.substrate"; PS="$ROOT/scripts/substrate/substrate-pull-sync.sh"
[ -f "$DF" ] && [ -f "$PS" ] || { bad "inputs present (Dockerfile.substrate, substrate-pull-sync.sh)"; done_tests; }
BIN=/usr/local/bin; SHARE=/usr/local/share/substrate; UNITS=/usr/lib/systemd/system; LIBEXEC=/usr/local/libexec/substrate
T="$(mktemp -d)"; trap 'rm -rf "$T"' EXIT
# The glue hook runs this on a checkout-index export with no .git; a work tree lists tracked files only.
if git -C "$ROOT" rev-parse --is-inside-work-tree >/dev/null 2>&1 && [ "$(git -C "$ROOT" rev-parse --show-toplevel 2>/dev/null)" = "$ROOT" ]; then
  lsf() { (cd "$ROOT/$1" && git ls-files . 2>/dev/null); }
  fmode() { local m; m=$(cd "$ROOT" && git ls-files -s -- "$1" | awk '{print $1}' | head -1); [ "$m" = 100755 ] && echo 0755 || echo 0644; }
else
  lsf() { (cd "$ROOT/$1" && find . \( -type f -o -type l \) | sed 's#^\./##' | sort); }
  fmode() { [ -x "$ROOT/$1" ] && echo 0755 || echo 0644; }
fi

# 1. Baked destinations (one per file). COPY lines from another stage (--from) are not super-repo files.
grep -E '^\s*COPY ' "$DF" | grep -v -- '--from' | sed -E 's/\s+/ /g' | awk '{print $NF"\t"$2}' \
  | grep -E $'\t(scripts/|docker-compose\\.yml)' | while IFS=$'\t' read -r dst src; do
    if [ -d "$ROOT/${src%/}" ]; then
      lsf "${src%/}" | while read -r f; do printf '%s\t%s\n' "${src%/}/$f" "${dst%/}/$f"; done
    elif [[ "$src" == *'*'* ]]; then
      for f in $ROOT/$src; do [ -f "$f" ] && printf '%s\t%s\n' "${f#$ROOT/}" "${dst%/}/$(basename "$f")"; done
    else
      case "$dst" in */) printf '%s\t%s\n' "$src" "${dst%/}/$(basename "$src")" ;; *) printf '%s\t%s\n' "$src" "$dst" ;; esac
    fi
  done | sort -u -t $'\t' -k2,2 > "$T/pairs"
# A build-time temp file (copied, compared and deleted inside one RUN) is not baked.
grep -q 'rm -f /tmp/docker-compose.source.yml' "$DF" && sed -i '\#\t/tmp/docker-compose.source.yml$#d' "$T/pairs"
cut -f2 "$T/pairs" > "$T/baked"
tierb_prefix="$SHARE/super-repo/scripts/substrate/"
# The manifest form: src<TAB>dst<TAB>mode<TAB>tier (mode from git; tier A = tooling, B = federation runtime tree).
manifest_lines() {
  while IFS=$'\t' read -r src dst; do
    mode=$(fmode "$src")
    case "$dst" in "$tierb_prefix"*) tier=B ;; *) tier=A ;; esac
    printf '%s\t%s\t%s\t%s\n' "$src" "$dst" "$mode" "$tier"
  done < "$T/pairs"
}
if [ "${1:-}" = --print-manifest ]; then manifest_lines; exit 0; fi

# 2. Installed destinations.
{
  # "src:dst[:mode]" tuples and self-converge pairs ("a.sh:name" means $BIN_DIR/name)
  grep -o -E '"[A-Za-z0-9_.-]+\.(sh|ts|json):[^":]+(:[0-7]{4})?"' "$PS" | tr -d '"' | while IFS=: read -r _ d _; do
    d="${d//\$BIN_DIR/$BIN}"; d="${d//\$SHARE_DIR/$SHARE}"; d="${d//\$\{SHARE_DIR\}/$SHARE}"
    case "$d" in /*) echo "$d" ;; *) echo "$BIN/$d" ;; esac
  done
  echo "$BIN/substrate-pull-sync"
  grep -q '_se_lib_to="\$SHARE_DIR/lib/gap-tracked-red.sh"' "$PS" && echo "$SHARE/lib/gap-tracked-red.sh"
  grep -q 'GATE_LIBEXEC_DIR/.gate-runner.new' "$PS" && echo "$LIBEXEC/gate-runner"
  # units converge from scripts/substrate/units into $UNIT_DIR (whole tree)
  lsf scripts/substrate/units | sed "s#^#$UNITS/#"
  # active-scripts: the image copy is the boot seed of /workspace/active-scripts, which pull-sync refreshes
  grep -q 'cp -f "\$_sg_src"/\*.ts /workspace/active-scripts/' "$PS" && grep "^$SHARE/active-scripts/" "$T/baked"
  # the fleet definition converges into the volume (FLEET_DIR); the image copy is its fallback
  if grep -q '_cf_dir="\${FLEET_DIR:-/workspace/substrate/fleet}"' "$PS"; then
    echo "$SHARE/vessels.inventory.json"; echo "$SHARE/vessels.manifest.json"
  fi
} | sort -u > "$T/installed"

# 3. The committed manifest must equal the Dockerfile's COPY set (both directions), so they cannot drift.
MF="$ROOT/scripts/substrate/image-files.manifest"
if [ -f "$MF" ]; then
  if diff <(grep -v '^#' "$MF" | grep -v '^$' | sort) <(manifest_lines | sort) > "$T/mdiff"; then
    ok "the image-files manifest equals the Dockerfile COPY set"
  else
    head -20 "$T/mdiff" | sed 's/^/  manifest drift: /'; bad "the image-files manifest equals the Dockerfile COPY set"
  fi
else bad "the image-files manifest equals the Dockerfile COPY set"; fi

# 4. Compare with what pull-sync installs.
comm -23 "$T/baked" "$T/installed" > "$T/missing"
tierb=$(grep -c "^$tierb_prefix" "$T/missing")
grep -v "^$tierb_prefix" "$T/missing" > "$T/tiera"
echo "baked from the super-repo: $(wc -l < "$T/baked") files; with an installer: $(comm -12 "$T/baked" "$T/installed" | wc -l)"
while read -r d; do echo "  never converged: $d"; done < "$T/tiera"
echo "  never converged (federation runtime tree, separate decision): $tierb files under $tierb_prefix"
# The installer verdict is judged by image-convergence-surface.check.sh (not a pre-commit glue test, so its
# intended red cannot block commits); here it is reported only.
if [ "${IMAGE_CONVERGENCE_JUDGE_INSTALLERS:-0}" = 1 ]; then
  if [ -s "$T/tiera" ]; then bad "every baked script destination has an in-place installer"
  else ok "every baked script destination has an in-place installer"; fi
else
  echo "  (installer verdict: judged by validation/scripts/image-convergence-surface.check.sh; $(wc -l < "$T/tiera") tier A paths without an installer)"
fi
done_tests
