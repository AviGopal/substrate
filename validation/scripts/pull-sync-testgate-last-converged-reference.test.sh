#!/usr/bin/env bash
# pull-sync's test gate must judge a candidate against the LAST CONVERGED commit, not its immediate parent
# (scripts/substrate/substrate-pull-sync.sh, the "3-pre. TEST GATE" slice: the parent/candidate overlay).
#
# Observed: a commit A was refused for one attributable failure (213 -> 214). Its child B, with no failure
# of its own, was then overlaid against A, which fails the same test, so it read "0 attributable" and
# INSTALLED, carrying the regression A was refused for.
#
#   (1) MUST-FAIL: A refused for a new failure; B on A, adding nothing: B is REFUSED for A's failure
#   (2) CONTROL: B on a refused A that FIXES A's failure converges
#   (3) CONTROL: the normal case: A converges, then B adding nothing converges
#
# The harness is the one in pull-sync-testgate-rotation.test.sh, with a deterministic `bun` stub: each ref's
# failing tests are the lines of its committed fails.txt, so a worktree run at a ref reports that ref's failures.
#
# usage: validation/scripts/pull-sync-testgate-last-converged-reference.test.sh [path/to/substrate-pull-sync.sh]
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
# bun --version -> 1.0.0 ; bun test -> one passing test, plus "(fail) <line>" for each line of the tree's fails.txt.
cat > "$T/bin/bun" <<STUB
#!/usr/bin/env bash
[ "\$1" = --version ] && { echo 1.0.0; exit 0; }
[ "\$1" = test ] || exit 0
echo "SUITE" >> "$T/runs.txt"
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
# Ample budget: T1, T2 and the two-run overlay (4 x 9 s worst case) fit a 60 s unit less a 2 s margin.
TEST_TIMEOUT_SECONDS=8; TEST_KILL_GRACE_SECONDS=1; PROTECTED_TEST_TIMEOUT_SECONDS=3; UNIT_TIMEOUT_S=60; GATE_UNIT_MARGIN_S=2

reset_all() { rm -rf "$T/clones" "$T/marker" "$T/baseline" "$T/lastgood" "$T/tmp"; mkdir -p "$CLONE_DIR" "$MARKER_DIR" "$TEST_BASELINE_DIR" "$LAST_GOOD_DIR" "$TMPDIR"; : > "$CALLS"; }
VD=""
mkvessel() { # <name>: one converged commit G failing "old > one", baselined there
  VD="$CLONE_DIR/$1"
  mkdir -p "$VD/src"; echo 'export const x = 1;' > "$VD/src/x.ts"; echo '{"name":"'"$1"'"}' > "$VD/package.json"; echo 'lock 1' > "$VD/bun.lock"
  echo 'old > one' > "$VD/fails.txt"
  git -C "$VD" init -q -b dev; git -C "$VD" -c user.name=t -c user.email=t@t add -A >/dev/null; git -C "$VD" -c user.name=t -c user.email=t@t commit -qm base
  git -C "$VD" rev-parse HEAD > "$LAST_GOOD_DIR/$1"
  printf '%s\n' '(fail) old > one' > "$TEST_BASELINE_DIR/$1.failnames"; echo "1 5 0" > "$TEST_BASELINE_DIR/$1"
}
commit() { # <x value> <fails.txt lines...>: a source change, and the tree's failing tests
  local x="$1"; shift
  echo "export const x = $x;" > "$VD/src/x.ts"; printf '%s\n' "$@" > "$VD/fails.txt"
  git -C "$VD" -c user.name=t -c user.email=t@t commit -qam "x$x"
}
tick() { : > "$LOG"; : > "$T/runs.txt"; : > "$CALLS"; synced=0; failed=0; skipped=0; GEN_QUEUE=""; unset GATE_T0; PULLSYNC_T0=$(date +%s); run_tick; }
conv() { grep -q "^CONVERGED $1\$" "$CALLS"; }
refused() { grep -q "REFUSING to converge" "$LOG"; }
logtail() { tr '\n' '|' < "$LOG" | cut -c1-500; }

# ── (1) refuse(A), then B on A adding nothing: B is refused for A's failure ──────────
reset_all; mkvessel va
commit 2 'old > one' 'new > broken'; tick
! conv va && refused && ok "(1) setup: A (a new failure) is refused" || bad "(1) setup: A was not refused (log: $(logtail))"
commit 3 'old > one' 'new > broken'; tick
conv va && bad "(1) B on a refused A converged, carrying A's regression (log: $(logtail))" || ok "(1) B on a refused A did not converge"
refused && ok "(1) B is REFUSED for A's failure" || bad "(1) B was not refused (log: $(logtail))"

# ── (2) CONTROL: B fixes A's failure: converges ─────────────────────────────────────
reset_all; mkvessel vb
commit 2 'old > one' 'new > broken'; tick
commit 3 'old > one'; tick
conv vb && ok "(2) control: B that fixes A's failure converges" || bad "(2) control: a fixing B did not converge (log: $(logtail))"

# ── (3) CONTROL: A converges, then B adding nothing converges ───────────────────────
reset_all; mkvessel vc
commit 2 'old > one'; tick
conv vc && ok "(3) control: A without a new failure converges" || bad "(3) control: A did not converge (log: $(logtail))"
commit 3 'old > one'; tick
conv vc && ok "(3) control: B after a converged A converges" || bad "(3) control: B did not converge (log: $(logtail))"

echo
[ "$FAILS" -eq 0 ] && { echo "PASS"; exit 0; } || { echo "$FAILS FAIL"; exit 1; }
