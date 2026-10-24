#!/usr/bin/env bash
# pull-sync installs EXACTLY the sha its gate judged, and a mirror that did not land is a failure
# (scripts/substrate/substrate-pull-sync.sh, the mirror -> restart slice).
#
# Observed: the gate judged one commit; during the tick a cutover committed into the clone, and mirror-to-live
# copied the clone's HEAD of that moment, a commit never gated. pull-sync then logged "mirror exited 0 but
# live != clone" and moved on, restarting onto the unverified tree.
#
#   (1) MUST-FAIL: the clone advances between the gate and the mirror: the live tree is the GATED sha's tree
#   (2) MUST-FAIL: a mirror whose live tree does not match the gated sha's tree (on every attempt) is not left in
#       place: the last-good tree is restored, nothing restarts, last-good is unchanged, a gap is filed
#   (3) CONTROL: an ordinary gate -> mirror of the same sha installs once, restarts, and pins last-good
#
# Runs the script's own mirror -> restart slice (PREV_GOOD read .. last-good write) with the REAL mirror-to-live.sh
# against temp dirs; systemctl and emit_gap are stubbed (the harness of pull-sync-drift-quarantine.test.sh).
#
# usage: validation/scripts/pull-sync-mirror-installs-gated-sha.test.sh [repo-root]
set -uo pipefail
ROOT="${1:-$(cd "$(dirname "$0")/../.." && pwd)}"
SCRIPT="${PULLSYNC_SCRIPT:-$ROOT/scripts/substrate/substrate-pull-sync.sh}"
MIRROR="$ROOT/scripts/substrate/mirror-to-live.sh"
T="$(mktemp -d)"; trap 'rm -rf "$T"' EXIT
FAILS=0
ok()  { echo "ok   - $*"; }
bad() { echo "FAIL - $*"; FAILS=$((FAILS+1)); }

{
  sed -n '/^tracked_output_dirs() {/,/^}/p' "$SCRIPT"
  sed -n '/^content_hash() {/,/^}/p' "$SCRIPT"
  sed -n '/^test_only_range() {/,/^}/p' "$SCRIPT"
  sed -n '/^content_hash_nontest() {/,/^}/p' "$SCRIPT"
  sed -n '/^drift_quarantine() {/,/^}/p' "$SCRIPT"
  sed -n '/^revert_target_hashes() {/,/^}/p' "$SCRIPT"
  echo 'run_slice() {'
  echo 'for v in "$VESSEL"; do'
  echo '  MARKER="$MARKER_DIR/$v.sha"; LAST="$(cat "$MARKER" 2>/dev/null || true)"'
  echo '  CLONE_HASH="$(content_hash "$d")"; RUNTIME_HASH="$(content_hash "$RUNTIME_DIR/$v" "$d")"'
  echo '  DIST_RETRY=""; SELF_UNIT="$v.service"'
  awk '/^  PREV_GOOD="\$\(cat "\$LAST_GOOD_DIR\/\$v"/{on=1} on{print} on && /^  echo "\$HEAD" > "\$LAST_GOOD_DIR\/\$v"$/{exit}' "$SCRIPT"
  echo 'done'
  echo '}'
} | sed -e "s#/usr/local/bin/mirror-to-live#mirror_real#g" > "$T/fns.sh"
grep -q 'mirror_real' "$T/fns.sh" || { echo "FAIL - could not extract the mirror->restart slice"; exit 1; }

CALLS="$T/calls.txt"; LOG="$T/log.txt"
log() { echo "$*" >> "$LOG"; }
emit_gap() { echo "GAP $1" >> "$CALLS"; }
# The REAL mirror, every argument forwarded. Hooks: ADVANCE_ONCE commits into the clone before the first call
# (a cutover landing between the gate and the mirror); CORRUPT_UNLESS=<sha> damages the live tree after every
# mirror that was not asked for that sha (a mirror that exits 0 but does not land).
mirror_real() {
  echo "MIRROR $*" >> "$CALLS"
  if [ -n "${ADVANCE_ONCE:-}" ]; then ADVANCE_ONCE=""; commit cutover-ungated; fi
  MITOSIS_RUNTIME_DIR="$RUNTIME_DIR" bash "$MIRROR" "$@" >> "$LOG" 2>&1; local rc=$?
  if [ -n "${CORRUPT_UNLESS:-}" ] && [ "${3:-}" != "$CORRUPT_UNLESS" ]; then echo "export const torn = 1;" > "$RUNTIME_DIR/$1/src/x.ts"; fi
  return $rc
}
systemctl() { case "$1" in is-active) return 0 ;; is-enabled) echo enabled ;; restart) echo "RESTART $2" >> "$CALLS" ;; *) : ;; esac; }
vessel_unit() { echo "$1.service"; }
health_port() { :; }
healthy() { return 0; }
restart_age_defer() { RA_INFLIGHT=""; RA_OLDEST=""; RA_DEFER=0; RA_WHY=""; }
restart_breadcrumb() { :; }
restart_siblings() { :; }
quiesce_release() { :; }
# shellcheck disable=SC1090
source "$T/fns.sh"

VESSEL=demo-vessel
CLONE_DIR="$T/clones"; RUNTIME_DIR="$T/runtime"; MARKER_DIR="$T/marker"; LAST_GOOD_DIR="$T/lastgood"
AUTHORING_MARKER_DIR="$T/authoring"; DEFERRAL_LOG="$T/deferrals.jsonl"; BRANCH=dev; STAGGER_SECONDS=0
DRIFT_QUARANTINE_DIR="$T/quarantine"; DRIFT_QUARANTINE_KEEP=3; TMPDIR="$T/tmp"
d="$CLONE_DIR/$VESSEL"; R="$RUNTIME_DIR/$VESSEL"
g() { git -C "$d" -c user.name=t -c user.email=t@t "$@" >/dev/null 2>&1; }
commit() { echo "export const x = '$1';" > "$d/src/x.ts"; g add -A; g commit -m "$1"; g update-ref refs/remotes/origin/dev HEAD; }
tree_of() { revert_target_hashes "$d" "$1" "$R" >/dev/null 2>&1; echo "$RT_WANT"; }
live() { content_hash "$R" "$d"; }
setup() { # last-good G mirrored and pinned; the candidate A committed on top (the sha the gate judged)
  rm -rf "$CLONE_DIR" "$RUNTIME_DIR" "$MARKER_DIR" "$LAST_GOOD_DIR" "$AUTHORING_MARKER_DIR" "$DRIFT_QUARANTINE_DIR" "$TMPDIR"
  mkdir -p "$d/src" "$R" "$MARKER_DIR" "$LAST_GOOD_DIR" "$AUTHORING_MARKER_DIR" "$TMPDIR"
  git -C "$d" init -q -b dev; commit good
  MITOSIS_RUNTIME_DIR="$RUNTIME_DIR" bash "$MIRROR" "$VESSEL" "$CLONE_DIR" >> "$T/setup.log" 2>&1
  content_hash "$d" > "$MARKER_DIR/$VESSEL.sha"; content_hash "$d" > "$MARKER_DIR/$VESSEL.runtime-sha"
  G="$(git -C "$d" rev-parse HEAD)"; echo "$G" > "$LAST_GOOD_DIR/$VESSEL"
  commit gated; A="$(git -C "$d" rev-parse HEAD)"
  : > "$CALLS"; : > "$LOG"; synced=0; failed=0; skipped=0; ADVANCE_ONCE=""; CORRUPT_UNLESS=""
}
logtail() { tr '\n' '|' < "$LOG" | cut -c1-500; }

# ── (1) the clone advances between the gate and the mirror ──────────────────────────
setup; HEAD="$A"; ADVANCE_ONCE=1; run_slice
B="$(git -C "$d" rev-parse HEAD)"
[ "$B" != "$A" ] && ok "(1) setup: the clone advanced past the gated sha during the mirror" || bad "(1) setup: the clone did not advance"
[ "$(live)" = "$(tree_of "$A")" ] && ok "(1) the live tree is the GATED sha's tree" || bad "(1) the live tree is not the gated sha's tree (live $(live | cut -c1-10), gated $(tree_of "$A" | cut -c1-10), advanced $(tree_of "$B" | cut -c1-10); log: $(logtail))"
[ "$(live)" != "$(tree_of "$B")" ] && ok "(1) the ungated advanced commit was not installed" || bad "(1) the ungated advanced commit was installed"

# ── (2) a mirror that does not land is not left in place ────────────────────────────
setup; HEAD="$A"; CORRUPT_UNLESS="$G"; run_slice
[ "$(live)" = "$(tree_of "$G")" ] && ok "(2) the last-good tree is restored" || bad "(2) the mismatched tree was left live (live $(live | cut -c1-10), last-good $(tree_of "$G" | cut -c1-10); log: $(logtail))"
grep -q '^RESTART' "$CALLS" && bad "(2) the unit was restarted onto an unverified tree" || ok "(2) nothing restarted"
[ "$(cat "$LAST_GOOD_DIR/$VESSEL")" = "$G" ] && ok "(2) last-good unchanged" || bad "(2) last-good moved to $(cut -c1-10 "$LAST_GOOD_DIR/$VESSEL")"
grep -q '^GAP .*pull-sync-mirror-mismatch-' "$CALLS" && ok "(2) a mirror-mismatch gap is filed" || bad "(2) no mirror-mismatch gap"
grep -q 'MIRROR MISMATCH' "$LOG" && ok "(2) logged as an error" || bad "(2) no MIRROR MISMATCH line (log: $(logtail))"
[ "$(cat "$MARKER_DIR/$VESSEL.sha")" != "$(content_hash "$d")" ] && ok "(2) the attempt marker is not set to the failed tree (next tick retries)" || bad "(2) the failed tree was marked attempted"

# ── (3) CONTROL: an ordinary gate -> mirror of the same sha ─────────────────────────
setup; HEAD="$A"; run_slice
[ "$(grep -c '^MIRROR' "$CALLS")" = 1 ] && ok "(3) control: mirrored once" || bad "(3) control: $(grep -c '^MIRROR' "$CALLS") mirror calls"
[ "$(live)" = "$(tree_of "$A")" ] && grep -q '^RESTART' "$CALLS" && [ "$(cat "$LAST_GOOD_DIR/$VESSEL")" = "$A" ] \
  && ok "(3) control: installed, restarted, last-good pinned" || bad "(3) control: not installed cleanly (log: $(logtail))"
grep -q 'MIRROR MISMATCH' "$LOG" && bad "(3) control: a clean mirror was flagged" || ok "(3) control: no mismatch"

echo
[ "$FAILS" -eq 0 ] && { echo "PASS"; exit 0; } || { echo "$FAILS FAIL"; exit 1; }
