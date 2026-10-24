#!/usr/bin/env bash
# pull-sync gates a clone HEAD that was never gated even when the runtime already runs its tree
# (scripts/substrate/substrate-pull-sync.sh: the content short-circuit "already match the runtime" through the
# "3-pre. TEST GATE" slice).
#
# Observed: a cutover wrote the runtime and committed into the clone. The next tick found runtime == clone, logged
# "nothing to mirror", and ran no gate at all: the ungated sha ran, and a quiet tick later it was pinned last-good.
#
#   (1) MUST-FAIL: runtime tree == clone tree, but the clone's sha is not the last gated sha: the gate RUNS, nothing
#       is mirrored, and a pass records the sha as gated
#   (2) CONTROL: an unchanged clone at the last gated sha: no gate run, "nothing to mirror" as before
#   (3) CONTROL: no gated record yet, and the clone at the last-good pin (an upgraded node): no gate run
#
# The harness is the one in pull-sync-testgate-rotation.test.sh, widened to start at the content short-circuit.
#
# usage: validation/scripts/pull-sync-gates-an-ungated-matching-runtime.test.sh [path/to/substrate-pull-sync.sh]
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
  sed -n '/^tracked_output_dirs() {/,/^}/p' "$SCRIPT"
  sed -n '/^content_hash() {/,/^}/p' "$SCRIPT"
  echo 'run_tick() {'
  echo 'for d in "$CLONE_DIR"/*; do'
  echo '  v="$(basename "$d")"; HEAD="$(git -C "$d" rev-parse HEAD)"; DIST_RETRY=""; TG_GATE_ONLY=""; SELF_UNIT="$v.service"'
  echo '  MARKER="$MARKER_DIR/$v.sha"; LAST="$(cat "$MARKER" 2>/dev/null || true)"'
  echo '  CLONE_HASH="$(content_hash "$d")"; RUNTIME_HASH="$(content_hash "$RUNTIME_DIR/$v" "$d")"'
  awk '/^  if \[ "\$CLONE_HASH" = "\$RUNTIME_HASH" \]; then$/{on=1} on && /^  # The owed quiesce/{exit} on{print}' "$SCRIPT"
  echo '  echo "MIRROR-PATH $v" >> "$CALLS"'
  echo 'done'
  echo '}'
} > "$T/fns.sh"
grep -q 'testgate-refusals' "$T/fns.sh" && grep -q 'nothing to mirror' "$T/fns.sh" || { echo "FAIL - could not extract the short-circuit .. gate slice"; exit 1; }
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
tuning_param() { TP_VALUE="$2"; }
refresh_clone_dependants() { :; }
pin_running_baseline() { echo "PIN $1 $4" >> "$CALLS"; }
vessel_unit() { echo "$1.service"; }
health_port() { :; }
systemctl() { case "$1" in is-active) return 0 ;; is-enabled) echo enabled ;; *) : ;; esac; }

mkdir -p "$T/bin"
cat > "$T/bin/bun" <<STUB
#!/usr/bin/env bash
[ "\$1" = --version ] && { echo 1.0.0; exit 0; }
[ "\$1" = test ] || exit 0
echo SUITE >> "$T/runs.txt"
printf '(pass) a > works\n 5 pass\n 0 fail\n'; exit 0
STUB
chmod +x "$T/bin/bun"; BUN_BIN="$T/bin/bun"

GTR_NODE=node-a; BRANCH=dev
CLONE_DIR="$T/clones"; RUNTIME_DIR="$T/runtime"; MARKER_DIR="$T/marker"; TEST_BASELINE_DIR="$T/baseline"; LAST_GOOD_DIR="$T/lastgood"; TMPDIR="$T/tmp"
AUTHORING_MARKER_DIR="$T/authoring"; DEFERRAL_LOG="$T/deferrals.jsonl"; STALE_AUTHORING_MARKER_MIN=60; AUTHORING_MARKER_TTL_MIN=30
TEST_GATE_MAX_REFUSALS=3
PROTECTED_SCOPE_FILE="$T/autonomy-scope.json"; echo '{"autonomyScope":{"excluded_paths":[]}}' > "$PROTECTED_SCOPE_FILE"
TEST_TIMEOUT_SECONDS=8; TEST_KILL_GRACE_SECONDS=1; PROTECTED_TEST_TIMEOUT_SECONDS=3; UNIT_TIMEOUT_S=60; GATE_UNIT_MARGIN_S=2

V=va; VD="$CLONE_DIR/$V"
g() { git -C "$VD" -c user.name=t -c user.email=t@t "$@" >/dev/null 2>&1; }
commit() { echo "export const x = $1;" > "$VD/src/x.ts"; g add -A; g commit -m "x$1"; }
to_runtime() { rm -rf "$RUNTIME_DIR/$V/src"; mkdir -p "$RUNTIME_DIR/$V"; cp -r "$VD/src" "$RUNTIME_DIR/$V/src"; }  # what a cutover writes
reset_all() {
  rm -rf "$CLONE_DIR" "$RUNTIME_DIR" "$MARKER_DIR" "$TEST_BASELINE_DIR" "$LAST_GOOD_DIR" "$TMPDIR" "$AUTHORING_MARKER_DIR"
  mkdir -p "$VD/src" "$MARKER_DIR" "$TEST_BASELINE_DIR" "$LAST_GOOD_DIR" "$TMPDIR" "$AUTHORING_MARKER_DIR"
  echo '{"name":"va"}' > "$VD/package.json"; echo 'lock 1' > "$VD/bun.lock"
  git -C "$VD" init -q -b dev; commit 1
  G="$(git -C "$VD" rev-parse HEAD)"; to_runtime
  echo "$G" > "$LAST_GOOD_DIR/$V"; content_hash "$VD" > "$MARKER_DIR/$V.sha"; content_hash "$VD" > "$MARKER_DIR/$V.runtime-sha"
  : > "$TEST_BASELINE_DIR/$V.failnames"; echo "0 5 0" > "$TEST_BASELINE_DIR/$V"
}
tick() { : > "$LOG"; : > "$T/runs.txt"; : > "$CALLS"; synced=0; failed=0; skipped=0; GEN_QUEUE=""; unset GATE_T0; PULLSYNC_T0=$(date +%s); run_tick; }
ran() { grep -c '^SUITE$' "$T/runs.txt" 2>/dev/null || true; }
logtail() { tr '\n' '|' < "$LOG" | cut -c1-400; }

# ── (1) a cutover-written runtime at an ungated sha is gated ────────────────────────
reset_all; echo "$G" > "$MARKER_DIR/$V.gated-sha"
commit 2; B="$(git -C "$VD" rev-parse HEAD)"; to_runtime    # the cutover: clone commit + runtime write, no gate
tick
[ "$(ran)" -ge 1 ] && ok "(1) the runtime matches the clone at an ungated sha: the gate RAN" || bad "(1) no gate ran on an ungated sha (log: $(logtail))"
[ "$(cat "$MARKER_DIR/$V.gated-sha" 2>/dev/null)" = "$B" ] && ok "(1) the pass recorded the sha as gated" || bad "(1) the gated record was not advanced to the gated sha"
grep -q "^MIRROR-PATH" "$CALLS" && bad "(1) a gate-only pass went on to the mirror" || ok "(1) nothing mirrored (gate only)"
grep -q 'UNGATED RUNTIME' "$LOG" && ok "(1) logged as UNGATED RUNTIME" || bad "(1) no UNGATED RUNTIME line"
tick
[ "$(ran)" = 0 ] && ok "(1) once gated, the next tick runs no gate" || bad "(1) the gated sha was gated again"

# ── (2) CONTROL: unchanged clone at the last gated sha ──────────────────────────────
reset_all; echo "$G" > "$MARKER_DIR/$V.gated-sha"
tick
[ "$(ran)" = 0 ] && ok "(2) control: no gate run at the last gated sha" || bad "(2) control: a gated sha was gated again (log: $(logtail))"
grep -q 'nothing to mirror' "$LOG" && ok "(2) control: nothing to mirror, as before" || bad "(2) control: no 'nothing to mirror' line"

# ── (3) CONTROL: no gated record, the clone at the last-good pin ────────────────────
reset_all
tick
[ "$(ran)" = 0 ] && ok "(3) control: an upgraded node at its last-good pin runs no gate" || bad "(3) control: gated at the last-good pin (log: $(logtail))"

echo
[ "$FAILS" -eq 0 ] && { echo "PASS"; exit 0; } || { echo "$FAILS FAIL"; exit 1; }
