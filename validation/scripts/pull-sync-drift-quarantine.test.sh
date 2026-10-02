#!/usr/bin/env bash
# A pull-sync overwrite of live content pull-sync did not write is RECOVERABLE
# and LOUD (scripts/substrate/substrate-pull-sync.sh, drift_quarantine).
#
# Replays 2026-10-02 10:07Z: the clone == origin/dev holds OLD code, the live
# runtime holds a NEWER hand-deployed fix that was never pushed, and the drift
# heal restores the runtime from the clone. Runs the script's own drift block
# (SUPPRESS_REATTEMPT=1 .. the re-attempt short-circuit) followed by its mirror
# -> restart slice (PREV_GOOD read .. last-good write), with the REAL
# mirror-to-live.sh against temp dirs; systemctl and emit_gap are stubbed.
#
#   (a) replay: the newer live tree is recoverable byte-for-byte from the
#       quarantine dir after the heal
#   (b) replay: a gap is filed naming the quarantine path, the live hash, the
#       clone hash and the clone HEAD
#   (c) replay: the heal still happens (the runtime ends on the clone)
#   (d) the quarantine copy cannot be made -> the runtime is NOT overwritten,
#       and a gap says so
#   (e) control: the runtime drifted to a tree pull-sync itself wrote (the
#       last-good tree it reverted to) -> heals as before, no quarantine, no gap
#   (f) control: an ordinary advance (runtime == last mirrored) -> mirrors, no
#       quarantine, no gap
#   (g) retention keeps the newest DRIFT_QUARANTINE_KEEP copies per vessel
#
# usage: validation/scripts/pull-sync-drift-quarantine.test.sh [repo-root]
# Needs bash, git, awk, sed, tar, diff. No root: every path is a temp dir.
set -uo pipefail
ROOT="${1:-$(cd "$(dirname "$0")/../.." && pwd)}"
SCRIPT="${PULLSYNC_SCRIPT:-$ROOT/scripts/substrate/substrate-pull-sync.sh}"
MIRROR="$ROOT/scripts/substrate/mirror-to-live.sh"
T="$(mktemp -d)"; trap 'rm -rf "$T"' EXIT
FAILS=0
ok()  { echo "ok   - $*"; }
bad() { echo "FAIL - $*"; FAILS=$((FAILS+1)); }

# ── the code under test, taken from the script itself ─────────────────────────
{
  sed -n '/^tracked_output_dirs() {/,/^}/p' "$SCRIPT"
  sed -n '/^content_hash() {/,/^}/p' "$SCRIPT"
  sed -n '/^test_only_range() {/,/^}/p' "$SCRIPT"
  sed -n '/^content_hash_nontest() {/,/^}/p' "$SCRIPT"
  sed -n '/^drift_quarantine() {/,/^}/p' "$SCRIPT"
  echo 'run_slice() {'
  echo 'for v in "$VESSEL"; do'
  echo '  MARKER="$MARKER_DIR/$v.sha"; LAST="$(cat "$MARKER" 2>/dev/null || true)"'
  echo '  CLONE_HASH="$(content_hash "$d")"; RUNTIME_HASH="$(content_hash "$RUNTIME_DIR/$v" "$d")"'
  echo '  DIST_RETRY=""; SELF_UNIT="$v.service"'
  echo '  [ "$CLONE_HASH" = "$RUNTIME_HASH" ] && continue'
  awk '/^  SUPPRESS_REATTEMPT=1$/{on=1} on{print} on && /then continue; fi$/{exit}' "$SCRIPT"
  awk '/^  PREV_GOOD="\$\(cat "\$LAST_GOOD_DIR\/\$v"/{on=1} on{print} on && /^  echo "\$HEAD" > "\$LAST_GOOD_DIR\/\$v"$/{exit}' "$SCRIPT"
  echo 'done'
  echo '}'
} | sed -e "s#/usr/local/bin/mirror-to-live#mirror_real#g" > "$T/fns.sh"
grep -q 'mirror_real' "$T/fns.sh" && grep -q 'SUPPRESS_REATTEMPT=1' "$T/fns.sh" \
  || { echo "FAIL - could not extract the drift block and the mirror->restart slice"; exit 1; }

CALLS="$T/calls.txt"; LOG="$T/log.txt"
log() { echo "$*" >> "$LOG"; }
emit_gap() { echo "GAP $1" >> "$CALLS"; }
mirror_real() { echo "MIRROR $1" >> "$CALLS"; MITOSIS_RUNTIME_DIR="$RUNTIME_DIR" bash "$MIRROR" "$1" "$2" >> "$LOG" 2>&1; }
systemctl() {
  case "$1" in
    is-active) return 0 ;;
    is-enabled) echo enabled ;;
    restart) echo "RESTART $2" >> "$CALLS" ;;
    *) : ;;
  esac
}
vessel_unit() { echo "$1.service"; }
health_port() { :; }
healthy() { return 0; }
restart_age_defer() { RA_INFLIGHT=""; RA_OLDEST=""; RA_DEFER=0; RA_WHY=""; }
restart_breadcrumb() { :; }
restart_siblings() { :; }
# shellcheck disable=SC1090
source "$T/fns.sh"

VESSEL=demo-vessel
CLONE_DIR="$T/clones"; RUNTIME_DIR="$T/runtime"; MARKER_DIR="$T/marker"; LAST_GOOD_DIR="$T/lastgood"
AUTHORING_MARKER_DIR="$T/authoring"; DEFERRAL_LOG="$T/deferrals.jsonl"; BRANCH=dev; STAGGER_SECONDS=0
DRIFT_QUARANTINE_DIR="$T/quarantine"; DRIFT_QUARANTINE_KEEP=3
d="$CLONE_DIR/$VESSEL"; R="$RUNTIME_DIR/$VESSEL"; MARKER="$MARKER_DIR/$VESSEL.sha"
g() { git -C "$d" -c user.name=t -c user.email=t@t "$@" >/dev/null 2>&1; }
commit() { echo "export const csrf = '$1';" > "$d/src/x.ts"; g add -A; g commit -m "$1"; g update-ref refs/remotes/origin/dev HEAD; }
mirror_now() { # what a past successful pull-sync tick leaves behind
  MITOSIS_RUNTIME_DIR="$RUNTIME_DIR" bash "$MIRROR" "$VESSEL" "$CLONE_DIR" >> "$LOG" 2>&1
  content_hash "$d" > "$MARKER"; content_hash "$d" > "$MARKER_DIR/$VESSEL.runtime-sha"
  git -C "$d" rev-parse HEAD > "$LAST_GOOD_DIR/$VESSEL"
}
setup() {
  rm -rf "$CLONE_DIR" "$RUNTIME_DIR" "$MARKER_DIR" "$LAST_GOOD_DIR" "$AUTHORING_MARKER_DIR" "$DRIFT_QUARANTINE_DIR"
  mkdir -p "$d/src" "$R" "$MARKER_DIR" "$LAST_GOOD_DIR" "$AUTHORING_MARKER_DIR"
  git -C "$d" init -q -b dev; commit old
  mirror_now
  : > "$CALLS"; : > "$LOG"; synced=0; failed=0; skipped=0
}
hand_deploy() { # the newer fix, deployed straight into the runtime, never pushed
  echo "export const csrf = 'NEW: double-submit token check';" > "$R/src/x.ts"
  echo "export const tokenCheck = true;" > "$R/src/csrf-guard.ts"
  mkdir -p "$R/node_modules/dep"; echo junk > "$R/node_modules/dep/index.js"
  rm -rf "$T/expected"; mkdir -p "$T/expected"; cp -a "$R" "$T/expected/"; rm -rf "$T/expected/$VESSEL/node_modules"
}
run() { HEAD="$(git -C "$d" rev-parse HEAD)"; run_slice; }
qcopies() { ls -1d "$DRIFT_QUARANTINE_DIR/$VESSEL"-* 2>/dev/null; }

# ── (a)-(c) the 10:07 replay ───────────────────────────────────────────────────
setup; hand_deploy
NEWER_HASH="$(content_hash "$R" "$d")"; CLONE_H="$(content_hash "$d")"; HEAD_SHA="$(git -C "$d" rev-parse HEAD)"
run
Q="$(qcopies | head -1)"
if [ -n "$Q" ] && diff -r "$T/expected/$VESSEL" "$Q/$VESSEL" >/dev/null 2>&1; then
  ok "(a) the newer live tree is recoverable byte-for-byte from $DRIFT_QUARANTINE_DIR"
else
  bad "(a) the newer live tree is NOT recoverable from quarantine (copies: '$(qcopies | tr '\n' ' ')')"
fi
[ -n "$Q" ] && [ ! -e "$Q/$VESSEL/node_modules" ] && ok "(a) node_modules is not copied" || bad "(a) node_modules copied or no copy"
gap="$(grep '^GAP .*pull-sync-drift-quarantined-' "$CALLS" || true)"
if [ -n "$gap" ] && [ -n "$Q" ] && printf '%s' "$gap" | grep -qF "$Q/$VESSEL" \
   && printf '%s' "$gap" | grep -qF "$NEWER_HASH" && printf '%s' "$gap" | grep -qF "$CLONE_H" \
   && printf '%s' "$gap" | grep -qF "$HEAD_SHA"; then
  ok "(b) a gap names the quarantine path, live hash, clone hash and clone HEAD"
else
  bad "(b) no gap naming the quarantined content was filed"
fi
printf '%s' "${gap#GAP }" | jq -e . >/dev/null 2>&1 && ok "(b) the gap payload is valid JSON" || bad "(b) the gap payload is not valid JSON"
[ "$(content_hash "$R" "$d")" = "$CLONE_H" ] && ok "(c) the heal still restored the runtime from the clone" || bad "(c) the runtime was not healed"

# ── (d) quarantine cannot be made -> no overwrite ──────────────────────────────
setup; hand_deploy
NEWER_HASH="$(content_hash "$R" "$d")"
: > "$T/blocker"; DRIFT_QUARANTINE_DIR="$T/blocker/q"
run
DRIFT_QUARANTINE_DIR="$T/quarantine"
[ "$(content_hash "$R" "$d")" = "$NEWER_HASH" ] && ok "(d) a failed quarantine leaves the live tree untouched" || bad "(d) the live tree was overwritten although it could not be copied aside"
grep -q '^GAP .*pull-sync-drift-quarantine-failed-' "$CALLS" && ok "(d) and files a gap saying so" || bad "(d) no gap for the refused overwrite"
grep -q "^MIRROR" "$CALLS" && bad "(d) mirror-to-live ran" || ok "(d) mirror-to-live did not run"

# ── (e) control: drift back to a tree pull-sync wrote (post-revert) heals quietly
setup
# pull-sync mirrored `old` (setup), then attempted `attempted`, which went
# unhealthy and was reverted: the live tree is the last-good tree pull-sync
# wrote back, the marker holds the attempted hash, runtime-sha the reverted one.
# (Built directly: mirror-to-live resets the clone to HEAD before copying.)
commit attempted
content_hash "$d" > "$MARKER"
content_hash "$R" "$d" > "$MARKER_DIR/$VESSEL.runtime-sha"
: > "$CALLS"
run
grep -q "^MIRROR $VESSEL" "$CALLS" && [ "$(content_hash "$R" "$d")" = "$(content_hash "$d")" ] \
  && ok "(e) a runtime on a tree pull-sync wrote still heals" || bad "(e) the heal did not run"
[ -z "$(qcopies)" ] && ! grep -q '^GAP .*drift-quarantine' "$CALLS" \
  && ok "(e) and is not quarantined or gapped" || bad "(e) a tree pull-sync wrote was quarantined/gapped"

# ── (f) control: ordinary advance ──────────────────────────────────────────────
setup
commit newer
run
grep -q "^MIRROR $VESSEL" "$CALLS" && [ "$(content_hash "$R" "$d")" = "$(content_hash "$d")" ] \
  && ok "(f) an ordinary advance mirrors" || bad "(f) an ordinary advance did not mirror"
[ -z "$(qcopies)" ] && ! grep -q '^GAP' "$CALLS" && ok "(f) with no quarantine and no gap" || bad "(f) an ordinary advance was quarantined/gapped"

# ── (g) retention ──────────────────────────────────────────────────────────────
setup; DRIFT_QUARANTINE_KEEP=2
for i in 1 2 3 4; do
  echo "export const hand = $i;" > "$R/src/x.ts"; run
done
DRIFT_QUARANTINE_KEEP=3
n="$(qcopies | wc -l)"
last="$(qcopies | LC_ALL=C sort | tail -1)"
[ "$n" = 2 ] && grep -q 'hand = 4' "$last/$VESSEL/src/x.ts" 2>/dev/null \
  && ok "(g) retention keeps the newest 2 of 4 copies" || bad "(g) retention kept $n copies (newest: '$last')"

echo; [ "$FAILS" = 0 ] && { echo "PASS"; exit 0; } || { echo "$FAILS FAILED"; exit 1; }
