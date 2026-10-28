#!/usr/bin/env bash
# The federation transport's lib-refresh drop-in refreshes the library copy the unit actually LOADS, and only by a
# verified, staged copy.
#
# units/federation-transport-vessel.service.d/lib-refresh.conf runs, as ExecStartPre= on every start, a copy of
# /vessels/libp2p-federation-transport/src into the package bun resolves. The unit runs from its WorkingDirectory=
# (the image-baked tree), so that is the copy that matters. This test runs the drop-in's own ExecStartPre command
# line, taken from the file, against a scratch root: every absolute /vessels/ and /workspace/ path in it is rewritten
# under the root, and it runs with the unit's WorkingDirectory= (read from the unit file) mapped under the root as its
# cwd, as systemd runs it.
#
#   (a) the package under the unit's WorkingDirectory= equals the source after a start
#   (b) the libp2p submodule worktree of the workspace clone is not written (a unit's output never lands in a git
#       worktree)
#   (c) a run leaves no staging directory behind, and removes one a killed run left
#   (d) a missing source, and an empty one, leave the target as it was and do not fail the start
#   (e) a copy that fails part-way leaves every target as it was: no truncated or half-new file
#   (f) a copy that exits 0 but differs from the source is not moved in
#   (g) the command line carries nothing systemd substitutes before sh runs it (a brace-form variable, a percent
#       sign) and no backslash, so what this test runs is what systemd runs
#
# usage: validation/scripts/lib-refresh-dropin.test.sh [path/to/scripts/substrate]
# Needs bash, coreutils, diffutils, findutils. No root, no systemd, no live state: everything is under a mktemp dir.
set -uo pipefail
SUB="${1:-$(cd "$(dirname "$0")/../.." && pwd)/scripts/substrate}"
CONF="$SUB/units/federation-transport-vessel.service.d/lib-refresh.conf"
UNIT="$SUB/units/federation-transport-vessel.service"
T="$(mktemp -d "${TMPDIR:-/tmp}/lib-refresh-test.XXXXXX")"; trap 'rm -rf "$T"' EXIT
FAILS=0
ok()  { echo "ok   - $*"; }
bad() { echo "FAIL - $*"; FAILS=$((FAILS+1)); }
done_tests() { echo; [ "$FAILS" = 0 ] && { echo "PASS"; exit 0; } || { echo "$FAILS FAILED"; exit 1; }; }

[ -f "$CONF" ] || { bad "the drop-in exists at $CONF"; done_tests; }
[ -f "$UNIT" ] || { bad "the unit exists at $UNIT"; done_tests; }
line="$(grep -E '^[[:space:]]*ExecStartPre[[:space:]]*=' "$CONF" | head -1)"
[ -n "$line" ] || { bad "the drop-in declares an ExecStartPre="; done_tests; }
cmdline="${line#*=}"; cmdline="${cmdline#"${cmdline%%[![:space:]]*}"}"; cmdline="${cmdline#[-@:+!]}"
case "$cmdline" in "/bin/sh -c '"*"'") ;; *) bad "the ExecStartPre= is /bin/sh -c '<script>' (got: ${cmdline:0:60})"; done_tests ;; esac
script="${cmdline#"/bin/sh -c '"}"; script="${script%"'"}"
WD="$(sed -n 's/^[[:space:]]*WorkingDirectory[[:space:]]*=[[:space:]]*//p' "$UNIT" | tail -1)"
[ -n "$WD" ] || { bad "the unit sets WorkingDirectory="; done_tests; }

# (g) systemd expands ${VAR} anywhere and % specifiers, and unescapes backslashes, before sh sees the line.
if printf '%s' "$script" | grep -qE '\$\{|%|\\'; then bad "(g) the command line carries a brace-form variable, a percent sign or a backslash systemd would rewrite"
else ok "(g) the command line carries nothing systemd rewrites before sh runs it"; fi

REALCP="$(command -v cp)"
R="$T/root"
PKG="node_modules/@avigopal/libp2p-federation-transport"
LOADED="$R$WD/$PKG/src"
CLONE_NM="$R/workspace/git/super-repo/scripts/substrate/federation-relay/$PKG/src"
SUBMOD="$R/workspace/git/super-repo/repos/libp2p-federation-transport/src"
SRC="$R/vessels/libp2p-federation-transport/src"
TARGETS=("$LOADED" "$CLONE_NM" "$SUBMOD")

fill() { # dir tag -> a small package src: two files and a nested one, each naming tag
  mkdir -p "$1/sub"
  printf 'export const v = "%s-index";\n%0200d\n' "$2" 0 > "$1/index.ts"
  printf 'export const s = "%s-sidecar";\n' "$2" > "$1/sidecar.ts"
  printf '%s-nested\n' "$2" > "$1/sub/nested.ts"
}
setup() { # -> a fresh root: every target holds "old", the source holds "new"
  rm -rf "$R"; mkdir -p "$R/bin"
  local d; for d in "${TARGETS[@]}"; do fill "$d" old; done
  fill "$SRC" new
  fill "$T/old" old 2>/dev/null; fill "$T/new" new 2>/dev/null
}
run_pre() { # -> runs the drop-in's script as systemd would (cwd = WorkingDirectory=), under the scratch root
  local s="$script"
  s="${s//\/vessels\//$R/vessels/}"; s="${s//\/workspace\//$R/workspace/}"
  ( cd "$R$WD" && PATH="$R/bin:$PATH" sh -c "$s" ) > "$T/out" 2>&1
}
same() { diff -r "$1" "$2" >/dev/null 2>&1; }
stage_left() { find "$R" -name '.src-refresh.*' 2>/dev/null | grep -q .; }
all_old() { local d; for d in "${TARGETS[@]}"; do same "$d" "$T/old" || return 1; done; }

# (a) (b) (c): a normal start.
setup
mkdir -p "$R$WD/$PKG/.src-refresh.killed"; echo partial > "$R$WD/$PKG/.src-refresh.killed/index.ts"
run_pre; rc=$?
[ "$rc" = 0 ] && ok "a start with a source exits 0" || bad "a start with a source exits 0 (exit $rc: $(tail -n2 "$T/out"))"
same "$LOADED" "$T/new" && ok "(a) the package under the unit's WorkingDirectory= ($WD) equals the source after a start" \
  || bad "(a) the package under the unit's WorkingDirectory= ($WD) equals the source after a start (it still loads the old copy)"
same "$SUBMOD" "$T/old" && ok "(b) the libp2p submodule worktree of the workspace clone is not written" \
  || bad "(b) the libp2p submodule worktree of the workspace clone is not written (a start copied into it)"
stage_left && bad "(c) no staging directory is left behind, and a killed run's is removed ($(find "$R" -name '.src-refresh.*' | head -2 | tr '\n' ' '))" \
  || ok "(c) no staging directory is left behind, and a killed run's is removed"

# (d) a missing source, then an empty one.
setup; rm -rf "$SRC"; run_pre; rc=$?
{ [ "$rc" = 0 ] && all_old && ! stage_left; } && ok "(d) a missing source leaves every target as it was and exits 0" \
  || bad "(d) a missing source leaves every target as it was and exits 0 (exit $rc)"
setup; rm -rf "$SRC"; mkdir -p "$SRC"; run_pre; rc=$?
{ [ "$rc" = 0 ] && all_old && ! stage_left; } && ok "(d) an empty source leaves every target as it was and exits 0" \
  || bad "(d) an empty source leaves every target as it was and exits 0 (exit $rc)"

# (e) cp fails part-way: it writes half of the first file into its destination, then exits 1.
setup
cat > "$R/bin/cp" <<EOF
#!/bin/sh
for a; do d="\$a"; done
mkdir -p "\$d"; head -c 20 "$SRC/index.ts" > "\$d/index.ts"; exit 1
EOF
chmod +x "$R/bin/cp"
run_pre; rc=$?
{ [ "$rc" = 0 ] && all_old && ! stage_left; } && ok "(e) a copy that fails part-way leaves every target as it was (no truncated file) and exits 0" \
  || bad "(e) a copy that fails part-way leaves every target as it was (no truncated file) and exits 0 (exit $rc; loaded index.ts: $(head -c 40 "$LOADED/index.ts" | head -1))"

# (f) cp exits 0 but its copy differs from the source.
setup
cat > "$R/bin/cp" <<EOF
#!/bin/sh
"$REALCP" "\$@" || exit \$?
for a; do d="\$a"; done
echo corrupted > "\$d/sidecar.ts"; exit 0
EOF
chmod +x "$R/bin/cp"
run_pre; rc=$?
if [ "$rc" = 0 ] && ! stage_left && ! grep -rqs corrupted "${TARGETS[@]}"; then ok "(f) a copy that differs from the source is not moved into any target"
else bad "(f) a copy that differs from the source is not moved into any target (exit $rc; corrupted in: $(grep -rls corrupted "${TARGETS[@]}" | head -2 | tr '\n' ' '))"; fi

done_tests
