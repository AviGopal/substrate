#!/usr/bin/env bash
# pull-sync mirrors a test-only landing but owes it no unit restart
# (scripts/substrate/substrate-pull-sync.sh, test_only_range). Runs the script's
# own mirror -> restart slice (from the PREV_GOOD read to the last-good write)
# against a temp vessel clone, with systemctl and mirror-to-live stubbed to
# record calls. The range is the last-good pin (PREV_GOOD) .. HEAD.
#
#   (a) a test-only range mirrors and does NOT restart (and logs "test-only")
#   (b) a mixed range (test + src) restarts
#   (c) a missing last-good pin restarts
#   (d) a rename src/x.ts -> test/x.ts is not test-only (restarts)
#   (e) a test-only range whose runtime non-test code differs from the clone
#       (image rebuilt under the pin) restarts
#   (f) a test-only range with a restart already owed (restart-pending) restarts
#
# usage: validation/scripts/pull-sync-test-only-restart.test.sh [path/to/substrate-pull-sync.sh]
# Needs bash, git, awk, sed. No root: every path is a temp dir.
set -uo pipefail
SCRIPT="${1:-$(cd "$(dirname "$0")/../.." && pwd)/scripts/substrate/substrate-pull-sync.sh}"
T="$(mktemp -d)"; trap 'rm -rf "$T"' EXIT
FAILS=0
ok()  { echo "ok   - $*"; }
bad() { echo "FAIL - $*"; FAILS=$((FAILS+1)); }

# ── the code under test, taken from the script itself ─────────────────────────
{
  sed -n '/^test_only_range() {/,/^}/p' "$SCRIPT"
  sed -n '/^content_hash_nontest() {/,/^}/p' "$SCRIPT"
  echo 'run_slice() {'
  echo 'for v in "$VESSEL"; do'
  awk '/^  PREV_GOOD="\$\(cat "\$LAST_GOOD_DIR\/\$v"/{on=1} on{print} on && /^  echo "\$HEAD" > "\$LAST_GOOD_DIR\/\$v"$/{exit}' "$SCRIPT"
  echo 'done'
  echo '}'
} | sed -e "s#/usr/local/bin/mirror-to-live#mirror_stub#g" > "$T/fns.sh"
grep -q 'mirror_stub' "$T/fns.sh" || { echo "FAIL - could not extract the mirror->restart slice"; exit 1; }

CALLS="$T/calls.txt"; LOG="$T/log.txt"
log() { echo "$*" >> "$LOG"; }
emit_gap() { echo "GAP $1" >> "$CALLS"; }
mirror_stub() { echo "MIRROR $1" >> "$CALLS"; rm -rf "$RUNTIME_DIR/$1/src"; cp -r "$2/$1/src" "$RUNTIME_DIR/$1/src"; return 0; }
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
restart_siblings() { echo "SIBLINGS $1" >> "$CALLS"; }
# shellcheck disable=SC1090
source "$T/fns.sh"

VESSEL=demo-vessel
CLONE_DIR="$T/clones"; RUNTIME_DIR="$T/runtime"; MARKER_DIR="$T/marker"; LAST_GOOD_DIR="$T/lastgood"
DEFERRAL_LOG="$T/deferrals.jsonl"; BRANCH=dev; STAGGER_SECONDS=0; CLONE_HASH=c1; RUNTIME_HASH=r1
d="$CLONE_DIR/$VESSEL/"; MARKER="$MARKER_DIR/$VESSEL.sha"
g() { git -C "$d" -c user.name=t -c user.email=t@t "$@" >/dev/null 2>&1; }

setup() { # fresh clone with a base commit pinned as last-good
  rm -rf "$T/clones" "$T/runtime" "$T/marker" "$T/lastgood"
  mkdir -p "$d/src" "$d/test" "$RUNTIME_DIR/$VESSEL" "$MARKER_DIR" "$LAST_GOOD_DIR"
  echo 'export const x = 1;' > "$d/src/x.ts"
  echo 'test("x", () => {});' > "$d/src/x.test.ts"
  echo 'test("y", () => {});' > "$d/test/y.test.ts"
  git -C "$d" init -q -b dev; g add -A; g commit -m base
  git -C "$d" rev-parse HEAD > "$LAST_GOOD_DIR/$VESSEL"
  cp -r "$d/src" "$RUNTIME_DIR/$VESSEL/src"   # the unit runs the pinned code
  : > "$CALLS"; : > "$LOG"; synced=0; failed=0; skipped=0
}
run() { HEAD="$(git -C "$d" rev-parse HEAD)"; run_slice; }

# ── (a) test-only range: mirrors, no restart ───────────────────────────────────
setup
echo 'test("x2", () => {});' >> "$d/src/x.test.ts"
echo 'test("y2", () => {});' >> "$d/test/y.test.ts"
mkdir -p "$d/tests/fixtures"; echo '{}' > "$d/tests/fixtures/f.json"
echo 'it("z", () => {});' > "$d/src/z.spec.ts"
g add -A; g commit -m test-only
run
grep -q "^MIRROR $VESSEL" "$CALLS" && ok "(a) a test-only range is still mirrored" || bad "(a) a test-only range was not mirrored"
grep -q '^RESTART' "$CALLS" && bad "(a) a test-only range restarted the unit" || ok "(a) a test-only range does not restart the unit"
grep -q '^SIBLINGS' "$CALLS" && bad "(a) a test-only range restarted sibling units" || ok "(a) a test-only range does not restart sibling units"
grep -q "$VESSEL.*test-only" "$LOG" && ok "(a) the skip is logged with the vessel and 'test-only'" || bad "(a) no 'test-only' skip line naming the vessel"
[ "$(cat "$LAST_GOOD_DIR/$VESSEL")" = "$HEAD" ] && ok "(a) last-good advances to HEAD" || bad "(a) last-good did not advance"

# ── (b) mixed range: restarts ──────────────────────────────────────────────────
setup
echo 'test("x2", () => {});' >> "$d/src/x.test.ts"; g commit -am test
echo 'export const x = 2;' > "$d/src/x.ts"; g commit -am fix
run
grep -q "^MIRROR $VESSEL" "$CALLS" && ok "(b) a mixed range is mirrored" || bad "(b) a mixed range was not mirrored"
grep -q "^RESTART $VESSEL.service" "$CALLS" && ok "(b) a mixed range (test commit + src commit) restarts" || bad "(b) a mixed range did not restart"
grep -q 'test-only' "$LOG" && bad "(b) a mixed range logged a test-only skip" || ok "(b) no test-only skip logged"

# ── (c) missing last-good pin: restarts ────────────────────────────────────────
setup
rm -f "$LAST_GOOD_DIR/$VESSEL"
echo 'test("x2", () => {});' >> "$d/src/x.test.ts"; g commit -am test
run
grep -q "^RESTART $VESSEL.service" "$CALLS" && ok "(c) a missing last-good pin restarts" || bad "(c) a missing last-good pin did not restart"

# ── (c2) unreadable pin (sha not in the clone): restarts ───────────────────────
setup
echo 0123456789abcdef0123456789abcdef01234567 > "$LAST_GOOD_DIR/$VESSEL"
echo 'test("x2", () => {});' >> "$d/src/x.test.ts"; g commit -am test
run
grep -q "^RESTART $VESSEL.service" "$CALLS" && ok "(c2) an uncomputable diff restarts" || bad "(c2) an uncomputable diff did not restart"

# ── (d) a rename out of src into test/ is not test-only ────────────────────────
setup
git -C "$d" mv src/x.ts test/x.ts >/dev/null 2>&1; g commit -m move
run
grep -q "^RESTART $VESSEL.service" "$CALLS" && ok "(d) src/x.ts -> test/x.ts restarts (the old path left the runtime)" || bad "(d) a rename out of src was treated as test-only"

# ── (e) runtime's non-test code is not the pin's (rebuilt image): restarts ────
setup
echo 'export const x = 0; // older baked image' > "$RUNTIME_DIR/$VESSEL/src/x.ts"
echo 'test("x2", () => {});' >> "$d/src/x.test.ts"; g commit -am test
run
grep -q "^MIRROR $VESSEL" "$CALLS" && ok "(e) mirrored" || bad "(e) not mirrored"
grep -q "^RESTART $VESSEL.service" "$CALLS" && ok "(e) a test-only range over a runtime whose non-test code differs restarts" || bad "(e) restart skipped although the runtime ran different non-test code"

# ── (f) a restart already owed: restarts ───────────────────────────────────────
setup
echo somehash > "$MARKER_DIR/$VESSEL.restart-pending"
echo 'test("x2", () => {});' >> "$d/src/x.test.ts"; g commit -am test
run
grep -q "^RESTART $VESSEL.service" "$CALLS" && ok "(f) a test-only range with restart-pending restarts" || bad "(f) restart skipped although one was owed"

echo; [ "$FAILS" = 0 ] && { echo "PASS"; exit 0; } || { echo "$FAILS FAILED"; exit 1; }
