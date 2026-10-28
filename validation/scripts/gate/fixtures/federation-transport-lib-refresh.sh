#!/usr/bin/env bash
# kind: known-valid
# The candidate's federation-transport lib-refresh drop-in refreshes the library copy the unit LOADS: after its
# ExecStartPre= runs, the package under the unit's WorkingDirectory= is byte-identical to the
# /vessels/libp2p-federation-transport/src source, and a missing or empty source changes nothing and does not fail the
# start. Run by shadow-eval.sh with CANDIDATE_DIR (see its header).
#
# WHY. The transport runs from its WorkingDirectory= (the image-baked tree) and bun resolves the package from that
# tree's node_modules. A drop-in that copies anywhere else (it once copied only into the workspace clone and the
# libp2p submodule worktree) restarts the unit on the image's old copy while reading as a success, so no lib fix goes
# live. unit-verify.sh judges only that the drop-in parses; this judges what its command does.
#
# HOW (deterministic; no systemd, no root). The drop-in's own ExecStartPre= line is taken from the candidate, its
# absolute /vessels/ and /workspace/ paths are rewritten under a scratch root, and it runs under sh with the unit's
# WorkingDirectory= (read from the candidate's unit file) mapped under that root as its cwd, as systemd runs it. The
# line must carry nothing systemd rewrites before sh sees it (a brace-form variable, a percent sign, a backslash):
# otherwise what runs here is not what runs on a node.
# A REFUSAL NAMES WHAT FAILED: `FAIL - <why>`.
set -u
U="$CANDIDATE_DIR/scripts/substrate/units"
[ -d "$U" ] || { echo "ok - the candidate carries no units/ directory"; exit 0; }
UNIT="$U/federation-transport-vessel.service"; CONF="$U/federation-transport-vessel.service.d/lib-refresh.conf"
[ -f "$UNIT" ] || { echo "ok - the candidate carries no federation-transport-vessel.service"; exit 0; }
[ -f "$CONF" ] || { echo "FAIL - federation-transport-vessel.service has no lib-refresh.conf drop-in: nothing refreshes the lib it loads"; exit 1; }
W="$(mktemp -d "${TMPDIR:-/tmp}/lib-refresh-fx.XXXXXX")" || { echo "FAIL - mktemp"; exit 1; }
trap 'rm -rf "$W"' EXIT

line="$(grep -E '^[[:space:]]*ExecStartPre[[:space:]]*=' "$CONF" | head -1)"
cmd="${line#*=}"; cmd="${cmd#"${cmd%%[![:space:]]*}"}"; cmd="${cmd#[-@:+!]}"
case "$cmd" in "/bin/sh -c '"*"'") ;; *) echo "FAIL - lib-refresh.conf's ExecStartPre= is not /bin/sh -c '<script>' (got: ${cmd:0:60})"; exit 1 ;; esac
script="${cmd#"/bin/sh -c '"}"; script="${script%"'"}"
if printf '%s' "$script" | grep -qE '\$\{|%|\\'; then
  echo "FAIL - lib-refresh.conf's ExecStartPre= carries a brace-form variable, a percent sign or a backslash, which systemd rewrites before sh runs it"; exit 1
fi
WD="$(sed -n 's/^[[:space:]]*WorkingDirectory[[:space:]]*=[[:space:]]*//p' "$UNIT" | tail -1)"
[ -n "$WD" ] || { echo "FAIL - federation-transport-vessel.service sets no WorkingDirectory="; exit 1; }

R="$W/root"; SRC="$R/vessels/libp2p-federation-transport/src"; LOADED="$R$WD/node_modules/@avigopal/libp2p-federation-transport/src"
fill() { mkdir -p "$1/sub"; printf 'export const v = "%s";\n' "$2" > "$1/index.ts"; printf '%s\n' "$2" > "$1/sub/nested.ts"; }
setup() { rm -rf "$R" "$W/old" "$W/new"; fill "$LOADED" old; fill "$SRC" new; fill "$W/old" old; fill "$W/new" new; }
run() {
  local s="$script"; s="${s//\/vessels\//$R/vessels/}"; s="${s//\/workspace\//$R/workspace/}"
  ( cd "$R$WD" && sh -c "$s" ) > "$W/out" 2>&1
}
fails=0
setup; run; rc=$?
[ "$rc" = 0 ] || { echo "FAIL - the ExecStartPre= exits $rc with a source present: $(tail -n1 "$W/out")"; fails=$((fails + 1)); }
diff -r "$LOADED" "$W/new" >/dev/null 2>&1 \
  || { echo "FAIL - after the ExecStartPre=, the package under WorkingDirectory=$WD is not byte-identical to the source (the unit would load the old lib)"; fails=$((fails + 1)); }
find "$R" -name '.src-refresh.*' | grep -q . && { echo "FAIL - the ExecStartPre= leaves a staging directory behind"; fails=$((fails + 1)); }
setup; rm -rf "$SRC"; run; rc=$?
{ [ "$rc" = 0 ] && diff -r "$LOADED" "$W/old" >/dev/null 2>&1; } \
  || { echo "FAIL - with no source, the ExecStartPre= changes the loaded copy or fails the start (exit $rc)"; fails=$((fails + 1)); }
setup; rm -rf "$SRC"; mkdir -p "$SRC"; run; rc=$?
{ [ "$rc" = 0 ] && diff -r "$LOADED" "$W/old" >/dev/null 2>&1; } \
  || { echo "FAIL - with an empty source, the ExecStartPre= changes the loaded copy or fails the start (exit $rc)"; fails=$((fails + 1)); }
[ "$fails" = 0 ] || exit 1
echo "ok - lib-refresh.conf refreshes the lib under the unit's WorkingDirectory= ($WD) and leaves it alone without a source"
exit 0
