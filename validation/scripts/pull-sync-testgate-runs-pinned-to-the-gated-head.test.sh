#!/usr/bin/env bash
# pull-sync's test-gate runs (T1/T2) measure the HEAD being gated, in a throwaway worktree, never the moving clone
# (scripts/substrate/substrate-pull-sync.sh, run_suite in the "3-pre. TEST GATE" slice).
#
# Observed: the gate ran its suite inside the clone, and a cutover commits into the clone. A landing during T1
# changed the tree under the measurement, so the gate could judge one commit by another commit's results.
#
#   (1) MUST-FAIL: a cutover lands in the clone during T1, fixing the gated HEAD's new failure: the gate still
#       measures the gated HEAD (its failure is seen) and REFUSES it; it does not converge on the advanced tree
#   (2) CONTROL: the normal gate, no cutover: a HEAD adding nothing converges; a HEAD adding a failure is refused
#
# Harness: pull-sync-testgate-last-converged-reference.test.sh's (the rotation harness with a deterministic `bun`
# stub: a tree's failing tests are the lines of its fails.txt, read from the directory the suite runs in).
#
# usage: validation/scripts/pull-sync-testgate-runs-pinned-to-the-gated-head.test.sh [path/to/substrate-pull-sync.sh]
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
# bun test: on the first run after $T/cutover-armed is created, a cutover commits into the CLONE (fixing the
# failure) before the suite reads fails.txt from where it runs.
cat > "$T/bin/bun" <<STUB
#!/usr/bin/env bash
[ "\$1" = --version ] && { echo 1.0.0; exit 0; }
[ "\$1" = test ] || exit 0
echo "SUITE \$PWD" >> "$T/runs.txt"
if [ -f "$T/cutover-armed" ]; then
  rm -f "$T/cutover-armed"
  C="$T/clones/va"; echo 'old > one' > "\$C/fails.txt"; echo 'export const x = 99;' > "\$C/src/x.ts"
  git -C "\$C" -c user.name=t -c user.email=t@t commit -qam cutover >/dev/null 2>&1
fi
echo '(pass) a > works'
n=0; while IFS= read -r l; do [ -n "\$l" ] && { echo "(fail) \$l"; n=\$((n + 1)); }; done < fails.txt
echo ' 5 pass'; echo " \$n fail"
[ "\$n" = 0 ] && exit 0 || exit 1
STUB
chmod +x "$T/bin/bun"
BUN_BIN="$T/bin/bun"

GTR_NODE=node-a
CLONE_DIR="$T/clones"; MARKER_DIR="$T/marker"; TEST_BASELINE_DIR="$T/baseline"; LAST_GOOD_DIR="$T/lastgood"; TMPDIR="$T/tmp"
TEST_GATE_MAX_REFUSALS=3
PROTECTED_SCOPE_FILE="$T/autonomy-scope.json"; echo '{"autonomyScope":{"excluded_paths":[]}}' > "$PROTECTED_SCOPE_FILE"
TEST_TIMEOUT_SECONDS=8; TEST_KILL_GRACE_SECONDS=1; PROTECTED_TEST_TIMEOUT_SECONDS=3; UNIT_TIMEOUT_S=60; GATE_UNIT_MARGIN_S=2

reset_all() { rm -rf "$T/clones" "$T/marker" "$T/baseline" "$T/lastgood" "$T/tmp" "$T/cutover-armed"; mkdir -p "$CLONE_DIR" "$MARKER_DIR" "$TEST_BASELINE_DIR" "$LAST_GOOD_DIR" "$TMPDIR"; : > "$CALLS"; }
VD=""
mkvessel() {
  VD="$CLONE_DIR/$1"
  mkdir -p "$VD/src"; echo 'export const x = 1;' > "$VD/src/x.ts"; echo '{"name":"'"$1"'"}' > "$VD/package.json"; echo 'lock 1' > "$VD/bun.lock"
  echo 'old > one' > "$VD/fails.txt"
  git -C "$VD" init -q -b dev; git -C "$VD" -c user.name=t -c user.email=t@t add -A >/dev/null; git -C "$VD" -c user.name=t -c user.email=t@t commit -qm base
  git -C "$VD" rev-parse HEAD > "$LAST_GOOD_DIR/$1"
  printf '%s\n' '(fail) old > one' > "$TEST_BASELINE_DIR/$1.failnames"; echo "1 5 0" > "$TEST_BASELINE_DIR/$1"
}
commit() { local x="$1"; shift; echo "export const x = $x;" > "$VD/src/x.ts"; printf '%s\n' "$@" > "$VD/fails.txt"; git -C "$VD" -c user.name=t -c user.email=t@t commit -qam "x$x"; }
tick() { : > "$LOG"; : > "$T/runs.txt"; : > "$CALLS"; synced=0; failed=0; skipped=0; GEN_QUEUE=""; unset GATE_T0; PULLSYNC_T0=$(date +%s); run_tick; }
conv() { grep -q "^CONVERGED $1\$" "$CALLS"; }
refused() { grep -q "REFUSING to converge" "$LOG"; }
logtail() { tr '\n' '|' < "$LOG" | cut -c1-500; }

# ── (1) a cutover lands in the clone during T1 ──────────────────────────────────────
reset_all; mkvessel va
commit 2 'old > one' 'new > broken'; A="$(git -C "$VD" rev-parse HEAD)"
touch "$T/cutover-armed"; tick
[ "$(git -C "$VD" rev-parse HEAD)" != "$A" ] && ok "(1) setup: the clone advanced during T1" || bad "(1) setup: no cutover landed"
conv va && bad "(1) the gate converged: it measured the advanced tree, not the gated HEAD (log: $(logtail))" || ok "(1) the gated HEAD did not converge on another tree's results"
refused && ok "(1) the gated HEAD's own failure was measured and refused" || bad "(1) not refused (log: $(logtail))"
grep -q "^SUITE $VD\$" "$T/runs.txt" && bad "(1) a gate run executed in the moving clone" || ok "(1) no gate run executed in the clone itself"

# ── (2) CONTROL: the normal gate ────────────────────────────────────────────────────
reset_all; mkvessel vb
commit 2 'old > one'; tick
conv vb && ok "(2) control: a HEAD adding nothing converges" || bad "(2) control: did not converge (log: $(logtail))"
reset_all; mkvessel vc
commit 2 'old > one' 'new > broken'; tick
! conv vc && refused && ok "(2) control: a HEAD adding a failure is refused" || bad "(2) control: not refused (log: $(logtail))"

echo
[ "$FAILS" -eq 0 ] && { echo "PASS"; exit 0; } || { echo "$FAILS FAIL"; exit 1; }
