#!/usr/bin/env bash
# A REFUSED gate-only pass restores last-good on the RUNTIME (scripts/substrate/substrate-pull-sync.sh: the content
# short-circuit's UNGATED RUNTIME pass through the "3-pre. TEST GATE" slice and its refusal block).
#
# The runtime already runs a tree a cutover wrote, ungated. When the gate then refuses it, "refuse and keep
# last-good" means putting last-good back on the runtime: the runtime only, never dev or the clone, with the
# refusal still filed and the next tick gating again.
#
#   (1) MUST-FAIL: a cutover-written tree with a new failure; the gate-only pass refuses it: the runtime tree is
#       last-good's tree, the unit restarts on it, the refusal is filed, and the clone is untouched
#   (2) the next tick gates the clone again (refused again), and the runtime stays on last-good: nothing mirrors
#   (3) CONTROL: an accepted gate-only pass leaves the runtime alone: no mirror, no restart
#
# Harness: pull-sync-gates-an-ungated-matching-runtime.test.sh's slice, with the REAL mirror-to-live.sh against temp
# dirs and a deterministic `bun` stub (a ref's failing tests are the lines of its committed fails.txt).
#
# usage: validation/scripts/pull-sync-gate-only-refusal-restores-last-good.test.sh [repo-root]
set -uo pipefail
ROOT="${1:-$(cd "$(dirname "$0")/../.." && pwd)}"
SCRIPT="${PULLSYNC_SCRIPT:-$ROOT/scripts/substrate/substrate-pull-sync.sh}"
MIRROR="$ROOT/scripts/substrate/mirror-to-live.sh"
T="$(mktemp -d)"; trap 'rm -rf "$T"' EXIT
FAILS=0
ok()  { echo "ok   - $*"; }
bad() { echo "FAIL - $*"; FAILS=$((FAILS+1)); }

{
  sed -n '/^scrubbed_env() {/,/^}/p' "$SCRIPT"
  sed -n '/^unresolved_modules() {/,/^}/p' "$SCRIPT"
  sed -n '/^test_only_range() {/,/^}/p' "$SCRIPT"
  sed -n '/^tracked_output_dirs() {/,/^}/p' "$SCRIPT"
  sed -n '/^content_hash() {/,/^}/p' "$SCRIPT"
  sed -n '/^revert_target_hashes() {/,/^}/p' "$SCRIPT"
  sed -n '/^restore_last_good() {/,/^}/p' "$SCRIPT"
  echo 'run_tick() {'
  echo 'for d in "$CLONE_DIR"/*; do'
  echo '  v="$(basename "$d")"; HEAD="$(git -C "$d" rev-parse HEAD)"; DIST_RETRY=""; TG_GATE_ONLY=""; SELF_UNIT="$v.service"'
  echo '  MARKER="$MARKER_DIR/$v.sha"; LAST="$(cat "$MARKER" 2>/dev/null || true)"'
  echo '  CLONE_HASH="$(content_hash "$d")"; RUNTIME_HASH="$(content_hash "$RUNTIME_DIR/$v" "$d")"'
  awk '/^  if \[ "\$CLONE_HASH" = "\$RUNTIME_HASH" \]; then$/{on=1} on && /^  # The owed quiesce/{exit} on{print}' "$SCRIPT"
  echo '  echo "MIRROR-PATH $v" >> "$CALLS"'
  echo 'done'
  echo '}'
} | sed -e "s#/usr/local/bin/mirror-to-live#mirror_real#g" > "$T/fns.sh"
grep -q 'testgate-refusals' "$T/fns.sh" && grep -q 'nothing to mirror' "$T/fns.sh" || { echo "FAIL - could not extract the short-circuit .. gate slice"; exit 1; }
# shellcheck disable=SC1090
source "$T/fns.sh"

CALLS="$T/calls.txt"; LOG="$T/log.txt"
log() { echo "$*" >> "$LOG"; }
emit_gap() { echo "GAP $1" >> "$CALLS"; }
mirror_real() { echo "MIRROR $*" >> "$CALLS"; MITOSIS_RUNTIME_DIR="$RUNTIME_DIR" bash "$MIRROR" "$@" >> "$LOG" 2>&1; }
tracked_fail_names() { :; }
ensure_clone_deps() { return 0; }
ensure_clone_nested_deps() { CD_NESTED=""; return 0; }
clone_file_deps() { :; }
file_dep_identity() { echo x; }
tuning_param() { TP_VALUE="$2"; }
refresh_clone_dependants() { :; }
pin_running_baseline() { :; }
vessel_unit() { echo "$1.service"; }
health_port() { :; }
systemctl() { case "$1" in is-active) return 0 ;; is-enabled) echo enabled ;; restart) echo "RESTART $*" >> "$CALLS" ;; *) : ;; esac; }

mkdir -p "$T/bin"
cat > "$T/bin/bun" <<STUB
#!/usr/bin/env bash
[ "\$1" = --version ] && { echo 1.0.0; exit 0; }
[ "\$1" = test ] || exit 0
echo SUITE >> "$T/runs.txt"
echo '(pass) a > works'
n=0; while IFS= read -r l; do [ -n "\$l" ] && { echo "(fail) \$l"; n=\$((n + 1)); }; done < fails.txt
echo ' 5 pass'; echo " \$n fail"
[ "\$n" = 0 ] && exit 0 || exit 1
STUB
chmod +x "$T/bin/bun"; BUN_BIN="$T/bin/bun"

GTR_NODE=node-a; BRANCH=dev
CLONE_DIR="$T/clones"; RUNTIME_DIR="$T/runtime"; MARKER_DIR="$T/marker"; TEST_BASELINE_DIR="$T/baseline"; LAST_GOOD_DIR="$T/lastgood"; TMPDIR="$T/tmp"
AUTHORING_MARKER_DIR="$T/authoring"; DEFERRAL_LOG="$T/deferrals.jsonl"; STALE_AUTHORING_MARKER_MIN=60; AUTHORING_MARKER_TTL_MIN=30
TEST_GATE_MAX_REFUSALS=3
PROTECTED_SCOPE_FILE="$T/autonomy-scope.json"; echo '{"autonomyScope":{"excluded_paths":[]}}' > "$PROTECTED_SCOPE_FILE"
TEST_TIMEOUT_SECONDS=8; TEST_KILL_GRACE_SECONDS=1; PROTECTED_TEST_TIMEOUT_SECONDS=3; UNIT_TIMEOUT_S=60; GATE_UNIT_MARGIN_S=2

V=va; VD="$CLONE_DIR/$V"; R="$RUNTIME_DIR/$V"
g() { git -C "$VD" -c user.name=t -c user.email=t@t "$@" >/dev/null 2>&1; }
commit() { local x="$1"; shift; echo "export const x = $x;" > "$VD/src/x.ts"; printf '%s\n' "$@" > "$VD/fails.txt"; g add -A; g commit -m "x$x"; }
to_runtime() { MITOSIS_RUNTIME_DIR="$RUNTIME_DIR" bash "$MIRROR" "$V" "$CLONE_DIR" >> "$T/setup.log" 2>&1; }  # what a cutover writes
tree_of() { revert_target_hashes "$VD" "$1" "$R" >/dev/null 2>&1; echo "$RT_WANT"; }
live() { content_hash "$R" "$VD"; }
reset_all() {
  rm -rf "$CLONE_DIR" "$RUNTIME_DIR" "$MARKER_DIR" "$TEST_BASELINE_DIR" "$LAST_GOOD_DIR" "$TMPDIR" "$AUTHORING_MARKER_DIR"
  mkdir -p "$VD/src" "$R" "$MARKER_DIR" "$TEST_BASELINE_DIR" "$LAST_GOOD_DIR" "$TMPDIR" "$AUTHORING_MARKER_DIR"
  echo '{"name":"va"}' > "$VD/package.json"; echo 'lock 1' > "$VD/bun.lock"
  git -C "$VD" init -q -b dev; commit 1 'old > one'
  G="$(git -C "$VD" rev-parse HEAD)"; to_runtime
  echo "$G" > "$LAST_GOOD_DIR/$V"; echo "$G" > "$MARKER_DIR/$V.gated-sha"
  content_hash "$VD" > "$MARKER_DIR/$V.sha"; content_hash "$VD" > "$MARKER_DIR/$V.runtime-sha"
  printf '%s\n' '(fail) old > one' > "$TEST_BASELINE_DIR/$V.failnames"; echo "1 5 0" > "$TEST_BASELINE_DIR/$V"
}
tick() { : > "$LOG"; : > "$T/runs.txt"; : > "$CALLS"; synced=0; failed=0; skipped=0; GEN_QUEUE=""; unset GATE_T0; PULLSYNC_T0=$(date +%s); run_tick; }
ran() { grep -c '^SUITE$' "$T/runs.txt" 2>/dev/null || true; }
logtail() { tr '\n' '|' < "$LOG" | cut -c1-500; }

# ── (1) a cutover-written tree the gate-only pass refuses ───────────────────────────
reset_all
commit 2 'old > one' 'new > broken'; B="$(git -C "$VD" rev-parse HEAD)"; to_runtime   # the cutover
[ "$(live)" = "$(tree_of "$B")" ] && ok "(1) setup: the runtime runs the cutover's tree" || bad "(1) setup: the cutover tree is not live"
tick
grep -q 'REFUSING to converge' "$LOG" && ok "(1) the gate-only pass refused the cutover tree" || bad "(1) not refused (log: $(logtail))"
[ "$(live)" = "$(tree_of "$G")" ] && ok "(1) the runtime tree is last-good's tree" || bad "(1) the refused tree is still live (live $(live | cut -c1-10), last-good $(tree_of "$G" | cut -c1-10); log: $(logtail))"
grep -q "^RESTART restart $V.service" "$CALLS" && ok "(1) the unit restarts on it" || bad "(1) no restart onto last-good"
grep -q '^GAP .*pull-sync-test-regression-' "$CALLS" && ok "(1) the refusal is still filed" || bad "(1) the refusal gap was not filed"
[ "$(git -C "$VD" rev-parse HEAD)" = "$B" ] && [ -z "$(git -C "$VD" status --porcelain)" ] && ok "(1) the clone is untouched (HEAD, clean)" || bad "(1) the clone was moved or dirtied"

# ── (2) the next tick gates again; the runtime stays on last-good ───────────────────
tick
[ "$(ran)" -ge 1 ] && grep -q 'REFUSING to converge' "$LOG" && ok "(2) the next tick gates the clone again and refuses" || bad "(2) the next tick did not gate again (log: $(logtail))"
[ "$(live)" = "$(tree_of "$G")" ] && ! grep -q '^MIRROR' "$CALLS" && ok "(2) the runtime stays on last-good: nothing mirrored" || bad "(2) the runtime left last-good"

# ── (3) CONTROL: an accepted gate-only pass leaves the runtime alone ────────────────
reset_all
commit 2 'old > one'; B="$(git -C "$VD" rev-parse HEAD)"; to_runtime
tick
[ "$(live)" = "$(tree_of "$B")" ] && ! grep -q '^MIRROR' "$CALLS" && ! grep -q '^RESTART' "$CALLS" \
  && ok "(3) control: an accepted gate-only pass leaves the runtime alone" || bad "(3) control: the runtime was touched (calls: $(tr '\n' '|' < "$CALLS"); log: $(logtail))"
[ "$(cat "$MARKER_DIR/$V.gated-sha")" = "$B" ] && ok "(3) control: recorded as gated" || bad "(3) control: not recorded as gated"

echo
[ "$FAILS" -eq 0 ] && { echo "PASS"; exit 0; } || { echo "$FAILS FAIL"; exit 1; }
