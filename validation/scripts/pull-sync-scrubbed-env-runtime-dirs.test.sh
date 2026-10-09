#!/usr/bin/env bash
# pull-sync-scrubbed-env-runtime-dirs.test.sh: scrubbed_env (scripts/substrate/substrate-pull-sync.sh) runs every
# candidate suite and the clone dependency install under env -i, which drops every runtime-directory override. Vessel
# code then falls back to its compiled-in LIVE default, read when a module is imported:
#   IAS_TRACE_SPOOL_DIR   ?? /workspace/trace-spool    ias-executor-ts's trace sink (importing goal-host's index
#                                                      creates the spool directory)
#   SUBSTRATE_STATE_DIR   ?? /workspace/state          goal-host's verifier-recipe ledger
#   LIGHT_DISPATCH_WORKDIR ?? /workspace/light-dispatch light-dispatch-vessel's work directory root
# so a suite would write into the live /workspace. The scrubbed environment must point each under the throwaway root
# it is given, as it already does for MITOSIS_RUNTIME_DIR and PARKED_LANDINGS_DIR.
#
#   pull-sync-scrubbed-env-runtime-dirs.test.sh [path/to/substrate-pull-sync.sh]
#
# Must-fail: each variable is set, lies under the throwaway root, wins over a live value the caller exported, and the
# vessel-side default expression (${VAR:-/workspace/...}) resolves under the root. Control: WORKSPACE_ROOT is still the
# throwaway root and MITOSIS_RUNTIME_DIR is unchanged. Nothing is written outside the temp dir.
set -uo pipefail
SCRIPT="${1:-$(cd "$(dirname "$0")/../.." && pwd)/scripts/substrate/substrate-pull-sync.sh}"
T="$(mktemp -d "${TMPDIR:-/tmp}/ps-scrub-dirs.XXXXXX")"; trap 'rm -rf "$T"' EXIT
FAILS=0; ok() { echo "ok   - $*"; }; bad() { echo "FAIL - $*"; FAILS=$((FAILS+1)); }

sed -n '/^scrubbed_env() {/,/^}/p' "$SCRIPT" > "$T/fn.sh"
if [ -s "$T/fn.sh" ] && bash -n "$T/fn.sh" 2>/dev/null; then ok "scrubbed_env extracts and parses"; else bad "scrubbed_env extracts and parses"; fi
# shellcheck source=/dev/null
. "$T/fn.sh"

R="$T/root"; mkdir -p "$R"
# The caller's environment carries LIVE values (as the unit's environment could).
export IAS_TRACE_SPOOL_DIR=/workspace/trace-spool SUBSTRATE_STATE_DIR=/workspace/state LIGHT_DISPATCH_WORKDIR=/workspace/light-dispatch
scrubbed_env "$R" env > "$T/plain.out" 2>&1
unset IAS_TRACE_SPOOL_DIR SUBSTRATE_STATE_DIR LIGHT_DISPATCH_WORKDIR
# The defaults exactly as vessel code writes them, resolved inside the scrubbed environment.
scrubbed_env "$R" sh -c 'echo "IAS=${IAS_TRACE_SPOOL_DIR:-/workspace/trace-spool}"; echo "STATE=${SUBSTRATE_STATE_DIR:-/workspace/state}"; echo "LD=${LIGHT_DISPATCH_WORKDIR:-/workspace/light-dispatch}"' > "$T/resolved.out" 2>&1
val() { sed -n "s/^$1=//p" "$2" | head -1; }

# ── must-fail ────────────────────────────────────────────────────────────────
for k in IAS_TRACE_SPOOL_DIR SUBSTRATE_STATE_DIR LIGHT_DISPATCH_WORKDIR; do
  v="$(val "$k" "$T/plain.out")"
  case "$v" in "$R"/*) ok "$k is under the throwaway root ($v)";; *) bad "$k is under the throwaway root (got '${v:-<unset>}')";; esac
done
for k in IAS STATE LD; do
  v="$(val "$k" "$T/resolved.out")"
  case "$v" in /workspace|/workspace/*) bad "the vessel default for $k never resolves into the live /workspace (got '$v')";;
    "$R"/*) ok "the vessel default for $k resolves under the throwaway root";;
    *) bad "the vessel default for $k resolves under the throwaway root (got '${v:-<empty>}')";; esac
done

# ── controls ─────────────────────────────────────────────────────────────────
[ "$(val WORKSPACE_ROOT "$T/plain.out")" = "$R" ] && ok "WORKSPACE_ROOT is the throwaway root" || bad "WORKSPACE_ROOT is the throwaway root (got '$(val WORKSPACE_ROOT "$T/plain.out")')"
[ "$(val MITOSIS_RUNTIME_DIR "$T/plain.out")" = "$R/runtime" ] && ok "MITOSIS_RUNTIME_DIR is unchanged ($R/runtime)" || bad "MITOSIS_RUNTIME_DIR is unchanged (got '$(val MITOSIS_RUNTIME_DIR "$T/plain.out")')"

echo "---"; [ "$FAILS" -eq 0 ] && { echo "PASS"; exit 0; } || { echo "$FAILS failing"; exit 1; }
