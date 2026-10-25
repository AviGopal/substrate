#!/usr/bin/env bash
# pull-sync's test-gate runs (T1/T2) execute in the vessel's clone dir, where its stored baselines were recorded
# (scripts/substrate/substrate-pull-sync.sh, run_suite in the "3-pre. TEST GATE" slice).
#
# Observed: run_suite was moved into a throwaway worktree, <tmp>/pullsync-gate-XXXXXX/<vessel>. In the clone layout
# a vessel's sibling repos sit beside it and a test may read ../<sibling>/... (a gate one vessel shares with
# another); in the worktree <wt>/.. was an empty temp dir, so that test failed in every run. Every stored baseline
# was recorded in the clone layout, so the candidate was not measured like-for-like and every candidate of the
# vessel carried an extra (unnamed) failure.
#
#   (1) MUST-FAIL: every T1/T2 run executes in the clone dir itself, and a suite reading ../<sibling>/gate.ts sees
#       the sibling clone there; a HEAD adding nothing converges
#   (2) CONTROL: a vessel with no sibling reads: a HEAD adding nothing converges; a HEAD adding a failure is refused
#
# Harness: pull-sync-testgate-last-converged-reference.test.sh's (a deterministic `bun` stub: a tree's failing
# tests are the lines of its fails.txt, read from the directory the suite runs in).
#
# usage: validation/scripts/pull-sync-testgate-runs-in-the-vessel-clone.test.sh [path/to/substrate-pull-sync.sh]
set -uo pipefail
SCRIPT="${1:-$(cd "$(dirname "$0")/../.." && pwd)/scripts/substrate/substrate-pull-sync.sh}"
T="$(mktemp -d)"; trap 'rm -rf "$T"' EXIT
FAILS=0
ok()  { echo "ok   - $*"; }
bad() { echo "FAIL - $*"; FAILS=$((FAILS+1)); }

{
  sed -n '/^scrubbed_env() {/,/^}/p' "$SCRIPT"
  sed -n '/^unresolved_modules() {/,/^}/p' "$SCRIPT"
  sed -n '/^test_only_range() {/,/^}/p' "$SCRIPT"
  sed -n '/^pass_order() {/,/^}/p' "$SCRIPT"
  echo 'run_tick() {'
  echo 'mapfile -t PASS_ORDER < <(pass_order)'
  echo 'printf "%s\n" "${PASS_ORDER[@]}" | xargs -n1 basename > "$T/order.txt"'
  echo 'for d in "${PASS_ORDER[@]}"; do'
  echo '  v="$(basename "$d")"; HEAD="$(git -C "$d" rev-parse HEAD)"'
  echo '  [ "$(cat "$LAST_GOOD_DIR/$v" 2>/dev/null)" = "$HEAD" ] && continue'
  awk '/^  # 3-pre\. TEST GATE/{on=1} on{print} on && /^  # The owed quiesce/{exit}' "$SCRIPT"
  echo '  echo "CONVERGED $v" >> "$CALLS"; echo "$HEAD" > "$LAST_GOOD_DIR/$v"'
  echo 'done'
  echo '}'
} > "$T/fns.sh"
grep -q 'testgate-refusals' "$T/fns.sh" || { echo "FAIL - could not extract the test-gate slice"; exit 1; }
# shellcheck disable=SC1090
source "$T/fns.sh"

CALLS="$T/calls.txt"; LOG="$T/log.txt"
log() { echo "$*" >> "$LOG"; }
emit_gap() { echo "GAP $1" >> "$CALLS"; }
tracked_fail_names() { :; }
ensure_clone_deps() { return 0; }
ensure_clone_nested_deps() { CD_NESTED=""; return 0; }
clone_file_deps() { :; }
file_dep_identity() { echo x; }
tuning_param() { local _k="TP_$(printf '%s' "$1" | tr '.-' '__')"; TP_VALUE="${!_k:-$2}"; }

mkdir -p "$T/bin"
# bun test: a tree with reads-sibling names a sibling; its suite reads ../<sibling>/gate.ts from where it runs.
cat > "$T/bin/bun" <<'STUB'
#!/usr/bin/env bash
[ "$1" = --version ] && { echo 1.0.0; exit 0; }
[ "$1" = test ] || exit 0
echo '(pass) a > works'
n=0; while IFS= read -r l; do [ -n "$l" ] && { echo "(fail) $l"; n=$((n + 1)); }; done < fails.txt
sib=none
if [ -f reads-sibling ]; then
  s="$(cat reads-sibling)"
  if [ -f "../$s/src/gate.ts" ]; then sib=seen; echo '(pass) sibling > gate present'; else sib=missing; echo '(fail) sibling > gate present'; n=$((n + 1)); fi
fi
echo "SUITE $PWD $sib" >> "$RUNS"
echo ' 5 pass'; echo " $n fail"
[ "$n" = 0 ] && exit 0 || exit 1
STUB
# The suite runs under scrubbed_env, so the runs log is written into the stub, not passed in its environment.
sed -i "s|\\\$RUNS|$T/runs.txt|" "$T/bin/bun"
chmod +x "$T/bin/bun"
BUN_BIN="$T/bin/bun"

GTR_NODE=node-a
CLONE_DIR="$T/clones"; MARKER_DIR="$T/marker"; TEST_BASELINE_DIR="$T/baseline"; LAST_GOOD_DIR="$T/lastgood"; TMPDIR="$T/tmp"
TEST_GATE_MAX_REFUSALS=3
PROTECTED_SCOPE_FILE="$T/autonomy-scope.json"; echo '{"autonomyScope":{"excluded_paths":[]}}' > "$PROTECTED_SCOPE_FILE"
TEST_TIMEOUT_SECONDS=8; TEST_KILL_GRACE_SECONDS=1; PROTECTED_TEST_TIMEOUT_SECONDS=3; UNIT_TIMEOUT_S=60; GATE_UNIT_MARGIN_S=2

reset_all() { rm -rf "$T/clones" "$T/marker" "$T/baseline" "$T/lastgood" "$T/tmp" "$T/cutover-armed"; mkdir -p "$CLONE_DIR" "$MARKER_DIR" "$TEST_BASELINE_DIR" "$LAST_GOOD_DIR" "$TMPDIR"; : > "$CALLS"; }
commit() { local x="$1"; shift; echo "export const x = $x;" > "$VD/src/x.ts"; printf '%s\n' "$@" > "$VD/fails.txt"; git -C "$VD" -c user.name=t -c user.email=t@t commit -qam "x$x"; }
tick() { : > "$LOG"; : > "$T/runs.txt"; : > "$CALLS"; synced=0; failed=0; skipped=0; GEN_QUEUE=""; unset GATE_T0; PULLSYNC_T0=$(date +%s); run_tick; }
conv() { grep -q "^CONVERGED $1\$" "$CALLS"; }
refused() { grep -q "REFUSING to converge" "$LOG"; }
logtail() { tr '\n' '|' < "$LOG" | cut -c1-500; }

VD=""
# mkvessel <name> [sibling-it-reads]
mkvessel() {
  VD="$CLONE_DIR/$1"
  mkdir -p "$VD/src"; echo 'export const x = 1;' > "$VD/src/x.ts"; echo '{"name":"'"$1"'"}' > "$VD/package.json"; echo 'lock 1' > "$VD/bun.lock"
  echo 'export const gate = 1;' > "$VD/src/gate.ts"
  echo 'old > one' > "$VD/fails.txt"
  [ -n "${2:-}" ] && echo "$2" > "$VD/reads-sibling"
  git -C "$VD" init -q -b dev; git -C "$VD" -c user.name=t -c user.email=t@t add -A >/dev/null; git -C "$VD" -c user.name=t -c user.email=t@t commit -qm base
  git -C "$VD" rev-parse HEAD > "$LAST_GOOD_DIR/$1"
  printf '%s\n' '(fail) old > one' > "$TEST_BASELINE_DIR/$1.failnames"; echo "1 5 0" > "$TEST_BASELINE_DIR/$1"
}
# ── (1) a suite that reads its sibling clone ────────────────────────────────────────
reset_all; mkvessel vs; mkvessel va vs
commit 2 'old > one'; tick
G="$(grep -v '/pullsync-base-' "$T/runs.txt")"
[ -n "$G" ] && ok "(1) setup: the gated HEAD's suite ran (T1)" || bad "(1) setup: no gate run recorded: $(tr '\n' '|' < "$T/runs.txt")"
[ -n "$G" ] && [ -z "$(grep -v "^SUITE $CLONE_DIR/va " <<<"$G")" ] && ok "(1) every T1/T2 run executed in the clone dir" || bad "(1) a T1/T2 run executed outside the clone dir: $(grep -v "^SUITE $CLONE_DIR/va " <<<"$G" | tr '\n' '|')"
[ -n "$G" ] && [ -z "$(grep -v ' seen$' <<<"$G")" ] && ok "(1) every T1/T2 run saw ../vs, the sibling clone" || bad "(1) a T1/T2 run could not see ../vs: $(grep -v ' seen$' <<<"$G" | tr '\n' '|')"
conv va && ok "(1) a HEAD adding nothing converges" || bad "(1) not converged (log: $(logtail))"
[ -f "$CLONE_DIR/vs/src/gate.ts" ] && ok "(1) the sibling clone is intact" || bad "(1) the sibling clone was damaged"

# ── (2) CONTROL: no sibling reads ───────────────────────────────────────────────────
reset_all; mkvessel vs; mkvessel vc
commit 2 'old > one'; tick
grep -qv ' none$' "$T/runs.txt" && bad "(2) control: a run read a sibling" || ok "(2) control: no run reads a sibling"
conv vc && ok "(2) control: a HEAD adding nothing converges" || bad "(2) control: did not converge (log: $(logtail))"
reset_all; mkvessel vs; mkvessel vc
commit 2 'old > one' 'new > broken'; tick
! conv vc && refused && ok "(2) control: a HEAD adding a failure is refused" || bad "(2) control: not refused (log: $(logtail))"

echo
[ "$FAILS" -eq 0 ] && { echo "PASS"; exit 0; } || { echo "$FAILS FAIL"; exit 1; }
