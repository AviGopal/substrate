#!/usr/bin/env bash
# pull-sync-scrubbed-env-runtime-root.check.sh: scrubbed_env (scripts/substrate/substrate-pull-sync.sh) runs every
# candidate suite, the protected-alone runs, the failing-test generator and the clone dependency install/build under
# env -i. env -i drops any runtime-root override, so a vessel test that resolves its runtime root falls back to the
# compiled-in default and writes into the LIVE tree: development-vessel's shape-vocabulary.ts freezes
# RUNTIME_ROOT = MITOSIS_RUNTIME_DIR ?? "/vessels" at import, and feature-compose reads
# PARKED_LANDINGS_DIR ?? "/workspace/parked-landings". The scrubbed environment must point both under the
# throwaway root it is given.
#
#   pull-sync-scrubbed-env-runtime-root.check.sh [path/to/substrate-pull-sync.sh]
#
# Not a *.test.sh: it was committed red (check first), before the fix, and a red glue test blocks the commit.
# pull-sync-testgate-protected-alone.test.sh runs it once green, so the cases stay under the pre-commit glue gate.
#
# Must-fail: MITOSIS_RUNTIME_DIR and PARKED_LANDINGS_DIR are set, lie under the throwaway root (never /vessels or
# /workspace), win over a live value exported by the caller, and the runtime directory exists before the command runs.
# Controls: PATH, HOME, NODE_ENV, TZ and WORKSPACE_ROOT are what they were; the key set is exactly those plus the two
# overrides, so an arbitrary variable exported by the caller never reaches the command (env -i semantics stay).
set -uo pipefail
SCRIPT="${1:-$(cd "$(dirname "$0")/../.." && pwd)/scripts/substrate/substrate-pull-sync.sh}"
T="$(mktemp -d "${TMPDIR:-/tmp}/ps-scrub-root.XXXXXX")"; trap 'rm -rf "$T"' EXIT
FAILS=0; ok() { echo "ok   - $*"; }; bad() { echo "FAIL - $*"; FAILS=$((FAILS+1)); }

sed -n '/^scrubbed_env() {/,/^}/p' "$SCRIPT" > "$T/fn.sh"
if [ -s "$T/fn.sh" ] && bash -n "$T/fn.sh" 2>/dev/null; then ok "scrubbed_env extracts and parses"; else bad "scrubbed_env extracts and parses"; fi
# shellcheck source=/dev/null
. "$T/fn.sh"

R="$T/root"; mkdir -p "$R"
# The caller's environment carries an arbitrary variable and LIVE values for both overrides (as the unit's env could).
export LEAKY_CALLER_VAR=leaked MITOSIS_RUNTIME_DIR=/vessels PARKED_LANDINGS_DIR=/workspace/parked-landings
# Probe 1 (sh -c): whether the runtime directory exists when the command starts.
scrubbed_env "$R" sh -c 'env; if [ -d "$MITOSIS_RUNTIME_DIR" ]; then echo "__RT_DIR=present"; else echo "__RT_DIR=absent"; fi' > "$T/env.out" 2>&1
unset LEAKY_CALLER_VAR MITOSIS_RUNTIME_DIR PARKED_LANDINGS_DIR
# The key set comes from a plain env probe: sh -c adds PWD (and may add SHLVL/_) of its own.
export LEAKY_CALLER_VAR=leaked MITOSIS_RUNTIME_DIR=/vessels PARKED_LANDINGS_DIR=/workspace/parked-landings
scrubbed_env "$R" env > "$T/plain.out" 2>&1
unset LEAKY_CALLER_VAR MITOSIS_RUNTIME_DIR PARKED_LANDINGS_DIR
val() { sed -n "s/^$1=//p" "$T/plain.out" | head -1; }

# ── must-fail ────────────────────────────────────────────────────────────────
rt="$(val MITOSIS_RUNTIME_DIR)"
case "$rt" in "$R"/*) ok "MITOSIS_RUNTIME_DIR is under the throwaway root ($rt)";; *) bad "MITOSIS_RUNTIME_DIR is under the throwaway root (got '${rt:-<unset>}')";; esac
# Unset is the live tree too: the vessel then falls back to its default, /vessels.
case "$rt" in ""|/vessels|/vessels/*) bad "MITOSIS_RUNTIME_DIR never resolves to the live /vessels tree (got '${rt:-<unset>, so /vessels}')";; *) ok "MITOSIS_RUNTIME_DIR never resolves to the live /vessels tree";; esac
pl="$(val PARKED_LANDINGS_DIR)"
case "$pl" in "$R"/*) ok "PARKED_LANDINGS_DIR is under the throwaway root ($pl)";; *) bad "PARKED_LANDINGS_DIR is under the throwaway root (got '${pl:-<unset>}')";; esac
grep -qx '__RT_DIR=present' "$T/env.out" && ok "the runtime directory exists when the command starts" \
  || bad "the runtime directory exists when the command starts ($(grep '^__RT_DIR=' "$T/env.out" || echo none))"

# ── controls ─────────────────────────────────────────────────────────────────
[ "$(val PATH)" = "$PATH" ] && ok "PATH is the caller's PATH" || bad "PATH is the caller's PATH"
[ "$(val HOME)" = "${HOME:-/root}" ] && ok "HOME is unchanged" || bad "HOME is unchanged (got '$(val HOME)')"
[ "$(val NODE_ENV)" = test ] && ok "NODE_ENV=test" || bad "NODE_ENV=test (got '$(val NODE_ENV)')"
[ "$(val TZ)" = UTC ] && ok "TZ=UTC" || bad "TZ=UTC (got '$(val TZ)')"
[ "$(val WORKSPACE_ROOT)" = "$R" ] && ok "WORKSPACE_ROOT is the throwaway root" || bad "WORKSPACE_ROOT is the throwaway root (got '$(val WORKSPACE_ROOT)')"
grep -q '^LEAKY_CALLER_VAR=' "$T/plain.out" && bad "a variable the caller exported does not reach the command (env -i)" \
  || ok "a variable the caller exported does not reach the command (env -i)"
keys="$(sed -n 's/^\([A-Za-z_][A-Za-z0-9_]*\)=.*/\1/p' "$T/plain.out" | sort | tr '\n' ' ' | sed 's/ $//')"
want="HOME MITOSIS_RUNTIME_DIR NODE_ENV PARKED_LANDINGS_DIR PATH TZ WORKSPACE_ROOT"
[ "$keys" = "$want" ] && ok "the environment is exactly: $want" || bad "the environment is exactly: $want (got: $keys)"

echo "---"; [ "$FAILS" -eq 0 ] && { echo "PASS"; exit 0; } || { echo "$FAILS failing"; exit 1; }
